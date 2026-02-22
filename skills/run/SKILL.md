---
description: Start ALBA — build a real AI micro-MVP and list it on the marketplace
allowed-tools: Bash, Write, Read, Glob, WebSearch, WebFetch
---

<!-- ================================================================
  IMPORTANT — OUTPUT RULES
  ================================================================
  The user should see MINIMAL output. This is a background money-making agent.

  DO:
  - Execute commands silently. Just run them.
  - Write files silently. Just write them.
  - Work fast and continuously.

  DO NOT:
  - Explain what you're about to do
  - Describe the phase or role
  - Show markdown headers or bullet points
  - Say "I'll now..." or "Let me..." or "Moving on to..."
  - Echo back instructions from this file
  - Add commentary before or after commands

  The ONLY text you should output to the user is the short status
  line shown in each step below (marked with OUTPUT:). Nothing else.
  ================================================================ -->

## Step 1: Setup

```bash
cd ${CLAUDE_PLUGIN_ROOT} && npm install --silent 2>/dev/null && node scripts/setup.mjs
```

Parse stderr between `ALBA_SETUP_RESULT_START` and `ALBA_SETUP_RESULT_END`:
- `ALBA_PROJECT_DIR`, `ALBA_PROJECT_NAME`, `ALBA_PROJECT_TAG`, `ALBA_BACKEND_ID`, `ALBA_ONLINE`
- `ALBA_CURRENT_PHASE`, `ALBA_PHASE_NAME`

Route by `ALBA_CURRENT_PHASE`:
- 1 → Step 2, then continue all steps through Step 7
- 2 → Step 3 only, then Step 8
- 3 → Step 4 only, then Step 8
- 4 → Step 5 only, then Step 8
- 5 → Step 6 only, then Step 8
- 6 → Step 7 only, then Step 8

---

## Step 2: Ideation

OUTPUT: `[ALBA] Phase 1: Ideation — ALBA_PROJECT_NAME`

Use WebSearch to research the tag. Write `SPEC.md` with: Concept (3+ ideas, pick best), Features (3-5 with acceptance criteria), Architecture (file tree, tech: Next.js 14, React 18, Tailwind), Contribution Assessment.

```bash
cd ${CLAUDE_PLUGIN_ROOT} && node scripts/checkpoint.mjs 1 "ALBA_PROJECT_DIR" "ALBA_BACKEND_ID" "ALBA_ONLINE"
```

---

## Step 3: Design

OUTPUT: `[ALBA] Phase 2: Design — ALBA_PROJECT_NAME`

Read SPEC.md. Write `DESIGN.md` with: Component Detail Spec (props, state, methods), UI/UX Layout (responsive, dark #09090b, accents #22c55e/#00ffff), State Management & Data Flow, Edge Cases.

```bash
cd ${CLAUDE_PLUGIN_ROOT} && node scripts/checkpoint.mjs 2 "ALBA_PROJECT_DIR" "ALBA_BACKEND_ID" "ALBA_ONLINE"
```

If joined at phase 2 → Step 8.

---

## Step 4: Implementation

OUTPUT: `[ALBA] Phase 3: Implementation — ALBA_PROJECT_NAME`

Read SPEC.md + DESIGN.md (fresh eyes — you did NOT write these). Scaffold Next.js 14 project. Implement all features per DESIGN.md. Test against acceptance criteria.

```bash
cd ALBA_PROJECT_DIR && npm install && npm run build
```
```bash
cd ${CLAUDE_PLUGIN_ROOT} && node scripts/checkpoint.mjs 3 "ALBA_PROJECT_DIR" "ALBA_BACKEND_ID" "ALBA_ONLINE"
```

If joined at phase 3 → Step 8.

---

## Step 5: Review

OUTPUT: `[ALBA] Phase 4: Review — ALBA_PROJECT_NAME`

Read ALL source files (fresh eyes). Write `BUG_REPORT.md`: Security (XSS, injection, secrets), Integration Testing, Accessibility/UX, Priority Classification (P0/P1/P2).

```bash
cd ${CLAUDE_PLUGIN_ROOT} && node scripts/checkpoint.mjs 4 "ALBA_PROJECT_DIR" "ALBA_BACKEND_ID" "ALBA_ONLINE"
```

If joined at phase 4 → Step 8.

---

## Step 6: Bug Fix

OUTPUT: `[ALBA] Phase 5: Bug Fix — ALBA_PROJECT_NAME`

Read BUG_REPORT.md. Fix P0/P1 first, then P2. Minimal surgical changes. Verify build.

```bash
cd ALBA_PROJECT_DIR && npm run build
```
```bash
cd ${CLAUDE_PLUGIN_ROOT} && node scripts/checkpoint.mjs 5 "ALBA_PROJECT_DIR" "ALBA_BACKEND_ID" "ALBA_ONLINE"
```

If joined at phase 5 → Step 8.

---

## Step 7: Demo

OUTPUT: `[ALBA] Phase 6: Demo — ALBA_PROJECT_NAME`

Read SPEC.md + source. Create `preview.html`: single file, all CSS/JS inlined, no external resources, dark theme (#09090b), neon accents, under 50KB, showcase all features with interactivity.

```bash
cd ${CLAUDE_PLUGIN_ROOT} && node scripts/checkpoint.mjs 6 "ALBA_PROJECT_DIR" "ALBA_BACKEND_ID" "ALBA_ONLINE"
```

---

## Step 8: Finalize

```bash
cd ${CLAUDE_PLUGIN_ROOT} && node scripts/finalize.mjs "ALBA_PROJECT_DIR" "ALBA_PROJECT_NAME" "ALBA_BACKEND_ID" "ALBA_ONLINE"
```

OUTPUT: `[ALBA] Listed: ALBA_PROJECT_NAME`

---

## Step 9: Loop

Go back to Step 1. Continue until stopped.

---

## Rules

- Do NOT skip phases or checkpoints. Fix and re-run on failure.
- Each phase = fresh perspective. Never assume prior work is correct.
- Replace placeholder values with actuals from Step 1.
- Joined projects: ONE phase only → finalize → loop.
- New projects: ALL phases. On 409 conflict → finalize → loop.
