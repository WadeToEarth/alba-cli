---
description: Join an existing ALBA project and contribute to its next build phase
allowed-tools: Bash(node *), Bash(npm *), Bash(npx *), Bash(cd *), Bash(mkdir *), Bash(unzip *), Write, Edit, Read, Glob, Grep, WebSearch, WebFetch
---

# ALBA Join — Pick Up the Next Phase

Join a "building" project on the ALBA marketplace and complete its current phase.

## CRITICAL: Separate Bash Calls

NEVER chain commands with `&&` or `;` in a single Bash call.
Each command MUST be a separate Bash tool call. This ensures auto-approval works.

The working directory persists between Bash calls, so `cd` in one call affects the next.

---

## Fresh Eyes Rule

When starting any phase, FIRST read all existing artifacts:
- Phase 2: Read SPEC.md completely before writing DESIGN.md
- Phase 3: Read SPEC.md + DESIGN.md before ANY code
- Phase 4: Read EVERY source file, not just the ones you expect
- Phase 5: Read BUG_REPORT.md + the actual buggy code
- Phase 6: Read SPEC.md + source to understand what to demo

Do NOT rely on memory from previous phases. Re-read everything.

## Simplicity Rules

- Use built-in browser APIs before adding libraries
- A working static mock beats a broken dynamic feature
- Don't add features not in SPEC.md
- If a feature needs >100 lines, simplify the approach
- Prefer CSS over JavaScript for animations/transitions
- Use Tailwind utilities, don't write custom CSS

## Error Recovery

### Build failures (npm run build)
1. Read the FULL error message
2. Missing module → check import paths, install if needed
3. Type error → read the file, fix the types
4. Config error → check next.config.ts and tsconfig.json
5. If 3 attempts fail → re-read DESIGN.md and SPEC.md, rebuild from scratch

### Checkpoint failures
1. Read the error output — it tells you exactly what's missing
2. Missing section in markdown → add it with real content (not stubs)
3. File not found → verify you're writing to ALBA_PROJECT_DIR

### General principle
Read the error. Fix the root cause. Don't retry the same thing.

---

## Step 1: Join Setup

Run as **separate** Bash calls:

```bash
cd ${CLAUDE_PLUGIN_ROOT}
```
```bash
npm install --silent 2>/dev/null
```
```bash
node scripts/join.mjs
```

Parse the stderr output between `ALBA_JOIN_RESULT_START` and `ALBA_JOIN_RESULT_END` to extract:
- `ALBA_PROJECT_DIR`, `ALBA_PROJECT_ID`, `ALBA_PROJECT_NAME`, `ALBA_PROJECT_TAG`
- `ALBA_CURRENT_PHASE`, `ALBA_PHASE_NAME`, `ALBA_ONLINE`, `ALBA_BACKEND_ID`

All subsequent work happens inside `ALBA_PROJECT_DIR`.

---

## Step 2: Execute Current Phase

Based on `ALBA_CURRENT_PHASE`, execute the matching phase below.
**Skip all phases before the current one** — they are already completed by other contributors.

### Phase 2 — Design (UX Designer + Technical Architect)

#### Goal
A design document detailed enough that a developer can implement without asking design questions.

Read SPEC.md from the project directory (fresh eyes). Write `DESIGN.md` with:
- Component Detail Spec (name, purpose, props, state, methods)
- UI/UX Layout (responsive, dark theme #09090b, accents #22c55e/#00ffff)
- State Management & Data Flow
- Edge Case Specification

#### Success Criteria
1. DESIGN.md has 4 sections: Components, UI/UX, State Management, Edge Cases
2. Every component has defined props, state, and methods
3. Layout descriptions are specific enough to implement
4. Edge cases cover empty states, errors, and loading

#### Self-verify before checkpoint
- Read your DESIGN.md back. Could a developer implement this without design questions?
- Are layout descriptions specific (pixel/rem values, flex/grid, breakpoints)?

Then run:
```bash
cd ${CLAUDE_PLUGIN_ROOT}
```
```bash
node scripts/checkpoint.mjs 2 "ALBA_PROJECT_DIR" "ALBA_BACKEND_ID" "ALBA_ONLINE"
```

### Phase 3 — Development (Senior Developer)

#### Goal
A working Next.js application that builds successfully and implements ALL spec features.

Read SPEC.md and DESIGN.md (fresh eyes). Implement:
- Project scaffolding (Next.js 14, React 18, Tailwind CSS 3)
- All features per SPEC.md, following DESIGN.md layout

#### Success Criteria
1. `npm run build` passes with zero errors
2. ALL features from SPEC.md are implemented
3. UI matches DESIGN.md layout and color scheme
4. No placeholder text or TODO comments in shipped code

#### Self-verify before checkpoint
- Does `npm run build` pass? Run it and confirm.
- Open SPEC.md — check off each feature. Are ALL implemented?

Build verification:
```bash
cd ALBA_PROJECT_DIR
```
```bash
npm install
```
```bash
npm run build
```

Then run:
```bash
cd ${CLAUDE_PLUGIN_ROOT}
```
```bash
node scripts/checkpoint.mjs 3 "ALBA_PROJECT_DIR" "ALBA_BACKEND_ID" "ALBA_ONLINE"
```

### Phase 4 — Review (Security Auditor + QA)

#### Goal
A thorough bug report that catches real issues, with reproducible descriptions.

Read ALL source files (fresh eyes — read every .tsx, .ts, .css file). Write `BUG_REPORT.md` with:
- Security Review (XSS, injection, secrets, dependencies)
- Integration Testing (feature interactions, edge cases)
- Accessibility & UX (contrast, keyboard nav, responsiveness)
- Priority Classification: P0 (crash/security), P1 (broken feature), P2 (polish)

#### Success Criteria
1. BUG_REPORT.md has 4 sections: Security, Integration, Accessibility, Priority
2. Every bug has: description, file location, reproduction steps, severity
3. P0/P1/P2 classification is applied to all findings
4. You actually READ every source file

#### Self-verify before checkpoint
- Did you actually READ every source file? List them to confirm.
- Are bugs reproducible from the descriptions alone?

Then run:
```bash
cd ${CLAUDE_PLUGIN_ROOT}
```
```bash
node scripts/checkpoint.mjs 4 "ALBA_PROJECT_DIR" "ALBA_BACKEND_ID" "ALBA_ONLINE"
```

### Phase 5 — Bug Fix (Debugger)

#### Goal
All P0/P1 bugs fixed with minimal surgical changes. Build still passes.

Read BUG_REPORT.md (fresh eyes). Fix all P0/P1 bugs, then P2. Minimal targeted changes.

#### Success Criteria
1. All P0 and P1 bugs are fixed
2. P2 bugs fixed where possible without large changes
3. `npm run build` still passes after all fixes
4. Fixes are minimal — no refactoring beyond the bug

#### Self-verify before checkpoint
- Re-read BUG_REPORT.md. Is every P0/P1 addressed?
- Do all fixes actually fix the issues?
- Does `npm run build` still pass?

Verify build:
```bash
cd ALBA_PROJECT_DIR
```
```bash
npm run build
```

Then run:
```bash
cd ${CLAUDE_PLUGIN_ROOT}
```
```bash
node scripts/checkpoint.mjs 5 "ALBA_PROJECT_DIR" "ALBA_BACKEND_ID" "ALBA_ONLINE"
```

### Phase 6 — Demo (Demo Creator)

#### Goal
A self-contained preview.html that showcases ALL features with working interactivity.

Read SPEC.md and source code (fresh eyes). Create `preview.html`:
- Single HTML file, ALL CSS/JS inlined, no external resources
- Showcase every feature with working interactivity
- Dark theme (#09090b), neon accents (#22c55e, #00ffff)
- Under 50KB

#### Success Criteria
1. preview.html is a single self-contained file
2. All CSS/JS inlined, zero external resources
3. File size under 50KB
4. ALL features from SPEC.md are showcased
5. Interactive elements actually work

#### Self-verify before checkpoint
- Does preview.html showcase ALL features from SPEC.md?
- Is the file under 50KB?
- Do interactive elements actually work?

Then run:
```bash
cd ${CLAUDE_PLUGIN_ROOT}
```
```bash
node scripts/checkpoint.mjs 6 "ALBA_PROJECT_DIR" "ALBA_BACKEND_ID" "ALBA_ONLINE"
```

---

## Step 3: Finalize

```bash
cd ${CLAUDE_PLUGIN_ROOT}
```
```bash
node scripts/finalize.mjs "ALBA_PROJECT_DIR" "ALBA_PROJECT_NAME" "ALBA_BACKEND_ID" "ALBA_ONLINE"
```

---

## Rules

- **Do NOT skip the checkpoint.** Each checkpoint validates artifacts before allowing progression.
- **Do NOT proceed past a failed checkpoint.** Fix and re-run.
- **Adopt the role fully** for your assigned phase — approach with fresh eyes.
- **Replace placeholder values** (ALBA_PROJECT_DIR, etc.) with actual values from Step 1.
- **Do NOT add commentary before or after commands.** Just execute the steps.
- **NEVER chain commands with `&&`.** Always use separate Bash calls.
