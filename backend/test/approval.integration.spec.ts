import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { seedDatabase } from '../src/prisma/seed-database';

describe('approval check and administrator users', () => {
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

  it('lists several categories in IT, HR, and Finance', async () => {
    const response = await request(app.getHttpServer())
      .get('/categories')
      .set('x-user-id', 'EMP-1')
      .expect(200);

    const categories = response.body as Array<{ categoryId: string; departmentId: string }>;
    const ids = categories.map((category) => category.categoryId);

    expect(ids).toEqual(
      expect.arrayContaining(['CAT-IT-1', 'CAT-IT-2', 'CAT-HR-2', 'CAT-FIN-2', 'CAT-FIN-3']),
    );
    expect(new Set(categories.map((category) => category.departmentId))).toEqual(
      new Set(['IT', 'HR', 'FINANCE']),
    );
    expect(categories.length).toBeGreaterThan(3);
  });

  it('routes a category by its department', async () => {
    const response = await request(app.getHttpServer())
      .post('/requests')
      .set('x-user-id', 'EMP-2')
      .send({
        title: 'Annual leave',
        description: 'I need leave next month.',
        categoryId: 'CAT-HR-2',
      })
      .expect(201);

    expect(response.body.departmentId).toBe('HR');
    expect(response.body.categoryId).toBe('CAT-HR-2');
  });

  it('lets only an administrator add a user', async () => {
    await request(app.getHttpServer())
      .post('/users')
      .set('x-user-id', 'EMP-1')
      .send({
        userId: 'EMP-9',
        name: 'Sara Khoury',
        email: 'sara.khoury@company.local',
        position: 'Employee',
        departmentId: 'HR',
      })
      .expect(403);

    const response = await request(app.getHttpServer())
      .post('/users')
      .set('x-user-id', 'ADMIN-1')
      .send({
        userId: 'EMP-9',
        name: 'Sara Khoury',
        email: 'sara.khoury@company.local',
        position: 'Employee',
        departmentId: 'HR',
      })
      .expect(201);

    expect(response.body.position).toBe('Employee');
    expect(response.body.departmentId).toBe('HR');

    const saved = await prisma.user.findUnique({ where: { userId: 'EMP-9' } });
    expect(saved?.name).toBe('Sara Khoury');
  });

  it('lets HR send a request for approval and only that approver decides', async () => {
    await move(app, 'REQ-1002', 'DEPT-HR-1', 'In Progress');
    const waiting = await move(app, 'REQ-1002', 'DEPT-HR-1', 'Waiting for Approval', 'APPR-HR-1');

    expect(waiting.status).toBe(200);
    expect(waiting.body.approvals).toEqual([
      expect.objectContaining({
        approverId: 'APPR-HR-1',
        decision: null,
        decisionDate: null,
      }),
    ]);

    await request(app.getHttpServer())
      .patch('/requests/REQ-1002/status')
      .set('x-user-id', 'DEPT-HR-1')
      .send({ status: 'Approved' })
      .expect(403);

    await request(app.getHttpServer())
      .patch('/requests/REQ-1002/status')
      .set('x-user-id', 'APPR-IT-1')
      .send({ status: 'Approved' })
      .expect(403);

    const approved = await move(app, 'REQ-1002', 'APPR-HR-1', 'Approved');
    expect(approved.status).toBe(200);
    expect(approved.body.status).toBe('Approved');
    expect(approved.body.approvals[0].decision).toBe('Approved');
    expect(approved.body.approvals[0].decisionDate).toEqual(expect.any(String));

    const stored = await prisma.approval.findFirst({ where: { requestId: 'REQ-1002' } });
    expect(stored?.decision).toBe('Approved');
    expect(stored?.approverId).toBe('APPR-HR-1');
  });

  it('lets Finance skip approval after the same check', async () => {
    const created = await request(app.getHttpServer())
      .post('/requests')
      .set('x-user-id', 'EMP-3')
      .send({
        title: 'Team budget',
        description: 'Need a budget for the offsite.',
        categoryId: 'CAT-FIN-3',
      })
      .expect(201);

    const requestId = created.body.requestId as string;
    await move(app, requestId, 'DEPT-FIN-1', 'Assigned');
    await move(app, requestId, 'DEPT-FIN-1', 'In Progress');
    const resolved = await move(app, requestId, 'DEPT-FIN-1', 'Resolved');

    expect(resolved.status).toBe(200);
    expect(resolved.body.status).toBe('Resolved');
    expect(resolved.body.approvals).toEqual([]);
    expect(await prisma.approval.count({ where: { requestId } })).toBe(0);
  });

  it('lets an administrator-created IT approver decide an IT request', async () => {
    await request(app.getHttpServer())
      .post('/users')
      .set('x-user-id', 'ADMIN-1')
      .send({
        userId: 'APPR-IT-2',
        name: 'Jad Mansour',
        email: 'jad.mansour@company.local',
        position: 'Approver',
        departmentId: 'IT',
      })
      .expect(201);

    const created = await request(app.getHttpServer())
      .post('/requests')
      .set('x-user-id', 'EMP-1')
      .send({
        title: 'VPN account',
        description: 'Need access to the internal network.',
        categoryId: 'CAT-IT-2',
      })
      .expect(201);

    const requestId = created.body.requestId as string;
    expect(created.body.departmentId).toBe('IT');

    await move(app, requestId, 'DEPT-IT-1', 'Assigned');
    await move(app, requestId, 'DEPT-IT-1', 'In Progress');
    await move(app, requestId, 'DEPT-IT-1', 'Waiting for Approval', 'APPR-IT-2');

    const approved = await move(app, requestId, 'APPR-IT-2', 'Approved');
    expect(approved.status).toBe(200);
    expect(approved.body.approvals[0].approverId).toBe('APPR-IT-2');
    expect(approved.body.approvals[0].decision).toBe('Approved');
  });

  it('requires an approver from the responsible department', async () => {
    await move(app, 'REQ-1001', 'DEPT-IT-1', 'Assigned');
    await move(app, 'REQ-1001', 'DEPT-IT-1', 'In Progress');

    await request(app.getHttpServer())
      .patch('/requests/REQ-1001/status')
      .set('x-user-id', 'DEPT-IT-1')
      .send({ status: 'Waiting for Approval' })
      .expect(400);

    await request(app.getHttpServer())
      .patch('/requests/REQ-1001/status')
      .set('x-user-id', 'DEPT-IT-1')
      .send({ status: 'Waiting for Approval', approverId: 'APPR-HR-1' })
      .expect(400);
  });

  it('stops the person who submitted a request from updating it', async () => {
    await request(app.getHttpServer())
      .post('/users')
      .set('x-user-id', 'ADMIN-1')
      .send({
        userId: 'DEPT-IT-2',
        name: 'Nada Khoury',
        email: 'nada.khoury@company.local',
        position: 'Department Employee',
        departmentId: 'IT',
      })
      .expect(201);

    const created = await request(app.getHttpServer())
      .post('/requests')
      .set('x-user-id', 'DEPT-IT-1')
      .send({
        title: 'New monitor',
        description: 'The screen keeps turning off.',
        categoryId: 'CAT-IT-1',
      })
      .expect(201);

    const requestId = created.body.requestId as string;

    const ownUpdate = await request(app.getHttpServer())
      .patch(`/requests/${requestId}/status`)
      .set('x-user-id', 'DEPT-IT-1')
      .send({ status: 'Assigned' })
      .expect(403);

    expect(ownUpdate.body.message).toBe('You submitted this request, so someone else updates it.');

    await request(app.getHttpServer())
      .post(`/requests/${requestId}/comments`)
      .set('x-user-id', 'DEPT-IT-1')
      .send({ message: 'I will handle this myself.' })
      .expect(403);

    const updated = await move(app, requestId, 'DEPT-IT-2', 'Assigned');
    expect(updated.status).toBe(200);
    expect(updated.body.status).toBe('Assigned');

    const approverRequest = await request(app.getHttpServer())
      .post('/requests')
      .set('x-user-id', 'APPR-IT-1')
      .send({
        title: 'Spare keyboard',
        description: 'I need one for my desk.',
        categoryId: 'CAT-IT-1',
      })
      .expect(201);

    const approverRequestId = approverRequest.body.requestId as string;
    await move(app, approverRequestId, 'DEPT-IT-2', 'Assigned');
    await move(app, approverRequestId, 'DEPT-IT-2', 'In Progress');

    const selfApproval = await request(app.getHttpServer())
      .patch(`/requests/${approverRequestId}/status`)
      .set('x-user-id', 'DEPT-IT-2')
      .send({ status: 'Waiting for Approval', approverId: 'APPR-IT-1' })
      .expect(400);

    expect(selfApproval.body.message).toBe('The person who submitted the request cannot approve it.');
  });

  it('lets an administrator open a request from another department', async () => {
    await request(app.getHttpServer())
      .get('/requests/REQ-1002')
      .set('x-user-id', 'ADMIN-1')
      .expect(200);
  });
});

async function move(
  app: INestApplication,
  requestId: string,
  userId: string,
  status: string,
  approverId?: string,
) {
  return request(app.getHttpServer())
    .patch(`/requests/${requestId}/status`)
    .set('x-user-id', userId)
    .send(approverId ? { status, approverId } : { status });
}
