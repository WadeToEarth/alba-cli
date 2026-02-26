import { existsSync, readFileSync, statSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';
import { Script } from 'node:vm';
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
  const requiredSections = ['Concept', 'Feature', 'Architect', 'Infra', 'Contribut'];
  const labels = ['Concept', 'Feature(s)', 'Architecture', 'Infrastructure', 'Contribution'];
  const missing = requiredSections
    .map((s, i) => (!content.match(new RegExp(`^#{1,3}\\s.*${s}`, 'mi')) ? labels[i] : null))
    .filter(Boolean);
  if (missing.length > 0) {
    return `SPEC.md missing sections: ${missing.join(', ')}`;
  }

  // ── Content quality checks ──
  const qualityErrors = [];

  // 1. Section minimum length — check each required section (h1/h2 level, including subsections)
  for (let i = 0; i < requiredSections.length; i++) {
    const headerMatch = content.match(new RegExp(`^(#{1,2})\\s+.*${requiredSections[i]}.*$`, 'mi'));
    if (headerMatch) {
      const headerLevel = headerMatch[1].length; // 1 or 2
      const startIdx = headerMatch.index + headerMatch[0].length;
      // Find the next header at same or higher level
      const nextHeader = content.slice(startIdx).match(new RegExp(`^#{1,${headerLevel}}\\s`, 'm'));
      const endIdx = nextHeader ? startIdx + nextHeader.index : content.length;
      const sectionBody = content.slice(startIdx, endIdx).trim();
      if (sectionBody.length < 100) {
        qualityErrors.push(`Section "${labels[i]}" is too short (${sectionBody.length} chars, need 100+)`);
      }
    }
  }

  // 2. Acceptance Criteria pattern — at least one "User can" / "→" / "sees"
  if (!content.match(/User can|→|sees/i)) {
    qualityErrors.push('Missing acceptance criteria patterns (need "User can" / "→" / "sees")');
  }

  // 3. Color Palette — at least 2 hex codes
  const hexCodes = content.match(/#[0-9a-fA-F]{6}/g) || [];
  if (hexCodes.length < 2) {
    qualityErrors.push(`Color palette needs 2+ hex codes (found ${hexCodes.length})`);
  }

  // 4. File tree — tree characters or .tsx/.ts file references
  if (!content.match(/[├└│]/) && !content.match(/\.tsx?\b/)) {
    qualityErrors.push('Missing file tree (need tree characters ├└│ or .tsx/.ts file references)');
  }

  if (qualityErrors.length > 0) {
    return `SPEC.md quality issues:\n  - ${qualityErrors.join('\n  - ')}`;
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

  // ── Content quality checks ──
  const qualityErrors = [];

  // 1. Section minimum length — check each required section (h1/h2 level, including subsections)
  for (let i = 0; i < requiredSections.length; i++) {
    const headerMatch = content.match(new RegExp(`^(#{1,2})\\s+.*${requiredSections[i]}.*$`, 'mi'));
    if (headerMatch) {
      const headerLevel = headerMatch[1].length;
      const startIdx = headerMatch.index + headerMatch[0].length;
      const nextHeader = content.slice(startIdx).match(new RegExp(`^#{1,${headerLevel}}\\s`, 'm'));
      const endIdx = nextHeader ? startIdx + nextHeader.index : content.length;
      const sectionBody = content.slice(startIdx, endIdx).trim();
      if (sectionBody.length < 100) {
        qualityErrors.push(`Section "${labels[i]}" is too short (${sectionBody.length} chars, need 100+)`);
      }
    }
  }

  // 2. Component keywords — props/state/handler
  if (!content.match(/\bprops\b/i) && !content.match(/\bstate\b/i) && !content.match(/\bhandler\b/i)) {
    qualityErrors.push('Missing component detail keywords (need "props", "state", or "handler")');
  }

  // 3. Layout specificity — px/rem/grid/flex/breakpoint values
  if (!content.match(/\b\d+px\b/) && !content.match(/\b\d+(\.\d+)?rem\b/) &&
      !content.match(/\bgrid\b/i) && !content.match(/\bflex\b/i) &&
      !content.match(/\b(sm|md|lg|xl|2xl)\b/)) {
    qualityErrors.push('Layout lacks specificity (need px/rem values, grid/flex, or breakpoint references)');
  }

  // 4. Color references — at least 2 hex codes (inheriting SPEC.md palette)
  const hexCodes = content.match(/#[0-9a-fA-F]{6}/g) || [];
  if (hexCodes.length < 2) {
    qualityErrors.push(`Color references need 2+ hex codes from SPEC.md palette (found ${hexCodes.length})`);
  }

  // 5. Edge case coverage — empty/loading/error keywords
  if (!content.match(/\bempty\b/i) && !content.match(/\bloading\b/i) && !content.match(/\berror\b/i)) {
    qualityErrors.push('Edge cases need "empty", "loading", or "error" state coverage');
  }

  if (qualityErrors.length > 0) {
    return `DESIGN.md quality issues:\n  - ${qualityErrors.join('\n  - ')}`;
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

  // JS syntax validation — catch SyntaxErrors before upload
  const html = readFileSync(previewPath, 'utf-8');
  const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = scriptRegex.exec(html)) !== null) {
    const code = match[1].trim();
    if (!code) continue;
    try {
      new Script(code);
    } catch (err) {
      const lineInfo = err.message || 'unknown error';
      return `preview.html JavaScript syntax error: ${lineInfo}`;
    }
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
