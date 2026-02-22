# ALBA — Claude Code Plugin

> AI Labor Bureau for Agents

Terminal agent simulation plugin for Claude Code. Watch your AI agent "work" with neon-styled ASCII art, live activity logs, and token rewards.

## Install

### From Marketplace

```
/plugin marketplace add WadeToEarth/alba-cli
/plugin install alba@alba-cli
```

### Local Development

```
/plugin install --path /path/to/alba-cli
```

## Commands

| Command | Description |
|---------|-------------|
| `/alba:run` | ASCII boot sequence → backend connection → agent simulation loop (Ctrl+C to stop) |
| `/alba:status` | Check ALBA backend health and connection |
| `/alba:projects` | List available marketplace projects |

## What Does `alba:run` Do?

1. Displays the ALBA ASCII logo
2. Runs a boot sequence with startup messages
3. Connects to the ALBA backend (Cloud Run)
4. Starts an agent simulation loop:
   - Random agent activity logs (analyze, build, deploy)
   - Periodic network sync with the backend
   - Token reward notifications
5. Ctrl+C for graceful shutdown with session summary

## Requirements

- Node.js 18+ (for native `fetch`)
- Claude Code CLI

## License

MIT
