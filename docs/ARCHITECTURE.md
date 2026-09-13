# CareerOS Core V1 — Technical Architecture

> Version: 0.1
> Status: Draft
> Last Updated: 2026-09-13
> Product: CareerOS

---

# 1. Purpose

This document defines the intended technical architecture for CareerOS Core V1.

The architecture must support the primary product loop:

Career Brain
→ Job Capture
→ Job Intelligence
→ Evidence Matching
→ Application Intelligence
→ Resume Tailoring
→ Application Assistant
→ Application Memory

The architecture should be:

- simple enough for fast V1 development,
- reliable enough for real user data,
- modular enough for AI iteration,
- compatible with browser extension workflows,
- and extensible without prematurely building future infrastructure.

CareerOS should begin as a well-structured modular application, not a distributed system.

---

# 2. Architecture Principles

## 2.1 Modular Monolith First

CareerOS Core V1 should use a modular monolith architecture.

The system may contain separately deployable web, API, extension, and worker processes, but business logic should not be fragmented into microservices.

Avoid premature:

- microservices,
- service mesh,
- Kubernetes,
- event-driven distributed architecture,
- Kafka,
- complex RPC systems.

The product is not yet operating at a scale that justifies these systems.

---

## 2.2 Clear Domain Boundaries

Code should reflect the major CareerOS domains:

- Career Brain
- Resume
- Job
- Intelligence
- Application
- AI
- Browser Extension

Boundaries should exist in code even if they share one backend application.

---

## 2.3 Canonical Structured Data

PostgreSQL is the canonical store for structured CareerOS data.

AI output must not become the only representation of important product state.

Important concepts should be represented using validated structured records.

---

## 2.4 AI Is a Dependency, Not the Architecture

The application must remain functional as a software system independent of any one model vendor.

AI should be accessed through an internal abstraction layer.

Business logic should not contain scattered provider-specific API calls.

---

## 2.5 Evidence Is First-Class

Architecture must preserve relationships between:

Career Evidence

Job Requirements

Evidence Matches

Resume Recommendations

Applications

The architecture must make evidence validation possible.

---

## 2.6 Deterministic Logic Before AI

Do not use AI for tasks that can be reliably performed through conventional software.

Examples:

- retrieving email,
- mapping known form fields,
- application status,
- authorization,
- evidence ownership validation.

Use AI when semantic understanding is genuinely required.

---

## 2.7 Progressive Complexity

Start with the simplest system that correctly supports CareerOS Core V1.

Introduce additional infrastructure only when a measured product or engineering need exists.

---

# 3. High-Level System Architecture

CareerOS Core V1 consists of the following primary components:
```text
                    ┌──────────────────────┐
                    │      Web App         │
                    │ Next.js + TypeScript │
                    └──────────┬───────────┘
                               │
                               │ HTTPS / REST
                               │
                    ┌──────────▼───────────┐
                    │     Backend API      │
                    │  FastAPI + Python    │
                    └──────────┬───────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
              ▼                ▼                ▼
       PostgreSQL        Object Storage       AI Layer
              │                                  │
              │                                  ▼
              │                           Model Provider(s)
              │
              ▼
        Background Jobs
              ▲
              │
              │
    ┌─────────┴──────────┐
    │ Browser Extension  │
    │ React + TypeScript │
    │ Chrome Manifest V3 │
    └────────────────────┘
```

The Web App and Browser Extension communicate with the Backend API over authenticated HTTPS. The Backend API owns domain behavior and canonical state. PostgreSQL stores structured records, Object Storage preserves file artifacts, the AI Layer mediates semantic tasks, and a simple Worker processes asynchronous work.

The initial system should remain understandable as one product even when Web, API, Worker, and Extension are separate runtime or distribution units.

---

# 4. Repository Direction

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
│   └── shared/
├── tests/
│   └── fixtures/
└── infra/
```

Not every directory must exist immediately. Directories should be introduced when their approved milestone begins or when they materially simplify the current foundation.

Conceptually:

- `apps/web` contains the Next.js web application.
- `apps/api` contains the FastAPI backend and worker entry points.
- `apps/extension` contains the browser extension.
- `packages/shared` contains frontend-safe shared contracts where useful.
- `tests/fixtures` contains reusable fixtures, including representative resumes, jobs, and ATS pages.
- `infra` contains only the infrastructure definitions needed for approved environments.

Repository organization should make domain ownership clear without forcing artificial package boundaries.

---

# 5. Core Domain Boundaries

The modular monolith should preserve the following conceptual boundaries.

## 5.1 Career Brain

Owns structured professional truth, provenance, confirmation state, career evidence, application information, and career preferences.

## 5.2 Resume

Owns resume assets, structured resume content, versions, source relationships, rendering, exports, and links between resume claims and Career Evidence.

## 5.3 Job

Owns captured opportunities, source content, normalized job data, and structured Job Requirements.

## 5.4 Intelligence

Owns Job Analysis, evidence retrieval, Evidence Matches, hidden evidence detection, application recommendations, and Application Strategy.

## 5.5 Application

Owns application records, the exact Resume Version used, strategy references, answers, state, and history.

## 5.6 AI

Owns task-oriented AI interfaces, provider adapters, structured output validation, prompt versions, and grounding validation.

## 5.7 Browser Extension

Owns page detection, extraction, form inspection, supported autofill, lightweight contextual UI, and communication with the Backend API.

These domains may share a database and deployment unit. They should communicate through explicit application services and contracts rather than reaching across boundaries unpredictably.

---

# 6. Web Application

The Web App is the CareerOS command center.

The approved V1 stack is:

- Next.js,
- TypeScript,
- React,
- Tailwind CSS.

The Web App is responsible for:

- onboarding,
- Career Brain review and management,
- Resume Library and tailoring workflows,
- detailed Job Intelligence,
- Application Intelligence,
- Jobs and Applications views,
- settings,
- and user-visible progress and recovery states.

Conceptual routes may include:

```text
/login
/onboarding
/dashboard
/profile
/resumes
/jobs
/applications
/settings
```

These routes describe product areas, not a locked routing implementation.

Business rules must remain in backend domain or application services rather than being duplicated in UI components. The Web App may perform presentation validation and local interaction logic, but it must not become an independent source of Career Brain, evidence, application, or authorization truth.

---

# 7. Backend Application

The Backend API is the authoritative application boundary for CareerOS data and business behavior.

The preferred V1 backend stack is:

- FastAPI,
- Python,
- Pydantic,
- SQLAlchemy,
- Alembic.

The internal modular layout should conceptually support:

```text
api/
domain/
services/
ai/
db/
jobs/
core/
```

The exact package structure may be refined during implementation planning.

Conceptual responsibilities are:

- `api/` — HTTP routes, request parsing, response schemas, and transport concerns.
- `domain/` — domain concepts, invariants, and stable business rules.
- `services/` — application workflows coordinating domains and infrastructure.
- `ai/` — task contracts, prompts, provider adapters, and AI validation.
- `db/` — persistence models, repositories, sessions, and migrations.
- `jobs/` — asynchronous task records and worker behavior.
- `core/` — configuration, security primitives, logging, and shared backend infrastructure.

HTTP handlers should remain thin. They should validate the request, establish user context, call an application service, and return a typed response.

---

# 8. API Style and Contracts

CareerOS Core V1 should use REST over HTTPS with JSON payloads.

FastAPI should expose an OpenAPI description that can support API documentation and typed client generation or validation.

The API should use explicit schemas for:

- requests,
- responses,
- errors,
- asynchronous task status,
- and structured domain operations.

Database persistence models must not be exposed directly as arbitrary API models. API contracts should reflect product behavior, protect private fields, and remain stable when physical storage changes.

GraphQL should not be introduced unless a real product or engineering need appears.

API evolution should favor additive, typed changes and explicit compatibility decisions.

---

# 9. PostgreSQL and Structured Persistence

PostgreSQL is the canonical structured source of truth for CareerOS Core V1.

Core entities defined by the domain model should live in PostgreSQL, including:

- User ownership references,
- Career Brain entities and confirmation state,
- Career Evidence references,
- Resumes and Resume Versions,
- Jobs and Job Requirements,
- Job Analyses and Evidence Matches,
- Application Strategies and Resume Recommendations,
- Applications, answers, and statuses,
- asynchronous job records,
- and relevant AI version metadata.

The physical schema should prefer:

- relational modeling,
- explicit foreign keys,
- server-enforced ownership boundaries,
- stable enums or constrained values where concepts are stable,
- timestamps and historical references where required,
- and transactions around related state changes.

JSONB may be used when flexibility provides meaningful value, such as validated intermediate structured content or provider-neutral metadata. It must not turn the entire Career Brain or all important AI output into opaque documents.

Alembic should manage schema evolution. Migration design belongs to implementation planning and must follow the approved logical data model.

---

# 10. Semantic Retrieval

CareerOS Core V1 does not require a standalone vector database.

Evidence retrieval should develop in this order:

1. structured and direct domain relationships,
2. normalized terminology and conventional text retrieval,
3. embeddings only when evaluation demonstrates a meaningful need.

If embedding retrieval becomes justified, PostgreSQL with `pgvector` is preferred before introducing external vector infrastructure.

Embeddings are an index over evidence, not the canonical evidence store. The referenced Career Brain records remain authoritative.

Retrieval is not proof. A retrieved item is only a candidate for Evidence Evaluation. The system must still validate relevance, confirmation state, ownership, context, and the strength of support before classifying a requirement or generating a claim.

---

# 11. Object Storage

Object Storage should preserve file artifacts, including:

- original uploaded resumes,
- generated resume artifacts,
- exported files,
- and other approved document outputs.

PostgreSQL should store references and metadata such as ownership, content type, size, hash, creation source, and related Resume Version.

Object keys and download access must not be treated as authorization. Access should be mediated through server-side ownership checks or appropriately scoped temporary access.

Original user artifacts should be preserved where required by the product flow. Generated artifacts must remain connected to their structured source and historical Resume Version.

---

# 12. Resume Ingestion and Resume Architecture

## 12.1 Ingestion Pipeline

The approved conceptual ingestion pipeline is:

Upload
→ Store Original
→ Extract Content
→ Structured Parse
→ Validate
→ Career Brain Draft
→ User Review
→ User Confirmation

Each stage should preserve enough status and error information for the user to recover without re-entering unrelated data.

The original artifact should be stored before lossy parsing. Extracted and AI-parsed information remains a draft until the product's confirmation rules are satisfied.

AI parsing must never silently overwrite confirmed Career Brain truth. Conflicts or uncertain extraction should be surfaced for review.

## 12.2 Resume Representation

CareerOS should preserve three related concerns:

- the original file artifact,
- a validated structured resume representation,
- and historically preserved Resume Versions.

The Career Brain remains separate from all three. Resume content selects and presents Career Brain evidence.

## 12.3 Resume Generation

Resume generation should follow:

Structured Content
→ Renderer
→ Export

An LLM may recommend or rewrite evidence-grounded content. It should not directly generate arbitrary PDF layout as the canonical resume representation.

Rendering should be deterministic enough to reproduce an accepted Resume Version. Exported files should reference that version, and historical applications should continue to reference the exact version used.

---

# 13. AI Layer

The AI Layer should expose task-oriented internal interfaces such as:

- `parse_resume`,
- `parse_job`,
- `retrieve_evidence`,
- `evaluate_evidence`,
- `recommend_application`,
- `create_application_strategy`,
- `generate_resume_recommendation`,
- `rewrite_resume_claim`,
- `classify_form_field`.

These are logical responsibilities. They do not require one service, class, or model call per task.

Domain and application services should depend on these internal task contracts rather than provider-specific APIs.

## 13.1 Provider Adapter

The provider adapter should handle:

- authentication,
- model request and response translation,
- provider-specific retries,
- usage metadata,
- model selection,
- and normalized provider errors.

The abstraction should remain thin. CareerOS should not build a generalized AI framework before the product requires one.

## 13.2 Structured Outputs

AI operations that drive product logic should return validated structured outputs.

Validation must include, where relevant:

- schema conformance,
- allowed enum values,
- referenced entity existence,
- user ownership,
- evidence eligibility,
- evidence compatibility,
- and task-specific invariants.

Invalid output should be rejected, safely repaired, or regenerated. It must not be persisted or acted upon blindly.

## 13.3 Prompt Management

Prompts are versioned product logic.

They should live in dedicated task prompt modules rather than being scattered through UI components, routes, or unrelated services.

Persisted AI outputs should record the relevant task or prompt version when that information is needed to explain results or detect staleness.

Provider selection and prompt content should remain separable.

---

# 14. Grounding Validation

Grounding validation is a required boundary between AI generation and accepted product output.

For professional claims and important recommendations, validators should check where applicable:

- evidence references exist,
- evidence belongs to the current user,
- evidence is eligible and confirmed as required,
- evidence belongs to a compatible context,
- metrics are explicitly supported,
- technologies are supported,
- ownership and seniority are not inflated,
- prototype, coursework, or local work is not silently converted into production experience,
- and unrelated evidence is not combined into a false claim.

Conceptually:

Generated Claim
→ Validate Evidence IDs
→ Validate Ownership
→ Validate Context
→ Validate Protected Facts
→ Accept or Reject

Grounding validation may combine deterministic checks with narrowly scoped AI evaluation. Deterministic checks should enforce everything that can be enforced reliably.

---

# 15. Background Jobs

Resume parsing and job analysis may be asynchronous because they can involve file processing, AI calls, validation, and multiple persisted outputs.

The initial V1 approach should use:

- database-backed task or job records,
- a simple worker process,
- explicit task types,
- persisted input references,
- and persisted lifecycle state.

Initial statuses are:

- `pending`,
- `processing`,
- `completed`,
- `failed`.

## 15.1 Task Lifecycle

A worker should safely claim eligible work, mark it processing, execute the task, validate results, and persist either completion or failure.

The design should include:

- idempotency for retryable operations,
- safe task claiming so work is not unintentionally processed concurrently,
- bounded retry behavior for transient failures,
- persisted attempt and failure information,
- recovery from abandoned processing state,
- and user-visible progress or status.

Retries must not duplicate Resume Versions, Job Analyses, or other durable outputs.

## 15.2 Queue Boundary

Redis and Celery should not be introduced unless measured throughput, latency, scheduling, or operational needs justify them.

The task contract should be explicit enough that the queue implementation can evolve later without moving domain rules into queue handlers.

---

# 16. Authentication and Authorization

## 16.1 Authentication

The exact authentication provider may be selected during implementation planning.

The architecture must support:

- web authentication,
- backend identity verification,
- browser extension authentication,
- secure sessions or tokens,
- expiration and revocation behavior,
- and safe sign-out.

The CareerOS domain model must not be tightly coupled to one authentication vendor. Provider identity should map to the internal User ownership context.

The browser extension should use an approved authentication flow. It must not collect or store the user's raw password.

## 16.2 Authorization

Every user-owned resource must enforce ownership server-side.

This includes:

- Career Brain records,
- Career Evidence,
- resumes and files,
- jobs and analyses,
- application strategies,
- applications and answers,
- asynchronous tasks,
- and generated artifacts.

Frontend hiding is not authorization.

Ownership checks must apply to direct identifiers, nested relationships, object-storage access, and IDs returned by AI. An AI-supplied Evidence ID must be verified to exist, belong to the current user, and be valid for the current task before it is accepted.

---

# 17. Browser Extension Architecture

The approved extension stack is:

- React,
- TypeScript,
- Chrome Manifest V3.

The extension should conceptually contain:

- a background service worker,
- content scripts,
- a popup and/or side panel,
- ATS adapters,
- an authenticated API client,
- and shared schemas or types where useful.

## 17.1 Responsibilities

The extension is responsible for:

- detecting supported job pages,
- extracting job context,
- presenting lightweight contextual information,
- launching full CareerOS analysis,
- detecting and inspecting application forms,
- performing supported autofill,
- and reporting clear unsupported or failure states.

The extension is not a second CareerOS backend. Canonical Career Brain, Job, Analysis, Resume, and Application state remains in the Backend API and PostgreSQL.

## 17.2 Trust Boundary

Web page content is untrusted. Content scripts should collect narrowly scoped page data and send structured messages across explicit extension boundaries.

Long-lived privileged credentials must not be exposed to page JavaScript or stored unnecessarily in content scripts.

Host permissions should be minimized and expanded only for approved supported workflows.

Messages between page-facing code, extension components, and the backend should be validated.

---

# 18. Job Detection and ATS Adapters

## 18.1 Layered Job Detection

Job detection should use a layered approach:

ATS-Specific Adapter
→ Structured Metadata
→ DOM Extraction
→ Generic Fallback
→ AI Fallback Only When Justified

Deterministic structured sources should be preferred over AI interpretation. The extension should report uncertainty or failure rather than claiming successful extraction from unreliable content.

## 18.2 Adapter Contract

An ATS adapter should conceptually support capabilities such as:

- `detect`,
- `extract_job`,
- `detect_form`,
- `map_fields`,
- `fill_field`,
- `upload_resume`.

Not every adapter must support every capability immediately. Unsupported capabilities should be explicit.

Adapter-specific DOM knowledge should remain isolated behind the adapter boundary and be covered by representative fixtures.

## 18.3 Initial Coverage Direction

The initial direction is:

1. Generic limited fallback,
2. Greenhouse,
3. Lever,
4. Ashby.

Workday may be added later after the adapter architecture is validated. Workday is not a CareerOS Core V1 exit criterion and must not block the Golden Path on the approved initial environments.

---

# 19. Autofill and Answer Resolution

The Application Assistant autofill pipeline is:

Detect Fields
→ Classify Field
→ Map Canonical Key
→ Resolve Answer
→ Apply Safety and Confidence Rules
→ Fill Supported Field
→ User Review

Known fields should use deterministic mappings. AI field classification may be used when wording or structure requires semantic interpretation.

## 19.1 Answer Resolution Priority

Answer resolution should follow this priority:

1. explicit Career Brain or Application Information,
2. saved user-confirmed Reusable Application Answer,
3. deterministic display value derived from confirmed data,
4. allowed AI suggestion,
5. unknown.

An application-specific answer must not automatically become a reusable answer without user intent.

When confidence is insufficient, the field should remain unresolved or require review.

## 19.2 Consequential Fields

AI must not infer protected, sensitive, legal, or consequential attributes and answers, including demographic disclosures, disability, veteran status, work authorization, sponsorship, salary expectations, legal attestations, or signatures.

Such values may only be reused according to approved product behavior when they originate from explicit user input.

## 19.3 Submission Boundary

CareerOS Core V1 does not automatically perform final application submission.

The user reviews the application and performs the final intentional submit action.

---

# 20. Application Architecture

The Backend API is the canonical source for Application state.

An Application should retain references to:

- the Job,
- the relevant Application Strategy,
- the exact Resume Version used,
- application-specific answers where retained,
- current status,
- and historical timestamps or state context required by the approved product model.

Application state transitions should remain simple and explicit:

```text
Preparing
Applied
Assessment
Interview
Final Round
Rejected
Offer
Withdrawn
```

The initial implementation may store current status plus relevant timestamps while preserving a reasonable path to status history.

Later Career Brain or Resume changes must not mutate the historical Resume Version or application context used for an earlier application.

---

# 21. Shared Contracts and Server State

A TypeScript shared package may contain frontend-safe types, constants, and schemas when this reduces duplication between the Web App and Browser Extension.

OpenAPI may generate or validate TypeScript API client types.

Business logic must not be duplicated between TypeScript and Python merely to share types. The Backend API remains authoritative for domain invariants, authorization, grounding, and state transitions.

Canonical server state belongs in the Backend API and PostgreSQL.

Local UI state should remain local to the relevant interface. The Browser Extension may cache small amounts of temporary context, but it must not become a second source of truth.

---

# 22. Caching and Staleness

Caching should remain simple and explicit.

Good initial candidates include stable or expensive outputs such as:

- extracted content for an unchanged resume,
- structured parsing for an unchanged file,
- parsed Job Requirements for an unchanged job description,
- and analysis intermediates whose source versions have not changed.

File hashing may help avoid repeated parsing of identical files.

Cache invalidation should consider the source versions that affect an output, including:

- Career Brain changes,
- confirmation-state changes,
- selected Resume Version changes,
- Job Description changes,
- prompt or task version changes,
- model or matching version changes where material.

Persisted metadata should allow CareerOS to determine when a Job Analysis, Evidence Match, Application Strategy, or Resume Recommendation may be stale.

A stale result should not be silently represented as current.

---

# 23. Observability and Error Handling

## 23.1 Observability

The system should support correlation across synchronous requests, asynchronous jobs, and AI tasks using information such as:

- request IDs,
- task IDs,
- user-safe resource IDs,
- AI task and prompt versions,
- model and provider metadata,
- latency,
- retry counts,
- validation outcomes,
- and failure categories.

Private resume, Career Brain, job application, and sensitive answer content should not be logged by default.

## 23.2 Error Categories

The architecture should distinguish failures such as:

- user input failure,
- upload or file validation failure,
- extraction or parsing failure,
- AI provider failure,
- structured output or grounding validation failure,
- authentication failure,
- authorization failure,
- extension extraction failure,
- unsupported job page or form,
- and persistence failure.

Error responses should be typed enough for the Web App and Extension to provide useful recovery actions.

Retry should be limited to operations that are safe and plausibly transient. Idempotency must prevent duplicate durable outputs. Failures should preserve original files, confirmed Career Brain truth, captured Jobs, and accepted Resume Versions.

---

# 24. Security

Security is part of every relevant milestone and must not be postponed entirely to final hardening.

Core V1 requires practical controls including:

- HTTPS,
- authentication,
- server-side authorization,
- secure session or token handling,
- secret management,
- file type and size validation,
- safe file processing,
- safe object-storage access,
- common web protections,
- dependency and configuration hygiene,
- and least-privilege access.

Uploaded documents and web content should be processed with explicit size and resource limits. File names, MIME declarations, extensions, and extracted content must not be treated as trusted merely because a user uploaded them.

Extension permissions, storage, and messaging must follow least privilege. Backend endpoints used by the extension require the same ownership and validation controls as web endpoints.

Security-sensitive events and failures should be observable without logging private document content.

---

# 25. Prompt Injection and Untrusted Content

The following inputs are untrusted:

- resumes,
- job descriptions,
- web pages,
- application forms,
- extracted metadata,
- and text produced by external systems.

Prompt injection protection must begin when resume or job AI processing begins. It is not deferred to the final hardening milestone.

Untrusted content must never override trusted system or task instructions.

CareerOS should not concatenate arbitrary page or document text into privileged instructions. AI tasks should receive clearly separated structured inputs, narrowly scoped context, and explicit output schemas.

Provider output must still pass schema, ownership, evidence, and grounding validation. Instructions found inside a resume, job description, page, or form are data unless the approved CareerOS task explicitly treats them otherwise.

Tool access, if introduced for an AI task, should be narrowly scoped and must not be granted merely because untrusted content requests an action.

---

# 26. Privacy

CareerOS should minimize the collection, transmission, logging, and retention of private career and application information.

Privacy principles include:

- send only task-relevant data to AI providers,
- avoid transmitting the entire Career Brain when a narrower evidence set is sufficient,
- avoid private content in logs and error reports,
- restrict access to uploaded and generated files,
- support correction and deletion behavior required by the product,
- preserve user ownership and isolation,
- and treat sensitive application answers with additional care.

Provider requests should be assembled around the current task and validated evidence context. Operational metadata should be separated from private content where practical.

Historical application preservation must be balanced with approved correction and deletion behavior. The exact retention policy requires an explicit product and legal decision rather than an architectural guess.

---

# 27. Testing Strategy

CareerOS Core V1 should use complementary testing layers.

## 27.1 Unit Tests

Cover domain rules, state transitions, deterministic field mappings, validators, normalization, authorization decisions, and other isolated logic.

## 27.2 Integration Tests

Cover API and PostgreSQL behavior, migrations, object-storage boundaries, authentication verification, ownership enforcement, asynchronous task lifecycle, and provider-adapter boundaries.

## 27.3 AI Evaluation Tests

Use representative Career Brain, resume, and job cases to evaluate parsing, evidence retrieval, classification, hidden evidence, genuine gaps, grounding, context mixing, and hallucination resistance.

AI evaluation should test product correctness, not only schema validity or fluent prose.

## 27.4 Extension Adapter Fixtures

Use reproducible HTML fixtures for supported ATS and generic pages. Test job detection, extraction, form detection, field mapping, graceful unsupported behavior, and DOM change resilience.

## 27.5 End-to-End Tests

Exercise the approved Golden Path from Career Brain creation through job analysis, application preparation, supported autofill, user review, and Application Memory.

Tests should verify that the user remains in control and that automatic final submission does not occur.

---

# 28. Local Development

The initial local development environment should remain simple.

It should support:

- Web,
- API,
- Worker,
- PostgreSQL,
- and the Extension when its milestone begins.

Object Storage may use a simple approved local-compatible setup or development abstraction when that milestone requires it.

The development experience should minimize the number of commands and external services required to exercise the current vertical slice.

Developers should be able to start required components, verify API health and database connectivity, run tests, and understand failures without hidden manual setup.

---

# 29. Environment Configuration

Runtime configuration should use environment variables or an equivalent approved secret-injection mechanism.

The repository should provide a `.env.example` when implementation begins, containing names and safe example values but no real secrets.

Secrets must not be committed.

The application should fail clearly when required configuration is missing or invalid. Environment-specific values must not be scattered through source code.

Configuration should distinguish local development, tests, and deployed environments without changing domain behavior.

---

# 30. Deployment Direction

CareerOS Core V1 should prefer managed services and simple independent deployment units:

- Web,
- API and Worker,
- PostgreSQL,
- Object Storage,
- Browser Extension distribution.

API and Worker may share the same application codebase and domain modules while running as distinct processes.

Deployment should support HTTPS, environment configuration, migrations, health checks, logs, and safe access to required managed services.

There is no Kubernetes requirement. Deployment infrastructure should remain proportional to actual traffic, reliability, and operational needs.

Multi-region architecture is not required for V1.

---

# 31. Performance and Cost

CareerOS should prioritize correctness and product reliability before aggressive optimization.

Initial principles are:

- show user-visible progress for long-running AI tasks,
- send narrow task-relevant context to AI providers,
- avoid unnecessary repeated parsing and model calls,
- reuse stable validated intermediates where safe,
- measure latency and usage metadata,
- and preserve graceful recovery from provider or worker failures.

Optimization decisions should be based on observed latency, cost, throughput, and user experience.

Performance shortcuts must not bypass authorization, evidence validation, or grounding checks.

---

# 32. Future Extension Points

The architecture may preserve reasonable extension points for:

- localization,
- personalization based on real application history,
- broader Career Intelligence,
- expanded ATS support,
- and richer outcome learning.

These are not Core V1 implementation requirements.

Future capabilities should build on the existing Career Brain, Career Evidence, Resume Version, Job Analysis, Application Strategy, and Application Memory boundaries rather than creating disconnected systems.

Extension points should consist of clean contracts and stable data relationships, not speculative infrastructure.

---

# 33. Architecture Non-Goals

CareerOS Core V1 explicitly does not require:

- microservices,
- Kubernetes,
- Kafka,
- service mesh,
- Elasticsearch,
- Neo4j,
- a standalone vector database,
- multi-region architecture,
- custom model training infrastructure,
- a feature store,
- a data warehouse,
- a streaming platform,
- or a generalized AI framework.

These systems should not be introduced without a measured need and explicit approval.

---

# 34. First Implementation Slice

The M0 foundation should establish the smallest working system connection:

Web
→ API
→ PostgreSQL

The first product vertical slice after the foundation should be:

Create / Read Career Profile

This validates the primary application boundaries, typed API path, persistence, user ownership, and local development flow before AI or extension complexity is added.

Security basics, configuration validation, tests, and ownership enforcement should begin with the slices that first require them rather than being deferred to final hardening.

---

# 35. Architecture Review Checklist

Before approving an implementation plan, verify:

1. What is the canonical source of truth for each affected concept?
2. Where is user ownership enforced server-side?
3. Can important intelligence and generated claims trace back to valid Career Evidence?
4. Do grounding validators protect metrics, technologies, ownership, seniority, and context boundaries?
5. Are original resumes and historical Resume Versions preserved?
6. Does the Browser Extension maintain a clear trust boundary with untrusted page content?
7. Can asynchronous work fail and retry without corrupting or duplicating durable state?
8. Are resume, job, page, and form contents treated as untrusted against prompt injection?
9. Can the behavior be tested at unit, integration, AI evaluation, adapter-fixture, and Golden Path levels as appropriate?
10. Is local development understandable and proportional to the current milestone?
11. Does the design preserve reasonable future extension without introducing premature infrastructure?
12. Does the user retain control of consequential answers and final submission?

If these questions cannot be answered clearly, the implementation plan should be revised before coding.

---

# 36. Final Architecture Standard

CareerOS should prefer:

- simple infrastructure,
- explicit domain modeling,
- canonical structured state,
- evidence-grounded AI,
- thin provider abstraction,
- reliable and recoverable workflows,
- practical security and privacy from the relevant milestone onward,
- clear extension trust boundaries,
- user control,
- and gradual complexity only when justified.

The architecture succeeds when it supports one complete, intelligent, trustworthy application workflow without obscuring the product behind unnecessary infrastructure.
