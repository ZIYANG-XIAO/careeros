# CareerOS — Product and Engineering Roadmap

> Version: 0.2
> Status: Approved V1 re-baseline
> Last Updated: 2026-09-28

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

The roadmap may be amended for a competitively informed capability when the
proposal names a real user problem, connects to the CareerOS product spine,
uses grounded data, defines privacy and safety boundaries, and includes a
measurable validation gate. Observing a competitor is not sufficient by itself,
and planned capabilities must not be exposed as implemented navigation.

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

## 8. M16 — V1 Hardening and End-to-End Validation — completed

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

### Automated hardening and representative gate — both delivered

Implemented a data-minimized server-owned Application Assistant context API,
ambiguous-URL fail-closed behavior, concurrent create/status idempotency
coverage, post-redirect Preparing recovery, explicit extension message/build
boundaries, keyboard focus visibility, and automated contracts for both V1
paths. Full M0–M15 regression and production builds pass. See
`docs/VALIDATION_M16.md`.

The previously deferred unpacked-Chrome gate was executed manually by the user
on 2026-09-28. Both representative scenarios passed with a signed-in extension:
CareerOS never clicked Submit, unresolved and sensitive fields stayed under user
control, retries created no duplicate Application, and a tracking failure still
permitted manual submission and Mark as applied. M16 is therefore complete.

That gate's evidence is the user's reported manual execution, not a recorded
automated artifact — the gate exists precisely to observe browser behavior the
automated suite cannot assert.

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
- migration `0015_simplify_contact_name` removes `full_name_latin` and
  `name_order`: `first_name`/`last_name` are the confirmed Latin-script
  given/family name and a Latin-script full name is derived rather than stored;
- migration `0017_native_name_parts` adds explicit native-script given/family
  parts. Combined and split Chinese fields therefore use confirmed native
  values, while North American fields use confirmed Latin-script values;
- Career Profile contact-info UI updated for the new fields;
- resume parsing (`resume-parser-v3`) extracts grounded, unconfirmed
  contact-info candidates, surfaced on the resume import for explicit user
  review and only persisted to `UserContactInfo` when confirmed as part of, or
  after, confirming the resume import; and
- resume upload limit raised to 10 MB (`MAX_RESUME_SIZE_BYTES`) with a
  structured upload error contract (stable `code`/`message`/limit fields).

### Phase J — Application workspace polish

Prompted by a competitive review of simplify.jobs; see the candidate backlog
below for the parts of that review not yet built.

- Applications list: client-side CSV export (`Export CSV`) of the currently
  filtered applications, reusing already-loaded data with no new endpoint
  (this list and its export button no longer exist — see Phase M below for
  where CSV export/import lives now, on the Pipeline board);
- Applications list: a visual stage stepper (PREPARING → APPLIED → ASSESSMENT
  → INTERVIEW → FINAL → OFFER) on each card. REJECTED/WITHDRAWN keep the plain
  status badge instead of a stepper, since at the time the data model only
  stored the latest `status`/`status_updated_at`, not a per-transition
  history — resolved in Phase L below; and
- Career Brain: skills gained a `preferred` flag (heart toggle in Career
  Profile), a plain user preference marker independent of Career Evidence —
  toggling it does not append an evidence revision.

### Phase L — Job Preferences and Application status history — implementation complete

The next two simplify.jobs-review backlog items the user picked to build,
alongside a manual light/dark/auto theme toggle (the user's own request,
not from the competitive review).

- **Job Preferences**: migration `0018_job_preferences` + `JobPreferences`
  model (target_roles, cities, company_sizes, industries_include/exclude,
  company_blocklist, minimum_salary, security_clearance_interest), GET/PUT
  `/job-preferences`, and a form on `/me/contact` below contact info. Pure
  data capture — nothing reads these values yet, per the original backlog
  note that it's worth storing ahead of any recommendation feature.
- **Application status-transition history**: migration
  `0019_application_status_history` + `ApplicationStatusHistory` (one row
  per transition, `from_status` null on the initial row, backfilled for
  existing applications from `status`/`status_updated_at`), a new
  `GET /applications/{id}/status-history`, and a dated timeline in
  FocusPanel's Application view — replacing the old aria-hidden, dateless
  `ApplicationStepper` component (removed; it was already dead code after
  the Pipeline/Discover/Me redesign deleted the old Applications list it
  lived on).
- **Theme toggle**: `lib/theme.tsx` (ThemeProvider/useTheme, mirroring the
  existing LocaleProvider), a Light/Auto/Dark segmented control in the
  rail footer, and `data-theme` attribute overrides in `globals.css` so a
  manual choice wins over `prefers-color-scheme` when set.

### Phase M — CSV export/import on the Pipeline board — implementation complete

The third of the three simplify.jobs-review backlog items the user picked
to build. Also **restores** CSV export, a Phase J feature whose UI was
accidentally dropped when the old `/applications` page it lived on was
deleted during the Pipeline/Discover/Me redesign (the redesign migration
notes said to verify every route before deleting the old ones — this slipped
through because nothing exercises "click every button" the way a test suite
exercises routes).

- `lib/csv.ts` gained `parseCsv` (quoted fields, embedded commas/newlines,
  escaped `""`, BOM-safe) alongside the existing `toCsv`/`downloadCsv`.
- `lib/pipeline.ts` gained `applicationsToCsvRows` and
  `parseApplicationImportRows`, both pure and unit-tested.
- **Format change from the original Phase J export**: columns are now
  `company,role,status,applied_at,source,application_url,created_at` with
  raw enum values and ISO dates, not the old locale-formatted display
  text (translated status labels, `Intl`-formatted dates) or the "Resume"
  display column. The old format was never designed to round-trip; this
  one is, which is the whole point of adding import.
- Import is lenient: an unrecognized `status` falls back to `PREPARING`,
  a malformed `application_url` is dropped rather than failing the row,
  a leading header row is detected and skipped. Only a missing company or
  role fails a row outright. Each imported row becomes its own
  `MANUAL`-origin Application via the existing `POST /applications` (no
  new backend endpoint); the on-screen summary reports counts and
  per-row skip reasons.
- Not built: a true **cross-tool** importer that reads Simplify's own
  export format — see the candidate backlog below; unchanged from the
  original note, still needs that tool's actual export file inspected
  first.

### Phase N — Capture quick-add and ⌘K command palette — implementation complete

The two previously-deferred design-spec items from the Pipeline/Discover/Me
redesign (FocusPanel's own follow-up note said these depended on
"not-yet-built parent list-traversal/command-index state" — a global,
rail-level palette does not need that).

- `components/capture-dialog.tsx`: a small dialog (Company/Role/URL/Status)
  reachable from a "Capture" button in the rail, reusing the same
  `MANUAL`-origin `POST /applications` call as CSV import and the pipeline's
  existing record-from-saved flow. No new backend endpoint.
- `components/command-palette.tsx`: opened by the rail's "Jump to anything"
  button or ⌘K/Ctrl+K anywhere in the app. Always lists the fixed nav
  destinations; lazily fetches applications and saved jobs on first open and
  adds them as filterable, navigable entries (`/pipeline?focus=` /
  `/discover?focus=`). Arrow keys move the highlight, Enter activates,
  Escape/backdrop-click close (via the shared `Dialog` component's existing
  focus trap).
- Known trim: neither writes back into an already-mounted Pipeline page's
  in-memory list — a Capture or palette-driven application only shows up
  there on next load/refetch, since AppShell (where both live, so they work
  from any page) has no shared store with pipeline-view's local state. Not
  worth a state-management refactor for this.

### Phase O — Existing-capability productization — implementation complete

A focused product review chose to make already-implemented CareerOS context
more visible before adding another domain or recommendation system.

- Pipeline now opens with a small Action Center derived only from owned
  Application state: Preparing records older than three days ask the user to
  confirm whether they submitted, and Applied records older than seven days
  suggest considering a follow-up. It does not claim an external deadline or
  event that CareerOS cannot observe. The board scrolls within its own surface
  rather than forcing the whole workspace wider than the viewport.
- returning users now enter a dedicated `/home` daily workspace that aggregates
  only owned Application, saved Job, Resume, and Career Brain state. Pipeline
  returns to a focused Applications role with its action queue, board/list,
  closed lane, and CSV tools. The primary navigation is now Home, Discover,
  Applications, and Career Brain, with honest second-level entry points inside
  those domains.
- Career Brain now has an overview before its editing sections, showing factual
  entity counts, confirmed evidence count, preferred skills, and the context
  CareerOS can safely reuse. It deliberately avoids an invented profile score.
- existing Job Intelligence is presented as an Opportunity view with an
  explainable recommendation, classification counts, grounded reasons, and the
  exact Resume Version used. Apply remains available without analysis.
- the signed-out landing page now previews the connected evidence → decision →
  review → memory workflow instead of communicating the product only through
  abstract feature cards.
- the rail no longer falsely reports that the extension is not installed;
  until a trustworthy cross-surface connection signal exists, it uses a
  neutral setup link.

No schema, API, answer-policy, or submission behavior changed in this phase.

### Phase P — Application planning workspace — implementation complete

Approved as the first functional expansion under the four-workspace shell.

- migration `0020_application_activities` adds Application-owned notes,
  follow-ups, and interviews with explicit scheduling rules, idempotent create,
  ownership through the parent Application, and non-destructive downgrade;
- Application detail combines immutable status history with a user-controlled
  plan where dated follow-ups can be completed/reopened and interview records
  remain explicit user entries;
- Home surfaces real incomplete follow-ups and future interviews without
  claiming CareerOS observed an external event; and
- API and Web contracts include loading, empty, validation, ownership, retry,
  and completion behavior.

This phase does not add calendar synchronization, notifications, inferred
deadlines, email ingestion, or autonomous follow-up communication.

### Phase Q — Multi-market Job Search Goals — implementation complete

Approved as the first shared core capability for China and North America.

- migration `0021_job_search_goals` adds multiple user-owned, market-aware
  search goals while preserving existing single-preference data as an active
  default goal;
- users can create, edit, and activate distinct China or North America goals
  with compatible countries, roles, cities, workplace/employment types,
  salary currency, and an optional owned default Resume;
- at most one goal is active per user, enforced in PostgreSQL as well as the
  authenticated API;
- signed-in Home exposes the active direction and Discover can explicitly
  apply it to canonical server-owned filters; and
- interface language remains independent from target market.

This phase does not claim live recommendations, production job supply, salary
normalization, work-authorization inference, or automated application strategy.

### Phase R — Capability-gap wave after the 2026-09-28 competitive review — implementation complete

Approved by the owner ("do everything that can be done now") after comparing
CareerOS with Simplify, Jobright, Teal, and Huntr. Covers only items needing
no external approval, credentials, or compliance sign-off.

- **Job Clipper**: the popup's "Save this job" reads the active page only on
  request — schema.org `JobPosting` JSON-LD first, else visible page text —
  and shows an editable draft. Saving calls `POST /jobs/clip`, which uses the
  verified tab URL (never the draft) as identity, canonicalizes it (lowercase
  host, no fragment, tracking params such as `utm_*`/`gh_src` dropped, job IDs
  in the query kept), returns the existing Job when the page was clipped
  before, and marks the Job saved. Clipped Jobs are `MANUAL_ENTRY` with
  `source_key = "extension_clip"`.
- **Preference Fit**: Discover rows show "Goal fit n/m" against the active Job
  Search Goal, or a blocklist warning. It is a deterministic client-side
  comparison (`apps/web/src/lib/preference-fit.ts`) that judges a criterion only
  when both the goal and the job state it; nothing is inferred or persisted.
- **Reusable Answers**: see `docs/ANSWER_ENGINE.md` section 7 and
  `docs/DATA_MODEL.md` 16.4. Saved from the popup or Me → Contact & answers,
  used to fill matching custom questions, sensitive questions refused.
- **Resume attach**: explicit "Attach resume" fills an empty resume upload
  control with the exact owned Resume Version file; see
  `docs/FORM_EXECUTION.md` section 6.
- **Workday adapter** and **formless generic detection** for single-page ATSs
  (including common China-market systems); see `docs/FORM_MODEL.md`.
- **Extension localization**: popup, in-page assistant, and on-page field
  markers are available in Simplified Chinese, following the browser UI
  language (`apps/extension/src/shared/i18n.ts`, English fallback). The Web
  app was already fully localized; the earlier "partial" wording was stale.

Remaining limitations after this wave:

- custom JavaScript widgets (react-select comboboxes, Workday listboxes) are
  still not filled — they need real-site validation before simulating clicks;
- Reusable Answers are not yet copied into an Application's recorded answer
  history, and Clip/Save-answers/Attach live in the popup only, not the
  in-page assistant;
- Resume attach and Workday/formless detection are fixture-validated only and
  still need a representative unpacked-Chrome pass on real sites;
- still blocked on others: production job sources (guopin terms/answers,
  a North America ATS source), the sensitive/demographic answer bank
  (compliance sign-off), email digests (no outbound email), billing, a
  production deployment, and Chrome Web Store listing and privacy policy.

### Phase S — Data rights, calendar, contacts, assistant parity, and ops basics — implementation complete

Second owner-approved "do everything possible" pass, closing gaps found after
Phase R. None needed external approval.

- **Delete/edit and data rights**: Job edit (listing fields) and delete;
  Application delete; Resume delete (refused while an Application recorded
  it); full JSON account export and confirmed account deletion under
  Me → Account & data. Rules in `docs/DATA_MODEL.md` section 19.
- **Calendar**: open follow-ups and interviews download as `.ics` from Home.
- **Application contacts**: recruiters, hiring managers, interviewers, and
  referrers per application in the Pipeline panel (`docs/DATA_MODEL.md` 15.2a).
- **Reusable answers in application history**: answers filled from a saved
  reusable answer are recorded as `USER_PROVIDED` under the form's question.
- **In-page assistant parity**: Save this job, Remember my answers, and Attach
  resume are also available in the in-page assistant; popup and assistant
  share framework-free checks and copy (`apps/extension/src/popup/tool-copy.ts`).
- **Multi-step forms**: a change of Workday's step heading is treated like
  navigation, discarding stale inspection and fill state (no automatic
  re-scan, consistent with "inspect only when asked").
- **Ops basics**: request IDs, structured access logs, and per-user limits on
  AI-backed endpoints (`docs/ARCHITECTURE.md` section 24).

Remaining limitations: sign-in identity deletion still happens in the auth
provider's account settings; the rate limiter is single-process; no error
tracking provider; calendar is a download, not a live subscription (that needs
a per-user secret feed URL).

### Phase T — Shared job catalog and the Greenhouse North America pilot — implementation complete

Approved by the owner after the 2026-09-28 data-strategy discussion
("North America first, via public employer ATS feeds; no scraping of job
boards").

- Data model split into private jobs and a shared catalog, with per-user saves,
  analyses, and applications (`docs/DATA_MODEL.md` 11.0).
- Deferred, shared requirement extraction: syncing costs no AI calls; each
  posting is parsed at most once, on first use.
- Greenhouse public Job Board API adapter, a verified 52-employer seed, a daily
  sync CLI with per-board isolation and closure detection
  (`docs/JOB_SOURCE_DECISION.md`).
- Discover pages through the catalog (50 per page, compact rows), adds an
  "Added by me" view, marks catalog jobs read-only, and extracts requirements
  when a catalog job is opened.
- First local sync: 7,135 North American postings from 52 boards.

Awaiting the owner: terms sign-off for public launch, a scheduler in whatever
environment runs production, and approval of the next sources (Lever, Ashby,
guopin with written authorization).

### Phase U — Lever and Ashby sources, shared board plumbing, scheduling — implementation complete

- Shared ATS board plumbing (`careeros_api/job_source_boards.py`); Greenhouse,
  Lever, and Ashby are thin adapters over it.
- Lever (7 employers) and Ashby (27 employers) North America seeds, verified
  against the live APIs; source records in `docs/JOB_SOURCE_DECISION.md`.
- `scripts/sync_job_sources.py --source greenhouse|lever|ashby|all`, plus
  `--every-hours N` for environments without cron.
- `scripts/ingest_jobs.py --catalog [--close-missing]` loads a file-export
  source into the shared catalog with deferred parsing.
- Local catalog after this phase: 10,193 North American postings
  (Greenhouse 7,135, Ashby 2,441, Lever 617).
- China-market sources are on hold by owner decision.

### Phase V — Catalog quality: tighter location rules, standing-interest filter, collapsed listing — implementation complete

- Location placement, shared across all three sources
  (`careeros_api/job_source_boards.py`): recognizes US state names and major
  city names beyond ZIP-style codes (avoiding false positives like "Berlin,
  DE" reading as Delaware), a `is_generic_location` check so Greenhouse's
  office-name fallback only fires for placeless labels ("Remote", "Hybrid",
  "N/A") and never overrides an explicit non-NA location, and explicit
  "North America" / "NAMER" / "US & Canada" phrasing.
- Standing-interest postings (talent pools, "future opportunities", "don't
  see your role" pages) are recognized by title across all three sources and
  excluded from the catalog rather than kept as if they were open roles.
- `BoardMapping.seen_external_ids` now reflects only *kept* postings, so a
  posting that stops meeting these rules on a later sync — not just one that
  disappeared from the board — is closed like any other departure.
- `GET /jobs?collapse=true`: one row per company + title, with `similar_count`
  and up to 20 `other_locations` on the representative row (the user's saved
  posting in the group is preferred as representative). Used by Discover by
  default. Employers routinely post the identical role once per office; this
  keeps a scan of the list from being dominated by one role repeated a dozen
  times.
- Local catalog after this phase: ~10,128 kept North American postings after
  re-sync with the tightened rules (from ~10,193; the drop is closed
  postings, not lost coverage — talent-pool listings and previously
  mis-placed non-NA postings).

### Product-direction backlog from the 2026-09 review (not yet scheduled)

Not approved work. Preserve these candidates for a later scoping and policy
review rather than treating them as implemented behavior:

- ~~**Reusable non-sensitive Answer Memory**~~ — implemented in Phase R;
- **Eligibility profile and decision layer** with explicit user-provided data,
  `PASS` / `BLOCKED` / `UNKNOWN` / `REVIEW` outcomes, field-level permissions,
  and no inference of work authorization, sponsorship, citizenship, salary, or
  protected traits;
- ~~**explicit-action Job Clipper**~~ — implemented in Phase R;
- ~~**one approved ATS job source**~~ — Greenhouse pilot implemented in
  Phase T (launch pending terms sign-off);
- **Application Ledger expansion** to pin the exact Job Snapshot and distinguish
  generated, user-edited, and confirmed answer history;
- ~~**Preference Fit**~~ — implemented in Phase R as a deterministic
  goal comparison;
- **outcome-informed learning, skill graphs, company intelligence, and career
  strategy**, deferred until representative usage and sufficient owned outcome
  data exist.

Still excluded from near-term scope: autonomous mass apply, offer-probability
claims, ghost-job declarations, community/marketplace features, broad inbox or
email ingestion, and a generic conversational career agent.

### Candidate backlog from the simplify.jobs review (not yet scheduled)

Not approved work; listed so a future session does not re-derive this from
scratch. Each needs its own scoping/approval pass before implementation:

- **A cross-tool CSV importer** that reads Simplify's own Job Tracker
  export format (as opposed to Phase M's round-trip of CareerOS's own
  format) — needs that tool's actual export file inspected first, do not
  guess its column mapping;
- **A reusable, explicitly-confirmed sensitive/demographic answer bank**
  (ethnicity, disability, LGBTQ+, gender, veteran status, per-country work
  authorization), mirroring `UserContactInfo`'s confirm-once pattern. This
  does not conflict with `docs/AI_SPEC.md` section 19 (that section bars *AI
  inference* of these categories, not explicit user-entered, reusable
  values) but storing protected-class data at rest is a product/compliance
  decision, not a pure implementation one — needs explicit sign-off before
  starting; and
- **Email digest notification cadence** (daily/weekly/never), which depends on
  whether outbound email infrastructure exists yet.

### Phase K — Full visual + IA redesign (Pipeline/Discover/Me/Start) — implementation complete

Escalated from Phase J's targeted polish to a full Opus-designed visual and
information-architecture overhaul, approved for autonomous implementation.

- new design tokens, typography (IBM Plex Sans/Mono + Noto Sans SC), and a
  restyled shared UI kit (`globals.css`, `components/ui/*`);
- a new 3-destination IA replacing the old 5-item nav: Pipeline (merged
  Jobs+Applications Kanban board — the drag-between-columns view from the
  candidate backlog above, now shipped), Discover (two-pane job search), and
  Me (Career Brain + Resumes + Contact, tabbed);
- a shared `FocusPanel` component (Application and Job flavors) opened via a
  `?focus=` query param, replacing the separate `/jobs/:id` and
  `/applications/:id` detail routes;
- `/start` replaces `/welcome` as the first-run empty-pipeline state;
- `next.config.ts` permanent redirects retire `/jobs`, `/applications`,
  `/career`, `/resumes`, and `/welcome` in favor of the routes above, with
  query strings preserved automatically; the old route folders and their
  now-superseded tests were removed.

Deliberate scope trims (each a reasoned simplification, not an oversight):

- FocusPanel's J/K/S keyboard shortcuts (row-level list traversal within
  Pipeline/Discover) remain deferred until those pages have list-traversal
  state to hang them on. ⌘K itself shipped separately in Phase N below as
  a global command palette, which needed no such state;
- Pipeline's "lift/arrow/drop" keyboard Kanban gesture replaced with a
  native `<select>` "move to" control — simpler and keyboard-accessible by
  default without a bespoke gesture;
- `/me/resumes/[id]` kept as a distinct route rather than an inline
  `?resume=` expansion;
- `/me/imports/[id]` kept the same AppShell chrome rather than a rail-less
  focused-task treatment;
- the assistant-status chip that replaced the old Setup nav item has no
  live extension-connection detection yet, so Phase O changed it to a neutral
  setup link rather than claiming an installation state it cannot observe.

Explicitly not recommended, and not on this backlog: a visual resume-builder/
layout designer, AI resume tailoring, or a resume-quality score — all conflict
with this README's stated identity ("not merely a resume builder... or
resume-tailoring tool") and the non-goal list below; a personal analytics
dashboard (ghost rate, conversion funnels) — an explicit V1 non-goal; and a
referral-bounty marketplace or paid coaching marketplace — a different
business line requiring third-party supply and payments, not a product
feature.

Remaining limitations after this wave:

- no production job acquisition;
- no automatic resume/file upload or broader custom-widget execution
  (resume attach added in Phase R; custom widgets still open);
- incomplete localization of remaining Web surfaces and the extension
  (completed in Phase R); and
- M16 representative unpacked-Chrome validation still pending (completed
  2026-09-28).

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
- universal ATS support (a Workday adapter exists since Phase R);
- auto-submit or mass apply;
- Application Strategy and resume tailoring;
- cover letters and interview preparation;
- sophisticated recommendations or outcome learning;
- advanced analytics;
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

M16 is complete: automated hardening, repository-level validation, and the
representative unpacked-Chrome gate for both scenarios have all passed. M17 and
the post-M17 wave (Phases A–V) are implemented. Phase R's resume attach,
Workday adapter, and formless detection still need a representative
unpacked-Chrome pass on real sites.

The remaining V1 gate is no longer a validation run. Before production job
acquisition, complete an approved one-source-at-a-time review using
`docs/JOB_SOURCE_DECISION.md`.

Do not begin Application Strategy, resume tailoring, production job ingestion,
or automatic final submission until each is scoped and approved on its own. The
items under "Product-direction backlog from the 2026-09 review" and "Candidate
backlog from the simplify.jobs review" remain unapproved and still need their own
scoping passes; the sensitive/demographic answer bank additionally needs explicit
product and compliance sign-off before implementation.
