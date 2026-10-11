# CareerOS Core V1 — Domain Data Model

> Version: 0.2
> Status: Approved logical model; implementation status called out explicitly
> Last Updated: 2026-09-26

## 1. Purpose

This document defines CareerOS domain concepts for the re-baselined V1. It
separates the implemented M0–M17 product state, M16 automated hardening, and
the post-M17 wave from planned V1 formation concepts. M14 adds durable
Application Memory and M15 adds retry-safe submission recording. M16 adds no
tables. Migration `0012_user_contact_info` adds `UserContactInfo`. Migration
`0013_uci_answer_source` adds the `USER_CONTACT_INFO` answer
source category. Migration `0014_dual_market_profile` adds dual-market name and
contact fields to `UserContactInfo`. Migration `0015_simplify_contact_name`
removes the duplicate Latin-script full name and generic name-order fields;
`first_name`/`last_name` become the confirmed Latin-script given/family parts. Migration
`0016_skill_preferred` adds a `preferred` flag to `skills`. Migration
`0017_native_name_parts` adds explicit native-script given and family names so
split Chinese and Latin-script fields never share an ambiguous representation.
Migration `0018_job_preferences` adds confirmed job-search preferences,
`0019_application_status_history` adds immutable lifecycle transitions, and
`0020_application_activities` adds user-planned notes, follow-ups, and
interviews. Migration `0021_job_search_goals` adds multiple explicit,
market-aware Job Search Goals and safely copies an existing single
`JobPreferences` record into an active default goal.

The model supports:

```text
KNOW ME → DISCOVER → APPLY ANYWHERE → REMEMBER
                         ↘
                       ENHANCE (optional)
```

It preserves two foundational rules:

> Career Brain is not Resume.

> Generated professional claims require valid evidence.

## 2. Modeling principles

- PostgreSQL is the canonical structured store.
- Core domains have stable identities and explicit user ownership.
- Historical evidence revisions, resume versions, analyses, and applications do
  not silently mutate when current data changes.
- External-provider data is normalized at boundaries rather than leaking into
  core models.
- AI output is validated structured data, not automatic truth.
- JSON may support bounded flexibility but must not make core state opaque.
- The model remains relational; no graph database or event-sourcing requirement
  exists.

## 3. Core domains

```text
User
├── UserContactInfo (confirmed personal/contact fields)
├── Career Brain
│   ├── Education
│   ├── Experience → Experience Detail
│   ├── Project → Project Detail
│   ├── Skill
│   └── Career Evidence → immutable revisions
├── Resume → immutable Resume Versions
├── Job Search Goal (multiple; at most one active)
├── Job → snapshots → requirements → analyses/matches
│   └── Saved Job (per-user interest state)
└── Application
    ├── selected Resume Version
    ├── application-specific answers
    ├── immutable status history
    └── user-planned activities
```

Identity, UserContactInfo, Career Brain, Career Evidence, Resume, Job, and
Application are core domains. Job Discovery, Autofill, Answer Engine, Job
Intelligence, and other workflows are services that consume them.

## 4. Implementation status

### Implemented now

The current migrations define:

- `users`
- `career_brains`
- `educations`
- `experiences`
- `experience_details`
- `projects`
- `project_details`
- `skills`
- `career_evidence`
- `career_evidence_revisions`
- `resumes`
- `resume_assets`
- `resume_versions`
- `resume_imports`
- `resume_draft_items`
- `jobs`
- `job_snapshots`
- `job_requirements`
- `job_analyses`
- `evidence_matches`
- `evidence_match_references`
- `saved_jobs`
- `applications`
- `application_answers`
- `application_operations`
- `application_status_history`
- `application_activities`
- `job_search_goals`
- `user_contact_info`

Current Alembic head: `0021_job_search_goals`.

M12 adds a transient Answer Engine decision contract and no tables. Decisions
reference owned canonical sources but are not persisted as Application or
Reusable Answer history.

M13 adds a transient fill plan and execution result in the extension and no
tables. Neither page markers nor fill results become Application history.

M14 adds user-owned Applications, immutable ordered Application Answers, and a
durable idempotency ledger for status updates.

M15 extends the operation ledger with `RECORD_SUBMISSION`, allowing an owned
Preparing Application to atomically preserve a previously unset Resume Version,
append approved immutable answers, and record Applied without duplicate retries.

M16 adds a data-minimized assistant-context API over the same canonical tables.
It returns only one unambiguous owned Application candidate and Resume Version
identifiers/labels; it does not return extracted resume text or raw form data.

M17 adds canonical market/country/workplace/employment metadata on Jobs. The
post-M17 wave adds `UserContactInfo` for confirmed personal/contact fields used
by Career Profile and the Answer Engine. It does not create Career Evidence.
Migration `0014_dual_market_profile` extends `UserContactInfo` with a
native-script full name, contact email, WeChat ID, district, and GitHub URL,
and resume import may surface unconfirmed contact-info candidates that only
become part of `UserContactInfo` when the user explicitly confirms them.
Migration `0015_simplify_contact_name` removes the separate Latin-script full
name and name-order fields: `first_name`/`last_name` hold the Latin-script
given and family name, and the full Latin-script name is derived rather than
stored. Migration `0016_skill_preferred` adds a `preferred` boolean to
`Skill`, a plain user-set preference marker independent of Career Evidence;
toggling it does not append an evidence revision. Migration
`0017_native_name_parts` adds the explicit native-script given/family parts.
Migration `0019_application_status_history` preserves one initial row and every
real lifecycle transition. Migration `0020_application_activities` stores
owner-scoped notes, follow-ups, and interviews under an Application. Scheduled
activities remain distinct from immutable status history: they are user plans,
not claims about external events.

Migration `0021_job_search_goals` introduces an owner-scoped collection of
search goals. Each goal has an explicit market (`NORTH_AMERICA`, `CHINA`, or
`UNKNOWN`), compatible country codes, roles, cities, workplace/employment
preferences, salary amount/currency, and an optional owned default Resume.
A partial unique index permits at most one active goal per user. Market is
independent of interface language. The old `job_preferences` table remains
temporarily available for rollout compatibility but is no longer the Web
editing surface.

Migration `0027_extension_presence` adds one owner-scoped row per user
recording when the signed-in browser extension last reported to the API and
its build version. The timestamp is server-assigned; no page URL, form, or
browsing data is stored. The Web `/setup` page reads it to show whether the
extension is connected, because the extension exposes no page bridge the Web
could query directly. It is included in account export and removed by
account deletion.

### Planned, not implemented

- Reusable Answer;
- application preferences beyond currently approved fields;
- raw persisted extension/form inspection records; and
- Application Strategy and Resume Recommendation.

This document proposes those boundaries but does not claim their schema exists.

## 5. User and ownership

`User` represents the internal account owner and maps an authentication-provider
identity to CareerOS resources.

All private Career Brain, contact info, evidence, resume, job, analysis,
application, answer, and file resources belong to a user context. Ownership is
enforced server-side, including nested identifiers and identifiers returned by
AI.

## 6. UserContactInfo — implemented

`UserContactInfo` stores user-provided personal and contact fields separately
from Career Evidence and Career Brain professional facts. One record per user.

Implemented fields:

- `first_name`, `last_name` — the confirmed Latin-script given name and family
  name respectively;
- `preferred_name`;
- `given_name_native`, `family_name_native` — explicitly confirmed
  native-script parts for split native-script form fields;
- `full_name_native` — an optional full name in another script, kept exactly
  as the user writes it (own order, no first/last split), for forms that
  want a single native-script name field;
- `contact_email`;
- `phone`, `wechat_id`;
- `address_line_1`, `address_line_2`, `city`, `district`, `region`,
  `postal_code`, `country_code`;
- `linkedin_url`, `github_url`, `portfolio_url`;
- `confirmed_at`; and
- `created_at`, `updated_at`.

There is no duplicate stored Latin-script full name or generic name-order
field. A Latin-script full name is derived as `"{first_name} {last_name}"`.
For Chinese-market fields, the exact `full_name_native` is preferred; when it
is absent but both confirmed native parts exist, family precedes given without
an inserted space. CareerOS does not transliterate names.

Contact info is explicitly confirmed on save. The Answer Engine uses confirmed
contact info for deterministic name, phone, address, and link mappings.
Contact info is never auto-applied from resumes, email, or indirect signals:
resume import may extract grounded contact-info candidates for review, but a
value only becomes confirmed `UserContactInfo` when the user submits it
explicitly, including as part of confirming the resume import.

## 7. Career Brain

`CareerBrain` is the aggregate root for canonical professional truth. It is one
per user in the current implementation.

Implemented child entities include Education, Experience, Experience Detail,
Project, Project Detail, and Skill. Personal/contact fields belong in
`UserContactInfo`, not Career Brain. Future approved fields may include
certifications, achievements, metrics, application information, and preferences.

Career Brain data can originate from resume import or direct user actions, but
AI extraction remains a draft until confirmed according to product rules.

## 8. Career Evidence

`CareerEvidence` gives relevant professional facts stable identity.
`CareerEvidenceRevision` stores immutable content revisions, origin,
confirmation status, author category, and revision number.

The current evidence sources include meaningful experience details, project
details, and skills. Future approved evidence sources may extend this list.

The current revision pointer can change; historical revisions do not. Downstream
historical records reference the exact revision used.

An evidence reference must be validated for existence, ownership, confirmation
eligibility, and context before use.

## 9. Resume

`Resume` is a logical user-owned asset. `ResumeAsset` preserves the uploaded file
metadata and storage reference. `ResumeVersion` is an immutable or historically
preserved representation containing extracted and structured content.

Implemented source relationships support uploaded resume history. Future
job-specific variants may reference a source version and target Job, but resume
tailoring is not implemented.

Career Brain and Resume remain separate:

- Career Brain represents confirmed professional truth.
- Resume Version represents what the user chose to present at a point in time.

## 10. Resume import

`ResumeImport` tracks the draft/confirmation workflow for a Resume Version.
`ResumeDraftItem` stores extracted review items and links them to evidence.

Draft items are not authoritative merely because a parser produced them. User
edits and confirmation determine their downstream eligibility.

## 11. Canonical Job

`Job` represents an opportunity independent of how it was acquired.

The implemented Job contains user ownership, company, title, location, source
and application URLs, source type/key, optional external identity and canonical
URL, observed timestamps, explicit availability/freshness state, market,
country, workplace type, employment type, and timestamps. Current user-facing
behavior creates manually entered Jobs; the source boundary also supports
normalized seed/demo/test ingestion.

The logical Job should remain capable of representing:

- CareerOS job data;
- company or ATS sources;
- permitted feeds/APIs;
- extension-captured external jobs; and
- manual entry.

Source-specific payloads must not become the canonical model.

### 11.0 Private jobs and the shared catalog — implemented (Phase T)

`jobs.user_id` is nullable (migration `0024_shared_job_catalog`):

- **Private job** (`user_id` set): captured manually or clipped by that user.
  Only the owner can see, edit, or delete it.
- **Catalog job** (`user_id` NULL): synced from an approved source, visible to
  every user, read-only through the API, closed by the sync when the source
  drops it. Closed catalog jobs disappear from browsing but stay visible where a
  user saved them.

Uniqueness is split accordingly: private jobs are unique per owner by source
ID and canonical URL; catalog jobs are unique globally by the same keys.
Per-user state — `SavedJob`, `JobAnalysis` (now versioned per user and job),
`Application` — may reference either kind. Clipping a page already in the
catalog saves the catalog job instead of creating a private copy.

`job_snapshots.requirements_status` is `PARSED` or `PENDING`. Catalog snapshots
are stored `PENDING`; the first `POST /jobs/{id}/requirements` (triggered when
someone opens the job) extracts requirements once, under a row lock, for
everyone, reusing an existing parse of identical text when available.
Analysis creation returns `409 REQUIREMENTS_PENDING` until then.

`GET /jobs` supports `source=all|mine|catalog`, `limit`/`offset` (unpaged
catalog listings are capped at 200), `compact=true`, which omits
descriptions and requirements for list views, and `collapse=true`, which
returns one row per company + title (employers routinely post the identical
role once per office) — the row carries `similar_count` and up to 20
`other_locations`, preferring the user's saved posting in the group as the
representative row. Discover uses `compact` and `collapse` together.

### 11.1 Implemented job-source boundary

Conceptually:

```text
External Job Source
→ Source Adapter
→ Normalized Job Candidate
→ Deduplication
→ Freshness evaluation
→ Canonical Job
```

The minimum implemented model uses source key, optional external job ID,
canonical URL, first/last observed timestamps, explicit availability/freshness,
and constrained market metadata. `NORTH_AMERICA` supports `US` and `CA`;
`CHINA` supports `CN`; unknown remains explicit. Workplace and employment types
also preserve `UNKNOWN`. Provider payloads are not stored as canonical Job truth.

Do not add a large generic ingestion schema before actual source requirements are
known.

### 11.2 Deduplication and freshness

Implemented deduplication prefers source key plus external source ID, then
canonical URL. It avoids obvious retry duplicates without claiming perfect
global identity resolution. Description changes append immutable Job Snapshots
instead of creating another canonical Job.

Freshness should indicate what CareerOS knows about when a source was observed or
whether a job appears available. Unknown freshness must remain unknown.

## 12. Job snapshots and requirements

`JobSnapshot` immutably preserves the raw and normalized job description, parser
metadata, content hash, and version. `JobRequirement` stores structured,
source-grounded requirements with category, importance, source text, confidence,
and position.

Existing manually captured Jobs and snapshots remain valid when future source
boundaries are introduced.

## 13. Job Intelligence

`JobAnalysis` records the exact Job Snapshot, Career Brain, Resume Version,
matcher version/model, recommendation, and summary used at analysis time.

`EvidenceMatch` separates:

- evidence support strength: strong, weak, or insufficient; and
- resume representation: represented, underrepresented, or absent.

The product-facing classification is derived as Strong Evidence, Hidden
Evidence, Weak Evidence, or Genuine Gap.

`EvidenceMatchReference` snapshots the exact evidence identity, revision,
content, source context, and revision number used. Later Career Brain edits must
not rewrite historical analysis.

Job Intelligence is implemented optional enhancement functionality.

## 14. Saved Job and discovery state — implemented

`SavedJob` is a durable user-owned interest marker with `user_id`, `job_id`, and
`created_at`. The `(user_id, job_id)` pair is unique, making save retries
idempotent. Both identifiers are protected by cascading foreign keys.

Saving means “I am interested in this opportunity.” It does not necessarily
mean the user analyzed or applied. Save and unsave never create an Application.

## 15. Application — implemented core domain

Application is a durable user-owned entity representing work toward or
completion of an application.

Implemented fields:

- `id`
- `user_id`
- optional `job_id`
- company and role snapshot for every Application
- application URL snapshot
- application source/context snapshot
- optional selected `resume_version_id`
- status
- `applied_at`
- `created_at`
- `updated_at`
- `status_updated_at`
- create idempotency key and request fingerprint

An external application is recordable even if the user never discovered or
saved a Job in CareerOS. M14 either links an existing owned canonical Job or
stores standalone external context; it does not create a Job as a prerequisite.

### 15.1 Status

V1 API and database status values:

- `PREPARING`
- `APPLIED`
- `ASSESSMENT`
- `INTERVIEW`
- `FINAL`
- `REJECTED`
- `OFFER`
- `WITHDRAWN`

The implemented schema stores current status and timestamps for efficient
workflow queries and appends the initial state and every real transition to
immutable `ApplicationStatusHistory` rows.

### 15.2 Application activities

`ApplicationActivity` stores user-planned `NOTE`, `FOLLOW_UP`, and `INTERVIEW`
records. Notes have no schedule. Follow-ups and interviews require a
timezone-aware `scheduled_at`; follow-ups may also have `completed_at`.
Activities are mutable planning context, not immutable proof that an external
event occurred. Open follow-ups and interviews (from 30 days ago onward) can be
downloaded as an iCalendar file (`GET /calendar/activities.ics`).

### 15.2a Application contacts — implemented (Phase S)

`ApplicationContact` (migration `0023_application_contacts`) stores people the
user deals with for one application: name, relationship (`RECRUITER`,
`HIRING_MANAGER`, `INTERVIEWER`, `REFERRER`, `OTHER`), optional email, profile
link, and notes. Only what the user types is stored; CareerOS never looks
people up or contacts them. Contacts are mutable and cascade with their
Application (at most 50 per application).

### 15.3 Historical snapshot rule

An Application preserves what was used at the time: exact Resume Version,
relevant answers, captured job/application context, status, and timestamps.
Current profile or reusable-answer changes do not rewrite history.

Future strategy, tailored resumes, recruiter relationship modeling, analytics,
and outcomes may reference Application. They are not required in the current
Application schema.

## 16. Information and answer boundaries

CareerOS must not collapse all user information into Career Evidence.

### 16.1 Professional truth

Confirmed facts about education, employment, projects, skills, achievements,
metrics, and related professional history. These belong in Career Brain and may
produce Career Evidence.

### 16.2 Confirmed personal/contact information — implemented

User-provided name, phone, address, and professional link fields stored in
`UserContactInfo`. These are not Career Evidence and are not inferred from
resume content. Confirmed contact info may be used deterministically by the
Answer Engine with source category `USER_CONTACT_INFO`.

### 16.3 Application preferences

User choices such as target locations, work arrangement, relocation preference,
or search-specific preferences. They are not proof of professional capability.

### 16.4 Reusable confirmed answer — implemented (Phase R)

A user-approved answer intended for reuse across equivalent application
questions when policy allows.

Conceptual fields may include:

- canonical question key;
- typed answer;
- sensitivity/policy category;
- explicit confirmation and reuse intent;
- timestamps; and
- current/revoked state.

Implemented as `reusable_answers`: owner, original question text, normalized
question key, answer text, `created_at`, and `revoked_at`. Rows are never
edited; a new save revokes the previous active row for that key (a partial
unique index allows one active row per user and key). Sensitive or
consequential questions are refused at save time. Canonical fields continue to
use fixed structured sources (Career Brain, `UserContactInfo`, Resume); reusable
records cover only custom questions.

### 16.5 Application-specific answer — implemented narrow history

M14 stores ordered, immutable, user-confirmed standard answers with question
text/key, answer text, source category, policy category, sensitivity, position,
and confirmation timestamp. Sensitive/consequential persistence remains
prohibited pending an approved retention policy.

Application-specific answers do not automatically become reusable.

### 16.6 Sensitive answer

A sensitive or consequential answer requires explicit user origin, restricted
use, and approved policy. It must never be inferred from Career Evidence or
indirect traits.

## 17. Answer provenance

An Answer Engine decision should be able to identify:

- normalized field/question key;
- proposed answer or unknown;
- source category and source identifier where applicable;
- policy outcome;
- confidence;
- sensitivity;
- required review/confirmation; and
- final action.

Not every transient decision must become a permanent table. Persist only what is
required for the approved user experience, auditability, and Application Memory.

## 17a. Browse feedback (Phase Z)

- `job_dismissals(user_id, job_id)`, unique per pair: the user's "not
  interested". It hides the job from browse listings only.
- `hidden_companies(user_id, company_key, company_name)`, unique per
  `(user_id, company_key)`, where `company_key = lower(trim(company))`. Browse
  listings exclude jobs whose `lower(trim(jobs.company))` matches.

Neither table edits or deletes a job. Saved jobs, the user's own jobs, and
applications are never hidden. Both tables cascade with the user and are
included in the data export.

## 18. Product service relationships

```text
Career Brain ─┬─ Job Intelligence
              ├─ Answer Engine
              ├─ Autofill
              ├─ Resume Tailoring (Phase Z: suggestions → user-accepted TAILORED version)
              ├─ Interview Preparation (Phase Z: stateless, evidence-cited plan)
              └─ Recommendation (future)

Job ──────────┬─ Job Discovery
              ├─ Job Intelligence
              └─ Application

Resume Version ─ Application

Application ── future strategy, interviews, outcomes, analytics, learning
```

Services share domain references rather than copying whole alternate user or job
profiles.

## 19. Deletion and correction

Corrections affect future reasoning. Historical artifacts may preserve what was
used at the time where product, legal, and retention policy allows.

The system must distinguish current truth from historical application context.
Exact retention and deletion policy requires an explicit product/legal decision;
the architecture must not guess.

User-initiated deletion is implemented (Phase S) with these rules:

- **Job** (`DELETE /jobs/{id}`): removes snapshots, requirements, analyses, and
  saves. Applications survive with `job_id` set to null; their company/role
  snapshots keep them meaningful. `PATCH /jobs/{id}` edits listing fields only;
  captured descriptions stay immutable snapshots.
- **Application** (`DELETE /applications/{id}`): removes its answers, status
  history, activities, contacts, and idempotency records.
- **Resume** (`DELETE /resumes/{id}`): refused with `409 RESUME_IN_USE` while an
  Application records any of its versions, because an application's exact
  resume is history. Otherwise removes all versions, imports, draft items,
  derived job analyses, asset rows, and stored files. Confirmed Career Brain
  evidence is not removed.
- **Account** (`DELETE /me` with `{"confirm": "DELETE"}`): removes the Career
  Brain and user row (every owned table cascades) and then the stored resume
  files. The auth provider identity is not deleted by the API.
- **Export** (`GET /me/export`): one JSON document with every owned table,
  excluding internal storage keys; original files remain downloadable per
  version.

## 20. Implementation guidance

Prefer:

- conventional relational tables;
- explicit foreign keys and ownership;
- stable identifiers;
- constrained enums for stable concepts;
- immutable historical records where required;
- narrow provider metadata; and
- idempotent creation for retried extension/application operations.

Avoid:

- one opaque Career Brain JSON document;
- source-provider schemas as canonical Job fields;
- all answers represented as Career Evidence;
- mutable historical resume/application records;
- speculative event stores, graph databases, or generic plugin tables; and
- a schema for every imagined future service.

## 21. Review questions

Before implementing a new schema, verify:

1. Is this core domain truth or service workflow state?
2. Is it implemented now or merely planned?
3. Can an externally found job be applied to without pre-existing Job analysis?
4. Can Application preserve the exact Resume Version and context used?
5. Is a reusable answer clearly distinct from one application answer?
6. Are sensitive answers explicit and policy-controlled?
7. Do source adapters normalize without leaking provider schemas?
8. Do historical evidence, resume, analysis, and application records remain
   stable?
9. Is user ownership enforceable for every reference?
10. Is the model minimal for the approved milestone?
