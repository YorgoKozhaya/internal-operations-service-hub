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

Groq is the AI service. It is called from the backend. The React app never talks to Groq directly. If Groq is down or the key is missing, intake fails with a clear message, and the rest of the hub still works.

## 4- Project Structure

```text
backend/
frontend/
docs/
figures/
README.md
```

The intake rules and the Groq call live in `backend/src/requests/`. Request data is stored with Prisma and SQLite:

```text
backend/prisma/schema.prisma
backend/prisma/dev.db
```

## 5- Run the App

You need two terminals. Start the backend first, then the frontend.

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

Put the key in `backend/.env`:

```text
GROQ_API_KEY=your-key-here
GROQ_MODEL=openai/gpt-oss-20b
GROQ_BASE_URL=https://api.groq.com/openai/v1
```

That file is listed in `.gitignore`, so the key is not committed. Restart the backend after you save the file. Without a key, Suggest returns a clear error and does not create a request. Submit, view, and status change keep working.

## 6- Automated Tests

Backend tests, including the rules that a bad AI reply or a dead provider must not save a request:

```bash
cd backend
npm test
```

The eight live intake evals. This command calls Groq, so the key has to be in `backend/.env`:

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
