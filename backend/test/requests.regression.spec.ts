import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { seedDatabase } from '../src/prisma/seed-database';

describe('week 2 status transition regression', () => {
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

  it('still allows Submitted to Assigned', async () => {
    await request(app.getHttpServer())
      .patch('/requests/REQ-1001/status')
      .set('x-user-id', 'DEPT-IT-1')
      .send({ status: 'Assigned' })
      .expect(200)
      .expect((response) => {
        expect(response.body.status).toBe('Assigned');
      });
  });

  it('still rejects Closed to In Progress', async () => {
    await request(app.getHttpServer())
      .patch('/requests/REQ-1003/status')
      .set('x-user-id', 'DEPT-FIN-1')
      .send({ status: 'In Progress' })
      .expect(400)
      .expect((response) => {
        expect(response.body.message).toContain('Cannot transition request REQ-1003 from Closed to In Progress');
      });
  });

  it('still rejects an unknown status name', async () => {
    await request(app.getHttpServer())
      .patch('/requests/REQ-1002/status')
      .set('x-user-id', 'DEPT-HR-1')
      .send({ status: 'Reopen' })
      .expect(400);
  });

  it('denies an employee from changing status', async () => {
    await request(app.getHttpServer())
      .patch('/requests/REQ-1001/status')
      .set('x-user-id', 'EMP-1')
      .send({ status: 'Assigned' })
      .expect(403);
  });
});
