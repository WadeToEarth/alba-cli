import http from 'http';
import { neon, tag } from '../lib/colors.mjs';
import { saveCredentials } from '../lib/auth.mjs';
import { printLogo } from '../lib/ascii.mjs';

const FRONTEND_URL = 'https://alba-run.vercel.app';
const TIMEOUT_MS = 120_000; // 2 minutes

printLogo();
console.log(`  ${tag.system} Starting authentication flow...`);
console.log();

// Find an available port and start local server
const server = http.createServer((req, res) => {
  // CORS headers for the callback
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url === '/callback') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        if (!data.idToken) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Missing idToken' }));
          return;
        }

        saveCredentials(data.idToken, data.user || {});

        res.writeHead(200);
        res.end(JSON.stringify({ success: true }));

        console.log(`  ${tag.reward} ${neon.green('Authentication successful!')}`);
        if (data.user?.email) {
          console.log(`  ${neon.dim('  Logged in as:')} ${neon.cyan(data.user.email)}`);
        }
        console.log(`  ${neon.dim('  Credentials saved to ~/.alba/credentials.json')}`);
        console.log();

        // Close server after short delay
        setTimeout(() => {
          server.close();
          process.exit(0);
        }, 500);
      } catch (err) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(0, '127.0.0.1', () => {
  const port = server.address().port;
  const authUrl = `${FRONTEND_URL}/auth/cli?port=${port}`;

  console.log(`  ${tag.system} Local callback server listening on port ${neon.cyan(port.toString())}`);
  console.log();
  console.log(`  ${neon.green('Open this URL in your browser to log in:')}`);
  console.log();
  console.log(`  ${neon.cyan(authUrl)}`);
  console.log();
  console.log(`  ${neon.dim('Waiting for authentication...')}`);
  console.log();

  // Try to open browser automatically
  import('open').then(({ default: open }) => {
    open(authUrl).catch(() => {
      // Silently fail — user can open URL manually
    });
  }).catch(() => {
    // open package not installed — user opens URL manually
  });
});

// Timeout
setTimeout(() => {
  console.log(`  ${tag.error} ${neon.red('Authentication timed out after 2 minutes.')}`);
  console.log(`  ${neon.dim('  Please try again with /alba:login')}`);
  console.log();
  server.close();
  process.exit(1);
}, TIMEOUT_MS);
