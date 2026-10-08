"""Verify candidate employer boards before adding them to a job source seed.

For each ``token=Company Name`` candidate, calls the source's public board API
once and reports whether the board exists and how many postings it lists.
Candidates already in the seed are skipped. With ``--write``, verified boards
with at least ``--min-jobs`` postings are appended to the seed file; nothing
else changes. Requests are spaced by ``--pause`` seconds.

    .venv/bin/python scripts/verify_job_boards.py --source greenhouse \
        --candidates candidates.txt [--write]
"""

import argparse
import json
import sys
import time
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[1]
SEEDS = {
    "greenhouse": ROOT / "apps/api/job_sources/greenhouse_north_america.json",
    "lever": ROOT / "apps/api/job_sources/lever_north_america.json",
    "ashby": ROOT / "apps/api/job_sources/ashby_north_america.json",
}


def count_jobs(client: httpx.Client, source: str, token: str) -> int | None:
    if source == "greenhouse":
        response = client.get(
            f"https://boards-api.greenhouse.io/v1/boards/{token}/jobs"
        )
    elif source == "lever":
        response = client.get(
            f"https://api.lever.co/v0/postings/{token}", params={"mode": "json"}
        )
    else:
        response = client.get(f"https://api.ashbyhq.com/posting-api/job-board/{token}")
    if response.status_code != 200:
        return None
    payload = response.json()
    if source == "lever":
        return len(payload) if isinstance(payload, list) else None
    jobs = payload.get("jobs") if isinstance(payload, dict) else None
    return len(jobs) if isinstance(jobs, list) else None


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", choices=sorted(SEEDS), required=True)
    parser.add_argument("--candidates", type=Path, required=True)
    parser.add_argument("--min-jobs", type=int, default=5)
    parser.add_argument("--pause", type=float, default=0.5)
    parser.add_argument("--write", action="store_true")
    args = parser.parse_args()

    seed_path = SEEDS[args.source]
    seed = json.loads(seed_path.read_text())
    known = {board["token"].lower() for board in seed["boards"]}
    verified: list[dict[str, str]] = []
    with httpx.Client(
        timeout=30, headers={"User-Agent": "CareerOS job board verification"}
    ) as client:
        for line in args.candidates.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            token, company = (part.strip() for part in line.split("=", 1))
            if token.lower() in known:
                print(f"{token:28} skipped (already in seed)")
                continue
            try:
                count = count_jobs(client, args.source, token)
            except (httpx.HTTPError, ValueError):
                count = None
            status = "missing" if count is None else f"{count} postings"
            print(f"{token:28} {status}")
            if count is not None and count >= args.min_jobs:
                verified.append({"token": token, "company": company})
                known.add(token.lower())
            time.sleep(args.pause)

    print(f"\nverified={len(verified)}")
    if args.write and verified:
        seed["boards"].extend(verified)
        seed_path.write_text(json.dumps(seed, indent=2, ensure_ascii=False) + "\n")
        print(f"appended {len(verified)} boards to {seed_path.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
