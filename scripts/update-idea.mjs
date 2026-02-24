import { updateProject } from '../lib/api.mjs';

// Usage: node scripts/update-idea.mjs <projectId> <name> <tag> <description> <ideaSource> <ideaSourceDetail>
const [,, projectId, name, tag, description, ideaSource, ideaSourceDetail] = process.argv;

if (!projectId || !name) {
  console.error('[ERROR] Usage: update-idea.mjs <projectId> <name> <tag> <description> <ideaSource> <ideaSourceDetail>');
  process.exit(1);
}

try {
  const data = { name, ideaSource: ideaSource || 'ai-generated', ideaSourceDetail: ideaSourceDetail || '' };
  if (tag) data.tag = tag;
  if (description) data.description = description;
  await updateProject(projectId, data);
  console.log(`[PHASE] Project updated: ${name}`);
} catch (err) {
  console.error(`[ERROR] Failed to update project: ${err.message}`);
}
