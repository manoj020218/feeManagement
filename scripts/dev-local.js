#!/usr/bin/env node
/**
 * dev-local.js — starts SSH tunnel to VPS MongoDB, then launches nodemon
 *
 * Usage:  npm run dev:local
 *
 * What it does:
 *   1. Spawns: plink -L 27017:127.0.0.1:27017 root@154.61.69.200 -N -batch -pw <pass>
 *   2. Waits 2 s for tunnel to come up
 *   3. Spawns: nodemon src/server.js  (with NODE_ENV=development)
 *   4. On Ctrl-C kills both processes cleanly
 */

const { spawn } = require('child_process');
const path = require('path');

// Load .env.local for VPS_HOST / VPS_USER / VPS_PASS
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

// ── Config (all values come from .env.local) ─────────────
const VPS_HOST = process.env.VPS_HOST;
const VPS_USER = process.env.VPS_USER || 'root';
const VPS_PASS = process.env.VPS_PASS;
const LOCAL_PORT  = 27017;
const REMOTE_PORT = 27017;
const TUNNEL_DELAY_MS = 2000;

if (!VPS_HOST || !VPS_PASS) {
  console.error('\n[error] VPS_HOST and VPS_PASS must be set in .env.local\n');
  console.error('  Add these lines to .env.local:');
  console.error('    VPS_HOST=<your-vps-ip>');
  console.error('    VPS_USER=root');
  console.error('    VPS_PASS=<your-ssh-password>\n');
  process.exit(1);
}

// ── Colours ──────────────────────────────────────────────
const C = { reset:'\x1b[0m', cyan:'\x1b[36m', yellow:'\x1b[33m', green:'\x1b[32m', red:'\x1b[31m', dim:'\x1b[2m' };
const log  = (msg) => console.log(`${C.cyan}[tunnel]${C.reset} ${msg}`);
const logS = (msg) => console.log(`${C.green}[server]${C.reset} ${msg}`);
const err  = (msg) => console.log(`${C.red}[error]${C.reset}  ${msg}`);

// ── Start tunnel ─────────────────────────────────────────
log(`Opening SSH tunnel → ${VPS_HOST}:${REMOTE_PORT} on local port ${LOCAL_PORT}`);

const tunnel = spawn('plink', [
  '-batch',
  '-pw', VPS_PASS,
  '-L', `${LOCAL_PORT}:127.0.0.1:${REMOTE_PORT}`,
  `${VPS_USER}@${VPS_HOST}`,
  '-N',
], { stdio: ['ignore', 'pipe', 'pipe'] });

tunnel.stdout.on('data', d => log(d.toString().trim()));
tunnel.stderr.on('data', d => {
  const msg = d.toString().trim();
  if (msg && !msg.includes('TERM_PROG')) log(C.dim + msg + C.reset);
});

tunnel.on('error', (e) => {
  err(`plink not found: ${e.message}`);
  err('Install PuTTY: https://www.putty.org  (plink must be on PATH)');
  process.exit(1);
});

tunnel.on('exit', (code) => {
  if (code !== null && code !== 0) {
    err(`SSH tunnel exited (code ${code})`);
  }
});

// ── Start server after tunnel is up ──────────────────────
setTimeout(() => {
  log(`Tunnel ready — starting server…\n`);

  const server = spawn('npx', ['nodemon', 'src/server.js'], {
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'development' },
    shell: true,
    cwd: path.join(__dirname, '..'),
  });

  server.on('exit', cleanup);
}, TUNNEL_DELAY_MS);

// ── Cleanup on Ctrl-C ────────────────────────────────────
function cleanup() {
  log('Shutting down tunnel…');
  tunnel.kill();
  process.exit(0);
}

process.on('SIGINT',  cleanup);
process.on('SIGTERM', cleanup);
process.on('exit',    () => tunnel.kill());
