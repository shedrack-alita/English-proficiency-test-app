# EPTPREP — English Proficiency Test Preparation

A Next.js rewrite of the original PHP CBT system, focused on English proficiency test practice:
a candidate (student) site and an admin panel.

## Run it locally

Requires Node.js 20+.

```bash
npm install
npm run dev
```

Open http://localhost:3000. Locally the app uses **PGlite**, a real Postgres database that runs
inside Node and is stored in `data/pglite/`. It is created and seeded automatically on the first
request, so no database server is needed. Stop the dev server and delete the `data/` folder to
start fresh. To use your Neon database locally instead, put `DATABASE_URL` in `.env.local`.

## Deploy to Vercel (with Neon)

Vercel runs the app as serverless functions, which can't keep a database on disk, so the hosted
site stores its data in **Neon** (hosted Postgres, free tier). The tables and the 1,000 built-in
questions are created automatically on the first request.

**1. Create the database (Neon)**

1. Sign up at https://neon.tech and create a project (pick the region nearest your users).
2. On the project dashboard, click **Connect** and copy the connection string
   (`postgresql://…neon.tech/neondb?sslmode=require`).

**2. Create the Vercel project**

1. Import the GitHub repository at https://vercel.com/new. Vercel detects Next.js.
2. If the app sits in a subfolder of the repository, set **Root Directory** to `cbt-web`.
3. Under **Environment Variables**, add the variables below, then deploy.

Vercel's Neon integration (Storage tab) can also create the database and set `DATABASE_URL`
for you; the app accepts `DATABASE_URL` or `POSTGRES_URL`.

To generate `EPT_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Every push to the main branch redeploys the site. Netlify works the same way (set the same
variables; `netlify.toml` holds the build settings).

### Environment variables

| Variable | Needed | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Hosted | Neon connection string. Unset locally → PGlite in `data/pglite`. |
| `EPT_SECRET` | Hosted | Long random string that signs login cookies. Locally one is generated into `data/.secret`. |
| `EPT_ADMIN_PASSWORD` | Recommended | Initial admin password, used when the database is first set up (default `admin123`). |
| `EPT_DB_PATH` | Optional | Local PGlite folder. |

## Admin panel

Go to **/admin** (e.g. http://localhost:3000/admin). There's no link from the candidate pages.

- Default account: username `admin`, password `admin123`, or whatever `EPT_ADMIN_PASSWORD` is set to
  when the database is first created. **Change it** under Settings straight away on a hosted site.
- **Overview:** registered candidates (today / last 7 days), a 14-day sign-up chart, attempts,
  average score, pass rate, accuracy by topic, latest submissions.
- **Tests & questions:** create/edit/delete tests (mock examination or practice), add/edit/delete
  questions, import questions from CSV. The question list is paged (25 per page) and can be
  filtered by topic and searched by question text, options or source.
- **Candidates:** sign-up counts (total, today, last 7 and 30 days, how many have taken a test),
  search, join date, edit name/email/access/status, allow a mock retake, delete.
- **Results & rankings:** every attempt, or a per-test ranking of each candidate's best score; export to CSV.
- **Feedback:** read and delete candidate feedback (anonymous feedback stays anonymous).

CSV import columns (header row optional): `question, choice_a, choice_b, choice_c, choice_d,
correct_answer`, optionally `topic, instruction, passage, explanation, tip, source`. The answer can
be A–D or the option text.

## Accounts

Candidates create an account at **/signup** (name, email, applied course of study, applied
department, gender and a password of 6+ characters) and sign in at
**/login** with that email and password. Passwords are stored as scrypt hashes. The number of
accounts, and each candidate's course, department and gender, are shown in the admin panel.

## Built-in questions

There are **1,000 questions across 17 topics**, each with an explanation of the right answer and a
tip for answering similar questions. Every question records its source, which the
results report shows:

| Source | Questions |
| --- | --- |
| UI Postgraduate EPT Mock Examination (Questions 1–100) | 100 |
| UI Postgraduate School: Test of English for Higher Degree Admissions, Sample Questions (2013) | 150 |
| UI EPT Preparation Mock (tutorial group) | 196 |
| University of Ibadan Post-UTME Practice Questions: Use of English | 94 |
| UI EPT study group quizzes (WhatsApp) | 158 |
| English Placement Test (with published solutions) | 100 |
| CanTEST sample test (Sheridan English Proficiency Assessment) | 32 |
| UN Language Proficiency Examination (English) practice paper | 69 |
| Reading Comprehension Practice Test | 47 |
| Life Tutorial Comprehension Class handout | 7 |
| EPTPREP practice (original questions for thin topics) | 47 |

Explanations and tips were written for EPTPREP. Where a source had no answer key, or its key was
wrong, the answers were worked out by EPTPREP; each file's header says which. Questions where more
than one option was defensible were left out.

The questions are loaded into:

- **EPTPREP Question Bank** (practice): every question. Candidates build their own set: topics,
  number of questions (up to 200) and time limit.
- **UI Postgraduate English Test: Official Sample Paper**: the 150-question 2013 paper, 60 minutes.
- **UI Postgraduate EPT Mock Examination**: the 100-question mock, 60 minutes.

Mock examinations run in paper order and allow one attempt; the pass mark is 40%.

### Editing the questions

Questions live in plain-text files in `content/bank/`, and the mock papers are listed in
`content/mocks.json`. The format is described at the top of `scripts/build-bank.mjs`; in short:

```
@topic Concord
@source EPTPREP practice
@instruction Choose the option that best completes the sentence.
@tip A tip shown in the results report.
Each of the boys ___ a bicycle. | has | have | are having | having || "Each" is singular, so the verb is "has".
```

Without a `*`, the first option is the answer and the options are shuffled; `*option` marks the
answer and keeps the published order. After editing, rebuild the bank:

```bash
npm run bank
```

This validates every question and writes `src/lib/seed-data/bank.json`. The next request (or
deploy) replaces the built-in tests automatically; candidates' accounts stay, but attempts on
built-in tests are cleared because their questions changed. Tests created in the admin panel are
never touched.

## How exams work

- Before starting, candidates choose topics, the number of questions and a time limit (a suggested
  time is offered).
- The exam page shows one question at a time with its instruction and passage, the options, a
  timer, Previous/Next, Submit and a numbered question grid.
- Starting a test creates an attempt with a server-side deadline, so refreshing or leaving the page
  doesn't reset the timer. Each answer is saved as soon as it's chosen.
- When time runs out the exam submits automatically; an abandoned attempt is scored when the
  candidate next visits.
- Results show the score, a proficiency band, a per-topic breakdown, and for every question whether
  it was right, why, and a tip for similar questions.

## Project layout

```
src/app/                 pages (landing, sign-up, login, dashboard, tests, results, feedback, exam, admin)
src/app/actions.ts       server actions (sign-up, sign-in, start/save/submit attempt, feedback)
src/lib/db.ts            Postgres schema and connection (Neon when hosted, PGlite locally)
src/lib/seed.ts          seeds the built-in tests from src/lib/seed-data/bank.json
src/lib/admin-data.ts    admin queries (overview, sign-ups, tests, questions, candidates, results)
content/bank/            question source files; scripts/build-bank.mjs turns them into bank.json
src/lib/data.ts          queries, scoring and attempt rules
src/lib/session.ts       signed-cookie sessions
```
# English-proficiency-test-app
