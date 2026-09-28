#!/usr/bin/env python3
"""Ingest guopin (国聘) job rows into canonical CareerOS Jobs for one user.

The source is not approved for production ingestion yet — see
`docs/JOB_SOURCE_DECISION.md`. The field mapping itself is implemented in
`careeros_api.job_source_guopin`, so `--dry-run` (no PostgreSQL, no OpenAI key)
already validates real rows; real ingestion additionally needs the source's
legal/terms review to be complete.

This script is currently wired to guopin specifically (it imports
`careeros_api.job_source_guopin.map_row` directly below). CareerOS expects more
than one job source over time — see `docs/JOB_SOURCE_DECISION.md`'s
one-source-at-a-time process — so when a second source's adapter exists, add a
`--source` flag here that picks the right mapper instead of hardcoding guopin's.
Row loading and the file-based adapter (`job_source_file_adapter`) are already
source-agnostic; only this hardcoded `map_row` import needs to change.

Run it with the project virtualenv, which has careeros_api installed:
`.venv/bin/python scripts/ingest_jobs.py ...`.

Two properties of the existing model drive this script's shape:

- Jobs are user-owned (`jobs.user_id` is NOT NULL), so there is no shared job
  pool. Ingestion always targets one named user.
- Every new or changed description costs one job-parser call, so the script
  reports the worst-case call count and asks before spending it.

Examples:

    .venv/bin/python scripts/ingest_jobs.py --file sample.jsonl --dry-run
    .venv/bin/python scripts/ingest_jobs.py --file sample.jsonl \
        --user-email you@example.com --limit 20
    .venv/bin/python scripts/ingest_jobs.py --file sample.jsonl \
        --user-id 359cc827-b80d-4d48-ab3d-d6d897aa4da0

A Clerk-authenticated user has no `User.email` unless Clerk's session token is
configured to include an `email` claim, which is not the default. `--user-id`
targets that user directly when `--user-email` has nothing to match.
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path
from uuid import UUID

from careeros_api.config import get_settings
from careeros_api.db import get_session_factory
from careeros_api.job_parser import JobParsingError, get_job_parser
from careeros_api.job_source_file_adapter import (
    FileJobSourceAdapter,
    SourceRowError,
    load_rows,
)
from careeros_api.job_source_guopin import GUOPIN_SOURCE_KEY, map_row
from careeros_api.job_sources import JobSourceIngestionError, ingest_job_source
from careeros_api.models import User
from sqlalchemy import select


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument(
        "--file",
        required=True,
        type=Path,
        help="Guopin export (.json array or .jsonl)",
    )
    parser.add_argument(
        "--user-email",
        help="Owner of the ingested jobs, by User.email; one of this or --user-id is "
        "required unless --dry-run",
    )
    parser.add_argument(
        "--user-id",
        type=UUID,
        help="Owner of the ingested jobs, by User.id; use this when the user has no "
        "email on file",
    )
    parser.add_argument(
        "--source-key", default=GUOPIN_SOURCE_KEY, help="Stable key for this source"
    )
    parser.add_argument("--limit", type=int, help="Read at most this many rows")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Map and validate only; no database, no parser",
    )
    parser.add_argument(
        "--yes", action="store_true", help="Skip the parser-cost confirmation"
    )
    return parser.parse_args(argv)


def confirm(prompt: str) -> bool:
    try:
        return input(f"{prompt} [y/N] ").strip().lower() in {"y", "yes"}
    except EOFError:
        return False


async def ingest(args: argparse.Namespace, adapter: FileJobSourceAdapter) -> int:
    settings = get_settings()
    try:
        parser = get_job_parser()
    except JobParsingError as error:
        print(f"Parser unavailable: {error}", file=sys.stderr)
        return 1

    owner_label = f"user {args.user_id}" if args.user_id else f"email {args.user_email}"

    factory = get_session_factory(settings.database_url)
    async with factory() as session:
        if args.user_id:
            user = await session.get(User, args.user_id)
        else:
            user = await session.scalar(
                select(User).where(User.email == args.user_email)
            )
        if user is None:
            print(f"No user with {owner_label}", file=sys.stderr)
            return 1
        try:
            result = await ingest_job_source(
                session,
                user_id=user.id,
                adapter=adapter,
                parser=parser,
            )
        except JobSourceIngestionError as error:
            await session.rollback()
            print(f"Ingestion stopped: {error}", file=sys.stderr)
            return 1
        await session.commit()

    print(
        f"Ingested {len(result.jobs)} jobs for {owner_label}: "
        f"{result.created_count} created, {result.updated_count} updated."
    )
    return 0


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)

    if not args.dry_run and not args.user_email and not args.user_id:
        print(
            "--user-email or --user-id is required unless --dry-run is used.",
            file=sys.stderr,
        )
        return 2
    if args.user_email and args.user_id:
        print("Pass only one of --user-email or --user-id.", file=sys.stderr)
        return 2

    try:
        rows = load_rows(args.file, limit=args.limit)
    except (OSError, SourceRowError) as error:
        print(f"Could not read rows: {error}", file=sys.stderr)
        return 1

    adapter = FileJobSourceAdapter(rows, source_key=args.source_key, mapper=map_row)
    try:
        candidates = adapter.map_all()
    except NotImplementedError as error:
        print(f"{error}", file=sys.stderr)
        return 3
    except SourceRowError as error:
        print(f"Mapping failed: {error}", file=sys.stderr)
        return 1

    print(
        f"Read {len(rows)} rows from {args.file}; {len(candidates)} mapped to candidates."
    )

    if args.dry_run:
        for candidate in candidates[:5]:
            identity = candidate.external_job_id or candidate.canonical_url
            print(
                f"  {candidate.company} — {candidate.title} "
                f"[{candidate.market.value}/{candidate.country_code.value}] id={identity}"
            )
        if len(candidates) > 5:
            print(f"  ... and {len(candidates) - 5} more")
        print("Dry run only; nothing was written.")
        return 0

    owner_label = f"user {args.user_id}" if args.user_id else f"email {args.user_email}"
    if not args.yes and not confirm(
        f"Ingest {len(candidates)} candidates for {owner_label}? "
        f"Up to {len(candidates)} job-parser calls will be made."
    ):
        print("Cancelled.")
        return 0

    return asyncio.run(ingest(args, adapter))


if __name__ == "__main__":
    raise SystemExit(main())
