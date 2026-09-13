# CareerOS — Product Definition

> Version: 0.2
> Status: Draft
> Last Updated: 2026-09-13

---

# 1. Product Vision

CareerOS is an AI-native job search operating system that understands a user's career, understands each opportunity, and helps the user prepare, execute, and improve every application.

The long-term vision is:

> Make job searching intelligent and effortless.

Job searching is fragmented across job discovery, company career sites, resumes, application forms, notes, and general-purpose tools. Candidates repeatedly interpret opportunities, compare requirements with their experience, modify resumes, enter the same information, track applications, and try to learn from outcomes.

CareerOS connects these activities into one intelligent system.

The long-term product loop is:

Discover
→ Understand
→ Decide
→ Tailor
→ Apply
→ Track
→ Learn

The product should become more useful as it understands more about the user's career, target opportunities, applications, and outcomes.

---

# 2. Product Promise

CareerOS is built around one promise:

> Understand my career. Understand the opportunity. Help me make the strongest truthful move.

Every major product decision should strengthen this promise.

---

# 3. Core Problem

The job search process has four connected problems.

## 3.1 Fragmentation

Candidates move between job discovery, company websites, resumes, documents, application systems, and tracking tools. Context is repeatedly lost between them.

## 3.2 Repetitive Work

Candidates repeatedly enter the same information, interpret similar job descriptions, modify similar resume content, answer recurring application questions, and maintain application records.

Much of this work adds little value.

## 3.3 Incomplete Understanding of the Candidate

A resume is a compressed presentation of a person's professional history. It is not the person's complete professional history.

Relevant experience may exist in previous roles, projects, achievements, coursework, or other resume versions without appearing in the resume currently being used.

CareerOS should reason about the candidate's broader career context.

## 3.4 Disconnected Intelligence and Execution

Understanding a job is useful. Improving a resume is useful. Completing an application is useful.

These activities become substantially more valuable when they share the same understanding of the user and the opportunity.

CareerOS should connect intelligence with execution.

---

# 4. Product Thesis

CareerOS is based on a simple thesis:

> The better a system understands both the candidate and the opportunity, the better it can assist the job search.

The product therefore combines:

## Career Intelligence

Understanding the user's education, experience, projects, skills, achievements, evidence, resumes, goals, preferences, and eventually application history and outcomes.

## Job Intelligence

Understanding the opportunity's role, responsibilities, qualifications, skills, seniority, location, constraints, and other relevant signals.

## Application Intelligence

Understanding whether an opportunity deserves attention, which evidence best supports the user, what is underrepresented, what gaps are genuine, and how the application should be positioned.

## Application Execution

Reducing repetitive application work while keeping the user in control.

## Application Learning

Preserving structured application context so future recommendations can improve.

---

# 5. Career Brain

The Career Brain is the persistent structured source of professional truth for the user.

It may include:

- personal and professional information,
- education,
- employment and internships,
- projects,
- skills and technologies,
- responsibilities,
- achievements and measurable outcomes,
- certifications,
- professional links,
- reusable application information,
- career goals and preferences,
- supporting evidence,
- career assets such as resume variants,
- and, over time, application context and outcomes.

The Career Brain should reduce repeated entry, prevent inconsistent professional information, and provide the evidence used by CareerOS intelligence.

AI-extracted information is not automatically professional truth. User confirmation and correction remain authoritative.

---

# 6. Career Brain Is Not Resume

This is a foundational product principle.

A Career Brain represents what the user has actually done and explicitly confirmed.

A resume represents what the user chooses to present for a particular purpose.

Therefore, one Career Brain may support many resume forms and versions, including general, role-specific, market-specific, and job-specific resumes.

A resume is a presentation artifact derived from selected Career Brain evidence. It is not the complete representation of the user and must not become the sole source of professional truth.

This distinction allows CareerOS to discover relevant evidence that may not appear in the current resume while preserving the original context of that evidence.

---

# 7. Evidence-Based Intelligence

CareerOS must distinguish between different relationships between job requirements and the user's career evidence.

## Strong Evidence

Clear supporting career evidence exists for the requirement.

## Hidden / Underrepresented Evidence

Relevant evidence exists in the Career Brain but is missing or insufficiently represented in the selected resume.

## Weak Evidence

Related evidence exists, but the connection to the requirement is indirect, incomplete, or uncertain.

## Genuine Gap

No sufficient supporting evidence exists.

CareerOS must never convert a Genuine Gap into a fabricated professional claim.

AI-generated professional content must remain grounded in user-provided or user-confirmed evidence. Where practical, important conclusions and generated claims should be traceable to supporting evidence.

CareerOS must never fabricate employers, roles, dates, responsibilities, projects, skills, technologies, achievements, metrics, education, certifications, seniority, ownership, production context, or other professional facts.

When evidence is insufficient, CareerOS should communicate uncertainty or preserve the gap.

---

# 8. Five Core Capabilities

CareerOS Core is organized around five connected capabilities.

## 8.1 Career Brain

Answers:

> Who is this candidate?

Maintains the structured professional source of truth and its supporting evidence.

## 8.2 Job Intelligence

Answers:

> What is this opportunity, and how does it relate to this candidate?

Understands the job and compares its requirements with the Career Brain.

## 8.3 Application Intelligence

Answers:

> How should this candidate approach this specific application?

Determines positioning, evidence selection, resume strategy, genuine gaps, and recommended changes.

## 8.4 Application Assistant

Answers:

> How can CareerOS reduce the repetitive work required to complete this application?

Connects CareerOS intelligence to the real application workflow while keeping important information reviewable.

## 8.5 Application Memory

Answers:

> What happened during this application, and what can be learned from it?

Preserves the job, strategy, resume used, application state, and eventual outcome context.

Together, these capabilities form a continuous product loop rather than a collection of disconnected features.

---

# 9. Core Experience

The intended core experience is:

User establishes Career Brain
→ User encounters a job
→ CareerOS understands the opportunity
→ CareerOS compares requirements with career evidence
→ CareerOS explains fit, evidence, uncertainty, and gaps
→ User decides whether to apply
→ CareerOS recommends an application strategy
→ CareerOS prepares a truthful tailored application
→ CareerOS assists with repetitive application work
→ User reviews consequential information
→ User submits the application
→ CareerOS preserves the application context
→ The system can eventually learn from outcomes

The user should establish career context once and reuse it throughout future applications.

---

# 10. Job Intelligence

CareerOS should go beyond shallow keyword matching.

Job Intelligence should help the user understand:

- what the job actually requires,
- which requirements are required or preferred,
- which career evidence supports the user's fit,
- which useful evidence is missing from the current resume,
- which apparent matches are weak,
- which gaps are genuine,
- and whether the opportunity deserves attention.

A match score, if used, is a summary signal rather than the product itself. It must not be presented as interview or offer probability.

The explanation and evidence behind a recommendation are more important than the number.

---

# 11. Application Intelligence

Application Intelligence translates understanding into a specific strategy for a specific opportunity.

It may recommend:

- truthful candidate positioning,
- the strongest base resume,
- experiences and evidence to prioritize,
- content to de-emphasize,
- hidden evidence to surface,
- content to preserve,
- resume changes to consider,
- and genuine gaps that must not be fabricated.

Intelligence must come before generation.

The desired sequence is:

Understand Candidate
→ Understand Job
→ Retrieve Evidence
→ Evaluate Evidence
→ Determine Strategy
→ Select Evidence
→ Generate

Generation may select, organize, summarize, rewrite, and emphasize professional truth. It cannot create professional truth.

---

# 12. Application Assistant

CareerOS should exist where job searching and applications actually happen.

The Application Assistant connects intelligence to execution by progressively reducing repetitive application work.

Its long-term direction includes:

- job-page detection,
- structured field understanding,
- retrieval of confirmed information,
- reusable answers,
- resume selection,
- resume upload assistance,
- and supported autofill.

The product should prefer deterministic mappings for known information and use AI only where interpretation is required.

Reliability and user trust are more important than claiming universal automation.

Consequential, legal, demographic, compensation, work authorization, sponsorship, signature, and other sensitive information must never be guessed.

Final submission remains an intentional user action unless a future approved requirement explicitly changes this principle.

---

# 13. Application Memory and Learning

Each application can produce useful structured context, including:

- the target job,
- company and role,
- application date,
- job analysis,
- application strategy,
- resume version used,
- relevant evidence used,
- application answers where appropriate,
- status,
- and eventual outcomes.

Application Memory should preserve what actually happened at the time of application. Later Career Brain or resume changes must not silently rewrite historical application context.

Over time, real application history may help CareerOS understand which opportunities, positioning, evidence, and resume choices produce stronger outcomes.

Personalization must be earned from real information and outcomes rather than simulated through generic AI language.

---

# 14. Product Principles

## Evidence Before Generation

Professional claims must be grounded in user evidence.

## Intelligence Before Automation

Understand what should happen before automating it.

## Intelligence and Execution

Insights should connect naturally to real job-search actions.

## User Control

Important career decisions, resume changes, consequential answers, and final submission remain transparent and reviewable.

## One Source of Truth

The Career Brain should minimize repeated entry and inconsistent professional information.

## Progressive Automation

Suggest
→ Assist
→ Automate
→ Learn

## Explainability Over Arbitrary Scores

Recommendations should explain their reasoning and evidence.

## Preserve Originals and History

AI should not destructively overwrite original resumes or historical application context.

## Fail Clearly

When CareerOS cannot detect, understand, or support something reliably, it should communicate the limitation and preserve a reasonable fallback.

## Quality Over Feature Count

One reliable workflow is more valuable than many shallow features.

## Extensible, Not Overbuilt

Preserve reasonable future extension points without prematurely building future products or infrastructure.

---

# 15. Core Scope Direction

The first complete CareerOS core product should establish the main loop rather than stopping at resume analysis.

The core direction includes:

- Career Brain,
- resume management,
- Job Intelligence,
- evidence-based matching,
- Application Intelligence,
- evidence-grounded resume tailoring,
- browser integration,
- Application Assistant,
- initial autofill capabilities,
- and basic Application Memory.

These capabilities do not need to be implemented simultaneously. Detailed V1 requirements, boundaries, acceptance criteria, and sequencing belong in the PRD and roadmap.

The roadmap is not automatic current implementation scope.

---

# 16. What CareerOS Is Not

CareerOS is not:

## A Generic Resume Writer

Resume generation is one downstream output of a broader intelligence system.

## Keyword Stuffing Software

Unsupported claims must not be introduced simply to improve apparent matching.

## A Resume-Only Product

Resume intelligence is a capability within the broader product loop, not the entire product.

## Blind Mass Apply

The goal is not to maximize application count regardless of relevance, quality, or user intent.

## Autonomous Submission Software

Consequential information and final application submission remain under user control.

## A Collection of Disconnected AI Features

New capabilities should strengthen the shared Career Brain and job-search loop.

---

# 17. Future Direction

After the CareerOS core workflow is established, the product may expand through three broader layers.

## Localization

Adapt career presentation and application intelligence to different recruiting markets rather than merely translating text.

## Personalization

Learn from user preferences, behavior, applications, resume choices, and real outcomes.

## Broader Career Intelligence

Use accumulated career, opportunity, and outcome context to help users understand role fit, opportunity priorities, recurring gaps, career positioning, and potential next moves.

These are future strategic directions, not automatic current implementation requirements. They should build on the Career Brain and Application Memory rather than becoming disconnected products.

---

# 18. Product Success

CareerOS should not measure early success by feature count.

The first meaningful test is whether a real user can:

- establish their real career context,
- encounter a real job,
- receive useful and explainable analysis,
- identify relevant evidence they may have overlooked,
- distinguish weak evidence from genuine gaps,
- prepare a stronger truthful application,
- reduce repetitive application work,
- retain control of consequential actions,
- and preserve useful application context.

The product should feel like one connected workflow, not a series of isolated AI text interactions.

Long-term success means CareerOS becomes a persistent part of the user's job-search workflow and becomes more useful as it learns from the user's career and application history.

---

# 19. North Star

CareerOS should continuously move toward one promise:

> Understand my career. Understand the opportunity. Help me make the strongest truthful move.

The product should:

Know Me
→ Understand Jobs
→ Help Me Apply Better
→ Learn

Every major capability should strengthen this loop while preserving truth, evidence, user control, and product coherence.
