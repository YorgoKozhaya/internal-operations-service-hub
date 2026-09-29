import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SuggestError, suggest } from './suggest.mjs';

loadEnv(join(dirname(fileURLToPath(import.meta.url)), '.env'));

const port = Number(process.env.AI_PORT || 4000);
const logs = [];
let nextLogId = 1;

function log(level, message) {
  logs.push({
    id: nextLogId++,
    at: new Date().toISOString(),
    level,
    component: 'ai',
    message,
  });

  if (logs.length > 80) {
    logs.shift();
  }

  const line = `[ai] ${message}`;
  if (level === 'error') {
    console.error(line);
  } else {
    console.log(line);
  }
}

const server = createServer(async (request, response) => {
  const path = (request.url ?? '').split('?')[0];

  if (request.method === 'GET' && path === '/health') {
    send(response, 200, {
      ok: true,
      component: 'ai',
      configured: Boolean(process.env.GROQ_API_KEY),
    });
    return;
  }

  if (request.method === 'GET' && path === '/logs') {
    const lines = logs.length === 0
      ? '- No logs yet.\n'
      : `${logs.map((entry) => `- ${entry.at} ${entry.message}`).join('\n')}\n`;
    response.writeHead(200, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Length': Buffer.byteLength(lines),
    });
    response.end(lines);
    return;
  }

  if (request.method === 'GET' && path === '/logs/watch') {
    response.writeHead(200, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    });
    let lastId = 0;
    const writeNew = () => {
      for (const entry of logs) {
        if (entry.id <= lastId) {
          continue;
        }
        lastId = entry.id;
        response.write(`- ${entry.at} ${entry.message}\n`);
      }
    };
    writeNew();
    const timer = setInterval(writeNew, 1000);
    request.on('close', () => clearInterval(timer));
    return;
  }

  if (request.method !== 'POST' || path !== '/suggest') {
    send(response, 404, { message: 'Not found.' });
    return;
  }

  try {
    const body = await readJson(request);
    const text = typeof body.text === 'string' ? body.text.trim() : '';

    if (!text) {
      log('error', 'Suggestion rejected because text was missing.');
      send(response, 400, { message: 'Text is required.' });
      return;
    }

    const suggestion = await suggest(text, {
      employeeRequests: Array.isArray(body.employeeRequests) ? body.employeeRequests : [],
      categories: Array.isArray(body.categories) ? body.categories : [],
    });
    log('info', 'Suggestion completed.');
    send(response, 200, suggestion);
  } catch (error) {
    if (error instanceof SuggestError && error.code === 'not_configured') {
      log('error', 'Suggestion failed because the AI provider is not configured.');
      send(response, 503, { message: error.message });
      return;
    }

    if (error instanceof SuggestError && error.code === 'invalid') {
      log('error', 'Suggestion was rejected because the output was invalid.');
      send(response, 422, { message: error.message });
      return;
    }

    log('error', 'Suggestion failed because the AI provider could not be reached.');
    send(response, 503, { message: 'The AI provider could not be reached.' });
  }
});

server.listen(port, () => {
  log('info', `AI service listening on http://127.0.0.1:${port}`);
});

function send(response, status, body) {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  });
  response.end(payload);
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch {
        reject(new Error('invalid json'));
      }
    });
    request.on('error', reject);
  });
}

function loadEnv(filePath) {
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
