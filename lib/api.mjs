import { API_BASE_URL } from './config.mjs';
import { getToken } from './auth.mjs';

async function fetchWithAuth(path, options = {}) {
  const token = getToken();
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

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
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
