import { RequestRecord } from './request-record';

export function createInitialRequests(): Map<string, RequestRecord> {
  return new Map<string, RequestRecord>([
    [
      'REQ-1001',
      {
        requestId: 'REQ-1001',
        title: 'Laptop keyboard is not working',
        description: 'Employee cannot type because several laptop keyboard keys are not responding.',
        status: 'Submitted',
        date: '2026-09-10',
        userId: 'EMP-1',
        departmentId: 'IT',
        categoryId: 'CAT-IT-1',
        history: [],
      },
    ],
    [
      'REQ-1002',
      {
        requestId: 'REQ-1002',
        title: 'Employment letter request',
        description: 'Employee needs an official employment letter for bank paperwork.',
        status: 'Assigned',
        date: '2026-09-10',
        userId: 'EMP-2',
        departmentId: 'HR',
        categoryId: 'CAT-HR-1',
        history: [],
      },
    ],
    [
      'REQ-1003',
      {
        requestId: 'REQ-1003',
        title: 'Old expense approval',
        description: 'Employee submitted an old work expense approval request.',
        status: 'Closed',
        date: '2026-09-09',
        userId: 'EMP-3',
        departmentId: 'FINANCE',
        categoryId: 'CAT-FIN-1',
        history: [],
      },
    ],
  ]);
}
