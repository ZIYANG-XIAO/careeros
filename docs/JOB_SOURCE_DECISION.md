# CareerOS — Job Source Decision Note

> Status: Approved decision process
> Last Updated: 2026-09-26

## Purpose

CareerOS does not yet have production job-data acquisition. Before implementing
a real external source, approve one source at a time using the criteria below.
This note does not authorize ingestion by itself and does not invent credentials,
contracts, or provider relationships.

## Decision principle

Validate one source end-to-end before adding another. Each source must pass
through the existing provider-neutral boundary:

```text
External Job Source
→ Source Adapter
→ Normalized Job Candidate
→ Deduplication
→ Freshness evaluation
→ Canonical Job
```

Do not build a generic plugin framework or mass scraper as part of source
selection.

## Evaluation criteria

Review each candidate source against:

1. **Legal and terms permission** — explicit right to store, display, and link to
   application destinations; no assumed scraping rights.
2. **Source quality** — structured fields, stable company/role/title data, and
   usable descriptions.
3. **Freshness** — update cadence, stale-job handling, and removal signals.
4. **Market priority** — whether initial coverage should favor North America,
   China, or one market first; keep UI locale independent from job market.
5. **Stable identifiers** — external job IDs or canonical URLs suitable for
   deduplication.
6. **Application URLs** — reliable direct-apply or ATS destination links.
7. **Update and removal behavior** — how closed or changed jobs are represented.
8. **Cost** — licensing, API fees, and operational overhead.
9. **Localization** — language and location metadata quality for approved
   markets.
10. **Rate limits and reliability** — quotas, retries, and failure modes.
11. **Provider isolation** — source-specific schema stays inside an adapter; the
    canonical Job model remains unchanged.

## Source-type constraints (high level)

Each source type has different constraints. Do not treat them as interchangeable.

| Source type | Typical constraints |
|---|---|
| LinkedIn | restrictive terms, limited redistribution, identity/login coupling |
| Indeed / Glassdoor | partner/API terms, licensing, field restrictions |
| Company career pages | heterogeneous HTML, uneven structure, permission varies by site |
| ATS provider APIs | narrower scope, often company-specific, better structure |

No source should be assumed available until permission, contract or terms review,
and a technical spike are complete.

## Recommended process

1. Choose one candidate source and one initial market.
2. Document permission/terms outcome and known field coverage.
3. Implement a narrow adapter that emits the existing normalized candidate
   contract.
4. Ingest into non-production or limited demo data first.
5. Validate deduplication, freshness, Apply links, and Jobs UI behavior.
6. Only then consider a second source.

## Explicit non-goals for source selection

- do not invent API keys, contracts, or scraping rights;
- do not claim a live feed until a source is approved and operating;
- do not couple the Web UI to a provider schema;
- do not prioritize breadth over one reliable source; and
- do not bypass the canonical Job boundary.

## Current state

Production job acquisition is **not implemented**. Jobs today come from manual
entry and seed/demo/test ingestion through the existing source boundary. The next
engineering step after V1 browser validation is to complete this decision
process for one approved source, not to integrate many sources at once.

The first candidate source is **guopin (国聘)**, a Chinese state-owned-enterprise
recruitment platform, via a collaborator with access to it. The field mapping is
implemented against two real sample rows the collaborator provided on
2026-09-28, so plumbing is no longer the blocker — this decision process is:

- `apps/api/src/careeros_api/job_source_guopin.py` maps a guopin row to
  `NormalizedJobCandidate`. `market`/`country_code` are hardcoded to China, on
  the unconfirmed assumption that the whole source is China-only.
- `apps/api/src/careeros_api/job_source_file_adapter.py` is the reusable,
  source-agnostic part (JSON/JSONL row loading, limits, error reporting) — not
  guopin-specific, and shared with whatever file-export-based source comes
  next; CareerOS expects more than one job source over time.
- `scripts/ingest_jobs.py` resolves one owning user, reports the worst-case
  job-parser call count, and ingests. `--dry-run` maps and validates rows
  without PostgreSQL or an OpenAI key, and already works against real sample
  rows. It is currently wired to guopin's mapper specifically; a second source
  needs a `--source` flag added there to pick between mappers.

Against the evaluation criteria above, still unconfirmed for guopin:

1. **Legal and terms permission** — not reviewed. Blocks real ingestion
   regardless of code readiness.
2. **Stable identifiers** — `job_id` is assumed stable across re-crawls of the
   same posting (deduplication depends on this); not yet confirmed over more
   than one crawl.
3. **Freshness** — `start_time`/`end_time` are given but without a UTC offset
   (unlike `crawl_time`, which has one); timezone unconfirmed, so
   `availability_status`/`freshness_status` stay `UNKNOWN` rather than derived
   from them. No explicit removal signal exists beyond `end_time`.
4. **Market priority** — China, by inspection of the two samples (Beijing,
   state-owned employers, Chinese-language postings). Not yet confirmed that
   the source carries no other market.
5. **Employment/workplace type** — confirmed: `job_nature` "社招" (experienced
   hire) and "校招" (campus/new-graduate) both map to `FULL_TIME`; candidate
   seniority is a separate axis (`is_graduates`) the canonical contract does
   not carry. Any other `job_nature` value stays `UNKNOWN`. No workplace-type
   signal exists in the sample rows, so it stays `UNKNOWN`.

Rich fields the sample rows carry but the canonical Job contract intentionally
excludes today — salary, education, experience, major, industry, tags — are not
touched by the mapping; see `docs/JOB_DATA_CONTRACT.md`.

The skeleton can validate and map real rows in `--dry-run`, but does not itself
authorize the source — item 1 above is a separate approval this document does
not grant.
