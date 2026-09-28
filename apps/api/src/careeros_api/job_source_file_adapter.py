"""Generic row loading for file-export-based job sources.

CareerOS will take job data from more than one source over time (see
`docs/JOB_SOURCE_DECISION.md`'s one-source-at-a-time process). Any source that
hands rows over as a JSON array or JSONL file — an export or a crawl dump,
rather than a live API — can reuse this instead of reimplementing loading,
limiting, and error reporting. A source that isn't file-based (a REST API, for
example) should implement `careeros_api.job_sources.JobSourceAdapter` directly
instead; nothing here assumes a particular source's field names or business
rules — those belong in that source's own `job_source_<name>.py` (see
`careeros_api.job_source_guopin` for the current example), which supplies its
own row-mapping function to `FileJobSourceAdapter`.
"""

from __future__ import annotations

import json
from collections.abc import Callable, Mapping, Sequence
from pathlib import Path
from typing import Any

from careeros_api.job_sources import NormalizedJobCandidate

SourceRow = Mapping[str, Any]
RowMapper = Callable[[SourceRow], NormalizedJobCandidate]


class SourceRowError(ValueError):
    """Raised when a source row cannot be read or mapped."""


def load_rows(path: Path, *, limit: int | None = None) -> list[SourceRow]:
    """Read source rows from a JSON array file or a JSONL file."""

    if limit is not None and limit < 1:
        raise SourceRowError("limit must be at least 1")

    text = path.read_text(encoding="utf-8").strip()
    if not text:
        raise SourceRowError(f"{path} is empty")

    rows: list[SourceRow] = []
    if path.suffix == ".jsonl":
        for number, line in enumerate(text.splitlines(), start=1):
            stripped = line.strip()
            if not stripped:
                continue
            try:
                parsed = json.loads(stripped)
            except json.JSONDecodeError as error:
                raise SourceRowError(f"{path} line {number} is not valid JSON") from error
            if not isinstance(parsed, dict):
                raise SourceRowError(f"{path} line {number} is not a JSON object")
            rows.append(parsed)
            if limit is not None and len(rows) >= limit:
                break
        return rows

    try:
        document = json.loads(text)
    except json.JSONDecodeError as error:
        raise SourceRowError(f"{path} is not valid JSON") from error
    if not isinstance(document, list):
        raise SourceRowError(f"{path} must contain a JSON array of objects")
    for index, entry in enumerate(document):
        if not isinstance(entry, dict):
            raise SourceRowError(f"{path} entry {index} is not a JSON object")
        rows.append(entry)
        if limit is not None and len(rows) >= limit:
            break
    return rows


class FileJobSourceAdapter:
    """Emit candidates from already-loaded rows using a caller-supplied mapper.

    Both `source_key` and `mapper` are required and explicit — there is no
    hidden per-source default here. The CLI (or whatever calls this) picks the
    right source key and mapping function for whichever source it is running,
    which is what keeps this class usable across more than one source.
    """

    def __init__(
        self,
        rows: Sequence[SourceRow],
        *,
        source_key: str,
        mapper: RowMapper,
    ) -> None:
        self.source_key = source_key
        self._rows = tuple(rows)
        self._mapper = mapper

    def map_all(self) -> tuple[NormalizedJobCandidate, ...]:
        """Map every row, reporting the row index that failed."""

        candidates: list[NormalizedJobCandidate] = []
        for index, row in enumerate(self._rows):
            try:
                candidates.append(self._mapper(row))
            except Exception as error:
                raise SourceRowError(f"row {index} could not be mapped: {error}") from error
        return tuple(candidates)

    async def fetch_candidates(self) -> Sequence[NormalizedJobCandidate]:
        return self.map_all()
