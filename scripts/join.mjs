import http from 'http';
import ora from 'ora';
import { join } from 'path';
import { homedir } from 'os';
import { mkdirSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { neon, tag } from '../lib/colors.mjs';
import { checkHealth, listProjects, joinProject, downloadProjectZip, getArtifacts } from '../lib/api.mjs';
import { printLogo } from '../lib/ascii.mjs';
import { TIMING } from '../lib/config.mjs';
import { isAuthenticated, loadCredentials, saveCredentials } from '../lib/auth.mjs';

const FRONTEND_URL = 'https://alba-run.vercel.app';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PHASE_NAMES = ['', 'Ideation', 'Design', 'Development', 'Review', 'Bug Fix', 'Demo'];

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

            saveCredentials(data.idToken, data.user || {}, data.refreshToken || '');

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
    'Initializing ALBA join mode...',
    'Loading agent configuration...',
    'Connecting to marketplace...',
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
    console.log(`  ${neon.red('Join mode requires a backend connection.')}`);
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
if (!online) {
  process.exit(1);
}

// ── Fetch building projects ─────────────────────────────

const spinner = ora({ text: 'Fetching building projects...', color: 'cyan' }).start();
let projects;
try {
  const all = await listProjects();
  projects = all.filter((p) => p.status === 'building');
  spinner.succeed(neon.green(`Found ${projects.length} building project(s)`));
} catch (err) {
  spinner.fail(neon.red('Failed to fetch projects'));
  console.log(`  ${tag.error} ${err.message}`);
  process.exit(1);
}
console.log();

if (projects.length === 0) {
  console.log(`  ${neon.dim('No projects currently in building state.')}`);
  console.log(`  ${neon.dim('Run /alba:run to start a new project.')}`);
  console.log();
  process.exit(0);
}

// Display available projects
console.log(neon.green('  ═══ Available Projects ═══'));
console.log();
projects.forEach((p, i) => {
  const phaseName = PHASE_NAMES[p.currentPhase] || 'Unknown';
  console.log(`  ${neon.cyan(`[${i + 1}]`)} ${neon.bold(p.name)}`);
  console.log(`      ${neon.dim('Tag:')} ${p.tag}  ${neon.dim('Phase:')} ${p.currentPhase} (${phaseName})  ${neon.dim('Tasks:')} ${p.completedTasks}/${p.totalTasks}`);
  console.log(`      ${neon.dim('ID:')} ${p.id}`);
  console.log();
});

// Auto-select first project (the SKILL.md agent can override via arg)
const targetArg = process.argv[2];
let selectedProject;

if (targetArg) {
  // If a project ID was passed as argument
  selectedProject = projects.find((p) => p.id === targetArg);
  if (!selectedProject) {
    console.log(`  ${tag.error} ${neon.red(`Project not found: ${targetArg}`)}`);
    process.exit(1);
  }
} else {
  // Default to first project
  selectedProject = projects[0];
}

console.log(`  ${tag.system} Joining project: ${neon.green(selectedProject.name)}`);
console.log();

// ── Join the project ─────────────────────────────────────

const joinSpinner = ora({ text: `Joining ${selectedProject.name}...`, color: 'cyan' }).start();
let joinResult;
try {
  joinResult = await joinProject(selectedProject.id);
  joinSpinner.succeed(neon.green(`Joined! Current phase: ${joinResult.currentPhase} (${joinResult.phaseName})`));
} catch (err) {
  joinSpinner.fail(neon.red('Failed to join project'));
  console.log(`  ${tag.error} ${err.message}`);
  process.exit(1);
}
console.log();

// ── Create local build directory ─────────────────────────

const projectDir = join(homedir(), '.alba', 'builds', selectedProject.id);
mkdirSync(projectDir, { recursive: true });

// ── Download artifacts and/or source code ────────────────

const currentPhase = joinResult.currentPhase;

// Phase 2-3: only need spec/design artifacts (no source code)
// Phase 4+: need full source code ZIP
const dlSpinner = ora({ text: 'Downloading project artifacts...', color: 'cyan' }).start();
try {
  // Always download text artifacts (SPEC.md, DESIGN.md, BUG_REPORT.md)
  const artifacts = await getArtifacts(selectedProject.id);
  let artifactCount = 0;
  for (const [filename, content] of Object.entries(artifacts)) {
    writeFileSync(join(projectDir, filename), content, 'utf-8');
    artifactCount++;
  }
  if (artifactCount > 0) {
    dlSpinner.succeed(neon.green(`Downloaded ${artifactCount} artifact(s): ${Object.keys(artifacts).join(', ')}`));
  } else {
    dlSpinner.info(neon.dim('No artifacts uploaded yet'));
  }

  // Phase 4+: also download full source code
  if (currentPhase >= 4) {
    const srcSpinner = ora({ text: 'Downloading source code...', color: 'cyan' }).start();
    try {
      const zipBuffer = await downloadProjectZip(selectedProject.id);
      if (zipBuffer) {
        const zipPath = join(projectDir, '..', `${selectedProject.id}-download.zip`);
        writeFileSync(zipPath, zipBuffer);
        execSync(`unzip -o "${zipPath}" -d "${projectDir}" 2>/dev/null`, { timeout: 30000 });
        srcSpinner.succeed(neon.green(`Source code extracted (${(zipBuffer.length / 1024).toFixed(0)} KB)`));
      } else {
        srcSpinner.info(neon.dim('No source code uploaded yet'));
      }
    } catch (err) {
      srcSpinner.warn(neon.yellow(`Source download failed: ${err.message || 'unknown'}`));
    }
  }
} catch (err) {
  dlSpinner.warn(neon.yellow(`Artifact download failed: ${err.message || 'unknown'}`));
}
console.log();

console.log(`  ${tag.system} ${neon.green('Join complete. Starting phase work...')}`);
console.log();

// ── Output for SKILL.md to parse ─────────────────────────

const vars = [
  'ALBA_JOIN_RESULT_START',
  `ALBA_PROJECT_ID=${selectedProject.id}`,
  `ALBA_PROJECT_NAME=${selectedProject.name}`,
  `ALBA_PROJECT_TAG=${selectedProject.tag || ''}`,
  `ALBA_PROJECT_DIR=${projectDir}`,
  `ALBA_CURRENT_PHASE=${joinResult.currentPhase}`,
  `ALBA_PHASE_NAME=${joinResult.phaseName}`,
  `ALBA_ONLINE=true`,
  `ALBA_BACKEND_ID=${selectedProject.id}`,
  'ALBA_JOIN_RESULT_END',
];
process.stderr.write(vars.join('\n') + '\n');
