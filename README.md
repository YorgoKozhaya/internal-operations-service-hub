# Internal Operations Service Hub

## 1- About the Project

This project is part of the academy work, where each student develops the project step by step throughout the academy.

The project started with planning and design documents. In Week 2, the project adds a small NestJS backend behavior for request status transitions.

The current work focuses on:

- Product specification
- Architecture
- Data model
- Architecture decisions
- System flows
- One bounded backend behavior

## 2- Project Idea

The project is an Internal Operations Service Hub.

The system is designed to help employees submit and track internal company requests such as:

- Laptop or IT problems
- Software access requests
- Employment letter requests
- Work expense approvals

The goal is to have one place where employees can submit requests, follow their status, and have them handled by the responsible department.

## 3- Week 2 Backend Behavior

The Week 2 implementation focuses only on changing the status of an internal request.

Implemented request statuses:

- Submitted
- Assigned
- In Progress
- Waiting for Approval
- Approved
- Rejected
- Resolved
- Closed

Main endpoint:

```text
PATCH /requests/:id/status
```

Example request body:

```json
{
  "status": "Assigned"
}
```

The backend uses in-memory data for this milestone. There is no real database, authentication, frontend, or full test suite yet.

## 4- Project Structure

The root of the project is kept simple:

```text
backend/
docs/
figures/
README.md
```

The backend code is inside `backend/src`:

```text
backend/
├── package.json
├── package-lock.json
├── tsconfig.json
└── src/
    ├── app.module.ts
    ├── main.ts
    └── requests/
        ├── request.data.ts
        ├── request-record.ts
        ├── request-status.ts
        ├── requests.controller.ts
        ├── requests.module.ts
        └── requests.service.ts
```

The request status rules are in:

```text
backend/src/requests/request-status.ts
```

The dummy request data is in:

```text
backend/src/requests/request.data.ts
```

## 5- Run Instructions

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

The API runs on:

```text
http://localhost:3000
```

## 6- Week 2 Testing

For Week 2, the backend can be tested through Postman by changing request statuses.

Main endpoint:

```text
PATCH http://localhost:3000/requests/:id/status
```

Example body:

```json
{
  "status": "Assigned"
}
```

The Postman tests should show:

- valid status transitions succeed
- invalid status transitions return `400 Bad Request`
- invalid status names return `400 Bad Request`
- request history is updated when the status changes

The full Postman testing steps and screenshot plan are explained in:

```text
docs/week2-agentic-workflow.md
```

## 7- Clone Repository

```bash
git clone https://github.com/YorgoKozhaya/internal-operations-service-hub.git
```
