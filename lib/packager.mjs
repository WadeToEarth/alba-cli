import { readFileSync, statSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';
import { neon, tag } from './colors.mjs';
import { API_BASE_URL } from './config.mjs';
import { getToken } from './auth.mjs';

export async function packageAndUpload(projectDir, projectId) {
  const zipPath = join(projectDir, '..', `${projectId}.zip`);

  try {
    // Create ZIP (excluding node_modules, .next)
    console.log(`  ${tag.build} ${neon.yellow('Packaging source code...')}`);
    execSync(
      `cd "${projectDir}" && zip -r "${zipPath}" . -x "node_modules/*" ".next/*" 2>/dev/null`,
      { encoding: 'utf-8', timeout: 30000 }
    );

    const stats = statSync(zipPath);
    const sizeKB = (stats.size / 1024).toFixed(0);
    console.log(`  ${tag.build} ${neon.dim(`ZIP created: ${sizeKB} KB`)}`);

    // Upload to backend
    const token = getToken();
    if (!token) {
      console.log(`  ${tag.error} ${neon.yellow('Not authenticated — skipping upload')}`);
      return false;
    }

    console.log(`  ${tag.build} ${neon.yellow('Uploading to backend...')}`);

    const fileBuffer = readFileSync(zipPath);
    const formData = new FormData();
    formData.append('file', new Blob([fileBuffer], { type: 'application/zip' }), 'source.zip');

    const res = await fetch(`${API_BASE_URL}/api/projects/${projectId}/upload`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData,
    });

    if (!res.ok) {
      console.log(`  ${tag.error} ${neon.yellow('Upload failed:')} ${neon.dim(`HTTP ${res.status}`)}`);
      return false;
    }

    console.log(`  ${tag.build} ${neon.green('\u2713')} ${neon.dim(`Uploaded (${sizeKB} KB)`)}`);
    return true;
  } catch (err) {
    console.log(`  ${tag.error} ${neon.yellow('Package/upload error:')} ${neon.dim(err.message || 'unknown')}`);
    return false;
  }
}

export async function updateDemoUrl(projectId, demoUrl) {
  const token = getToken();
  if (!token) return false;

  try {
    const res = await fetch(`${API_BASE_URL}/api/projects/${projectId}/demo-url`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ demoUrl }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
