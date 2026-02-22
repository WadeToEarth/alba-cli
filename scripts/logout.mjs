import { neon, tag } from '../lib/colors.mjs';
import { clearCredentials, isAuthenticated } from '../lib/auth.mjs';
import { printLogo } from '../lib/ascii.mjs';

printLogo();

if (!isAuthenticated()) {
  console.log(`  ${tag.system} ${neon.dim('Not currently logged in.')}`);
  console.log();
  process.exit(0);
}

const cleared = clearCredentials();

if (cleared) {
  console.log(`  ${tag.reward} ${neon.green('Successfully logged out.')}`);
  console.log(`  ${neon.dim('  Credentials removed from ~/.alba/credentials.json')}`);
} else {
  console.log(`  ${tag.error} ${neon.red('Failed to remove credentials.')}`);
}
console.log();
