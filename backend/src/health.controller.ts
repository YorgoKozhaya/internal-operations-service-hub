import { Controller, Get, Res } from '@nestjs/common';
import { beginLive, healthTick, LiveResponse, sleep } from './live-check';
import { StatusService } from './status.service';

interface TextResponse {
  status(code: number): TextResponse;
  type(value: string): TextResponse;
  send(body: string): void;
}

@Controller()
export class HealthController {
  constructor(private readonly status: StatusService) {}

  @Get('health')
  async health(@Res() response: TextResponse): Promise<void> {
    const check = await this.status.components();
    response
      .status(check.ok ? 200 : 503)
      .type('text/plain')
      .send(this.status.bullets([check.backend, check.ai]));
  }

  @Get('health/watch')
  watch(@Res() response: LiveResponse): void {
    const live = beginLive(response);
    void this.followHealth(response, live.stopped);
  }

  private async followHealth(response: LiveResponse, stopped: () => boolean): Promise<void> {
    while (!stopped()) {
      try {
        const check = await this.status.components();
        if (stopped()) {
          return;
        }
        response.write(`${healthTick(check)}\n`);
      } catch {
        if (!stopped()) {
          response.write('health problem\n');
        }
      }

      await sleep(1000, stopped);
    }
  }
}
