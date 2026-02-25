import { updateProject } from '../lib/api.mjs';

// Usage: node scripts/update-idea.mjs <projectId> <name> <tag> <description> <ideaSource> <ideaSourceDetail> [--icon "<svg>..."] [--tagline "..."] [--quiet]
const quiet = process.argv.includes('--quiet');

// Parse named flags (--icon, --tagline) then positional args
const rawArgs = process.argv.slice(2);
let icon = '';
let tagline = '';
const positional = [];

for (let i = 0; i < rawArgs.length; i++) {
  if (rawArgs[i] === '--icon' && i + 1 < rawArgs.length) {
    icon = rawArgs[++i];
  } else if (rawArgs[i] === '--tagline' && i + 1 < rawArgs.length) {
    tagline = rawArgs[++i];
  } else if (rawArgs[i] !== '--quiet') {
    positional.push(rawArgs[i]);
  }
}

const [projectId, name, tag, description, ideaSource, ideaSourceDetail] = positional;

if (!projectId || !name) {
  console.error('[ERROR] Usage: update-idea.mjs <projectId> <name> <tag> <description> <ideaSource> <ideaSourceDetail> [--icon "<svg>"] [--tagline "..."]');
  process.exit(1);
}

try {
  const data = { name, ideaSource: ideaSource || 'ai-generated', ideaSourceDetail: ideaSourceDetail || '' };
  if (tag) data.tag = tag;
  if (description) data.description = description;
  if (icon) data.icon = icon;
  if (tagline) data.tagline = tagline;
  await updateProject(projectId, data);
  if (!quiet) console.log(`[PHASE] Project updated: ${name}`);
} catch (err) {
  console.error(`[ERROR] Failed to update project: ${err.message}`);
}
