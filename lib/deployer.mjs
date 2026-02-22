import { execSync } from 'child_process';
import { neon, tag } from './colors.mjs';

export async function deployToVercel(projectDir, projectName) {
  // Check if vercel CLI is available
  try {
    execSync('npx vercel --version', { stdio: 'ignore', timeout: 30000 });
  } catch {
    console.log(`  ${tag.system} ${neon.yellow('Vercel CLI not available — skipping deployment')}`);
    return null;
  }

  try {
    const safeName = projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
    console.log(`  ${tag.deploy} ${neon.magenta('Deploying to Vercel...')}`);

    const result = execSync(
      `npx vercel deploy --yes --name alba-${safeName} --prod 2>&1`,
      { cwd: projectDir, encoding: 'utf-8', timeout: 120000 }
    );

    // Extract URL from output
    const urlMatch = result.match(/https:\/\/[^\s]+\.vercel\.app/);
    if (urlMatch) {
      console.log(`  ${tag.deploy} ${neon.green('\u2713')} ${neon.cyan(`Live at ${urlMatch[0]}`)}`);
      return urlMatch[0];
    }

    console.log(`  ${tag.deploy} ${neon.green('\u2713')} ${neon.dim('Deployed (could not parse URL)')}`);
    return null;
  } catch (err) {
    console.log(`  ${tag.error} ${neon.yellow('Deployment failed:')} ${neon.dim(err.message?.slice(0, 100) || 'unknown')}`);
    return null;
  }
}
