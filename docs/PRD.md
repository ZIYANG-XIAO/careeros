# CareerOS Core V1 — Product Requirements

> Version: 0.2
> Status: Approved V1 re-baseline
> Last Updated: 2026-09-23

## 1. Purpose

CareerOS Core V1 establishes a connected job-search workflow built on a durable
understanding of the user.

The V1 product spine is:

```text
KNOW ME → DISCOVER → APPLY ANYWHERE → REMEMBER
                         ↘
                       ENHANCE (optional)
```

V1 must not require deep job analysis or resume optimization for every
application. A user who has already decided to apply should be able to move
directly to application assistance.

## 2. Current and planned scope

### Implemented now — M0–M7

- authenticated Web/API/PostgreSQL foundation;
- Career Brain/Profile management and user ownership;
- stable Career Evidence and immutable revisions;
- resume upload, extraction, structured parsing, review, confirmation, and
  immutable Resume Versions;
- manual Job capture and structured Job Requirements;
- evidence retrieval and matching;
- Strong, Hidden, Weak, and Genuine Gap classifications; and
- explainable Job Intelligence pages and recommendations.

### Planned V1 formation

- product shell and primary Jobs experience;
- provider-independent job-source boundary;
- browser extension foundation and authentication;
- application-page and form detection;
- normalized fields/questions and ATS adapter boundary;
- Answer Engine and Career Brain-backed autofill;
- durable Application domain and Applications surface;
- Web/extension/Application Memory integration; and
- V1 hardening across both required scenarios.

### Deferred enhancements

- Application Strategy;
- resume tailoring and job-specific resume generation;
- cover letter generation;
- application Q&A generation beyond approved Answer Engine behavior;
- interview preparation;
- sophisticated recommendations and outcome learning; and
- career planning, localization, personalization, and autonomous agents.

Existing Job Intelligence remains implemented optional functionality.

## 3. Primary users

Initial users are active technical job seekers, including students, new
graduates, early-career professionals, and experienced professionals. Initial
roles may include software, data, infrastructure, machine-learning, and related
technical roles.

The architecture must not permanently constrain CareerOS to technical roles or
one recruiting market.

## 4. Know Me requirements

### 4.1 Resume-first onboarding

The preferred onboarding is:

```text
Sign up → Upload resume → Parse → Review → Correct/remove → Confirm → Career Brain
```

Requirements:

- The user is not forced through a large blank profile form first.
- PDF and DOCX uploads are validated and size-limited.
- The original resume file is preserved.
- Extracted content is presented as a draft.
- Users can correct, remove, and confirm extracted information.
- Uncertain extraction remains uncertain rather than silently becoming truth.
- A parsing failure provides retry or recovery without corrupting confirmed data.

### 4.2 Career Brain

Career Brain is the canonical professional truth layer and remains distinct from
Resume.

It should support professional information such as:

- personal and professional contact information;
- education;
- experience and meaningful details;
- projects and meaningful details;
- skills and technologies;
- achievements, metrics, certifications, and professional links when approved;
- application information where explicitly provided; and
- career preferences.

Users must be able to view, add, edit, remove, and confirm supported information.
Confirmed information persists and becomes eligible for approved downstream
services.

### 4.3 Provenance and evidence

CareerOS must distinguish AI-extracted, user-added, user-edited, and confirmed
information. `CareerEvidence` maintains stable identity and
`CareerEvidenceRevision` is immutable.

Professional claims must not be fabricated. User corrections override AI
interpretation.

### 4.4 Resume library

A user may have multiple resumes and immutable versions. The product must
preserve originals and historical Resume Versions. An Application must
eventually reference the exact version used.

## 5. Discover requirements

### 5.1 Jobs as a primary Web surface

The implemented M8 Jobs experience supports:

- latest or available jobs overview;
- search;
- useful filters;
- job detail;
- save job; and
- apply.

Search currently matches title and company, and location is a separate filter.
The current dataset is user-added manual data and is explicitly not represented
as a production live feed.

### 5.2 Job source independence

The canonical CareerOS Job must not depend on one source provider's schema.

Jobs may originate from:

- CareerOS job data;
- company career sites;
- ATS sources;
- future permitted feeds or APIs;
- extension-captured external pages; or
- manual entry.

External sources should pass through a narrow source-adapter and normalization
boundary. Deduplication and freshness must be represented at a level appropriate
to the approved milestone.

Production job-data acquisition, mass scraping, and multi-market ingestion are
not part of current product formation. Seed/demo/test jobs are allowed.

### 5.3 Job detail

A Job detail should be able to present available canonical information such as:

- company;
- role;
- location or work arrangement;
- description;
- source and external URL;
- freshness/availability where known;
- save state; and
- Apply action.

Job Intelligence may appear as an optional action or existing analysis, not a
mandatory prerequisite for Apply.

### 5.4 Current manual jobs

Existing manually created Jobs and Job Intelligence remain valid. The future
source boundary must extend rather than invalidate the existing model and
history.

## 6. Apply Anywhere requirements

### 6.1 Equal entry paths

V1 must support both:

1. a Job selected inside CareerOS followed by an external application page; and
2. a job independently found by the user followed directly by an external
   application page.

The second path is first-class, not a degraded fallback. Application assistance
must not require a pre-existing CareerOS Job, saved job, or Job Analysis.

### 6.2 Extension responsibilities

The extension should remain a thin contextual assistant responsible for:

- secure authentication with CareerOS;
- detecting supported application pages/forms;
- extracting narrowly scoped application context;
- normalizing fields and questions;
- requesting answers from the Answer Engine;
- filling supported fields;
- marking uncertain, unsupported, or unanswered fields;
- supporting resume selection/upload where reliable; and
- giving the user a clear review state.

Complex profile editing, Jobs browsing, and detailed intelligence remain in the
Web application.

### 6.3 Form and ATS support

The conceptual order is:

```text
Generic form support
→ Greenhouse
→ Lever
→ Ashby
→ additional approved environments
```

Generic behavior should be used when reliable. Site-specific behavior belongs
behind an adapter boundary. CareerOS must not claim universal compatibility.
Workday is not an initial V1 exit requirement.

### 6.4 Answer Engine

The Answer Engine is a reusable service, not extension-only business logic.

Conceptual pipeline:

```text
Field/question
→ classify
→ retrieve approved sources
→ apply answer policy
→ evaluate confidence and sensitivity
→ autofill, suggest, ask, require confirmation, or leave unanswered
```

Possible answer sources include:

- Career Brain;
- confirmed profile data;
- application preferences;
- reusable confirmed answers;
- the selected Resume Version; and
- current Application context.

Unknown remains unknown. The engine must not fabricate answers.

### 6.5 Answer categories

The product and storage model must distinguish:

- professional truth;
- application preferences;
- reusable confirmed answers;
- application-specific answers; and
- sensitive answers.

An application-specific answer does not automatically become reusable. The user
must explicitly choose reuse when appropriate.

### 6.6 Sensitive and consequential fields

CareerOS must not infer protected, sensitive, legal, or consequential answers,
including:

- demographic disclosures;
- disability or veteran status;
- work authorization and sponsorship;
- salary or compensation expectations;
- legal attestations; and
- signatures.

Supported reuse requires explicit user-provided information and an approved
policy. Protected traits must never be inferred from indirect signals.

### 6.7 Review and submission

The product should distinguish filled, needs review, needs answer, and
unsupported states. The user reviews the application and intentionally performs
the final submission. V1 must not auto-submit.

## 7. Remember requirements

### 7.1 Durable Application

Application becomes a stable core domain entity during V1 formation.

An Application should be capable of preserving:

- user ownership;
- company and role;
- canonical Job reference when available;
- externally captured job/application context when no canonical Job existed;
- application URL and source;
- exact selected Resume Version;
- relevant confirmed or application-specific answers;
- current status;
- `applied_at`; and
- creation/update timestamps.

### 7.2 Statuses

V1 statuses:

- Preparing
- Applied
- Assessment
- Interview
- Final
- Rejected
- Offer
- Withdrawn

The initial implementation may store current status and relevant timestamps
while preserving a clean path to status history.

### 7.3 Applications surface

Users should be able to:

- view applications;
- identify company, role, status, and applied date;
- see the exact Resume Version used;
- open application detail;
- update status; and
- understand whether the application originated from a CareerOS Job or an
  external flow.

### 7.4 Historical stability

Later Career Brain, reusable-answer, Resume, or Job changes must not silently
rewrite historical application context. Historical records should preserve what
was actually used at the time.

## 8. Optional Enhance requirements

The implemented Job Intelligence foundation structures jobs, retrieves confirmed
evidence, evaluates support, detects resume representation, and produces an
explainable recommendation.

Requirements:

- Job Intelligence remains accessible when a user wants deeper analysis.
- Apply must not be blocked on analysis.
- Match summaries must not imply interview or offer probability.
- Evidence references remain user-owned and attributable to immutable revisions.
- Hidden Evidence must remain distinct from Genuine Gap.
- Missing requirements must not become invented professional claims.

Application Strategy, evidence-grounded resume tailoring, cover letters,
application Q&A, and interview preparation are deferred and must not be treated
as implemented.

## 9. Navigation and product language

Primary planned Web navigation:

- Jobs
- Applications
- Resumes
- Profile

User-facing language should not require users to understand persistence details
such as evidence revisions, job snapshots, provenance enums, or representation
enums. Those concepts remain visible when needed for trust and explanation, not
as implementation jargon.

## 10. Cross-cutting requirements

### Ownership

Every user-owned resource is authorized server-side. UI hiding is not
authorization.

### Untrusted input

Resumes, job descriptions, external job records, web pages, application forms,
and provider responses are untrusted. Their content cannot override trusted
CareerOS instructions.

### Grounding

Generated professional claims require valid evidence. Evidence identifiers,
ownership, revision, and context must be validated.

### Privacy

Collect, transmit, log, and retain only information justified by the approved
workflow. Sensitive answers receive stricter treatment.

### Recovery

Failures in job loading, page detection, field resolution, AI processing, or
submission detection must preserve canonical data and offer a reasonable manual
path.

## 11. V1 acceptance scenarios

### Scenario A — CareerOS Jobs

1. User establishes a Career Brain from a resume.
2. User browses CareerOS Jobs.
3. User opens a Job and chooses Apply.
4. The external application page opens.
5. Extension detects the application and supported fields.
6. Answer Engine resolves supported answers.
7. Extension fills supported fields and flags uncertainty.
8. User reviews and manually submits.
9. CareerOS records the Application and exact Resume Version.
10. User sees it in Applications.

### Scenario B — job found elsewhere

1. User establishes a Career Brain from a resume.
2. User finds a job outside CareerOS.
3. User opens its application page.
4. Extension assists without requiring an existing CareerOS Job or analysis.
5. User reviews and manually submits.
6. CareerOS captures enough external context to create Application Memory.
7. User sees it in Applications.

Both scenarios are required for V1 formation. Optional Enhance may be invoked in
either flow but is not required.

## 12. V1 non-goals

- automatic final submission;
- mass apply or autonomous high-volume application;
- universal ATS support;
- Workday as an initial exit criterion;
- mass scraping or a complete job marketplace;
- production U.S./China job ingestion during formation;
- recruiter or employer products;
- exact interview or offer probabilities;
- Application Strategy or resume tailoring during formation;
- cover letters or a full interview platform;
- email/calendar synchronization;
- advanced analytics, outcome learning, or predictive personalization;
- localization engines, career planning, or autonomous agents; and
- speculative distributed infrastructure.

## 13. V1 success standard

CareerOS V1 succeeds when users can establish trusted professional context,
discover or independently find an opportunity, receive reliable application
assistance without forced optimization, intentionally submit, and return to a
durable record of what they did.
