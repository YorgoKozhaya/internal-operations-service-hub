import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const backend = join(root, 'backend');
const aiDir = join(root, 'ai');

loadEnvFile(join(backend, '.env'));
loadEnvFile(join(aiDir, '.env'));

const databaseUrl = process.env.DATABASE_URL ?? '';

if (!databaseUrl.startsWith('postgres://') && !databaseUrl.startsWith('postgresql://')) {
  console.error('DATABASE_URL must be the Render Postgres connection string.');
  process.exit(1);
}

if (!process.env.AI_BASE_URL) {
  process.env.AI_BASE_URL = 'http://127.0.0.1:4000';
}

const children = [];

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return;
  }

  const text = readFileSync(filePath, 'utf8');

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separator = trimmed.indexOf('=');

    if (separator === -1) {
      continue;
    }

    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function spawnCommand(command, args, cwd) {
  return spawn(command, args, {
    cwd,
    env: process.env,
    stdio: 'inherit',
  });
}

function run(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawnCommand(command, args, cwd);

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(' ')} failed in ${cwd}`));
    });
  });
}

function start(command, args, cwd) {
  const child = spawnCommand(command, args, cwd);
  children.push(child);
  return child;
}

function shutdown() {
  for (const child of children) {
    if (!child.killed) {
      child.kill();
    }
  }
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

try {
  console.log('Preparing the SQLite database.');
  const prismaCli = join(backend, 'node_modules', 'prisma', 'build', 'index.js');
  await run(process.execPath, [prismaCli, 'db', 'push', '--skip-generate', '--schema=prisma/schema.postgres.prisma'], backend);
  await run(process.execPath, ['dist/seed-if-empty.js'], backend);
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Database setup failed.');
  process.exit(1);
}

console.log('Starting the AI process.');
const ai = start(process.execPath, ['server.mjs'], aiDir);

ai.on('exit', (code, signal) => {
  if (signal) {
    return;
  }

  console.error(`AI process stopped (${code ?? 'unknown'}). Suggest will fail until it is running again.`);
});

console.log('Starting the API.');
const api = start(process.execPath, ['dist/main.js'], backend);

api.on('exit', (code, signal) => {
  shutdown();

  if (signal) {
    process.exit(0);
    return;
  }

  process.exit(code ?? 1);
});
