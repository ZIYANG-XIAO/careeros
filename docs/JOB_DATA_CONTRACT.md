# CareerOS Canonical Job Data Contract

> Status: M17 implemented foundation
> Updated: 2026-09-25

External acquisition remains a separate project or adapter, but every source
must deliver provider-specific records through `NormalizedJobCandidate`. CareerOS
owns validation, deduplication, storage, and user-facing filtering.

## Required source fields

- `company`
- `title`
- `description` (at least 20 characters)
- one stable identity: `external_job_id` or `canonical_url`
- timezone-aware `observed_at`

## Optional normalized fields

- `location`
- `source_url`
- `application_url`
- `availability_status`: `UNKNOWN`, `AVAILABLE`, or `UNAVAILABLE`
- `freshness_status`: `UNKNOWN`, `CURRENT`, or `STALE`
- `market`: `UNKNOWN`, `NORTH_AMERICA`, or `CHINA`
- `country_code`: `UNKNOWN`, `US`, `CA`, or `CN`
- `workplace_type`: `UNKNOWN`, `REMOTE`, `HYBRID`, or `ONSITE`
- `employment_type`: `UNKNOWN`, `FULL_TIME`, `PART_TIME`, `CONTRACT`, or
  `INTERNSHIP`

## Consistency rules

- `NORTH_AMERICA` may use `US`, `CA`, or an unknown country.
- `CHINA` may use `CN` or an unknown country.
- A known country must have a matching known market.
- Missing or ambiguous values remain `UNKNOWN`; they are never guessed from
  language, company name, or free-text location.
- UI locale is not job-market metadata. An English-language China job remains a
  China-market job, and a Chinese-language Canada job remains a North America job.
- Source retries use stable source identity; description changes create a new
  immutable snapshot rather than a duplicate canonical Job.

Salary period/currency, sponsorship, education, experience level, company type,
and funding stage are intentionally absent until actual source requirements and
normalization rules are approved.
