# CareerOS — Product Constitution

> Version: 0.3
> Status: Approved V1 re-baseline
> Last Updated: 2026-09-26

## 1. Product vision

CareerOS is an AI-native job-search operating system that develops a durable
understanding of the user and applies that shared understanding across the job
search.

The product promise is:

> CareerOS learns your professional identity once, helps you discover
> opportunities, helps you apply wherever you find them, remembers what you did,
> and can go deeper when an opportunity matters.

CareerOS should become more useful as it learns from user-confirmed professional
truth, application preferences, reusable answers, applications, and outcomes.

## 2. V1 product spine

The approved V1 spine is:

```text
KNOW ME → DISCOVER → APPLY ANYWHERE → REMEMBER
                         ↘
                       ENHANCE (optional)
```

This replaces the assumption that every application must pass through deep Job
Intelligence, Application Strategy, and resume tailoring.

Many users already know they want to apply. CareerOS should let them move
quickly. Deeper intelligence is available by choice, not imposed as a toll gate.

## 3. The connected problem

Job searching is fragmented across profiles, resumes, job sites, company career
pages, application forms, and tracking tools. Users repeatedly:

- explain the same professional history;
- search across disconnected sources;
- enter the same application information;
- lose track of which resume and answers they used; and
- use isolated optimization tools that lack durable context.

CareerOS connects these activities through shared core domains. A user should
not need to reconstruct their professional identity for every service.

## 4. Know Me

CareerOS first builds a durable understanding of the user.

The preferred V1 onboarding is resume-first:

```text
Sign up
→ Upload resume
→ Parse resume
→ Review extracted information
→ Correct or remove information
→ Confirm
→ Career Brain
```

The resume provides a fast initial context. Users should not be forced through a
large blank profile form before receiving value.

### Career Brain is not a resume

Career Brain is the canonical structured professional truth layer. It may
contain education, experience, projects, skills, achievements, metrics,
certifications, professional links, and other confirmed facts.

A resume is a presentation artifact containing a selected subset of that truth.
One Career Brain may support many resumes and resume versions.

Career Brain can grow through resume imports, direct edits, confirmed answers
that genuinely represent professional truth, and future approved interactions.

Confirmed personal and contact information — name, phone, address, LinkedIn,
portfolio, and related fields — lives in `UserContactInfo`, separate from
Career Evidence. It is user-provided, explicitly confirmed, and eligible for
deterministic Answer Engine use. It is not inferred from resumes or email.

AI-extracted information is a draft, not authoritative truth. User confirmation
and correction are authoritative.

## 5. Discover

CareerOS Web should become a useful place to browse opportunities.

The V1 product experience should support:

- Jobs overview;
- latest jobs;
- search and filters;
- job detail;
- save job; and
- apply.

Jobs may eventually come from permitted feeds, APIs, company sites, ATS sources,
extension capture, or manual entry. The CareerOS experience must not depend on a
single provider's schema.

Real production job-data acquisition is separate from current product
formation. Seed, demo, and test jobs are acceptable while the experience and
canonical boundaries are formed. CareerOS is not attempting to become a
large-scale scraping platform or a universal job marketplace in V1.

## 6. Apply Anywhere

Application assistance is a core V1 capability and must work independently of
CareerOS Jobs.

Both paths are first-class:

```text
CareerOS Jobs → Job Detail → Apply → external application → extension
```

```text
Job found elsewhere → external application → extension
```

The user must not be required to discover, analyze, or save a job inside
CareerOS before using application assistance.

The intended assistance flow is:

```text
Application Page
→ Detect application/form
→ Normalize fields and questions
→ Resolve approved answer sources
→ Apply confidence and sensitivity policy
→ Fill supported fields
→ Ask or flag uncertain fields
→ User review
→ User submits
```

Final submission remains an explicit user action. V1 does not auto-submit or
mass apply.

## 7. Remember

An Application is a durable record, not a transient UI state.

Application Memory should preserve, where available:

- company and role;
- a canonical or externally captured Job reference;
- application URL and source;
- the selected immutable Resume Version;
- relevant confirmed or application-specific answers;
- current status;
- applied timestamp; and
- creation and update timestamps.

Supported V1 statuses are conceptually:

- Preparing
- Applied
- Assessment
- Interview
- Final
- Rejected
- Offer
- Withdrawn

Future strategy, tailored resumes, recruiter interactions, interview rounds,
analytics, and learning may attach to the Application. Those are not required
for current product formation.

## 8. Enhance is optional

Enhance is the optional deeper-intelligence layer for opportunities that deserve
additional effort.

The existing Job Intelligence foundation can help users understand:

- structured requirements;
- Strong Evidence;
- Hidden or Underrepresented Evidence;
- Weak Evidence;
- Genuine Gaps; and
- an explainable application recommendation.

A future optional action such as “Optimize for this job” may lead to Application
Strategy, evidence selection, resume tailoring, application Q&A, or interview
preparation.

Application Strategy and resume tailoring are deferred. Existing Job
Intelligence must be preserved, but it must not be represented as mandatory
before Apply.

## 9. Core domains and product services

CareerOS distinguishes relatively stable core domains from evolving product
services.

### Core domains

- Identity
- UserContactInfo
- Career Brain
- Career Evidence
- Resume
- Job
- Application

### Product services and workflows

- Job Discovery
- Autofill
- Answer Engine
- Job Intelligence
- Resume Tailoring
- Application Q&A
- Interview Preparation
- Recommendation
- Analytics
- Career Planning
- future agents

Product services consume shared core domain data. They must not create separate,
incompatible representations of the user.

## 10. Answer boundaries

Not every answer is professional evidence. CareerOS must distinguish:

- professional truth — facts about the user's career;
- confirmed personal/contact information — user-provided contact fields stored
  separately from Career Evidence;
- application preferences — user choices that may change by search or context;
- reusable confirmed answers — answers the user explicitly chooses to reuse;
- application-specific answers — what was used for one application; and
- sensitive answers — data requiring explicit policy and greater protection.

Unknown remains unknown. CareerOS must not infer demographic, disability,
veteran, legal, work-authorization, sponsorship, compensation, signature, or
other consequential answers from indirect signals.

## 11. Product principles

### Shared understanding

Services should reuse canonical Career Brain, Resume, Job, and Application data.

Job Search Goals are also shared context: users may keep separate China and
North America targets, while the underlying Career Brain remains one confirmed
professional truth. Interface language and target market are independent.

### Evidence before generation

Generated professional claims must be supported by user-provided or
user-confirmed evidence.

### Speed without forced optimization

Users can apply quickly without completing a deep analysis. Enhance is available
when useful.

### Apply anywhere

CareerOS assistance is not limited to jobs discovered inside CareerOS.

### User control

Users review uncertain information and intentionally submit applications.

### Preserve originals and history

Original files, immutable revisions, resume versions, analyses, and historical
application context must not be silently rewritten.

### Unknown is valid

Missing or uncertain information must not be converted into fact.

### Fail clearly

Unsupported pages, fields, jobs, or AI operations should have understandable
fallbacks.

### Progressive capability

Prefer suggest → assist → automate → learn, with policy and trust appropriate to
the action.

### Simple and extensible

Use clear domain boundaries and adapters at genuine external boundaries rather
than speculative infrastructure.

## 12. What CareerOS is not

CareerOS is not merely:

- a resume builder;
- a resume-tailoring tool;
- an autofill extension;
- a job board;
- an ATS score;
- a generic career chatbot; or
- an autonomous mass-application system.

It is also not an excuse to infer sensitive answers, fabricate professional
claims, or remove the user's control of final submission.

## 13. V1 definition

V1 product formation is successful when representative users can complete both
scenarios reliably.

### Scenario A — CareerOS-discovered job

```text
Resume → Career Brain → CareerOS Jobs → Job → Apply
→ external application → extension → autofill
→ review → user submit → Application Memory
```

### Scenario B — independently discovered job

```text
Resume → Career Brain → job found elsewhere
→ external application → extension → autofill
→ review → user submit → Application Memory
```

Optional Job Intelligence may be used in either scenario, but neither scenario
depends on it.

## 14. Current implementation boundary

Implemented through M17 plus the post-M17 wave (M16 automated hardening included;
representative browser gate still pending):

- project foundation;
- Career Brain/Profile;
- Career Evidence and immutable revisions;
- resume ingestion and immutable versions;
- manual Job capture and parsing;
- evidence matching and hidden-evidence detection;
- Job Intelligence experience;
- the Jobs-first product shell, browse/search/filter/save/detail/Apply flow;
- the provider-neutral Job source boundary with retry-safe ingestion and honest
  freshness/availability state;
- the secure Manifest V3 extension foundation, authenticated API boundary,
  active-tab application-page detection, and honest unsupported states; and
- an in-page Application Assistant — a controlled UI panel for detection,
  Answer Engine answers, form filling, and Application Memory — with open
  Shadow DOM style isolation, on-demand content-script injection, explicit
  activation, keyboard shortcut, and page lifecycle handling without
  `<all_urls>` access;
- provider-neutral read-only form normalization with generic and initial ATS
  adapter boundaries, canonical keys, and explicit support/confidence states;
  and
- the authenticated Answer Engine foundation with owned source retrieval,
  deterministic sensitive policy, bounded semantic classification, explicit
  decision/review states, and confirmed contact-info mappings; and
- user-triggered execution for approved blank native controls with exact target
  revalidation, non-overwrite behavior, visible field states, initial ATS
  fixture coverage, and no final submission; and
- durable Application Memory for CareerOS and externally found jobs with stable
  context snapshots, exact Resume Version association, immutable approved
  answers, lifecycle status, ownership, and idempotency; and
- Applications list/detail/status/manual recovery plus CareerOS Job handoff and
  explicit extension recording after user submission;
- data-minimized Application Assistant context, concurrent retry coverage,
  post-redirect Preparing recovery, and automated contracts for both required
  V1 paths;
- mutually exclusive loading/error/empty states and consistent API error
  representation;
- user-owned `UserContactInfo` with Career Profile UI and Answer Engine
  integration for name, phone, address, and professional links;
- resume-first onboarding at `/start`, an improved landing page, and an
  extension setup guide at `/setup`;
- a `/readiness` endpoint and local JWKS preflight diagnostic
  (`scripts/preflight.py` checks Clerk JWKS reachability only);
- partial English/Simplified Chinese localization for Applications, Resumes,
  Career Profile, and Job detail; and
- refactored Jobs page, extension popup, messages, and API client modules.

Planned during V1 formation:

- automatic resume/file upload and broader custom-widget execution;
- representative unpacked-Chrome validation of both end-to-end paths; and
- complete localization of remaining Web surfaces and the extension.

Deferred until after formation unless explicitly reprioritized:

- real multi-market job-source acquisition;
- Application Strategy and resume tailoring;
- cover letters and interview preparation;
- sophisticated recommendations and outcome learning;
- career planning, personalization, and autonomous agents.

## 15. North star

CareerOS should make this statement true:

> CareerOS knows my confirmed professional context, helps me find opportunities,
> helps me apply wherever I encounter them, remembers what I used and what
> happened, and offers deeper truthful intelligence when I ask for it.
