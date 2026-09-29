import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const npm = 'npm';

let aiProcess = null;

function run(args, cwd) {
  const child = process.platform === 'win32'
    ? spawn('cmd.exe', ['/d', '/s', '/c', ['npm', ...args].join(' ')], { cwd, stdio: 'inherit' })
    : spawn(npm, args, { cwd, stdio: 'inherit' });

  return new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${args.join(' ')} failed in ${cwd}`));
    });
  });
}

async function aiIsUp() {
  try {
    const response = await fetch('http://127.0.0.1:4000/health', { signal: AbortSignal.timeout(1500) });
    return response.ok;
  } catch {
    return false;
  }
}

async function ensureAi() {
  if (await aiIsUp()) {
    return false;
  }

  aiProcess = spawn(process.execPath, ['server.mjs'], {
    cwd: join(root, 'ai'),
    stdio: 'inherit',
  });

  const started = Date.now();
  while (!(await aiIsUp())) {
    if (aiProcess.exitCode !== null) {
      throw new Error('The AI server stopped before it was ready.');
    }
    if (Date.now() - started > 20000) {
      throw new Error('The AI server did not answer on port 4000.');
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  return true;
}

function stopAi() {
  if (!aiProcess || aiProcess.killed) {
    return;
  }
  aiProcess.kill();
  aiProcess = null;
}

process.on('SIGINT', () => {
  stopAi();
  process.exit(1);
});

const steps = [
  ['backend tests', ['test'], join(root, 'backend')],
  ['AI tests', ['test'], join(root, 'ai')],
];

try {
  for (const [name, args, cwd] of steps) {
    console.log(`\n--- ${name} ---\n`);
    await run(args, cwd);
  }

  console.log('\n--- browser test ---\n');
  const startedAi = await ensureAi();
  try {
    await run(['run', 'test:e2e'], join(root, 'frontend'));
  } finally {
    if (startedAi) {
      stopAi();
    }
  }
} catch (error) {
  stopAi();
  console.error(`\n${error instanceof Error ? error.message : 'Verify failed.'}`);
  process.exit(1);
}

console.log('\nVerify passed. Backend tests, AI tests, and the browser test are green.');
