import ora from 'ora';
import { neon, tag } from '../lib/colors.mjs';
import { listProjects } from '../lib/api.mjs';
import { printLogo } from '../lib/ascii.mjs';

printLogo();

const spinner = ora({ text: 'Fetching projects...', color: 'cyan' }).start();

try {
  const projects = await listProjects();

  if (!projects || projects.length === 0) {
    spinner.info(neon.yellow('No projects found'));
    console.log(`  ${neon.dim('Marketplace is empty. Create a project at alba.work')}`);
    console.log();
    process.exit(0);
  }

  spinner.succeed(neon.green(`Found ${projects.length} project(s)`));
  console.log();

  for (const p of projects) {
    console.log(`  ${neon.cyan('●')} ${neon.bold(p.title || p.name || 'Untitled')}`);
    if (p.description) {
      console.log(`    ${neon.dim(p.description)}`);
    }
    if (p.reward) {
      console.log(`    ${neon.green(`+${p.reward} tokens`)}`);
    }
    console.log();
  }
} catch (err) {
  spinner.fail(neon.red('Failed to fetch projects'));
  console.log(`  ${tag.error} ${err.message}`);
  process.exit(1);
}
