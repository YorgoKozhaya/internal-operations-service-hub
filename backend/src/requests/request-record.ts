import { RequestStatus } from './request-status';

export interface CommentRecord {
  commentId: string;
  requestId: string;
  userId: string;
  authorName: string;
  message: string;
  createdAt: string;
}

export interface RequestHistoryRecord {
  historyId: string;
  requestId: string;
  status: RequestStatus;
  updatedDate: string;
}

export interface ApprovalRecord {
  approvalId: string;
  approverId: string;
  approverName: string;
  requestId: string;
  decision: string | null;
  decisionDate: string | null;
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
  emailUpdates: boolean;
  history: RequestHistoryRecord[];
  comments: CommentRecord[];
  approvals: ApprovalRecord[];
}

export interface RequestSummary {
  requestId: string;
  title: string;
  status: RequestStatus;
  date: string;
  userId: string;
  departmentId: string;
  categoryId: string;
}

export interface CategoryRecord {
  categoryId: string;
  name: string;
  departmentId: string;
}
