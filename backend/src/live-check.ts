import { ComponentCheck } from './status.service';
import { LogEntry } from './logs.service';

export interface LiveResponse {
  status(code: number): LiveResponse;
  setHeader(name: string, value: string): void;
  flushHeaders?: () => void;
  write(chunk: string): void;
  on(event: 'close', listener: () => void): void;
}

export function healthTick(check: ComponentCheck): string {
  if (check.ok) {
    return 'ok';
  }

  const problems = [check.backend, check.ai].filter((line) => line.includes('down'));
  return problems.join('; ') || 'health problem';
}

export function logLine(entry: LogEntry): string {
  return `- ${entry.component}: ${entry.message}`;
}

export function beginLive(response: LiveResponse): { stopped: () => boolean } {
  response.status(200);
  response.setHeader('Content-Type', 'text/plain; charset=utf-8');
  response.setHeader('Cache-Control', 'no-cache, no-transform');
  response.setHeader('X-Accel-Buffering', 'no');
  response.flushHeaders?.();

  let closed = false;
  response.on('close', () => {
    closed = true;
  });

  return { stopped: () => closed };
}

export function sleep(ms: number, stopped: () => boolean): Promise<void> {
  return new Promise((resolve) => {
    const started = Date.now();
    const timer = setInterval(() => {
      if (stopped() || Date.now() - started >= ms) {
        clearInterval(timer);
        resolve();
      }
    }, 100);
  });
}
