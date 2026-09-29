# Internal Operations Service Hub

## 1- About the Project

This project is part of the academy work. It is one place where employees ask IT, HR, or Finance for help and follow the request until it is done.

An employee can describe the problem in their own words. A free AI model suggests what kind of request it is, or answers what happened to a request they are allowed to see. The backend checks that suggestion before anything is saved. The person still decides. Suggest does not save the request. Submit does.

Notices were added inside the app. The people involved in a request see a notice when it is submitted, when the status changes, when someone comments, and when it is transferred.

Email was added as well. On a new request the employee can tick the box to get each status change by email. The mail goes through Resend. If the key is missing or the mail fails, the status is still saved.

I tried this as Yorgo Kozhaya, the IT employee (`EMP-4`). His address in the hub is my own email, `yorgokozhaya1111@gmail.com`. I submitted a request with the email box ticked. When the status changed, the notice showed in the app and the email arrived at that address. The free Resend account only delivers to that same address. A company would use a paid mail service so it can write to every employee. The message is shown in the release note.

The release write-up, the health checks, and the screenshots are in:

```text
docs/week5-release-operations.md
```

The product description, the architecture, and the data model are in `docs/product-spec.md`, `docs/architecture.md`, and `docs/data-model.md`.

## 2- Project Idea

The project is an Internal Operations Service Hub.

Employees use it to ask for help from IT, HR, or Finance, and to follow the status of a request they already sent. Department staff can update the status of a request that belongs to their department, and they can transfer it if another department should handle it. An approver approves or rejects when the department employee asks for approval. The administrator, Elie Boustany, can see status across the system and manage users and departments. He does not see the request text.

Open the page and use **Acting as**. Nour El Hajj submits. Tarek Salameh handles IT requests. Yorgo Kozhaya is another IT employee, and the one whose email can receive status mail. Elie Boustany is the administrator.

## 3- How a Request Moves

The employee types freely, or fills the form. The assistant can do two things:

- suggest a new request, with a title, a category, and a short line that says what to write
- answer a question about a request the employee is allowed to see, using the status stored in the database

Suggest does not save the request. The employee reviews the suggestion, and the normal submit button is what stores it. If the text is too short, mixes two areas, or does not fit IT, HR, or Finance, the assistant asks them to be clearer instead of guessing.

Groq is the AI service. It runs on its own port, and the backend calls that port. The React app never talks to Groq directly. If that port is stopped or the key is missing, intake fails with a clear message, and the rest of the hub still works.

The department employee of the current department changes the status. When the request is In Progress, that person decides if it needs approval. Approve and Reject belong to the assigned approver. A closed request stays closed.

## 4- Project Structure

```text
ai/
backend/
frontend/
docs/
figures/
scripts/
render.yaml
README.md
```

Intake rules live in `backend/src/requests/`. The Groq call lives in `ai/` and runs on its own port. On this laptop, request data is stored with Prisma and SQLite:

```text
backend/prisma/schema.prisma
backend/prisma/dev.db
```

The live service uses Postgres. That setup is in `render.yaml` and `docs/week5-release-operations.md`.

## 5- Run the App

You need three terminals. Start the AI service and the backend, then the frontend.

### AI

```bash
cd ai
npm start
```

The AI service runs on:

```text
http://localhost:4000
```

Stopping this process makes Suggest fail. Submit, lists, notices, and status changes keep working because they never call this port.

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

Open that page. Use **Acting as** to switch between Nour (employee) and Tarek (IT department employee). To try the email, act as Yorgo Kozhaya, tick the email box, submit, then change the status as Tarek.

### Free AI key

Intake calls Groq. Create a free API key at [https://console.groq.com](https://console.groq.com). No credit card is required for the free plan.

Put the key in `ai/.env`:

```text
GROQ_API_KEY=your-key-here
GROQ_MODEL=openai/gpt-oss-20b
GROQ_BASE_URL=https://api.groq.com/openai/v1
```

The backend needs the database file, the AI address, and the optional mail key, in `backend/.env`:

```text
DATABASE_URL="file:./dev.db"
AI_BASE_URL=http://127.0.0.1:4000
RESEND_API_KEY=your-resend-key-here
```

Status email uses Resend. The free account must be the same address that should receive the mail, `yorgokozhaya1111@gmail.com`. Leave the key out and the status still changes; the email is simply skipped. The in-app notice is still created. Restart the backend after you save the key.

Both files are listed in `.gitignore`, so the key is not committed. Restart the AI service after you save `ai/.env`. Without a key, or with the AI service stopped, Suggest returns a clear error and does not create a request. Submit, view, notices, and status change keep working.

## 6- Try the deployed app

Open the live operations-hub address. There is no password. Use **Acting as**.

| Person | Role | What to try |
|---|---|---|
| Nour El Hajj | Employee, IT | Submit a request |
| Karim Farah | Employee, HR | Submit a request to HR |
| Rania Daher | Employee, Finance | Submit a request to Finance |
| Yorgo Kozhaya | Employee, IT | Submit with the email box ticked. Status mail works for his address only |
| Tarek Salameh | IT department employee | Change the status of an IT request, or transfer it |
| Lina Awad | HR department employee | Change the status of an HR request |
| Fadi Chamoun | Finance department employee | Change the status of a Finance request |
| Maya Haddad | IT approver | Approve or reject an IT request that is waiting for her |
| Rami Nassar | HR approver | Approve or reject an HR request that is waiting for him |
| Hiba Karam | Finance approver | Approve or reject a Finance request that is waiting for her |
| Elie Boustany | Administrator | See every request's status. Titles stay hidden. He can open Users and Departments. He does not change a status |

One path to try as Nour:

1. Open **Suggest**.
2. Type `my laptop keyboard stopped working` and press **Suggest**.
3. Press **Use this suggestion**. That fills the form. It does not save the request.
4. Press **Submit**. The request appears under **Requests**.

Then switch to Tarek Salameh and move that request from Submitted to Assigned.

For the email, switch to Yorgo Kozhaya, tick the email box, and submit. After Tarek changes the status, the mail arrives at `yorgokozhaya1111@gmail.com` only. The other people use `@company.local` addresses, so the free mail account does not deliver to them. The in-app notice still appears for the person who submitted the request.

For approval, the department employee opens an In Progress request, chooses **Needs approval**, and picks the approver for that department: Maya Haddad for IT, Rami Nassar for HR, or Hiba Karam for Finance. Switch **Acting as** to that approver and choose Approve or Reject.

## 7- Automated Tests

One command runs the backend tests, the AI test, and the browser test. It starts the AI service on port 4000 when that port is down, because the health check used by the browser test needs it, and it stops that process again afterward.

```bash
npm run verify
```

Backend tests, including the rules that a bad AI reply or a dead provider must not save a request:

```bash
cd backend
npm test
```

The eight live intake evals. Start the AI service first. This command calls it, and the key has to be in `ai/.env`:

```bash
cd backend
npm run eval:intake
```

Browser test for submit and status update. The first time only, install the browser:

```bash
cd frontend
npx playwright install chromium
npm run test:e2e
```

Health and monitor checks, including the watch commands that keep printing, are written with the screenshots in `docs/week5-release-operations.md`.

## 8- Clone Repository

```bash
git clone https://github.com/YorgoKozhaya/internal-operations-service-hub.git
```
