export const REQUEST_STATUSES = [
  'Submitted',
  'Assigned',
  'In Progress',
  'Waiting for Approval',
  'Approved',
  'Rejected',
  'Resolved',
  'Closed',
] as const;

export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const ALLOWED_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  Submitted: ['Assigned'],
  Assigned: ['In Progress'],
  'In Progress': ['Waiting for Approval', 'Resolved'],
  'Waiting for Approval': ['Approved', 'Rejected'],
  Approved: ['Resolved'],
  Rejected: ['Closed'],
  Resolved: ['Closed'],
  Closed: [],
};

export function isRequestStatus(value: string): value is RequestStatus {
  return REQUEST_STATUSES.includes(value as RequestStatus);
}
