import { execFileSync } from 'child_process';
import { existsSync, statSync, readFileSync, rmSync, unlinkSync } from 'fs';
import { join, relative } from 'path';
import { homedir } from 'os';
import { neon, tag } from '../lib/colors.mjs';
import { getValidToken } from '../lib/auth.mjs';
import { API_BASE_URL } from '../lib/config.mjs';
import { safePath } from '../lib/safe-path.mjs';

const BUILDS_ROOT = join(homedir(), '.alba', 'builds');

// ── Parse arguments ──────────────────────────────────────

const args = process.argv.slice(2);
const quiet = args.includes('--quiet');
const positional = args.filter(a => !a.startsWith('--'));
const projectDir = positional[0];
const projectName = positional[1] || 'Project';
const backendProjectId = positional[2] || '';
const online = positional[3] === 'true';

if (!projectDir) {
  console.log(`  ${tag.error} ${neon.red('Usage: node finalize.mjs <projectDir> <projectName> [backendProjectId] [online] [--quiet]')}`);
  process.exit(1);
}

if (!existsSync(projectDir)) {
  console.log(`  ${tag.error} ${neon.red(`Project directory not found: ${projectDir}`)}`);
  process.exit(1);
}

const projectId = backendProjectId || null;

// ── Upload preview.html ─────────────────────────────────

if (!quiet) {
  console.log();
  console.log(`  ${tag.phase} ${neon.magenta('═══ Finalize: Upload & Package ═══')}`);
}

const previewPath = join(projectDir, 'preview.html');
if (online && projectId && existsSync(previewPath)) {
  try {
    const previewHtml = readFileSync(previewPath, 'utf-8');
    const token = await getValidToken();
    if (token) {
      if (!quiet) console.log(`  ${tag.build} ${neon.cyan('Uploading demo preview...')}`);
      const res = await fetch(`${API_BASE_URL}/api/projects/${projectId}/preview`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ previewHtml }),
      });
      if (res.ok) {
        if (!quiet) console.log(`  ${tag.build} ${neon.green('✓')} ${neon.dim(`Preview uploaded (${(previewHtml.length / 1024).toFixed(1)} KB)`)}`);
      } else {
        if (!quiet) console.log(`  ${tag.error} ${neon.yellow(`Preview upload failed: HTTP ${res.status}`)}`);
      }
    }
  } catch (err) {
    if (!quiet) console.log(`  ${tag.error} ${neon.yellow('Preview upload error:')} ${neon.dim(err.message || 'unknown')}`);
  }
} else if (!quiet && !existsSync(previewPath)) {
  console.log(`  ${tag.system} ${neon.dim('No preview.html found — skipping preview upload')}`);
}

// ── Package source code as ZIP and upload ────────────────

if (online && projectId) {
  try {
    const zipPath = join(projectDir, '..', `${projectId}.zip`);
    if (!quiet) console.log(`  ${tag.build} ${neon.cyan('Packaging source code...')}`);
    execFileSync('zip', ['-r', zipPath, '.', '-x', 'node_modules/*', '.next/*'], {
      cwd: projectDir, timeout: 30000
    });

    const stats = statSync(zipPath);
    if (!quiet) console.log(`  ${tag.build} ${neon.dim(`ZIP: ${(stats.size / 1024).toFixed(0)} KB`)}`);

    const token = await getValidToken();
    if (token) {
      const fileBuffer = readFileSync(zipPath);
      const formData = new FormData();
      formData.append('file', new Blob([fileBuffer], { type: 'application/zip' }), 'source.zip');

      const res = await fetch(`${API_BASE_URL}/api/projects/${projectId}/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });

      if (res.ok) {
        if (!quiet) console.log(`  ${tag.build} ${neon.green('✓')} ${neon.dim('Source code uploaded')}`);
      } else {
        if (!quiet) console.log(`  ${tag.error} ${neon.yellow(`Upload failed: HTTP ${res.status}`)}`);
      }
    }
  } catch (err) {
    if (!quiet) console.log(`  ${tag.error} ${neon.yellow('Package/upload error:')} ${neon.dim(err.message || 'unknown')}`);
  }
}

// ── Clean up local build files ─────────────────────────────
try {
  if (projectId) {
    const zipPath = join(projectDir, '..', `${projectId}.zip`);
    if (existsSync(zipPath)) unlinkSync(zipPath);
  }
  safePath(BUILDS_ROOT, relative(BUILDS_ROOT, projectDir));
  if (existsSync(projectDir)) rmSync(projectDir, { recursive: true, force: true });
  if (!quiet) console.log(`  ${tag.build} ${neon.dim('Cleaned up local build files')}`);
} catch (cleanupErr) {
  if (!quiet) console.log(`  ${tag.build} ${neon.dim('Warning: cleanup failed — ' + cleanupErr.message)}`);
}

// ── Summary ──────────────────────────────────────────────

if (!quiet) {
  console.log();
  console.log(neon.green(`  ═══ Project "${projectName}" listed on marketplace ═══`));
  console.log(`  ${neon.dim('Build directory:')} ${neon.dim(projectDir)}`);
  if (projectId) {
    console.log(`  ${neon.dim('Project ID:')} ${neon.dim(projectId)}`);
  }
  console.log();
  console.log(`  ${neon.dim('Thank you for using ALBA.')}`);
  console.log();
}
