# CareerOS Core V1 — Technical Architecture

> Version: 0.3
> Status: Approved V1 re-baseline
> Last Updated: 2026-09-26

## 1. Purpose

This architecture supports the V1 product spine:

```text
KNOW ME → DISCOVER → APPLY ANYWHERE → REMEMBER
                         ↘
                       ENHANCE (optional)
```

It preserves working M0–M17 behavior, the implemented M16 automated hardening,
and the post-M17 wave while defining minimal extension points for Jobs
discovery. The M16 representative browser gate remains pending.

The architectural principle is:

> Simple infrastructure, clear domain boundaries, extensible interfaces.

## 2. Current implementation

Implemented runtime:

```text
Next.js Web ───────┐
Chrome Extension ─┴→ FastAPI API → PostgreSQL
                                ├→ local resume asset storage
                                └→ provider-isolated AI tasks
```

Implemented domains and workflows:

- Identity and authentication mapping;
- Career Brain/Profile and Career Evidence;
- Resume ingestion and versioning;
- manual Job capture, provider-neutral source ingestion, and Job
  snapshots/requirements;
- Jobs browse/search/location filtering, per-user saving, and safe direct Apply;
- canonical source identity, retry-safe deduplication, observed timestamps, and
  explicit availability/freshness state;
- the Jobs-first Web shell and honest Applications placeholder;
- optional Job Intelligence analyses and evidence matches;
- a Manifest V3 extension with stable development identity, Clerk Sync Host,
  a background-only authenticated API client, exact message validation,
  active-tab script injection, application-page heuristics, and compact status
  UI;
- provider-neutral read-only form inspection with generic, Greenhouse, Lever,
  and Ashby adapter boundaries, deterministic canonical keys, and explicit
  support/confidence states;
- an authenticated policy-first Answer Engine with deterministic sensitive
  guardrails, optional bounded semantic classification, canonical source
  retrieval, and explicit Fill/Suggest/Ask/Confirm/Unknown decisions; and
- user-triggered provider-neutral form execution with exact target
  revalidation, non-overwrite behavior, visible field states, and no submit;
  and
- durable Application Memory with external/canonical context snapshots, exact
  Resume Version association, immutable approved answers, ownership, and retry
  idempotency; and
- Applications Web workflows plus background-only extension matching and
  explicit submission recording; and
- data-minimized assistant context lookup plus Preparing recovery after an
  external redirect;
- an in-page Application Assistant — a controlled UI panel for detection,
  Answer Engine answers, form filling, and Application Memory — with open
  Shadow DOM style isolation, explicit activation, and page lifecycle handling;
- user-owned `UserContactInfo` with Career Profile UI and Answer Engine
  integration;
- resume-first onboarding at `/welcome`, landing improvements, and `/setup`;
- a `/readiness` endpoint and local JWKS preflight diagnostic
  (`scripts/preflight.py` checks Clerk JWKS reachability only);
- partial English/Simplified Chinese localization for Applications, Resumes,
  Career Profile, and Job detail; and
- refactored Jobs page, extension popup, messages, and API client modules.

Current Alembic head: `0013_uci_answer_source`.

Not implemented today:

- production job-source ingestion;
- automatic resume/file upload and broader custom-widget execution;
- Application Strategy/resume tailoring;
- complete localization of every Web surface and the extension; and
- representative unpacked-Chrome validation of both required V1 scenarios.

## 3. Architecture principles

### Modular monolith

CareerOS remains a modular monolith. Web, API, a future worker, and extension may
run separately, but business logic is not divided into microservices.

### Canonical core domains

PostgreSQL holds canonical structured state. Product services consume core
domains rather than creating duplicate representations.

### Adapters at external boundaries

Provider-specific job sources, AI providers, storage systems, and ATS/site
behavior stay behind narrow interfaces. The job-source boundary is implemented;
real production source adapters remain future work.

### Deterministic before AI

Authorization, known field mapping, status transitions, policy checks, and
identifier validation use conventional logic. AI is used only for semantic tasks.

### Preserve history

Immutable evidence revisions, Resume Versions, Job snapshots, historical
analyses, and future Application context remain attributable to what was used at
the time.

### Progressive complexity

Do not introduce infrastructure before a measured requirement exists.

## 4. Target V1 shape

```text
                         ┌─────────────────────┐
                         │     Next.js Web     │
                         │ Jobs / Applications│
                         │ Resumes / Profile  │
                         └──────────┬──────────┘
                                    │ authenticated REST
┌─────────────────────┐             ▼
│ Browser Extension   │──────►┌──────────────────────┐
│ detection + execute │       │   FastAPI Backend    │
└─────────────────────┘       │ modular monolith     │
                              └───────┬──────┬───────┘
                                      │      │
                              ┌───────▼──┐ ┌─▼───────────┐
                              │PostgreSQL│ │AI Providers │
                              └──────────┘ └─────────────┘

External Job Sources ─► Job Source Adapters ─► normalized Job boundary ─► API
External ATS/Forms   ─► ATS/Generic Adapters ─► normalized Form model ───► API
```

The extension foundation, normalized form/ATS adapter boundary, Answer Engine,
safe form execution, Application Memory, and cross-surface Application
integration are implemented.

## 5. Core domains vs product services

### Core domains

- Identity
- UserContactInfo
- Career Brain
- Career Evidence
- Resume
- Job
- Application

### Product services/workflows

- Job Discovery (planned)
- Autofill (implemented foundation)
- Answer Engine (implemented foundation)
- Job Intelligence (implemented)
- Resume Tailoring (deferred)
- Application Q&A, Interview Preparation, Recommendation, Analytics, Career
  Planning, and future agents (future)

Services access canonical data through application-service/repository boundaries.
They must not create alternate user profiles or source-specific Job models.

## 6. Repository direction

```text
careeros/
├── apps/
│   ├── web/          # implemented
│   ├── api/          # implemented
│   └── extension/    # implemented Manifest V3 foundation
├── packages/         # frontend-safe shared contracts when justified
├── tests/            # cross-surface fixtures when introduced
├── infra/            # proportional local/deployment definitions
└── docs/
```

Directories are introduced only when their approved milestone begins.

## 7. Web application

Stack: Next.js, TypeScript, React, Tailwind CSS.

Current routes cover landing, `/welcome` onboarding, `/setup` extension guide,
Career Profile, Resumes, manually captured Jobs/Job Intelligence, and
Applications list/detail/status/manual recovery.

Implemented primary navigation:

- Jobs
- Applications
- Resumes
- Profile

The Web application handles presentation, interaction, and local UI state. It is
not authoritative for ownership, professional truth, answer policy, or
Application state.

User-facing surfaces should hide implementation vocabulary unless needed for
trust or debugging.

## 8. Backend application

Stack: FastAPI, Python, Pydantic, SQLAlchemy, Alembic.

System endpoints:

- `GET /health` — liveness with required database connectivity;
- `GET /readiness` — database and Clerk JWKS reachability (`ok` or `degraded`).

The API owns:

- authentication-derived user context;
- authorization and ownership;
- core domain behavior;
- persistence and transactions;
- AI task boundaries and validation;
- answer policy;
- Application state; and
- provider/source adapter orchestration.

HTTP handlers should remain thin: validate transport input, establish user
context, invoke an application service, and return a typed contract.

## 9. API contracts

Use authenticated REST/JSON with FastAPI OpenAPI. Requests, responses, errors,
task status, and domain operations use explicit schemas.

Persistence models are not exposed arbitrarily. API contracts protect private
fields and remain stable when storage or external providers change.

Extension endpoints must enforce the same ownership and validation as Web
endpoints. Idempotency is required where retries could duplicate Applications or
other durable records.

The M16 assistant-context endpoint accepts the active URL in a JSON body rather
than a query string and returns only one unambiguous owned Application candidate
plus Resume Version IDs/labels. Full resume content and the complete Application
history are not transferred to the extension for matching.

## 10. PostgreSQL and migrations

PostgreSQL is canonical for structured domain state. Use relational modeling,
foreign keys, ownership indexes, timestamps, constrained values, and transactions.

Alembic manages all schema changes. A planned entity in product documentation is
not permission to add a migration before its milestone.

JSONB may store validated bounded metadata, but not an opaque replacement for
Career Brain, Application, Job, or answer history.

## 11. File storage

Original and generated file artifacts are stored behind a storage abstraction.
PostgreSQL stores ownership and metadata. Storage keys are not authorization.

Current local development uses private local resume storage. A managed object
store may replace it when deployment requirements justify the change.

## 12. Job architecture

The canonical Job is provider-independent. Current manually created Jobs remain
valid.

Implemented boundary:

```text
Job Source
→ Source Adapter
→ provider-neutral normalized candidate
→ deduplication
→ freshness/availability
→ market/country/workplace/employment normalization
→ canonical CareerOS Job
```

The current formation implementation includes a deterministic seed adapter and
canonical ingestion service. Real adapters may eventually support permitted
feeds/APIs, company sites, ATS sources, and extension capture. Manual entry
continues to create canonical Jobs without pretending to be a live source.

Requirements:

- isolate provider-specific schemas;
- preserve source attribution and external identifiers where useful;
- normalize only what the canonical domain requires;
- keep unknown fields unknown;
- avoid obvious duplicates using available stable signals;
- represent freshness without claiming knowledge CareerOS lacks; and
- keep UI locale independent from canonical job market and country; and
- make ingestion retry-safe.

Current product formation may use seed/demo/test jobs. Do not build a generic
ingestion platform, mass scraper, or source plugin framework now.

## 13. Job Intelligence architecture

The implemented flow is:

```text
Job Description
→ immutable Job Snapshot
→ source-grounded Requirements
→ confirmed Career Evidence + selected Resume Version
→ validated matches
→ historical Job Analysis
```

Historical analysis references exact evidence revisions and snapshots. Job
Intelligence is optional and does not gate Apply or extension assistance.

## 14. Extension architecture

Approved stack direction: React, TypeScript, Chrome Manifest V3.

Implemented M10–M13 components plus the post-M17 in-page assistant:

- background service worker;
- content scripts injected on demand via `activeTab`, `scripting`, and
  `chrome.scripting.executeScript` (not declared in manifest `content_scripts`);
- in-page Application Assistant mounted in an open Shadow DOM host after
  explicit activation;
- compact popup;
- authenticated API client;
- application-page detector;
- supported/unsupported popup state;
- generic form inspector and provider-neutral form contracts;
- isolated Greenhouse, Lever, and Ashby adapter boundaries;
- aggregate form-inspection status in the popup;
- a background-only authenticated Answer Engine request;
- aggregate answer-decision status without exposing answer values before user
  execution;
- an exact bounded fill plan and provider-neutral executor; and
- visible per-field review state with non-overwrite and no-submit safeguards.

Planned extension work includes user-controlled file upload and broader dynamic
custom-widget support when validated.

M10/M11 inspection reads only narrowly scoped active-tab structure. M12 requests
canonical answers and policy decisions from the backend. M13 changes supported
blank controls only after explicit user action. The in-page assistant reuses the
same privileged background boundary; it does not receive credentials or raw
Career Brain content. The extension does not store a duplicate Career Brain or
become an independent backend.

### In-page assistant

The assistant is a controlled UI panel, not a general-purpose conversational AI
agent. It is not injected on every page load. The user activates it on the
active tab through the popup action or the `activate-assistant` command
(`Command/Ctrl+Shift+K`), which sends a `CAREEROS_ACTIVATE_ASSISTANT` message.
Activation injects `content.js` via `chrome.scripting.executeScript` if needed,
mounts an open Shadow DOM host (style isolation only, not a security boundary),
and exposes the same detection, answer, fill, and Application Memory flows as
the popup. Page navigation clears stale form state. Permissions are `activeTab`,
`cookies`, `scripting`, and `storage` — not `<all_urls>`.

### Trust boundary

Page JavaScript and content are untrusted. Privileged credentials remain in the
background service worker and are not exposed to the page or content script.
Messages are typed and validated, privileged requests from content scripts are
rejected, and host access is granted only to the active tab on user action.

The extension must support an application page even when no CareerOS Job or Job
Analysis exists.

## 15. Form and ATS adapter architecture — implemented inspection/execution boundary

```text
Application Page
→ application/form detection
→ Generic or ATS Adapter
→ normalized Form model
→ Answer Engine
→ fill plan
→ form execution
→ user review
```

The M11 adapters provide detection and normalized inspection. Later milestones
may add execution methods. The complete conceptual boundary may provide:

- detect application/form;
- inspect fields/questions;
- map or normalize fields;
- fill supported controls;
- select/upload a resume; and
- recognize a confirmation state where reliable.

Generic behavior is preferred when reliable. Greenhouse, Lever, and Ashby are
initial specific targets. Workday is not an initial V1 exit requirement.

Adapter-specific DOM knowledge stays isolated and fixture-tested. Do not place
all ATS behavior in one monolithic conditional block.

## 16. Normalized form model — implemented

The provider-neutral form model should contain only what Answer Engine and form
execution require, such as:

- field identity and control type;
- visible label/question and options;
- required state;
- normalized/canonical key when known;
- page/form context;
- adapter/source identity; and
- confidence or support metadata.

Raw page content remains untrusted and is not persisted. M11 inspection does not
read current values; M13 execution reads them only inside the active page to
avoid overwriting user input. Values are not returned to CareerOS. The concrete
contracts are documented in `docs/FORM_MODEL.md` and
`docs/FORM_EXECUTION.md`.

## 17. Answer Engine architecture — implemented foundation

The Answer Engine is a backend product service reusable outside the extension.

```text
Normalized field/question
→ deterministic classifier first
→ semantic classifier if necessary
→ source retrieval
→ answer policy
→ confidence/sensitivity decision
→ Fill / Suggest / Ask / Confirm / Unknown
```

Current sources are authenticated identity email, confirmed `UserContactInfo`
(when `confirmed_at` is set), one unambiguous Education, one explicit current
Experience, and an explicitly selected owned Resume Version.

Deterministic contact mappings use source category `USER_CONTACT_INFO`:

- `PERSON_FIRST_NAME` → `first_name`
- `PERSON_LAST_NAME` → `last_name`
- `PERSON_FULL_NAME` → `first_name` + `last_name` when both exist
- `CONTACT_PHONE` → `phone`
- `ADDRESS_LINE_1` → `address_line_1`
- `ADDRESS_LINE_2` → `address_line_2`
- `ADDRESS_CITY` → `city`
- `ADDRESS_REGION` → `region`
- `ADDRESS_POSTAL_CODE` → `postal_code`
- `ADDRESS_COUNTRY` → `country_code`
- `PROFESSIONAL_LINKEDIN_URL` → `linkedin_url`
- `PROFESSIONAL_PORTFOLIO_URL` → `portfolio_url`

Missing preferences, reusable answers, and Application context remain unknown
until their approved domains exist. Names are not derived from email.

Policy must distinguish professional truth, preferences, reusable answers,
application-specific answers, and sensitive answers.

AI does not own authorization or policy. Sensitive and consequential categories
require deterministic guardrails and explicit user origin. Unknown remains
unknown.

M12 decisions are transient and no answer or decision is persisted. In M13,
content scripts receive a proposed value only for an approved `FILL` after the
user requests execution; they never receive CareerOS credentials. See
`docs/ANSWER_ENGINE.md` and `docs/FORM_EXECUTION.md`.

## 18. Application architecture — implemented domain/API

Application is the canonical record of application work and history.

It must support both:

- an Application linked to a CareerOS Job; and
- an Application originating from an external page without prior CareerOS
  discovery or analysis.

Application references the exact Resume Version and preserves approved answer
history, external/canonical job context, status, and timestamps.

Creation and update operations must be transactionally safe and idempotent across
extension retries. Later profile, Job, resume, or reusable-answer changes do not
silently rewrite history.

M14 implements this with Application, immutable Application Answer, and
Application Operation tables. Create and status-update requests require UUID
idempotency keys and reject reuse with different payloads. Current answer
persistence accepts only explicitly confirmed standard/non-sensitive values;
sensitive retention remains unapproved. See `docs/APPLICATION_MEMORY.md`.

## 19. Authentication and authorization

The current Web/API uses Clerk-backed identity mapped to an internal User.
Provider coupling stays at the authentication boundary.

The extension uses Clerk Sync Host and a background service worker to obtain a
short-lived session token and call the protected API. It does not collect raw
passwords or expose tokens to page scripts.

Every user-owned resource enforces ownership server-side, including files,
nested IDs, evidence returned by AI, answers, and extension-originated requests.

## 20. Security and prompt injection

Untrusted inputs include resumes, job descriptions, external source data, web
pages, forms, metadata, and model output.

Controls include:

- size/type/resource limits;
- separation of trusted instructions and untrusted data;
- explicit schemas;
- least-privilege extension permissions;
- ownership validation;
- sensitive-answer policy;
- no private content in logs by default;
- bounded retries and idempotency; and
- no tool privilege granted because untrusted content requests it.

Security begins in the milestone where each risk appears; it is not deferred to
final hardening.

## 21. AI layer

Use task-oriented internal interfaces and thin provider adapters. The provider
layer handles authentication, translation, retries, usage metadata, and errors.

Structured outputs pass schema, ownership, identifier, and grounding validation.
Prompts are versioned product logic. Do not scatter provider calls through routes
or UI components.

## 22. Background work

Long-running resume parsing, job normalization, future ingestion, or analysis may
use explicit database-backed task records and a simple worker when required.

Task behavior should be idempotent, retry-bounded, observable, and safe against
duplicate durable outputs. Redis/Celery or distributed queues require measured
need.

## 23. Shared contracts

A small TypeScript shared package may hold frontend-safe normalized form, API,
or adapter contracts when it materially reduces duplication between Web and
extension. OpenAPI may generate or validate clients.

Business invariants remain authoritative in the backend; sharing types must not
duplicate domain logic across languages.

## 24. Observability and privacy

Correlate Web/API/extension and future task operations with request, task,
application, and safe resource IDs. Record versions, adapter identity, latency,
retry, validation, and failure category where useful.

Do not log resumes, Career Brain content, page/form content, application answers,
tokens, or sensitive data by default. Send only task-relevant data to AI
providers.

## 25. Testing strategy

- Unit tests: domain rules, answer policy, mappings, normalization, transitions.
- Integration tests: PostgreSQL, migrations, ownership, idempotency, APIs.
- AI evaluation: extraction, matching, grounding, unknown and sensitive policy.
- Job-source fixtures: normalization, deduplication, freshness, failure.
- ATS/form fixtures: detection, normalized model, filling, graceful unsupported
  behavior, hostile page content.
- End-to-end: both CareerOS Jobs and external-job application scenarios.

Tests must verify that final submission is not automated.

## 26. Explicit non-goals

Without measured need and explicit approval, do not introduce:

- microservices;
- Kubernetes;
- Kafka or generic event infrastructure;
- service mesh;
- Neo4j;
- standalone vector database;
- generalized plugin framework;
- multi-region architecture; or
- generalized autonomous-agent infrastructure.

## 27. Architecture review checklist

Before implementation, verify:

1. Is the behavior in the approved current milestone?
2. Is each concept core domain truth or product-service state?
3. Does Apply Anywhere work without a pre-existing Job Analysis?
4. Are provider and ATS schemas isolated behind adapters?
5. Are unknown and sensitive answers handled by explicit policy?
6. Is user ownership enforced for every resource/reference?
7. Are historical evidence, resume, analysis, and application records stable?
8. Is untrusted content separated from trusted instructions?
9. Are retries idempotent and failures recoverable?
10. Is the infrastructure proportional to current requirements?
