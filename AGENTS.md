# CareerOS — Agent Instructions

## 1. Purpose

This repository contains CareerOS, an AI-native job search operating system.

Product decisions are defined in the repository documentation. Coding agents are responsible for implementing approved specifications, not inventing product requirements.

Before making meaningful changes, read the relevant project documentation.

---

## 2. Source of Truth

The `/docs` directory is the product and engineering source of truth.

Documents include:

- `docs/PRODUCT.md` — product vision and principles
- `docs/PRD.md` — V1 requirements and scope
- `docs/USER_FLOW.md` — user experience and workflows
- `docs/DATA_MODEL.md` — domain model
- `docs/AI_SPEC.md` — AI behavior and evidence rules
- `docs/ARCHITECTURE.md` — technical architecture
- `docs/ROADMAP.md` — future direction

When documentation conflicts with assumptions, follow the documentation.

When documents appear to conflict with each other, do not silently choose one interpretation. Surface the conflict before implementation.

Do not invent missing product requirements.

---

## 3. Core Product Model

CareerOS is built around five connected capabilities:

1. Career Brain
2. Job Intelligence
3. Application Intelligence
4. Application Assistant
5. Application Memory

These capabilities form a loop:

Career Brain
→ Understand Job
→ Decide
→ Prepare Application
→ Assist Application
→ Record Outcome
→ Learn

---

## 4. Career Brain Is Not a Resume

This is a foundational rule.

The Career Brain represents the user's structured professional truth.

The Career Profile is the user-facing UI surface used to manage Career Brain data.

The Career Brain may contain:

- education,
- work experience,
- projects,
- skills,
- technologies,
- achievements,
- metrics,
- certifications,
- professional links,
- preferences,
- work authorization information,
- and supporting evidence.

A resume is a presentation artifact derived from a subset of this information.

Do not design the system as if a resume were the complete representation of the user.

---

## 5. Evidence-Based AI

CareerOS must never fabricate professional information.

AI-generated recommendations and application content must be grounded in user-provided or user-approved evidence.

Never invent:

- employers,
- experience,
- responsibilities,
- projects,
- skills,
- technologies,
- achievements,
- metrics,
- education,
- certifications,
- or professional claims.

The system should distinguish between:

- strong evidence,
- hidden or underrepresented evidence,
- weak evidence,
- and genuine gaps.

When evidence is insufficient, communicate uncertainty rather than inventing information.

Where practical, AI recommendations should be traceable to supporting evidence.

---

## 6. Intelligence Before Generation

Do not reduce CareerOS to:

Resume + Job Description → LLM → Rewritten Resume

The intended reasoning flow is:

Understand User
→ Understand Job
→ Compare Requirements with Evidence
→ Determine Application Strategy
→ Select Relevant Evidence
→ Generate or Modify Application Materials

Generation is downstream of understanding and evidence retrieval.

---

## 7. Intelligence + Execution

CareerOS is not only a resume analysis tool.

The core product is intended to connect intelligence with the actual application workflow.

The product should eventually support:

Career Brain
→ Job Intelligence
→ Application Intelligence
→ Browser Integration
→ Application Assistance
→ Autofill
→ User Review
→ Application Memory

However, implementation must follow approved milestones.

Do not implement future capabilities merely because they appear in the product vision.

---

## 8. User Control

CareerOS assists users with consequential career decisions and application information.

Important actions should remain transparent.

Sensitive, legal, demographic, work authorization, compensation, signature, and submission-related information must not be guessed.

Automation should follow the principle:

Suggest
→ Assist
→ Automate
→ Learn

Do not introduce automatic final submission unless explicitly specified in an approved requirement.

---

## 9. Engineering Discipline

Work milestone by milestone.

Do not attempt to implement the entire product in one pass.

For each milestone:

1. Read the relevant specifications.
2. Understand the requested scope.
3. Identify ambiguity before coding.
4. Propose an implementation plan when requested.
5. Implement only the approved scope.
6. Add or update tests.
7. Verify acceptance criteria.
8. Summarize changes and remaining issues.

Avoid unnecessary abstractions and premature infrastructure.

Preserve reasonable extension points without over-engineering future features.

---

## 10. Scope Discipline

The roadmap is not the current implementation scope.

Future ideas may include:

- broader ATS support,
- deeper browser automation,
- localization,
- country-specific recruiting intelligence,
- personalization,
- outcome learning,
- interview intelligence,
- market intelligence,
- and broader career intelligence.

Do not implement roadmap features unless they are explicitly included in the current approved milestone.

---

## 11. Product Quality

A feature is not complete merely because the UI renders or an API returns successfully.

Evaluate:

- product usefulness,
- correctness,
- evidence grounding,
- AI output quality,
- user experience,
- failure behavior,
- maintainability,
- and test coverage.

Prefer a small workflow that works reliably over many shallow features.

---

## 12. Working Rule

When uncertain:

Do not guess.
Do not silently expand scope.
Do not fabricate requirements.

Explain the ambiguity and ask for a decision.
