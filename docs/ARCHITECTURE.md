# CareerOS Core V1 — Technical Architecture

> Version: 0.3
> Status: Approved V1 re-baseline
> Last Updated: 2026-09-24

## 1. Purpose

This architecture supports the V1 product spine:

```text
KNOW ME → DISCOVER → APPLY ANYWHERE → REMEMBER
                         ↘
                       ENHANCE (optional)
```

It preserves working M0–M11 behavior while defining minimal extension points for
Jobs discovery, application assistance, Answer Engine, and Application Memory.

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
  UI; and
- provider-neutral read-only form inspection with generic, Greenhouse, Lever,
  and Ashby adapter boundaries, deterministic canonical keys, and explicit
  support/confidence states.

Current Alembic head: `0008_m9_job_source_boundary`.

Not implemented today:

- production job-source ingestion;
- Answer Engine or autofill;
- Application domain; or
- Application Strategy/resume tailoring.

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

The extension foundation and normalized form/ATS adapter boundary are
implemented. Answer Engine, autofill, and Application Memory boundaries remain
planned.

## 5. Core domains vs product services

### Core domains

- Identity
- Career Brain
- Career Evidence
- Resume
- Job
- Application (planned)

### Product services/workflows

- Job Discovery (planned)
- Autofill (planned)
- Answer Engine (planned)
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

Current routes cover system status, Career Profile, Resumes, manually captured
Jobs/Job Intelligence, and the planned-state Applications surface.

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

The API owns:

- authentication-derived user context;
- authorization and ownership;
- core domain behavior;
- persistence and transactions;
- AI task boundaries and validation;
- future answer policy;
- future Application state; and
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

Implemented M10–M11 components:

- background service worker;
- content scripts;
- compact popup and/or side panel;
- authenticated API client;
- application-page detector; and
- supported/unsupported popup state;
- generic form inspector and provider-neutral form contracts;
- isolated Greenhouse, Lever, and Ashby adapter boundaries; and
- aggregate form-inspection status in the popup.

Planned components are the Answer Engine, form execution, and review state.

M10 reads only narrowly scoped active-tab signals needed for page detection.
Later milestones may request canonical answers and policy decisions from the
backend and execute supported page changes. The extension does not store a
duplicate Career Brain or become an independent backend.

### Trust boundary

Page JavaScript and content are untrusted. Privileged credentials remain in the
background service worker and are not exposed to the page or content script.
Messages are typed and validated, privileged requests from content scripts are
rejected, and host access is granted only to the active tab on user action.

The extension must support an application page even when no CareerOS Job or Job
Analysis exists.

## 15. Form and ATS adapter architecture — implemented inspection boundary

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

Raw page content remains untrusted and is not persisted in M11. Current field
values are never read. The concrete contract and limits are documented in
`docs/FORM_MODEL.md`.

## 17. Answer Engine architecture — planned

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

Sources may include confirmed Career Brain/profile data, application preferences,
reusable confirmed answers, selected Resume Version, and current Application
context.

Policy must distinguish professional truth, preferences, reusable answers,
application-specific answers, and sensitive answers.

AI does not own authorization or policy. Sensitive and consequential categories
require deterministic guardrails and explicit user origin. Unknown remains
unknown.

## 18. Application architecture — planned

Application becomes the canonical record of application work and history.

It must support both:

- an Application linked to a CareerOS Job; and
- an Application originating from an external page without prior CareerOS
  discovery or analysis.

Application references the exact Resume Version and preserves approved answer
history, external/canonical job context, status, and timestamps.

Creation and update operations must be transactionally safe and idempotent across
extension retries. Later profile, Job, resume, or reusable-answer changes do not
silently rewrite history.

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
