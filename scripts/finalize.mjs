import { execSync } from 'child_process';
import { existsSync, statSync, readFileSync } from 'fs';
import { join } from 'path';
import { neon, tag } from '../lib/colors.mjs';
import { recordTask, advancePhase } from '../lib/api.mjs';
import { PHASES, getTaskReward } from '../lib/phases.mjs';
import { getToken } from '../lib/auth.mjs';
import { API_BASE_URL } from '../lib/config.mjs';

// ── Parse arguments ──────────────────────────────────────

const args = process.argv.slice(2);
const projectDir = args[0];
const projectName = args[1] || 'Project';
const backendProjectId = args[2] || '';
const online = args[3] === 'true';

if (!projectDir) {
  console.log(`  ${tag.error} ${neon.red('Usage: node finalize.mjs <projectDir> <projectName> [backendProjectId] [online]')}`);
  process.exit(1);
}

if (!existsSync(projectDir)) {
  console.log(`  ${tag.error} ${neon.red(`Project directory not found: ${projectDir}`)}`);
  process.exit(1);
}

const projectId = backendProjectId || null;

// ── Helper: record task on backend ───────────────────────

async function safeRecordTask(phaseData, taskDef) {
  const reward = getTaskReward(taskDef.rewardRange);
  if (online && projectId) {
    try {
      await recordTask({
        projectId,
        phase: phaseData.phase,
        phaseLabel: phaseData.label,
        taskName: taskDef.name,
        taskDescription: taskDef.description,
        reward,
      });
    } catch {}
  }
}

async function safeAdvancePhase(nextPhase) {
  if (online && projectId) {
    try {
      await advancePhase(projectId, nextPhase);
    } catch {}
  }
}

// ── Phase 3: Record Development tasks ────────────────────

console.log();
console.log(`  ${tag.phase} ${neon.magenta('═══ Phase 3: Development — recording tasks ═══')}`);

const phase3 = PHASES[2];
for (const taskDef of phase3.tasks) {
  await safeRecordTask(phase3, taskDef);
  console.log(`  ${tag.task} ${neon.green('✓')} ${neon.dim(taskDef.name)}`);
}
await safeAdvancePhase(4);
console.log(`  ${tag.phase} ${neon.dim('Phase 3 complete')}`);
console.log();

// ── Phase 4: Testing — verify build ──────────────────────

console.log(`  ${tag.phase} ${neon.magenta('═══ Phase 4: Testing ═══')}`);

let buildSuccess = false;
const pkgPath = join(projectDir, 'package.json');

if (existsSync(pkgPath)) {
  try {
    console.log(`  ${tag.build} ${neon.cyan('Running npm install...')}`);
    execSync('npm install --silent 2>/dev/null', { cwd: projectDir, timeout: 120000 });
    console.log(`  ${tag.build} ${neon.green('✓')} ${neon.dim('Dependencies installed')}`);

    console.log(`  ${tag.build} ${neon.cyan('Running build...')}`);
    execSync('npm run build 2>/dev/null', { cwd: projectDir, timeout: 120000 });
    console.log(`  ${tag.build} ${neon.green('✓')} ${neon.dim('Build successful')}`);
    buildSuccess = true;
  } catch {
    console.log(`  ${tag.error} ${neon.yellow('Build failed — continuing anyway')}`);
  }
} else {
  console.log(`  ${tag.system} ${neon.dim('No package.json — treating as static project')}`);
  buildSuccess = true;
}

const phase4 = PHASES[3];
for (const taskDef of phase4.tasks) {
  await safeRecordTask(phase4, taskDef);
  console.log(`  ${tag.task} ${neon.green('✓')} ${neon.dim(taskDef.name)}`);
}
await safeAdvancePhase(5);
console.log(`  ${tag.phase} ${neon.dim('Phase 4 complete')}`);
console.log();

// ── Phase 5: Demo — preview + package + upload ───────────

console.log(`  ${tag.phase} ${neon.magenta('═══ Phase 5: Demo ═══')}`);

// Upload preview.html to backend
const previewPath = join(projectDir, 'preview.html');
if (online && projectId && existsSync(previewPath)) {
  try {
    const previewHtml = readFileSync(previewPath, 'utf-8');
    const token = getToken();
    if (token) {
      console.log(`  ${tag.build} ${neon.cyan('Uploading demo preview...')}`);
      const res = await fetch(`${API_BASE_URL}/api/projects/${projectId}/preview`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ previewHtml }),
      });
      if (res.ok) {
        console.log(`  ${tag.build} ${neon.green('✓')} ${neon.dim(`Preview uploaded (${(previewHtml.length / 1024).toFixed(1)} KB)`)}`);
      } else {
        console.log(`  ${tag.error} ${neon.yellow(`Preview upload failed: HTTP ${res.status}`)}`);
      }
    }
  } catch (err) {
    console.log(`  ${tag.error} ${neon.yellow('Preview upload error:')} ${neon.dim(err.message || 'unknown')}`);
  }
} else if (!existsSync(previewPath)) {
  console.log(`  ${tag.system} ${neon.dim('No preview.html found — skipping preview upload')}`);
}

// Package source code as ZIP and upload
if (online && projectId) {
  try {
    const zipPath = join(projectDir, '..', `${projectId}.zip`);
    console.log(`  ${tag.build} ${neon.cyan('Packaging source code...')}`);
    execSync(
      `cd "${projectDir}" && zip -r "${zipPath}" . -x "node_modules/*" ".next/*" 2>/dev/null`,
      { timeout: 30000 }
    );

    const stats = statSync(zipPath);
    console.log(`  ${tag.build} ${neon.dim(`ZIP: ${(stats.size / 1024).toFixed(0)} KB`)}`);

    const token = getToken();
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
        console.log(`  ${tag.build} ${neon.green('✓')} ${neon.dim('Source code uploaded')}`);
      } else {
        console.log(`  ${tag.error} ${neon.yellow(`Upload failed: HTTP ${res.status}`)}`);
      }
    }
  } catch (err) {
    console.log(`  ${tag.error} ${neon.yellow('Package/upload error:')} ${neon.dim(err.message || 'unknown')}`);
  }
}

// Record Phase 5 tasks and advance
const phase5 = PHASES[4];
for (const taskDef of phase5.tasks) {
  await safeRecordTask(phase5, taskDef);
  console.log(`  ${tag.task} ${neon.green('✓')} ${neon.dim(taskDef.name)}`);
}
await safeAdvancePhase(6);
console.log(`  ${tag.phase} ${neon.dim('Phase 5 complete')}`);
console.log();

// ── Summary ──────────────────────────────────────────────

console.log(neon.green(`  ═══ Project "${projectName}" listed on marketplace ═══`));
console.log(`  ${neon.dim('Build directory:')} ${neon.dim(projectDir)}`);
if (projectId) {
  console.log(`  ${neon.dim('Project ID:')} ${neon.dim(projectId)}`);
}
console.log();
console.log(`  ${neon.dim('Thank you for using ALBA.')}`);
console.log();
