import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { MailerService } from '../src/mail/mailer.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { seedDatabase } from '../src/prisma/seed-database';

describe('status email', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const sent: Array<{ to: string; status: string }> = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MailerService)
      .useValue({
        sendStatusEmail: async (to: string, _requestId: string, _title: string, status: string) => {
          sent.push({ to, status });
        },
      })
      .compile();

    app = moduleRef.createNestApplication();
    prisma = app.get(PrismaService);
    await app.init();
  });

  beforeEach(async () => {
    sent.length = 0;
    await seedDatabase(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  it('leaves existing requests without email and stores the choice only when asked', async () => {
    const existing = await prisma.request.findMany();
    expect(existing.every((row) => row.emailUpdates === false)).toBe(true);

    const yorgo = await prisma.user.findUnique({ where: { userId: 'EMP-4' } });
    expect(yorgo?.email).toBe('yorgokozhaya1111@gmail.com');

    const plain = await request(app.getHttpServer())
      .post('/requests')
      .set('x-user-id', 'EMP-4')
      .send({
        title: 'Desk lamp',
        description: 'The lamp on my desk is out.',
        categoryId: 'CAT-IT-1',
      })
      .expect(201);

    expect(plain.body.emailUpdates).toBe(false);
    expect(sent).toEqual([]);

    const optedIn = await request(app.getHttpServer())
      .post('/requests')
      .set('x-user-id', 'EMP-4')
      .send({
        title: 'New monitor',
        description: 'The screen stays black.',
        categoryId: 'CAT-IT-1',
        emailUpdates: true,
      })
      .expect(201);

    expect(optedIn.body.emailUpdates).toBe(true);
    expect(sent).toEqual([{ to: 'yorgokozhaya1111@gmail.com', status: 'Submitted' }]);

    await request(app.getHttpServer())
      .patch(`/requests/${optedIn.body.requestId}/status`)
      .set('x-user-id', 'DEPT-IT-1')
      .send({ status: 'Assigned' })
      .expect(200);

    expect(sent).toEqual([
      { to: 'yorgokozhaya1111@gmail.com', status: 'Submitted' },
      { to: 'yorgokozhaya1111@gmail.com', status: 'Assigned' },
    ]);

    await request(app.getHttpServer())
      .post(`/requests/${optedIn.body.requestId}/comments`)
      .set('x-user-id', 'DEPT-IT-1')
      .send({ message: 'A monitor is on the way.' })
      .expect(201);

    expect(sent).toHaveLength(2);

    await request(app.getHttpServer())
      .patch('/requests/REQ-1001/status')
      .set('x-user-id', 'DEPT-IT-1')
      .send({ status: 'Assigned' })
      .expect(200);

    expect(sent).toHaveLength(2);
  });
});
