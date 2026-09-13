# CareerOS Core V1 — AI Specification

> Version: 0.1
> Status: Draft
> Last Updated: 2026-09-13
> Product: CareerOS

---

# 1. Purpose

This document defines how AI should behave inside CareerOS Core V1.

It specifies:

- AI responsibilities,
- grounding rules,
- structured output requirements,
- evidence retrieval behavior,
- job understanding,
- evidence matching,
- hidden evidence detection,
- gap detection,
- application recommendation,
- application strategy,
- resume tailoring,
- uncertainty handling,
- hallucination prevention,
- validation,
- and evaluation.

This document defines product-level AI contracts.

It does not prescribe a specific LLM provider, prompt framework, model, or orchestration library.

---

# 2. Core AI Principle

CareerOS AI follows one foundational principle:

> Evidence before generation.

CareerOS should not begin by asking:

> What would make this candidate look stronger?

It should begin by asking:

> What does the job require, and what verified evidence does this candidate actually have?

The intended reasoning pipeline is:

Understand Candidate
→ Understand Job
→ Retrieve Evidence
→ Evaluate Evidence
→ Determine Strategy
→ Generate

Not:

Resume + JD
→ LLM
→ Rewrite

---

# 3. AI Responsibilities

AI may assist CareerOS with:

1. resume extraction,
2. Career Brain normalization,
3. job description parsing,
4. requirement extraction,
5. evidence retrieval,
6. semantic evidence matching,
7. evidence classification,
8. hidden evidence detection,
9. gap identification,
10. application recommendation,
11. application strategy,
12. resume recommendation,
13. evidence-grounded rewriting,
14. application field understanding where deterministic mapping is insufficient,
15. explanation generation.

AI should not be used merely because a task can be performed by AI.

Deterministic logic should be preferred for deterministic problems.

---

# 4. Rules Before AI

CareerOS should use conventional logic where appropriate.

Examples:

First Name field
→ deterministic mapping

Email field
→ deterministic mapping

Known canonical work authorization question
→ retrieve explicitly confirmed answer

Resume version lookup
→ database query

Application status
→ product state

AI is appropriate when interpretation is required.

Examples:

Does this JD requirement correspond to distributed systems experience?

Does this project provide evidence for Kubernetes?

Is a resume bullet underrepresenting relevant experience?

How should a verified achievement be rewritten for this job?

The architecture should support hybrid deterministic + AI behavior.

---

# 5. AI Trust Hierarchy

When sources conflict, CareerOS should conceptually follow this priority:

1. explicit current user correction,
2. explicit user-confirmed Career Brain information,
3. user-added Career Brain information,
4. reliable structured information derived from user documents,
5. AI extraction or interpretation,
6. model inference.

Higher-priority information overrides lower-priority interpretation.

AI must not override explicit user corrections simply because the model believes another answer is more likely.

---

# 6. Fact vs Interpretation

CareerOS should distinguish between:

## Fact

Information grounded in user-provided or user-confirmed evidence.

Example:

The user worked at Company A from 2024 to 2025.

## Interpretation

An AI conclusion based on facts.

Example:

This experience provides strong evidence for backend engineering.

## Recommendation

A suggested action based on facts and interpretation.

Example:

Emphasize this backend experience for the target role.

## Unknown

Information CareerOS does not have enough evidence to determine.

Example:

Whether the user has production GCP experience when no supporting evidence exists.

The product and AI contracts should avoid converting Interpretation into Fact.

---

# 7. Grounding Policy

Any generated professional claim that may appear in:

- a resume,
- an application,
- a professional summary,
- a project description,
- an experience bullet,
- or another candidate-facing professional artifact

must be grounded in Career Brain evidence.

Grounding should be represented through evidence references where practical.

Conceptually:

GeneratedClaim {
  text
  evidence_ids[]
}

If no evidence exists for a material professional claim:

do not generate the claim.

---

# 8. Prohibited Fabrication

CareerOS must not invent or materially distort:

- employers,
- job titles,
- employment dates,
- responsibilities,
- projects,
- technologies,
- programming languages,
- frameworks,
- cloud platforms,
- certifications,
- degrees,
- institutions,
- achievements,
- metrics,
- team size,
- user counts,
- revenue impact,
- latency improvements,
- percentages,
- production scale,
- leadership responsibilities,
- years of experience,
- seniority,
- or other professional facts.

This rule applies even when fabrication would improve apparent job match.

---

# 9. Metric Protection

Quantitative claims require especially strong grounding.

Examples:

25% improvement

3s → 0.8s latency

99.9% availability

1M users

10-person team

If the source evidence does not contain or support the number:

CareerOS must not create it.

AI may improve wording around a verified metric.

AI may not invent a more impressive metric.

---

# 10. Skill Protection

A skill appearing in a JD does not give CareerOS permission to add that skill to the user's resume.

Example:

Job requires:
GCP

Career Brain:
No GCP evidence

Result:
Genuine Gap

Forbidden behavior:
Add GCP to Skills because the job requires it.

---

# 11. Resume Parsing AI

Resume parsing should transform uploaded resume content into a structured draft.

Expected extraction categories include:

- personal information,
- education,
- experience,
- projects,
- skills,
- achievements,
- professional links.

The output is not automatically authoritative.

Parsed information should retain provenance and confirmation state.

---

# 12. Resume Parsing Uncertainty

When resume structure is ambiguous, AI should preserve uncertainty.

Example:

A date could belong to either Project A or Experience B.

Incorrect behavior:

Silently assign the date and treat it as confirmed.

Preferred behavior:

Return lower confidence or flag ambiguity for review.

The onboarding UX should allow correction.

---

# 13. Career Brain Normalization

AI may normalize equivalent terminology when useful.

Examples:

Postgres
→ PostgreSQL

K8s
→ Kubernetes

SpringBoot
→ Spring Boot

Normalization must not create skills that were not present.

The original user wording should remain recoverable where useful.

---

# 14. Job Understanding Pipeline

Job Intelligence should convert a raw job description into structured information.

Conceptual pipeline:

Raw Job Description
→ Job Parsing
→ Requirement Extraction
→ Requirement Normalization
→ Importance Classification
→ Structured Job Representation

---

# 15. Job Parsing Output

A structured job analysis should attempt to identify:

- role title,
- company,
- location,
- seniority,
- responsibilities,
- required qualifications,
- preferred qualifications,
- skills,
- technologies,
- education expectations,
- experience expectations,
- domain requirements,
- explicitly stated work authorization constraints,
- other relevant signals.

Not every job will contain every field.

Missing information should remain missing rather than being invented.

---

# 16. Job Requirement Structure

Conceptually, an extracted requirement should resemble:

JobRequirement {
  id
  category
  description
  normalized_value
  importance
  source_text
  confidence
}

Possible categories include:

skill

experience

responsibility

education

domain

seniority

location

work_authorization

other

Possible importance values include:

required

preferred

inferred_priority

---

# 17. Explicit vs Inferred Requirements

CareerOS should distinguish between:

Explicit Requirement

The JD directly states the requirement.

and:

Inferred Requirement

CareerOS believes the requirement is important based on the job context.

Inferred requirements must not be presented as if the employer explicitly stated them.

---

# 18. Evidence Retrieval

For each meaningful Job Requirement, CareerOS should retrieve potentially relevant Career Evidence.

Evidence may come from:

- Experience,
- Experience Details,
- Projects,
- Project Details,
- Skills,
- Achievements,
- Metrics,
- Education,
- Certifications.

Evidence retrieval should not rely only on exact keyword matching.

Semantic relevance is allowed.

---

# 19. Evidence Retrieval Example

Job Requirement:

Experience building distributed systems.

Career Brain evidence:

Built Kafka-based asynchronous messaging pipeline.

Even if the phrase:

distributed systems

does not appear literally, CareerOS may identify the experience as potentially relevant evidence.

The final classification should evaluate how strongly that evidence supports the requirement.

---

# 20. Retrieval Is Not Proof

Retrieving evidence does not automatically mean the requirement is satisfied.

The pipeline should conceptually separate:

Candidate Retrieval

from:

Evidence Evaluation

Example:

Requirement:
Kubernetes production experience

Retrieved evidence:
Docker deployment project

This may be semantically related.

It does not automatically prove Kubernetes experience.

---

# 21. Evidence Evaluation

For each Job Requirement and retrieved Career Evidence, CareerOS should evaluate:

- relevance,
- directness,
- strength,
- confirmation state,
- context,
- and resume representation where applicable.

The result contributes to Evidence Match classification.

---

# 22. Evidence Match Classification

CareerOS uses four primary classifications.

## Strong Evidence

Clear evidence supports the requirement.

## Hidden / Underrepresented Evidence

Strong or useful evidence exists in Career Brain, but the selected resume does not sufficiently represent it.

## Weak Evidence

Related evidence exists, but support is indirect, incomplete, or uncertain.

## Genuine Gap

No sufficient supporting evidence exists.

These classifications are core CareerOS concepts.

---

# 23. Strong Evidence

Strong Evidence should normally require direct or highly relevant support.

Example:

Requirement:
Kafka

Career Brain:

Experience Detail:
Built Kafka-based asynchronous messaging infrastructure.

Classification:

Strong Evidence

Evidence reference must be retained.

---

# 24. Weak Evidence

Weak Evidence should not be inflated into Strong Evidence merely to make the candidate appear better.

Example:

Requirement:
Kubernetes production experience

Career Brain:

Used Docker for local development.

Possible classification:

Weak Evidence or Genuine Gap

depending on the requirement wording.

It should not become Strong Evidence.

---

# 25. Genuine Gap

A Genuine Gap exists when CareerOS cannot find sufficient supporting evidence.

Example:

Requirement:
GCP production experience

Career Brain:
No GCP evidence.

Classification:
Genuine Gap

Required behavior:

Communicate the gap.

Forbidden behavior:

Invent GCP experience.

---

# 26. Hidden Evidence

Hidden Evidence is a core CareerOS capability.

It requires comparing:

Career Brain Evidence

against:

Job Requirement

and:

Selected Resume Representation

Conceptually:

Relevant Career Evidence Exists
+
Evidence Is Useful for Job
+
Evidence Is Missing or Underrepresented in Resume

=

Hidden / Underrepresented Evidence

---

# 27. Hidden Evidence Example

Job Requirement:

Kubernetes

Career Brain:

RoundBlock
→ Deployment
→ Kubernetes

Current Resume:

No Kubernetes reference.

CareerOS result:

Hidden Evidence:
Kubernetes

Evidence:
RoundBlock deployment work

Recommendation:
Consider surfacing this experience.

This is different from simply adding a JD keyword.

The experience already exists.

---

# 28. Resume Representation Analysis

To detect hidden evidence, CareerOS should understand what evidence the selected resume currently represents.

Conceptually:

Career Evidence
→ represented / partially represented / not represented

This does not require perfect semantic proof.

The system should use reasonable confidence and surface uncertainty where needed.

---

# 29. Match Score

CareerOS may compute a summary score.

However:

The score is secondary.

The system should never imply that:

Match Score = Interview Probability

or:

Match Score = Offer Probability

The score should summarize evidence alignment only.

---

# 30. Match Score Inputs

If a match score is implemented, inputs may conceptually include:

- importance of requirements,
- strength of evidence,
- required vs preferred requirements,
- genuine gaps,
- weak evidence,
- relevant experience.

The scoring mechanism should be deterministic or reproducible where practical.

The LLM should not simply invent:

87%

without an explicit scoring method.

---

# 31. Application Recommendation

CareerOS should translate evidence analysis into a recommendation.

Possible values:

strong_apply

apply

stretch

low_priority

The recommendation should consider:

- required requirement coverage,
- strength of evidence,
- major genuine gaps,
- relevance of experience,
- role alignment,
- explicitly stated constraints.

---

# 32. Application Recommendation Output

Conceptually:

ApplicationRecommendation {
  recommendation
  reasons[]
  strengths[]
  risks[]
  major_gaps[]
  confidence
}

The explanation must remain grounded in Job Analysis and Career Evidence.

---

# 33. No Hiring Probability Claims

CareerOS V1 must not claim:

- exact interview probability,
- exact offer probability,
- exact recruiter response probability,
- or other unsupported hiring probabilities.

Example of prohibited output:

You have a 74% chance of getting an interview.

Acceptable:

Strong Apply

because the candidate has strong evidence for most core backend requirements, with one meaningful cloud gap.

---

# 34. Application Intelligence

Application Intelligence determines how the user should prepare for a specific job.

Inputs:

Career Brain

Job Analysis

Evidence Matches

Selected / Available Resumes

Output:

Application Strategy

---

# 35. Application Strategy Output

Conceptually:

ApplicationStrategy {
  positioning
  recommended_base_resume
  prioritize[]
  de_emphasize[]
  hidden_evidence_to_surface[]
  genuine_gaps[]
  resume_recommendations[]
  explanation
}

Every strategy item involving professional facts should reference evidence.

---

# 36. Positioning

CareerOS may recommend a truthful framing of the user's existing experience.

Example:

Backend / Infrastructure Engineer

This is acceptable when supported by the Career Brain.

CareerOS must not invent seniority or professional identity.

Example:

User has internship experience only.

Forbidden:

Senior Distributed Systems Engineer

unless supported by actual career evidence.

---

# 37. Evidence Prioritization

CareerOS may recommend emphasizing some evidence over other evidence.

Example:

Backend job:

Prioritize:
Java backend experience
Kafka
Data infrastructure

De-emphasize:
Unrelated design project

This is selection, not fabrication.

---

# 38. Resume Recommendation Pipeline

Resume recommendations should follow:

Target Job Requirement
→ Relevant Career Evidence
→ Current Resume Representation
→ Application Strategy
→ Proposed Resume Change

This chain should remain inspectable where practical.

---

# 39. Resume Recommendation Types

Supported conceptual actions:

keep

strengthen

rewrite

add

remove

de_emphasize

Each recommendation should include:

- target,
- action,
- reason,
- suggested content where relevant,
- evidence references,
- confidence.

---

# 40. Resume Rewrite Rules

AI may:

- improve clarity,
- improve concision,
- improve structure,
- improve relevance,
- foreground verified technologies,
- foreground verified impact,
- use stronger professional wording,
- reorder verified information.

AI may not:

- add unsupported facts,
- change the nature of the user's work,
- inflate ownership,
- inflate seniority,
- create metrics,
- convert participation into leadership without evidence,
- convert prototype work into production work without evidence.

---

# 41. Ownership Protection

AI should preserve the user's actual level of ownership.

Examples:

Evidence:
Contributed to implementation.

Forbidden rewrite:
Architected and led implementation.

Evidence:
Worked with team on migration.

Forbidden rewrite:
Led organization-wide migration.

Strong verbs must remain consistent with evidence.

---

# 42. Production Context Protection

CareerOS should not silently upgrade environment claims.

Evidence:

Built project locally.

Forbidden:
Deployed production system.

Evidence:

Internal prototype.

Forbidden:
Production platform used at scale.

Evidence:

Used technology in coursework.

Forbidden:
Production experience with technology.

---

# 43. Generated Resume Claim Contract

Conceptually, materially generated resume content should support:

GeneratedResumeClaim {
  text
  evidence_ids[]
  transformation_type
  confidence
}

Possible transformation types:

rewrite

combine

summarize

surface_hidden_evidence

The exact implementation may differ.

The contract principle should remain.

---

# 44. Combining Evidence

CareerOS may combine multiple evidence items into one concise resume statement when the combined statement remains truthful.

Example:

Evidence A:
Built Java API.

Evidence B:
Used PostgreSQL.

Potential combined statement:

Built Java APIs backed by PostgreSQL...

Only if both evidence items refer to compatible work context.

CareerOS must not combine unrelated experiences in a way that creates a false implication.

---

# 45. Evidence Context Boundaries

Evidence should retain context.

Example:

Kubernetes used in Project A.

Kafka used in Experience B.

CareerOS must not automatically generate:

Built a Kubernetes-based Kafka platform at Experience B.

That statement incorrectly merges contexts.

Evidence compatibility must be considered.

---

# 46. Missing Information

When CareerOS needs information that does not exist:

Preferred behavior:

Ask user where appropriate.

or:

Represent Unknown.

Not:

Invent answer.

This applies to:

career information,

application questions,

resume facts,

job constraints,

and other consequential information.

---

# 47. Application Form Intelligence

Application Assistant should use a hybrid approach.

Preferred order:

1. deterministic field mapping,
2. canonical question mapping,
3. reusable confirmed answer retrieval,
4. AI semantic classification where needed,
5. user review when uncertain.

AI should not be the first layer for every form field.

---

# 48. Application Field Classification

Conceptually, CareerOS may classify a field into a canonical type.

Example:

"Please enter your given name"

→ first_name

"Will you require visa sponsorship now or in the future?"

→ sponsorship_required

The system may use AI when wording is unfamiliar.

---

# 49. Application Answer Contract

Conceptually:

ApplicationFieldDecision {
  field_key
  detected_question
  answer_source
  proposed_answer
  confidence
  requires_review
}

Possible answer sources:

career_brain

reusable_answer

user_input

ai_suggestion

unknown

---

# 50. Consequential Application Answers

AI must not infer consequential answers.

Examples:

work authorization

sponsorship

salary expectations

legal attestations

signature

demographic disclosures

disability

veteran status

If no explicit answer exists:

return unknown / requires user input.

---

# 51. Demographic Inference

CareerOS must never infer protected or sensitive demographic information from:

- name,
- photo,
- resume,
- location,
- school,
- language,
- nationality assumptions,
- employment history,
- or other indirect signals.

---

# 52. Structured AI Outputs

AI operations that feed product logic should return structured data.

Avoid relying exclusively on prose such as:

"This candidate seems like a pretty good fit."

Prefer schemas.

Example:

{
  "requirement_id": "req_12",
  "classification": "strong_evidence",
  "evidence_ids": ["exp_detail_3"],
  "confidence": "high",
  "explanation": "..."
}

The exact schemas will be finalized during implementation.

---

# 53. Schema Validation

Structured AI output should be validated before entering downstream logic.

If output:

- violates schema,
- references nonexistent evidence,
- contains invalid enum values,
- or fails required grounding checks,

the system should reject, repair, or regenerate it rather than blindly persist it.

---

# 54. Evidence ID Validation

AI must not be trusted to invent valid evidence references.

If an AI output returns:

evidence_id = exp_999

CareerOS must verify that:

- the evidence exists,
- belongs to the correct user,
- and is eligible for the current context.

Invalid references must not be accepted.

---

# 55. Grounding Validator

CareerOS should conceptually include a validation stage after generation.

Example:

Generated Claim
→ Extract Referenced Evidence
→ Validate Evidence Exists
→ Validate Context Compatibility
→ Validate Protected Facts / Metrics
→ Accept or Reject

The implementation may combine deterministic and AI validation.

---

# 56. Two-Stage Generation for High-Risk Content

For resume generation, a useful architecture may separate:

Stage 1:
Select evidence and determine intended claim.

Stage 2:
Generate wording using only selected evidence.

This is preferable to giving the model the entire Career Brain and asking it to freely write the strongest resume possible.

The exact implementation will be evaluated in architecture.

---

# 57. AI Explanations

Explanations should be concise and useful.

Good explanation:

Hidden Evidence

The job requires Kubernetes. Your RoundBlock deployment work includes Kubernetes, but the selected resume does not currently mention it.

Poor explanation:

Our advanced AI analyzed your profile and determined this is an excellent optimization opportunity.

Explain evidence, not AI magic.

---

# 58. Confidence

AI operations may use confidence values such as:

high

medium

low

Confidence should influence UX.

Example:

High confidence:
show recommendation normally.

Medium confidence:
show explanation and allow review.

Low confidence:
ask for user confirmation or avoid automatic action.

Confidence must not be presented as scientifically calibrated unless it actually is.

---

# 59. AI Failure Behavior

When AI processing fails:

- preserve user data,
- preserve original resume,
- preserve captured job,
- provide retry where appropriate,
- avoid partial destructive updates.

AI failure should not corrupt Career Brain truth.

---

# 60. User Correction Loop

When a user corrects AI output:

User correction should become authoritative for the relevant context.

Examples:

AI extracts wrong job title.
→ User corrects it.

AI says Kubernetes evidence is weak.
→ User supplies confirmed additional evidence.
→ Future analysis may use the new evidence.

The system should not repeatedly overwrite explicit user corrections with model guesses.

---

# 61. AI Model Abstraction

CareerOS should not encode product behavior around one specific model vendor.

Product contracts should remain stable across models.

Conceptually:

CareerOS Domain Logic
→ AI Service Interface
→ Model Provider

rather than:

CareerOS Domain Logic
→ Provider-Specific Prompt Everywhere

Detailed architecture belongs in `ARCHITECTURE.md`.

---

# 62. Prompt Management Principle

Prompts should be treated as versioned product logic.

Avoid:

- large untracked prompt strings scattered throughout UI components,
- duplicated prompts,
- prompts directly coupled to random routes.

Prefer:

- centralized task-specific prompts,
- structured inputs,
- structured outputs,
- version identifiers,
- evaluation against test cases.

---

# 63. AI Task Separation

Core AI tasks should remain logically separate.

Examples:

Resume Parser

Job Parser

Evidence Retriever

Evidence Evaluator

Application Recommender

Application Strategist

Resume Rewriter

Form Field Classifier

This does not mean each task requires a separate model call or service.

It means responsibilities should remain conceptually testable.

---

# 64. Determinism and Stability

Identical inputs do not need to produce identical prose.

However, important classifications should be reasonably stable.

Example:

A clearly unsupported GCP requirement should not alternate randomly between:

Strong Evidence

and:

Genuine Gap

across repeated runs.

High-level product decisions should favor reproducibility.

---

# 65. Caching

Stable AI results may be cached where appropriate.

Examples:

Job parsing for unchanged JD.

Resume parsing for unchanged file.

Repeated analysis may reuse stable intermediate results.

Cache invalidation should consider changes to:

- Career Brain,
- selected Resume Version,
- Job Description,
- analysis version.

Exact caching strategy belongs in architecture.

---

# 66. AI Versioning

Important AI operations should conceptually support versioning.

Possible identifiers:

resume_parser_version

job_parser_version

matching_version

application_strategy_version

resume_rewriter_version

This helps CareerOS understand why persisted results may differ over time.

V1 does not require sophisticated ML experiment infrastructure.

---

# 67. Evaluation Philosophy

CareerOS AI should be evaluated as a product system, not by whether individual responses sound impressive.

The important questions are:

Did it extract correctly?

Did it retrieve the right evidence?

Did it classify evidence correctly?

Did it identify genuine gaps?

Did it find hidden evidence?

Did it avoid fabrication?

Did it recommend useful changes?

Did the user accept the recommendation?

---

# 68. Resume Parsing Evaluation

Representative resumes should test:

- standard one-page technical resume,
- multi-page resume,
- internship-heavy resume,
- project-heavy resume,
- unusual section order,
- incomplete resume,
- formatting ambiguity.

Evaluate:

field extraction accuracy,

entity boundaries,

date association,

skill extraction,

and uncertainty behavior.

---

# 69. Job Parsing Evaluation

Representative jobs should test:

- Backend,
- Frontend,
- Full Stack,
- Data,
- AI / ML,
- Infrastructure,
- different seniority levels,
- ambiguous JDs,
- poorly structured JDs.

Evaluate:

requirement extraction,

required vs preferred classification,

skill extraction,

responsibility understanding,

and unsupported inference.

---

# 70. Evidence Matching Evaluation

Create test cases containing known expected evidence relationships.

Example:

Requirement:
Kafka

Expected:
Strong Evidence

Requirement:
Kubernetes

Career Brain:
Evidence exists

Resume:
Evidence absent

Expected:
Hidden Evidence

Requirement:
GCP

Career Brain:
No evidence

Expected:
Genuine Gap

These cases should become regression tests where practical.

---

# 71. Hallucination Evaluation

CareerOS should maintain explicit adversarial tests.

Examples:

JD contains technology absent from Career Brain.

Does AI add it anyway?

JD requests five years of experience.

User has two.

Does AI inflate years?

JD emphasizes leadership.

User contributed but did not lead.

Does AI change "contributed" to "led"?

Career Brain has no metrics.

Does AI invent percentages?

These failures should be treated as serious product defects.

---

# 72. Context Mixing Evaluation

Test whether AI incorrectly combines evidence from different experiences.

Example:

Experience A:
Kafka

Project B:
Kubernetes

The system must not generate:

Built Kubernetes Kafka platform at Experience A

unless supporting evidence actually connects those facts.

---

# 73. Hidden Evidence Evaluation

Hidden Evidence should receive dedicated evaluation because it is a core CareerOS capability.

Test cases should include:

Evidence in Career Brain + absent resume

Evidence in resume + Career Brain

Weak related evidence

No evidence

Multiple evidence sources

Ambiguous evidence

Evaluate both recall and false-positive behavior.

---

# 74. Application Strategy Evaluation

A useful strategy should:

- prioritize relevant evidence,
- avoid unnecessary rewriting,
- identify genuine gaps,
- recommend an appropriate base resume,
- avoid unsupported positioning,
- explain important choices.

The strategy should materially help a user prepare the application.

---

# 75. Resume Recommendation Evaluation

Evaluate recommendations on:

Truthfulness

Relevance

Clarity

Conciseness

Evidence Grounding

Preservation of Meaning

User Usefulness

A recommendation that sounds impressive but changes the truth is a failure.

---

# 76. Human Evaluation

AI quality cannot be validated entirely through automated metrics.

During V1 development, representative outputs should be manually reviewed.

For each test application, reviewers should inspect:

Job Requirements

Evidence Matches

Hidden Evidence

Genuine Gaps

Application Recommendation

Application Strategy

Resume Recommendations

Generated Resume

This is especially important before trusting automatic resume modification.

---

# 77. Initial AI Test Set

CareerOS should maintain a small high-quality evaluation set before attempting large-scale evaluation.

Initial cases should include:

1. strong backend match,
2. moderate backend match,
3. infrastructure role,
4. AI / ML role,
5. data role,
6. hidden evidence case,
7. genuine gap case,
8. substantially mismatched role,
9. ambiguous JD,
10. incomplete resume.

Expected outputs should be documented for key classifications.

---

# 78. AI Acceptance Standard

CareerOS AI is not ready merely because:

- the model returns valid JSON,
- the response sounds professional,
- or the generated resume looks polished.

It is ready when:

- facts remain grounded,
- evidence can be traced,
- important gaps remain gaps,
- hidden evidence is usefully surfaced,
- recommendations are materially useful,
- classifications are reasonably stable,
- and users remain in control.

---

# 79. CareerOS Intelligence Pipeline

The complete conceptual pipeline is:

Career Brain
      ↓
Evidence Index / Retrieval
      ↓
Relevant Career Evidence
      │
      │
Job Description
      ↓
Job Understanding
      ↓
Job Requirements
      │
      └──────────────┐
                     ↓
              Evidence Evaluation
                     ↓
          ┌───────────────────────┐
          │ Strong Evidence       │
          │ Hidden Evidence       │
          │ Weak Evidence         │
          │ Genuine Gap           │
          └───────────────────────┘
                     ↓
          Application Recommendation
                     ↓
           Application Strategy
                     ↓
            Evidence Selection
                     ↓
           Resume Recommendations
                     ↓
          Grounded Resume Generation
                     ↓
               User Review
                     ↓
                Application

---

# 80. Core AI Invariant

Across CareerOS, the following invariant should remain true:

> Generation cannot create professional truth.

Generation may:

select,

organize,

summarize,

rewrite,

and emphasize

professional truth already supported by evidence.

It may not manufacture that truth.

---

# 81. Final AI Standard

CareerOS should behave less like:

> An AI that writes whatever gives the user the strongest-looking application.

And more like:

> An intelligent career system that understands what the user has actually done, understands what the opportunity requires, finds the strongest truthful evidence, and helps present that evidence effectively.
