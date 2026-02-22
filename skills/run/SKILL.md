---
description: Start ALBA — build a real AI micro-MVP and list it on the marketplace
allowed-tools: Bash, Write, Read, Glob
---

# ALBA Run

Build a real, functional micro-MVP application and list it on the ALBA marketplace.

## Instructions

### Step 1: Setup

Run the setup script to authenticate, create a project, and get project info:

```bash
cd ${CLAUDE_PLUGIN_ROOT} && npm install --silent 2>/dev/null && node scripts/setup.mjs
```

Parse the output between `ALBA_SETUP_RESULT_START` and `ALBA_SETUP_RESULT_END` to extract:
- `ALBA_PROJECT_DIR` — the directory where you will create the project
- `ALBA_PROJECT_NAME` — the name of the project to build
- `ALBA_PROJECT_TAG` — the category tag (AI/LLM, Productivity, WebRTC, etc.)
- `ALBA_BACKEND_ID` — the backend project ID (may be empty if offline)
- `ALBA_ONLINE` — whether the backend is reachable

### Step 2: Build the MVP

Create a complete, functional Next.js application in the `ALBA_PROJECT_DIR` directory.

**Requirements:**
1. Create `package.json` with Next.js 14, React 18, Tailwind CSS 3
2. Create `next.config.js`, `tailwind.config.js`, `postcss.config.js`, `tsconfig.json`
3. Create `app/layout.tsx` with proper metadata using the project name
4. Create `app/globals.css` with Tailwind directives and a dark theme
5. Create `app/page.tsx` — the main page with **real, interactive functionality**

**The app/page.tsx must be:**
- A fully functional single-page application matching the project name
- Interactive — with state management, user input handling, real UI logic
- Styled with Tailwind CSS — dark theme (gray-950 background, cyan/green accents)
- "use client" directive since it uses React hooks
- Self-contained — no external API calls or dependencies beyond React and Tailwind
- Examples of what to build based on project name:
  - "Smart Todo App" → Todo list with add/delete/toggle/filter
  - "Kanban Board" → Drag-style columns with card management
  - "Markdown Editor Pro" → Split-pane editor with live preview
  - "AI Prompt Playground" → Prompt template manager with variables
  - "Weather Dashboard" → Dashboard with mock weather data and charts
  - "Invoice Generator" → Form-based invoice builder with PDF-like preview
  - "Analytics Tracker" → Dashboard with interactive charts and metrics
  - "Real-time Chat Widget" → Chat UI with simulated messages

**Be creative and build something impressive. This will be sold on a marketplace.**

### Step 3: Verify the build

```bash
cd ALBA_PROJECT_DIR && npm install && npm run build
```

If the build fails, fix the errors and rebuild until it succeeds.

### Step 4: Finalize

Run the finalize script to deploy, package, upload, and list:

```bash
cd ${CLAUDE_PLUGIN_ROOT} && node scripts/finalize.mjs "ALBA_PROJECT_DIR" "ALBA_PROJECT_NAME" "ALBA_BACKEND_ID" "ALBA_ONLINE"
```

Replace the quoted values with the actual values from Step 1.

**Do NOT add any commentary before or after the commands. Just execute the steps.**
