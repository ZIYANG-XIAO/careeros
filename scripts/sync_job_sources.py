#!/usr/bin/env python3
"""Sync approved public job sources into the shared CareerOS job catalog.

Sources: the public job-board APIs of Greenhouse, Lever, and Ashby (North
America). For each employer board in a source's seed file it fetches all
postings, keeps those located in the US or Canada, upserts them as catalog jobs
(no owner, visible to every user), and marks catalog postings that vanished
from a successfully fetched board as UNAVAILABLE. Requirement extraction is deferred to first use, so a sync makes
no AI calls.

Each board commits separately; a failed board is reported and skipped without
touching its existing postings. Exit status is 1 if any board failed.

Run daily, either from cron:

    15 6 * * * cd /path/to/careeros && .venv/bin/python scripts/sync_job_sources.py

or as a long-running process where cron is unavailable:

    .venv/bin/python scripts/sync_job_sources.py --every-hours 24

Examples:

    .venv/bin/python scripts/sync_job_sources.py --dry-run
    .venv/bin/python scripts/sync_job_sources.py --source lever
    .venv/bin/python scripts/sync_job_sources.py --source greenhouse --board stripe
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import httpx
from careeros_api import job_source_ashby, job_source_greenhouse, job_source_lever
from careeros_api.config import get_settings
from careeros_api.db import get_session_factory
from careeros_api.job_source_boards import (
    BoardAdapter,
    BoardFetchError,
    BoardMapping,
    SourceBoard,
)
from careeros_api.job_sources import (
    JobSourceIngestionError,
    ingest_job_source,
    mark_unseen_catalog_jobs_unavailable,
)

SEED_DIR = Path(__file__).resolve().parent.parent / "apps" / "api" / "job_sources"


@dataclass(frozen=True)
class SourceSpec:
    key: str
    fetch: Callable[[httpx.AsyncClient, SourceBoard], Awaitable[Any]]
    map: Callable[[Any, SourceBoard], BoardMapping]

    @property
    def seed(self) -> Path:
        return SEED_DIR / f"{self.key}_north_america.json"


SOURCES = {
    spec.key: spec
    for spec in (
        SourceSpec(
            job_source_greenhouse.GREENHOUSE_SOURCE_KEY,
            job_source_greenhouse.fetch_board,
            job_source_greenhouse.map_board_jobs,
        ),
        SourceSpec(
            job_source_lever.LEVER_SOURCE_KEY,
            job_source_lever.fetch_postings,
            job_source_lever.map_postings,
        ),
        SourceSpec(
            job_source_ashby.ASHBY_SOURCE_KEY,
            job_source_ashby.fetch_job_board,
            job_source_ashby.map_job_board,
        ),
    )
}
PAUSE_BETWEEN_BOARDS_SECONDS = 1.0


@dataclass
class BoardReport:
    source: str
    token: str
    fetched: int = 0
    kept: int = 0
    created: int = 0
    updated: int = 0
    closed: int = 0
    error: str | None = None

    def line(self) -> str:
        label = f"{self.source}/{self.token}"
        if self.error:
            return f"{label:<26} FAILED  {self.error}"
        return (
            f"{label:<26} fetched={self.fetched:<4} kept={self.kept:<4} "
            f"created={self.created:<4} updated={self.updated:<4} closed={self.closed}"
        )


def load_boards(
    seed: Path, source_key: str, only: list[str] | None
) -> list[SourceBoard]:
    document = json.loads(seed.read_text(encoding="utf-8"))
    if document.get("source_key") != source_key:
        raise SystemExit(f"{seed} is not a {source_key} seed file")
    boards = [
        SourceBoard(item["token"], item["company"]) for item in document["boards"]
    ]
    if only:
        boards = [board for board in boards if board.token in set(only)]
    return boards


async def sync_board(
    client: httpx.AsyncClient,
    spec: SourceSpec,
    board: SourceBoard,
    *,
    dry_run: bool,
) -> BoardReport:
    report = BoardReport(spec.key, board.token)
    try:
        payload = await spec.fetch(client, board)
        mapping = spec.map(payload, board)
    except BoardFetchError as error:
        report.error = str(error)
        return report
    report.fetched = mapping.fetched
    report.kept = len(mapping.candidates)
    if dry_run:
        return report

    factory = get_session_factory(get_settings().database_url)
    async with factory() as session:
        try:
            result = await ingest_job_source(
                session,
                user_id=None,
                adapter=BoardAdapter(spec.key, mapping),
                parser=None,
                defer_requirements=True,
            )
            report.closed = await mark_unseen_catalog_jobs_unavailable(
                session,
                source_key=spec.key,
                external_id_prefix=board.external_id_prefix,
                seen_external_ids=set(mapping.seen_external_ids),
            )
            await session.commit()
        except (JobSourceIngestionError, ValueError) as error:
            await session.rollback()
            report.error = f"ingest: {error}"
            return report
    report.created = result.created_count
    report.updated = result.updated_count
    return report


async def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument(
        "--source",
        choices=[*SOURCES, "all"],
        default="all",
        help="Which source to sync (default: all)",
    )
    parser.add_argument(
        "--seed", type=Path, help="Seed file override (only with a single --source)"
    )
    parser.add_argument("--board", action="append", help="Only sync this board token")
    parser.add_argument(
        "--dry-run", action="store_true", help="Fetch and map only; no database writes"
    )
    parser.add_argument(
        "--every-hours",
        type=float,
        help="Keep running and sync again every N hours (for a container or service "
        "without cron). Omit to sync once and exit.",
    )
    args = parser.parse_args(argv)
    if args.every_hours is not None and args.every_hours < 1:
        raise SystemExit("--every-hours must be at least 1")
    if args.every_hours is None:
        return await run_once(args)
    while True:
        started = time.monotonic()
        status = await run_once(args)
        print(
            f"sync finished with status {status}; next run in {args.every_hours}h",
            flush=True,
        )
        elapsed = time.monotonic() - started
        await asyncio.sleep(max(0.0, args.every_hours * 3600 - elapsed))


async def run_once(args: argparse.Namespace) -> int:
    if args.seed and args.source == "all":
        raise SystemExit("--seed needs a single --source")

    specs = list(SOURCES.values()) if args.source == "all" else [SOURCES[args.source]]
    plan = [
        (spec, board)
        for spec in specs
        for board in load_boards(args.seed or spec.seed, spec.key, args.board)
    ]
    if args.board and not plan:
        raise SystemExit(f"Not in any seed file: {', '.join(args.board)}")
    reports: list[BoardReport] = []
    async with httpx.AsyncClient(timeout=httpx.Timeout(30.0)) as client:
        for index, (spec, board) in enumerate(plan):
            if index:
                await asyncio.sleep(PAUSE_BETWEEN_BOARDS_SECONDS)
            report = await sync_board(client, spec, board, dry_run=args.dry_run)
            reports.append(report)
            print(report.line(), flush=True)

    failed = [report for report in reports if report.error]
    print(
        f"\n{'DRY RUN ' if args.dry_run else ''}boards={len(reports)} failed={len(failed)} "
        f"kept={sum(r.kept for r in reports)} created={sum(r.created for r in reports)} "
        f"updated={sum(r.updated for r in reports)} closed={sum(r.closed for r in reports)}"
    )
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
