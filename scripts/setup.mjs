import http from 'http';
import ora from 'ora';
import { mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { neon, tag } from '../lib/colors.mjs';
import { checkHealth, createProject, recordTask, advancePhase } from '../lib/api.mjs';
import { printLogo } from '../lib/ascii.mjs';
import { TIMING } from '../lib/config.mjs';
import { PHASES, getTaskReward } from '../lib/phases.mjs';
import { randomProjectName, randomTag } from '../lib/project-names.mjs';
import { isAuthenticated, loadCredentials, saveCredentials } from '../lib/auth.mjs';

const FRONTEND_URL = 'https://alba-run.vercel.app';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

    setTimeout(() => {
      console.log(`  ${tag.error} ${neon.red('Authentication timed out.')}`);
      console.log();
      server.close();
      reject(new Error('Authentication timed out'));
    }, 120_000);
  });
}

// ── Boot Sequence ────────────────────────────────────────

async function bootSequence() {
  const BOOT_LINES = [
    'Initializing ALBA runtime...',
    'Loading agent configuration...',
    'Connecting to neural network...',
    'Mounting workspace volume...',
    'Starting worker threads...',
  ];

  for (const line of BOOT_LINES) {
    console.log(`  ${neon.dim('>')} ${neon.dim(line)}`);
    await sleep(TIMING.BOOT_LINE_DELAY);
  }
  console.log();

  const spinner = ora({ text: 'Connecting to ALBA backend...', color: 'cyan' }).start();

  try {
    const health = await checkHealth();
    spinner.succeed(neon.green(`Backend connected — ${health.service || 'alba-backend'} (${health.status || 'ok'})`));
    console.log();
    return true;
  } catch (err) {
    spinner.fail(neon.red('Backend unreachable'));
    console.log(`  ${tag.error} ${err.message}`);
    console.log();
    console.log(`  ${neon.yellow('⚠  OFFLINE MODE')}`);
    console.log(`  ${neon.dim('  Projects will NOT be saved to the marketplace.')}`);
    console.log();
    return false;
  }
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

// Pick project
const projectName = randomProjectName();
const projectTag = randomTag();
let projectId = null;

console.log(neon.green(`  ═══ New Project: ${projectName} ═══`));
console.log(`  ${neon.dim('Tag:')} ${neon.cyan(projectTag)}`);
console.log();

// ── Phase 1: Ideation ──────────────────────────────────

const phase1 = PHASES[0];
console.log(`  ${tag.phase} ${neon.magenta(`═══ Phase 1: ${phase1.label} ═══`)}`);

if (online) {
  try {
    const spinner = ora({ text: 'Creating project on marketplace...', color: 'cyan' }).start();
    const project = await createProject({ name: projectName, tag: projectTag });
    projectId = project.id;
    spinner.succeed(neon.green(`Project created: ${projectId}`));
  } catch (err) {
    console.log(`  ${tag.error} ${neon.red('Failed to create project:')} ${err.message}`);
  }
}

// Record Phase 1 tasks
for (const taskDef of phase1.tasks) {
  if (online && projectId) {
    try {
      await recordTask({
        projectId,
        phase: phase1.phase,
        phaseLabel: phase1.label,
        taskName: taskDef.name,
        taskDescription: taskDef.description,
        reward: getTaskReward(taskDef.rewardRange),
      });
    } catch {}
  }
  console.log(`  ${tag.task} ${neon.green('✓')} ${neon.dim(taskDef.name)}`);
}

if (online && projectId) {
  try { await advancePhase(projectId, 2); } catch {}
}
console.log(`  ${tag.phase} ${neon.dim('Phase 1 complete')}`);
console.log();

// ── Phase 2: Requirements ──────────────────────────────

const phase2 = PHASES[1];
console.log(`  ${tag.phase} ${neon.magenta(`═══ Phase 2: ${phase2.label} ═══`)}`);

for (const taskDef of phase2.tasks) {
  if (online && projectId) {
    try {
      await recordTask({
        projectId,
        phase: phase2.phase,
        phaseLabel: phase2.label,
        taskName: taskDef.name,
        taskDescription: taskDef.description,
        reward: getTaskReward(taskDef.rewardRange),
      });
    } catch {}
  }
  console.log(`  ${tag.task} ${neon.green('✓')} ${neon.dim(taskDef.name)}`);
}

if (online && projectId) {
  try { await advancePhase(projectId, 3); } catch {}
}
console.log(`  ${tag.phase} ${neon.dim('Phase 2 complete')}`);
console.log();

// ── Create build directory ─────────────────────────────

const buildId = projectId || `local-${Date.now()}`;
const projectDir = join(homedir(), '.alba', 'builds', buildId);
mkdirSync(projectDir, { recursive: true });

// ── Output for Claude Code ─────────────────────────────

console.log(`  ${tag.system} ${neon.green('Setup complete. Project ready for development.')}`);
console.log();

// Structured output — Claude Code will parse this
console.log('ALBA_SETUP_RESULT_START');
console.log(`ALBA_PROJECT_ID=${buildId}`);
console.log(`ALBA_PROJECT_NAME=${projectName}`);
console.log(`ALBA_PROJECT_TAG=${projectTag}`);
console.log(`ALBA_PROJECT_DIR=${projectDir}`);
console.log(`ALBA_ONLINE=${online}`);
console.log(`ALBA_BACKEND_ID=${projectId || ''}`);
console.log('ALBA_SETUP_RESULT_END');
