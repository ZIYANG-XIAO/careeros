# CareerOS — Agent Instructions

## 1. Purpose and source of truth

CareerOS is an AI-native job-search operating system. The repository and its
`docs/` directory are the source of truth for implemented behavior, product
requirements, architecture, and sequencing.

Before meaningful work, read the relevant documents:

- `docs/PRODUCT.md` — product constitution and V1 spine
- `docs/PRD.md` — approved V1 requirements and non-goals
- `docs/USER_FLOW.md` — user journeys
- `docs/DATA_MODEL.md` — implemented and planned domain concepts
- `docs/AI_SPEC.md` — AI, grounding, and Answer Engine policy
- `docs/ARCHITECTURE.md` — system boundaries and technical direction
- `docs/ROADMAP.md` — authoritative implementation sequence

When documents conflict, surface the conflict. Do not silently invent a
requirement. The roadmap controls implementation order; a future capability in
another document is not authorization to implement it.

## 2. Current baseline

M0–M12 are implemented. The repository currently contains:

- the Web, API, and PostgreSQL foundation;
- authenticated user ownership and Career Brain/Profile editing;
- stable Career Evidence and immutable evidence revisions;
- resume upload, parsing, review, confirmation, and resume versioning;
- manual job capture, provider-neutral source ingestion, structured parsing,
  retry-safe deduplication, and source/freshness attribution;
- evidence matching, hidden-evidence detection, genuine-gap preservation;
- the Jobs-first product shell and optional Job Intelligence experience;
- a Manifest V3 extension foundation with secure Clerk session sync,
  background-only API credentials, active-tab application-page detection, and
  explicit supported/unsupported UI; and
- read-only provider-neutral form normalization with generic, Greenhouse,
  Lever, and Ashby adapter boundaries and explicit support/confidence states;
  and
- a reusable backend Answer Engine foundation with deterministic safety policy,
  owned canonical-source retrieval, optional bounded semantic classification,
  explicit decision/review states, and aggregate extension preview.

Not currently implemented:

- a production job-discovery feed or real external source adapter;
- autofill and form execution;
- the durable Application domain and Applications UI;
- Application Strategy or resume tailoring.

Do not describe planned behavior as if it exists. Do not blindly continue the
old assumption that Application Intelligence and resume tailoring are the next
milestones.

## 3. Approved V1 product direction

The V1 product spine is:

```text
KNOW ME → DISCOVER → APPLY ANYWHERE → REMEMBER
```

`ENHANCE` is an optional intelligence layer, not a required step before an
application.

CareerOS should learn the user's professional identity once, help them discover
opportunities, help them apply wherever they find a job, remember what happened,
and offer deeper optimization when the user chooses it.

The immediate priority is V1 product formation:

1. Product shell and Jobs experience.
2. Extension and Application Assistant.
3. Application Memory and cross-surface integration.
4. V1 hardening and both required end-to-end scenarios.

Existing Job Intelligence remains supported as optional enhancement
functionality. Application Strategy and resume tailoring are deferred until
after product formation unless the roadmap is explicitly changed.

## 4. Core domains and product services

Relatively stable core domains are:

- Identity
- Career Brain
- Career Evidence
- Resume
- Job
- Application (planned)

Product services and workflows consume those domains:

- Job Discovery (planned)
- Autofill (planned)
- Answer Engine (implemented foundation)
- Job Intelligence (implemented foundation)
- Resume Tailoring (deferred)
- Application Q&A, Interview Preparation, Recommendation, Analytics, Career
  Planning, and future agents (future)

Services must share canonical domain data instead of creating duplicate user,
resume, job, or application truth.

## 5. Career Brain is not a resume

Career Brain is the canonical structured professional truth layer. Career
Profile is the user-facing surface for managing it. A resume is an immutable or
historically preserved presentation artifact derived from a subset of that
truth. One Career Brain may support many resumes.

Resume-first onboarding remains preferred:

```text
Sign up → Upload resume → Parse → Review/correct → Confirm → Career Brain
```

Do not replace this with a large blank-profile requirement.

## 6. Evidence and history invariants

CareerOS must never fabricate professional information. Preserve these rules:

- Evidence precedes generated professional claims.
- Unsupported skills, employers, projects, achievements, metrics, seniority,
  ownership, or production context remain unsupported.
- AI-extracted resume information is not authoritative until confirmed.
- `CareerEvidence` has stable identity.
- `CareerEvidenceRevision` is immutable.
- Historical `ResumeVersion` records remain stable.
- Historical Job Intelligence results remain attributable to the exact job
  snapshot, resume version, and evidence revisions used.
- User corrections override lower-priority AI interpretation.

Distinguish strong evidence, hidden or underrepresented evidence, weak evidence,
and genuine gaps. Never convert a genuine gap into a fabricated claim.

## 7. Apply Anywhere and user control

The extension must eventually support two equal paths:

```text
CareerOS Job → external application page → extension → autofill
```

and:

```text
Job found anywhere → external application page → extension → autofill
```

Discovery or saving inside CareerOS must not be a prerequisite for assistance.
The extension is a thin contextual assistant, not a second full application.

Final submission is always an explicit user action in V1. Never implement
automatic final submission unless an approved future requirement changes this.

## 8. Answers and sensitive information

Do not collapse all answers into Career Evidence. Preserve the conceptual
boundaries among:

- professional truth;
- application preferences;
- reusable confirmed answers;
- application-specific answers; and
- sensitive answers.

Unknown remains unknown. Legal, demographic, disability, veteran, work
authorization, sponsorship, compensation, signature, and other consequential
answers must not be inferred. Protected traits must never be inferred from
names, resumes, locations, education, photos, or other indirect signals.

## 9. External and untrusted inputs

Resumes, job descriptions, external job records, web pages, application forms,
and provider responses are untrusted input. Their content must not override
trusted CareerOS instructions. Validate schemas, ownership, identifiers, and
grounding before accepting derived data.

Use adapters at external boundaries:

- Job sources normalize into a provider-independent canonical Job.
- ATS/site behavior normalizes into a provider-independent form model.

Do not bind core models to one provider or place every ATS rule in one
conditional block. Do not build production job acquisition or a generic plugin
framework before its approved milestone.

## 10. Architecture discipline

Prefer simple infrastructure, clear domain boundaries, and narrow extensible
interfaces. Preserve the modular monolith.

Do not introduce without measured need and explicit approval:

- microservices;
- Kafka or generic event infrastructure;
- Kubernetes;
- Neo4j;
- a standalone vector database; or
- speculative plugin systems.

Use stable IDs, explicit ownership, immutable history where appropriate,
provider isolation, and adapters at genuine external boundaries.

## 11. Engineering workflow

Work milestone by milestone:

1. Read the relevant specifications.
2. Verify implemented state rather than relying on memory.
3. Identify ambiguity before coding.
4. Implement only the approved scope.
5. Add or update tests.
6. Verify acceptance criteria and invariants.
7. Summarize changes and remaining issues.
8. Stop before expanding into the next milestone.

Prefer a small reliable workflow over many shallow features. The roadmap is not
permission to implement all future capabilities at once.

When uncertain: do not guess, silently expand scope, or fabricate requirements.
Explain the ambiguity and ask for a decision.
