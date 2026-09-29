import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { seedDatabase } from '../src/prisma/seed-database';

describe('comments and administration', () => {
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

  it('lets the responsible department employee add a comment without changing status history', async () => {
    const response = await request(app.getHttpServer())
      .post('/requests/REQ-1001/comments')
      .set('x-user-id', 'DEPT-IT-1')
      .send({ message: 'A replacement keyboard is on the way.' })
      .expect(201);

    expect(response.body.comments).toEqual([
      expect.objectContaining({
        authorName: 'Tarek Salameh',
        message: 'A replacement keyboard is on the way.',
      }),
    ]);
    expect(response.body.history.map((entry: { status: string }) => entry.status)).toEqual(['Submitted']);

    const notice = await prisma.notification.findFirst({
      where: { userId: 'EMP-1', requestId: 'REQ-1001' },
    });
    expect(notice?.message).toContain('has a new comment');
  });

  it('refuses a comment from someone outside the responsible department', async () => {
    await request(app.getHttpServer())
      .post('/requests/REQ-1001/comments')
      .set('x-user-id', 'EMP-1')
      .send({ message: 'Any update?' })
      .expect(403);

    await request(app.getHttpServer())
      .post('/requests/REQ-1001/comments')
      .set('x-user-id', 'DEPT-HR-1')
      .send({ message: 'HR cannot comment on IT.' })
      .expect(403);
  });

  it('lets an administrator add and rename a department and a category', async () => {
    const department = await request(app.getHttpServer())
      .post('/departments')
      .set('x-user-id', 'ADMIN-1')
      .send({ departmentId: 'LEGAL', name: 'Legal' })
      .expect(201);

    expect(department.body).toEqual({ departmentId: 'LEGAL', name: 'Legal' });

    const renamedDepartment = await request(app.getHttpServer())
      .patch('/departments/LEGAL')
      .set('x-user-id', 'ADMIN-1')
      .send({ name: 'Legal Affairs' })
      .expect(200);

    expect(renamedDepartment.body.name).toBe('Legal Affairs');

    const category = await request(app.getHttpServer())
      .post('/categories')
      .set('x-user-id', 'ADMIN-1')
      .send({ categoryId: 'CAT-LEG-1', name: 'Contract review', departmentId: 'LEGAL' })
      .expect(201);

    expect(category.body.departmentId).toBe('LEGAL');

    const renamedCategory = await request(app.getHttpServer())
      .patch('/categories/CAT-LEG-1')
      .set('x-user-id', 'ADMIN-1')
      .send({ name: 'Contract Review' })
      .expect(200);

    expect(renamedCategory.body.name).toBe('Contract Review');
  });

  it('refuses department and category changes from a non-administrator', async () => {
    await request(app.getHttpServer())
      .post('/departments')
      .set('x-user-id', 'EMP-1')
      .send({ departmentId: 'LEGAL', name: 'Legal' })
      .expect(403);

    await request(app.getHttpServer())
      .post('/categories')
      .set('x-user-id', 'DEPT-IT-1')
      .send({ categoryId: 'CAT-IT-9', name: 'Printers', departmentId: 'IT' })
      .expect(403);
  });
});
