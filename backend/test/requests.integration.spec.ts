import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { seedDatabase } from '../src/prisma/seed-database';

describe('backend and database integration', () => {
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

  it('saves a created service request in SQLite', async () => {
    const response = await request(app.getHttpServer())
      .post('/requests')
      .set('x-user-id', 'EMP-1')
      .send({
        title: 'Need VPN access',
        description: 'Cannot reach the internal tools.',
        categoryId: 'CAT-IT-1',
      })
      .expect(201);

    const saved = await prisma.request.findUnique({
      where: { requestId: response.body.requestId },
    });

    expect(saved).not.toBeNull();
    expect(saved?.title).toBe('Need VPN access');
    expect(saved?.status).toBe('Submitted');
    expect(saved?.userId).toBe('EMP-1');
  });
});
