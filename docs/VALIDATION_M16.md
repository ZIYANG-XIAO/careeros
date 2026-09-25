# M16 V1 Hardening and End-to-End Validation

> Status: Automated hardening passed; representative Chrome gate pending
> Validated: 2026-09-25

## Scope

This validation covers automated hardening for both V1 application paths,
authorization and data minimization, answer/form execution boundaries,
idempotent recovery, Application Memory accuracy, production builds, and prior
milestone regression. It does not claim live browser or live ATS validation.

## Automated results

- API: Ruff and mypy passed; 155 tests passed and 1 was skipped.
- Web: formatting, type checking, lint, production build, and 122 tests passed.
- Extension: formatting, type checking, production build validation, and 56
  tests passed.
- Extension scenario contracts cover both a CareerOS Job path and an
  independently found job path through detection, policy-approved fill,
  no-submit enforcement, explicit recording, and correct API routing.

## Hardening evidence

- The extension uses a server-owned assistant-context endpoint instead of
  downloading complete Application and Resume responses.
- Only one unambiguous owned Application candidate and Resume Version IDs/labels
  are returned; extracted resume text and structured content are excluded.
- The active URL is sent in a POST body rather than a query string.
- Duplicate exact URLs and multiple recent Preparing records fail closed.
- Concurrent create and status retries return one durable Application and the
  committed state.
- An unmatched external form is idempotently prepared when the user requests
  fill, allowing one recent Preparing record to recover after a redirect.
- Preparing failure does not block safe fill, manual submission, or Web manual
  recovery.
- Content scripts cannot request Application preparation/recording or receive
  API credentials, full resume content, or Application Memory.
- Unknown and sensitive decisions remain unfilled; only actually filled
  standard/non-sensitive values are eligible for explicit answer history.
- Build checks reject automatic submission APIs and unexpected permission
  expansion.
- Popup controls have visible keyboard focus, and dynamic states remain exposed
  as polite status updates.

## Representative browser gate

The user previously chose to defer unpacked-extension setup. M16 therefore
remains incomplete until both scenarios are run with a signed-in extension:

1. CareerOS Job → tracked Apply → external form → fill/review → user Submit →
   confirmation-page recovery → visible Application detail with exact resume.
2. Independently found job → external form → reviewed context → fill/review →
   user Submit → confirmation-page recovery → visible external Application.

For each scenario verify that CareerOS never clicks Submit, unresolved and
sensitive fields remain under user control, retries create no duplicate, and a
tracking failure still permits manual submission and Mark as applied.

## Known limitations

- Automatic file upload and broader custom widgets remain unimplemented.
- Recent redirect recovery intentionally fails closed when more than one
  Preparing candidate exists.
- Workday and universal ATS support are not V1 exit requirements.
- Production job acquisition remains a separate track.
