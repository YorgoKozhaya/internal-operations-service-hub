import { ALLOWED_TRANSITIONS, isRequestStatus } from './request-status';

describe('request status business rules', () => {
  it('allows Submitted to move to Assigned', () => {
    expect(ALLOWED_TRANSITIONS.Submitted).toContain('Assigned');
  });

  it('does not allow Closed to move to In Progress', () => {
    expect(ALLOWED_TRANSITIONS.Closed).not.toContain('In Progress');
  });

  it('rejects a status name that is not in the lifecycle', () => {
    expect(isRequestStatus('Reopen')).toBe(false);
  });
});
