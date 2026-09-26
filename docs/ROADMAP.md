# CareerOS — Product and Engineering Roadmap

> Version: 0.2
> Status: Approved V1 re-baseline
> Last Updated: 2026-09-26

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

### M13 — Autofill and Initial ATS Support — implementation complete

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

#### Delivered

Implemented explicit user-triggered execution for approved blank native
controls, exact field-signature revalidation, non-overwrite behavior, visible
filled/review/input/unresolved states, generic and initial ATS fixture coverage,
and build enforcement of the no-submit boundary. Resume/file upload remains
manual where the browser cannot safely assign a file. See
`docs/FORM_EXECUTION.md` and `docs/VALIDATION_M13.md`.

### Wave B validation gate — Apply Anywhere

Validate real supported application forms for both entry paths. Reliability,
honest uncertainty, user review, and no-submit boundaries matter more than field
coverage or site count.

## 7. V1 Formation — Wave C: Application Memory and Integration

### M14 — Durable Application Domain — implementation complete

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

#### Delivered

Implemented the Application, immutable Application Answer, and idempotent
Application Operation schema/API. Applications support owned canonical Jobs or
standalone external context, exact owned Resume Versions, stable company/role/
URL/source snapshots, all V1 statuses, applied/status lifecycle timestamps,
owner-only list/detail/update operations, and confirmed standard answer history.
See `docs/APPLICATION_MEMORY.md` and `docs/VALIDATION_M14.md`.

### M15 — Applications Web Surface and Cross-Surface Integration — implementation complete

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

#### Delivered

Implemented the Applications Web list/detail/status experience, exact Resume
Version and source display, manual Mark as applied recovery, CareerOS Job
Preparing handoff, URL/recent-context extension matching, explicit post-submit
recording, and retry-safe submission completion with approved answer history.
Final submission remains entirely user-controlled. See
`docs/APPLICATION_INTEGRATION.md` and `docs/VALIDATION_M15.md`.

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

### Automated hardening delivered; representative gate pending

Implemented a data-minimized server-owned Application Assistant context API,
ambiguous-URL fail-closed behavior, concurrent create/status idempotency
coverage, post-redirect Preparing recovery, explicit extension message/build
boundaries, keyboard focus visibility, and automated contracts for both V1
paths. Full M0–M15 regression and production builds pass. See
`docs/VALIDATION_M16.md`.

M16 is not marked complete because the previously deferred unpacked-Chrome
validation of both representative scenarios has not been executed.

## 9. Parallel/separate job-data acquisition track

Real production job data may be integrated after the canonical boundary and
product experience are validated. It is not a blocker for formation.

Each source requires explicit review of permission, terms, data quality,
freshness, localization, operations, and cost. Initial U.S. or China coverage
must be approved separately.

Do not introduce mass scraping or provider-specific coupling merely to populate
the formation UI.

## 10. M17 — Localization and Market-Aware Jobs Foundation — implementation complete

### Goal

Prepare the product and canonical Job boundary for both North American and
Chinese opportunities without coupling interface language to recruiting market.

### Delivered

- independent `English / 简体中文` Web locale state, persisted on the current
  browser, with localized product shell and Jobs experience;
- independent `All / North America / China` market selection;
- canonical market, country, workplace, and employment-type Job metadata;
- validated North America (`US`, `CA`) and China (`CN`) market/country rules;
- server-owned filtering and recent/title sorting for those canonical fields;
- the same metadata contract for manual capture and normalized source adapters;
  and
- explicit unknown values so missing source data is not inferred.

Production acquisition remains a separate track. Salary, sponsorship, education,
experience-level, company-type, and funding filters remain deferred until real
source requirements and trustworthy normalized fields exist.

## 11. Post-M17 wave — implementation complete

After M17, a focused product-formation wave delivered the following without
changing the V1 spine or marking M16 complete:

### Phase A — UX reliability

- mutually exclusive loading, error, and empty states across Web data surfaces;
- consistent API error representation and user-facing retry behavior.

### Phase B — In-page Application Assistant

- floating in-page assistant — controlled UI panel, not a conversational AI
  agent — with open Shadow DOM style isolation only;
- explicit activation via popup action or `Command/Ctrl+Shift+K`
  (`CAREEROS_ACTIVATE_ASSISTANT` message);
- `activeTab` + on-demand content-script injection via
  `chrome.scripting.executeScript` (no manifest `content_scripts`, no
  `<all_urls>`);
- page lifecycle handling that clears stale form state on navigation.

### Phase C — UserContactInfo

- `UserContactInfo` model, migrations `0012_user_contact_info` and
  `0013_uci_answer_source`, and API;
- Career Profile contact-info UI;
- Answer Engine deterministic mappings for name, phone, address, LinkedIn, and
  portfolio when contact info is confirmed.

### Phase D — Onboarding and landing

- resume-first onboarding at `/welcome`;
- improved landing page and onboarding step tracking.

### Phase E — Developer and extension visibility

- extension build/version visibility;
- Web setup guide at `/setup`;
- `scripts/dev-check.sh` local environment check.

### Phase F — Operational diagnostics

- `/readiness` endpoint for database and Clerk JWKS status;
- `scripts/preflight.py` Clerk JWKS reachability and TLS verification
  diagnostic (does not check API reachability).

### Phase G — Localization expansion

- partial English/Simplified Chinese localization for Applications, Resumes,
  Career Profile, and Job detail (Career Profile section components remain
  hardcoded English).

### Phase H — Maintainability refactor

- Jobs page, extension popup, shared messages, and API client split into smaller
  modules without changing approved product behavior.

### Phase I — Dual-market contact profile

- migration `0014_dual_market_profile` extends `UserContactInfo` with
  `full_name_native`, `full_name_latin`, `name_order`, `contact_email`,
  `wechat_id`, `district`, and `github_url`;
- Career Profile contact-info UI updated for the new fields;
- resume parsing (`resume-parser-v2`) extracts grounded, unconfirmed
  contact-info candidates, surfaced on the resume import for explicit user
  review and only persisted to `UserContactInfo` when confirmed as part of, or
  after, confirming the resume import; and
- resume upload limit raised to 10 MB (`MAX_RESUME_SIZE_BYTES`) with a
  structured upload error contract (stable `code`/`message`/limit fields).

Remaining limitations after this wave:

- no production job acquisition;
- no automatic resume/file upload or broader custom-widget execution;
- incomplete localization of remaining Web surfaces and the extension; and
- M16 representative unpacked-Chrome validation still pending.

See `docs/JOB_SOURCE_DECISION.md` for the next approved job-data source decision
process.

## 12. Optional intelligence expansion after formation

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

## 13. Deferred/non-goal list

Do not make these blockers for V1 formation:

- real multi-market job ingestion;
- universal ATS support or Workday;
- auto-submit or mass apply;
- Application Strategy and resume tailoring;
- cover letters and interview preparation;
- sophisticated recommendations or outcome learning;
- advanced analytics;
- complete localization of remaining Web surfaces and the extension;
- career planning or autonomous agents; and
- microservices, Kafka, Kubernetes, Neo4j, standalone vector database, or generic
  plugin/event infrastructure.

## 14. Prioritization rules

When choosing between feature breadth and Golden Path reliability, choose
reliability.

When choosing between more autofill and honest uncertainty, choose honest
uncertainty.

When choosing between provider breadth and adapter quality, choose quality.

When choosing between new intelligence and evidence/answer safety, choose safety.

When choosing between sophisticated infrastructure and a clear modular boundary,
choose the clear boundary.

## 15. Commit and milestone review

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

## 16. Immediate next step

M17 and the post-M17 wave are implemented and automated validation passes at
repository level. M16 automated hardening is also complete, but its
unpacked-extension Chrome setup and representative browser validation remain
deferred. The next required V1 gate is still:

> Run both M16 representative scenarios in unpacked Chrome

Before production job acquisition, complete an approved one-source-at-a-time
review using `docs/JOB_SOURCE_DECISION.md`.

Do not mark M16 or V1 complete, and do not begin Application Strategy, resume
tailoring, production job ingestion, or automatic final submission, until the
M16 browser gate is explicitly resumed and passed and any chosen job source is
approved separately.
