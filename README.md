# Internal Operations Service Hub

## 1- About the Project

This project is part of the academy work, where each student develops the project step by step throughout the academy.

The project started with planning and design documents. The current milestone is Week 3: one user-facing service request flow with a React frontend, a NestJS backend, and SQLite persistence using Prisma.

The current work focuses on:

- Product specification
- Architecture
- Data model
- Architecture decisions
- System flows
- One integrated service-request flow (Week 3)

## 2- Project Idea

The project is an Internal Operations Service Hub.

The system is designed to help employees submit and track internal company requests such as:

- Laptop or IT problems
- Software access requests
- Employment letter requests
- Work expense approvals

The goal is to have one place where employees can submit requests, follow their status, and have them handled by the responsible department.

## 3- Week 3 in General

Week 3 keeps the same Internal Operations Service Hub repository and adds one narrow user-facing flow:

- an employee submits a service request
- the request is stored in SQLite with Prisma
- the employee can view their own request
- an IT department employee can change the status

The same flow includes authorization (allowed and denied), an invalid create that returns 400, a missing request that returns 404, Jest tests, a Playwright E2E test, and regression tests for the older status-transition behavior.

The full explanation, API contract, and screenshot evidence are in:

```text
docs/week3-full-stack-delivery.md
```

## 4- Project Structure

The root of the project is kept simple:

```text
backend/
frontend/
docs/
figures/
README.md
```

The request status rules are in:

```text
backend/src/requests/request-status.ts
```

The Prisma schema and SQLite file are in:

```text
backend/prisma/schema.prisma
backend/prisma/dev.db
```

The old in-memory dummy data file `backend/src/requests/request.data.ts` was removed. Request data now lives in a real database using Prisma (`backend/prisma/` and the seed in `backend/src/prisma/seed-database.ts`).

## 5- Run the Full App (Week 3)

You need two terminals: backend first, then frontend.

### Backend

```bash
cd backend
npm install
npx prisma db push
npx prisma db seed
npm run start:dev
```

The API runs on:

```text
http://localhost:3000
```

### Frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

The UI runs on:

```text
http://localhost:5173
```

Open the UI in the browser. Keep the backend running. Use **Acting as** to switch between Nour (employee) and Tarek (IT department employee). Submit a request, open it, and let Tarek update the status.

## 6- Automated Tests

Backend (Jest: business rule, SQLite integration, regression):

```bash
cd backend
npm test
```

Frontend (Playwright E2E). First time only:

```bash
cd frontend
npx playwright install chromium
```

Then:

```bash
cd frontend
npm run test:e2e
```

## 7- Clone Repository

```bash
git clone https://github.com/YorgoKozhaya/internal-operations-service-hub.git
```

## 8- Week 2 Backend Behavior

Earlier, Week 2 added only one NestJS behavior: changing the status of an internal request. There was no frontend and no real database yet. Data lived in the in-memory dummy file `backend/src/requests/request.data.ts`. That file was removed in Week 3 when Prisma and SQLite were added. The status list and transition rules were kept.

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

## 9- Week 2 Testing

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
