import ora from 'ora';
import { neon, tag } from '../lib/colors.mjs';
import { checkHealth, listProjects } from '../lib/api.mjs';
import { printLogo } from '../lib/ascii.mjs';
import { TIMING, AGENT_MESSAGES } from '../lib/config.mjs';
import { isAuthenticated, loadCredentials } from '../lib/auth.mjs';

// ── Helpers ──────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function timestamp() {
  return new Date().toLocaleTimeString('en-US', { hour12: false });
}

function colorMessage(msg) {
  if (msg.startsWith('[AGENT]')) return `${tag.agent} ${neon.cyan(msg.slice(8))}`;
  if (msg.startsWith('[BUILD]')) return `${tag.build} ${neon.yellow(msg.slice(8))}`;
  if (msg.startsWith('[DEPLOY]')) return `${tag.deploy} ${neon.magenta(msg.slice(9))}`;
  return `${tag.system} ${neon.dim(msg)}`;
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

// ── Agent Simulation Loop ────────────────────────────────

let running = true;
let totalEarned = 0;

process.on('SIGINT', () => {
  running = false;
});

async function agentLoop(online) {
  console.log(neon.green('  ═══ Agent simulation started ═══'));
  console.log(neon.dim('  Press Ctrl+C to stop'));
  console.log();

  let tick = 0;

  while (running) {
    tick++;
    const time = timestamp();

    // Agent log message
    const msg = pick(AGENT_MESSAGES);
    console.log(`  ${neon.dim(time)} ${colorMessage(msg)}`);

    // Network sync (~every 15s at ~2s avg interval → every ~8 ticks)
    if (online && tick % 8 === 0) {
      try {
        const projects = await listProjects();
        const count = Array.isArray(projects) ? projects.length : 0;
        console.log(
          `  ${neon.dim(time)} ${tag.system} ${neon.dim(`Network sync — ${count} project(s) indexed`)}`
        );
      } catch {
        console.log(
          `  ${neon.dim(time)} ${tag.system} ${neon.dim('Network sync — retrying...')}`
        );
      }
    }

    // Earnings reward (~every 20s → every ~10 ticks)
    if (tick % 10 === 0) {
      const reward = (rand(50, 250) / 100).toFixed(2);
      totalEarned += parseFloat(reward);
      console.log(
        `  ${neon.dim(time)} ${tag.reward} ${neon.green(`+$${reward} earned`)} ${neon.dim(`(total: $${totalEarned.toFixed(2)})`)}`
      );
    }

    await sleep(rand(TIMING.AGENT_LOG_MIN, TIMING.AGENT_LOG_MAX));
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
await agentLoop(online);
