---
description: Start ALBA — build a real AI micro-MVP and list it on the marketplace
allowed-tools: Bash, Write, Read, Glob
---

# ALBA Run — Multi-Phase Build Protocol

Build a marketplace-quality micro-MVP through a structured, role-based pipeline.
Each phase has a dedicated role. You must **adopt that role fully** — forget prior assumptions and approach each phase with fresh eyes.

---

## Step 1: Setup

```bash
cd ${CLAUDE_PLUGIN_ROOT} && npm install --silent 2>/dev/null && node scripts/setup.mjs
```

Parse the stderr output between `ALBA_SETUP_RESULT_START` and `ALBA_SETUP_RESULT_END` to extract:
- `ALBA_PROJECT_DIR`, `ALBA_PROJECT_NAME`, `ALBA_PROJECT_TAG`, `ALBA_BACKEND_ID`, `ALBA_ONLINE`

All subsequent work happens inside `ALBA_PROJECT_DIR`.

---

## Step 2: Ideation — Product Manager

**ROLE: You are an ambitious Product Manager pitching to investors.**

Think big. Be bold. Do NOT settle for the first obvious idea. Push for concepts that are surprising, delightful, and genuinely useful. This is not a homework assignment — this is a product that will be sold.

Write `SPEC.md` in the project directory:

### Concept (brainstorm at least 3 ideas)
- For each idea: one-sentence pitch, target user, why it's exciting
- Pick the most **unexpected yet feasible** one. Justify your pick.

### Features (3-5 features)
- Each feature: description + **acceptance criteria** (testable "it works when...")
- At least one feature must involve non-trivial interactivity (not just display)

### Architecture (high-level)
- File tree, main components, tech choices (Next.js 14, React 18, Tailwind)
- State management approach

### Contribution Assessment
- Per-feature complexity rating + weight percentages (total 100%)

Then run:
```bash
cd ${CLAUDE_PLUGIN_ROOT} && node scripts/checkpoint.mjs 1 "ALBA_PROJECT_DIR" "ALBA_BACKEND_ID" "ALBA_ONLINE"
```

---

## Step 3: Design — UX Designer + Technical Architect

**ROLE: You are a meticulous UX Designer and Technical Architect.**

You have received SPEC.md from the PM. Your job is to turn the high-level spec into a detailed, implementable blueprint. Read SPEC.md thoroughly first.

Write `DESIGN.md` in the project directory:

### Component Detail Spec
- For every component: name, purpose, props interface, internal state, key methods
- Show parent-child relationships and data ownership

### UI/UX Layout
- Describe the visual layout of each screen/section
- Specify responsive behavior (mobile vs desktop)
- Define exact color usage: background (#09090b), primary accent (#22c55e), secondary accent (#00ffff), text (zinc-100/400)
- Specify spacing, border radii, font sizes for key elements

### State Management & Data Flow
- Define the complete state shape (TypeScript-style interface)
- Document every state transition: what triggers it, what changes
- Show data flow between components (which component owns what state, how children receive it)

### Edge Case Specification
- Empty states (no data yet)
- Error states (what can go wrong, how to display it)
- Boundary conditions (max items, very long text, rapid user actions)
- Loading states if applicable

Then run:
```bash
cd ${CLAUDE_PLUGIN_ROOT} && node scripts/checkpoint.mjs 2 "ALBA_PROJECT_DIR" "ALBA_BACKEND_ID" "ALBA_ONLINE"
```

---

## Step 4: Implementation — Developer + QA

**ROLE: You are a Senior Developer who has just been handed SPEC.md and DESIGN.md by another team.**

You did NOT write these specs. Read them carefully as if seeing them for the first time. Follow the design document precisely — do not improvise or deviate unless the spec is ambiguous.

### 4a. Project Scaffolding
- `package.json` — Next.js 14, React 18, Tailwind CSS 3
- `next.config.js`, `tailwind.config.js`, `postcss.config.js`, `tsconfig.json`
- `app/layout.tsx`, `app/globals.css` — dark theme as specified in DESIGN.md

### 4b–4e. Feature Implementation + Testing (per feature)
For each feature in SPEC.md:
1. Implement according to DESIGN.md component specs and layout
2. Test against the acceptance criteria in SPEC.md
3. Fix any gaps before moving to the next feature

### 4f. Remaining Features
- Implement and test all remaining features

After all features, verify the build:
```bash
cd ALBA_PROJECT_DIR && npm install && npm run build
```

Then run:
```bash
cd ${CLAUDE_PLUGIN_ROOT} && node scripts/checkpoint.mjs 3 "ALBA_PROJECT_DIR" "ALBA_BACKEND_ID" "ALBA_ONLINE"
```

---

## Step 5: Review — Security Auditor + QA

**ROLE: You are an external Security Auditor and QA Engineer hired to find flaws.**

You have NEVER seen this code before. You are being PAID to find bugs. A clean report means you missed something — dig deep. Read EVERY source file in the project directory.

Write `BUG_REPORT.md`:

### Security Review
- XSS: any `dangerouslySetInnerHTML`? Unescaped user input in rendering?
- Injection: any `eval()`, `innerHTML`, `new Function()`?
- Secrets: any hardcoded API keys, tokens, passwords?
- Dependencies: any known vulnerable patterns?

### Integration Testing
- Do features work together? Does state stay consistent?
- Rapid clicking, double submission, concurrent state updates?
- Does the app handle empty/null/undefined gracefully?

### Accessibility & UX
- Color contrast: can you read all text? (check zinc-400 on #09090b)
- Keyboard navigation: Tab order, Enter to activate, Escape to close
- Responsiveness: mobile (320px), tablet (768px), desktop (1280px)
- Error states: what happens when something goes wrong?

### Priority Classification
Every bug gets: **P0** (crash/security), **P1** (broken feature), or **P2** (polish).
Each entry: description, steps to reproduce, suggested fix.

Then run:
```bash
cd ${CLAUDE_PLUGIN_ROOT} && node scripts/checkpoint.mjs 4 "ALBA_PROJECT_DIR" "ALBA_BACKEND_ID" "ALBA_ONLINE"
```

---

## Step 6: Bug Fixing — Debugger

**ROLE: You are a Debugger brought in specifically to fix the bugs found by the QA team.**

Read `BUG_REPORT.md`. You did NOT write this code. Approach each fix surgically — change only what's needed.

### 6a. P0/P1 Fixes
- Fix every P0 and P1 bug from BUG_REPORT.md
- Minimal, targeted changes — do NOT refactor surrounding code

### 6b. P2 Fixes + Polish
- Fix P2 issues
- Ensure consistent styling

### 6c. Build Verification
```bash
cd ALBA_PROJECT_DIR && npm run build
```

Then run:
```bash
cd ${CLAUDE_PLUGIN_ROOT} && node scripts/checkpoint.mjs 5 "ALBA_PROJECT_DIR" "ALBA_BACKEND_ID" "ALBA_ONLINE"
```

---

## Step 7: Demo — Demo Creator

**ROLE: You are a Demo Specialist creating a sales pitch page.**

Read SPEC.md to understand what features to showcase. Read the source code to understand how they work. Create a standalone demo that sells this product.

### 7a. Create `preview.html`
- Single HTML file, ALL CSS/JS inlined, no external resources
- Showcase every feature from SPEC.md with working interactivity
- Dark theme (#09090b), neon accents (#22c55e, #00ffff)
- Project name as header
- Under 50KB
- `<meta charset="utf-8">` and `<meta name="viewport" content="width=device-width, initial-scale=1">`

### 7b. Demo Verification
- Compare preview.html against SPEC.md features — every feature must be represented

### 7c. Package and List
```bash
cd ${CLAUDE_PLUGIN_ROOT} && node scripts/checkpoint.mjs 6 "ALBA_PROJECT_DIR" "ALBA_BACKEND_ID" "ALBA_ONLINE"
```

---

## Step 8: Finalize

```bash
cd ${CLAUDE_PLUGIN_ROOT} && node scripts/finalize.mjs "ALBA_PROJECT_DIR" "ALBA_PROJECT_NAME" "ALBA_BACKEND_ID" "ALBA_ONLINE"
```

---

## Rules

- **Do NOT skip phases.** Each checkpoint validates artifacts before allowing progression.
- **Do NOT proceed past a failed checkpoint.** Fix and re-run.
- **Each phase = fresh perspective.** The reviewer must NOT assume the developer's code is correct. The debugger must NOT assume the reviewer was wrong.
- **Replace placeholder values** with actual values from Step 1.
- **Do NOT add commentary before or after commands.** Just execute the steps.
