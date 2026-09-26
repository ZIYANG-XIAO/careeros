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
