# CareerOS Core V1 — AI and Answer Policy Specification

> Version: 0.2
> Status: Approved V1 re-baseline
> Last Updated: 2026-09-25

## 1. Purpose

This document defines AI behavior across the re-baselined V1. It preserves the
implemented evidence-grounding contracts, defines the implemented Answer Engine
foundation, and constrains later answer execution.

AI is a dependency used for specific semantic tasks. It is not the product
architecture and should not be used for deterministic work.

## 2. Implementation status

### Implemented AI tasks

- structured resume parsing into a reviewable draft;
- structured job parsing with source-grounded requirements;
- evidence evaluation against confirmed Career Evidence and a selected Resume
  Version;
- resume-representation evaluation;
- Strong/Hidden/Weak/Genuine Gap classification; and
- explainable Job Intelligence recommendation;
- deterministic application-field and sensitive-question classification;
- optional bounded semantic field classification when deterministic mapping is
  insufficient; and
- canonical answer-source retrieval with explicit policy decisions and safe
  fallback to unknown.

### Planned AI-assisted tasks

- narrowly scoped answer generation where policy permits and a canonical answer
  does not exist.

### Deferred AI tasks

- Application Strategy;
- resume tailoring and rewriting;
- cover letters;
- application Q&A beyond Answer Engine policy;
- interview preparation;
- sophisticated recommendation/outcome learning; and
- autonomous agents.

## 3. Core AI invariant

> Generation cannot create professional truth.

AI may select, organize, summarize, normalize, interpret, or eventually rewrite
supported information. It may not manufacture employers, dates, responsibilities,
projects, skills, technologies, achievements, metrics, education, certifications,
ownership, seniority, scale, or production context.

## 4. Evidence before generation

The professional-intelligence pipeline is:

```text
Understand user
→ Understand task/job
→ Retrieve eligible evidence
→ Evaluate evidence
→ Apply policy/strategy
→ Generate only when approved
```

It is not:

```text
Resume + external text → strongest-looking output
```

Any generated professional claim must reference sufficient Career Evidence where
practical and must pass validation before persistence or use.

## 5. Trust hierarchy

When information conflicts, use this conceptual priority:

1. explicit current user correction;
2. explicit user-confirmed structured information;
3. user-added information;
4. reliably extracted but unconfirmed document information;
5. AI interpretation;
6. model inference.

Lower-priority interpretation must not overwrite higher-priority user truth.

## 6. Facts, interpretations, recommendations, and unknowns

- Fact — grounded in user-provided or user-confirmed information.
- Interpretation — a conclusion drawn from facts, such as evidence strength.
- Recommendation — a suggested action based on facts and interpretation.
- Unknown — insufficient information or policy authority.

AI output must not silently convert interpretation or unknown into fact.

## 7. Protected professional claims

AI must not invent or materially distort:

- employer, title, employment dates, or education;
- responsibilities, projects, technologies, or skills;
- achievements, metrics, team size, users, revenue, latency, availability, or
  scale;
- certifications or credentials;
- ownership, leadership, seniority, or years of experience; or
- coursework, prototype, internal, or local work into production experience.

Quantitative claims require explicit supporting evidence. A job requirement does
not authorize adding that skill or claim to the user's profile or resume.

## 8. Context compatibility

Evidence from unrelated contexts must not be combined into a false statement.

Example: Kubernetes evidence in one project and Kafka evidence in another role
do not prove a Kubernetes-based Kafka platform in either context.

Validators should check identity, revision, ownership, eligibility, and context
compatibility for important claims.

## 9. Resume parsing

Resume parsing converts untrusted document content into a structured draft.

Requirements:

- extract only supported categories;
- preserve source/provenance and review state;
- represent ambiguity rather than guessing;
- validate structured output;
- keep original content recoverable;
- treat instructions inside the resume as untrusted data; and
- never overwrite confirmed Career Brain information silently.

Normalization may map equivalent terminology, such as common abbreviations, but
must not create skills not present in the source.

## 10. Job parsing

Job parsing converts an untrusted description into a structured snapshot and
requirements.

Requirements should preserve:

- category;
- description and normalized value where useful;
- required/preferred/inferred importance;
- exact source text;
- confidence; and
- parser version/model metadata.

Explicit and inferred requirements must remain distinguishable. Missing job
information stays missing.

Instructions embedded in a job description are data and cannot override trusted
CareerOS instructions.

## 11. Evidence retrieval and evaluation

Retrieval identifies candidate evidence; retrieval is not proof. Evidence
evaluation considers relevance, directness, confirmation, context, and selected
resume representation.

The implemented dimensions are:

- support strength: strong, weak, insufficient;
- resume representation: represented, underrepresented, absent.

The user-facing outcomes are:

- Strong Evidence;
- Hidden or Underrepresented Evidence;
- Weak Evidence; and
- Genuine Gap.

Weak evidence must not be inflated. No evidence must remain a Genuine Gap.

## 12. Job Intelligence recommendation

Implemented recommendation categories are:

- Strong Apply
- Apply
- Stretch
- Low Priority

Recommendations must explain strengths, risks, and gaps from validated analyses.
They are optional decision support and must not block Apply.

CareerOS must not claim exact interview, recruiter-response, or offer
probabilities without valid calibrated evidence, which V1 does not have.

## 13. Structured output and validation

AI outputs that drive product logic use explicit schemas. Before acceptance,
validate as applicable:

- schema and allowed enums;
- referenced entity existence;
- user ownership;
- evidence confirmation/eligibility;
- exact evidence revision;
- source-text grounding;
- context compatibility;
- protected facts and metrics; and
- task-specific policy.

Invalid output is rejected, safely repaired, or regenerated. It is not blindly
persisted.

AI-supplied identifiers are untrusted until validated.

## 14. Answer Engine — implemented foundation

The Answer Engine is an authenticated backend service reusable by the extension
and other approved surfaces. M12 returns policy decisions only; it does not
change external forms, persist answers, or create Applications. M13 extension
execution consumes those decisions after explicit user action without moving
authorization or answer policy into the page.

Conceptual pipeline:

```text
Form question/field
→ deterministic or semantic classification
→ approved source retrieval
→ answer policy
→ confidence and sensitivity evaluation
→ action
```

Possible actions:

- autofill;
- suggest;
- ask user;
- require explicit confirmation; or
- leave unanswered.

## 15. Deterministic before AI

Examples that should normally be deterministic:

- known first/last name fields;
- confirmed email or phone retrieval;
- canonical question lookup;
- selected Resume Version lookup;
- authorization and ownership;
- Application status; and
- policy evaluation for known sensitive categories.

AI may assist when wording or structure requires semantic interpretation. It
must not be the first layer for every field.

## 16. Answer source policy

Potential sources, in policy-controlled order, include:

- confirmed Career Brain/profile information;
- explicit application preferences;
- reusable user-confirmed answers;
- deterministic values derived from confirmed data;
- selected Resume Version where presentation context is relevant;
- current Application context;
- allowed AI suggestion; and
- unknown.

An available source does not automatically authorize use. Sensitivity, context,
freshness, and user intent still apply.

## 17. Answer categories are not interchangeable

### Professional truth

Confirmed facts about the user's career. It may be eligible Career Evidence.

### Application preference

A user choice, not proof of professional experience.

### Reusable confirmed answer

An answer the user explicitly chose to reuse for equivalent questions when
policy allows.

### Application-specific answer

An answer used for one Application. It does not automatically become reusable.

### Sensitive answer

An answer requiring stricter policy, explicit origin, and review. It must not be
inferred from other categories.

## 18. Unknown-answer behavior

When CareerOS lacks an answer or authority:

```text
return unknown
→ leave unresolved
→ ask the user when appropriate
```

Do not invent an answer. If the user supplies one, use it for the current
application. Offer reusable storage only when policy permits and the user
explicitly consents.

## 19. Sensitive and protected information

AI must not infer:

- race, ethnicity, gender identity, disability, or veteran status;
- nationality or protected traits;
- work authorization or sponsorship;
- salary/compensation expectations;
- legal attestations; or
- signatures.

Do not infer these from names, photos, resumes, locations, schools, languages,
employment history, or other indirect signals.

If an approved explicit value is unavailable, the action is ask, require
confirmation, or leave unanswered—not guess.

## 20. Answer Engine decision contract

A decision may conceptually contain:

```text
normalized field/question key
detected question
answer source category/reference
proposed answer or unknown
policy category
confidence
sensitivity
requires review/confirmation
action
```

M12 implements this as a concrete typed contract with deterministic policies.
Later form execution must consume those decisions without weakening them.

## 21. External page and form trust

Web pages and application forms are untrusted. Their text cannot:

- override system or policy instructions;
- request unrelated private data;
- cause privileged tool actions;
- bypass answer policy;
- select another user's data; or
- convert unknown into a guessed answer.

Pass narrowly scoped structured inputs to AI. Validate all returned output.

## 22. Confidence and review

Confidence influences action but must not be presented as scientifically
calibrated unless it is.

- high confidence and safe policy may allow autofill;
- medium confidence may require suggestion/review;
- low confidence should ask or remain unresolved;
- sensitive policy can require confirmation regardless of confidence.

Confidence never overrides a prohibited inference.

## 23. Failure behavior

AI or Answer Engine failure must:

- preserve original documents, pages, forms, and confirmed data;
- avoid partial destructive writes;
- avoid duplicate durable records on retry;
- provide a manual path; and
- expose a useful failure category without logging private content.

## 24. Provider abstraction and prompt management

Domain and application services depend on task-oriented interfaces, not scattered
provider calls. Provider adapters handle authentication, translation, retry,
usage metadata, model selection, and normalized errors.

Prompts are versioned product logic stored in task-specific modules. Provider,
model, prompt version, and validation outcomes should be recorded where needed
for historical attribution.

Do not build a generalized AI framework or autonomous tool system before an
approved use case requires it.

## 25. Evaluation

### Implemented intelligence evaluation

Test:

- resume extraction accuracy and ambiguity;
- job requirement grounding;
- evidence ownership and reference validity;
- Strong/Hidden/Weak/Genuine Gap classification;
- hidden-evidence recall and false positives;
- genuine-gap preservation;
- context mixing;
- metric, skill, seniority, ownership, and production-claim hallucination; and
- recommendation stability and usefulness.

### Planned Answer Engine evaluation

Before autofill is trusted, test:

- deterministic field mapping;
- semantic classification accuracy;
- unknown handling;
- stale/ambiguous source behavior;
- sensitive-policy enforcement;
- protected-trait non-inference;
- reusable-answer intent;
- application-specific history;
- hostile/prompt-injected page text;
- generic and supported ATS fixtures; and
- no automatic final submission.

## 26. Acceptance standard

CareerOS AI is ready only when it is grounded, traceable, policy-compliant,
reasonably stable, useful, recoverable, and honest about unknowns.

Fluent output, valid JSON, or high apparent automation coverage alone is not
sufficient.
