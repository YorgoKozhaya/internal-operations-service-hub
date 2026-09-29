import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { seedDatabase } from '../src/prisma/seed-database';

describe('request lists and notices', () => {
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

  it('lists only the requests an employee submitted', async () => {
    const response = await request(app.getHttpServer())
      .get('/requests')
      .set('x-user-id', 'EMP-1')
      .expect(200);

    expect(response.body.map((item: { requestId: string }) => item.requestId)).toEqual(['REQ-1001']);
  });

  it('lists a department and can filter those requests by status', async () => {
    const all = await request(app.getHttpServer())
      .get('/requests')
      .set('x-user-id', 'DEPT-IT-1')
      .expect(200);

    expect(all.body.map((item: { requestId: string }) => item.requestId)).toEqual(['REQ-1001']);

    const submitted = await request(app.getHttpServer())
      .get('/requests')
      .query({ status: 'Submitted' })
      .set('x-user-id', 'DEPT-IT-1')
      .expect(200);

    expect(submitted.body).toHaveLength(1);
    expect(submitted.body[0].status).toBe('Submitted');

    const closed = await request(app.getHttpServer())
      .get('/requests')
      .query({ status: 'Closed' })
      .set('x-user-id', 'DEPT-IT-1')
      .expect(200);

    expect(closed.body).toEqual([]);
  });

  it('lists requests waiting for the assigned approver', async () => {
    await request(app.getHttpServer())
      .patch('/requests/REQ-1001/status')
      .set('x-user-id', 'DEPT-IT-1')
      .send({ status: 'Assigned' })
      .expect(200);

    await request(app.getHttpServer())
      .patch('/requests/REQ-1001/status')
      .set('x-user-id', 'DEPT-IT-1')
      .send({ status: 'In Progress' })
      .expect(200);

    await request(app.getHttpServer())
      .patch('/requests/REQ-1001/status')
      .set('x-user-id', 'DEPT-IT-1')
      .send({ status: 'Waiting for Approval', approverId: 'APPR-IT-1' })
      .expect(200);

    const waiting = await request(app.getHttpServer())
      .get('/requests')
      .set('x-user-id', 'APPR-IT-1')
      .expect(200);

    expect(waiting.body.map((item: { requestId: string }) => item.requestId)).toEqual(['REQ-1001']);

    const otherApprover = await request(app.getHttpServer())
      .get('/requests')
      .set('x-user-id', 'APPR-HR-1')
      .expect(200);

    expect(otherApprover.body).toEqual([]);
  });

  it('returns the history of one request', async () => {
    const response = await request(app.getHttpServer())
      .get('/requests/REQ-1002')
      .set('x-user-id', 'EMP-2')
      .expect(200);

    expect(response.body.history.map((entry: { status: string }) => entry.status)).toEqual([
      'Submitted',
      'Assigned',
    ]);
  });

  it('notifies the department when a request is submitted and the employee when status changes', async () => {
    const created = await request(app.getHttpServer())
      .post('/requests')
      .set('x-user-id', 'EMP-2')
      .send({
        title: 'Annual leave',
        description: 'I need leave next month.',
        categoryId: 'CAT-HR-2',
      })
      .expect(201);

    const requestId = created.body.requestId as string;
    const staffNotices = await request(app.getHttpServer())
      .get('/notifications')
      .set('x-user-id', 'DEPT-HR-1')
      .expect(200);

    expect(staffNotices.body[0].message).toContain(requestId);
    expect(staffNotices.body[0].read).toBe(false);

    const submitterNotices = await request(app.getHttpServer())
      .get('/notifications')
      .set('x-user-id', 'EMP-2')
      .expect(200);

    expect(submitterNotices.body).toEqual([]);

    await request(app.getHttpServer())
      .patch(`/requests/${requestId}/status`)
      .set('x-user-id', 'DEPT-HR-1')
      .send({ status: 'Assigned' })
      .expect(200);

    const afterAssign = await request(app.getHttpServer())
      .get('/notifications')
      .set('x-user-id', 'EMP-2')
      .expect(200);

    expect(afterAssign.body[0].message).toContain('is now Assigned');

    const staffAfterOwnChange = await request(app.getHttpServer())
      .get('/notifications')
      .set('x-user-id', 'DEPT-HR-1')
      .expect(200);

    expect(staffAfterOwnChange.body.every((notice: { message: string }) => !notice.message.includes('is now Assigned'))).toBe(
      true,
    );
  });

  it('notifies the approver, then the department, and marks a notice read', async () => {
    await request(app.getHttpServer())
      .patch('/requests/REQ-1002/status')
      .set('x-user-id', 'DEPT-HR-1')
      .send({ status: 'In Progress' })
      .expect(200);

    await request(app.getHttpServer())
      .patch('/requests/REQ-1002/status')
      .set('x-user-id', 'DEPT-HR-1')
      .send({ status: 'Waiting for Approval', approverId: 'APPR-HR-1' })
      .expect(200);

    const approverNotices = await request(app.getHttpServer())
      .get('/notifications')
      .set('x-user-id', 'APPR-HR-1')
      .expect(200);

    expect(approverNotices.body[0].message).toContain('waiting for your approval');

    await request(app.getHttpServer())
      .patch('/requests/REQ-1002/status')
      .set('x-user-id', 'APPR-HR-1')
      .send({ status: 'Approved' })
      .expect(200);

    const staffNotices = await request(app.getHttpServer())
      .get('/notifications')
      .set('x-user-id', 'DEPT-HR-1')
      .expect(200);

    expect(staffNotices.body[0].message).toContain('You can resolve it');

    const read = await request(app.getHttpServer())
      .patch(`/notifications/${staffNotices.body[0].notificationId}/read`)
      .set('x-user-id', 'DEPT-HR-1')
      .expect(200);

    expect(read.body.read).toBe(true);

    await request(app.getHttpServer())
      .patch(`/notifications/${staffNotices.body[0].notificationId}/read`)
      .set('x-user-id', 'EMP-2')
      .expect(403);
  });

  it('lets an administrator see workflow without title, category, or comments', async () => {
    await request(app.getHttpServer())
      .post('/requests/REQ-1001/comments')
      .set('x-user-id', 'DEPT-IT-1')
      .send({ message: 'A replacement keyboard is on the way.' })
      .expect(201);

    const list = await request(app.getHttpServer())
      .get('/requests')
      .set('x-user-id', 'ADMIN-1')
      .expect(200);

    expect(list.body.map((item: { requestId: string }) => item.requestId)).toEqual([
      'REQ-1001',
      'REQ-1002',
      'REQ-1003',
    ]);
    expect(list.body.every((item: { title: string; categoryId: string; status: string }) => item.title === '' && item.categoryId === '' && item.status)).toBe(true);

    const hidden = await request(app.getHttpServer())
      .get('/requests/REQ-1001')
      .set('x-user-id', 'ADMIN-1')
      .expect(200);

    expect(hidden.body.title).toBe('');
    expect(hidden.body.description).toBe('');
    expect(hidden.body.categoryId).toBe('');
    expect(hidden.body.comments).toEqual([]);
    expect(hidden.body.status).toBe('Submitted');
    expect(hidden.body.departmentId).toBe('IT');
    expect(hidden.body.history.map((entry: { status: string }) => entry.status)).toEqual(['Submitted']);

    const visible = await request(app.getHttpServer())
      .get('/requests/REQ-1001')
      .set('x-user-id', 'EMP-1')
      .expect(200);

    expect(visible.body.title).toBe('Laptop keyboard is not working');
    expect(visible.body.comments[0].message).toBe('A replacement keyboard is on the way.');
  });
});
