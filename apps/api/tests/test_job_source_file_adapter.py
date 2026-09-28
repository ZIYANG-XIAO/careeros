"""Generic file-based job source loading: row loading, limits, and error
reporting. Source-specific field mapping lives in each source's own test file
(e.g. `test_job_source_guopin.py`), not here — this covers only the reusable
machinery every file-export-based source builds on.
"""

import json
from pathlib import Path

import pytest

from careeros_api.job_source_file_adapter import (
    FileJobSourceAdapter,
    SourceRowError,
    load_rows,
)
from careeros_api.job_sources import NormalizedJobCandidate


def sample_row(identifier: str = "row-1") -> dict[str, object]:
    return {"id": identifier, "note": "generic fixture row, not tied to any source"}


def fixture_mapper(row: dict[str, object]) -> NormalizedJobCandidate:
    """A minimal, source-agnostic mapper used only to exercise the adapter."""

    return NormalizedJobCandidate(
        external_job_id=str(row["id"]),
        company="Example Corp",
        title="Example Role",
        description="A description that is definitely long enough to pass validation.",
    )


def test_load_rows_reads_a_json_array(tmp_path: Path) -> None:
    path = tmp_path / "export.json"
    path.write_text(json.dumps([sample_row("a"), sample_row("b")]), encoding="utf-8")

    rows = load_rows(path)

    assert [row["id"] for row in rows] == ["a", "b"]


def test_load_rows_reads_jsonl_and_skips_blank_lines(tmp_path: Path) -> None:
    path = tmp_path / "export.jsonl"
    path.write_text(
        f"{json.dumps(sample_row('a'))}\n\n{json.dumps(sample_row('b'))}\n",
        encoding="utf-8",
    )

    rows = load_rows(path)

    assert [row["id"] for row in rows] == ["a", "b"]


def test_load_rows_applies_the_limit(tmp_path: Path) -> None:
    path = tmp_path / "export.jsonl"
    path.write_text(
        "\n".join(json.dumps(sample_row(str(index))) for index in range(10)),
        encoding="utf-8",
    )

    rows = load_rows(path, limit=3)

    assert len(rows) == 3


def test_load_rows_rejects_a_non_object_entry(tmp_path: Path) -> None:
    path = tmp_path / "export.json"
    path.write_text(json.dumps([sample_row(), "not an object"]), encoding="utf-8")

    with pytest.raises(SourceRowError, match="entry 1"):
        load_rows(path)


def test_load_rows_rejects_an_empty_file(tmp_path: Path) -> None:
    path = tmp_path / "export.json"
    path.write_text("   ", encoding="utf-8")

    with pytest.raises(SourceRowError, match="empty"):
        load_rows(path)


def test_load_rows_rejects_a_bad_limit(tmp_path: Path) -> None:
    path = tmp_path / "export.json"
    path.write_text(json.dumps([sample_row()]), encoding="utf-8")

    with pytest.raises(SourceRowError, match="limit"):
        load_rows(path, limit=0)


@pytest.mark.asyncio
async def test_adapter_maps_rows_with_the_supplied_mapper_and_source_key() -> None:
    adapter = FileJobSourceAdapter(
        [sample_row("a"), sample_row("b")],
        source_key="demo-source",
        mapper=fixture_mapper,
    )

    candidates = await adapter.fetch_candidates()

    assert adapter.source_key == "demo-source"
    assert [candidate.external_job_id for candidate in candidates] == ["a", "b"]


def test_adapter_reports_the_row_index_that_failed_to_map() -> None:
    bad_row: dict[str, object] = {"note": "missing the id field"}
    adapter = FileJobSourceAdapter(
        [sample_row("a"), bad_row],
        source_key="demo-source",
        mapper=fixture_mapper,
    )

    with pytest.raises(SourceRowError, match="row 1"):
        adapter.map_all()
