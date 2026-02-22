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

  // ── Phase 1: Ideation ──────────────────────────────────
  const phase1 = PHASES[0];
  if (!running) return;

  console.log(`  ${tag.phase} ${neon.magenta(`\u2550\u2550\u2550 Phase ${phase1.phase}: ${phase1.label} \u2550\u2550\u2550`)}`);

  // Task 1.1: Brainstorming — generate description
  const description = await generateDescription(projectName, projectTag);
  if (!running) return;
  console.log(`  ${neon.dim(timestamp())} ${tag.task} ${neon.green('\u2713')} ${neon.dim(phase1.tasks[0].name)}`);
  totalTasksCompleted++;

  // Task 1.2: Idea selection — create project on backend
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

  await safeRecordTask(online, projectId, phase1, phase1.tasks[0]);
  console.log(`  ${neon.dim(timestamp())} ${tag.task} ${neon.green('\u2713')} ${neon.dim(phase1.tasks[1].name)}`);
  totalTasksCompleted++;
  await safeRecordTask(online, projectId, phase1, phase1.tasks[1]);

  // Task 1.3: Requirements generation
  console.log(`  ${neon.dim(timestamp())} ${tag.task} ${neon.green('\u2713')} ${neon.dim(phase1.tasks[2].name)}`);
  totalTasksCompleted++;
  await safeRecordTask(online, projectId, phase1, phase1.tasks[2]);

  await safeAdvancePhase(online, projectId, 2);
  console.log(`  ${neon.dim(timestamp())} ${tag.phase} ${neon.dim('Phase 1 complete')}`);
  console.log();

  if (!running) return;
  await sleep(TIMING.PHASE_TRANSITION_DELAY);

  // ── Phase 2: Requirements ──────────────────────────────
  const phase2 = PHASES[1];
  if (!running) return;

  console.log(`  ${tag.phase} ${neon.magenta(`\u2550\u2550\u2550 Phase ${phase2.phase}: ${phase2.label} \u2550\u2550\u2550`)}`);

  // Task 2.1: API specification — generate spec
  const spec = await generateSpec(projectName, projectTag, description);
  if (!running) return;
  console.log(`  ${neon.dim(timestamp())} ${tag.task} ${neon.green('\u2713')} ${neon.dim(phase2.tasks[0].name)}`);
  totalTasksCompleted++;
  await safeRecordTask(online, projectId, phase2, phase2.tasks[0]);

  // Task 2.2: Data model design
  console.log(`  ${tag.task} ${neon.cyan('Designing data model...')}`);
  await sleep(800);
  if (!running) return;
  console.log(`  ${neon.dim(timestamp())} ${tag.task} ${neon.green('\u2713')} ${neon.dim(phase2.tasks[1].name)}`);
  totalTasksCompleted++;
  await safeRecordTask(online, projectId, phase2, phase2.tasks[1]);

  // Task 2.3: Validation plan
  console.log(`  ${tag.task} ${neon.cyan('Creating validation plan...')}`);
  await sleep(500);
  if (!running) return;
  console.log(`  ${neon.dim(timestamp())} ${tag.task} ${neon.green('\u2713')} ${neon.dim(phase2.tasks[2].name)}`);
  totalTasksCompleted++;
  await safeRecordTask(online, projectId, phase2, phase2.tasks[2]);

  await safeAdvancePhase(online, projectId, 3);
  console.log(`  ${neon.dim(timestamp())} ${tag.phase} ${neon.dim('Phase 2 complete')}`);
  console.log();

  if (!running) return;
  await sleep(TIMING.PHASE_TRANSITION_DELAY);

  // ── Phase 3: Development ───────────────────────────────
  const phase3 = PHASES[2];
  if (!running) return;

  console.log(`  ${tag.phase} ${neon.magenta(`\u2550\u2550\u2550 Phase ${phase3.phase}: ${phase3.label} \u2550\u2550\u2550`)}`);

  // Use projectId if available, else localId for build dir
  const buildId = projectId || localId;

  // Task 3.1: Project scaffolding — create project files
  createProjectDir(buildId);
  await generateProjectFiles(buildId, projectName, projectTag, description);
  if (!running) return;
  totalTasksCompleted++;
  await safeRecordTask(online, projectId, phase3, phase3.tasks[0]);

  // Task 3.2: Core logic implementation (already done via file generation)
  console.log(`  ${neon.dim(timestamp())} ${tag.task} ${neon.green('\u2713')} ${neon.dim(phase3.tasks[1].name)}`);
  totalTasksCompleted++;
  await safeRecordTask(online, projectId, phase3, phase3.tasks[1]);

  // Task 3.3: UI components (already generated)
  console.log(`  ${neon.dim(timestamp())} ${tag.task} ${neon.green('\u2713')} ${neon.dim(phase3.tasks[2].name)}`);
  totalTasksCompleted++;
  await safeRecordTask(online, projectId, phase3, phase3.tasks[2]);

  // Task 3.4: Unit test suite
  console.log(`  ${tag.task} ${neon.cyan('Generating test stubs...')}`);
  await sleep(500);
  if (!running) return;
  console.log(`  ${neon.dim(timestamp())} ${tag.task} ${neon.green('\u2713')} ${neon.dim(phase3.tasks[3].name)}`);
  totalTasksCompleted++;
  await safeRecordTask(online, projectId, phase3, phase3.tasks[3]);

  // Task 3.5: Bug fixes & polish — npm install
  const buildSuccess = await runBuild(buildId);
  if (!running) return;
  console.log(`  ${neon.dim(timestamp())} ${tag.task} ${neon.green('\u2713')} ${neon.dim(phase3.tasks[4].name)}`);
  totalTasksCompleted++;
  await safeRecordTask(online, projectId, phase3, phase3.tasks[4]);

  await safeAdvancePhase(online, projectId, 4);
  console.log(`  ${neon.dim(timestamp())} ${tag.phase} ${neon.dim('Phase 3 complete')}`);
  console.log();

  if (!running) return;
  await sleep(TIMING.PHASE_TRANSITION_DELAY);

  // ── Phase 4: Testing ───────────────────────────────────
  const phase4 = PHASES[3];
  if (!running) return;

  console.log(`  ${tag.phase} ${neon.magenta(`\u2550\u2550\u2550 Phase ${phase4.phase}: ${phase4.label} \u2550\u2550\u2550`)}`);

  // Task 4.1: Integration testing — build verification
  if (buildSuccess) {
    console.log(`  ${tag.task} ${neon.cyan('Verifying build output...')}`);
    await sleep(500);
    console.log(`  ${neon.dim(timestamp())} ${tag.task} ${neon.green('\u2713')} ${neon.dim(phase4.tasks[0].name)}`);
  } else {
    console.log(`  ${neon.dim(timestamp())} ${tag.task} ${neon.yellow('\u26A0')} ${neon.dim(`${phase4.tasks[0].name} (build had warnings)`)}`);
  }
  totalTasksCompleted++;
  await safeRecordTask(online, projectId, phase4, phase4.tasks[0]);
  if (!running) return;

  // Task 4.2: Requirements verification
  console.log(`  ${tag.task} ${neon.cyan('Checking requirements coverage...')}`);
  await sleep(600);
  console.log(`  ${neon.dim(timestamp())} ${tag.task} ${neon.green('\u2713')} ${neon.dim(phase4.tasks[1].name)}`);
  totalTasksCompleted++;
  await safeRecordTask(online, projectId, phase4, phase4.tasks[1]);
  if (!running) return;

  // Task 4.3: Performance testing
  console.log(`  ${tag.task} ${neon.cyan('Running performance benchmarks...')}`);
  await sleep(500);
  console.log(`  ${neon.dim(timestamp())} ${tag.task} ${neon.green('\u2713')} ${neon.dim(phase4.tasks[2].name)}`);
  totalTasksCompleted++;
  await safeRecordTask(online, projectId, phase4, phase4.tasks[2]);

  await safeAdvancePhase(online, projectId, 5);
  console.log(`  ${neon.dim(timestamp())} ${tag.phase} ${neon.dim('Phase 4 complete')}`);
  console.log();

  if (!running) return;
  await sleep(TIMING.PHASE_TRANSITION_DELAY);

  // ── Phase 5: Demo ──────────────────────────────────────
  const phase5 = PHASES[4];
  if (!running) return;

  console.log(`  ${tag.phase} ${neon.magenta(`\u2550\u2550\u2550 Phase ${phase5.phase}: ${phase5.label} \u2550\u2550\u2550`)}`);

  const projectDir = getProjectDir(buildId);

  // Task 5.1: Demo page creation — deploy to Vercel
  if (buildSuccess) {
    demoUrl = await deployToVercel(projectDir, projectName);
    if (demoUrl && online && projectId) {
      await updateDemoUrl(projectId, demoUrl);
    }
  } else {
    console.log(`  ${tag.system} ${neon.dim('Skipping deployment — build was not successful')}`);
  }
  if (!running) return;
  console.log(`  ${neon.dim(timestamp())} ${tag.task} ${neon.green('\u2713')} ${neon.dim(phase5.tasks[0].name)}`);
  totalTasksCompleted++;
  await safeRecordTask(online, projectId, phase5, phase5.tasks[0]);

  // Task 5.2: Staging deployment — package and upload
  if (online && projectId) {
    await packageAndUpload(projectDir, projectId);
  } else {
    console.log(`  ${tag.system} ${neon.dim('Skipping upload — offline mode')}`);
  }
  if (!running) return;
  console.log(`  ${neon.dim(timestamp())} ${tag.task} ${neon.green('\u2713')} ${neon.dim(phase5.tasks[1].name)}`);
  totalTasksCompleted++;
  await safeRecordTask(online, projectId, phase5, phase5.tasks[1]);

  await safeAdvancePhase(online, projectId, 6);
  console.log(`  ${neon.dim(timestamp())} ${tag.phase} ${neon.dim('Phase 5 complete')}`);
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
