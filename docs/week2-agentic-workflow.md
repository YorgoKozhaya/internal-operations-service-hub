# Week 2 Agentic Workflow

## 1. Week 1 Sources Used

The Week 2 backend behavior is based on the Week 1 planning documents:

- `docs/product-spec.md`
- `docs/architecture.md`
- `docs/data-model.md`
- `docs/decisions/ADR-001.md`

The most important Week 1 source for this milestone is `docs/data-model.md`, because it defines the request lifecycle states and invariants.

## 2. Bounded Task

The selected bounded backend behavior is:

```text
Change the status of an internal request.
```

This task was chosen because request status tracking is one of the core behaviors of the Internal Operations Service Hub.

## 3. States Used

The backend uses these request statuses from the Week 1 data model:

- Submitted
- Assigned
- In Progress
- Waiting for Approval
- Approved
- Rejected
- Resolved
- Closed

The status list and transition rules are implemented in:

```text
backend/src/requests/request-status.ts
```

The dummy request data is separated into:

```text
backend/src/requests/request.data.ts
```

## 4. Transition Rules

The implementation allows only specific transitions:

- Submitted -> Assigned
- Assigned -> In Progress
- In Progress -> Waiting for Approval
- In Progress -> Resolved
- Waiting for Approval -> Approved
- Waiting for Approval -> Rejected
- Approved -> Resolved
- Rejected -> Closed
- Resolved -> Closed

The `Closed` status is final and cannot move to another status.

## 5. Invariant

The implemented invariant is:

```text
A request must always have one valid current status.
```

The backend rejects unknown statuses such as `Not A Real Status`.

## 6. Implementation Area

The implementation is inside the `backend` folder:

- `backend/src/requests/request.data.ts`
- `backend/src/requests/request-status.ts`
- `backend/src/requests/request-record.ts`
- `backend/src/requests/requests.service.ts`
- `backend/src/requests/requests.controller.ts`

The main endpoint is:

```text
PATCH /requests/:id/status
```

There is also a demo-only reset endpoint used before Postman testing:

```text
POST /requests/demo/reset
```

## 7. Valid Cases

Postman testing proves these valid cases:

- `REQ-1001`: Submitted -> Assigned
- `REQ-1002`: Assigned -> In Progress

## 8. Invalid Cases

Postman testing proves these invalid cases:

- `REQ-1001`: Assigned -> Resolved
- `REQ-1003`: Closed -> In Progress
- `REQ-1002`: In Progress -> Not A Real Status

## 9. Non-Goals

The Week 2 milestone does not include:

- frontend
- real database
- authentication
- authorization
- email notifications
- full test suite
- full request management system

These are intentionally left out so the milestone stays focused on one backend behavior.

## 10. Run and Test with Postman

Go to the backend folder:

```bash
cd backend
```

Install dependencies:

```bash
npm install
```

Start the backend:

```bash
npm run start:dev
```

Use Postman to test the API and take screenshots as evidence.

Base URL:

```text
http://localhost:3000
```

Reset the in-memory dummy data before testing:

```text
POST /requests/demo/reset
```

View a request:

```text
GET /requests/REQ-1001
```

Approved path using `REQ-1001`:

```text
PATCH /requests/REQ-1001/status
```

Send these statuses one at a time:

- Assigned
- In Progress
- Waiting for Approval
- Approved
- Resolved
- Closed

Rejected path using `REQ-1002`:

```text
PATCH /requests/REQ-1002/status
```

Send these statuses one at a time:

- In Progress
- Waiting for Approval
- Rejected
- Closed

Invalid transition example:

```text
PATCH /requests/REQ-1003/status
```

```json
{ "status": "In Progress" }
```

Expected result:

```text
400 Bad Request
```

Expected result:

```text
Valid transitions return 200 OK.
Invalid transitions return 400 Bad Request.
```
