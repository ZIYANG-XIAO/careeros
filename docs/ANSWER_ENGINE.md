# CareerOS M12 Answer Engine Contract

> Status: Implemented foundation
> Last Updated: 2026-09-26

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
- confirmed `UserContactInfo` when `confirmed_at` is set;
- education fields when exactly one Education record makes the choice
  unambiguous;
- company and title when exactly one Experience is explicitly current; and
- the filename/reference for an explicitly selected, owned Resume Version.

### Deterministic contact-info mappings

When `UserContactInfo` is confirmed, these canonical keys map directly:

| Canonical key | Source field | Source category |
|---|---|---|
| `PERSON_FIRST_NAME` | Latin-script `first_name` | `USER_CONTACT_INFO` |
| `PERSON_LAST_NAME` | Latin-script `last_name` | `USER_CONTACT_INFO` |
| `PERSON_LATIN_FULL_NAME` | `first_name` + `last_name` | `USER_CONTACT_INFO` |
| `PERSON_NATIVE_GIVEN_NAME` | `given_name_native` | `USER_CONTACT_INFO` |
| `PERSON_NATIVE_FAMILY_NAME` | `family_name_native` | `USER_CONTACT_INFO` |
| `PERSON_NATIVE_FULL_NAME` | exact `full_name_native`, or confirmed native parts | `USER_CONTACT_INFO` |
| `PERSON_FULL_NAME` | market/locale-selected confirmed representation | `USER_CONTACT_INFO` |
| `CONTACT_EMAIL` | `contact_email`, then authenticated email | `USER_CONTACT_INFO` or `IDENTITY` |
| `CONTACT_PHONE` | `phone` | `USER_CONTACT_INFO` |
| `CONTACT_WECHAT` | `wechat_id` | `USER_CONTACT_INFO` |
| `ADDRESS_LINE_1` | `address_line_1` | `USER_CONTACT_INFO` |
| `ADDRESS_LINE_2` | `address_line_2` | `USER_CONTACT_INFO` |
| `ADDRESS_CITY` | `city` | `USER_CONTACT_INFO` |
| `ADDRESS_DISTRICT` | `district` | `USER_CONTACT_INFO` |
| `ADDRESS_REGION` | `region` | `USER_CONTACT_INFO` |
| `ADDRESS_POSTAL_CODE` | `postal_code` | `USER_CONTACT_INFO` |
| `ADDRESS_COUNTRY` | `country_code` | `USER_CONTACT_INFO` |
| `PROFESSIONAL_LINKEDIN_URL` | `linkedin_url` | `USER_CONTACT_INFO` |
| `PROFESSIONAL_GITHUB_URL` | `github_url` | `USER_CONTACT_INFO` |
| `PROFESSIONAL_PORTFOLIO_URL` | `portfolio_url` | `USER_CONTACT_INFO` |

The engine does not transliterate names, derive names from email, select among ambiguous records,
treat a project URL as a portfolio, or generate a cover letter. Unconfirmed
contact info, preferences, reusable answers, and Application context remain
unknown until their approved domains exist.

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
contact-info, and Resume sources are `NOT_APPLICABLE` because they remain
canonical domain data rather than duplicate reusable-answer records.

## 8. Extension boundary

Only the privileged background service worker calls the Answer Engine with a
short-lived authenticated token. The popup and in-page assistant receive
decisions and render aggregate ready/input/unresolved counts without displaying
answer values before user-triggered execution. The content script and external
page receive no token, Career Brain data, or answer decision in M12.

M13 implements user-triggered page execution and visible per-field review state
without weakening these decisions. Resume/file upload remains manual, and final
Submit remains a user action. See `docs/FORM_EXECUTION.md`.

M14 may separately store ordered application-specific answer history only when
the client explicitly submits user-confirmed `STANDARD` / non-sensitive answers
while creating an Application. It does not automatically persist transient M12
decisions or turn those answers into reusable records.

M15 extension recording retains only standard/non-sensitive values that
CareerOS actually filled, and only after the user explicitly confirms that they
submitted the application. Suggested, unknown, sensitive, or merely inspected
fields are not retained.
