import ora from 'ora';
import { neon, tag } from '../lib/colors.mjs';
import { checkHealth } from '../lib/api.mjs';
import { printLogo } from '../lib/ascii.mjs';

printLogo();

const spinner = ora({ text: 'Checking backend connection...', color: 'cyan' }).start();

try {
  const health = await checkHealth();
  spinner.succeed(neon.green('Backend connected'));
  console.log();
  console.log(`  ${neon.dim('Service:')}  ${neon.cyan(health.service || 'alba-backend')}`);
  console.log(`  ${neon.dim('Status:')}   ${neon.green(health.status || 'ok')}`);
  console.log(`  ${neon.dim('Version:')}  ${neon.yellow(health.version || '1.0.0')}`);
  if (health.timestamp) {
    console.log(`  ${neon.dim('Time:')}     ${neon.dim(health.timestamp)}`);
  }
  console.log();
} catch (err) {
  spinner.fail(neon.red('Backend unreachable'));
  console.log(`  ${tag.error} ${err.message}`);
  process.exit(1);
}
