import { existsSync, readFileSync, statSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';
import { neon, tag } from '../lib/colors.mjs';
import { recordTask, advancePhase } from '../lib/api.mjs';
import { PHASES, getTaskReward } from '../lib/phases.mjs';

// ── Parse arguments ──────────────────────────────────────
const args = process.argv.slice(2);
const phaseNumber = parseInt(args[0], 10);
const projectDir = args[1];
const projectId = args[2] || '';
const online = args[3] === 'true';

if (!phaseNumber || !projectDir) {
  console.log(`  ${tag.error} ${neon.red('Usage: node checkpoint.mjs <phase> <projectDir> [projectId] [online]')}`);
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

function validatePhase3() {
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

function validatePhase4() {
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

function validatePhase5() {
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
};

// ── Run validation ──────────────────────────────────────

const phaseData = PHASES[phaseNumber - 1];
if (!phaseData) {
  console.log(`  ${tag.error} ${neon.red(`Invalid phase number: ${phaseNumber}`)}`);
  process.exit(1);
}

console.log();
console.log(`  ${tag.phase} ${neon.magenta(`═══ Checkpoint: Phase ${phaseNumber} — ${phaseData.label} ═══`)}`);

const validator = validators[phaseNumber];
const error = validator ? validator() : null;

if (error) {
  console.log(`  ${tag.error} ${neon.red('Validation FAILED:')}`);
  console.log(`  ${neon.red(error)}`);
  console.log();
  console.log(`  ${neon.yellow('Fix the issues above and re-run this checkpoint.')}`);
  process.exit(1);
}

console.log(`  ${tag.phase} ${neon.green('✓ Artifacts validated')}`);

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
  console.log(`  ${tag.task} ${neon.green('✓')} ${neon.dim(taskDef.name)}`);
}

// ── Advance phase ───────────────────────────────────────

if (online && projectId) {
  try {
    await advancePhase(projectId, phaseNumber + 1);
    console.log(`  ${tag.phase} ${neon.green(`Advanced to phase ${phaseNumber + 1}`)}`);
  } catch (err) {
    console.log(`  ${tag.error} ${neon.yellow(`Phase advance failed: ${err.message}`)}`);
  }
}

console.log(`  ${tag.phase} ${neon.dim(`Phase ${phaseNumber} complete`)}`);
console.log();

// Structured output for SKILL.md to parse
console.log(`ALBA_CHECKPOINT_PHASE=${phaseNumber}`);
console.log(`ALBA_CHECKPOINT_STATUS=PASSED`);
