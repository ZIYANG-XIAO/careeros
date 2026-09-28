# CareerOS Core V1 — User Flows

> Version: 0.2
> Status: Approved V1 re-baseline
> Last Updated: 2026-09-26

## 1. Experience model

The V1 experience is:

```text
KNOW ME → DISCOVER → APPLY ANYWHERE → REMEMBER
                         ↘
                       ENHANCE (optional)
```

The product should feel like CareerOS already understands the user's confirmed
context. Deep analysis is available when useful, but routine application help
must remain fast.

## 2. Product surfaces

### Web application

Primary navigation:

- Home
- Discover
- Applications
- Career Brain

Home aggregates the next useful actions and factual recent state. Discover owns
job browsing and saved opportunities. Applications owns the action queue,
board/list management, and history. Career Brain owns professional context,
resumes, contact information, and preferences. The Web application also owns
onboarding and detailed optional intelligence.

### Browser extension

The extension is a thin assistant on external application pages. It authenticates
through CareerOS, distinguishes likely application, ordinary, and unsupported
pages, and inspects supported forms into a provider-neutral model. It requests
policy-controlled answer decisions and, after explicit user action, fills only
approved blank native controls while showing per-field review states. Durable
Application Memory is connected through a data-minimized background API. When
the user asks CareerOS to fill an independently found application, the extension
first attempts to preserve reviewed Preparing context so it can recover after a
post-submit redirect.

Users explicitly activate an in-page Application Assistant on the active tab
via the popup action or `Command/Ctrl+Shift+K`. The assistant is a controlled
UI panel for detection, answers, form filling, and Application Memory — not a
conversational AI agent. It renders inside an open Shadow DOM host (style
isolation only), is injected on demand via `activeTab` + `scripting` (not
manifest-declared `content_scripts`), uses `activeTab` permission (not
`<all_urls>`), and clears stale form state on page navigation. The compact popup
remains available for quick status and activation.

It is not a second full CareerOS application.

## 3. Current implementation boundary

Implemented Web flows today:

- system status and authentication entry;
- a signed-in Home that aggregates owned action, opportunity, Application, and
  Career Brain state without inventing deadlines or recommendations;
- Career Profile editing;
- resume upload, structured review, confirmation, library, and version detail;
- manual Job creation;
- Job browse/search/location filtering, durable save/unsave, detail, and safe
  direct Apply;
- secure extension authentication, protected API access, and active-tab
  application-page detection;
- read-only generic/Greenhouse/Lever/Ashby form normalization with explicit
  known, unknown, and unsupported states;
- authenticated Answer Engine decisions with safe unknown/sensitive behavior and
  aggregate extension preview;
- user-triggered approved-field execution with non-overwrite behavior, visible
  review states, and no final submission;
- authenticated durable Application Memory APIs for CareerOS and externally
  found jobs;
- Applications list/detail/status/manual recovery;
- Application lifecycle history plus user-authored notes, follow-ups, and
  interview records;
- CareerOS Job handoff into Application Memory and explicit extension recording
  after user submission;
- confirmation-page recovery from one recent reviewed Preparing Application;
  and
- Job Intelligence creation and review;
- resume-first onboarding at `/start` with step guidance;
- personal/contact information editing in Career Profile;
- extension setup guidance at `/setup`;
- partial English/Simplified Chinese localization for Applications, Resumes,
  Career Profile, and Job detail; and
- mutually exclusive loading/error/empty states across Web data surfaces.

Production job-source discovery, automatic file upload, complete localization of
every surface, and representative unpacked-Chrome validation remain planned.
Final submission remains user-controlled.

## 4. First-time onboarding — Know Me

```text
Landing
→ Sign up
→ /start onboarding
→ Upload resume
→ Parsing state
→ Career Brain draft
→ Review and correct
→ Confirm
→ Contact info (optional but encouraged)
→ Extension setup guidance
→ Product entry
```

### 4.1 Landing

The landing experience communicates that CareerOS helps users find, apply to,
and remember opportunities using one shared understanding of their career.

Primary action: Get Started. Returning users can sign in. Signed-in users with
incomplete onboarding may be routed to `/start`.

### 4.2 Resume upload

The user sees a focused prompt to build their profile from an existing resume.
They are not asked to complete a large empty form first.

The product validates the file and shows visible parsing progress.

### 4.3 Parsing failure

If parsing fails:

- explain the failure clearly;
- preserve the original file where appropriate;
- allow retry or another file; and
- do not present unreliable extraction as confirmed information.

### 4.4 Review and confirmation

The user reviews structured sections such as education, experience, projects,
and skills. They can correct, remove, or confirm extracted items.

The UI should distinguish draft/extracted information from confirmed
information without exposing persistence jargon.

### 4.5 Contact information

After resume confirmation, the user may add or confirm personal and contact
fields such as name, phone, address, LinkedIn, and portfolio URL. These values
live in `UserContactInfo`, separate from Career Evidence. They are user-provided,
explicitly confirmed, and become eligible for deterministic Answer Engine use.
They are not inferred from the resume or email.

The `/start` onboarding surface tracks contact-info completion as an optional
step. Users can also manage contact info from Career Profile at any time.

### 4.6 Extension setup

The `/start` flow and `/setup` guide explain how to build, load, and authenticate
the unpacked extension, including Clerk Native API and allowed-origin requirements.
Extension setup is guidance only; it does not block Web product entry.

### 4.7 Profile enrichment

After the initial profile is useful, the user may add omitted professional facts
or evidence. Enrichment is available but should not block entry into Jobs or
other product areas.

## 5. Returning user shell

The product shell should prioritize the next useful action rather than an empty
analytics dashboard. Depending on implemented wave, it may surface:

- latest or saved jobs;
- applications in progress;
- recent applications;
- resumes; and
- profile completion or correction prompts.

The implemented Home also surfaces incomplete follow-ups and future interviews
that the user explicitly recorded. It does not infer external appointments or
deadlines.

Navigation labels should remain user-facing. Users should not need to understand
internal concepts such as `CareerEvidenceRevision` or `JobSnapshot`.

## 6. CareerOS Jobs flow — Discover

This flow is implemented for current user-owned Job data.

```text
Jobs overview
→ Choose market independently from interface language
→ Search/filter/browse
→ Job detail
→ Save or Apply
```

### 6.1 Jobs overview

The overview supports available/latest jobs, search, saved state, North America
or China market, country, workplace, employment type, recent/title sorting, and
clear empty/loading/error states. English/Simplified Chinese UI selection is
independent from market selection. Seed or demo data may support product
formation before real job-source acquisition.

### 6.2 Job detail

The detail page presents available canonical information:

- company and role;
- location/work arrangement;
- description;
- source/freshness where known;
- external application destination;
- Save; and
- Apply.

Optional Enhance may be visible, but Apply does not depend on it.

### 6.3 Save

Save records the user's interest without creating an Application or forcing an
analysis. The exact persistence behavior is defined in the Jobs implementation
milestone.

### 6.4 Apply

Apply takes the user to the external company or ATS application page and provides
a clear transition to extension assistance. If extension support is unavailable,
the normal external application remains usable.

## 7. External-job flow — Apply Anywhere

This is an equal first-class flow:

```text
User finds job elsewhere
→ Opens external application page
→ Extension detects application
→ Application assistance begins
```

The user is not required to return to CareerOS, paste a job description, create
a Job, save it, or run Job Intelligence before using autofill.

When enough context is available, the extension/backend may normalize or capture
the external company, role, URL, and source for Application Memory. Uncertain
context must remain uncertain and reviewable.

## 8. Extension application flow

M10 implements authentication and initial page detection; M11 implements
read-only form normalization; M12 implements answer decisions and aggregate
preview; M13 implements explicit approved-field execution and visible review
states; the post-M17 wave adds an in-page assistant:

```text
Application Page
→ User activates in-page assistant
→ Detect form
→ Normalize fields/questions
→ Resolve answers
→ Fill supported fields
→ Flag uncertainty
→ User review
→ User submit
```

Activation requires explicit user action on the active tab (popup action or
`Command/Ctrl+Shift+K`). The assistant does not mount automatically on every
page load and does not request `<all_urls>` host permission.

### 8.1 Detection states

- Application detected — supported assistance is available.
- Partially supported — some fields can be handled; limitations are clear.
- Unsupported — preserve the normal manual workflow.
- Not an application page — do not pretend detection succeeded.

### 8.2 Field states

- Filled
- Suggested / Needs review
- Needs answer
- Requires explicit confirmation
- Unsupported

### 8.3 Resume selection

When the form requires a resume and upload is supported, CareerOS offers a
selected or user-chosen immutable Resume Version. It must not silently substitute
a different resume.

### 8.4 Review

Before submission, the user sees what was filled, what needs review, and what
remains unanswered. CareerOS must not imply that autofill guarantees correctness.

### 8.5 Submission

The user intentionally clicks the external site's final Submit action. CareerOS
does not auto-submit in V1.

## 9. Answer Engine flow

For each field or question:

```text
Classify
→ Retrieve approved sources
→ Apply policy
→ Evaluate confidence and sensitivity
→ Choose action
```

Possible actions:

- autofill;
- suggest;
- ask user;
- require explicit confirmation; or
- leave unanswered.

### 9.1 Known deterministic field

Example: a first-name field maps to confirmed `UserContactInfo.first_name` when
contact info has been explicitly confirmed. Email maps to authenticated identity.
It can be filled without AI interpretation.

### 9.2 Unknown-answer flow

```text
Question not known
→ Leave unresolved
→ Ask user
→ Use for this application
→ Optionally offer reusable save when policy allows
```

The answer is not automatically added to Career Evidence or future applications.

### 9.3 Reusable-answer flow

If the user explicitly chooses reuse and policy permits:

```text
User answer
→ confirm reuse intent
→ store as reusable confirmed answer
→ offer in future equivalent questions
→ apply current policy and review rules again
```

### 9.4 Sensitive-answer flow

For demographic, disability, veteran, work-authorization, sponsorship,
compensation, legal, signature, or similar fields:

- never infer from indirect data;
- require an approved explicit source;
- require review or confirmation according to policy; and
- otherwise leave unanswered and ask the user.

## 10. Application Memory flow — Remember

The durable domain/API and cross-surface experience are implemented through
M15. The extension records only after explicit user confirmation; it does not
automatically submit or silently infer that submission succeeded.

### 10.1 Before submission

When application work begins, an approved client may idempotently create an
Application in Preparing state with reviewed context.

### 10.2 After submission

Where reliable, the extension may recognize a confirmation state and ask the
user to record the application. A manual “Mark as Applied” path must exist.

```text
User submits
→ Record/confirm application
→ preserve job/external context
→ preserve exact Resume Version
→ preserve approved answer history
→ set Applied and applied_at
```

Before user-triggered fill on an unmatched external application, CareerOS
attempts an idempotent Preparing record using the reviewed popup context. If the
site navigates to a normal confirmation page after submission, reopening the
extension can offer the single recent Preparing record for explicit review and
completion. Ambiguous recent records are not guessed, and failure to prepare
never blocks the external manual workflow.

### 10.3 Applications list

The Web Applications surface should show at least:

- company;
- role;
- status;
- applied date; and
- resume used.

### 10.4 Application detail

The user can inspect durable context, including source/URL, exact Resume Version,
relevant answers where retained, and status.

### 10.5 Status updates

Supported statuses:

```text
Preparing → Applied → Assessment → Interview → Final → Offer
                                      ↘ Rejected
Any appropriate state → Withdrawn
```

The diagram is illustrative, not a requirement to enforce one rigid linear
sequence.

## 11. Optional optimization flow — Enhance

Existing Job Intelligence remains available when the user wants deeper analysis.

```text
Job
→ user chooses Analyze/Optimize
→ select Resume Version
→ structured requirements
→ evidence evaluation
→ Strong / Hidden / Weak / Genuine Gaps
→ explainable recommendation
```

The user may return to Apply at any time. Analysis is not a prerequisite.

Future deferred steps may include Application Strategy and resume tailoring, but
the current product must not present those as available.

## 12. Recovery flows

- Resume parsing failure → retry or upload another file.
- Job data unavailable/stale → explain and preserve external link when safe.
- Extension not installed → continue to external application manually.
- Application page not detected → allow manual workflow and possible manual
  record later.
- Field unresolved → ask or leave unanswered.
- ATS adapter fails → try safe generic behavior or stop without corrupting form.
- Resume upload unsupported → user uploads manually.
- Submission detection fails → Mark as Applied manually.
- Application recording fails → preserve local/user context where safely
  possible and allow retry without duplicate records.

## 13. Trust and language

The UX should make clear what is:

- confirmed user information;
- AI or system interpretation;
- a suggestion;
- unknown;
- sensitive; and
- unsupported.

Explain evidence and actions rather than presenting opaque AI confidence or
hiring probabilities.

## 14. V1 end-to-end acceptance

### Scenario A

```text
Resume → Career Brain → CareerOS Jobs → Job → Apply
→ external application → extension → autofill
→ review → user submit → Application Memory
```

### Scenario B

```text
Resume → Career Brain → independently found job
→ external application → extension → autofill
→ review → user submit → Application Memory
```

Both must work without developer database edits or mandatory Job Intelligence.
