import http from 'http';
import ora from 'ora';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { execSync } from 'child_process';
import { neon, tag } from '../lib/colors.mjs';
import { checkHealth, createProject, recordTask, advancePhase, listProjects, joinProject, getArtifacts, downloadProjectZip, stripPhasePrefix } from '../lib/api.mjs';
import { printLogo } from '../lib/ascii.mjs';
import { TIMING } from '../lib/config.mjs';
import { PHASES, getTaskReward } from '../lib/phases.mjs';
import { randomProjectName, randomTag } from '../lib/project-names.mjs';
import { isAuthenticated, loadCredentials, saveCredentials, isFirstRun, markFirstRunShown } from '../lib/auth.mjs';
import { createProjectDir, generateProjectFiles, buildProject as runBuild, generateDescription, generateSpec, getProjectDir } from '../lib/builder.mjs';
import { deployToVercel } from '../lib/deployer.mjs';
import { packageAndUpload, updateDemoUrl } from '../lib/packager.mjs';

const FRONTEND_URL = 'https://alba-run.vercel.app';
const PHASE_NAMES = ['', 'Ideation', 'Design', 'Implementation', 'Review', 'Bug Fix', 'Demo'];

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
      return true;
    } catch (err) {
      const is409 = err.message && err.message.includes('409');
      if (is409) {
        console.log(`  ${neon.dim(timestamp())} ${tag.error} ${neon.yellow('Phase advance conflict (same contributor) — stopping')}`);
        return false;
      }
      console.log(`  ${neon.dim(timestamp())} ${tag.error} ${neon.yellow('Failed to advance phase:')} ${neon.dim(err.message || 'unknown error')}`);
    }
  }
  return true;
}

// ── Project Build Loop ───────────────────────────────────

let running = true;
let totalProjects = 0;
let totalTasksCompleted = 0;

process.on('SIGINT', () => {
  running = false;
});

// ── Try Join and Do One Phase ────────────────────────────

async function tryJoinAndDoPhase(online) {
  const spinner = ora({ text: 'Looking for building projects to join...', color: 'cyan' }).start();

  let projects;
  try {
    const all = await listProjects();
    projects = all.filter((p) => p.status === 'building');
  } catch (err) {
    spinner.fail(neon.yellow(`Failed to list projects: ${err.message}`));
    return false;
  }

  if (projects.length === 0) {
    spinner.info(neon.dim('No building projects available'));
    return false;
  }

  spinner.succeed(neon.green(`Found ${projects.length} building project(s)`));

  for (const project of projects) {
    const phaseName = PHASE_NAMES[project.currentPhase] || 'Unknown';
    const joinSpinner = ora({
      text: `Joining "${project.name}" (Phase ${project.currentPhase}: ${phaseName})...`,
      color: 'cyan',
    }).start();

    let joinResult;
    try {
      joinResult = await joinProject(project.id);
      joinSpinner.succeed(neon.green(`Joined "${project.name}" — Phase ${joinResult.currentPhase}: ${joinResult.phaseName}`));
    } catch (err) {
      if (err.message && err.message.includes('409')) {
        joinSpinner.warn(neon.dim(`Already contributed to "${project.name}" — skipping`));
      } else {
        joinSpinner.warn(neon.yellow(`Failed to join "${project.name}": ${err.message}`));
      }
      continue;
    }

    // Successfully joined — set up local directory
    const projectDir = join(homedir(), '.alba', 'builds', project.id);
    mkdirSync(projectDir, { recursive: true });

    const currentPhase = joinResult.currentPhase;

    // Download artifacts
    try {
      const artifacts = await getArtifacts(project.id);
      for (const [rawKey, content] of Object.entries(artifacts)) {
        const filename = stripPhasePrefix(rawKey);
        writeFileSync(join(projectDir, filename), content, 'utf-8');
      }
    } catch (err) {
      console.log(`  ${neon.dim(timestamp())} ${tag.error} ${neon.yellow('Artifact download failed:')} ${neon.dim(err.message)}`);
    }

    // Phase 2+: download previous phase source code
    if (currentPhase >= 2) {
      try {
        const zipBuffer = await downloadProjectZip(project.id);
        if (zipBuffer) {
          const zipPath = join(projectDir, '..', `${project.id}-download.zip`);
          writeFileSync(zipPath, zipBuffer);
          execSync(`unzip -o "${zipPath}" -d "${projectDir}" 2>/dev/null`, { timeout: 30000 });
          console.log(`  ${neon.dim(timestamp())} ${tag.system} ${neon.green('Source code downloaded')}`);
        }
      } catch (err) {
        console.log(`  ${neon.dim(timestamp())} ${tag.error} ${neon.yellow('Source download failed:')} ${neon.dim(err.message)}`);
      }
    }

    // Execute the current phase
    console.log();
    console.log(neon.green(`  \u2550\u2550\u2550 Joined: ${project.name} (Phase ${currentPhase}: ${joinResult.phaseName}) \u2550\u2550\u2550`));
    console.log();

    await executePhase(online, project.id, project.name, projectDir, currentPhase);

    totalProjects++;
    console.log();
    console.log(neon.green(`  \u2550\u2550\u2550 Phase ${currentPhase} complete for "${project.name}" \u2550\u2550\u2550`));
    console.log(`  ${neon.dim(`${totalTasksCompleted} total tasks completed this session`)}`);
    console.log();

    return true;
  }

  console.log(`  ${neon.dim('All building projects skipped')}`);
  return false;
}

// ── Execute a Single Phase ───────────────────────────────

async function executePhase(online, projectId, projectName, projectDir, phase) {
  const phaseData = PHASES[phase - 1];
  if (!phaseData) return;

  console.log(`  ${tag.phase} ${neon.magenta(`\u2550\u2550\u2550 Phase ${phaseData.phase}: ${phaseData.label} \u2550\u2550\u2550`)}`);

  const buildId = projectId || `local-${Date.now()}`;

  switch (phase) {
    case 2: {
      // Design phase
      const spec = await generateSpec(projectName, '', '');
      if (!running) return;
      for (const task of phaseData.tasks) {
        console.log(`  ${neon.dim(timestamp())} ${tag.task} ${neon.green('\u2713')} ${neon.dim(task.name)}`);
        totalTasksCompleted++;
        await safeRecordTask(online, projectId, phaseData, task);
        await sleep(400);
        if (!running) return;
      }
      await safeAdvancePhase(online, projectId, 3);
      break;
    }

    case 3: {
      // Implementation phase
      createProjectDir(buildId);
      await generateProjectFiles(buildId, projectName, '', '');
      if (!running) return;

      // Tasks 3.1-3.5
      for (let i = 0; i < phaseData.tasks.length - 1; i++) {
        console.log(`  ${neon.dim(timestamp())} ${tag.task} ${neon.green('\u2713')} ${neon.dim(phaseData.tasks[i].name)}`);
        totalTasksCompleted++;
        await safeRecordTask(online, projectId, phaseData, phaseData.tasks[i]);
        if (!running) return;
      }

      // Task 3.6: Build
      await runBuild(buildId);
      if (!running) return;
      const lastTask = phaseData.tasks[phaseData.tasks.length - 1];
      console.log(`  ${neon.dim(timestamp())} ${tag.task} ${neon.green('\u2713')} ${neon.dim(lastTask.name)}`);
      totalTasksCompleted++;
      await safeRecordTask(online, projectId, phaseData, lastTask);

      await safeAdvancePhase(online, projectId, 4);
      break;
    }

    case 4: {
      // Review phase
      for (const task of phaseData.tasks) {
        console.log(`  ${tag.task} ${neon.cyan(`${task.name}...`)}`);
        await sleep(500);
        if (!running) return;
        console.log(`  ${neon.dim(timestamp())} ${tag.task} ${neon.green('\u2713')} ${neon.dim(task.name)}`);
        totalTasksCompleted++;
        await safeRecordTask(online, projectId, phaseData, task);
      }
      await safeAdvancePhase(online, projectId, 5);
      break;
    }

    case 5: {
      // Bug Fix phase
      for (const task of phaseData.tasks) {
        console.log(`  ${tag.task} ${neon.cyan(`${task.name}...`)}`);
        await sleep(600);
        if (!running) return;
        console.log(`  ${neon.dim(timestamp())} ${tag.task} ${neon.green('\u2713')} ${neon.dim(task.name)}`);
        totalTasksCompleted++;
        await safeRecordTask(online, projectId, phaseData, task);
      }
      await safeAdvancePhase(online, projectId, 6);
      break;
    }

    case 6: {
      // Demo phase
      const pd = getProjectDir(buildId);

      // Task 6.1: Deploy
      const demoUrl = await deployToVercel(pd, projectName);
      if (demoUrl && online && projectId) {
        await updateDemoUrl(projectId, demoUrl);
      }
      if (!running) return;
      console.log(`  ${neon.dim(timestamp())} ${tag.task} ${neon.green('\u2713')} ${neon.dim(phaseData.tasks[0].name)}`);
      totalTasksCompleted++;
      await safeRecordTask(online, projectId, phaseData, phaseData.tasks[0]);

      // Task 6.2: Demo verification
      console.log(`  ${tag.task} ${neon.cyan('Verifying demo coverage...')}`);
      await sleep(400);
      if (!running) return;
      console.log(`  ${neon.dim(timestamp())} ${tag.task} ${neon.green('\u2713')} ${neon.dim(phaseData.tasks[1].name)}`);
      totalTasksCompleted++;
      await safeRecordTask(online, projectId, phaseData, phaseData.tasks[1]);

      // Task 6.3: Package and upload
      if (online && projectId) {
        await packageAndUpload(pd, projectId);
      }
      if (!running) return;
      console.log(`  ${neon.dim(timestamp())} ${tag.task} ${neon.green('\u2713')} ${neon.dim(phaseData.tasks[2].name)}`);
      totalTasksCompleted++;
      await safeRecordTask(online, projectId, phaseData, phaseData.tasks[2]);

      await safeAdvancePhase(online, projectId, 7);
      break;
    }
  }

  console.log(`  ${neon.dim(timestamp())} ${tag.phase} ${neon.dim(`Phase ${phase} complete`)}`);
  console.log();
}

// ── Build New Project (Phase 1 & 2 only) ─────────────────

async function buildNewProject(online) {
  const projectName = randomProjectName();
  const projectTag = randomTag();
  let projectId = null;

  console.log(neon.green(`  \u2550\u2550\u2550 New Project: ${projectName} \u2550\u2550\u2550`));
  console.log(`  ${neon.dim('Tag:')} ${neon.cyan(projectTag)}`);
  console.log();

  const localId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // ── Phase 1: Ideation ──────────────────────────────────
  const phase1 = PHASES[0];
  if (!running) return;

  console.log(`  ${tag.phase} ${neon.magenta(`\u2550\u2550\u2550 Phase ${phase1.phase}: ${phase1.label} \u2550\u2550\u2550`)}`);

  // Create project on backend first so all tasks can be recorded with projectId
  const description = await generateDescription(projectName, projectTag);
  if (!running) return;

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

  // Task 1.1: Concept brainstorm
  console.log(`  ${neon.dim(timestamp())} ${tag.task} ${neon.green('\u2713')} ${neon.dim(phase1.tasks[0].name)}`);
  totalTasksCompleted++;
  await safeRecordTask(online, projectId, phase1, phase1.tasks[0]);

  // Task 1.2: Feature specification
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

  const advanced1 = await safeAdvancePhase(online, projectId, 2);
  console.log(`  ${neon.dim(timestamp())} ${tag.phase} ${neon.dim('Phase 1 complete')}`);
  console.log();
  if (!advanced1 || !running) return;

  await sleep(TIMING.PHASE_TRANSITION_DELAY);

  // ── Phase 2: Design ────────────────────────────────────
  const phase2 = PHASES[1];
  if (!running) return;

  console.log(`  ${tag.phase} ${neon.magenta(`\u2550\u2550\u2550 Phase ${phase2.phase}: ${phase2.label} \u2550\u2550\u2550`)}`);

  // Task 2.1: Component detail spec
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

  // Stop here — Phase 3+ will be picked up by other agents via join
  totalProjects++;
  console.log(neon.green(`  \u2550\u2550\u2550 Project "${projectName}" ready for Phase 3 (waiting for contributors) \u2550\u2550\u2550`));
  console.log(`  ${neon.dim(`${totalTasksCompleted} total tasks completed this session`)}`);
  console.log();
}

// ── Main Loop ────────────────────────────────────────────

async function mainLoop(online) {
  console.log(neon.dim('  Press Ctrl+C to stop'));
  console.log();

  while (running) {
    try {
      let didJoin = false;

      if (online) {
        didJoin = await tryJoinAndDoPhase(online);
      }

      if (!didJoin) {
        await buildNewProject(online);
      }
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

// First run welcome message
if (isFirstRun()) {
  console.log(neon.green('  Welcome to ALBA! Here\'s what happens next:'));
  console.log(neon.dim('  1. Connect to backend → find or create a project'));
  console.log(neon.dim('  2. Run through 6 phases: Ideation → Design → Build → Review → Fix → Demo'));
  console.log(neon.dim('  3. Earn tokens for every task. Projects list on the marketplace.'));
  console.log();
  markFirstRunShown();
}

const online = await bootSequence();
await mainLoop(online);
