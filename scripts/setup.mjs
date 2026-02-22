import http from 'http';
import ora from 'ora';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { execSync } from 'child_process';
import { neon, tag } from '../lib/colors.mjs';
import { checkHealth, createProject, listProjects, joinProject, getArtifacts, downloadProjectZip } from '../lib/api.mjs';
import { printLogo } from '../lib/ascii.mjs';
import { TIMING } from '../lib/config.mjs';
import { randomProjectName, randomTag } from '../lib/project-names.mjs';
import { isAuthenticated, loadCredentials, saveCredentials } from '../lib/auth.mjs';

const FRONTEND_URL = 'https://alba-run.vercel.app';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PHASE_NAMES = ['', 'Ideation', 'Design', 'Implementation', 'Review', 'Bug Fix', 'Demo'];

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

// ── Try Auto-Join ────────────────────────────────────────

async function tryAutoJoin() {
  const spinner = ora({ text: 'Looking for building projects to join...', color: 'cyan' }).start();

  let projects;
  try {
    const all = await listProjects();
    projects = all.filter((p) => p.status === 'building');
  } catch (err) {
    spinner.fail(neon.yellow(`Failed to list projects: ${err.message}`));
    return null;
  }

  if (projects.length === 0) {
    spinner.info(neon.dim('No building projects available — creating new project'));
    return null;
  }

  spinner.succeed(neon.green(`Found ${projects.length} building project(s)`));

  // Try joining each project
  for (const project of projects) {
    const phaseName = PHASE_NAMES[project.currentPhase] || 'Unknown';
    const joinSpinner = ora({
      text: `Joining "${project.name}" (Phase ${project.currentPhase}: ${phaseName})...`,
      color: 'cyan',
    }).start();

    try {
      const joinResult = await joinProject(project.id);
      joinSpinner.succeed(neon.green(`Joined "${project.name}" — Phase ${joinResult.currentPhase}: ${joinResult.phaseName}`));

      // Create local build directory
      const projectDir = join(homedir(), '.alba', 'builds', project.id);
      mkdirSync(projectDir, { recursive: true });

      const currentPhase = joinResult.currentPhase;

      // Download artifacts
      const dlSpinner = ora({ text: 'Downloading project artifacts...', color: 'cyan' }).start();
      try {
        const artifacts = await getArtifacts(project.id);
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
            const zipBuffer = await downloadProjectZip(project.id);
            if (zipBuffer) {
              const zipPath = join(projectDir, '..', `${project.id}-download.zip`);
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

      return {
        projectId: project.id,
        projectName: project.name,
        projectTag: project.tag || '',
        projectDir,
        currentPhase,
        phaseName: joinResult.phaseName,
      };
    } catch (err) {
      if (err.message && err.message.includes('409')) {
        joinSpinner.warn(neon.dim(`Already contributed to "${project.name}" — skipping`));
      } else {
        joinSpinner.warn(neon.yellow(`Failed to join "${project.name}": ${err.message}`));
      }
    }
  }

  console.log(`  ${neon.dim('All building projects skipped — creating new project')}`);
  return null;
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

// ── Try auto-join first, then fall back to new project ───

let projectName, projectTag, projectId, projectDir, currentPhase, phaseName;

if (online) {
  const joined = await tryAutoJoin();
  if (joined) {
    projectId = joined.projectId;
    projectName = joined.projectName;
    projectTag = joined.projectTag;
    projectDir = joined.projectDir;
    currentPhase = joined.currentPhase;
    phaseName = joined.phaseName;
  }
}

// Fall back to creating a new project
if (!projectId) {
  projectName = randomProjectName();
  projectTag = randomTag();
  currentPhase = 1;
  phaseName = 'Ideation';

  console.log(neon.green(`  ═══ New Project: ${projectName} ═══`));
  console.log(`  ${neon.dim('Tag:')} ${neon.cyan(projectTag)}`);
  console.log();

  if (online) {
    try {
      const spinner = ora({ text: 'Creating project on marketplace...', color: 'cyan' }).start();
      const project = await createProject({ name: projectName, tag: projectTag });
      projectId = project.id;
      spinner.succeed(neon.green('Project registered on marketplace'));
    } catch (err) {
      console.log(`  ${tag.error} ${neon.red('Failed to create project:')} ${err.message}`);
    }
  }
  console.log();

  const buildId = projectId || `local-${Date.now()}`;
  projectDir = join(homedir(), '.alba', 'builds', buildId);
  mkdirSync(projectDir, { recursive: true });
}

// ── Output for Claude Code ─────────────────────────────

console.log(`  ${tag.system} ${neon.green('Setup complete. Starting build pipeline...')}`);
console.log();

// Structured output for SKILL.md to parse — sent via stderr so it's
// captured by Claude Code but not shown prominently to the user.
const vars = [
  'ALBA_SETUP_RESULT_START',
  `ALBA_PROJECT_ID=${projectId || projectDir.split('/').pop()}`,
  `ALBA_PROJECT_NAME=${projectName}`,
  `ALBA_PROJECT_TAG=${projectTag}`,
  `ALBA_PROJECT_DIR=${projectDir}`,
  `ALBA_ONLINE=${online}`,
  `ALBA_BACKEND_ID=${projectId || ''}`,
  `ALBA_CURRENT_PHASE=${currentPhase}`,
  `ALBA_PHASE_NAME=${phaseName}`,
  'ALBA_SETUP_RESULT_END',
];
process.stderr.write(vars.join('\n') + '\n');
