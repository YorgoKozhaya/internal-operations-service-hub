import { get } from 'node:http';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { healthTick } from '../src/live-check';
import { PrismaService } from '../src/prisma/prisma.service';
import { seedDatabase } from '../src/prisma/seed-database';

describe('health and monitor', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    prisma = app.get(PrismaService);
    await app.init();
  });

  beforeEach(async () => {
    await seedDatabase(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  it('answers live as soon as the process is up', async () => {
    const response = await request(app.getHttpServer()).get('/live');

    expect(response.status).toBe(200);
    expect(response.text).toBe('live\n');
  });

  it('checks the backend and the AI together, one bullet each', async () => {
    const response = await request(app.getHttpServer()).get('/health');

    expect([200, 503]).toContain(response.status);
    expect(response.text).toContain('- Backend up, database up');
    expect(response.text).toMatch(/- AI (up|down)/);
    expect(response.text.trim().split('\n').every((line) => line.startsWith('- '))).toBe(true);
  });

  it('lets only an administrator read logs and the monitor as separate bullets', async () => {
    await request(app.getHttpServer()).get('/monitor').set('x-user-id', 'EMP-1').expect(403);
    await request(app.getHttpServer()).get('/logs').set('x-user-id', 'EMP-1').expect(403);
    await request(app.getHttpServer()).get('/logs/watch').set('x-user-id', 'EMP-1').expect(403);
    await request(app.getHttpServer()).get('/monitor/watch').set('x-user-id', 'EMP-1').expect(403);

    const logs = await request(app.getHttpServer()).get('/logs').set('x-user-id', 'ADMIN-1').expect(200);
    expect(logs.text.trim().split('\n').every((line) => line.startsWith('- '))).toBe(true);

    const monitor = await request(app.getHttpServer()).get('/monitor').set('x-user-id', 'ADMIN-1');
    expect([200, 503]).toContain(monitor.status);
    const lines = monitor.text.trim().split('\n');
    expect(lines.every((line) => line.startsWith('- '))).toBe(true);
    expect(lines[0]).toContain('Backend');
    expect(lines[1]).toContain('AI');
  });

  it('prints ok while both are up, and the problem when one is down', () => {
    expect(healthTick({
      ok: true,
      backend: 'Backend up, database up',
      ai: 'AI up, key configured',
    })).toBe('ok');

    expect(healthTick({
      ok: false,
      backend: 'Backend up, database up',
      ai: 'AI down, service not running',
    })).toBe('AI down, service not running');

    expect(healthTick({
      ok: false,
      backend: 'Backend down, database down',
      ai: 'AI down, service not running',
    })).toBe('Backend down, database down; AI down, service not running');
  });

  it('keeps printing a health line every second', async () => {
    await app.listen(0);
    const address = app.getHttpServer().address() as { port: number };
    const text = await readLines(`http://127.0.0.1:${address.port}/health/watch`, 2);
    const lines = text.trim().split('\n');

    expect(lines).toHaveLength(2);
    for (const line of lines) {
      expect(line === 'ok' || line.includes('down') || line === 'health problem').toBe(true);
    }
  });
});

function readLines(url: string, count: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = get(url, (response) => {
      let body = '';
      response.on('data', (chunk: Buffer) => {
        body += chunk.toString();
        if (body.trim().split('\n').length >= count) {
          req.destroy();
          resolve(body);
        }
      });
    });
    req.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'ECONNRESET') {
        return;
      }
      reject(error);
    });
  });
}
