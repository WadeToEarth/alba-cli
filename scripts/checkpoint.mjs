import { existsSync, readFileSync, statSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';
import { neon, tag } from '../lib/colors.mjs';
import { recordTask, advancePhase, saveArtifact } from '../lib/api.mjs';
import { getValidToken } from '../lib/auth.mjs';
import { API_BASE_URL } from '../lib/config.mjs';
import { PHASES, getTaskReward } from '../lib/phases.mjs';

// ── Parse arguments ──────────────────────────────────────
const args = process.argv.slice(2);
const quiet = args.includes('--quiet');
const positional = args.filter(a => !a.startsWith('--'));
const phaseNumber = parseInt(positional[0], 10);
const projectDir = positional[1];
const projectId = positional[2] || '';
const online = positional[3] === 'true';

if (!phaseNumber || !projectDir) {
  console.log(`  ${tag.error} ${neon.red('Usage: node checkpoint.mjs <phase> <projectDir> [projectId] [online] [--quiet]')}`);
  process.exit(1);
}

// ── Phase-specific validation ────────────────────────────

function validatePhase1() {
  const specPath = join(projectDir, 'SPEC.md');
  if (!existsSync(specPath)) {
    return 'SPEC.md not found in project directory';
  }
  const content = readFileSync(specPath, 'utf-8');
  const requiredSections = ['Concept', 'Feature', 'Architect', 'Contribut'];
  const labels = ['Concept', 'Feature(s)', 'Architecture', 'Contribution'];
  const missing = requiredSections
    .map((s, i) => (!content.match(new RegExp(`^#{1,3}\\s.*${s}`, 'mi')) ? labels[i] : null))
    .filter(Boolean);
  if (missing.length > 0) {
    return `SPEC.md missing sections: ${missing.join(', ')}`;
  }
  return null;
}

function validatePhase2() {
  const designPath = join(projectDir, 'DESIGN.md');
  if (!existsSync(designPath)) {
    return 'DESIGN.md not found in project directory';
  }
  const content = readFileSync(designPath, 'utf-8');
  const requiredSections = ['Component', 'Layout', 'State', 'Edge'];
  const labels = ['Component spec', 'UI/UX Layout', 'State management', 'Edge cases'];
  const missing = requiredSections
    .map((s, i) => (!content.match(new RegExp(`^#{1,3}\\s.*${s}`, 'mi')) ? labels[i] : null))
    .filter(Boolean);
  if (missing.length > 0) {
    return `DESIGN.md missing sections: ${missing.join(', ')}`;
  }
  return null;
}

function validatePhase3() {
  const pkgPath = join(projectDir, 'package.json');
  if (!existsSync(pkgPath)) {
    return 'package.json not found — project not scaffolded';
  }
  try {
    execSync('npm run build', { cwd: projectDir, timeout: 120000, stdio: 'pipe' });
  } catch (err) {
    return `npm run build failed: ${err.stderr?.toString().slice(0, 200) || 'unknown error'}`;
  }
  return null;
}

function validatePhase4() {
  const bugPath = join(projectDir, 'BUG_REPORT.md');
  if (!existsSync(bugPath)) {
    return 'BUG_REPORT.md not found in project directory';
  }
  const content = readFileSync(bugPath, 'utf-8');
  const requiredSections = ['Security', 'Integrat', 'Accessib', 'Priorit'];
  const labels = ['Security', 'Integration', 'Accessibility', 'Priority'];
  const missing = requiredSections
    .map((s, i) => (!content.match(new RegExp(`^#{1,3}\\s.*${s}`, 'mi')) ? labels[i] : null))
    .filter(Boolean);
  if (missing.length > 0) {
    return `BUG_REPORT.md missing sections: ${missing.join(', ')}`;
  }
  return null;
}

function validatePhase5() {
  const pkgPath = join(projectDir, 'package.json');
  if (!existsSync(pkgPath)) {
    return 'package.json not found';
  }
  try {
    execSync('npm run build', { cwd: projectDir, timeout: 120000, stdio: 'pipe' });
  } catch (err) {
    return `npm run build failed after bug fixes: ${err.stderr?.toString().slice(0, 200) || 'unknown error'}`;
  }
  return null;
}

function validatePhase6() {
  const previewPath = join(projectDir, 'preview.html');
  if (!existsSync(previewPath)) {
    return 'preview.html not found in project directory';
  }
  const stats = statSync(previewPath);
  if (stats.size > 50 * 1024) {
    return `preview.html is ${(stats.size / 1024).toFixed(1)} KB — must be under 50KB`;
  }
  return null;
}

const validators = {
  1: validatePhase1,
  2: validatePhase2,
  3: validatePhase3,
  4: validatePhase4,
  5: validatePhase5,
  6: validatePhase6,
};

// ── Run validation ──────────────────────────────────────

const phaseData = PHASES[phaseNumber - 1];
if (!phaseData) {
  console.log(`  ${tag.error} ${neon.red(`Invalid phase number: ${phaseNumber}`)}`);
  process.exit(1);
}

if (!quiet) {
  console.log();
  console.log(`  ${tag.phase} ${neon.magenta(`═══ Checkpoint: Phase ${phaseNumber} — ${phaseData.label} ═══`)}`);
}

const validator = validators[phaseNumber];
const error = validator ? validator() : null;

if (error) {
  // Always show validation errors — agent needs to read and fix them
  console.log(`  ${tag.error} ${neon.red('Validation FAILED:')}`);
  console.log(`  ${neon.red(error)}`);
  if (!quiet) {
    console.log();
    console.log(`  ${neon.yellow('Fix the issues above and re-run this checkpoint.')}`);
  }
  process.exit(1);
}

if (!quiet) console.log(`  ${tag.phase} ${neon.green('✓ Artifacts validated')}`);

// ── Upload phase artifacts to backend ───────────────────

const PHASE_ARTIFACTS = {
  1: ['SPEC.md'],
  2: ['DESIGN.md'],
  4: ['BUG_REPORT.md'],
};

if (online && projectId && PHASE_ARTIFACTS[phaseNumber]) {
  for (const filename of PHASE_ARTIFACTS[phaseNumber]) {
    const filePath = join(projectDir, filename);
    if (existsSync(filePath)) {
      try {
        const content = readFileSync(filePath, 'utf-8');
        await saveArtifact(projectId, filename, content);
        if (!quiet) console.log(`  ${tag.task} ${neon.green('✓')} ${neon.dim(`Uploaded ${filename} (${(content.length / 1024).toFixed(1)} KB)`)}`);
      } catch (err) {
        if (!quiet) console.log(`  ${tag.error} ${neon.yellow(`Failed to upload ${filename}:`)} ${neon.dim(err.message || 'unknown')}`);
      }
    }
  }
}

// ── Record tasks for this phase ─────────────────────────

for (const taskDef of phaseData.tasks) {
  if (online && projectId) {
    try {
      await recordTask({
        projectId,
        phase: phaseData.phase,
        phaseLabel: phaseData.label,
        taskName: taskDef.name,
        taskDescription: taskDef.description,
        reward: getTaskReward(taskDef.rewardRange),
      });
    } catch {}
  }
  if (!quiet) console.log(`  ${tag.task} ${neon.green('✓')} ${neon.dim(taskDef.name)}`);
}

// ── Phase 6: upload preview before advancing to "listed" ─

if (phaseNumber === 6 && online && projectId) {
  const previewPath = join(projectDir, 'preview.html');
  if (existsSync(previewPath)) {
    try {
      const previewContent = readFileSync(previewPath, 'utf-8');
      const token = await getValidToken();
      if (token) {
        const res = await fetch(`${API_BASE_URL}/api/projects/${projectId}/preview`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ previewHtml: previewContent }),
        });
        if (!quiet && res.ok) {
          console.log(`  ${tag.build} ${neon.green('✓')} ${neon.dim('Preview uploaded')}`);
        }
      }
    } catch (err) {
      if (!quiet) console.log(`  ${tag.error} ${neon.yellow('Preview upload failed:')} ${neon.dim(err.message || 'unknown')}`);
    }
  }
}

// ── Advance phase ───────────────────────────────────────

if (online && projectId) {
  try {
    await advancePhase(projectId, phaseNumber + 1);
    if (!quiet) {
      if (phaseNumber === 6) {
        console.log(`  ${tag.phase} ${neon.green('Project listed on marketplace')}`);
      } else {
        console.log(`  ${tag.phase} ${neon.green(`Advanced to phase ${phaseNumber + 1}`)}`);
      }
    }
  } catch (err) {
    if (!quiet) console.log(`  ${tag.error} ${neon.yellow(`Phase advance failed: ${err.message}`)}`);
  }
}

if (!quiet) {
  console.log(`  ${tag.phase} ${neon.dim(`Phase ${phaseNumber} complete`)}`);
  console.log();
}

// Structured output for SKILL.md to parse
process.stderr.write(`ALBA_CHECKPOINT_PHASE=${phaseNumber}\n`);
process.stderr.write(`ALBA_CHECKPOINT_STATUS=PASSED\n`);
