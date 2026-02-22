---
description: Start ALBA — build a real AI micro-MVP and list it on the marketplace
allowed-tools: Bash, Write, Read, Glob
---

# ALBA Run — Multi-Phase Build Protocol

Build a marketplace-quality micro-MVP through a structured, role-based pipeline.
Each phase has a specific role, artifacts, and a checkpoint gate that must pass before proceeding.

---

## Step 1: Setup

Run the setup script to authenticate, create a project, and get project info:

```bash
cd ${CLAUDE_PLUGIN_ROOT} && npm install --silent 2>/dev/null && node scripts/setup.mjs
```

Parse the output between `ALBA_SETUP_RESULT_START` and `ALBA_SETUP_RESULT_END` to extract:
- `ALBA_PROJECT_DIR` — the build directory
- `ALBA_PROJECT_NAME` — the project name
- `ALBA_PROJECT_TAG` — the category tag
- `ALBA_BACKEND_ID` — the backend project ID (may be empty if offline)
- `ALBA_ONLINE` — whether the backend is reachable

All subsequent work happens inside `ALBA_PROJECT_DIR`.

---

## Step 2: Ideation — Product Manager Role

**You are now acting as a PRODUCT MANAGER.**

Your job is to write `SPEC.md` in the project directory with these 4 required sections:

### 2a. Concept Brainstorm
- Generate 3+ candidate project ideas based on `ALBA_PROJECT_NAME` and `ALBA_PROJECT_TAG`
- Evaluate each for feasibility, creativity, and market appeal
- Select one final concept with a brief justification

### 2b. Feature Specification
- Define 3-5 concrete features for the chosen concept
- Each feature MUST have:
  - A clear description
  - Acceptance criteria (testable conditions that prove it works)

### 2c. Architecture Design
- Describe the file tree (which files will be created)
- Define component structure and how they interact
- Specify state management approach (React useState, useReducer, context, etc.)

### 2d. Contribution Assessment
- Rate each feature's complexity (low/medium/high)
- Assign contribution weight percentages (must total 100%)
- Define success metrics for the overall project

Write all of this to `SPEC.md` in the project directory, then run the checkpoint:

```bash
cd ${CLAUDE_PLUGIN_ROOT} && node scripts/checkpoint.mjs 1 "ALBA_PROJECT_DIR" "ALBA_BACKEND_ID" "ALBA_ONLINE"
```

If the checkpoint fails, fix `SPEC.md` and re-run. Do NOT proceed until the checkpoint passes.

---

## Step 3: Implementation — Developer + QA Role

**You are now acting as a DEVELOPER and QA ENGINEER.**

Build the application described in SPEC.md. Follow the architecture and features exactly.

### 3a. Project Scaffolding
Create these files:
1. `package.json` — Next.js 14, React 18, Tailwind CSS 3
2. `next.config.js`, `tailwind.config.js`, `postcss.config.js`, `tsconfig.json`
3. `app/layout.tsx` — with proper metadata using the project name
4. `app/globals.css` — Tailwind directives + dark theme base styles

### 3b. Feature 1 Implementation
- Implement the first feature from SPEC.md
- Use `"use client"` directive for interactive components
- Dark theme: gray-950 background, cyan/green neon accents
- Self-contained: no external API calls

### 3c. Feature 1 Testing
- Read the acceptance criteria from SPEC.md for Feature 1
- Verify each criterion is met by the implementation
- Fix any gaps before proceeding

### 3d. Feature 2 Implementation
- Implement the second feature from SPEC.md
- Ensure it integrates cleanly with Feature 1

### 3e. Feature 2 Testing
- Verify Feature 2 against its acceptance criteria
- Test interaction between Feature 1 and Feature 2

### 3f. Remaining Features
- Implement and test all remaining features from SPEC.md
- Each feature must meet its acceptance criteria

After all features are implemented and tested, install dependencies and verify:

```bash
cd ALBA_PROJECT_DIR && npm install && npm run build
```

Fix any build errors. Then run the checkpoint:

```bash
cd ${CLAUDE_PLUGIN_ROOT} && node scripts/checkpoint.mjs 2 "ALBA_PROJECT_DIR" "ALBA_BACKEND_ID" "ALBA_ONLINE"
```

If the checkpoint fails (build broken), fix and re-run. Do NOT proceed until it passes.

---

## Step 4: Review — Security Auditor + QA Role

**You are now acting as a SECURITY AUDITOR and QA ENGINEER.**

Read ALL source files in the project directory. Write `BUG_REPORT.md` with these 4 required sections:

### 4a. Security Review
- Check for XSS vulnerabilities (dangerouslySetInnerHTML, unescaped user input)
- Check for injection risks
- Look for exposed secrets or hardcoded credentials
- Flag any unsafe patterns (eval, innerHTML, etc.)

### 4b. Integration Testing
- Test that features work together correctly
- Verify state management doesn't have race conditions or stale state
- Check edge cases (empty inputs, very long inputs, rapid clicking)

### 4c. Accessibility/UX Review
- Check color contrast (text must be readable against backgrounds)
- Verify keyboard navigation works (Tab, Enter, Escape)
- Test responsiveness (does it work at different screen sizes?)
- Check error states (what happens when things go wrong?)

### 4d. Priority Classification
- Classify each bug as:
  - **P0** — App crashes, data loss, security vulnerability
  - **P1** — Feature broken, major UX issue
  - **P2** — Minor visual issue, edge case, polish item
- For each bug, include: description, reproduction steps, and suggested fix

Write all findings to `BUG_REPORT.md`, then run the checkpoint:

```bash
cd ${CLAUDE_PLUGIN_ROOT} && node scripts/checkpoint.mjs 3 "ALBA_PROJECT_DIR" "ALBA_BACKEND_ID" "ALBA_ONLINE"
```

If the checkpoint fails, fix `BUG_REPORT.md` and re-run. Do NOT proceed until it passes.

---

## Step 5: Bug Fixing — Debugger Role

**You are now acting as a DEBUGGER.**

Read `BUG_REPORT.md` and fix all reported issues.

### 5a. P0/P1 Fixes
- Fix all P0 (critical) bugs first
- Then fix all P1 (high priority) bugs
- Each fix should be minimal and targeted — don't refactor unrelated code

### 5b. P2 Fixes + Polish
- Fix P2 issues
- Improve code quality where bugs were found
- Ensure consistent styling and naming

### 5c. Build Verification
- Run the full build again:

```bash
cd ALBA_PROJECT_DIR && npm run build
```

Fix any new build errors. Then run the checkpoint:

```bash
cd ${CLAUDE_PLUGIN_ROOT} && node scripts/checkpoint.mjs 4 "ALBA_PROJECT_DIR" "ALBA_BACKEND_ID" "ALBA_ONLINE"
```

If the checkpoint fails (build broken), fix and re-run. Do NOT proceed until it passes.

---

## Step 6: Demo — Demo Creator Role

**You are now acting as a DEMO CREATOR.**

### 6a. Demo Page Creation
Create `preview.html` in the project directory. This is a **standalone, self-contained HTML file** that showcases all features from SPEC.md.

**Rules for preview.html:**
- Single HTML file with ALL CSS and JS inlined (no external resources)
- Must showcase every feature listed in SPEC.md
- Dark theme background (#09090b), cyan/green neon accents (#22c55e, #00ffff)
- Must be interactive — implement the same core functionality as the Next.js app
- Include the project name as a header
- Keep it under 50KB
- Use `<meta charset="utf-8">` and `<meta name="viewport" content="width=device-width, initial-scale=1">`

### 6b. Demo Verification
- Read SPEC.md and compare each feature against preview.html
- Ensure all features are represented and functional
- Test the preview.html in isolation

### 6c. Package and List
Run the checkpoint to validate the demo:

```bash
cd ${CLAUDE_PLUGIN_ROOT} && node scripts/checkpoint.mjs 5 "ALBA_PROJECT_DIR" "ALBA_BACKEND_ID" "ALBA_ONLINE"
```

If the checkpoint fails, fix preview.html and re-run. Do NOT proceed until it passes.

---

## Step 7: Finalize

Run the finalize script to upload preview, package source code, and list on marketplace:

```bash
cd ${CLAUDE_PLUGIN_ROOT} && node scripts/finalize.mjs "ALBA_PROJECT_DIR" "ALBA_PROJECT_NAME" "ALBA_BACKEND_ID" "ALBA_ONLINE"
```

Replace the quoted values with the actual values from Step 1.

---

## Rules

- **Do NOT skip phases.** Each checkpoint validates artifacts before allowing progression.
- **Do NOT proceed past a failed checkpoint.** Fix the issues and re-run the checkpoint.
- **Be creative and build something impressive.** This will be sold on a marketplace.
- **Do NOT add commentary before or after commands.** Just execute the steps.
- **Replace placeholder values** (ALBA_PROJECT_DIR, ALBA_BACKEND_ID, ALBA_ONLINE) with actual values from Step 1.
