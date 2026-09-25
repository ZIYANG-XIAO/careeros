# CareerOS M12 Answer Engine Contract

> Status: Implemented foundation
> Last Updated: 2026-09-25

## 1. Purpose and boundary

The Answer Engine is an authenticated backend product service that converts a
bounded normalized form-field request into policy decisions. It is reusable by
the extension and future approved surfaces.

M12 decides; it does not execute. It does not read current form values, change a
page, upload a file, persist an Application or answer, or submit a form.

```text
Normalized field/question
→ deterministic safety classification
→ deterministic key or narrow semantic classification
→ owned source retrieval
→ answer policy
→ Fill / Suggest / Ask / Confirm / Unknown decision
```

## 2. API contract

`POST /answer-engine/resolve` accepts at most 200 unique fields and an optional
selected Resume Version ID. Each field includes only its inspection-local ID,
canonical key when known, bounded question text, control type, required state,
mapping confidence, and bounded option labels.

Every response decision includes:

- field ID and effective canonical key;
- question category;
- proposed answer or null;
- source category and owned source reference;
- action;
- policy category, confidence, and sensitivity;
- review state; and
- reusable-answer eligibility and explicit-save requirement.

The selected Resume Version is validated against the authenticated owner. AI or
page-supplied identifiers never authorize resource access.

## 3. Current approved sources

M12 retrieves only sources that exist in the current canonical model:

- authenticated identity email;
- education fields when exactly one Education record makes the choice
  unambiguous;
- company and title when exactly one Experience is explicitly current; and
- the filename/reference for an explicitly selected, owned Resume Version.

Names, phone, address, professional links, cover letters, preferences, reusable
answers, and Application context remain unknown until their approved canonical
source exists. The engine does not derive names from email, select among
ambiguous records, treat a project URL as a portfolio, or generate a cover
letter.

## 4. Action and review policy

- `FILL`: high-confidence deterministic mapping and an approved source. M12
  returns the decision but does not fill the page.
- `SUGGEST`: a source exists but the mapping requires review, including semantic
  classification.
- `ASK`: required information is absent or explicit user input is required.
- `CONFIRM`: reserved for an approved explicit source that still requires
  consequential confirmation.
- `UNKNOWN`: optional, unsupported, or unresolved information remains blank.

Every decision has an explicit review state. Confidence never overrides source,
ownership, sensitivity, or reuse policy.

## 5. Sensitive and consequential policy

Deterministic rules run before semantic classification for demographic,
disability, veteran, work-authorization, sponsorship, compensation, government
ID, legal-attestation, and signature questions. Current M12 sources do not store
approved answers for these categories, so the engine returns `ASK`, requires
user input, prohibits reusable storage, and never infers a value.

These rules override page-provided canonical hints. Semantic classification is
never asked to classify sensitive, consequential, file, or unsupported fields.

## 6. Semantic classification

Semantic classification is optional and receives only unresolved normalized
field labels, control types, and option labels. It never receives Career Brain
answers. It may return only approved non-file canonical keys and may not claim
high confidence.

Returned IDs and enums are validated against the request. A provider error,
extra/missing ID, prohibited key, or invalid confidence safely falls back to the
normal unknown/ask policy without exposing private content in logs.

## 7. Reuse and persistence

M12 creates no answer table and persists no decision. A normal custom question
may report `ELIGIBLE_WITH_EXPLICIT_CONSENT`, but `save_intent_required` remains
true. This is a proposal for a future user action, not permission to save.

Sensitive/consequential answers are `PROHIBITED`. Known Career Brain, identity,
and Resume sources are `NOT_APPLICABLE` because they remain canonical domain
data rather than duplicate reusable-answer records.

## 8. Extension boundary

Only the privileged background service worker calls the Answer Engine with a
short-lived authenticated token. The popup receives decisions and renders
aggregate ready/input/unresolved counts without displaying answer values. The
content script and external page receive no token, Career Brain data, or answer
decision in M12.

M13 implements user-triggered page execution and visible per-field review state
without weakening these decisions. Resume/file upload remains manual, and final
Submit remains a user action. See `docs/FORM_EXECUTION.md`.

M14 may separately store ordered application-specific answer history only when
the client explicitly submits user-confirmed `STANDARD` / non-sensitive answers
while creating an Application. It does not automatically persist transient M12
decisions or turn those answers into reusable records.
