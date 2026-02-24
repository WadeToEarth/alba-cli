# CLAUDE.md — ALBA CLI Plugin

## Structure
scripts/ — Entry points (setup.mjs, checkpoint.mjs, finalize.mjs)
lib/ — Shared modules (api, auth, phases, config)
skills/ — SKILL.md files for Claude Code execution

## Phase System
6 phases, 24 tasks per project:
1. Ideation → SPEC.md
2. Design → DESIGN.md
3. Implementation → source code (Next.js 14 + Tailwind)
4. Review → BUG_REPORT.md
5. Bug Fix → fixed source
6. Demo → preview.html (<50KB, self-contained)

## Conventions
- ES modules (.mjs), no TypeScript
- Structured output via stderr (ALBA_*_START/END markers)
- Separate Bash calls in SKILL.md — NEVER chain with &&
- allowed-tools must be specific: Bash(node *), Bash(npm *), etc.
- All API calls go through lib/api.mjs with Bearer token auth

## Don't
- Don't add dependencies unless absolutely necessary
- Don't modify phase structure without updating phases.mjs + checkpoint.mjs
