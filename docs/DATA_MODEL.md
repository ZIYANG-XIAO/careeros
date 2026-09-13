# CareerOS Core V1 — Domain Data Model

> Version: 0.1
> Status: Draft
> Last Updated: 2026-09-13
> Product: CareerOS

---

# 1. Purpose

This document defines the core domain concepts and relationships required by CareerOS Core V1.

It is intentionally a logical product data model rather than a final physical database schema.

The physical implementation will be defined in `docs/ARCHITECTURE.md` and later engineering plans.

The model must support the core CareerOS loop:

Career Brain
→ Job Intelligence
→ Evidence Matching
→ Application Intelligence
→ Resume Tailoring
→ Application Assistance
→ Application Memory

The model must preserve one foundational rule:

> Career Brain is not the same as Resume.

And one foundational AI rule:

> Professional recommendations and generated claims should be traceable to user evidence.

---

# 2. Modeling Principles

## 2.1 Career Brain Is the Source of Professional Truth

Career information should not live only inside resume documents.

The Career Brain contains the structured professional context that CareerOS can reason about.

Resumes consume selected Career Brain information.

---

## 2.2 Resume Is a Presentation Artifact

A Resume represents a particular presentation of the user's professional information.

A user may have many resumes while maintaining one Career Brain.

---

## 2.3 Evidence Must Be Traceable

Important professional claims should be traceable to supporting career information.

CareerOS should be able to answer:

> Why do we believe this user has this experience?

---

## 2.4 AI Outputs Are Not Automatically Facts

AI extraction, interpretation, and recommendations must not automatically become authoritative Career Brain information.

User confirmation and correction matter.

---

## 2.5 Preserve History Where It Matters

CareerOS should preserve important resume and application context so users can understand what was used for a particular application.

---

## 2.6 Avoid Premature Complexity

Core V1 should not require:

- graph databases,
- event sourcing,
- complex ontology systems,
- separate microservices for every domain concept,
- or speculative future data infrastructure.

The logical model should be implementable using a conventional relational database.

---

# 3. High-Level Domain Model

The primary conceptual relationships are:

User
│
├── Career Brain
│   ├── Personal Information
│   ├── Education
│   ├── Experience
│   ├── Project
│   ├── Skill
│   ├── Achievement / Certification
│   ├── Application Information
│   ├── Career Preferences
│   └── Evidence
│
├── Resumes
│   └── Resume Versions
│
├── Jobs
│   ├── Job Requirements
│   └── Job Analysis
│       └── Evidence Matches
│
└── Applications
    ├── Application Strategy
    ├── Resume Used
    ├── Application Answers
    └── Status

The exact physical relationships may differ, but these conceptual boundaries should remain clear.

---

# 4. User

## Purpose

Represents the CareerOS account owner.

## Core Fields

Conceptually:

- id
- email
- created_at
- updated_at

Authentication-specific information is an architecture concern.

The User owns:

- one Career Brain,
- resumes,
- jobs,
- applications,
- preferences,
- and related CareerOS data.

---

# 5. Career Brain

## Purpose

The Career Brain is the user's persistent structured professional context.

It represents what CareerOS knows about the user's career based on user-provided or user-confirmed information.

## Conceptual Fields

- id
- user_id
- created_at
- updated_at
- last_confirmed_at

The Career Brain acts primarily as an aggregate boundary.

Much of its useful information exists in related domain entities.

---

# 6. Information Provenance

CareerOS should preserve where important Career Brain information came from.

Possible source types include:

- resume_import
- user_added
- user_edited
- user_confirmed
- system_extracted

Conceptually, important information may also have a verification state such as:

- extracted
- confirmed
- user_edited

The exact persistence mechanism will be determined later.

The important product requirement is:

> CareerOS should distinguish AI-extracted information from information the user has explicitly confirmed.

---

# 7. Personal Information

## Purpose

Stores reusable non-sensitive identity and contact information used across the CareerOS experience.

## Example Fields

- first_name
- last_name
- preferred_name
- email
- phone
- city
- region
- country
- LinkedIn URL
- GitHub URL
- portfolio URL
- personal website URL

Additional professional links may be modeled separately if required.

CareerOS must not infer sensitive demographic attributes from this information.

---

# 8. Education

## Purpose

Represents one education experience.

## Example Fields

- id
- career_brain_id
- institution
- degree
- field_of_study
- location
- start_date
- end_date
- expected_graduation
- description
- source
- confirmation_state
- created_at
- updated_at

A Career Brain may contain multiple Education entries.

---

# 9. Experience

## Purpose

Represents employment, internship, or other relevant professional experience.

## Example Fields

- id
- career_brain_id
- organization
- title
- employment_type
- location
- start_date
- end_date
- is_current
- summary
- source
- confirmation_state
- created_at
- updated_at

An Experience may have associated:

- Experience Details
- Skills
- Evidence
- Achievements
- Metrics

---

# 10. Experience Detail

## Purpose

Represents meaningful units of professional work inside an Experience.

Examples include:

- responsibility,
- project contribution,
- system built,
- technical contribution,
- operational responsibility,
- achievement,
- measurable result.

Conceptual fields:

- id
- experience_id
- type
- description
- source
- confirmation_state

Possible types may include:

- responsibility
- achievement
- project_contribution
- technical_work
- operational_work
- other

This concept helps CareerOS reason about an Experience at a more useful level than a single large description.

---

# 11. Project

## Purpose

Represents a professional, academic, open-source, or personal project relevant to the user's career.

## Example Fields

- id
- career_brain_id
- name
- role
- description
- start_date
- end_date
- project_url
- repository_url
- source
- confirmation_state
- created_at
- updated_at

A Project may have associated:

- project details,
- skills,
- technologies,
- achievements,
- metrics,
- evidence.

---

# 12. Project Detail

Similar to Experience Detail, a Project Detail represents a meaningful unit of work within a project.

Examples:

- implemented retrieval pipeline,
- designed API layer,
- deployed Kubernetes workload,
- improved latency,
- built evaluation framework.

Conceptual fields:

- id
- project_id
- type
- description
- source
- confirmation_state

---

# 13. Skill

## Purpose

Represents a professional skill or technology associated with the user.

Examples:

- Java
- Python
- Spring Boot
- Kafka
- Redis
- Kubernetes
- Spark
- PostgreSQL

## Conceptual Fields

- id
- career_brain_id
- name
- normalized_name
- category
- source
- confirmation_state

Possible categories may include:

- programming_language
- framework
- database
- cloud
- infrastructure
- data
- ai_ml
- tool
- methodology
- other

The category system should remain extensible.

---

# 14. Skill Relationships

A Skill should not exist only as an isolated keyword when contextual evidence is available.

CareerOS should be able to associate skills with relevant career contexts.

Examples:

Kafka
→ Experience A
→ Messaging Platform

Kubernetes
→ Project B
→ Deployment Work

The physical implementation may use relationship tables or another relational pattern.

The important requirement is that CareerOS can understand:

> Where did the user actually use this skill?

---

# 15. Achievement

## Purpose

Represents a meaningful professional achievement that may exist independently or within an Experience or Project.

Examples:

- improved latency,
- increased retrieval quality,
- reduced failure rate,
- supported production availability.

Conceptual fields:

- id
- career_brain_id
- context_type
- context_id
- description
- source
- confirmation_state

---

# 16. Metric

## Purpose

Represents a quantitative fact associated with professional evidence.

Examples:

- latency reduced from 3s to 0.8s,
- recall improved by 25%,
- availability above 99%.

Conceptual fields:

- id
- context_type
- context_id
- description
- value where structured representation is useful
- unit where relevant
- source
- confirmation_state

Metrics are high-risk hallucination targets.

AI must not invent or alter metrics without supporting evidence.

---

# 17. Certification

## Purpose

Represents a professional certification explicitly provided by the user or reliably extracted and confirmed.

Example fields:

- id
- career_brain_id
- name
- issuer
- issue_date
- expiration_date
- credential_url
- source
- confirmation_state

---

# 18. Career Evidence

## Purpose

Career Evidence is the grounding layer between Career Brain information and CareerOS intelligence.

Evidence represents information that can support a professional claim.

Examples:

- an Experience Detail,
- a Project Detail,
- an Achievement,
- a Metric,
- an Education entry,
- a Certification,
- or another confirmed professional fact.

Career Evidence does not necessarily require one separate physical table for every evidence item.

It is a logical abstraction.

The architecture may implement evidence references using IDs and typed relationships.

---

# 19. Evidence Reference

CareerOS should be able to reference evidence using a stable identifier.

Conceptually:

EvidenceReference

- evidence_type
- evidence_id

Example:

evidence_type:
experience_detail

evidence_id:
exp_detail_123

This allows downstream systems to state:

Claim:
Experienced with Kafka

Evidence:
experience_detail_123
experience_detail_456

Rather than merely generating an unsupported sentence.

---

# 20. Evidence Confidence

Evidence-based reasoning may use a confidence concept.

Possible conceptual levels:

- high
- medium
- low

Confidence should represent the strength of support, not certainty about future hiring outcomes.

Example:

Requirement:
Kafka

Evidence:
Multiple confirmed production experience details

Evidence Confidence:
High

This is distinct from:

Interview Probability

which CareerOS should not claim without valid supporting data.

---

# 21. Application Information

## Purpose

Stores reusable answers for common application questions when explicitly provided by the user.

Possible V1 fields include:

- work_authorization
- sponsorship_required
- relocation_preference
- preferred_locations

This model must remain separate from inferred demographic information.

Sensitive or consequential answers must originate from explicit user input.

---

# 22. Reusable Application Answer

Some application answers do not fit cleanly into fixed Career Brain fields.

CareerOS may represent reusable answers conceptually as:

- id
- user_id
- canonical_question_key
- answer
- answer_type
- user_confirmed
- created_at
- updated_at

Example:

canonical_question_key:
requires_sponsorship

answer:
true

The exact V1 scope will be constrained by supported autofill fields.

CareerOS must not create consequential reusable answers through inference.

---

# 23. Career Preference

## Purpose

Represents user-provided job-search preferences.

Examples:

- target roles
- target locations
- preferred work arrangement

Preferences are not professional evidence.

A preference should not be used to fabricate candidate qualifications.

---

# 24. Resume

## Purpose

Represents a logical resume asset owned by the user.

Examples:

- Master Resume
- Backend Resume
- AI Resume

Conceptual fields:

- id
- user_id
- name
- type
- created_at
- updated_at

A Resume may contain multiple Resume Versions.

---

# 25. Resume Version

## Purpose

Represents an immutable or historically preserved version of a resume.

Conceptual fields:

- id
- resume_id
- version_number or version_identifier
- source_file_reference
- structured_content
- created_at
- created_by
- source_version_id
- target_job_id where applicable

Possible creation sources:

- uploaded
- user_edited
- ai_tailored

A job-specific resume should normally reference:

- its base Resume Version,
- target Job,
- accepted recommendations where relevant.

---

# 26. Resume Content and Career Brain

Resume content may reference Career Brain entities or evidence.

Example:

Resume Bullet
→ Experience A
→ Evidence IDs

This relationship is important because it allows CareerOS to understand whether relevant Career Brain evidence is:

- already represented in the resume,
- underrepresented,
- or absent.

The implementation should preserve this relationship where practical.

---

# 27. Resume Claim

A Resume Claim is a logical concept representing a professional statement appearing in a resume.

Examples:

- a bullet,
- project statement,
- skill claim,
- summary claim.

Conceptually, a claim may contain:

- claim text
- resume version
- section
- supporting evidence references

The physical implementation does not necessarily require a dedicated `resume_claims` table in the earliest milestone.

However, AI-generated or materially rewritten claims should support evidence traceability.

---

# 28. Job

## Purpose

Represents an opportunity captured by CareerOS.

Conceptual fields:

- id
- user_id
- company
- title
- location
- description
- source_url
- application_url
- source_type
- captured_at
- created_at
- updated_at

Possible source types:

- browser_extension
- manual_entry

Future job discovery sources may be added later.

---

# 29. Job Deduplication

CareerOS should avoid unnecessary duplicate jobs for the same user.

Potential signals include:

- canonical source URL,
- company,
- title,
- location,
- external job identifier where available.

Exact deduplication logic belongs in implementation planning.

V1 should prioritize avoiding obvious duplicates rather than attempting perfect global job identity resolution.

---

# 30. Job Requirement

## Purpose

Represents a structured requirement extracted from a Job.

Conceptual fields:

- id
- job_id
- category
- description
- normalized_value where useful
- importance
- source_text_reference
- confidence

Possible categories:

- skill
- experience
- responsibility
- education
- domain
- seniority
- location
- work_authorization
- other

Possible importance values:

- required
- preferred
- inferred_priority

The system should distinguish explicitly stated requirements from AI interpretation where practical.

---

# 31. Job Analysis

## Purpose

Represents CareerOS's structured analysis of a Job for a specific user context.

Conceptual fields:

- id
- job_id
- career_brain_id
- resume_version_id where relevant
- analysis_version
- overall_recommendation
- summary
- created_at

A Job Analysis should preserve enough context to understand what CareerOS concluded at that time.

---

# 32. Evidence Match

## Purpose

Connects a Job Requirement with relevant Career Evidence.

This is one of the most important CareerOS domain relationships.

Conceptually:

Job Requirement
↔
Career Evidence

An Evidence Match may contain:

- id
- job_analysis_id
- job_requirement_id
- classification
- evidence_references
- explanation
- confidence

---

# 33. Evidence Match Classification

Allowed conceptual classifications:

## Strong Evidence

Clear supporting evidence exists.

## Hidden / Underrepresented Evidence

Supporting evidence exists in Career Brain but is missing or insufficiently represented in the selected resume.

## Weak Evidence

Related evidence exists, but support is incomplete or indirect.

## Genuine Gap

No sufficient evidence exists.

This classification should remain a stable CareerOS product concept.

---

# 34. Hidden Evidence Detection

Hidden Evidence requires comparison across three concepts:

Job Requirement

Career Brain Evidence

Selected Resume Representation

Conceptually:

Career Brain has evidence
+
Job requires evidence
+
Selected resume does not sufficiently represent evidence

=

Hidden / Underrepresented Evidence

This means hidden evidence cannot be correctly determined from only:

Resume + Job Description

The Career Brain is required.

---

# 35. Application Recommendation

A Job Analysis may include an application recommendation.

Possible values:

- strong_apply
- apply
- stretch
- low_priority

The recommendation should include:

- explanation,
- major strengths,
- major risks,
- important gaps.

It must not represent unsupported interview or offer probability.

---

# 36. Application Strategy

## Purpose

Represents CareerOS's recommended approach for preparing a specific application.

Conceptual fields:

- id
- job_id
- user_id
- job_analysis_id
- recommended_positioning
- recommended_base_resume_version_id
- summary
- created_at
- updated_at

Associated strategy items may include:

- prioritize evidence,
- de-emphasize evidence,
- surface hidden evidence,
- resume change recommendations,
- acknowledged gaps.

---

# 37. Application Strategy Item

Conceptually:

- id
- application_strategy_id
- type
- target_reference
- explanation
- evidence_references
- priority

Possible types:

- prioritize
- de_emphasize
- surface_hidden_evidence
- preserve
- remove
- address_gap
- other

---

# 38. Resume Recommendation

## Purpose

Represents a proposed change to a Resume Version for a target Job.

Conceptual fields:

- id
- application_strategy_id
- source_resume_version_id
- target_section
- target_content_reference
- action
- original_content
- suggested_content
- explanation
- evidence_references
- status

Possible actions:

- keep
- strengthen
- rewrite
- add
- remove
- de_emphasize

Possible statuses:

- pending
- accepted
- rejected
- edited

---

# 39. Resume Recommendation Grounding

A recommendation that introduces or materially changes a professional claim should reference supporting evidence.

Example:

Action:
Add

Suggested Content:
Kubernetes-related bullet

Evidence:
project_detail_42

If no evidence exists:

the recommendation must not introduce the professional claim.

Instead, the corresponding requirement should remain a gap.

---

# 40. Application

## Purpose

Represents the user's application to a specific Job.

Conceptual fields:

- id
- user_id
- job_id
- application_strategy_id
- resume_version_id
- status
- applied_at
- created_at
- updated_at

An Application may begin before submission with:

status = preparing

After confirmed submission:

status = applied

---

# 41. Application Status

Supported V1 conceptual statuses:

- preparing
- applied
- assessment
- interview
- final_round
- rejected
- offer
- withdrawn

Status history may become valuable later.

V1 may initially store current status plus relevant timestamps.

The architecture should avoid preventing future status history support.

---

# 42. Application Answer

## Purpose

Represents an answer used or entered during a specific application.

Conceptual fields:

- id
- application_id
- field_key
- question_text
- answer
- source
- confidence
- user_confirmed
- created_at

Possible sources:

- career_brain
- reusable_answer
- user_entered
- ai_suggested

Sensitive answers require special handling defined by security and architecture specifications.

---

# 43. Application Answer vs Reusable Answer

These concepts are different.

Application Answer:

> What was used for this particular application?

Reusable Application Answer:

> What has the user explicitly chosen to reuse across applications?

An application-specific answer should not automatically become a reusable answer.

User intent is required where reuse has consequences.

---

# 44. Application Memory

Application Memory is not necessarily one database entity.

It is the accumulated context created by:

Job

Job Analysis

Application Strategy

Resume Version Used

Application Answers

Application Status

Outcome

Together, these records allow CareerOS to understand what happened during an application.

---

# 45. Future Outcome Learning

Future CareerOS versions may use application history to identify patterns.

Conceptually:

Career Evidence
+
Job Characteristics
+
Application Strategy
+
Resume Used
+
Application Outcome

→

Personal Career Intelligence

Core V1 should preserve enough structured information to make this possible later.

V1 must not build speculative personalization systems before sufficient data exists.

---

# 46. Data Ownership and Isolation

All user Career Brain, resumes, jobs, applications, and related professional data belong to the corresponding user account context.

The physical architecture must enforce user-level data isolation.

A user must not access another user's private career or application data.

Detailed authorization design belongs in `ARCHITECTURE.md`.

---

# 47. Sensitive Data Principle

CareerOS handles career and application information that may be sensitive.

The model should minimize unnecessary storage of sensitive data.

Sensitive demographic answers should not be inferred.

Where sensitive application answers are stored:

- they must originate from explicit user action,
- access should be restricted,
- and storage should be justified by product need.

Detailed security requirements belong in architecture and implementation planning.

---

# 48. Deletion and Correction

Users should eventually be able to correct or remove their Career Brain information.

Corrections should affect future reasoning.

Historical application artifacts may preserve the content actually used at the time where necessary for application history.

The product should distinguish:

Current Career Truth

from:

Historical Application Snapshot

This distinction prevents later profile edits from rewriting the historical record of what was submitted.

---

# 49. Snapshot Principle

Certain application-related data should conceptually behave as historical snapshots.

Example:

User applies to Company A using Resume Version 4.

Later:

Career Brain changes.

Resume Version 6 is created.

The Company A Application should still reference Resume Version 4.

Historical application context should not silently mutate.

---

# 50. AI Versioning Principle

Important AI-generated analyses may change as prompts, models, and algorithms improve.

Where practical, important persisted AI outputs should support a version identifier.

Examples:

- job analysis version,
- matching version,
- resume recommendation version.

The exact versioning strategy belongs in AI and architecture specifications.

V1 should not require complex ML experiment infrastructure.

---

# 51. Conceptual Entity Relationships

A simplified relationship model is:

User
│
├── CareerBrain
│   ├── Education[]
│   ├── Experience[]
│   │   └── ExperienceDetail[]
│   ├── Project[]
│   │   └── ProjectDetail[]
│   ├── Skill[]
│   ├── Achievement[]
│   ├── Metric[]
│   ├── Certification[]
│   ├── ApplicationInformation
│   └── CareerPreference
│
├── Resume[]
│   └── ResumeVersion[]
│
├── Job[]
│   ├── JobRequirement[]
│   └── JobAnalysis[]
│       └── EvidenceMatch[]
│
└── Application[]
    ├── ApplicationStrategy
    │   ├── ApplicationStrategyItem[]
    │   └── ResumeRecommendation[]
    ├── ResumeVersion
    └── ApplicationAnswer[]

Career Evidence is a logical grounding layer referencing confirmed Career Brain entities and details.

---

# 52. Core Intelligence Relationship

The central CareerOS intelligence relationship is:

Career Evidence
×
Job Requirement
×
Resume Representation

This produces:

Strong Evidence

Hidden Evidence

Weak Evidence

Genuine Gap

That result informs:

Application Recommendation

and:

Application Strategy

which informs:

Resume Recommendations

and eventually:

Application Execution.

---

# 53. Example End-to-End Data Relationship

Example:

Career Brain

Experience:
RoundBlock

Experience Detail:
Deployed services using Kubernetes.

Skill:
Kubernetes

Evidence Reference:
experience_detail_123

↓

Job

Requirement:
Experience with Kubernetes

↓

Job Analysis

Evidence Match:

classification:
strong_evidence

evidence:
experience_detail_123

↓

Current Resume

Kubernetes experience not represented.

↓

Resume-Aware Classification

hidden_evidence

↓

Application Strategy

Surface Kubernetes experience.

↓

Resume Recommendation

Action:
Add

Evidence:
experience_detail_123

↓

User accepts

↓

Job-Specific Resume Version

↓

Application

resume_version:
job_specific_resume_7

This is the intended evidence chain.

---

# 54. Genuine Gap Example

Career Brain:

No confirmed GCP experience.

↓

Job Requirement:

Production experience with GCP.

↓

Evidence Search:

No sufficient evidence.

↓

Evidence Match:

genuine_gap

↓

Application Strategy:

Acknowledge GCP gap.

↓

Resume Recommendation:

Do not add GCP experience.

This behavior is mandatory.

---

# 55. V1 Modeling Boundaries

Core V1 does not require dedicated domain models for:

- interview coaching,
- recruiter relationships,
- networking,
- salary negotiation,
- job market analytics,
- country localization engines,
- long-term learning plans,
- social features,
- employer accounts.

Do not introduce these entities into the Core V1 model without an approved product requirement.

---

# 56. Implementation Guidance

When translating this logical model into a physical schema:

Prefer:

- simple relational structures,
- explicit foreign keys,
- clear ownership,
- typed enums where stable,
- JSON only where flexibility provides meaningful value.

Avoid:

- storing the entire Career Brain as one opaque JSON document,
- storing all AI output only as unstructured text,
- creating unnecessary tables for purely conceptual abstractions,
- premature graph infrastructure,
- premature vector database dependence.

Embedding or vector retrieval may later support evidence retrieval, but it does not replace the canonical relational Career Brain.

---

# 57. Model Review Questions

Before physical schema implementation, the engineering plan should verify:

1. Can one user maintain multiple resume variants without duplicating their entire career history?

2. Can CareerOS determine where a skill was actually used?

3. Can a Job Requirement reference supporting Career Evidence?

4. Can CareerOS distinguish hidden evidence from genuine gaps?

5. Can a resume recommendation explain what evidence supports it?

6. Can a job-specific resume preserve its relationship to the source resume and target job?

7. Can an application preserve the exact resume version used?

8. Can user corrections override AI extraction?

9. Can historical applications remain stable when the Career Brain later changes?

10. Can future personalization use application outcomes without redesigning the entire domain model?

If these questions cannot be answered cleanly, the physical schema should be reconsidered before implementation.

---

# 58. V1 Data Model Standard

The CareerOS data model should make the following statement technically true:

> CareerOS does not merely know what is written on my resume. It knows the professional evidence I have confirmed, understands where that evidence came from, knows which parts I chose to present for a particular opportunity, and remembers what I actually used when I applied.
