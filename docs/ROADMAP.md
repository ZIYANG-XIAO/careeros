# CareerOS — Product and Engineering Roadmap

> Version: 0.1
> Status: Draft
> Last Updated: 2026-09-13
> Product: CareerOS

---

# 1. Purpose

This document defines how CareerOS should be built over time.

Its purpose is to:

- sequence development,
- control scope,
- prevent premature infrastructure,
- separate Core V1 from future product ideas,
- define milestone outcomes,
- and give coding agents clear implementation boundaries.

The roadmap should be read together with:

- `PRODUCT.md`
- `PRD.md`
- `USER_FLOW.md`
- `DATA_MODEL.md`
- `AI_SPEC.md`
- `ARCHITECTURE.md`

This document is the canonical engineering milestone sequence for CareerOS.

The detailed sequence in this roadmap supersedes any older condensed milestone outline in `PRD.md`. The PRD remains authoritative for approved product requirements and scope; this roadmap is authoritative for implementation sequencing.

---

# 2. Roadmap Principle

CareerOS should be built through small validated vertical slices.

Do not attempt to build the entire system in one implementation pass.

Preferred rhythm:

Define Milestone
→ Implement
→ Test
→ Validate
→ Review
→ Commit
→ Continue

Each milestone should produce a usable and reviewable result.

---

# 3. Product North Star

CareerOS should ultimately support:

Discover
→ Understand
→ Decide
→ Tailor
→ Apply
→ Track
→ Learn

Core V1 does not need to fully automate every step.

The immediate goal is:

> One complete, intelligent, trustworthy application workflow.

---

# 4. Core V1 Definition

CareerOS Core V1 includes:

- Career Brain,
- resume ingestion,
- resume management,
- job capture,
- Job Intelligence,
- evidence matching,
- hidden evidence detection,
- genuine gap detection,
- application recommendation,
- Application Intelligence,
- resume tailoring,
- browser extension,
- initial autofill,
- basic Application Memory.

Core V1 does not mean universal automation.

It means the primary user journey works end-to-end.

---

# 5. Core V1 Golden Path

The V1 Golden Path is:

Create Account
→ Upload Resume
→ Build Career Brain
→ Confirm Career Brain
→ Capture Real Job
→ Analyze Job
→ Review Evidence / Gaps
→ Decide to Apply
→ Prepare Application
→ Tailor Resume
→ Open Application Form
→ Autofill Supported Fields
→ User Reviews
→ User Submits
→ Record Application

The implementation roadmap exists to make this workflow reliable.

---

# 6. Milestone Philosophy

Each milestone should:

- have a narrow objective,
- have explicit deliverables,
- include acceptance criteria,
- avoid unrelated future work,
- preserve prior functionality,
- and be independently reviewable.

A milestone should not be considered complete because code exists.

It is complete when the required user or system behavior works.

## Cross-Cutting Security Ownership

Security belongs to the milestone where each risk first appears. It must not be deferred entirely to M18.

At minimum:

- M1 owns foundational authorization and user ownership,
- M2 owns resume upload validation and privacy,
- M4 owns untrusted job content and prompt-injection boundaries,
- M9 owns grounded generation validation,
- M11 and later extension milestones own extension authentication and page trust,
- M13 and M14 own sensitive application field handling.

Resumes, job descriptions, web pages, and application forms must be treated as untrusted content from the milestones where they are introduced. Prompt-injection protection and testing begin with those milestones rather than waiting for M18.

---

# 7. M0 — Project Foundation

## Goal

Create a clean development foundation without prematurely implementing product features.

## Deliverables

- monorepo structure,
- web application scaffold,
- FastAPI scaffold,
- PostgreSQL development environment,
- basic configuration management,
- basic health endpoint,
- web → API connectivity,
- initial development README instructions,
- test framework setup,
- lint / formatting basics,
- `.env.example`.

Browser extension may remain unscaffolded until its milestone unless creating an empty app materially simplifies the monorepo.

## Acceptance Criteria

- developer can start Web and API locally,
- API can connect to PostgreSQL,
- Web can call API health endpoint,
- tests can run,
- secrets are not committed,
- repository remains understandable.

## Non-Goals

- AI features,
- resume parsing,
- extension functionality,
- production deployment automation,
- Redis,
- Kafka,
- Kubernetes.

---

# 8. M1 — Career Brain Foundation

## Goal

Implement the persistent Career Brain domain.

## Deliverables

Initial support for:

- User ownership context,
- Career Brain,
- personal information,
- Education,
- Experience,
- Experience Detail,
- Project,
- Project Detail,
- Skill,
- basic Application Information,
- Career Preferences where required by V1.

Web UI should allow basic viewing and editing.

Career Brain is the backend and domain concept. Career Profile is the user-facing UI surface for managing Career Brain data.

## Acceptance Criteria

User can:

- view Career Profile,
- add an Experience,
- edit an Experience,
- add meaningful details,
- add a Project,
- add Skills,
- save changes,
- reload and see persisted state.

User-level authorization must be enforced.

Ownership checks must be enforced server-side for every Career Brain resource introduced in this milestone.

## Non-Goals

- resume upload parsing,
- AI extraction,
- job matching.

---

# 9. M2 — Resume Ingestion and Career Brain Draft

## Goal

Allow users to bootstrap their Career Brain from an existing resume.

## Deliverables

- resume upload,
- safe file validation,
- object storage abstraction,
- text extraction,
- structured resume parsing,
- structured output validation,
- Career Brain draft generation,
- provenance / confirmation state,
- onboarding review UI.

Resume files and extracted content are untrusted input. This milestone owns upload validation, appropriate privacy controls, structured task boundaries, and initial prompt-injection tests for resume processing.

## Acceptance Criteria

Using representative resumes:

- resume uploads successfully,
- major sections are extracted,
- user sees structured Career Brain draft,
- user can correct extracted data,
- extracted data is not treated as confirmed until appropriate,
- original resume remains preserved.

## Quality Requirement

Parsing accuracy must be manually evaluated against real resumes.

## Non-Goals

- job intelligence,
- resume tailoring,
- universal document formats.

---

# 10. M3 — Resume Library and Version Foundation

## Goal

Separate Career Brain truth from resume presentation.

## Deliverables

- Resume domain,
- Resume Version domain,
- original uploaded resume representation,
- structured resume representation,
- resume list UI,
- resume detail UI,
- source/base version relationships.

Historically used Resume Versions must be immutable or historically preserved. Editing should create a new version rather than changing an artifact referenced by an existing Application.

## Acceptance Criteria

User can:

- view uploaded resume,
- preserve original version,
- maintain more than one resume asset,
- identify current versions,
- understand that Career Brain and Resume are different concepts.

## Non-Goals

- AI tailoring,
- advanced document editor,
- multiple visual templates.

---

# 11. M4 — Job Capture and Job Parsing

## Goal

Allow users to create a structured Job from a real job description.

Initial implementation may begin with manual entry before extension capture.

## Deliverables

- Job domain,
- manual job entry,
- raw JD storage,
- Job Parser,
- structured requirements,
- required vs preferred classification,
- Job detail page.

Job descriptions are untrusted content. Job parsing must keep job text separate from trusted task instructions, validate structured output, and include prompt-injection tests from this milestone onward.

## Acceptance Criteria

For representative technical jobs, CareerOS can extract:

- title,
- company,
- location where available,
- responsibilities,
- required qualifications,
- preferred qualifications,
- key skills / technologies.

Missing information remains unknown instead of fabricated.

## Non-Goals

- evidence matching,
- extension job detection,
- application strategy.

---

# 12. M5 — Evidence Retrieval and Matching

## Goal

Connect Job Requirements to Career Brain evidence.

This is the first major CareerOS intelligence milestone.

## Deliverables

- evidence reference system,
- stable Career Evidence identity and traceability sufficient for evidence references, grounding, user ownership validation, corrections, and historical analysis,
- requirement-to-evidence retrieval,
- evidence evaluation,
- classification into:
  - Strong Evidence
  - Weak Evidence
  - Genuine Gap
- structured explanations,
- evidence traceability.

Hidden Evidence may begin here if Resume Representation support is mature enough, otherwise complete it in M6.

The implementation should conceptually separate two dimensions:

### Evidence Support Strength

- strong,
- weak,
- none / insufficient.

### Resume Representation

- represented,
- underrepresented,
- absent.

The product-facing labels remain:

- Strong Evidence,
- Hidden / Underrepresented Evidence,
- Weak Evidence,
- Genuine Gap.

This separation should use simple stable identities and relational traceability. It does not require a graph database or event-sourcing system.

## Acceptance Criteria

Representative test cases correctly preserve core invariants:

- verified Kafka evidence can support Kafka requirement,
- Docker alone does not become Kubernetes,
- missing GCP remains a Genuine Gap,
- evidence references point to valid user-owned data.

## Non-Goals

- arbitrary match probability,
- resume rewriting,
- personalized outcome learning.

---

# 13. M6 — Hidden Evidence and Resume Representation

## Goal

Detect relevant Career Brain evidence that the selected resume fails to represent.

## Deliverables

- resume-to-evidence mapping sufficient for V1,
- represented / partially represented / absent reasoning,
- Hidden / Underrepresented Evidence classification,
- evidence drill-down UX.

For implementation, resume representation should resolve to represented, underrepresented, or absent. Hidden Evidence is derived when useful or strong Career Brain evidence exists but is underrepresented or absent from the selected Resume Version.

## Acceptance Criteria

CareerOS can correctly identify:

Career Brain has Kubernetes evidence
+
Job values Kubernetes
+
Selected resume omits Kubernetes

→ Hidden Evidence

It must distinguish this from:

No Kubernetes evidence

→ Genuine Gap.

## Product Importance

This is a signature CareerOS capability and should receive dedicated testing.

---

# 14. M7 — Job Intelligence Experience

## Goal

Turn matching results into a useful user-facing Job Intelligence workflow.

## Deliverables

Job page containing:

- overview,
- requirements,
- Strong Evidence,
- Hidden Evidence,
- Weak Evidence,
- Genuine Gaps,
- explanations,
- application recommendation.

Supported recommendation categories:

- Strong Apply
- Apply
- Stretch
- Low Priority

## Acceptance Criteria

A user can answer:

- What does this job require?
- What do I match?
- Why?
- What am I failing to show?
- What are my real gaps?
- Is this worth applying to?

## Non-Goals

- interview probability,
- offer probability,
- fake precision.

---

# Validation Gate A — Intelligence Thesis

After M7, CareerOS must validate the intelligence thesis before investing heavily in extension and autofill engineering.

Use real resumes and real job descriptions to determine whether:

- Strong Evidence is genuinely useful,
- Hidden / Underrepresented Evidence surfaces meaningful overlooked experience,
- Weak Evidence avoids overstating indirect support,
- Genuine Gap reliably preserves unsupported requirements,
- and CareerOS produces meaningfully better understanding than generic resume-plus-job-description workflows.

If the intelligence thesis is weak, stop and refine the Career Brain, job understanding, evidence retrieval, classification, and explanations before proceeding aggressively into extension and autofill work.

This is a validation gate, not a reason to remove the Browser Extension, Application Assistant, autofill, or ATS adapters from Core V1.

---

# 15. M8 — Application Intelligence

## Goal

Answer:

> How should I apply to this job?

## Deliverables

- Application Strategy domain,
- recommended positioning,
- base resume recommendation,
- prioritize evidence,
- de-emphasize evidence,
- hidden evidence to surface,
- genuine gaps,
- resume recommendation plan.

When the user starts Prepare Application, CareerOS may create a minimal Application in `Preparing` state. This establishes application identity and context without waiting for the later Application History milestone.

## Acceptance Criteria

CareerOS can generate a strategy that:

- remains evidence-grounded,
- explains important decisions,
- identifies an appropriate base resume,
- avoids unsupported positioning,
- preserves genuine gaps.

---

# 16. M9 — Evidence-Grounded Resume Tailoring

## Goal

Allow users to create a truthful job-specific resume.

## Deliverables

- Resume Recommendation domain,
- Keep / Strengthen / Rewrite / Add / Remove / De-emphasize actions,
- evidence references,
- user review actions,
- grounded rewrite generation,
- generation validation,
- job-specific Resume Version,
- at least one practically usable job-specific resume artifact produced from the accepted structured content.

## Acceptance Criteria

User can:

- inspect proposed changes,
- understand why they are recommended,
- see evidence where relevant,
- accept,
- reject,
- edit,
- save a job-specific resume.

The milestone is not complete if CareerOS only produces text suggestions. The user must be able to produce at least one practically usable job-specific resume artifact. The exact rendering implementation is decided within the approved architecture during this milestone.

The original resume must remain unchanged.

Editing an existing historically used Resume Version must create a new version rather than mutating the artifact referenced by an Application.

## Critical Invariants

- no invented skills,
- no invented metrics,
- no invented ownership,
- no invented production claims,
- no unsupported context mixing.

Grounding validation and its regression tests belong to this milestone and must verify evidence ownership, context compatibility, metrics, technologies, ownership, seniority, and production claims where applicable.

---

# 17. M10 — Core Web Golden Path

## Goal

Integrate existing capabilities into one coherent Web experience.

## Deliverables

Connected flows for:

- onboarding,
- Career Profile,
- Resumes,
- Jobs,
- Job Intelligence,
- Prepare Application,
- resume tailoring,
- initial Applications area.

## Acceptance Criteria

A test user can complete:

Resume Upload
→ Career Brain
→ Job Entry
→ Analysis
→ Application Strategy
→ Tailored Resume

without developer intervention.

This milestone should resolve major UX fragmentation before browser automation is added.

---

# Validation Gate B — Core Web Workflow

After M10, CareerOS must validate the end-to-end web workflow with real users before proceeding aggressively into extension and autofill engineering.

Validation should determine whether:

- the connected Career Brain-to-job-to-application workflow is understandable,
- Application Strategy is useful and evidence-grounded,
- resume recommendations improve the application without changing professional truth,
- users can review and control changes,
- and the generated job-specific resume artifact is practically usable.

If the web workflow or tailoring quality is weak, refine it before expanding browser automation effort.

This gate does not remove the Browser Extension, Initial ATS Job Detection, Application Assistant, autofill, or ATS adapters from Core V1. It sequences them after validation of the core intelligence loop. ATS coverage should remain incremental, and reliability matters more than breadth.

---

# 18. M11 — Browser Extension Foundation

## Goal

Connect CareerOS to the user's real browsing workflow.

## Deliverables

- Manifest V3 extension,
- authentication with CareerOS,
- extension-to-backend API communication,
- job page detection framework,
- adapter registry,
- Generic job detection,
- compact CareerOS job UI,
- Open in CareerOS action.

This milestone owns secure extension authentication, minimal permissions, safe API communication, and the trust boundary between untrusted page content, extension components, and the backend.

Web pages must be treated as untrusted content. Page text must not override trusted task instructions, and prompt-injection tests for extension-captured content begin here.

## Acceptance Criteria

On a supported job page:

- extension recognizes relevant page context,
- user identity is available securely,
- job can be captured,
- user can launch or view CareerOS analysis.

## Non-Goals

- full autofill,
- universal job page detection,
- final submission.

---

# 19. M12 — Initial ATS Job Detection

## Goal

Improve reliable job capture on selected real ATS platforms.

Initial target order:

1. Generic HTML
2. Greenhouse
3. Lever
4. Ashby

## Deliverables

Platform adapters as required.

## Acceptance Criteria

Representative live or fixture pages can produce usable:

- company,
- title,
- location where available,
- JD,
- job URL,
- application URL where available.

Adapter-specific logic remains isolated.

## Non-Goals

Workday support is not a Core V1 exit criterion and must not block this milestone or Core V1. It may be explored later as beta support after the adapter architecture is proven.

---

# 20. M13 — Application Assistant Foundation

## Goal

Detect application forms and classify common fields.

## Deliverables

- application form detection,
- field extraction,
- canonical field keys,
- deterministic field mapping,
- answer resolver,
- confidence state,
- unresolved field behavior.

Application forms are untrusted content. Field text must not override trusted task instructions, and prompt-injection testing must cover form classification from this milestone onward.

This milestone owns the safe handling of sensitive and consequential fields: unsupported values remain unresolved, and protected attributes are never inferred.

## Acceptance Criteria

CareerOS can identify common fields such as:

- name,
- email,
- phone,
- education fields,
- basic experience fields,
- common explicitly stored application information.

Unknown fields remain unresolved rather than guessed.

---

# 21. M14 — Initial Autofill

## Goal

Reduce repetitive application work.

## Deliverables

Autofill support for selected safe fields:

- personal information,
- education,
- experience,
- links,
- supported application information,
- resume selection / upload where practical.

## Acceptance Criteria

On supported forms:

- deterministic known fields fill correctly,
- uncertain fields are flagged,
- unsupported fields remain untouched,
- sensitive fields are not inferred,
- user can review all results.

Sensitive and consequential application answers must come from explicit user-provided information. Unknown values remain unfilled or require user input.

## Critical Boundary

CareerOS does not click final Submit.

---

# 22. M15 — ATS Form Adapters

## Goal

Improve autofill quality on selected ATS platforms.

Initial platform priority:

- Greenhouse,
- Lever,
- Ashby.

Workday may be explored as a later Core V1 beta milestone after the adapter architecture is validated.

## Acceptance Criteria

Each adapter should have:

- fixture or reproducible test coverage,
- isolated DOM logic,
- field detection behavior,
- graceful failure behavior.

Avoid hacks that break the adapter boundary.

---

# 23. M16 — Application Memory

## Goal

Preserve application context and outcomes.

Application Memory remains lightweight in V1. It is not an advanced analytics or personalization system.

## Deliverables

- Application domain,
- Preparing / Applied state,
- Resume Version association,
- Job association,
- Application Strategy association,
- prepared and applied timestamps where relevant,
- status updates,
- basic Applications list,
- application detail.

## Supported Statuses

- Preparing
- Applied
- Assessment / OA
- Interview
- Final Round
- Rejected
- Offer
- Withdrawn

## Acceptance Criteria

User can:

- record an application,
- see the job, company, and role,
- see exact resume used,
- see the relevant strategy reference where applicable,
- update status,
- return later and understand application context.

The fuller Application History experience is owned here, but a minimal Application may already exist in `Preparing` state from the moment the user starts Prepare Application.

---

# 24. M17 — End-to-End Core V1 Integration

## Goal

Validate the complete CareerOS Core V1 experience.

## Required Golden Path

1. Create account.
2. Upload resume.
3. Parse Career Brain.
4. Review / correct.
5. Confirm profile.
6. Add relevant evidence missing from resume.
7. Visit supported real job.
8. Extension detects job.
9. Analyze job.
10. Review Strong / Hidden / Weak / Gaps.
11. Review application recommendation.
12. Prepare Application.
13. Review strategy.
14. Tailor resume.
15. Save job-specific resume.
16. Open supported application form.
17. Autofill.
18. Resolve unknown fields.
19. Review application.
20. User manually submits.
21. Record Application.
22. View Application History.

## Acceptance Criteria

The flow completes without requiring developer database edits or manual internal intervention.

---

# 25. M18 — Core V1 Hardening

## Goal

Prepare CareerOS for early external users.

M18 is the final hardening and regression milestone. It validates and strengthens security controls introduced earlier; it is not the first milestone responsible for authorization, upload safety, grounding, prompt injection, extension trust, or sensitive application fields.

## Focus

- reliability,
- error recovery,
- authorization,
- upload safety,
- AI hallucination regression testing,
- prompt injection handling,
- extension robustness,
- logging,
- latency,
- cost,
- usability.

## Acceptance Criteria

Critical Golden Path failure cases have recovery behavior.

Known hallucination regression tests pass.

User data isolation is tested.

Security and prompt-injection regression coverage introduced in earlier milestones passes across the complete Golden Path.

---

# 26. Core V1 Exit Criteria

CareerOS Core V1 is ready when a representative user can:

1. establish Career Brain from a real resume,
2. enrich it with additional evidence,
3. encounter a real job,
4. receive useful structured Job Intelligence,
5. understand Strong / Hidden / Weak / Genuine Gap evidence,
6. receive an explainable apply recommendation,
7. generate an evidence-grounded application strategy,
8. create a truthful job-specific resume,
9. use CareerOS to reduce repetitive form work,
10. manually review and submit,
11. preserve the application context.

Feature count alone does not determine V1 completion.

Workday support is not a Core V1 exit criterion.

---

# 27. Post-V1 Direction — Localization

Localization means adapting CareerOS to different job markets, not merely translating text.

Potential future capabilities:

- market-specific resume norms,
- market-specific application behavior,
- country-specific career terminology,
- language-specific professional writing,
- regional job-search conventions.

Possible initial markets may include:

- United States,
- China,
- Singapore.

Exact market priority requires separate validation.

This is not Core V1 scope.

---

# 28. Post-V1 Direction — Personalization

CareerOS may eventually learn from user behavior and application outcomes.

Potential inputs:

- jobs viewed,
- jobs saved,
- applications,
- resume variants,
- evidence emphasized,
- assessments,
- interviews,
- rejections,
- offers.

Possible future output:

- better job prioritization,
- better resume selection,
- better positioning,
- personalized application strategy.

This requires sufficient trustworthy user history.

Do not simulate personalization before data exists.

---

# 29. Post-V1 Direction — Career Intelligence

Long-term CareerOS may help users answer broader questions such as:

- Which roles fit me best?
- What experience am I underusing?
- Which skills create the biggest opportunity gap?
- How should I position my career?
- What should I learn next?

This extends beyond individual application optimization.

It is a future layer built on Career Brain + Job History + Application History.

---

# 30. Potential Future Capabilities

Possible future product areas include:

- improved job discovery,
- broader ATS coverage,
- application answer memory,
- cover letter assistance,
- interview preparation,
- networking support,
- career planning,
- outcome analytics,
- recruiter interaction assistance.

These are ideas, not approved implementation requirements.

---

# 31. Explicit Deferred Features

The following should not be implemented during early Core V1 milestones unless the roadmap is explicitly changed:

- Auto Submit
- Mass Apply
- Universal ATS support
- Job scraping platform
- Recruiter CRM
- Employer products
- Full interview platform
- General career chatbot
- Salary negotiation system
- Email sync
- Calendar sync
- Recruiter inbox sync
- advanced outcome prediction
- exact interview probability
- exact offer probability
- international localization engine
- personalized predictive models
- Kubernetes
- Kafka
- Neo4j
- standalone vector database
- complex distributed infrastructure.

---

# 32. Workday Strategy

Workday is strategically important but technically complex.

Core architecture should allow a future:

WorkdayAdapter

However, Workday should not block validation of:

- Career Brain,
- Job Intelligence,
- Application Intelligence,
- resume tailoring,
- generic autofill,
- initial ATS adapters.

Workday should be added after the adapter architecture is proven.

Workday support is not a Core V1 exit criterion. It may be explored later as a beta or later milestone, and Core V1 must not be blocked by Workday.

---

# 33. Development Prioritization Rule

When choosing between:

A. adding another feature

and:

B. making the current Golden Path significantly more reliable,

prefer B during Core V1.

---

# 34. AI Quality Prioritization

When choosing between:

A. supporting more AI use cases

and:

B. improving evidence grounding and hallucination resistance,

prefer B.

CareerOS differentiation depends on trustworthy intelligence.

---

# 35. Extension Prioritization

When choosing between:

A. supporting many websites poorly

and:

B. supporting a smaller number reliably,

prefer B during V1.

---

# 36. Data Prioritization

When choosing between:

A. storing more speculative future data

and:

B. preserving the core relationships required for evidence and application history,

prefer B.

---

# 37. Infrastructure Prioritization

When choosing between:

A. sophisticated infrastructure

and:

B. simpler architecture that satisfies current requirements,

prefer B.

Infrastructure is not CareerOS's product differentiation.

The approved Core V1 direction remains a modular monolith using simple infrastructure, PostgreSQL, a thin AI provider abstraction, and database-backed background jobs initially.

Do not introduce Kubernetes, Kafka, Neo4j, or an external vector database without a measured need and explicit approval.

---

# 38. Milestone Review Process

Before each milestone begins:

1. Read relevant specifications.
2. Restate the milestone objective.
3. Identify affected domain entities.
4. Identify affected APIs.
5. Identify UX changes.
6. Identify tests.
7. Identify ambiguities.
8. Propose implementation plan.
9. Wait for approval when required.

After implementation:

1. summarize changes,
2. show important files,
3. run tests,
4. validate acceptance criteria,
5. identify known limitations,
6. stop before expanding scope.

---

# 39. Commit Discipline

Prefer small milestone-oriented commits.

Examples:

```text
feat: scaffold CareerOS core
feat: add career brain domain
feat: add resume ingestion flow
feat: add structured job parsing
feat: add evidence matching
feat: add hidden evidence detection
feat: add application strategy
feat: add grounded resume tailoring
feat: add extension job detection
feat: add application autofill
feat: add application memory
```

Each milestone should normally end with:

1. implementation complete,
2. automated tests passing,
3. acceptance criteria validated,
4. relevant documentation updated if needed,
5. git diff reviewed,
6. milestone commit created.

---

# 40. Roadmap Conclusion

The long-term progression is:

CareerOS Core
→ Reliable Career Intelligence
→ Reliable Application Execution
→ Application Memory
→ Localization
→ Personalization
→ Broader Career Intelligence

The final roadmap principle is:

> Build the smallest complete workflow that proves the CareerOS thesis.
> Deepen intelligence and reliability before expanding scope.
