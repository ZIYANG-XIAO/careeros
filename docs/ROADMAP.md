# CareerOS — Product and Engineering Roadmap

> Version: 0.2
> Status: Approved V1 re-baseline
> Last Updated: 2026-09-25

## 1. Purpose and authority

This document is the canonical implementation sequence for CareerOS. Product
documents define approved behavior; this roadmap determines when it is built.

The roadmap was re-baselined after M7. Git history and completed implementation
remain unchanged. The old assumption that Application Intelligence and resume
tailoring must immediately precede extension/autofill no longer controls V1.

## 2. Re-baseline decision

The V1 product spine is now:

```text
KNOW ME → DISCOVER → APPLY ANYWHERE → REMEMBER
                         ↘
                       ENHANCE (optional)
```

Why:

- users often already know they want to apply;
- deep job analysis should not be mandatory for routine applications;
- CareerOS should reduce application friction wherever a job was found;
- application history is a core durable product capability; and
- existing Job Intelligence remains differentiated optional value.

The immediate priority is product formation, not deeper optimization.

## 3. Milestone discipline

Each milestone must:

- have a narrow product outcome;
- distinguish implemented behavior from future direction;
- preserve prior functionality and history;
- include security, ownership, privacy, and prompt-injection controls when the
  relevant risk first appears;
- include automated tests and representative product validation;
- avoid unrelated infrastructure or enhancement work; and
- stop before beginning the next milestone.

Preferred rhythm:

```text
Specify → Implement → Test → Validate → Review → Commit → Stop
```

## 4. Completed baseline — M0 through M7

The following milestones are complete in repository history.

### M0 — Project Foundation — completed

Delivered the monorepo, Next.js Web, FastAPI API, PostgreSQL development setup,
configuration, health endpoint, migrations, test/lint tooling, and local setup.

### M1 — Career Brain Foundation — completed

Delivered authenticated user ownership, Career Brain/Profile, Education,
Experience and details, Projects and details, Skills, server-side authorization,
and editable Web UI.

### M2 — Resume Ingestion and Career Brain Draft — completed

Delivered PDF/DOCX upload validation, private asset storage, extraction,
structured parsing, reviewable draft items, provenance/confirmation behavior,
and confirmation into Career Brain evidence.

### M3 — Resume Library and Version Foundation — completed

Delivered Resume, Resume Asset, immutable Resume Version, version/source
relationships, and resume list/detail experiences.

### M4 — Manual Job Capture and Parsing — completed

Delivered manual Job creation, immutable Job Snapshot, source-grounded structured
requirements, required/preferred classification, and Job detail.

### M5 — Evidence Retrieval and Matching — completed

Delivered stable evidence references, confirmed evidence retrieval, evidence
support evaluation, ownership validation, and Strong/Weak/Genuine Gap behavior.

### M6 — Hidden Evidence and Resume Representation — completed

Delivered represented/underrepresented/absent evaluation, Hidden Evidence
classification, immutable evidence-revision snapshots, and dedicated regression
coverage.

### M7 — Job Intelligence Experience — completed

Delivered Job Intelligence creation/list/detail, evidence groups and drill-down,
selected Resume Version context, and explainable Strong Apply/Apply/Stretch/Low
Priority recommendations.

### M0–M7 invariants retained

- Career Brain is not Resume.
- Evidence revisions and Resume Versions preserve history.
- Historical analyses retain exact Job Snapshot, Resume Version, and evidence
  revision attribution.
- Unsupported requirements remain gaps.
- Ownership is enforced server-side.
- Resume and job content is untrusted.

## 5. V1 Formation — Wave A: Product Shell and Jobs

Wave A makes Jobs a primary product surface without blocking on production data
acquisition.

### M8 — Product Shell and Jobs Experience — completed

#### Goal

Create a coherent user-facing shell around Jobs, Applications, Resumes, and
Profile, and make Jobs useful for browsing and action.

#### Deliverables

- primary Web navigation;
- Jobs overview suitable for available/latest jobs;
- search and approved filters;
- Job detail focused on decision/action;
- save job behavior;
- Apply action that does not require Job Intelligence;
- optional entry to existing Job Intelligence; and
- useful loading, empty, stale, and error states.

Seed/demo/test jobs are acceptable during formation. Do not imply they are a
production feed.

#### Acceptance criteria

- a user can browse, search/filter, inspect, save, and choose Apply;
- Apply remains available without analysis;
- existing manually captured jobs and analyses still work;
- navigation uses understandable product language; and
- planned Applications navigation is honest about implementation state.

#### Non-goals

- production multi-source acquisition;
- extension or autofill;
- Application Strategy or resume tailoring.

#### Delivered

Implemented the Jobs-first product shell, manual-data-aware browse/search/location
filtering, durable per-user save state, decision-focused job detail, safe direct
Apply, optional Job Intelligence, and an honest Applications placeholder.
Production job acquisition and the canonical source-adapter boundary remain M9.

### M9 — Canonical Job Source Boundary — completed

#### Goal

Ensure the Job product is provider-independent before real source acquisition.

#### Deliverables

- minimal source-adapter contract;
- provider-neutral normalized Job candidate contract;
- source attribution/external identity needed by current product;
- basic deduplication behavior for stable available signals;
- freshness/availability representation appropriate to V1; and
- seed/demo/test adapter or ingestion path used by the Jobs experience.

#### Acceptance criteria

- the Web product consumes canonical Jobs rather than source-specific payloads;
- current manual Jobs remain valid;
- retries do not create obvious duplicates;
- unknown freshness remains unknown; and
- no generic ingestion framework or mass scraper is introduced.

#### Non-goals

- real U.S./China production ingestion;
- broad provider coverage;
- scraping infrastructure.

#### Delivered

Implemented the narrow job-source adapter contract, provider-neutral normalized
candidate, source/external identity, canonical URL, observed timestamps,
availability/freshness state, deterministic seed adapter, retry-safe ingestion,
stable-signal deduplication, and immutable snapshots for changed descriptions.
Manual Jobs remain valid and the Web consumes only the canonical Job contract.

### Wave A validation gate — Jobs product — completed

Before proceeding aggressively, validate that users understand the product
shell, can find and act on Jobs, and are not forced into Job Intelligence. Refine
the experience if Jobs is merely a data table rather than a useful entry point.

Representative signed-in product validation passed with canonical demo jobs.
Browse, combined search/location filtering, save state, Job detail, honest
source/freshness state, direct Apply, the no-application-link state, and optional
Job Intelligence behavior were verified. See `docs/VALIDATION_WAVE_A.md` for the
scope, evidence, and limitations.

## 6. V1 Formation — Wave B: Extension and Application Assistant

Wave B makes Apply Anywhere real. The external-job path is equal to the
CareerOS-Job path.

### M10 — Extension Foundation and Secure API Boundary — completed

#### Goal

Introduce the Manifest V3 extension and secure communication with CareerOS.

#### Deliverables

- `apps/extension` scaffold;
- Manifest V3 background/content/UI structure;
- approved extension authentication flow;
- authenticated API client;
- minimal host permissions;
- typed/validated extension messages;
- application-page detection framework; and
- compact supported/unsupported UI.

#### Acceptance criteria

- an authenticated user can open the extension on an external page;
- page content cannot access privileged credentials;
- extension/API requests enforce user ownership; and
- no CareerOS Job is required to begin detection.

#### Non-goals

- autofill;
- universal page detection;
- final submission.

#### Delivered

Implemented the Manifest V3 extension scaffold, background/content/popup
boundaries, stable development CRX identity, Clerk Sync Host authentication,
background-only protected API access, least-privilege active-tab injection,
exact message validation, application-page heuristics, and clear application,
ordinary, and unsupported states. Representative signed-in Chrome validation
confirmed protected `/me` access and detection without a CareerOS Job. See
`docs/VALIDATION_M10.md` for evidence and limitations.

### M11 — Form Detection and Normalization — implementation complete

#### Goal

Convert supported external application forms into a provider-neutral model.

#### Deliverables

- application/form detection;
- generic form inspection;
- normalized field/question schema;
- canonical keys for initial supported fields;
- adapter registry/boundary;
- explicit confidence/support states;
- fixture coverage for generic forms and initial target environments; and
- clear unsupported behavior.

#### Acceptance criteria

- supported forms produce stable normalized fields;
- unknown fields remain unknown;
- form/page instructions cannot override trusted logic;
- generic support is used where reliable; and
- ATS-specific DOM behavior remains isolated.

#### Delivered

Implemented bounded read-only form inspection, a provider-neutral form/field
contract, deterministic canonical keys for initial personal/contact/address/link,
education/experience, and document fields, explicit support/confidence states,
and an adapter registry with isolated generic, Greenhouse, Lever, and Ashby
boundaries. Fixture coverage verifies stable normalization, unknown preservation,
hostile-text handling, value non-collection, and honest popup summaries. See
`docs/FORM_MODEL.md` and `docs/VALIDATION_M11.md`.

### M12 — Answer Engine Foundation — implementation complete

#### Goal

Resolve safe answers from canonical CareerOS data with explicit policy.

#### Deliverables

- deterministic field/question classifier;
- semantic classification only where needed;
- source retrieval from confirmed Career Brain/profile data and selected Resume
  Version;
- explicit answer-source categories;
- confidence and sensitivity policy;
- Fill/Suggest/Ask/Confirm/Unknown decisions;
- unknown-answer flow;
- initial reusable-answer proposal and explicit save intent where approved; and
- sensitive/consequential field guardrails.

#### Acceptance criteria

- known deterministic fields resolve correctly;
- unknown remains unknown;
- an application-specific answer is not silently made reusable;
- protected traits and consequential answers are never inferred;
- every decision has a review/policy state; and
- the service is reusable outside extension UI.

#### Delivered

Implemented an authenticated reusable Answer Engine endpoint, deterministic
sensitive and consequential guardrails, optional bounded semantic
classification, owned canonical-source retrieval, explicit answer/review/reuse
policy, safe unknown behavior, and a background-only extension request with an
aggregate no-fill popup summary. No answers or decisions are persisted. See
`docs/ANSWER_ENGINE.md` and `docs/VALIDATION_M12.md`.

### M13 — Autofill and Initial ATS Support

#### Goal

Apply Answer Engine decisions safely to supported external forms.

#### Deliverables

- form execution plan;
- autofill for approved personal, link, education, experience, and resume fields;
- visible filled/review/unknown/unsupported states;
- resume selection/upload where technically reliable;
- generic form support;
- incremental Greenhouse, Lever, and Ashby support based on fixtures; and
- user review state.

#### Acceptance criteria

- deterministic supported fields fill correctly;
- uncertain fields are not silently filled;
- sensitive policy is enforced;
- adapter failure leaves the form usable;
- both CareerOS-job and external-job entry paths work; and
- the extension never triggers final Submit.

#### Non-goals

- Workday as an exit requirement;
- universal ATS support;
- auto-submit or mass apply.

### Wave B validation gate — Apply Anywhere

Validate real supported application forms for both entry paths. Reliability,
honest uncertainty, user review, and no-submit boundaries matter more than field
coverage or site count.

## 7. V1 Formation — Wave C: Application Memory and Integration

### M14 — Durable Application Domain

#### Goal

Create canonical Application Memory for CareerOS and externally found jobs.

#### Deliverables

- Application schema and API;
- optional canonical Job relationship;
- external company/role/URL/source snapshot when needed;
- exact Resume Version association;
- Preparing/Applied/Assessment/Interview/Final/Rejected/Offer/Withdrawn statuses;
- `applied_at` and lifecycle timestamps;
- approved application-specific answer history;
- idempotent extension-originated create/update; and
- ownership and historical stability tests.

#### Acceptance criteria

- an Application can exist without prior CareerOS discovery or analysis;
- the exact resume and relevant context used are preserved;
- later current-data changes do not rewrite history; and
- retries do not duplicate Application records.

### M15 — Applications Web Surface and Cross-Surface Integration

#### Goal

Connect Web, Jobs, extension, and Application Memory into coherent workflows.

#### Deliverables

- Applications list and detail;
- status update flow;
- CareerOS Job → Apply → extension context handoff;
- external job → extension → captured context flow;
- manual Mark as Applied fallback;
- resume/application context display; and
- recovery from partial cross-surface failures.

#### Acceptance criteria

- both required scenarios end in visible Application Memory;
- users can identify source, role, status, applied date, and exact resume;
- failed automatic detection has a manual recovery path; and
- Job Intelligence remains optional.

## 8. M16 — V1 Hardening and End-to-End Validation

### Goal

Make the formed V1 reliable enough for representative external users.

### Required Scenario A

```text
Resume → Career Brain → CareerOS Jobs → Job → Apply
→ external application → extension → autofill
→ review → user submit → Application Memory
```

### Required Scenario B

```text
Resume → Career Brain → job found elsewhere
→ external application → extension → autofill
→ review → user submit → Application Memory
```

### Focus

- authorization and user isolation;
- resume, job, page, and form prompt-injection resistance;
- sensitive-answer policy;
- extension permission and message security;
- adapter resilience and graceful unsupported behavior;
- retry/idempotency and duplicate prevention;
- application-history accuracy;
- privacy/logging review;
- latency and cost;
- accessibility and usability; and
- regression coverage for M0–M7 invariants.

### Exit criteria

- both scenarios complete without developer intervention;
- no mandatory deep analysis blocks application;
- unknown and sensitive fields follow policy;
- final submission remains a user action;
- Application Memory is historically accurate; and
- critical failures have recovery behavior.

## 9. Parallel/separate job-data acquisition track

Real production job data may be integrated after the canonical boundary and
product experience are validated. It is not a blocker for formation.

Each source requires explicit review of permission, terms, data quality,
freshness, localization, operations, and cost. Initial U.S. or China coverage
must be approved separately.

Do not introduce mass scraping or provider-specific coupling merely to populate
the formation UI.

## 10. Optional intelligence expansion after formation

After V1 formation and validation, CareerOS may resume deeper optional Enhance
work in separately approved milestones:

1. Application Strategy;
2. evidence selection and base-resume recommendation;
3. evidence-grounded resume recommendations and usable artifacts;
4. application Q&A;
5. interview preparation; and
6. outcome-informed recommendations when sufficient real data exists.

These features attach to existing Job, Resume, Career Evidence, and Application
domains. They must not become mandatory for every application.

## 11. Deferred/non-goal list

Do not make these blockers for V1 formation:

- real multi-market job ingestion;
- universal ATS support or Workday;
- auto-submit or mass apply;
- Application Strategy and resume tailoring;
- cover letters and interview preparation;
- sophisticated recommendations or outcome learning;
- advanced analytics;
- localization/personalization;
- career planning or autonomous agents; and
- microservices, Kafka, Kubernetes, Neo4j, standalone vector database, or generic
  plugin/event infrastructure.

## 12. Prioritization rules

When choosing between feature breadth and Golden Path reliability, choose
reliability.

When choosing between more autofill and honest uncertainty, choose honest
uncertainty.

When choosing between provider breadth and adapter quality, choose quality.

When choosing between new intelligence and evidence/answer safety, choose safety.

When choosing between sophisticated infrastructure and a clear modular boundary,
choose the clear boundary.

## 13. Commit and milestone review

Before a milestone:

1. read relevant specifications;
2. restate objective and non-goals;
3. identify domain/API/UX/security changes;
4. surface ambiguity;
5. propose an implementation and validation plan; and
6. obtain approval when required.

After a milestone:

1. verify product behavior and invariants;
2. run automated tests and representative validation;
3. review schema/API/security and the complete diff;
4. document limitations;
5. create a focused commit; and
6. stop before expanding scope.

## 14. Immediate next step

M12 implementation and automated validation are complete. Representative
unpacked-extension Chrome validation is the remaining milestone gate. After
that gate, the next approved implementation milestone is:

> M13 — Autofill and Initial ATS Support

Do not begin Application Memory, Application Strategy, resume tailoring, or
automatic final submission as part of M13.
