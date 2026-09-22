# CareerOS

CareerOS is an AI-native job search operating system designed to help users understand opportunities, prepare stronger truthful applications, reduce repetitive application work, and preserve application context over time.

The long-term product loop is:

Discover → Understand → Decide → Tailor → Apply → Track → Learn

CareerOS is currently in the product specification and Core V1 foundation stage.

---

## Product Principle

CareerOS is built around one core idea:

> Understand my career. Understand the opportunity. Help me make the strongest truthful move.

CareerOS should not behave like a generic resume writer.

It should understand:

- what the user has actually done,
- what a job actually requires,
- what evidence supports the match,
- what relevant experience is hidden or underrepresented,
- what the user's genuine gaps are,
- and how to prepare the strongest truthful application.

---

## Core Product Model

CareerOS Core V1 is organized around five major capabilities:

1. Career Brain
2. Job Intelligence
3. Application Intelligence
4. Application Assistant
5. Application Memory

The core reasoning flow is:

Career Brain
→ Job Requirements
→ Career Evidence
→ Evidence Matching
→ Application Strategy
→ Resume Tailoring
→ Application Assistance
→ Application Memory

---

## Career Brain Is Not a Resume

The Career Brain is the user's structured source of professional truth.

It may include:

- education,
- experience,
- projects,
- skills,
- technologies,
- achievements,
- metrics,
- certifications,
- professional links,
- application information,
- career preferences,
- and supporting evidence.

A resume is a presentation artifact generated or selected from this information for a particular purpose.

One Career Brain may support many resume versions.

---

## Evidence-Based AI

CareerOS follows one foundational AI rule:

> Evidence before generation.

AI must not invent:

- employers,
- responsibilities,
- technologies,
- skills,
- achievements,
- metrics,
- education,
- certifications,
- seniority,
- or other professional facts.

CareerOS distinguishes between:

- Strong Evidence
- Hidden / Underrepresented Evidence
- Weak Evidence
- Genuine Gap

Generated professional claims should be traceable to supporting Career Brain evidence.

---

## Core V1 Goal

CareerOS Core V1 is focused on one complete application workflow:

Create Account
→ Upload Resume
→ Build Career Brain
→ Capture Job
→ Analyze Job
→ Review Evidence and Gaps
→ Prepare Application
→ Tailor Resume
→ Assist With Application Form
→ User Reviews
→ User Submits
→ Record Application

Core V1 prioritizes reliability and trust over feature count.

---

## Repository Documentation

The `/docs` directory is the source of truth for product and engineering decisions.

### Product Definition

`docs/PRODUCT.md`

Defines:

- product vision,
- product thesis,
- product principles,
- long-term direction.

### Product Requirements

`docs/PRD.md`

Defines:

- CareerOS Core V1 scope,
- features,
- requirements,
- acceptance criteria,
- non-goals.

### User Experience

`docs/USER_FLOW.md`

Defines:

- onboarding,
- Career Brain flow,
- job analysis flow,
- application preparation,
- extension experience,
- autofill,
- application history.

### Domain Data Model

`docs/DATA_MODEL.md`

Defines:

- Career Brain entities,
- Career Evidence,
- Resume and Resume Version,
- Job and Job Requirements,
- Evidence Matches,
- Application Strategy,
- Applications.

### AI Specification

`docs/AI_SPEC.md`

Defines:

- AI responsibilities,
- grounding,
- job understanding,
- evidence retrieval,
- evidence evaluation,
- hidden evidence,
- gap detection,
- application strategy,
- resume tailoring,
- hallucination prevention,
- AI evaluation.

### Technical Architecture

`docs/ARCHITECTURE.md`

Defines the approved Core V1 architecture and technical principles.

Preferred stack:

- Next.js
- TypeScript
- React
- Tailwind CSS
- Python
- FastAPI
- PostgreSQL
- Chrome Manifest V3 extension
- provider-independent AI layer

### Roadmap

`docs/ROADMAP.md`

Defines:

- milestone sequencing,
- Core V1 delivery plan,
- scope boundaries,
- future product direction.

---

## Repository Structure

The intended repository direction is:
```text
careeros/
├── AGENTS.md
├── README.md
├── docs/
├── apps/
│   ├── web/
│   ├── api/
│   └── extension/
├── packages/
├── tests/
└── infra/
```

## Local Development

M0 provides the smallest runnable CareerOS path:

```text
Browser → Next.js Web → FastAPI API → PostgreSQL
```

### Prerequisites

- Node.js 22 or newer
- npm 10 or newer
- Python 3.13 or newer
- Docker with Docker Compose
- A Clerk application (for authentication)
- An OpenAI API key (for grounded resume extraction in M2)

### Initial Setup

From the repository root:

```bash
cp .env.example .env
cp apps/web/.env.example apps/web/.env.local
npm install
python3 -m venv .venv
.venv/bin/python -m pip install --upgrade pip
.venv/bin/python -m pip install -e 'apps/api[dev]'
```

Edit `.env` and set:

- `CLERK_ISSUER_URL` — your Clerk instance issuer URL
- `OPENAI_API_KEY` — a server-only API key used for structured resume parsing
- `OPENAI_RESUME_PARSER_MODEL` — the structured-output model (defaults to `gpt-5-mini`)
- `RESUME_STORAGE_DIR` — local private asset storage (defaults to `.local/resume-assets`)

Never place `OPENAI_API_KEY` in `apps/web/.env.local` or prefix it with
`NEXT_PUBLIC_`.

Edit `apps/web/.env.local` and set:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` — your Clerk publishable key (browser-safe)
- `CLERK_SECRET_KEY` — your Clerk secret key (server-only, never exposed to the browser)

### Start PostgreSQL and Apply Migrations

```bash
docker compose --env-file .env -f infra/compose.yaml up -d postgres
.venv/bin/alembic -c apps/api/alembic.ini upgrade head
```

The first migration is intentionally empty. It creates only Alembic's infrastructure metadata and proves that a clean database can be migrated without introducing product-domain tables.

### Start the API

```bash
.venv/bin/uvicorn --app-dir apps/api/src careeros_api.main:app --reload --host 127.0.0.1 --port 8000
```

The API health endpoint is available at `http://localhost:8000/health`.

### Start the Web Application

In a second terminal:

```bash
npm run web:dev
```

Open `http://localhost:3000`. The Career Profile is at `/career`; resume upload,
review, and version history are under `/resumes`. PDF and DOCX uploads are
limited to 5 MB. Original files are stored under the configured local storage
directory, which is git-ignored.

### Run Checks

With PostgreSQL running:

```bash
npm run web:lint
npm run web:typecheck
npm run web:test
npm run web:format
npm run web:build
.venv/bin/ruff check apps/api
.venv/bin/ruff format --check apps/api
.venv/bin/mypy apps/api/src
.venv/bin/pytest apps/api/tests
```

### Stop PostgreSQL

```bash
docker compose --env-file .env -f infra/compose.yaml down
```
