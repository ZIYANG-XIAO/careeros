# M15 Applications and Cross-Surface Integration Validation

> Status: Automated validation passed; representative browser check deferred
> Validated: 2026-09-25

## Scope

This validation covers the Applications Web surface, CareerOS Job preparation
handoff, external-page context matching, explicit submission recording, manual
recovery, exact Resume Version behavior, approved answer retention, ownership,
and retry safety. It does not claim representative live-site compatibility.

## Automated verification

Final repository checks:

- API: Ruff and mypy passed; 151 tests passed and 1 was skipped.
- Web: formatting, type checking, lint, production build, and 122 tests passed.
- Extension: formatting, type checking, production build validation, and 51
  tests passed.
- Repository diff whitespace validation passed.

- Applications list/detail show role, company, source, status, applied date,
  exact Resume Version, and retained standard answer history.
- Users can filter and update statuses through owner-scoped APIs.
- Job detail creates `PREPARING` Application Memory before presenting the
  tracked external continuation link.
- A tracking failure leaves a direct external link and manual recovery path.
- Manual **Mark as applied** creates external Application Memory with reviewed
  context and an optional exact Resume Version.
- The extension matches normalized exact URLs and treats one recent Preparing
  record only as a user-confirmed redirect fallback.
- Unmatched external pages require reviewed company/role and never guess a
  Resume Version.
- Only actually filled, standard, non-sensitive approved answers are eligible
  for retained history.
- Submission recording preserves later statuses, prevents Resume Version
  replacement, and is idempotent across retries.
- Application and resume references remain owner-scoped.
- Application API credentials and recording operations remain background-only;
  the content bundle contains no recording operation or submission API.
- Build validation continues to reject any automatic form submission API.

## Representative browser status

The user previously chose to defer unpacked-extension setup. M12–M15
representative Chrome validation therefore remains unexecuted and is not
reported as passed.

When resumed, validate both required scenarios with an authenticated extension:
a CareerOS Job exact/recent handoff and an independently found job with reviewed
manual context. Confirm that only the user submits, one Application is recorded,
the exact selected resume is visible, and a failed match can recover manually.

## Known limitations

- Automatic resume/file upload and broader custom widgets remain unimplemented.
- External company and role suggestions come from untrusted tab metadata and
  require user review.
- Redirect recovery intentionally supports only one recent Preparing candidate;
  ambiguous candidates fall back to a new reviewed external record.
- Production job acquisition and representative live-site hardening remain M16
  work.
