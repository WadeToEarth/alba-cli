import { API_BASE_URL } from './config.mjs';

export async function checkHealth() {
  const res = await fetch(`${API_BASE_URL}/api/health`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function listProjects() {
  const res = await fetch(`${API_BASE_URL}/api/projects`);
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
