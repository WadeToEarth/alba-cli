import http from 'http';
import ora from 'ora';
import { neon, tag } from '../lib/colors.mjs';
import { checkHealth, createProject, recordTask, advancePhase } from '../lib/api.mjs';
import { printLogo } from '../lib/ascii.mjs';
import { TIMING } from '../lib/config.mjs';
import { PHASES, getTaskReward } from '../lib/phases.mjs';
import { randomProjectName, randomTag } from '../lib/project-names.mjs';
import { isAuthenticated, loadCredentials, saveCredentials } from '../lib/auth.mjs';

const FRONTEND_URL = 'https://alba-run.vercel.app';

// ── Helpers ──────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

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
let totalProjects = 0;
let totalTasksCompleted = 0;

process.on('SIGINT', () => {
  running = false;
});

async function buildProject(online) {
  const projectName = randomProjectName();
  const projectTag = randomTag();
  let projectId = null;

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

  let projectTaskCount = 0;

  for (const phaseData of PHASES) {
    if (!running) break;

    console.log(
      `  ${tag.phase} ${neon.magenta(`═══ Phase ${phaseData.phase}: ${phaseData.label} ═══`)}`
    );

    for (const taskDef of phaseData.tasks) {
      if (!running) break;

      const msgCount = rand(2, 3);
      for (let m = 0; m < msgCount; m++) {
        const msg = TASK_MESSAGES[Math.floor(Math.random() * TASK_MESSAGES.length)];
        console.log(`  ${neon.dim(timestamp())} ${tag.task} ${neon.cyan(msg)}`);
        await sleep(rand(TIMING.AGENT_LOG_MIN, TIMING.AGENT_LOG_MAX));
        if (!running) break;
      }

      if (!running) break;

      const reward = getTaskReward(taskDef.rewardRange);
      projectTaskCount++;
      totalTasksCompleted++;

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
        `  ${neon.dim(timestamp())} ${tag.task} ${neon.green('✓')} ${neon.dim(taskDef.name)}`
      );
    }

    if (!running) break;

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

    await sleep(TIMING.PHASE_TRANSITION_DELAY);
  }

  if (running) {
    totalProjects++;
    console.log(neon.green(`  ═══ Project "${projectName}" listed on marketplace ═══`));
    console.log(
      `  ${neon.dim(`Project listed on marketplace — ${projectTaskCount} tasks completed`)}`
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

    console.log(`  ${neon.dim('Next project starting in 5 seconds...')}`);
    await sleep(5000);
    if (!running) break;
    console.log();
  }

  console.log();
  console.log(neon.green('  ═══ Agent shutting down ═══'));
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
