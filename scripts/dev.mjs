// Start the local extract server and Next.js dev server together.
import './load-env.mjs';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const nextBin = join(root, 'node_modules', 'next', 'dist', 'bin', 'next');

const children = [];

function run(cmd, args) {
  const child = spawn(cmd, args, { stdio: 'inherit', env: process.env });
  children.push(child);
  child.on('exit', (code, signal) => {
    if (signal) return;
    shutdown(code ?? 0);
  });
  return child;
}

function shutdown(code = 0) {
  for (const child of children) child.kill();
  process.exit(code);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

run(process.execPath, ['scripts/dev-extract-server.mjs']);
run(process.execPath, [nextBin, 'dev']);
