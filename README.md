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

M0–M17 and the post-M17 implementation wave are implemented at repository
level. M16 automated hardening is implemented; representative unpacked-Chrome
validation remains pending. Current Alembic head:
`0014_dual_market_profile`.
Today the repository supports:

- Next.js Web → FastAPI API → PostgreSQL;
- Clerk authentication and server-side user ownership;
- Career Profile management backed by the Career Brain;
- stable Career Evidence with immutable revisions;
- PDF and DOCX resume upload, parsing, review, confirmation, and versioning;
- a Jobs-first product shell with Jobs, Applications, Resumes, and Profile;
- manual job capture, server-owned search/location filters, detail, durable
  per-user saved state, and safe direct-apply links;
- a provider-neutral job-source contract, canonical source attribution,
  retry-safe deduplication, and honest freshness/availability state;
- evidence matching against a selected immutable resume version;
- Strong Evidence, Hidden Evidence, Weak Evidence, and Genuine Gap results;
- explainable optional Job Intelligence recommendations;
- a least-privilege Manifest V3 extension foundation with stable development
  identity, Clerk Sync Host authentication, protected API access, active-tab
  application-page detection, and honest unsupported states;
- read-only normalized form inspection with generic, Greenhouse, Lever, and
  Ashby adapter boundaries, deterministic canonical keys, and explicit
  support/confidence states;
- an authenticated Answer Engine foundation with owned source retrieval,
  sensitive/consequential guardrails, explicit Fill/Suggest/Ask/Confirm/Unknown
  decisions, and aggregate extension preview;
- explicit user-triggered filling for approved blank native controls, exact
  field revalidation, non-overwrite behavior, visible per-field review states,
  and a hard no-submit boundary;
- durable Application Memory for CareerOS and externally found jobs, including
  exact Resume Version association, immutable approved answer history, lifecycle
  status, ownership, and retry idempotency;
- an Applications list/detail/status experience with exact resume and source
  context plus a manual Mark as applied fallback; and
- CareerOS Job → external page context handoff and explicit extension-side
  recording after the user submits, without automatic final submission;
- data-minimized assistant context lookup that never sends full resume content
  to the extension; and
- retry-safe Preparing recovery across an external post-submit redirect;
- mutually exclusive loading/error/empty states and consistent API error
  representation across Web surfaces;
- user-owned personal/contact information with Career Profile UI and Answer
  Engine integration;
- resume-first onboarding at `/welcome`, an improved landing page, and an
  extension setup guide at `/setup`;
- a `/readiness` endpoint and local JWKS preflight diagnostic
  (`scripts/preflight.py` checks Clerk JWKS reachability only);
- partial English/Simplified Chinese localization for Applications, Resumes,
  Career Profile, and Job detail;
- an in-page Application Assistant — a controlled UI panel for detection,
  answers, form filling, and Application Memory — with open Shadow DOM style
  isolation, on-demand content-script injection, explicit activation, and
  keyboard shortcut support;
- refactored Jobs page, extension popup, messages, and API client modules; and
- dual-market contact profile fields (native/Latin full name, name order,
  contact email, WeChat ID, district, GitHub URL) and explicit,
  user-confirmed contact-info candidates surfaced from resume import.

The following V1 capabilities are planned, not implemented:

- production job acquisition and real external source adapters;
- automatic resume/file upload and broader custom-widget execution;
- complete localization of every Web surface and the extension; and
- representative unpacked-Chrome validation across both required application
  paths.

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

The implemented extension is a first-class application entry point
whether a job was found inside CareerOS or elsewhere. It securely shares the
Web session, detects likely application pages, converts supported forms into a
provider-neutral model, and requests policy-controlled answer decisions without
requiring a CareerOS Job. Users explicitly activate an in-page assistant
(popup action or `Command/Ctrl+Shift+K`) on the active tab; the assistant is a
controlled UI panel injected on demand via `activeTab` + `scripting`, uses open
Shadow DOM for style isolation only, and does not request `<all_urls>` host
access. After
explicit user action it fills only approved blank native controls and marks
review/input/unresolved states on the page. Existing answers remain untouched
and final submission remains the user's action.

### Remember

The implemented Application domain preserves the company, role, source or URL,
selected Resume Version, approved answer history, status, and timestamps across
Web and extension entry points. Future features can attach to the Application
without redefining its historical truth.

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
- `docs/FORM_MODEL.md` — M11 normalized form and adapter contract
- `docs/ANSWER_ENGINE.md` — M12 answer-source and policy contract
- `docs/FORM_EXECUTION.md` — M13 safe execution and review-state contract
- `docs/APPLICATION_MEMORY.md` — M14 durable Application domain/API contract
- `docs/APPLICATION_INTEGRATION.md` — M15 Web/extension integration contract
- `docs/VALIDATION_M15.md` — M15 automated results and deferred browser gate
- `docs/VALIDATION_M16.md` — M16 hardening results and remaining browser gate
- `docs/JOB_SOURCE_DECISION.md` — approved process for the next job-data source

## Repository structure

```text
careeros/
├── apps/
│   ├── api/          # FastAPI backend and Alembic migrations
│   ├── extension/    # Chrome Manifest V3 application assistant
│   └── web/          # Next.js Web application
├── docs/             # Product and engineering source of truth
├── infra/            # Local PostgreSQL Compose configuration
├── packages/         # Shared packages when justified
└── tests/            # Cross-application fixtures when introduced
```

## Local development

### Prerequisites

- Node.js 22 or newer
- npm 10 or newer
- Python 3.13 or newer
- Docker with Docker Compose
- a Clerk application for authenticated Web and extension use
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
with `NEXT_PUBLIC_`. Resume uploads default to 10 MB; the API limit can be
changed with `MAX_RESUME_SIZE_BYTES`.

### Start PostgreSQL and migrate

```bash
docker compose --env-file .env -f infra/compose.yaml up -d postgres
.venv/bin/alembic -c apps/api/alembic.ini upgrade head
```

The current migration head is `0014_dual_market_profile`.

### Start the API

```bash
.venv/bin/uvicorn --app-dir apps/api/src careeros_api.main:app --reload --host 127.0.0.1 --port 8000
```

Health check: `http://localhost:8000/health`.

Readiness check: `http://localhost:8000/readiness` reports database connectivity
and Clerk JWKS reachability (`ok` or `degraded`).

### Start the Web application

```bash
npm run web:dev
```

Open `http://localhost:3000`. Implemented routes include `/`, `/welcome`,
`/setup`, `/jobs`, `/applications`, `/career`, and `/resumes`.

### Build the browser extension

The extension build reads the existing local Web publishable key and root Clerk
issuer by default. Production or isolated builds can copy
`apps/extension/.env.example` to `apps/extension/.env.local` and set only public
extension values there. Never add `CLERK_SECRET_KEY` to the extension.

```bash
npm run extension:build
```

In Chrome, open `chrome://extensions`, enable Developer mode, choose **Load
unpacked**, and select `apps/extension/build`.

The checked-in development public key keeps the unpacked extension ID stable as
`ibihlmjmbfjegkljfjihhakppeagbpkf`. It is an identity value, not a secret or a
production signing key.

Clerk extension authentication also requires two development-instance settings:

1. enable the Native API under **Clerk Dashboard → Native applications**; and
2. use Clerk's documented instance update to append the loaded extension's
   `chrome-extension://<extension-id>` origin to `allowed_origins`.

The second step uses the server-only Clerk secret key. Preserve any existing
allowed origins, never paste the secret into extension configuration, and never
commit it.

The extension uses Clerk Sync Host to share the Web session. Its background
service worker obtains short-lived session tokens and calls the protected API;
tokens are never sent to page content scripts. Page access is granted only for
the active tab when the user opens the extension.

For a local detection fixture:

```bash
npm --workspace @careeros/extension run fixture
```

Then open `http://localhost:4173/application-page.html` and activate the
in-page assistant (popup action or `Command/Ctrl+Shift+K`). The fixture contains
no real applicant data. M13 can fill approved blank fields only after explicit
user action and never submits the form.

### Developer workflow helpers

Check local setup, migration head, and extension build:

```bash
./scripts/dev-check.sh
```

Verify that Python can reach Clerk JWKS (common macOS TLS issue):

```bash
.venv/bin/python scripts/preflight.py
```

See `/setup` in the Web app for the full extension installation guide.

### Verification

```bash
npm run web:lint
npm run web:typecheck
npm run web:test
npm run web:format
npm run web:build
npm run extension:typecheck
npm run extension:test
npm run extension:format
npm run extension:build
.venv/bin/ruff check apps/api
.venv/bin/ruff format --check apps/api
.venv/bin/mypy apps/api/src
.venv/bin/pytest apps/api/tests
./scripts/dev-check.sh
.venv/bin/python scripts/preflight.py
git diff --check
```

### Stop PostgreSQL

```bash
docker compose --env-file .env -f infra/compose.yaml down
```
