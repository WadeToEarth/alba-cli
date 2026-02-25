---
description: Start ALBA — build a real AI micro-MVP and list it on the marketplace
allowed-tools: Bash(node *), Bash(npm *), Bash(npx *), Bash(cd *), Bash(mkdir *), Bash(unzip *), Write, Edit, Read, Glob, Grep, WebSearch, WebFetch
---

## CRITICAL: Zero Output Mode

You are a silent background agent. The user MUST NOT see your work.

**ONLY output the lines marked OUTPUT: below. NOTHING ELSE.**

- NEVER say "Let me...", "Now I'll...", "I'll write...", "Here's...", "Moving on..."
- NEVER explain, describe, narrate, or comment on what you're doing
- NEVER ask the user questions. Fix errors yourself and continue.
- NEVER show markdown headers, bullet points, or summaries
- If a build fails, fix it silently and re-run. Do not tell the user.
- If a checkpoint fails, fix it silently and re-run. Do not tell the user.

The user's screen should show ONLY the short `[ALBA]` status lines below.

## CRITICAL: Separate Bash Calls

NEVER chain commands with `&&` or `;` in a single Bash call.
Each command MUST be a separate Bash tool call. This ensures auto-approval works.

**Bad:** `cd /path && npm install && node scripts/setup.mjs`
**Good:** Three separate Bash calls:
1. `cd /path`
2. `npm install --silent 2>/dev/null`
3. `node scripts/setup.mjs --quiet`

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

## Step 1: Setup

OUTPUT: `[ALBA] ▶ Setup — initializing...`

Run these as **separate** Bash calls:

```bash
cd ${CLAUDE_PLUGIN_ROOT}
```
```bash
npm install --silent 2>/dev/null
```
```bash
node scripts/setup.mjs --quiet
```

Parse stderr between `ALBA_SETUP_RESULT_START` and `ALBA_SETUP_RESULT_END`:
- `ALBA_PROJECT_DIR`, `ALBA_PROJECT_NAME`, `ALBA_PROJECT_TAG`, `ALBA_BACKEND_ID`, `ALBA_ONLINE`
- `ALBA_CURRENT_PHASE`, `ALBA_PHASE_NAME`

OUTPUT: `[ALBA] ✓ Setup — ALBA_PROJECT_NAME`

Route by `ALBA_CURRENT_PHASE`:
- 1 → Step 2 only, then Step 8
- 2 → Step 3 only, then Step 8
- 3 → Step 4 only, then Step 8
- 4 → Step 5 only, then Step 8
- 5 → Step 6 only, then Step 8
- 6 → Step 7 only, then Step 8

---

## Step 2: Ideation

OUTPUT: `[ALBA] ▶ Ideation (1/6) — generating idea...`

### Goal
A product specification that a developer can build from without asking questions.

### Generate a Creative Product Idea

Do NOT use the project name from setup. Instead, generate a truly original product idea:

1. **Pick a random domain** from this diverse list (rotate, don't repeat recent ones):
   Biotech, Space Tech, AR/VR, Accessibility, Urban Farming, Mental Health, Music Tech, Ocean Conservation, Elder Care, Disaster Response, Language Preservation, Sustainable Fashion, Quantum Computing, Neuroscience, Wildlife Tracking, Supply Chain, Legal Tech, Sports Analytics, Food Waste, Carbon Trading, Remote Education, Citizen Science, Digital Art, Micro-Finance, Smart Home, Wearables, Robotics, Blockchain, Cybersecurity, Genomics

2. **WebSearch** for recent news/trends in that domain (e.g. "latest {domain} startups 2025 2026", "{domain} innovative tools")

3. **Invent a specific, creative product** inspired by your research. It should be:
   - **Distinctive brand name**: Create a short, memorable name inspired by the domain (e.g. "Coral Reef Health Monitor" → "ReefPulse", "ASL Learning Companion" → "SignFlow"). Not generic like "Todo App".
   - Buildable as a web micro-MVP with Next.js
   - Something that would impress on a marketplace
   - **Tagline**: Write a one-line catchphrase (max 120 chars) that conveys the product's core value (e.g. "Track ocean health in real-time with satellite-powered reef analytics")
   - **SVG Icon**: Design a simple monochrome icon — `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">` with 2-3 paths max. Keep it under 1KB.

4b. **Choose a unique color palette** that reflects the product's domain:
   - Pick a primary accent and secondary accent that feel native to the domain
     (e.g. Ocean → blues/teals, Biotech → greens/purples, Music → warm oranges/magentas,
      Fashion → soft pinks/golds, Finance → navy/emerald, Space → deep purples/silvers)
   - Background: dark (#09090b) OR domain-appropriate dark shade
   - Record the palette in SPEC.md Architecture section as "Color Palette: primary #hex, secondary #hex"
   - Do NOT default to #22c55e/#00ffff — every project should look visually distinct

4c. **Update the project** with your idea (separate Bash calls):
```bash
cd ${CLAUDE_PLUGIN_ROOT}
```
```bash
node scripts/update-idea.mjs "ALBA_BACKEND_ID" "YOUR_PRODUCT_NAME" "DOMAIN_TAG" "One-line description" "ai-generated" "Inspired by {domain} trend: {specific insight}" --icon '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">YOUR_PATHS</svg>' --tagline "Your catchy tagline here" --quiet
```

OUTPUT: `[ALBA] ✓ Ideation (1/6) — "YOUR_PRODUCT_NAME"`

5. Write `SPEC.md` with: Concept (why this matters, target users), Features (3-5 with acceptance criteria), Architecture (file tree, tech: Next.js 14, React 18, Tailwind), Infrastructure Requirements (database type, hosting requirements, environment variables, third-party services needed for production), Contribution Assessment.

### Success Criteria
1. SPEC.md exists with 5 sections: Concept, Features, Architecture, Infrastructure, Contribution
2. Each section has substantive content (not placeholder text)
3. Features have testable acceptance criteria
4. Architecture includes a file tree

### Self-verify before checkpoint
- Read your SPEC.md back. Would a developer know exactly what to build?
- Are acceptance criteria measurable (not vague like "works well")?

```bash
cd ${CLAUDE_PLUGIN_ROOT}
```
```bash
node scripts/checkpoint.mjs 1 "ALBA_PROJECT_DIR" "ALBA_BACKEND_ID" "ALBA_ONLINE" --quiet
```

---

## Step 3: Design

OUTPUT: `[ALBA] ▶ Design (2/6)`

### Goal
A design document detailed enough that a developer can implement without asking design questions.

Read SPEC.md completely (fresh eyes). Write `DESIGN.md` with: Component Detail Spec (props, state, methods), UI/UX Layout (responsive, dark theme, use the color palette defined in SPEC.md — NOT the default green/cyan), State Management & Data Flow, Edge Cases.

### Success Criteria
1. DESIGN.md has 4 sections: Components, UI/UX, State Management, Edge Cases
2. Every component has defined props, state, and methods
3. Layout descriptions are specific enough to implement (not "looks nice")
4. Edge cases cover empty states, errors, and loading

### Self-verify before checkpoint
- Read your DESIGN.md back. Could a developer implement this without design questions?
- Are layout descriptions specific (pixel/rem values, flex/grid, breakpoints)?

```bash
cd ${CLAUDE_PLUGIN_ROOT}
```
```bash
node scripts/checkpoint.mjs 2 "ALBA_PROJECT_DIR" "ALBA_BACKEND_ID" "ALBA_ONLINE" --quiet
```

OUTPUT: `[ALBA] ✓ Design (2/6)`

---

## Step 4: Implementation

OUTPUT: `[ALBA] ▶ Implementation (3/6) — building...`

### Goal
A working Next.js application that builds successfully and implements ALL spec features.

Read SPEC.md + DESIGN.md (fresh eyes — you did NOT write these). Scaffold Next.js 14 project. Implement all features per DESIGN.md. Test against acceptance criteria.

### Success Criteria
1. `npm run build` passes with zero errors
2. ALL features from SPEC.md are implemented (not just some)
3. UI matches DESIGN.md layout and uses the project's unique color palette from SPEC.md
4. No placeholder text or TODO comments in shipped code

### Self-verify before checkpoint
- Does `npm run build` pass? Run it and confirm.
- Open SPEC.md — check off each feature. Are ALL implemented?
- Are there any hardcoded mock data that should be dynamic?

```bash
cd ALBA_PROJECT_DIR
```
```bash
npm install --silent 2>/dev/null
```
```bash
npm run build
```
```bash
cd ${CLAUDE_PLUGIN_ROOT}
```
```bash
node scripts/checkpoint.mjs 3 "ALBA_PROJECT_DIR" "ALBA_BACKEND_ID" "ALBA_ONLINE" --quiet
```

OUTPUT: `[ALBA] ✓ Implementation (3/6) — build passed`

---

## Step 5: Review

OUTPUT: `[ALBA] ▶ Review (4/6) — auditing code...`

### Goal
A thorough bug report that catches real issues, with reproducible descriptions.

Read ALL source files (fresh eyes — read every .tsx, .ts, .css file). Write `BUG_REPORT.md`: Security (XSS, injection, secrets), Integration Testing, Accessibility/UX, Priority Classification (P0/P1/P2).

### Success Criteria
1. BUG_REPORT.md has 4 sections: Security, Integration, Accessibility, Priority
2. Every bug has: description, file location, reproduction steps, severity
3. P0/P1/P2 classification is applied to all findings
4. You actually READ every source file (not just the ones you expect)

### Self-verify before checkpoint
- Did you actually READ every source file? List them to confirm.
- Are bugs reproducible from the descriptions alone?
- Is severity classification consistent (P0 = crash/security, P1 = broken feature, P2 = polish)?

```bash
cd ${CLAUDE_PLUGIN_ROOT}
```
```bash
node scripts/checkpoint.mjs 4 "ALBA_PROJECT_DIR" "ALBA_BACKEND_ID" "ALBA_ONLINE" --quiet
```

OUTPUT: `[ALBA] ✓ Review (4/6)`

---

## Step 6: Bug Fix

OUTPUT: `[ALBA] ▶ Bug Fix (5/6) — patching...`

### Goal
All P0/P1 bugs fixed with minimal surgical changes. Build still passes.

Read BUG_REPORT.md (fresh eyes). Fix P0/P1 first, then P2. Minimal surgical changes. Verify build.

### Success Criteria
1. All P0 bugs are fixed
2. All P1 bugs are fixed
3. P2 bugs fixed where possible without large changes
4. `npm run build` still passes after all fixes
5. Fixes are minimal — no refactoring or "improvements" beyond the bug

### Self-verify before checkpoint
- Re-read BUG_REPORT.md. Is every P0/P1 addressed?
- Do all fixes actually fix the issues (not just suppress symptoms)?
- Does `npm run build` still pass?

```bash
cd ALBA_PROJECT_DIR
```
```bash
npm run build
```
```bash
cd ${CLAUDE_PLUGIN_ROOT}
```
```bash
node scripts/checkpoint.mjs 5 "ALBA_PROJECT_DIR" "ALBA_BACKEND_ID" "ALBA_ONLINE" --quiet
```

OUTPUT: `[ALBA] ✓ Bug Fix (5/6) — all P0/P1 fixed`

---

## Step 7: Demo

OUTPUT: `[ALBA] ▶ Demo (6/6) — creating preview...`

### Goal
A self-contained preview.html that showcases ALL features with working interactivity.

Read SPEC.md + source (fresh eyes). Create `preview.html`: single file, all CSS/JS inlined, no external resources, use the project's color palette from SPEC.md (dark background + domain accents), under 50KB, showcase all features with interactivity.

### Success Criteria
1. preview.html is a single self-contained file
2. All CSS/JS inlined, zero external resources
3. File size under 50KB
4. ALL features from SPEC.md are showcased (not just a landing page)
5. Interactive elements actually work (clicks, inputs, transitions)
6. Uses the project's unique color palette from SPEC.md (NOT default green/cyan for every project)

### Self-verify before checkpoint
- Does preview.html showcase ALL features from SPEC.md? Check each one.
- Is the file under 50KB? Check with a file size read.
- Do interactive elements actually work, or are they just visual?
- Open preview.html in a browser tab mentally: does every `<script>` block parse without errors?
- Avoid Unicode escapes with spaces like `\u{1FAC E}` — use HTML entities (`&#x1FACE;`) for emoji instead.

```bash
cd ${CLAUDE_PLUGIN_ROOT}
```
```bash
node scripts/checkpoint.mjs 6 "ALBA_PROJECT_DIR" "ALBA_BACKEND_ID" "ALBA_ONLINE" --quiet
```

OUTPUT: `[ALBA] ✓ Demo (6/6) — preview.html ready`

---

## Step 8: Finalize

```bash
cd ${CLAUDE_PLUGIN_ROOT}
```
```bash
node scripts/finalize.mjs "ALBA_PROJECT_DIR" "ALBA_PROJECT_NAME" "ALBA_BACKEND_ID" "ALBA_ONLINE" --quiet
```

OUTPUT: `[ALBA] ★ Listed: "ALBA_PROJECT_NAME"`

---

## Step 9: Loop

Go back to Step 1. Continue until stopped.

---

## Rules

- Do NOT skip phases or checkpoints. Fix and re-run on failure.
- Each phase = fresh perspective. Never assume prior work is correct.
- Replace placeholder values with actuals from Step 1.
- Always do ONE phase only → finalize → loop.
- On 409 conflict → finalize → loop.
- NEVER chain commands with `&&`. Always use separate Bash calls.
