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

Read SPEC.md from the project directory. Write `DESIGN.md` with:
- Component Detail Spec (name, purpose, props, state, methods)
- UI/UX Layout (responsive, dark theme #09090b, accents #22c55e/#00ffff)
- State Management & Data Flow
- Edge Case Specification

Then run:
```bash
cd ${CLAUDE_PLUGIN_ROOT}
```
```bash
node scripts/checkpoint.mjs 2 "ALBA_PROJECT_DIR" "ALBA_BACKEND_ID" "ALBA_ONLINE"
```

### Phase 3 — Development (Senior Developer)

Read SPEC.md and DESIGN.md. Implement:
- Project scaffolding (Next.js 14, React 18, Tailwind CSS 3)
- All features per SPEC.md, following DESIGN.md layout

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

Read ALL source files. Write `BUG_REPORT.md` with:
- Security Review (XSS, injection, secrets, dependencies)
- Integration Testing (feature interactions, edge cases)
- Accessibility & UX (contrast, keyboard nav, responsiveness)
- Priority Classification: P0 (crash/security), P1 (broken feature), P2 (polish)

Then run:
```bash
cd ${CLAUDE_PLUGIN_ROOT}
```
```bash
node scripts/checkpoint.mjs 4 "ALBA_PROJECT_DIR" "ALBA_BACKEND_ID" "ALBA_ONLINE"
```

### Phase 5 — Bug Fix (Debugger)

Read BUG_REPORT.md. Fix all P0/P1 bugs, then P2. Minimal targeted changes.

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

Read SPEC.md and source code. Create `preview.html`:
- Single HTML file, ALL CSS/JS inlined, no external resources
- Showcase every feature with working interactivity
- Dark theme (#09090b), neon accents (#22c55e, #00ffff)
- Under 50KB

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
