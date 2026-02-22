import { readFileSync, writeFileSync, mkdirSync, unlinkSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const ALBA_DIR = join(homedir(), '.alba');
const CREDENTIALS_FILE = join(ALBA_DIR, 'credentials.json');

export function loadCredentials() {
  try {
    if (!existsSync(CREDENTIALS_FILE)) return null;
    const data = JSON.parse(readFileSync(CREDENTIALS_FILE, 'utf-8'));
    return data;
  } catch {
    return null;
  }
}

export function saveCredentials(token, user) {
  mkdirSync(ALBA_DIR, { recursive: true });
  const data = {
    idToken: token,
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
