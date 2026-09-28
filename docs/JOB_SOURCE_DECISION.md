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

Jobs come from three places: the user's own manual entries and extension clips
(private), and a **shared catalog** synced from approved public sources. The
catalog (Phase T) is jobs with no owner, visible to every user; saves,
analyses, and applications stay per user. See `docs/DATA_MODEL.md` section 11.

## Source record: Greenhouse public Job Board API — North America pilot

**Status: implemented and run locally; production use awaits owner sign-off
on item 1 below.**

- **What**: `GET https://boards-api.greenhouse.io/v1/boards/{token}/jobs?content=true`,
  the endpoint Greenhouse provides for employers to embed their open postings
  on their own career sites. No authentication, no scraping of HTML pages.
- **Code**: `careeros_api/job_source_greenhouse.py` (mapping and fetch) on
  top of the shared `careeros_api/job_source_boards.py`,
  `apps/api/job_sources/greenhouse_north_america.json` (seed of 52 employers
  whose boards were verified to exist on 2026-09-28), and
  `scripts/sync_job_sources.py` (daily sync CLI, `--dry-run` supported).
- **Evaluation**:
  1. *Legal and terms* — the endpoint is publicly documented for career-site
     embedding and requires no key. We display title, company, location, the
     description, and always link back to the employer's own posting for
     applying. **Owner/legal must still confirm Greenhouse's and each
     employer's terms allow this reuse before a public launch.**
  2. *Source quality* — structured title, location, offices, HTML description.
  3. *Freshness* — each sync re-reads every board; a posting that disappears
     from a successfully fetched board is marked `UNAVAILABLE`/`STALE`. A failed
     fetch never closes anything.
  4. *Market* — North America only: a posting is kept only when its own
     location (or, failing that, its office names) explicitly names a US/Canada
     place. Pieces naming a place elsewhere are ignored, so "Berlin, DE" is not
     read as Delaware. Ambiguous "Remote" is skipped.
  5. *Stable identifiers* — `external_job_id = "{board}:{greenhouse id}"`, and
     the canonicalized posting URL; both unique within the catalog.
  6. *Application URLs* — the employer's own `absolute_url`.
  7. *Removal behavior* — see 3.
  8. *Cost* — no fees; one request per board per day with a 1 s pause between
     boards. Requirement extraction is deferred to first use and shared, so a
     sync makes no AI calls (first local run: 7,135 postings, ~2.5 minutes).
  9. *Localization* — English postings; UI locale remains independent.
  10. *Rate limits/reliability* — per-board failures are isolated and reported;
      the CLI exits non-zero if any board failed.
  11. *Provider isolation* — Greenhouse fields never leave the adapter.
- **Schedule**: run daily, for example
  `15 6 * * * cd /path/to/careeros && .venv/bin/python scripts/sync_job_sources.py`,
  or as a long-running process with `--every-hours 24`.

## Source record: Lever public Postings API — North America

**Status: implemented and run locally (owner approved 2026-09-28); public
launch shares the terms sign-off noted for Greenhouse.**

- **What**: `GET https://api.lever.co/v0/postings/{site}?mode=json`, Lever's
  public endpoint for employer career sites. No key.
- **Code**: `careeros_api/job_source_lever.py`,
  `apps/api/job_sources/lever_north_america.json` (7 employers verified on
  2026-09-28; boards that returned 404 or had no postings were left out).
- **Differences from Greenhouse**: each posting carries an ISO `country`, which
  decides placement (the text rule runs only when it is missing);
  `workplaceType` and `categories.commitment` map to workplace and employment
  type; the description is Lever's intro, headed lists, and closing section
  combined. Postings link to `hostedUrl` and apply via `applyUrl`.
- **First local sync**: 617 North American postings.

## Source record: Ashby public Job Posting API — North America

**Status: implemented and run locally (owner approved 2026-09-28); public
launch shares the terms sign-off noted for Greenhouse.**

- **What**: `GET https://api.ashbyhq.com/posting-api/job-board/{board}`,
  Ashby's public endpoint for employer career sites. No key.
- **Code**: `careeros_api/job_source_ashby.py`,
  `apps/api/job_sources/ashby_north_america.json` (27 employers verified on
  2026-09-28).
- **Differences**: placement is decided per location — the structured postal
  address country when present, otherwise the conservative text rule on that
  location's label — across the primary and secondary locations; the displayed
  location lists all of them. `employmentType` and `workplaceType` (or
  `isRemote`) map directly. Postings with `isListed: false` are treated as
  absent, so a sync closes them.
- **First local sync**: 2,441 North American postings.

The three sources use separate `source_key`s, so closing postings for one
source's board never touches another source's jobs.

## China-market sources

On hold by owner decision (2026-09-28): China-market sources will be adapted
later. `scripts/ingest_jobs.py --catalog [--close-missing]` can already load a
file-export source into the shared catalog without parser cost when one is
approved.

## Earlier candidate: guopin (国聘)

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
