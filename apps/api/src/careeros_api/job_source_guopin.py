"""Field mapping for the guopin (国聘) upstream partner job source.

The source is not approved for production ingestion yet — see
`docs/JOB_SOURCE_DECISION.md`. `map_row` below is implemented against two real
sample rows the user's collaborator provided on 2026-09-28, so the field
mapping itself is real. What remains open is governance and a few data
questions, tracked here rather than guessed:

- **legal/terms** — guopin (国聘) is a Chinese state-owned-enterprise
  recruitment platform; whether this collaborator's access to it permits
  CareerOS to store, display, and link to it is unconfirmed. This blocks real
  ingestion regardless of code readiness.
- **field names may still change** — this mapping is built against the
  collaborator's raw crawled JSON (`job_id`, `job_name`, `contents`, …). He
  described a separate pipeline (raw → an intermediate parsed table → a final
  table) and the final table's column names are not yet known. Re-verify this
  mapping against the final table's actual schema before relying on it; do not
  assume the field names below carry over unchanged.
- **`job_id` stability** — assumed stable across re-crawls of the same
  posting (deduplication depends on this); not yet confirmed over more than
  one crawl.
- **`start_time`/`end_time` timezone** — unlike `crawl_time`, these carry no
  UTC offset. Once confirmed (likely Beijing time, matching `crawl_time`),
  `availability_status`/`freshness_status` could be derived from `end_time` vs.
  now instead of staying `UNKNOWN`.
- **`job_nature`** confirmed by the user: "社招" (experienced-hire recruiting)
  and "校招" (campus recruiting for new graduates) are both full-time
  positions in the China market — they differ in candidate seniority, not
  employment type, and that distinction lives in `is_graduates`, which the
  canonical contract does not carry. Any other `job_nature` value (e.g. an
  unconfirmed "实习"/internship channel) stays `UNKNOWN` rather than guessed.
- **no workplace_type signal** in the sample rows; left `UNKNOWN`.
- **`job_address`/`company_address` are lists**; only the first non-blank
  entry is used as `location` today. Ask whether multiple entries mean
  multiple job locations or just formatting.
- **no explicit removal signal** — only `end_time`. Ask whether closed
  postings are dropped from the export or flagged.
- salary, education, experience, major, industry, and tags fields in the
  sample are real and useful but intentionally outside the canonical Job
  contract today (see `docs/JOB_DATA_CONTRACT.md`); nothing here stores them.

Row loading and the file-based adapter live in
`careeros_api.job_source_file_adapter` — they are not guopin-specific, and a
second source should reuse them rather than copy this file. Only the mapping
below (and any future guopin-specific helper) belongs here.
"""

from __future__ import annotations

from datetime import datetime

from careeros_api.job_source_file_adapter import SourceRow
from careeros_api.job_sources import NormalizedJobCandidate
from careeros_api.models import JobCountry, JobEmploymentType, JobMarket

GUOPIN_SOURCE_KEY = "guopin"

# Confirmed by the user: both recruiting channels are full-time positions in
# the China market. They differ in candidate seniority (社招 = experienced,
# 校招 = fresh graduate), which `is_graduates` already carries — that is a
# separate axis from employment_type, not part of the canonical contract.
# Any other job_nature (e.g. an unconfirmed internship channel) stays UNKNOWN.
_EMPLOYMENT_TYPE_BY_JOB_NATURE: dict[str, JobEmploymentType] = {
    "社招": JobEmploymentType.FULL_TIME,
    "校招": JobEmploymentType.FULL_TIME,
}


def _first_nonblank(values: object) -> str | None:
    """Return the first non-blank string in a list-shaped field, or None."""

    if not isinstance(values, list):
        return None
    for value in values:
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def _employment_type(job_nature: object) -> JobEmploymentType:
    if isinstance(job_nature, str):
        return _EMPLOYMENT_TYPE_BY_JOB_NATURE.get(job_nature.strip(), JobEmploymentType.UNKNOWN)
    return JobEmploymentType.UNKNOWN


def map_row(row: SourceRow) -> NormalizedJobCandidate:
    """Map one guopin row to the canonical candidate contract.

    `market`/`country_code` are hardcoded to China rather than parsed from
    address text, on the assumption that this entire source is China-only
    (guopin is a Chinese platform; both sample rows are Beijing postings at
    state-owned companies). Confirm that assumption before real ingestion —
    if guopin ever carries non-China postings, this needs a real per-row rule
    instead.
    """

    application_url = row.get("apply_url") or None
    return NormalizedJobCandidate(
        external_job_id=str(row["job_id"]),
        company=str(row["company_name"]),
        title=str(row["job_name"]),
        description=str(row["contents"]),
        location=_first_nonblank(row.get("job_address"))
        or _first_nonblank(row.get("company_address")),
        application_url=application_url,
        observed_at=datetime.fromisoformat(str(row["crawl_time"])),
        market=JobMarket.CHINA,
        country_code=JobCountry.CN,
        employment_type=_employment_type(row.get("job_nature")),
    )
