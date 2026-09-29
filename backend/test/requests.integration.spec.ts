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

  it('lets the owning department employee transfer a request to another department', async () => {
    const response = await request(app.getHttpServer())
      .patch('/requests/REQ-1001/department')
      .set('x-user-id', 'DEPT-IT-1')
      .send({ departmentId: 'HR' })
      .expect(200);

    expect(response.body.departmentId).toBe('HR');
    expect(response.body.categoryId).toBe('CAT-HR-OTHER');
    expect(response.body.status).toBe('Submitted');
    expect(response.body.comments.some((comment: { message: string }) => comment.message.includes('Transferred from IT to HR'))).toBe(true);

    await request(app.getHttpServer())
      .get('/requests/REQ-1001')
      .set('x-user-id', 'DEPT-HR-1')
      .expect(200);

    await request(app.getHttpServer())
      .get('/requests/REQ-1001')
      .set('x-user-id', 'DEPT-IT-1')
      .expect(403);
  });

  it('rejects a transfer from the requester or from another department', async () => {
    await request(app.getHttpServer())
      .patch('/requests/REQ-1001/department')
      .set('x-user-id', 'EMP-1')
      .send({ departmentId: 'HR' })
      .expect(403);

    await request(app.getHttpServer())
      .patch('/requests/REQ-1001/department')
      .set('x-user-id', 'DEPT-HR-1')
      .send({ departmentId: 'FINANCE' })
      .expect(403);

    await request(app.getHttpServer())
      .patch('/requests/REQ-1003/department')
      .set('x-user-id', 'DEPT-FIN-1')
      .send({ departmentId: 'IT' })
      .expect(400);
  });
});
