import { Injectable } from '@nestjs/common';
import { LogEntry, LogsService } from './logs.service';
import { PrismaService } from './prisma/prisma.service';

export interface ComponentCheck {
  ok: boolean;
  backend: string;
  ai: string;
}

@Injectable()
export class StatusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logs: LogsService,
  ) {}

  async components(): Promise<ComponentCheck> {
    const backend = await this.backendLine();
    const ai = await this.aiLine();

    return {
      ok: backend.ok && ai.ok,
      backend: backend.line,
      ai: ai.line,
    };
  }

  async collectedLogs(): Promise<LogEntry[]> {
    const aiLogs = await this.aiLogs();
    return [...this.logs.recent(), ...aiLogs].sort((left, right) => left.at.localeCompare(right.at));
  }

  bullets(lines: string[]): string {
    const visible = lines.filter((line) => line.trim().length > 0);
    if (visible.length === 0) {
      return '- No logs yet.\n';
    }

    return `${visible.map((line) => `- ${line}`).join('\n')}\n`;
  }

  private async backendLine(): Promise<{ ok: boolean; line: string }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { ok: true, line: 'Backend up, database up' };
    } catch {
      return { ok: false, line: 'Backend down, database down' };
    }
  }

  private async aiLine(): Promise<{ ok: boolean; line: string }> {
    const base = process.env.AI_BASE_URL ?? 'http://127.0.0.1:4000';

    try {
      const response = await fetch(`${base}/health`, { signal: AbortSignal.timeout(2000) });

      if (!response.ok) {
        return { ok: false, line: 'AI down, health check failed' };
      }

      const health = (await response.json()) as { configured?: boolean };
      return {
        ok: true,
        line: health.configured ? 'AI up, key configured' : 'AI up, key missing',
      };
    } catch {
      return { ok: false, line: 'AI down, service not running' };
    }
  }

  private async aiLogs(): Promise<LogEntry[]> {
    const base = process.env.AI_BASE_URL ?? 'http://127.0.0.1:4000';

    try {
      const response = await fetch(`${base}/logs`, { signal: AbortSignal.timeout(2000) });

      if (!response.ok) {
        return [];
      }

      const text = await response.text();
      return text
        .split('\n')
        .map((line) => line.replace(/^- /, '').trim())
        .filter((line) => line.length > 0 && line !== 'No logs yet.')
        .map((line) => {
          const timed = /^(\d{4}-\d{2}-\d{2}T\S+)\s+(.*)$/.exec(line);
          if (!timed) {
            return {
              at: `ai:${line}`,
              level: 'info' as const,
              component: 'ai',
              message: line,
            };
          }

          return {
            at: timed[1],
            level: 'info' as const,
            component: 'ai',
            message: timed[2],
          };
        });
    } catch {
      return [];
    }
  }
}
