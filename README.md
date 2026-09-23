# CareerOS

CareerOS is an AI-native job-search operating system that learns a user's
professional identity once, helps them discover opportunities, helps them apply
wherever they find a job, remembers their applications, and can provide deeper
evidence-based optimization when an opportunity matters.

The approved V1 product spine is:

```text
KNOW ME → DISCOVER → APPLY ANYWHERE → REMEMBER
                         ↘
                       ENHANCE (optional)
```

CareerOS is not merely a resume builder, autofill extension, job board, ATS
score, or resume-tailoring tool. Its services share a common understanding of
the user through the Career Brain.

## Current implementation

M0–M8 are implemented at commit history level. Today the repository supports:

- Next.js Web → FastAPI API → PostgreSQL;
- Clerk authentication and server-side user ownership;
- Career Profile management backed by the Career Brain;
- stable Career Evidence with immutable revisions;
- PDF and DOCX resume upload, parsing, review, confirmation, and versioning;
- a Jobs-first product shell with Jobs, Applications, Resumes, and Profile;
- manual job capture, server-owned search/location filters, detail, durable
  per-user saved state, and safe direct-apply links;
- evidence matching against a selected immutable resume version;
- Strong Evidence, Hidden Evidence, Weak Evidence, and Genuine Gap results; and
- explainable optional Job Intelligence recommendations; and
- an honest Applications placeholder that does not simulate tracking.

The following V1 capabilities are planned, not implemented:

- a provider-independent job-source boundary and production job acquisition;
- browser extension and application-page detection;
- field normalization, Answer Engine, and autofill;
- durable Application records and a functional Applications tracking surface;
  and
- end-to-end Web/extension/Application Memory integration.

Application Strategy and resume tailoring are deferred optional enhancements.
Existing Job Intelligence remains available and must not become a mandatory
step before applying.

## Product model

### Know Me

Resume-first onboarding builds a durable Career Brain:

```text
Sign up → Upload resume → Parse → Review/correct → Confirm → Career Brain
```

Career Brain is the canonical professional truth layer. A resume is a
presentation artifact; it is not the complete representation of the user.

### Discover

The Jobs surface supports browsing user-added opportunities, title/company
search, location filtering, job detail, saving, and safe direct application.
Manual data is explicitly labeled and is not presented as a live feed. Jobs may
eventually originate from multiple external sources, but production job-data
acquisition is not implemented. The Web product remains independent of any
provider's schema.

### Apply Anywhere

The planned extension is a first-class application assistant whether a job was
found inside CareerOS or elsewhere. It will detect application forms, normalize
fields, resolve answers from approved sources, fill supported fields, surface
uncertainty, and leave final review and submission to the user.

### Remember

The planned Application domain will preserve the company, role, source or URL,
selected Resume Version, relevant answers, status, and timestamps. Future
features can attach to the Application without redefining its historical truth.

### Enhance

Job Intelligence is the implemented foundation of an optional deeper workflow.
Application Strategy, resume tailoring, application Q&A, and interview
preparation are not required for routine applications and are not implemented
yet.

## Core principles

- Evidence before generated professional claims.
- Career Brain is not a resume.
- Unknown information remains unknown.
- Unsupported skills, experience, ownership, metrics, or seniority are never
  invented.
- User corrections and confirmations are authoritative.
- Historical evidence revisions, resume versions, and analyses remain stable.
- Sensitive and consequential answers require explicit user input and policy.
- Final application submission remains a user action.
- External documents, jobs, pages, and forms are untrusted input.
- Simple infrastructure, clear domain boundaries, extensible interfaces.

## Repository documentation

The `docs/` directory is the product and engineering source of truth:

- `docs/PRODUCT.md` — product constitution and V1 spine
- `docs/PRD.md` — V1 functional requirements and non-goals
- `docs/USER_FLOW.md` — primary user journeys
- `docs/DATA_MODEL.md` — implemented and planned domain concepts
- `docs/AI_SPEC.md` — evidence and Answer Engine AI policy
- `docs/ARCHITECTURE.md` — approved modular architecture
- `docs/ROADMAP.md` — authoritative milestone sequence

## Repository structure

```text
careeros/
├── apps/
│   ├── api/          # FastAPI backend and Alembic migrations
│   └── web/          # Next.js Web application
├── docs/             # Product and engineering source of truth
├── infra/            # Local PostgreSQL Compose configuration
├── packages/         # Shared packages when justified
└── tests/            # Cross-application fixtures when introduced
```

`apps/extension` will be introduced during the approved extension milestone; it
does not exist today.

## Local development

### Prerequisites

- Node.js 22 or newer
- npm 10 or newer
- Python 3.13 or newer
- Docker with Docker Compose
- a Clerk application for authenticated Web use
- an OpenAI API key for real resume parsing and Job Intelligence; deterministic
  tests do not require one

### Initial setup

```bash
cp .env.example .env
cp apps/web/.env.example apps/web/.env.local
npm install
python3 -m venv .venv
.venv/bin/python -m pip install --upgrade pip
.venv/bin/python -m pip install -e 'apps/api[dev]'
```

Set the Clerk variables in the local environment files. Keep
`OPENAI_API_KEY` server-only; never place it in the Web environment or prefix it
with `NEXT_PUBLIC_`.

### Start PostgreSQL and migrate

```bash
docker compose --env-file .env -f infra/compose.yaml up -d postgres
.venv/bin/alembic -c apps/api/alembic.ini upgrade head
```

The current migration head is `0007_m8_saved_jobs`.

### Start the API

```bash
.venv/bin/uvicorn --app-dir apps/api/src careeros_api.main:app --reload --host 127.0.0.1 --port 8000
```

Health check: `http://localhost:8000/health`.

### Start the Web application

```bash
npm run web:dev
```

Open `http://localhost:3000`. Implemented routes include `/jobs`,
`/applications`, `/career`, and `/resumes`.

### Verification

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
git diff --check
```

### Stop PostgreSQL

```bash
docker compose --env-file .env -f infra/compose.yaml down
```
