import { API_BASE_URL } from './config.mjs';
import { getValidToken } from './auth.mjs';

async function fetchWithAuth(path, options = {}) {
  const token = await getValidToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

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

export async function fetchMe(token) {
  const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function createProject(data) {
  return fetchWithAuth('/api/projects', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateProject(projectId, data) {
  return fetchWithAuth(`/api/projects/${projectId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function recordTask(data) {
  return fetchWithAuth('/api/tasks', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function advancePhase(projectId, newPhase) {
  return fetchWithAuth(`/api/projects/${projectId}/advance-phase`, {
    method: 'POST',
    body: JSON.stringify({ newPhase }),
  });
}

export async function joinProject(projectId) {
  return fetchWithAuth(`/api/projects/${projectId}/join`, { method: 'POST' });
}

export async function saveArtifact(projectId, filename, content) {
  return fetchWithAuth(`/api/projects/${projectId}/artifacts/${encodeURIComponent(filename)}`, {
    method: 'PUT',
    body: JSON.stringify({ content }),
  });
}

export async function getArtifacts(projectId) {
  return fetchWithAuth(`/api/projects/${projectId}/artifacts`);
}

export async function downloadProjectZip(projectId) {
  const token = await getValidToken();
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}/api/projects/${projectId}/download`, { headers });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function claimNextProject() {
  const token = await getValidToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}/api/projects/claim-next`, {
    method: 'POST', headers,
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}
