# Internal Operations Service Hub

## 1- About the Project

This project is part of the academy work. It grew step by step in the same repository.

The current milestone is Week 4. An employee can describe a problem in their own words. A free AI model suggests what kind of request it is, or answers what happened to a request they are allowed to see. The backend checks that suggestion before anything is saved. The person still decides.

The full write-up, the eight eval cases, and the screenshots are in:

```text
docs/week4-production-ai.md
```

## 2- Project Idea

The project is an Internal Operations Service Hub.

Employees use it to ask for help from IT, HR, or Finance, and to follow the status of a request they already sent. Department staff can update the status of a request that belongs to their department.

## 3- Week 4 in General

Week 4 stays in this same repository. It adds one capability: AI-assisted request intake.

The employee types freely. The assistant can do two things:

- suggest a new request, with a title, a category (IT, HR, or Finance), and a short line that says what to write
- answer a question about a request the employee is allowed to see, using the status stored in the database

Suggest does not save the request. The employee reviews the suggestion, and the normal submit button is what stores it. If the text is too short, mixes two areas, or does not fit IT, HR, or Finance, the assistant asks them to be clearer instead of guessing.

Groq is the AI service. It runs on its own port, and the backend calls that port. The React app never talks to Groq directly. If that port is stopped or the key is missing, intake fails with a clear message, and the rest of the hub still works.

## 4- Project Structure

```text
ai/
backend/
frontend/
docs/
figures/
README.md
```

Intake rules live in `backend/src/requests/`. The Groq call lives in `ai/` and runs on its own port. Request data is stored with Prisma and SQLite:

```text
backend/prisma/schema.prisma
backend/prisma/dev.db
```

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

Open that page. Use **Acting as** to switch between Nour (employee) and Tarek (IT department employee).

### Free AI key

Intake calls Groq. Create a free API key at [https://console.groq.com](https://console.groq.com). No credit card is required for the free plan.

Put the key in `ai/.env`:

```text
GROQ_API_KEY=your-key-here
GROQ_MODEL=openai/gpt-oss-20b
GROQ_BASE_URL=https://api.groq.com/openai/v1
```

The backend only needs the AI address, in `backend/.env`:

```text
AI_BASE_URL=http://127.0.0.1:4000
RESEND_API_KEY=your-resend-key-here
```

Status email uses Resend. The free account must be the same address that should receive the mail, `yorgokozhaya1111@gmail.com`. Leave the key out and the status still changes; the email is simply skipped. Restart the backend after you save the key.

Both files are listed in `.gitignore`, so the key is not committed. Restart the AI service after you save `ai/.env`. Without a key, or with the AI service stopped, Suggest returns a clear error and does not create a request. Submit, view, and status change keep working.

## 6- Automated Tests

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

## 7- Clone Repository

```bash
git clone https://github.com/YorgoKozhaya/internal-operations-service-hub.git
```
