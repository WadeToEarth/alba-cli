import ora from 'ora';
import { neon, tag } from '../lib/colors.mjs';
import { checkHealth, createProject, recordTask, advancePhase } from '../lib/api.mjs';
import { printLogo } from '../lib/ascii.mjs';
import { TIMING } from '../lib/config.mjs';
import { PHASES, getTaskReward } from '../lib/phases.mjs';
import { randomProjectName, randomTag } from '../lib/project-names.mjs';
import { isAuthenticated, loadCredentials } from '../lib/auth.mjs';

// ── Helpers ──────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

function timestamp() {
  return new Date().toLocaleTimeString('en-US', { hour12: false });
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
  printLogo();

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
    console.log(`  ${neon.dim('  Agent will continue in offline mode...')}`);
    console.log();
    return false;
  }
}

// ── Task Messages ────────────────────────────────────────

const TASK_MESSAGES = [
  'Analyzing project structure...',
  'Evaluating dependencies...',
  'Running static analysis...',
  'Optimizing module graph...',
  'Generating artifacts...',
  'Validating output...',
  'Compiling components...',
  'Reviewing code quality...',
];

// ── Project Build Loop ───────────────────────────────────

let running = true;
let totalEarned = 0;

process.on('SIGINT', () => {
  running = false;
});

async function buildProject(online) {
  const projectName = randomProjectName();
  const projectTag = randomTag();
  let projectId = null;

  // Create project
  console.log(neon.green(`  ═══ New Project: ${projectName} ═══`));
  console.log(`  ${neon.dim('Tag:')} ${neon.cyan(projectTag)}`);
  console.log();

  if (online) {
    try {
      const spinner = ora({ text: 'Creating project...', color: 'cyan' }).start();
      const project = await createProject({ name: projectName, tag: projectTag });
      projectId = project.id;
      spinner.succeed(neon.green(`Project created: ${projectId}`));
      console.log();
    } catch (err) {
      console.log(`  ${tag.error} ${neon.red('Failed to create project:')} ${err.message}`);
      console.log(`  ${neon.dim('  Continuing in offline mode...')}`);
      console.log();
    }
  }

  let projectEarned = 0;

  // Phase loop
  for (const phaseData of PHASES) {
    if (!running) break;

    console.log(
      `  ${tag.phase} ${neon.magenta(`═══ Phase ${phaseData.phase}: ${phaseData.label} ═══`)}`
    );

    // Task loop
    for (const taskDef of phaseData.tasks) {
      if (!running) break;

      const time = timestamp();

      // Simulate work messages
      const msgCount = rand(2, 3);
      for (let m = 0; m < msgCount; m++) {
        const msg = TASK_MESSAGES[Math.floor(Math.random() * TASK_MESSAGES.length)];
        console.log(`  ${neon.dim(timestamp())} ${tag.task} ${neon.cyan(msg)}`);
        await sleep(rand(TIMING.AGENT_LOG_MIN, TIMING.AGENT_LOG_MAX));
        if (!running) break;
      }

      if (!running) break;

      const reward = getTaskReward(taskDef.rewardRange);
      totalEarned += reward;
      projectEarned += reward;

      // Record task via API
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
        } catch {
          // Silently continue
        }
      }

      console.log(
        `  ${neon.dim(timestamp())} ${tag.reward} ${neon.green(`+$${reward.toFixed(2)}`)} ${neon.dim(taskDef.name)} ${neon.dim(`(total: $${totalEarned.toFixed(2)})`)}`
      );
    }

    if (!running) break;

    // Advance phase
    if (online && projectId) {
      try {
        await advancePhase(projectId, phaseData.phase + 1);
      } catch {
        // Silently continue
      }
    }

    console.log(
      `  ${neon.dim(timestamp())} ${tag.phase} ${neon.dim(`Phase ${phaseData.phase} complete`)}`
    );
    console.log();

    // Phase transition delay
    await sleep(TIMING.PHASE_TRANSITION_DELAY);
  }

  // Project complete
  if (running) {
    console.log(neon.green(`  ═══ Project "${projectName}" listed on marketplace ═══`));
    console.log(
      `  ${neon.dim('Project earnings:')} ${neon.green('$' + projectEarned.toFixed(2))}`
    );
    console.log();
  }
}

async function mainLoop(online) {
  console.log(neon.dim('  Press Ctrl+C to stop'));
  console.log();

  while (running) {
    await buildProject(online);

    if (!running) break;

    // Wait before starting next project
    console.log(`  ${neon.dim('Next project starting in 5 seconds...')}`);
    await sleep(5000);
    if (!running) break;
    console.log();
  }

  // Shutdown
  console.log();
  console.log(neon.green('  ═══ Agent shutting down ═══'));
  console.log(
    `  ${neon.dim('Session earnings:')} ${neon.green('$' + totalEarned.toFixed(2))}`
  );
  console.log(`  ${neon.dim('Thank you for using ALBA.')}`);
  console.log();
}

// ── Main ─────────────────────────────────────────────────

if (!isAuthenticated()) {
  printLogo();
  console.log(`  ${tag.error} ${neon.red('Not authenticated.')}`);
  console.log(`  ${neon.dim('  Run')} ${neon.cyan('/alba:login')} ${neon.dim('to authenticate first.')}`);
  console.log();
  process.exit(1);
}

const creds = loadCredentials();
if (creds?.user?.email) {
  console.log(`  ${neon.dim('Authenticated as:')} ${neon.cyan(creds.user.email)}`);
  console.log();
}

const online = await bootSequence();
await mainLoop(online);
