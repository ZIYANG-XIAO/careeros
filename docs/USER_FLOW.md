# CareerOS Core V1 — User Flow

> Version: 0.1
> Status: Draft
> Last Updated: 2026-09-13
> Product: CareerOS

---

# 1. Purpose

This document defines how a user experiences CareerOS Core V1 from first entry through completion of a real job application.

The product should feel like one connected workflow rather than a collection of independent AI tools.

The primary experience is:

Discover CareerOS
→ Establish Career Brain
→ Encounter Job
→ Understand Opportunity
→ Decide Whether to Apply
→ Prepare Application
→ Tailor Resume
→ Complete Application
→ Record Application
→ Return With Context Preserved

The primary V1 UX goal is:

> The user should establish their career context once and reuse that context throughout future applications.

---

# 2. Product Surfaces

CareerOS Core V1 has two primary user surfaces.

## 2.1 Web Application

The web application is the user's CareerOS command center.

Primary responsibilities:

- onboarding,
- Career Brain management,
- Resume Library,
- detailed Job Intelligence,
- Application Intelligence,
- resume tailoring,
- Jobs,
- Application History,
- settings.

Conceptual navigation:

CareerOS
├── Dashboard
├── Jobs
├── Applications
├── Resumes
└── Career Profile

Exact visual design is not defined by this document.

---

## 2.2 Browser Extension

The browser extension is the contextual assistant that connects CareerOS to the user's real job-search workflow.

Primary responsibilities:

- detect job pages,
- capture job context,
- show quick intelligence,
- launch detailed analysis,
- initiate application preparation,
- assist supported application forms,
- autofill supported fields.

The extension should remain focused.

Complex editing and detailed analysis belong in the web application.

---

# 3. Core Experience Principle

CareerOS should avoid repeatedly asking:

> Tell me about yourself.

Once the Career Brain has been established, the default interaction should become:

> I already understand your confirmed career context. Let me understand this opportunity.

This principle should be visible throughout the product.

---

# 4. First-Time User Journey

The first-time experience should minimize setup friction while creating enough structured career context to deliver meaningful intelligence.

Primary flow:

Landing
→ Create Account
→ Upload Resume
→ Resume Parsing
→ Career Brain Draft
→ Review
→ Confirm
→ First Career Brain Ready
→ Analyze First Job

The user should receive useful value before being asked to manually complete every possible profile field.

---

# 5. Entry / Landing

The landing experience should communicate the core product value clearly.

The user should understand that CareerOS helps with more than resume writing.

The primary product promise is:

> Understand my career. Understand the opportunity. Help me make the strongest truthful move.

A first-time user should understand the basic flow:

Build Career Brain
→ Analyze Jobs
→ Prepare Applications
→ Apply Faster

Primary action:

Get Started

Secondary actions may include sign-in for returning users.

---

# 6. Account Creation

The user creates an account using the supported authentication method defined later by architecture.

After successful account creation, the user enters onboarding.

The user should not initially be presented with a large empty dashboard.

The product should guide them toward establishing the Career Brain.

---

# 7. Resume-First Onboarding

## 7.1 Upload Resume

Primary screen:

Build Your Career Brain

Supporting message:

> Start with your existing resume. CareerOS will turn it into a structured career profile that you can review and improve.

Primary action:

Upload Resume

The supported file types will be defined during implementation planning.

---

## 7.2 Parsing State

After upload, CareerOS parses the resume.

The user should receive visible progress rather than an unexplained loading state.

Conceptual steps may include:

Reading Resume
→ Extracting Experience
→ Extracting Education
→ Extracting Skills
→ Building Career Brain

These labels represent UX states and do not require separate technical processing stages.

---

## 7.3 Parsing Failure

If the resume cannot be parsed reliably:

- explain that parsing failed,
- preserve the uploaded file where appropriate,
- allow retry,
- allow another file,
- provide a manual fallback where practical.

Do not silently create a low-quality Career Brain and present it as accurate.

---

# 8. Career Brain Review

After parsing, the user sees a structured Career Brain draft.

The goal is confirmation, not re-entering the entire resume.

Conceptual layout:

Career Brain Draft

Personal Information
[Review]

Education
[Review]

Experience
[Review]

Projects
[Review]

Skills
[Review]

Application Information
[Complete Later]

---

## 8.1 Extracted Information States

Information should conceptually support states such as:

- extracted / unconfirmed,
- confirmed,
- user-edited,
- user-added.

The exact implementation is defined later.

The user must understand which information CareerOS is relying on.

---

## 8.2 Editing

The user can:

- edit incorrect fields,
- remove incorrect information,
- add missing information,
- confirm correct information.

The interaction should favor structured editing over forcing the user to rewrite resume text.

---

# 9. Career Brain Enrichment

After basic confirmation, CareerOS should introduce the idea that the Career Brain can contain more than the current resume.

Example message:

> Your resume is only part of your career history. Add relevant experience that may help with future opportunities.

The user may add:

- additional technologies,
- omitted projects,
- responsibilities,
- achievements,
- metrics,
- skills,
- other professional evidence.

This step should be optional during onboarding.

The user should be able to continue without building a perfect Career Brain.

Career Brain enrichment should remain available later.

---

# 10. First Value Transition

Once the minimum Career Brain is confirmed, CareerOS should transition quickly to job analysis.

Conceptual success state:

Your Career Brain is ready.

CareerOS can now compare opportunities against your actual experience.

Primary actions:

Analyze a Job
Install Browser Extension

The user should not be forced to configure every future feature before receiving value.

---

# 11. Returning User Dashboard

A returning user enters the CareerOS Dashboard.

The dashboard should focus on job-search progress and next actions rather than generic analytics.

Potential information includes:

- recent jobs,
- applications in progress,
- recent applications,
- resumes,
- Career Brain completeness,
- relevant next actions.

Primary actions may include:

Analyze Job
View Applications
Manage Career Profile
Manage Resumes

Advanced analytics are not required for V1.

---

# 12. Job Entry Paths

CareerOS supports two job entry paths.

## Primary Path

Browser Extension

## Fallback Path

Manual Job Entry

Both paths should produce the same underlying Job concept and enter the same Job Intelligence workflow.

---

# 13. Browser Job Detection Flow

The user browses jobs normally on the web.

When CareerOS detects a supported job page:

Job Page
→ Extension Detects Job
→ Job Context Captured
→ Quick CareerOS View Available

The user should not need to manually paste the JD in the normal supported flow.

---

# 14. Extension Job States

The extension should clearly distinguish between several states.

## 14.1 Job Detected

CareerOS successfully identifies the job.

Show relevant context such as:

- company,
- role,
- location where available.

Primary action:

Analyze with CareerOS

---

## 14.2 Job Already Analyzed

If the job already exists for the user:

show existing analysis rather than unnecessarily creating a duplicate.

Possible actions:

View Analysis
Prepare Application
Open in CareerOS

---

## 14.3 Job Not Detected

If the extension cannot reliably identify a job:

communicate this clearly.

Possible fallback:

Enter Job Manually

The extension should not pretend a page was successfully parsed when confidence is poor.

---

# 15. Extension Quick Intelligence

After analysis, the extension may show a compact summary.

Example:

Backend Engineer
Company

Strong Fit

Strong Evidence
Java
Kafka
Data Infrastructure

Hidden Evidence
Kubernetes

Main Gap
GCP

Recommendation
Strong Apply

Primary actions:

View Full Analysis
Prepare Application

The extension should not attempt to display the entire analysis.

---

# 16. Manual Job Entry

From the web application, the user can choose:

Analyze Job

Minimum input:

- job title,
- company,
- job description.

Optional:

- job URL,
- location.

After submission, the job enters the same Job Intelligence flow used by extension-captured jobs.

Manual jobs should not receive a lower-quality intelligence experience merely because they were entered manually.

---

# 17. Job Analysis Loading State

Job analysis may require multiple operations.

The user should receive meaningful progress.

Conceptual states may include:

Understanding Job
→ Finding Relevant Career Evidence
→ Evaluating Fit
→ Preparing Analysis

The interface should not expose unnecessary implementation details.

---

# 18. Full Job Intelligence Experience

The detailed Job page lives primarily in the web application.

Conceptual sections:

Overview
Requirements
Your Match
Evidence
Gaps
Recommendation
Prepare Application

The goal is to answer:

> What does this job require?

> How does my actual background relate to it?

> What am I not showing?

> What am I genuinely missing?

> Is this opportunity worth my time?

---

# 19. Job Overview

The overview should summarize available job context:

- company,
- role,
- location,
- seniority,
- job URL,
- major responsibilities,
- core requirements,
- preferred requirements.

The user should be able to inspect the original job description.

---

# 20. Match Experience

CareerOS should organize the candidate's relationship to job requirements into understandable evidence categories.

## Strong Evidence

Requirements clearly supported by Career Brain evidence.

## Hidden / Underrepresented Evidence

Relevant evidence exists but is not sufficiently represented in the selected/current resume.

## Weak Evidence

Related experience exists, but support is indirect or incomplete.

## Genuine Gaps

No sufficient evidence exists.

The UI should emphasize explanation rather than only a score.

---

# 21. Evidence Drill-Down

When the user selects an important match conclusion, CareerOS should show why.

Example:

Kafka
Strong Evidence

Found in:

Experience
Company A
Messaging Platform

Relevant evidence:
[career evidence]

The goal is for users to trust and verify CareerOS reasoning.

---

# 22. Application Recommendation

The Job page should provide an explainable recommendation.

Potential categories:

Strong Apply
Apply
Stretch
Low Priority

Example:

Strong Apply

Why:
- strong backend alignment,
- strong Java and Kafka evidence,
- relevant infrastructure experience.

Main Risk:
- no direct GCP evidence.

The recommendation should never claim an unsupported exact probability of interview or offer success.

---

# 23. Decision Point

The user can choose:

Prepare Application

or:

Save / Leave Job

The product should not pressure users into applying to every analyzed job.

The purpose of Job Intelligence is partly to help users avoid wasting effort on low-value opportunities.

---

# 24. Prepare Application Flow

When the user chooses Prepare Application:

Job Intelligence
→ Application Intelligence
→ Application Strategy
→ Resume Strategy
→ Resume Tailoring

This is the transition from:

Should I apply?

to:

How should I apply?

---

# 25. Application Strategy

CareerOS generates a job-specific strategy.

Conceptual structure:

Recommended Positioning

Recommended Base Resume

Prioritize

De-emphasize

Hidden Evidence to Surface

Genuine Gaps

Recommended Resume Changes

Example:

Recommended Positioning
Backend / Infrastructure Engineer

Base Resume
Backend Resume

Prioritize
- platform engineering experience,
- Java,
- Kafka,
- distributed systems evidence.

Surface
- Kubernetes experience currently absent from resume.

De-emphasize
- unrelated AI prompting project.

Real Gap
- GCP.

Do not add unsupported GCP experience.

---

# 26. Base Resume Selection

If the user has multiple resumes, CareerOS may recommend the strongest starting point.

Example:

Recommended:
Backend Resume V3

Reason:
Contains the highest concentration of relevant backend and infrastructure evidence.

The user may choose a different resume.

CareerOS should not lock the user into its recommendation.

---

# 27. Resume Tailoring Workspace

The user enters a resume tailoring experience.

The interface should make changes understandable and reviewable.

A recommendation may include:

Original Content

Suggested Action

Suggested Content

Reason

Supporting Evidence

Available actions:

Accept
Reject
Edit

---

# 28. Resume Recommendation Example

Example:

Experience:
Company A

Bullet 2

Action:
Strengthen

Reason:
The current bullet underrepresents infrastructure relevance required by this job.

Evidence:
Career Brain → Company A → Platform Project

Original:
Built internal data processing services.

Suggested:
[generated evidence-grounded revision]

The generated revision must not introduce unsupported facts.

---

# 29. Hidden Evidence Flow

If CareerOS finds relevant Career Brain evidence absent from the current resume:

Hidden Evidence

Kubernetes

Found in:
Project / Experience X

Why it matters:
The target job explicitly values container orchestration experience.

Recommendation:
Add relevant evidence to the resume.

The user may:

Add
Ignore
Edit Before Adding

This should be a recognizable CareerOS experience.

---

# 30. Genuine Gap Flow

When no evidence exists:

Genuine Gap

GCP

CareerOS found no confirmed experience supporting this requirement.

The product may explain the relevance of the gap.

It must not offer to fabricate experience.

Potential actions:

Continue Anyway
Acknowledge Gap

Future learning recommendations are outside the Core V1 requirement.

---

# 31. Resume Review

Before creating the final job-specific resume, the user should be able to review all accepted changes.

The user should understand:

- what changed,
- why it changed,
- what evidence supports important changes.

Original resume content must remain preserved.

---

# 32. Save Job-Specific Resume

After review:

Save as Job-Specific Resume

The resulting resume should be associated with:

- the target job,
- source/base resume,
- relevant application context.

Example conceptual name:

Backend Engineer — Company — 2026-09-13

The exact naming scheme is implementation detail.

---

# 33. Transition to Application

Once application preparation is complete, CareerOS should make the next action obvious.

Primary action:

Continue to Application

If an application URL is known, CareerOS may direct the user there.

The browser extension can then assist on the supported application form.

---

# 34. Application Form Detection

When the user reaches a supported application form:

Application Page
→ Extension Detects Form
→ CareerOS Determines Supported Fields
→ Autofill Available

The user should receive a clear indication that CareerOS can assist.

Primary action:

Autofill Application

---

# 35. Autofill Flow

The conceptual autofill flow is:

Detect Fields
→ Classify Fields
→ Retrieve Confirmed Answers
→ Evaluate Confidence
→ Fill Supported Fields
→ Flag Uncertain Fields
→ User Reviews

The user should not need to repeatedly type information already confirmed in the Career Brain.

---

# 36. Autofill Result States

Fields may conceptually have states such as:

Filled

Needs Review

Needs Answer

Unsupported

CareerOS should not hide uncertainty.

---

# 37. Known Field Example

Question:

First Name

Career Brain:
First Name = Alex

Result:

Filled

No AI reasoning is necessary for simple deterministic mappings.

---

# 38. Reusable Application Answer Example

Question:

Will you now or in the future require sponsorship?

If the user has explicitly confirmed an answer in Career Brain:

CareerOS may reuse it.

If no confirmed answer exists:

CareerOS should ask the user.

It must not infer the answer from nationality, education, location, resume history, or other indirect information.

---

# 39. Unknown Field Flow

If CareerOS encounters a field it cannot answer reliably:

Do not guess.

Show:

Needs Answer

The user provides the answer.

Where appropriate and with user control, CareerOS may allow the answer to be saved for future reuse.

The exact save behavior will be defined later.

---

# 40. Sensitive Field Flow

Sensitive or consequential fields require additional caution.

Examples:

- demographic information,
- disability,
- veteran status,
- legal attestations,
- salary expectations,
- signatures,
- work authorization,
- sponsorship.

CareerOS must not infer these values.

If an explicitly saved user answer exists and V1 supports reuse for that field, it may be offered or populated according to the approved design.

Otherwise:

Ask User / Leave Unfilled.

---

# 41. Resume Upload During Application

If the application form requires a resume and the workflow is supported:

CareerOS should recommend the job-specific resume created for the application.

Example:

Recommended Resume

Company — Backend Engineer

[Use This Resume]

The user should be able to choose another resume.

---

# 42. Application Review

Before submission, CareerOS should encourage review.

Conceptual state:

Application Ready for Review

Filled:
18 fields

Needs Review:
2 fields

Needs Answer:
1 field

The user resolves outstanding items.

CareerOS should not create the impression that the application is guaranteed correct merely because autofill completed.

---

# 43. Final Submission

CareerOS Core V1 does not automatically submit applications.

The user performs the final submission intentionally.

This boundary should remain clear in the UX.

---

# 44. Post-Submission Flow

After the user submits:

CareerOS should allow the application to be recorded.

Where reliable detection is possible, CareerOS may recognize a submission confirmation state.

A fallback manual action must exist:

Mark as Applied

The product should not depend entirely on automatic submission detection.

---

# 45. Application Record Creation

The application record should associate:

Job

Company

Role

Application Date

Job URL where available

Resume Used

Application Strategy reference where available

Status

Initial status:

Applied

If the user began preparation but has not submitted, the application may remain:

Preparing

---

# 46. Application History

The user can open:

Applications

and see recorded applications.

A simple V1 representation may include:

Company
Role
Applied Date
Resume
Status

Example:

Company A
Backend Engineer
Sep 13, 2026
Backend_CompanyA
Applied

---

# 47. Application Detail

Selecting an application should allow the user to review relevant context.

Potential information:

Job

Application Date

Status

Resume Used

Job Analysis

Application Strategy

The V1 page does not require advanced analytics.

---

# 48. Status Updates

Users should be able to manually update status.

Supported V1 statuses:

Preparing
Applied
Assessment / OA
Interview
Final Round
Rejected
Offer
Withdrawn

Example:

Applied
→ OA
→ Interview
→ Final Round
→ Offer

These outcomes create the foundation for future learning.

---

# 49. Returning to an Existing Job

If the user later revisits a previously analyzed job:

CareerOS should recognize existing context where possible.

The user should be able to resume from the appropriate state.

Examples:

Analyzed
→ Continue Preparation

Preparing
→ Continue Resume

Applied
→ View Application

Avoid unnecessary duplicate jobs and applications.

---

# 50. Career Brain Updates During Use

CareerOS should allow the Career Brain to improve over time.

Example:

During resume preparation, the user realizes a technology or achievement is missing.

The user should be able to add or correct that information.

Once confirmed, the new information becomes eligible evidence for future analysis.

CareerOS should not require the user to restart the workflow.

---

# 51. Resume Library Flow

The Resumes area should allow users to view:

Master / Primary Resume

Uploaded Resume Variants

Generated Job-Specific Resumes

The user should be able to understand which resume was used for which application.

Career Brain remains separate from Resume Library.

---

# 52. Jobs Area

The Jobs area should contain jobs the user has captured or analyzed.

Potential states:

Captured

Analyzed

Preparing

Applied

The Jobs area is not intended to become a full job marketplace in V1.

---

# 53. Empty States

Empty states should guide users toward useful actions.

Examples:

No Career Brain
→ Upload Resume

No Jobs
→ Analyze Your First Job

No Applications
→ Prepare Your First Application

No Resume Variants
→ Upload or Create Resume

Avoid empty dashboards that do not explain what to do next.

---

# 54. Error and Recovery Principles

CareerOS should provide recovery paths for common failures.

Examples:

Resume parsing failure
→ Retry / upload another resume / manual fallback

Job detection failure
→ Manual job entry

Job analysis failure
→ Retry without losing captured job

AI generation failure
→ Retry without destroying original resume

Autofill unsupported
→ Preserve manual application workflow

Submission detection failure
→ Mark as Applied manually

A failure in one automation layer should not block the entire product when a reasonable fallback exists.

---

# 55. User Trust Principles

The UX should continuously reinforce several trust rules.

CareerOS should clearly distinguish between:

Known User Information

AI Interpretation

AI Recommendation

Missing Information

Uncertainty

Users should never need to guess whether CareerOS is presenting a confirmed fact or an AI judgment.

---

# 56. AI Corrections

When the user corrects AI-generated or AI-extracted information:

the correction should take precedence.

Examples:

Incorrect resume parsing
→ user correction becomes authoritative.

Incorrect skill classification
→ user correction should be preserved where appropriate.

CareerOS should not repeatedly reintroduce known corrected errors.

Detailed persistence behavior belongs in the data and AI specifications.

---

# 57. Progressive Automation

CareerOS V1 should follow:

Suggest
→ Assist
→ Automate
→ Learn

Examples:

Resume:

Suggest Change
→ User Reviews
→ User Accepts

Application:

Suggest Answer / Retrieve Confirmed Answer
→ Autofill
→ User Reviews
→ User Submits

CareerOS should earn user trust before increasing automation.

---

# 58. V1 Golden Path — Detailed

The primary end-to-end V1 journey is:

1. User creates CareerOS account.
2. User uploads existing resume.
3. CareerOS parses resume.
4. CareerOS creates Career Brain draft.
5. User reviews extracted information.
6. User corrects errors.
7. User confirms Career Brain.
8. User optionally adds experience not present on the resume.
9. User installs or opens CareerOS browser extension.
10. User browses to a supported real job.
11. Extension detects job.
12. User selects Analyze.
13. CareerOS structures job requirements.
14. CareerOS retrieves relevant Career Brain evidence.
15. CareerOS classifies strong evidence.
16. CareerOS identifies hidden evidence.
17. CareerOS identifies weak evidence.
18. CareerOS identifies genuine gaps.
19. CareerOS provides application recommendation.
20. User selects Prepare Application.
21. CareerOS recommends positioning.
22. CareerOS recommends base resume.
23. CareerOS recommends evidence-grounded resume changes.
24. User reviews recommendations.
25. User accepts, rejects, and/or edits changes.
26. CareerOS creates job-specific resume.
27. User continues to application.
28. Extension detects supported application form.
29. User selects Autofill.
30. CareerOS fills supported known fields.
31. CareerOS flags uncertain or unsupported fields.
32. User completes missing information.
33. User reviews application.
34. User manually submits application.
35. CareerOS records or allows user to mark the application as Applied.
36. User sees the application in Application History.
37. User can later update application status.

This flow is the primary V1 UX acceptance path.

---

# 59. V1 Experience Test

Before V1 is considered ready, the team should perform the Golden Path with representative real-world inputs.

At minimum:

- one real user Career Brain,
- one real resume,
- multiple real technical jobs,
- at least one job with strong fit,
- at least one job with hidden evidence,
- at least one job with genuine gaps,
- supported real application forms.

The test should answer:

Did CareerOS understand the user?

Did CareerOS understand the job?

Did CareerOS explain the relationship correctly?

Did CareerOS surface useful hidden evidence?

Did CareerOS avoid fabricating gaps into strengths?

Did the resume recommendations materially improve the application?

Did the extension reduce context switching?

Did autofill reduce repetitive work?

Could the user recover when automation failed?

Did the user remain in control?

---

# 60. V1 Experience Standard

The CareerOS Core V1 experience should feel like:

> CareerOS already knows my professional background, understands the job I am looking at, helps me decide whether it deserves my time, prepares the strongest truthful version of my application, reduces repetitive application work, and remembers what I did.

It should not feel like:

> I pasted my resume and job description into another AI text box.
