import { PrismaClient } from '@prisma/client';

export async function seedDatabase(prisma: PrismaClient): Promise<void> {
  await prisma.requestHistory.deleteMany();
  await prisma.request.deleteMany();
  await prisma.user.deleteMany();
  await prisma.requestCategory.deleteMany();
  await prisma.department.deleteMany();

  await prisma.department.createMany({
    data: [
      { departmentId: 'IT', name: 'IT' },
      { departmentId: 'HR', name: 'HR' },
      { departmentId: 'FINANCE', name: 'Finance' },
    ],
  });

  await prisma.requestCategory.createMany({
    data: [
      { categoryId: 'CAT-IT-1', name: 'IT Hardware' },
      { categoryId: 'CAT-HR-1', name: 'Employment Letter' },
      { categoryId: 'CAT-FIN-1', name: 'Work Expense' },
    ],
  });

  await prisma.user.createMany({
    data: [
      {
        userId: 'EMP-1',
        name: 'Nour El Hajj',
        email: 'nour.elhajj@company.local',
        position: 'Employee',
        departmentId: 'IT',
      },
      {
        userId: 'EMP-2',
        name: 'Karim Farah',
        email: 'karim.farah@company.local',
        position: 'Employee',
        departmentId: 'HR',
      },
      {
        userId: 'EMP-3',
        name: 'Rania Daher',
        email: 'rania.daher@company.local',
        position: 'Employee',
        departmentId: 'FINANCE',
      },
      {
        userId: 'DEPT-IT-1',
        name: 'Tarek Salameh',
        email: 'tarek.salameh@company.local',
        position: 'Department Employee',
        departmentId: 'IT',
      },
      {
        userId: 'DEPT-HR-1',
        name: 'Lina Awad',
        email: 'lina.awad@company.local',
        position: 'Department Employee',
        departmentId: 'HR',
      },
      {
        userId: 'DEPT-FIN-1',
        name: 'Fadi Chamoun',
        email: 'fadi.chamoun@company.local',
        position: 'Department Employee',
        departmentId: 'FINANCE',
      },
      {
        userId: 'APPR-1',
        name: 'Hiba Karam',
        email: 'hiba.karam@company.local',
        position: 'Approver',
        departmentId: 'FINANCE',
      },
      {
        userId: 'ADMIN-1',
        name: 'Elie Boustany',
        email: 'elie.boustany@company.local',
        position: 'Administrator',
        departmentId: 'IT',
      },
    ],
  });

  await prisma.request.createMany({
    data: [
      {
        requestId: 'REQ-1001',
        title: 'Laptop keyboard is not working',
        description:
          'Employee cannot type because several laptop keyboard keys are not responding.',
        status: 'Submitted',
        date: '2026-09-10',
        userId: 'EMP-1',
        departmentId: 'IT',
        categoryId: 'CAT-IT-1',
      },
      {
        requestId: 'REQ-1002',
        title: 'Employment letter request',
        description: 'Employee needs an official employment letter for bank paperwork.',
        status: 'Assigned',
        date: '2026-09-10',
        userId: 'EMP-2',
        departmentId: 'HR',
        categoryId: 'CAT-HR-1',
      },
      {
        requestId: 'REQ-1003',
        title: 'Old expense approval',
        description: 'Employee submitted an old work expense approval request.',
        status: 'Closed',
        date: '2026-09-09',
        userId: 'EMP-3',
        departmentId: 'FINANCE',
        categoryId: 'CAT-FIN-1',
      },
    ],
  });

  await prisma.requestHistory.createMany({
    data: [
      {
        historyId: 'HIST-REQ-1001-1',
        requestId: 'REQ-1001',
        status: 'Submitted',
        updatedDate: '2026-09-10T09:00:00.000Z',
      },
      {
        historyId: 'HIST-REQ-1002-1',
        requestId: 'REQ-1002',
        status: 'Submitted',
        updatedDate: '2026-09-10T09:00:00.000Z',
      },
      {
        historyId: 'HIST-REQ-1002-2',
        requestId: 'REQ-1002',
        status: 'Assigned',
        updatedDate: '2026-09-10T09:20:00.000Z',
      },
      {
        historyId: 'HIST-REQ-1003-1',
        requestId: 'REQ-1003',
        status: 'Submitted',
        updatedDate: '2026-09-09T09:00:00.000Z',
      },
      {
        historyId: 'HIST-REQ-1003-2',
        requestId: 'REQ-1003',
        status: 'Closed',
        updatedDate: '2026-09-09T11:00:00.000Z',
      },
    ],
  });
}
