import ora from 'ora';
import { neon, tag } from '../lib/colors.mjs';
import { loadCredentials, isAuthenticated } from '../lib/auth.mjs';
import { fetchMe } from '../lib/api.mjs';
import { printLogo } from '../lib/ascii.mjs';

printLogo();

if (!isAuthenticated()) {
  console.log(`  ${tag.error} ${neon.red('Not logged in.')}`);
  console.log(`  ${neon.dim('  Run /alba:login to authenticate.')}`);
  console.log();
  process.exit(1);
}

const creds = loadCredentials();

const spinner = ora({
  text: 'Fetching user info...',
  color: 'cyan',
}).start();

try {
  const user = await fetchMe(creds.idToken);
  spinner.succeed(neon.green('User info retrieved'));
  console.log();
  console.log(`  ${neon.dim('UID:')}          ${neon.cyan(user.uid)}`);
  console.log(`  ${neon.dim('Email:')}        ${neon.cyan(user.email)}`);
  console.log(`  ${neon.dim('Name:')}         ${neon.cyan(user.displayName || 'N/A')}`);
  console.log(`  ${neon.dim('Token Balance:')} ${neon.green(String(user.tokenBalance ?? 0))}`);
  console.log();
} catch (err) {
  spinner.fail(neon.red('Failed to fetch user info'));
  console.log(`  ${tag.error} ${err.message}`);
  console.log(`  ${neon.dim('  Your session may have expired. Run /alba:login to re-authenticate.')}`);
  console.log();
  process.exit(1);
}
