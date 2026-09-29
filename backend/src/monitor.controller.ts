import { Controller, ForbiddenException, Get, Headers, Res } from '@nestjs/common';
import { beginLive, healthTick, LiveResponse, logLine, sleep } from './live-check';
import { LogsService } from './logs.service';
import { PrismaService } from './prisma/prisma.service';
import { StatusService } from './status.service';

interface TextResponse {
  status(code: number): TextResponse;
  type(value: string): TextResponse;
  send(body: string): void;
}

@Controller()
export class MonitorController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logs: LogsService,
    private readonly status: StatusService,
  ) {}

  @Get('logs')
  async listLogs(
    @Headers('x-user-id') userId: string | undefined,
    @Res() response: TextResponse,
  ): Promise<void> {
    await this.requireAdministrator(userId);
    const entries = await this.status.collectedLogs();
    response
      .status(200)
      .type('text/plain')
      .send(this.status.bullets(entries.map((entry) => `${entry.component}: ${entry.message}`)));
  }

  @Get('monitor')
  async monitor(
    @Headers('x-user-id') userId: string | undefined,
    @Res() response: TextResponse,
  ): Promise<void> {
    await this.requireAdministrator(userId);
    const check = await this.status.components();
    this.logs.recordChange('monitor', `${check.backend}. ${check.ai}.`);

    const entries = await this.status.collectedLogs();
    const lines = [
      check.backend,
      check.ai,
      ...entries.map((entry) => `${entry.component}: ${entry.message}`),
    ];

    response.status(check.ok ? 200 : 503).type('text/plain').send(this.status.bullets(lines));
  }

  @Get('logs/watch')
  async watchLogs(
    @Headers('x-user-id') userId: string | undefined,
    @Res() response: LiveResponse,
  ): Promise<void> {
    await this.requireAdministrator(userId);
    const live = beginLive(response);
    void this.follow(response, live.stopped, false);
  }

  @Get('monitor/watch')
  async watchMonitor(
    @Headers('x-user-id') userId: string | undefined,
    @Res() response: LiveResponse,
  ): Promise<void> {
    await this.requireAdministrator(userId);
    const live = beginLive(response);
    void this.follow(response, live.stopped, true);
  }

  private async follow(
    response: LiveResponse,
    stopped: () => boolean,
    includeHealth: boolean,
  ): Promise<void> {
    const seen = new Set<string>();
    let primed = !includeHealth;

    while (!stopped()) {
      try {
        if (includeHealth) {
          const check = await this.status.components();
          if (stopped()) {
            return;
          }
          response.write(`${healthTick(check)}\n`);
        }

        const entries = await this.status.collectedLogs();
        if (stopped()) {
          return;
        }

        for (const entry of entries) {
          const key = `${entry.component}|${entry.at}|${entry.message}`;
          if (seen.has(key)) {
            continue;
          }
          seen.add(key);
          if (!primed) {
            continue;
          }
          response.write(`${logLine(entry)}\n`);
        }
        primed = true;
      } catch {
        if (includeHealth && !stopped()) {
          response.write('health problem\n');
        }
      }

      await sleep(1000, stopped);
    }
  }

  private async requireAdministrator(userId: string | undefined): Promise<void> {
    const actor = userId
      ? await this.prisma.user.findUnique({ where: { userId } })
      : null;

    if (!actor || actor.position !== 'Administrator') {
      throw new ForbiddenException('Only an administrator can view the monitor.');
    }
  }
}
