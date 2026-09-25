# M17 Localization and Market-Aware Jobs Validation

> Status: Automated validation passed
> Validated: 2026-09-25

## Scope

M17 establishes an independent Web locale and job-market foundation. It does
not add production job acquisition or claim complete localization of every
existing page.

## Verified behavior

- English/Simplified Chinese selection persists in browser storage and updates
  the document language.
- Shared navigation and the Jobs experience change language without changing
  the selected job market.
- North America groups United States and Canada while preserving their distinct
  country codes; China remains distinct.
- market, country, workplace, employment type, saved state, keyword, location,
  and sorting filters are executed by the authenticated API.
- manual capture and source adapters use the same canonical metadata.
- invalid market/country combinations are rejected and unknown remains unknown.
- existing jobs migrate safely to explicit `UNKNOWN` metadata.

## Automated results

- API formatting, lint, typing, and migration checks passed; 156 tests passed
  and 1 migration-isolation test was skipped.
- Web formatting, lint, typing, and production build passed; 124 tests passed.
- Extension formatting, typing, build validation, and 56 tests passed, confirming
  the expanded canonical Job response did not regress Apply Anywhere behavior.

## Intentional limitations

- Production job-source acquisition remains separate.
- Application, Resume, Profile, Job detail, and extension page-specific copy is
  still English; only the shared shell and Jobs surface are localized in M17.
- Locale preference is browser-local and not yet synced to the user account or
  extension.
- Salary, visa/sponsorship, education, experience level, company type, and
  funding filters are deferred until their source fields are trustworthy.
