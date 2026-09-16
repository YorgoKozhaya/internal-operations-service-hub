# Week 3 Full-Stack Delivery

## 1. Purpose

Week 3 turns the Internal Operations Service Hub from a Week 2 API-only status experiment into one narrow, user-facing **service request** flow.

The purpose is not to build the whole product. The purpose is one vertical slice that another engineer can run:

- React frontend
- NestJS backend
- SQLite persistence with Prisma
- an explicit API contract
- one authorization rule (allowed and denied)
- one invalid request rejected on purpose
- one expected failure handled on purpose
- automated tests, including one browser E2E test
- regression so Week 2 status rules still work

Week 1 sources used:

- `docs/product-spec.md`
- `docs/architecture.md`
- `docs/data-model.md`
- `docs/decisions/ADR-001.md`

Week 2 source:

- `docs/week2-agentic-workflow.md`

The data model still owns the entities, attributes, status list, and the rule that employees only see their own requests. Department employees handle requests for their department.

## 2. Bounded User-Facing Flow

The selected flow is:

```text
Employee submits a service request → it is saved in SQLite → they can view it →
an IT department employee can change the status.
```

Demo users:

| ID | Name | Position | Department |
|---|---|---|---|
| EMP-1 | Nour El Hajj | Employee | IT |
| EMP-2 | Karim Farah | Employee | HR |
| DEPT-IT-1 | Tarek Salameh | Department Employee | IT |

Identity for this week is the `x-user-id` header (no JWT, no login page). The React **Acting as** dropdown sets that header.

## 3. Stack

### Frontend

Folder: `frontend/`

Vite + React + TypeScript. One screen:

- submit title, description, category
- view a request by id
- if the current user is the IT department employee for an IT request, update status

The frontend never talks to SQLite. It only calls `http://localhost:3000`.

### Backend

Folder: `backend/`

NestJS. Same request module as Week 2, now using Prisma instead of an in-memory Map.

### Database

ADR-001 chose a relational database. Week 3 uses **SQLite with Prisma**.

- Schema: `backend/prisma/schema.prisma`
- App data: `backend/prisma/dev.db`
- Jest copy: `backend/prisma/test.db`

There is no Prisma migrate folder. Schema changes use:

```bash
npx prisma db push
npx prisma db seed
```

Models follow the ER diagram attributes: User, Department, Request Category, Request, Request History. Approval is not stored yet.

Submitted is the first history row when a request is created.

The first data in the database comes from the seed (`backend/src/prisma/seed-database.ts`). After `npx prisma db seed` or `POST /requests/demo/reset`, SQLite starts with these rows.

#### Department

| Department ID | Name |
|---|---|
| IT | IT |
| HR | HR |
| FINANCE | Finance |

#### Request Category

| Category ID | Name |
|---|---|
| CAT-IT-1 | IT Hardware |
| CAT-HR-1 | Employment Letter |
| CAT-FIN-1 | Work Expense |

#### User

| User ID | Name | Email | Position | Department ID |
|---|---|---|---|---|
| EMP-1 | Nour El Hajj | nour.elhajj@company.local | Employee | IT |
| EMP-2 | Karim Farah | karim.farah@company.local | Employee | HR |
| EMP-3 | Rania Daher | rania.daher@company.local | Employee | FINANCE |
| DEPT-IT-1 | Tarek Salameh | tarek.salameh@company.local | Department Employee | IT |
| DEPT-HR-1 | Lina Awad | lina.awad@company.local | Department Employee | HR |
| DEPT-FIN-1 | Fadi Chamoun | fadi.chamoun@company.local | Department Employee | FINANCE |
| APPR-1 | Hiba Karam | hiba.karam@company.local | Approver | FINANCE |
| ADMIN-1 | Elie Boustany | elie.boustany@company.local | Administrator | IT |

#### Request

| Request ID | Title | Status | Date | User ID | Department ID | Category ID |
|---|---|---|---|---|---|---|
| REQ-1001 | Laptop keyboard is not working | Submitted | 2026-09-10 | EMP-1 | IT | CAT-IT-1 |
| REQ-1002 | Employment letter request | Assigned | 2026-09-10 | EMP-2 | HR | CAT-HR-1 |
| REQ-1003 | Old expense approval | Closed | 2026-09-09 | EMP-3 | FINANCE | CAT-FIN-1 |

#### Request History

| History ID | Request ID | Status | Updated Date |
|---|---|---|---|
| HIST-REQ-1001-1 | REQ-1001 | Submitted | 2026-09-10T09:00:00.000Z |
| HIST-REQ-1002-1 | REQ-1002 | Submitted | 2026-09-10T09:00:00.000Z |
| HIST-REQ-1002-2 | REQ-1002 | Assigned | 2026-09-10T09:20:00.000Z |
| HIST-REQ-1003-1 | REQ-1003 | Submitted | 2026-09-09T09:00:00.000Z |
| HIST-REQ-1003-2 | REQ-1003 | Closed | 2026-09-09T11:00:00.000Z |

## 4. API Contract

Base URL:

```text
http://localhost:3000
```

All of these (except demo reset) need header `x-user-id`.

### Create request

```text
POST /requests
x-user-id: EMP-1
```

```json
{
  "title": "Need VPN access",
  "description": "Cannot reach the internal tools.",
  "categoryId": "CAT-IT-1"
}
```

Success: **201**. Status is `Submitted`. `userId` comes from the header. Department is derived from the category (`CAT-IT-1` → IT). History contains Submitted and `updatedDate`.

Empty title: **400** `Title is required.`

### Get request

```text
GET /requests/:id
x-user-id: EMP-1
```

- Owner, or department employee of that department: **200**
- Another employee: **403** `You are not allowed to view this request.`
- Missing header: **400**
- Unknown id: **404** `Request REQ-9999 was not found.`

### Change status (Week 2, now authorized)

```text
PATCH /requests/:id/status
x-user-id: DEPT-IT-1
```

```json
{ "status": "Assigned" }
```

Only a **Department Employee** whose `departmentId` matches the request can change status. An employee gets **403**. Illegal transitions still return **400** (Week 2 rule).

### Demo reset

```text
POST /requests/demo/reset
```

Reloads seed data in `dev.db`.

## 5. Authorization, Invalid Input, and Handled Failure

These three are different on purpose.

### Authorization

Rule: an employee can view only their own request. A department employee can view (and update) requests in their department.

- Allowed: `GET /requests/REQ-1001` as `EMP-1` → **200**
- Denied: `GET /requests/REQ-1001` as `EMP-2` → **403**

Status change: Tarek (`DEPT-IT-1`) may assign an IT request. Nour (`EMP-1`) may not.

Allowed:
Header: x-user-id = EMP-1

![Authorization allowed](/figures/week3_auth_allowed.png)

Denied:
Same URL. Header: x-user-id = EMP-2

![Authorization denied](/figures/week3_auth_denied.png)

### Invalid request rejected on purpose

Malformed create: empty title.

```text
POST /requests
x-user-id: EMP-1
```

```json
{
  "title": "",
  "description": "Missing title on purpose.",
  "categoryId": "CAT-IT-1"
}
```

**400** `Title is required.` Nothing is inserted.

![Invalid request](/figures/week3_invalid_title.png)

### Expected failure handled on purpose

Well-formed get for a request that does not exist:

```text
GET /requests/REQ-9999
x-user-id: EMP-1
```

**404** `Request REQ-9999 was not found.` The UI shows the same message.

![Expected failure](/figures/week3_not_found.png)

## 6. Automated Tests

Jest is a JavaScript test runner. You write `expect(...)` checks, then `npm test` runs them in Node. We use it for backend tests: business rules, API + SQLite, and Week 2 regression. Those checks do not need a browser.

Playwright is a browser automation tool. We use it for the E2E test because the Week 3 slice is a user flow. It has to click the React UI, call the live Nest API, and leave a row in `dev.db`.

### Business rule (Jest)

File: `backend/src/requests/request-status.spec.ts`

Purpose: the lifecycle in `request-status.ts` without HTTP.

- Submitted → Assigned is allowed
- Closed → In Progress is not allowed
- `Reopen` is not a real status

Command:

```bash
cd backend
npm test
```

Jest uses `prisma/test.db` so it does not depend on clicking the UI.


![Business rule test](/figures/week3_test_business_rule.png)

### Integration between backend and database (Jest)

File: `backend/test/requests.integration.spec.ts`

Purpose: prove create goes through Nest **and** lands in SQLite, not only in memory.

The test starts the Nest app in Jest, then:

1. `POST /requests` as `EMP-1` with title `Need VPN access`
2. The API returns **201** and a `requestId`
3. The same test asks Prisma for that id: `prisma.request.findUnique`
4. The row must exist in `test.db` with that title, `Submitted`, and `userId` `EMP-1`

If the service only built a JSON object and never called Prisma, step 4 would fail. That is the backend and database check.

![Integration test](/figures/week3_test_integration.png)

After `npm test`, `backend/prisma/test.db` can be opened in SQLite Viewer as extra proof.

![Integration test](/figures/week3_sqlite.png)

### Meaningful E2E (Playwright)

File: `frontend/e2e/submit-request.spec.ts`

Purpose: a real browser walkthrough of the product flow.

1. Reset demo data
2. Open the React app
3. Fill title and description as Nour
4. Submit and expect **Submitted**
5. Switch Acting as to Tarek
6. Update status and expect **Assigned**

Command:

```bash
cd frontend
npx playwright install chromium
npm run test:e2e
```

This test talks to the running API, so it uses **`dev.db`**, not `test.db`.

To watch the browser:

```bash
cd frontend
npx playwright test --headed
```

The test pauses when status is **Assigned**. 

![E2E test](/figures/week3_test_e2e.png)
![E2E test](/figures/week3_test_e2ee.png)

### Regression for Week 2 (Jest)

File: `backend/test/requests.regression.spec.ts`

Purpose: status transitions still work after Prisma, create, auth, and the UI.

- `REQ-1001` Submitted → Assigned as `DEPT-IT-1` → **200**
- `REQ-1003` Closed → In Progress as `DEPT-FIN-1` → **400**
- `Reopen` → **400**
- Employee `EMP-1` cannot PATCH → **403**

![Regression tests](/figures/week3_test_regression.png)

The same `npm test` command runs the business rule, integration, and regression files together (8 tests).

## 7. Frontend Proof of the Flow

The UI is `frontend/src/App.tsx`. Open `http://localhost:5173` with the backend on port 3000.

Submit as Nour:
It shows nour submitting a request but she cannot change a status

![UI submit](/figures/week3_ui_submit.png)


Assign as Tarek:
As for tarek since he is the department employee for IT, he can view the request and change its status. He cannot change status of other request categories not related to IT.

![UI assign](/figures/week3_ui_assign.png)



