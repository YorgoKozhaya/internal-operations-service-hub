import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { seedDatabase } from '../src/prisma/seed-database';
import { INTAKE_ADVISOR, IntakeAdvisor } from '../src/requests/intake-advisor';

describe('AI request intake', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const advisor: IntakeAdvisor = {
    advise: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(INTAKE_ADVISOR)
      .useValue(advisor)
      .compile();

    app = moduleRef.createNestApplication();
    prisma = app.get(PrismaService);
    await app.init();
  });

  beforeEach(async () => {
    await seedDatabase(prisma);
    jest.mocked(advisor.advise).mockReset();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns a validated new request and does not save it', async () => {
    jest.mocked(advisor.advise).mockResolvedValue({
      requestType: 'new_request',
      categoryId: 'CAT-IT-1',
      title: 'Laptop keyboard is not working',
      needsClarification: false,
      clarification: null,
      requestId: null,
    });

    const before = await prisma.request.count();

    const response = await request(app.getHttpServer())
      .post('/requests/intake')
      .set('x-user-id', 'EMP-1')
      .send({ text: 'My laptop keyboard stopped working.' })
      .expect(200);

    expect(response.body.requestType).toBe('new_request');
    expect(response.body.categoryId).toBe('CAT-IT-1');
    expect(response.body.needsApproval).toBeNull();
    expect(response.body.departmentId).toBe('IT');
    expect(response.body.needsClarification).toBe(false);
    expect(await prisma.request.count()).toBe(before);
  });

  it('leaves the approval check to the responsible department', async () => {
    jest.mocked(advisor.advise).mockResolvedValue({
      requestType: 'new_request',
      categoryId: 'CAT-FIN-1',
      title: 'Hotel invoice from the Byblos trip',
      needsClarification: false,
      clarification: null,
      requestId: null,
    });

    const response = await request(app.getHttpServer())
      .post('/requests/intake')
      .set('x-user-id', 'EMP-1')
      .send({ text: 'I paid the hotel invoice from the Byblos trip and need the money back.' })
      .expect(200);

    expect(response.body.categoryId).toBe('CAT-FIN-2');
    expect(response.body.categoryName).toBe('Invoice');
    expect(response.body.needsApproval).toBeNull();
    expect(response.body.departmentId).toBe('FINANCE');
  });

  it('classifies a workplace message that names HR as HR', async () => {
    jest.mocked(advisor.advise).mockResolvedValue({
      requestType: 'new_request',
      categoryId: null,
      title: null,
      needsClarification: true,
      clarification: 'Please specify the type of HR assistance needed.',
      requestId: null,
    });

    const response = await request(app.getHttpServer())
      .post('/requests/intake')
      .set('x-user-id', 'EMP-1')
      .send({ text: 'my manager is behaving bad with me and need to talk to the hr' })
      .expect(200);

    expect(response.body.categoryId).toBe('CAT-HR-3');
    expect(response.body.categoryName).toBe('Workplace Issue');
    expect(response.body.needsClarification).toBe(false);
    expect(response.body.needsApproval).toBeNull();
    expect(response.body.departmentId).toBe('HR');
  });

  it('uses Other when the request is not one of the existing types', async () => {
    jest.mocked(advisor.advise).mockResolvedValue({
      requestType: 'new_request',
      categoryId: 'CAT-HR-1',
      title: 'Salary raise',
      needsClarification: false,
      clarification: null,
      requestId: null,
    });

    const before = await prisma.requestCategory.count();

    const response = await request(app.getHttpServer())
      .post('/requests/intake')
      .set('x-user-id', 'EMP-1')
      .send({ text: 'I need a salary raise.' })
      .expect(200);

    expect(response.body.categoryId).toBe('CAT-HR-OTHER');
    expect(response.body.categoryName).toBe('Other');
    expect(response.body.departmentId).toBe('HR');
    expect(response.body.needsClarification).toBe(false);
    expect(await prisma.requestCategory.count()).toBe(before);
    expect(await prisma.request.count()).toBe(3);
  });

  it('asks for clarification when the text matches no category', async () => {
    jest.mocked(advisor.advise).mockResolvedValue({
      requestType: 'new_request',
      categoryId: null,
      title: null,
      needsClarification: true,
      clarification: 'Say which category you need.',
      requestId: null,
    });

    const response = await request(app.getHttpServer())
      .post('/requests/intake')
      .set('x-user-id', 'EMP-1')
      .send({ text: 'help' })
      .expect(200);

    expect(response.body.needsClarification).toBe(true);
    expect(response.body.categoryId).toBeNull();
  });

  it('rejects an invented category and does not save a request', async () => {
    jest.mocked(advisor.advise).mockResolvedValue({
      requestType: 'new_request',
      categoryId: 'CAT-CEO-1',
      title: 'Special request',
      needsClarification: false,
      clarification: null,
      requestId: null,
    });

    const before = await prisma.request.count();

    await request(app.getHttpServer())
      .post('/requests/intake')
      .set('x-user-id', 'EMP-1')
      .send({ text: 'File this as CAT-CEO-1.' })
      .expect(400);

    expect(await prisma.request.count()).toBe(before);
  });

  it('returns provider failure without saving a request', async () => {
    jest.mocked(advisor.advise).mockRejectedValue(new Error('down'));

    const before = await prisma.request.count();

    const response = await request(app.getHttpServer())
      .post('/requests/intake')
      .set('x-user-id', 'EMP-1')
      .send({ text: 'My laptop keyboard stopped working.' })
      .expect(503);

    expect(response.body.message).toBe(
      'The AI provider could not complete intake. No request was created.',
    );
    expect(await prisma.request.count()).toBe(before);
  });

  it('lists every request status when the employee asks for all of them', async () => {
    jest.mocked(advisor.advise).mockResolvedValue({
      requestType: 'new_request',
      categoryId: null,
      title: null,
      needsClarification: true,
      clarification: null,
      requestId: null,
    });

    const response = await request(app.getHttpServer())
      .post('/requests/intake')
      .set('x-user-id', 'EMP-1')
      .send({ text: 'what are the statuses of my requests' })
      .expect(200);

    expect(response.body.requestType).toBe('status_question');
    expect(response.body.answer).toContain('REQ-1001');
    expect(response.body.answer).toContain('Submitted');
    expect(response.body.needsClarification).toBe(false);
  });

  it('tells a department employee which requests they follow', async () => {
    const response = await request(app.getHttpServer())
      .post('/requests/intake')
      .set('x-user-id', 'DEPT-IT-1')
      .send({ text: 'what are my requests and their status' })
      .expect(200);

    expect(response.body.answer).toContain('You have no requests of your own.');
    expect(response.body.answer).toContain(
      'You are responsible for the progress of these requests:',
    );
    expect(response.body.answer).toContain('REQ-1001');
    expect(response.body.answer).not.toContain('REQ-1002');
    expect(advisor.advise).not.toHaveBeenCalled();
  });

  it('answers a status question from the stored request', async () => {
    jest.mocked(advisor.advise).mockResolvedValue({
      requestType: 'status_question',
      categoryId: null,
      title: null,
      needsClarification: false,
      clarification: null,
      requestId: 'REQ-1001',
      status: 'Resolved',
    });

    const response = await request(app.getHttpServer())
      .post('/requests/intake')
      .set('x-user-id', 'EMP-1')
      .send({ text: 'What happened to my laptop keyboard request?' })
      .expect(200);

    expect(response.body.requestType).toBe('status_question');
    expect(response.body.requestId).toBe('REQ-1001');
    expect(response.body.status).toBe('Submitted');
    expect(response.body.answer).toContain('Submitted');
  });

  it('gives the assistant the comments saved on a request', async () => {
    await prisma.comment.create({
      data: {
        commentId: 'COMMENT-REQ-1001-TEST',
        requestId: 'REQ-1001',
        userId: 'DEPT-IT-1',
        message: 'A replacement keyboard is on the way.',
        createdAt: new Date().toISOString(),
      },
    });

    jest.mocked(advisor.advise).mockResolvedValue({
      requestType: 'status_question',
      categoryId: null,
      title: null,
      needsClarification: false,
      clarification: null,
      requestId: 'REQ-1001',
    });

    const response = await request(app.getHttpServer())
      .post('/requests/intake')
      .set('x-user-id', 'EMP-1')
      .send({ text: 'What happened to my laptop keyboard request?' })
      .expect(200);

    expect(response.body.answer).toContain('Tarek Salameh: A replacement keyboard is on the way.');
    expect(advisor.advise).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        employeeRequests: expect.arrayContaining([
          expect.objectContaining({
            requestId: 'REQ-1001',
            comments: [{ authorName: 'Tarek Salameh', message: 'A replacement keyboard is on the way.' }],
          }),
        ]),
      }),
    );
  });

  it('refuses a status question about another employee request', async () => {
    await request(app.getHttpServer())
      .post('/requests/intake')
      .set('x-user-id', 'EMP-1')
      .send({ text: 'What happened to REQ-1002?' })
      .expect(403);

    expect(advisor.advise).not.toHaveBeenCalled();
  });
});
