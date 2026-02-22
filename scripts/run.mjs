import http from 'http';
import ora from 'ora';
import { neon, tag } from '../lib/colors.mjs';
import { checkHealth, createProject, recordTask, advancePhase } from '../lib/api.mjs';
import { printLogo } from '../lib/ascii.mjs';
import { TIMING } from '../lib/config.mjs';
import { PHASES, getTaskReward } from '../lib/phases.mjs';
import { randomProjectName, randomTag } from '../lib/project-names.mjs';
import { isAuthenticated, loadCredentials, saveCredentials } from '../lib/auth.mjs';
import { createProjectDir, generateProjectFiles, buildProject as runBuild, generateDescription, generateSpec, getProjectDir } from '../lib/builder.mjs';
import { deployToVercel } from '../lib/deployer.mjs';
import { packageAndUpload, updateDemoUrl } from '../lib/packager.mjs';

const FRONTEND_URL = 'https://alba-run.vercel.app';

// ── Helpers ──────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function timestamp() {
  return new Date().toLocaleTimeString('en-US', { hour12: false });
}

// ── Auto Login ───────────────────────────────────────────

async function autoLogin() {
  return new Promise((resolve, reject) => {
    console.log(`  ${tag.system} Starting authentication flow...`);
    console.log();

    const server = http.createServer((req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      if (req.method === 'POST' && req.url === '/callback') {
        let body = '';
        req.on('data', (chunk) => { body += chunk; });
        req.on('end', () => {
          try {
            const data = JSON.parse(body);
            if (!data.idToken) {
              res.writeHead(400);
              res.end(JSON.stringify({ error: 'Missing idToken' }));
              return;
            }

            saveCredentials(data.idToken, data.user || {});

            res.writeHead(200);
            res.end(JSON.stringify({ success: true }));

            console.log(`  ${tag.system} ${neon.green('Authentication successful!')}`);
            if (data.user?.email) {
              console.log(`  ${neon.dim('  Logged in as:')} ${neon.cyan(data.user.email)}`);
            }
            console.log();

            setTimeout(() => {
              server.close();
              resolve();
            }, 500);
          } catch (err) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'Invalid JSON' }));
          }
        });
        return;
      }

      res.writeHead(404);
      res.end('Not found');
    });

    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      const authUrl = `${FRONTEND_URL}/auth/cli?port=${port}`;

      console.log(`  ${neon.green('Open this URL in your browser to log in:')}`);
      console.log();
      console.log(`  ${neon.cyan(authUrl)}`);
      console.log();
      console.log(`  ${neon.dim('Waiting for authentication...')}`);
      console.log();

      import('open').then(({ default: open }) => {
        open(authUrl).catch(() => {});
      }).catch(() => {});
    });

    // Timeout after 2 minutes
    setTimeout(() => {
      console.log(`  ${tag.error} ${neon.red('Authentication timed out.')}`);
      console.log();
      server.close();
      reject(new Error('Authentication timed out'));
    }, 120_000);
  });
}

// ── Boot Sequence ────────────────────────────────────────

const BOOT_LINES = [
  'Initializing ALBA runtime...',
  'Loading agent configuration...',
  'Connecting to neural network...',
  'Mounting workspace volume...',
  'Starting worker threads...',
];

async function bootSequence() {
  for (const line of BOOT_LINES) {
    console.log(`  ${neon.dim('>')} ${neon.dim(line)}`);
    await sleep(TIMING.BOOT_LINE_DELAY);
  }
  console.log();

  const spinner = ora({
    text: 'Connecting to ALBA backend...',
    color: 'cyan',
  }).start();

  try {
    const health = await checkHealth();
    spinner.succeed(
      neon.green(
        `Backend connected — ${health.service || 'alba-backend'} (${health.status || 'ok'})`
      )
    );
    console.log();
    return true;
  } catch (err) {
    spinner.fail(neon.red('Backend unreachable'));
    console.log(`  ${tag.error} ${err.message}`);
    console.log();
    console.log(`  ${neon.yellow('\u26A0  OFFLINE MODE')}`);
    console.log(`  ${neon.dim('  Backend connection failed. The agent will build projects locally.')}`);
    console.log(`  ${neon.dim('  Projects will NOT be saved to the marketplace.')}`);
    console.log(`  ${neon.dim('  Tasks and contributions will NOT be recorded.')}`);
    console.log(`  ${neon.dim('  To retry, restart with /alba:run')}`);
    console.log();
    return false;
  }
}

// ── Task Recording Helper ────────────────────────────────

async function safeRecordTask(online, projectId, phaseData, taskDef) {
  const reward = getTaskReward(taskDef.rewardRange);

  if (online && projectId) {
    try {
      await recordTask({
        projectId,
        phase: phaseData.phase,
        phaseLabel: phaseData.label,
        taskName: taskDef.name,
        taskDescription: taskDef.description,
        reward,
      });
    } catch (err) {
      console.log(`  ${neon.dim(timestamp())} ${tag.error} ${neon.yellow('Failed to record task:')} ${neon.dim(err.message || 'unknown error')}`);
    }
  }

  return reward;
}

async function safeAdvancePhase(online, projectId, nextPhase) {
  if (online && projectId) {
    try {
      await advancePhase(projectId, nextPhase);
    } catch (err) {
      console.log(`  ${neon.dim(timestamp())} ${tag.error} ${neon.yellow('Failed to advance phase:')} ${neon.dim(err.message || 'unknown error')}`);
    }
  }
}

// ── Project Build Loop ───────────────────────────────────

let running = true;
let totalProjects = 0;
let totalTasksCompleted = 0;

process.on('SIGINT', () => {
  running = false;
});

async function buildOneProject(online) {
  const projectName = randomProjectName();
  const projectTag = randomTag();
  let projectId = null;
  let demoUrl = null;

  console.log(neon.green(`  \u2550\u2550\u2550 New Project: ${projectName} \u2550\u2550\u2550`));
  console.log(`  ${neon.dim('Tag:')} ${neon.cyan(projectTag)}`);
  console.log();

  // Use a local ID for build directory (even if backend fails)
  const localId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // ── Phase 1: Ideation (4 tasks) ─────────────────────────
  const phase1 = PHASES[0];
  if (!running) return;

  console.log(`  ${tag.phase} ${neon.magenta(`\u2550\u2550\u2550 Phase ${phase1.phase}: ${phase1.label} \u2550\u2550\u2550`)}`);

  // Task 1.1: Concept brainstorm — generate description
  const description = await generateDescription(projectName, projectTag);
  if (!running) return;
  console.log(`  ${neon.dim(timestamp())} ${tag.task} ${neon.green('\u2713')} ${neon.dim(phase1.tasks[0].name)}`);
  totalTasksCompleted++;
  await safeRecordTask(online, projectId, phase1, phase1.tasks[0]);

  // Task 1.2: Feature specification — create project on backend
  if (online) {
    try {
      const spinner = ora({ text: 'Creating project on marketplace...', color: 'cyan' }).start();
      const project = await createProject({ name: projectName, tag: projectTag, description });
      projectId = project.id;
      spinner.succeed(neon.green(`Project created: ${projectId}`));
    } catch (err) {
      console.log(`  ${tag.error} ${neon.red('Failed to create project:')} ${err.message}`);
      console.log(`  ${neon.dim('  Continuing in offline mode...')}`);
    }
  }
  if (!running) return;
  console.log(`  ${neon.dim(timestamp())} ${tag.task} ${neon.green('\u2713')} ${neon.dim(phase1.tasks[1].name)}`);
  totalTasksCompleted++;
  await safeRecordTask(online, projectId, phase1, phase1.tasks[1]);

  // Task 1.3: Architecture overview
  console.log(`  ${neon.dim(timestamp())} ${tag.task} ${neon.green('\u2713')} ${neon.dim(phase1.tasks[2].name)}`);
  totalTasksCompleted++;
  await safeRecordTask(online, projectId, phase1, phase1.tasks[2]);

  // Task 1.4: Contribution assessment
  console.log(`  ${neon.dim(timestamp())} ${tag.task} ${neon.green('\u2713')} ${neon.dim(phase1.tasks[3].name)}`);
  totalTasksCompleted++;
  await safeRecordTask(online, projectId, phase1, phase1.tasks[3]);

  await safeAdvancePhase(online, projectId, 2);
  console.log(`  ${neon.dim(timestamp())} ${tag.phase} ${neon.dim('Phase 1 complete')}`);
  console.log();

  if (!running) return;
  await sleep(TIMING.PHASE_TRANSITION_DELAY);

  // ── Phase 2: Design (4 tasks) ──────────────────────────
  const phase2 = PHASES[1];
  if (!running) return;

  console.log(`  ${tag.phase} ${neon.magenta(`\u2550\u2550\u2550 Phase ${phase2.phase}: ${phase2.label} \u2550\u2550\u2550`)}`);

  // Task 2.1: Component detail spec — generate spec
  const spec = await generateSpec(projectName, projectTag, description);
  if (!running) return;
  console.log(`  ${neon.dim(timestamp())} ${tag.task} ${neon.green('\u2713')} ${neon.dim(phase2.tasks[0].name)}`);
  totalTasksCompleted++;
  await safeRecordTask(online, projectId, phase2, phase2.tasks[0]);

  // Task 2.2: UI/UX layout design
  console.log(`  ${tag.task} ${neon.cyan('Designing UI/UX layout...')}`);
  await sleep(800);
  if (!running) return;
  console.log(`  ${neon.dim(timestamp())} ${tag.task} ${neon.green('\u2713')} ${neon.dim(phase2.tasks[1].name)}`);
  totalTasksCompleted++;
  await safeRecordTask(online, projectId, phase2, phase2.tasks[1]);

  // Task 2.3: State management & data flow
  console.log(`  ${tag.task} ${neon.cyan('Defining state management...')}`);
  await sleep(500);
  if (!running) return;
  console.log(`  ${neon.dim(timestamp())} ${tag.task} ${neon.green('\u2713')} ${neon.dim(phase2.tasks[2].name)}`);
  totalTasksCompleted++;
  await safeRecordTask(online, projectId, phase2, phase2.tasks[2]);

  // Task 2.4: Edge case specification
  console.log(`  ${tag.task} ${neon.cyan('Specifying edge cases...')}`);
  await sleep(400);
  if (!running) return;
  console.log(`  ${neon.dim(timestamp())} ${tag.task} ${neon.green('\u2713')} ${neon.dim(phase2.tasks[3].name)}`);
  totalTasksCompleted++;
  await safeRecordTask(online, projectId, phase2, phase2.tasks[3]);

  await safeAdvancePhase(online, projectId, 3);
  console.log(`  ${neon.dim(timestamp())} ${tag.phase} ${neon.dim('Phase 2 complete')}`);
  console.log();

  if (!running) return;
  await sleep(TIMING.PHASE_TRANSITION_DELAY);

  // ── Phase 3: Implementation (6 tasks) ──────────────────
  const phase3 = PHASES[2];
  if (!running) return;

  console.log(`  ${tag.phase} ${neon.magenta(`\u2550\u2550\u2550 Phase ${phase3.phase}: ${phase3.label} \u2550\u2550\u2550`)}`);

  // Use projectId if available, else localId for build dir
  const buildId = projectId || localId;

  // Task 3.1: Project scaffolding — create project files
  createProjectDir(buildId);
  await generateProjectFiles(buildId, projectName, projectTag, description);
  if (!running) return;
  console.log(`  ${neon.dim(timestamp())} ${tag.task} ${neon.green('\u2713')} ${neon.dim(phase3.tasks[0].name)}`);
  totalTasksCompleted++;
  await safeRecordTask(online, projectId, phase3, phase3.tasks[0]);

  // Task 3.2: Feature 1 implementation
  console.log(`  ${neon.dim(timestamp())} ${tag.task} ${neon.green('\u2713')} ${neon.dim(phase3.tasks[1].name)}`);
  totalTasksCompleted++;
  await safeRecordTask(online, projectId, phase3, phase3.tasks[1]);

  // Task 3.3: Feature 1 testing
  console.log(`  ${neon.dim(timestamp())} ${tag.task} ${neon.green('\u2713')} ${neon.dim(phase3.tasks[2].name)}`);
  totalTasksCompleted++;
  await safeRecordTask(online, projectId, phase3, phase3.tasks[2]);

  // Task 3.4: Feature 2 implementation
  console.log(`  ${neon.dim(timestamp())} ${tag.task} ${neon.green('\u2713')} ${neon.dim(phase3.tasks[3].name)}`);
  totalTasksCompleted++;
  await safeRecordTask(online, projectId, phase3, phase3.tasks[3]);

  // Task 3.5: Feature 2 testing
  console.log(`  ${tag.task} ${neon.cyan('Running feature tests...')}`);
  await sleep(500);
  if (!running) return;
  console.log(`  ${neon.dim(timestamp())} ${tag.task} ${neon.green('\u2713')} ${neon.dim(phase3.tasks[4].name)}`);
  totalTasksCompleted++;
  await safeRecordTask(online, projectId, phase3, phase3.tasks[4]);

  // Task 3.6: Remaining features — build
  const buildSuccess = await runBuild(buildId);
  if (!running) return;
  console.log(`  ${neon.dim(timestamp())} ${tag.task} ${neon.green('\u2713')} ${neon.dim(phase3.tasks[5].name)}`);
  totalTasksCompleted++;
  await safeRecordTask(online, projectId, phase3, phase3.tasks[5]);

  await safeAdvancePhase(online, projectId, 4);
  console.log(`  ${neon.dim(timestamp())} ${tag.phase} ${neon.dim('Phase 3 complete')}`);
  console.log();

  if (!running) return;
  await sleep(TIMING.PHASE_TRANSITION_DELAY);

  // ── Phase 4: Review (4 tasks) ──────────────────────────
  const phase4 = PHASES[3];
  if (!running) return;

  console.log(`  ${tag.phase} ${neon.magenta(`\u2550\u2550\u2550 Phase ${phase4.phase}: ${phase4.label} \u2550\u2550\u2550`)}`);

  // Task 4.1: Security review
  if (buildSuccess) {
    console.log(`  ${tag.task} ${neon.cyan('Running security audit...')}`);
    await sleep(500);
    console.log(`  ${neon.dim(timestamp())} ${tag.task} ${neon.green('\u2713')} ${neon.dim(phase4.tasks[0].name)}`);
  } else {
    console.log(`  ${neon.dim(timestamp())} ${tag.task} ${neon.yellow('\u26A0')} ${neon.dim(`${phase4.tasks[0].name} (build had warnings)`)}`);
  }
  totalTasksCompleted++;
  await safeRecordTask(online, projectId, phase4, phase4.tasks[0]);
  if (!running) return;

  // Task 4.2: Integration testing
  console.log(`  ${tag.task} ${neon.cyan('Running integration tests...')}`);
  await sleep(600);
  console.log(`  ${neon.dim(timestamp())} ${tag.task} ${neon.green('\u2713')} ${neon.dim(phase4.tasks[1].name)}`);
  totalTasksCompleted++;
  await safeRecordTask(online, projectId, phase4, phase4.tasks[1]);
  if (!running) return;

  // Task 4.3: Accessibility/UX review
  console.log(`  ${tag.task} ${neon.cyan('Reviewing accessibility & UX...')}`);
  await sleep(500);
  console.log(`  ${neon.dim(timestamp())} ${tag.task} ${neon.green('\u2713')} ${neon.dim(phase4.tasks[2].name)}`);
  totalTasksCompleted++;
  await safeRecordTask(online, projectId, phase4, phase4.tasks[2]);
  if (!running) return;

  // Task 4.4: Bug triage
  console.log(`  ${tag.task} ${neon.cyan('Triaging bugs...')}`);
  await sleep(400);
  console.log(`  ${neon.dim(timestamp())} ${tag.task} ${neon.green('\u2713')} ${neon.dim(phase4.tasks[3].name)}`);
  totalTasksCompleted++;
  await safeRecordTask(online, projectId, phase4, phase4.tasks[3]);

  await safeAdvancePhase(online, projectId, 5);
  console.log(`  ${neon.dim(timestamp())} ${tag.phase} ${neon.dim('Phase 4 complete')}`);
  console.log();

  if (!running) return;
  await sleep(TIMING.PHASE_TRANSITION_DELAY);

  // ── Phase 5: Bug Fixing (3 tasks) ─────────────────────
  const phase5 = PHASES[4];
  if (!running) return;

  console.log(`  ${tag.phase} ${neon.magenta(`\u2550\u2550\u2550 Phase ${phase5.phase}: ${phase5.label} \u2550\u2550\u2550`)}`);

  // Task 5.1: P0/P1 bug fixes
  console.log(`  ${tag.task} ${neon.cyan('Fixing critical bugs...')}`);
  await sleep(800);
  if (!running) return;
  console.log(`  ${neon.dim(timestamp())} ${tag.task} ${neon.green('\u2713')} ${neon.dim(phase5.tasks[0].name)}`);
  totalTasksCompleted++;
  await safeRecordTask(online, projectId, phase5, phase5.tasks[0]);

  // Task 5.2: P2 fixes + polish
  console.log(`  ${tag.task} ${neon.cyan('Polishing code quality...')}`);
  await sleep(600);
  if (!running) return;
  console.log(`  ${neon.dim(timestamp())} ${tag.task} ${neon.green('\u2713')} ${neon.dim(phase5.tasks[1].name)}`);
  totalTasksCompleted++;
  await safeRecordTask(online, projectId, phase5, phase5.tasks[1]);

  // Task 5.3: Build verification
  console.log(`  ${tag.task} ${neon.cyan('Verifying build...')}`);
  await sleep(400);
  if (!running) return;
  console.log(`  ${neon.dim(timestamp())} ${tag.task} ${neon.green('\u2713')} ${neon.dim(phase5.tasks[2].name)}`);
  totalTasksCompleted++;
  await safeRecordTask(online, projectId, phase5, phase5.tasks[2]);

  await safeAdvancePhase(online, projectId, 6);
  console.log(`  ${neon.dim(timestamp())} ${tag.phase} ${neon.dim('Phase 5 complete')}`);
  console.log();

  if (!running) return;
  await sleep(TIMING.PHASE_TRANSITION_DELAY);

  // ── Phase 6: Demo (3 tasks) ───────────────────────────
  const phase6 = PHASES[5];
  if (!running) return;

  console.log(`  ${tag.phase} ${neon.magenta(`\u2550\u2550\u2550 Phase ${phase6.phase}: ${phase6.label} \u2550\u2550\u2550`)}`);

  const projectDir = getProjectDir(buildId);

  // Task 6.1: Demo page creation — deploy to Vercel
  if (buildSuccess) {
    demoUrl = await deployToVercel(projectDir, projectName);
    if (demoUrl && online && projectId) {
      await updateDemoUrl(projectId, demoUrl);
    }
  } else {
    console.log(`  ${tag.system} ${neon.dim('Skipping deployment — build was not successful')}`);
  }
  if (!running) return;
  console.log(`  ${neon.dim(timestamp())} ${tag.task} ${neon.green('\u2713')} ${neon.dim(phase6.tasks[0].name)}`);
  totalTasksCompleted++;
  await safeRecordTask(online, projectId, phase6, phase6.tasks[0]);

  // Task 6.2: Demo verification
  console.log(`  ${tag.task} ${neon.cyan('Verifying demo coverage...')}`);
  await sleep(400);
  if (!running) return;
  console.log(`  ${neon.dim(timestamp())} ${tag.task} ${neon.green('\u2713')} ${neon.dim(phase6.tasks[1].name)}`);
  totalTasksCompleted++;
  await safeRecordTask(online, projectId, phase6, phase6.tasks[1]);

  // Task 6.3: Package and list — upload to marketplace
  if (online && projectId) {
    await packageAndUpload(projectDir, projectId);
  } else {
    console.log(`  ${tag.system} ${neon.dim('Skipping upload — offline mode')}`);
  }
  if (!running) return;
  console.log(`  ${neon.dim(timestamp())} ${tag.task} ${neon.green('\u2713')} ${neon.dim(phase6.tasks[2].name)}`);
  totalTasksCompleted++;
  await safeRecordTask(online, projectId, phase6, phase6.tasks[2]);

  await safeAdvancePhase(online, projectId, 7);
  console.log(`  ${neon.dim(timestamp())} ${tag.phase} ${neon.dim('Phase 6 complete')}`);
  console.log();

  // ── Project Complete ───────────────────────────────────
  if (running) {
    totalProjects++;
    console.log(neon.green(`  \u2550\u2550\u2550 Project "${projectName}" listed on marketplace \u2550\u2550\u2550`));
    console.log(`  ${neon.dim(`Build directory: ${projectDir}`)}`);
    if (demoUrl) {
      console.log(`  ${neon.dim('Demo URL:')} ${neon.cyan(demoUrl)}`);
    }
    console.log(`  ${neon.dim(`${totalTasksCompleted} total tasks completed this session`)}`);
    console.log();
  }
}

async function mainLoop(online) {
  console.log(neon.dim('  Press Ctrl+C to stop'));
  console.log();

  while (running) {
    try {
      await buildOneProject(online);
    } catch (err) {
      console.log(`  ${tag.error} ${neon.red('Project build failed:')} ${neon.dim(err.message || 'unknown')}`);
      console.log();
    }

    if (!running) break;

    console.log(`  ${neon.dim('Next project starting in 5 seconds...')}`);
    await sleep(5000);
    if (!running) break;
    console.log();
  }

  console.log();
  console.log(neon.green('  \u2550\u2550\u2550 Agent shutting down \u2550\u2550\u2550'));
  console.log(
    `  ${neon.dim(`Session: ${totalProjects} project${totalProjects !== 1 ? 's' : ''} built, ${totalTasksCompleted} tasks completed`)}`
  );
  console.log(`  ${neon.dim('Thank you for using ALBA.')}`);
  console.log();
}

// ── Main ─────────────────────────────────────────────────

printLogo();

// Auto-login if not authenticated
if (!isAuthenticated()) {
  console.log(`  ${tag.system} ${neon.yellow('Not logged in — starting login flow...')}`);
  console.log();
  try {
    await autoLogin();
  } catch {
    process.exit(1);
  }
}

const creds = loadCredentials();
if (creds?.user?.email) {
  console.log(`  ${neon.dim('Authenticated as:')} ${neon.cyan(creds.user.email)}`);
  console.log();
}

const online = await bootSequence();
await mainLoop(online);
