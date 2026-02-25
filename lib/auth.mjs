import { readFileSync, writeFileSync, mkdirSync, unlinkSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { FIREBASE_API_KEY } from './config.mjs';

const ALBA_DIR = join(homedir(), '.alba');
const CREDENTIALS_FILE = join(ALBA_DIR, 'credentials.json');
const FIRST_RUN_FILE = join(ALBA_DIR, '.first_run_shown');

export function isFirstRun() {
  return !existsSync(FIRST_RUN_FILE);
}

export function markFirstRunShown() {
  mkdirSync(ALBA_DIR, { recursive: true });
  writeFileSync(FIRST_RUN_FILE, '1');
}

export function loadCredentials() {
  try {
    if (!existsSync(CREDENTIALS_FILE)) return null;
    const data = JSON.parse(readFileSync(CREDENTIALS_FILE, 'utf-8'));
    return data;
  } catch {
    return null;
  }
}

export function saveCredentials(token, user, refreshToken) {
  mkdirSync(ALBA_DIR, { recursive: true });
  const data = {
    idToken: token,
    refreshToken: refreshToken || '',
    expiresAt: Date.now() + 55 * 60 * 1000, // 55 minutes from now
    user: {
      uid: user.uid || '',
      email: user.email || '',
      displayName: user.displayName || '',
      photoUrl: user.photoUrl || '',
    },
    savedAt: Date.now(),
  };
  writeFileSync(CREDENTIALS_FILE, JSON.stringify(data, null, 2));
}

export function clearCredentials() {
  try {
    if (existsSync(CREDENTIALS_FILE)) {
      unlinkSync(CREDENTIALS_FILE);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function isAuthenticated() {
  const creds = loadCredentials();
  return creds !== null && !!creds.idToken;
}

export function getToken() {
  const creds = loadCredentials();
  return creds?.idToken || null;
}

/**
 * Returns a valid (non-expired) ID token.
 * If the current token is expired or about to expire, attempts to refresh it
 * using the stored refresh token via Firebase's token endpoint.
 */
export async function getValidToken() {
  const creds = loadCredentials();
  if (!creds?.idToken) return null;

  // If token is still fresh (not expired), return it directly
  if (creds.expiresAt && Date.now() < creds.expiresAt) {
    return creds.idToken;
  }

  // Token expired — try to refresh
  if (!creds.refreshToken || !FIREBASE_API_KEY) {
    // Can't refresh without refreshToken or API key; return stale token as fallback
    return creds.idToken;
  }

  try {
    const res = await fetch(
      `https://securetoken.googleapis.com/v1/token?key=${FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(creds.refreshToken)}`,
      }
    );

    if (!res.ok) {
      return creds.idToken; // refresh failed, return stale token
    }

    const data = await res.json();
    const newIdToken = data.id_token;
    const newRefreshToken = data.refresh_token || creds.refreshToken;

    // Update credentials file with new tokens
    mkdirSync(ALBA_DIR, { recursive: true });
    const updated = {
      ...creds,
      idToken: newIdToken,
      refreshToken: newRefreshToken,
      expiresAt: Date.now() + 55 * 60 * 1000,
      savedAt: Date.now(),
    };
    writeFileSync(CREDENTIALS_FILE, JSON.stringify(updated, null, 2));

    return newIdToken;
  } catch {
    return creds.idToken; // network error, return stale token
  }
}
