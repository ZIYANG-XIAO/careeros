# CareerOS Core V1 — Domain Data Model

> Version: 0.2
> Status: Approved logical model; implementation status called out explicitly
> Last Updated: 2026-09-25

## 1. Purpose

This document defines CareerOS domain concepts for the re-baselined V1. It
separates the implemented M0–M12 product state from planned V1 formation
concepts. M10–M12 add no database migration.

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
├── Career Brain
│   ├── Education
│   ├── Experience → Experience Detail
│   ├── Project → Project Detail
│   ├── Skill
│   └── Career Evidence → immutable revisions
├── Resume → immutable Resume Versions
├── Job → snapshots → requirements → analyses/matches
│   └── Saved Job (per-user interest state)
└── Application (planned)
    ├── selected Resume Version
    ├── application-specific answers
    └── status and timestamps
```

Identity, Career Brain, Career Evidence, Resume, Job, and Application are core
domains. Job Discovery, Autofill, Answer Engine, Job Intelligence, and other
workflows are services that consume them.

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

Current Alembic head: `0008_m9_job_source_boundary`.

M12 adds a transient Answer Engine decision contract and no tables. Decisions
reference owned canonical sources but are not persisted as Application or
Reusable Answer history.

### Planned, not implemented

- Application;
- Application Answer;
- Reusable Answer;
- application preferences beyond currently approved fields;
- status history;
- persisted extension/form records; and
- Application Strategy and Resume Recommendation.

This document proposes those boundaries but does not claim their schema exists.

## 5. User and ownership

`User` represents the internal account owner and maps an authentication-provider
identity to CareerOS resources.

All private Career Brain, evidence, resume, job, analysis, application, answer,
and file resources belong to a user context. Ownership is enforced server-side,
including nested identifiers and identifiers returned by AI.

## 6. Career Brain

`CareerBrain` is the aggregate root for canonical professional truth. It is one
per user in the current implementation.

Implemented child entities include Education, Experience, Experience Detail,
Project, Project Detail, and Skill. Future approved fields may include personal
information, certifications, achievements, metrics, professional links,
application information, and preferences.

Career Brain data can originate from resume import or direct user actions, but
AI extraction remains a draft until confirmed according to product rules.

## 7. Career Evidence

`CareerEvidence` gives relevant professional facts stable identity.
`CareerEvidenceRevision` stores immutable content revisions, origin,
confirmation status, author category, and revision number.

The current evidence sources include meaningful experience details, project
details, and skills. Future approved evidence sources may extend this list.

The current revision pointer can change; historical revisions do not. Downstream
historical records reference the exact revision used.

An evidence reference must be validated for existence, ownership, confirmation
eligibility, and context before use.

## 8. Resume

`Resume` is a logical user-owned asset. `ResumeAsset` preserves the uploaded file
metadata and storage reference. `ResumeVersion` is an immutable or historically
preserved representation containing extracted and structured content.

Implemented source relationships support uploaded resume history. Future
job-specific variants may reference a source version and target Job, but resume
tailoring is not implemented.

Career Brain and Resume remain separate:

- Career Brain represents confirmed professional truth.
- Resume Version represents what the user chose to present at a point in time.

## 9. Resume import

`ResumeImport` tracks the draft/confirmation workflow for a Resume Version.
`ResumeDraftItem` stores extracted review items and links them to evidence.

Draft items are not authoritative merely because a parser produced them. User
edits and confirmation determine their downstream eligibility.

## 10. Canonical Job

`Job` represents an opportunity independent of how it was acquired.

The implemented Job contains user ownership, company, title, location, source
and application URLs, source type/key, optional external identity and canonical
URL, observed timestamps, explicit availability/freshness state, and timestamps.
Current user-facing behavior creates manually entered Jobs; the M9 source
boundary also supports normalized seed/demo/test ingestion.

The logical Job should remain capable of representing:

- CareerOS job data;
- company or ATS sources;
- permitted feeds/APIs;
- extension-captured external jobs; and
- manual entry.

Source-specific payloads must not become the canonical model.

### 10.1 Implemented job-source boundary

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
canonical URL, first/last observed timestamps, and explicit
availability/freshness state. Provider payloads are not stored as canonical Job
truth.

Do not add a large generic ingestion schema before actual source requirements are
known.

### 10.2 Deduplication and freshness

Implemented deduplication prefers source key plus external source ID, then
canonical URL. It avoids obvious retry duplicates without claiming perfect
global identity resolution. Description changes append immutable Job Snapshots
instead of creating another canonical Job.

Freshness should indicate what CareerOS knows about when a source was observed or
whether a job appears available. Unknown freshness must remain unknown.

## 11. Job snapshots and requirements

`JobSnapshot` immutably preserves the raw and normalized job description, parser
metadata, content hash, and version. `JobRequirement` stores structured,
source-grounded requirements with category, importance, source text, confidence,
and position.

Existing manually captured Jobs and snapshots remain valid when future source
boundaries are introduced.

## 12. Job Intelligence

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

## 13. Saved Job and discovery state — implemented

`SavedJob` is a durable user-owned interest marker with `user_id`, `job_id`, and
`created_at`. The `(user_id, job_id)` pair is unique, making save retries
idempotent. Both identifiers are protected by cascading foreign keys.

Saving means “I am interested in this opportunity.” It does not necessarily
mean the user analyzed or applied. Save and unsave never create an Application.

## 14. Application — planned core domain

Application is not implemented today. During V1 formation it should become a
durable user-owned entity representing work toward or completion of an
application.

Conceptual fields:

- `id`
- `user_id`
- optional `job_id`
- external company and role snapshot where no canonical Job exists
- application URL
- application source/context
- optional selected `resume_version_id`
- status
- `applied_at`
- `created_at`
- `updated_at`

An external application must be recordable even if the user never discovered or
saved a Job in CareerOS. The implementation may create or associate a minimal
canonical Job when useful, but this is an implementation decision for the
Application milestone and must not block assistance.

### 14.1 Status

Conceptual V1 statuses:

- `preparing`
- `applied`
- `assessment`
- `interview`
- `final`
- `rejected`
- `offer`
- `withdrawn`

The first schema may store current status and timestamps while preserving a path
to future status history.

### 14.2 Historical snapshot rule

An Application preserves what was used at the time: exact Resume Version,
relevant answers, captured job/application context, status, and timestamps.
Current profile or reusable-answer changes do not rewrite history.

Future strategy, tailored resumes, recruiter interactions, interviews,
analytics, and outcomes may reference Application. They are not required in the
initial Application schema.

## 15. Information and answer boundaries

CareerOS must not collapse all user information into Career Evidence.

### 15.1 Professional truth

Confirmed facts about education, employment, projects, skills, achievements,
metrics, and related professional history. These belong in Career Brain and may
produce Career Evidence.

### 15.2 Application preferences

User choices such as target locations, work arrangement, relocation preference,
or search-specific preferences. They are not proof of professional capability.

### 15.3 Reusable confirmed answer — planned

A user-approved answer intended for reuse across equivalent application
questions when policy allows.

Conceptual fields may include:

- canonical question key;
- typed answer;
- sensitivity/policy category;
- explicit confirmation and reuse intent;
- timestamps; and
- current/revoked state.

The initial Answer Engine milestone must determine whether fixed structured
fields, reusable records, or both best fit approved questions.

### 15.4 Application-specific answer — planned

What was proposed, supplied, or used for one Application. Conceptual fields may
include question text/key, answer, source, confidence, review state, sensitivity
category, and user confirmation.

Application-specific answers do not automatically become reusable.

### 15.5 Sensitive answer

A sensitive or consequential answer requires explicit user origin, restricted
use, and approved policy. It must never be inferred from Career Evidence or
indirect traits.

## 16. Answer provenance

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

## 17. Product service relationships

```text
Career Brain ─┬─ Job Intelligence
              ├─ Answer Engine
              ├─ Autofill
              ├─ Resume Tailoring (deferred)
              ├─ Interview Preparation (future)
              └─ Recommendation (future)

Job ──────────┬─ Job Discovery
              ├─ Job Intelligence
              └─ Application

Resume Version ─ Application

Application ── future strategy, interviews, outcomes, analytics, learning
```

Services share domain references rather than copying whole alternate user or job
profiles.

## 18. Deletion and correction

Corrections affect future reasoning. Historical artifacts may preserve what was
used at the time where product, legal, and retention policy allows.

The system must distinguish current truth from historical application context.
Exact retention and deletion policy requires an explicit product/legal decision;
the architecture must not guess.

## 19. Implementation guidance

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

## 20. Review questions

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
