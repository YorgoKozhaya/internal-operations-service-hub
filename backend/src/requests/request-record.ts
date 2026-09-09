import { RequestStatus } from './request-status';

export interface RequestHistoryRecord {
  historyId: string;
  requestId: string;
  status: RequestStatus;
  updatedDate: string;
}

export interface RequestRecord {
  requestId: string;
  title: string;
  description: string;
  status: RequestStatus;
  date: string;
  userId: string;
  departmentId: string;
  categoryId: string;
  history: RequestHistoryRecord[];
}
