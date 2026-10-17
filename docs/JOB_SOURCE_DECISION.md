# CareerOS — Job Source Decision Note

> Status: Approved decision process
> Last Updated: 2026-10-12

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

**Board expansion (2026-10-09).** The three approved sources' seed files grew
from 163 to 686 employer boards (Greenhouse 234, Lever 55, Ashby 397). New
boards came from YC's public company directory (active, hiring, North America)
and the employer links in public new-grad/internship lists. Each candidate was
probed once through the source's public board API with the same fetch-and-map
code as the sync, and kept only if it listed US/Canada postings. Tokens guessed
from a company name were kept only when the board's own name (Greenhouse) or
its posting text (Lever/Ashby) matched that company. A full local sync then
held 33,007 available postings from 684 employers (US 31,212, CA 1,237), up
from 10,128 postings from 86 employers. Common Crawl's index was tried first
for discovery but timed out.

Coverage is still bounded by which ATS an employer uses. Among 717 employers
with apply links in those public lists, about 35% use Workday, 25% a custom
or other site, and only about 31% Greenhouse/Ashby/Lever; iCIMS (6%), Oracle
(5%), SmartRecruiters (4%), and Workable (2%) follow.

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
     fetch never closes anything. The scheduled sync (`scripts/sync_job_sources.py`,
     every source) also holds a board whose fetch would close more than half
     of its open postings (when it has at least 20): it upserts what it read,
     closes nothing by absence, reports the board as `HELD`, and exits 1. An
     operator re-runs it with `--allow-shrink` after confirming the drop on
     the site. (Example: on 2026-10-17 Citizens Financial Group's Oracle site
     reported 0 of its previous 479 postings.)
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
- **Publish time**: `first_published` is stored as `jobs.posted_at` (Phase Z2).
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

## Source record: Workday career sites — North America

**Status: route A implemented 2026-10-09 on the owner's decision; legal/terms
review still outstanding.** The owner approved building it before that review
and accepts the risk; `robots.txt` permission is not a license, and the review
below still applies before any public launch. Route B (the internal JSON
endpoints described first below) is **not** implemented.

What was built (`careeros_api/job_source_workday.py`, source key `workday`,
seed `apps/api/job_sources/workday_north_america.json` with a `site_url` per
employer):

- reads only `robots.txt`, the advertised `siteMap.xml`, and job pages'
  schema.org `JobPosting` JSON-LD, and fails the board (closing nothing) when
  `robots.txt` disallows them or returns a server error;
- incremental: postings already open in the catalog are not re-fetched; pages
  whose URL places them outside North America are skipped unfetched; at most
  1,500 new pages per site per run (150 until 2026-10-10, raised because some
  sites, e.g. RTX's, list thousands), 1 s apart, generic CareerOS User-Agent;
- site URLs may be `{tenant}.wdN.myworkdayjobs.com/{site}` or
  `wdN.myworkdaysite.com/recruiting/{tenant}/{site}` (Wells Fargo, PayPal);
- large employers were added on 2026-10-10 by reading each guessed tenant's
  `robots.txt`, which lists its sites' sitemaps (an unknown tenant answers
  422): Intel, Cisco, Broadcom, Workday, Target, RTX, Visa, Wells Fargo, Bank
  of America, Pfizer, Disney, AT&T, Blue Origin, Accenture/Avanade, Bloomberg
  Industry Group, MuleSoft, Slack. A guessed `american` tenant was rejected as
  probably not American Express;
- closing: a sitemap under 100 postings is treated as complete and absence
  closes a posting; a full-size sitemap may be truncated, so absent postings
  are re-checked one page at a time (at most 25 per site per run) and closed
  only on 404/410 or a page without `JobPosting`; server errors and unchecked
  postings stay open;
- a page that fails at the network level is retried once and then skipped,
  so one bad page never discards the rest of the site; a re-check that cannot
  connect keeps the posting open;
- first full sync (2026-10-10): 181 sites, 0 failures, 10,004 postings created;
  168 employers had at least one US/Canada posting. Some sitemaps list more
  than 150 postings, so those employers reach the per-run page limit and fill
  in over later runs;
- known gaps: large employers' sitemaps list only ~100 postings, so their
  coverage is partial; URLs naming only a city with no state or country (e.g.
  "Plano") are skipped as not provably North American.

Original proposal (2026-10-02), kept for the review:

- **What**: Workday-hosted employer career sites
  (`https://{tenant}.wd{N}.myworkdayjobs.com/{site}`) load postings from two
  JSON endpoints used by their own front end:
  - list: `POST /wday/cxs/{tenant}/{site}/jobs` with
    `{"appliedFacets":{},"limit":20,"offset":N,"searchText":""}`, which returns
    title, `externalPath`, a location summary, a relative "Posted …" label,
    and the requisition id;
  - detail: `GET /wday/cxs/{tenant}/{site}{externalPath}`, which returns the
    HTML description, primary and additional locations, country, `startDate`
    (publish date), `endDate`, time type, and the employer's `externalUrl`.

  Verified by hand against one large employer's public site on 2026-10-02.
- **Evaluation against the criteria above**:
  1. *Legal and terms* — **highest risk of any current source.** These are
     undocumented internal endpoints, not a published API for third parties.
     Workday's terms and each employer's site terms and `robots.txt` must be
     reviewed first. Workday's official Recruiting APIs need employer
     credentials and are not available to CareerOS.
  2. *Source quality* — good: structured locations, country, publish date, and
     a direct apply URL.
  3. *Freshness* — same model as other sources: a posting missing from a
     successfully paged list is closed; a failed fetch closes nothing.
  4. *Market* — country from the detail payload; the list can be narrowed with
     location facets to cut requests.
  5. *Stable identifiers* — `{tenant}:{jobReqId}` plus the canonical
     `externalUrl`.
  6. *Application URLs* — the employer's own `externalUrl`.
  7. *Removal behavior* — as 3.
  8. *Cost* — no fees but many requests: 20 postings per list page plus one
     detail request per posting. Mitigation: request details only for new or
     changed postings, pause about 1 s between requests, identify CareerOS in
     the User-Agent, and narrow by location facets.
  9. *Reliability* — the payload can change without notice. Treat a schema
     mismatch as a failed board, never as "all postings closed". A large site
     reported `total: 2000`, which looks like a display cap; full coverage needs
     faceted paging and must be verified.
  10. *Provider isolation* — a `job_source_workday.py` adapter over
      `job_source_boards.py`, like the existing three.
- **Proposed pilot**: 10–20 technology employers on Workday, each verified by
  hand, for at most four weeks, then review volume, error rate, and any
  complaints before expanding.
- **Route-A pilot (2026-10-09, owner-approved, measurement only — no code in
  the product, no database writes).** An alternative to the internal JSON
  endpoints above: each Workday career site's `robots.txt` explicitly allows
  the public site path and advertises a `siteMap.xml`, and each job page embeds
  schema.org `JobPosting` JSON-LD (title, location, `datePosted`,
  `employmentType`, description, hiring organization) for search engines.
  Ten sites sampled at random from 276 found in public lists (requests 1.5 s
  apart, generic User-Agent):
  - `robots.txt` allowed the sitemap and job pages on all 10;
  - JSON-LD parsed on 100 of 100 sampled job pages;
  - 8 of 10 sitemaps listed exactly 100 jobs with no paging (one listed 924),
    so this route is complete only for employers with fewer than ~100
    openings and partial for large ones;
  - the share of US/Canada postings ranged from 0 to 10 of 10 sampled; global
    employers' sitemaps can be mostly non-North-American.
  Cost: one request per job page; a full first pass over 276 sites is up to
  ~27,600 requests (~11.5 h at 1.5 s), after which only new sitemap URLs need
  fetching. Still needs the legal/terms review above before any production
  adapter or sync; `robots.txt` permission is not a license.
- **Not to be confused with** the extension's Workday *form-filling* adapter
  (Phase R), which runs only on pages the user opens and only on request.

## Source record: Workable public job widget — North America

**Status: implemented 2026-10-10 on the owner's decision; legal/terms review
outstanding.** `careeros_api/job_source_workable.py`, source key `workable`.

- Reads `https://apply.workable.com/api/v1/widget/accounts/{account}?details=true`,
  the endpoint Workable provides for embedding an employer's jobs on its own
  site. `apply.workable.com/robots.txt` disallows nothing and signals
  `search=yes, ai-train=no`; CareerOS displays jobs for search and does not
  train on them.
- Locations carry ISO country codes, which decide placement.
- Only 13 employers with US/Canada postings were found among YC's directory
  and public lists (543 postings), so this source adds little volume.
- Workable rate-limits bursts (HTTP 429 after ~1,600 discovery requests);
  the daily sync makes one request per employer.

## Source considered and rejected: SmartRecruiters

`api.smartrecruiters.com/robots.txt` allows only `LinkedInBot` and disallows
every other user agent, and the public `jobs.smartrecruiters.com` company
pages load their listings from that API. Reading it would ignore an explicit
signal, so SmartRecruiters is not a source (decided 2026-10-10).

## Source record: large employers' career sites — North America

**Status: implemented 2026-10-10 on the owner's decision; legal/terms review
outstanding.** `careeros_api/job_source_careersite.py`, source key
`careersite`, seed `careersite_north_america.json`. Each reader checks the
site's `robots.txt` (RFC 9309, see below) before reading, and fails the
board, closing nothing, if a needed path is disallowed.

| Employer | What is read | Completeness and closing |
|---|---|---|
| Amazon | `www.amazon.jobs/en/search.json` (the site's own search JSON; not disallowed) for US and Canada | One query caps at 10,000 hits; a country above that is read one job category at a time (largest US category ~2,400). A complete read closes absent postings; otherwise absent ones are re-checked (closed on 404). First read: 13,785 postings. |
| Eightfold sites: Microsoft, NVIDIA, Qualcomm, PayPal, Morgan Stanley, Citi, HP, Netflix | `/api/pcsx/search` + `/api/pcsx/position_details`, or (Netflix) the older `/api/apply/v2/jobs` — these sites' `robots.txt` disallows everything but explicitly allows `/careers`, `/api/pcsx`, and `/api/apply` | Search is paged to its reported count, so absence closes. Details are fetched only for new postings. NVIDIA moved here from Workday (its Workday sitemap listed 100 postings; Eightfold lists ~1,400 US). |
| Meta | `www.metacareers.com/jobsearch/sitemap.xml` (advertised in `robots.txt`) + each job page's schema.org `JobPosting` | Full sitemap; absence closes. Pages are fetched only for new postings. |
| Apple | `jobs.apple.com/sitemap/sitemap-jobs-en-us.xml` + the posting data embedded in each job page (no `robots.txt` exists) | Full US sitemap; absence closes. Apple publishes no `JobPosting`, so this reader breaks if Apple changes its page. |
| Google | — | **Not read.** `robots.txt` disallows `/about/careers/applications/jobs/results`, which covers job pages. |

Amazon's and Microsoft's endpoints are the JSON their own sites use, not
documented third-party APIs; they are read only because `robots.txt` permits
them, which is not a license. Requests are 1 s apart per employer with the
generic CareerOS User-Agent.

At most 1,000 new pages are read per employer per run, so each run commits
its progress: an employer's postings are written only after its run finishes,
and Apple's ~4,400 US pages at ~2.8 s each would otherwise take one run of
over three hours, all lost if interrupted. Apple therefore fills in over
several runs.

**robots.txt evaluation.** HTML/career-page sources use
`job_source_boards.Robots`, which follows RFC 9309: the group naming our
product token, else `*`; longest matching rule wins, `Allow` wins ties; `*`
and `$` are supported. Python's `urllib.robotparser` takes the first matching
line instead and would read Microsoft's `Disallow: /` before `Allow:
/api/pcsx` as a refusal.

## Source record: iCIMS career portals — North America

**Status: implemented 2026-10-10 on the owner's decision; legal/terms review
outstanding.** `careeros_api/job_source_icims.py`, source key `icims`.

- Each portal (`https://careers-{company}.icims.com`) advertises
  `sitemap.xml` in `robots.txt`, listing open jobs as `/jobs/{id}/{slug}/job`.
  The job page frames its content; the framed view (`?in_iframe=1`) carries a
  schema.org `JobPosting` with `validThrough`. Only robots-allowed paths are
  read; the sitemap is treated as complete.
- **Placeholder dates:** when a portal hides the real date, iCIMS reports
  `datePosted` as exactly two years before the request. Such dates (±2 days)
  are treated as unknown; otherwise the over-a-year rule below would drop
  real, currently open postings (seen on Southern Star and D'Addario, whose
  `validThrough` fell days ahead).
- 40 portals found from public lists and guessed hostnames, each verified by
  the posting's `hiringOrganization` name; guesses that resolved to a
  different employer (e.g. Aurora Staffing, Vanguard Medical Group) were
  dropped.

## Source record: Oracle Recruiting Cloud — North America

**Status: implemented 2026-10-10 on the owner's decision; legal/terms review
outstanding.** `careeros_api/job_source_oracle.py`, source key `oracle`.

- Reads `/hcmRestApi/resources/latest/recruitingCEJobRequisitions` (paged,
  200 per page, to `TotalJobsCount`) and, for new postings only,
  `recruitingCEJobRequisitionDetails` — the public resources the career
  site's own pages call. `robots.txt` on these hosts is missing or answers
  4xx, which RFC 9309 treats as no rules.
- 34 employers from public lists, including JPMorgan Chase, American
  Express, Dell, Honeywell, Oracle, BNY, Macy's, AutoZone, Cummins, Emerson,
  SAIC, Nokia, and CSX (~45,000 postings worldwide before the US/Canada
  filter).
- `ExternalPostedEndDate` in the past marks a posting closed.

## Source considered and set aside: SAP SuccessFactors

Career sites differ per employer, and the one checked (jobs.sap.com) lists
only marketing pages in its sitemap, so there is no single reader to build.

## Freshness rules applied to every source

- A posting whose source says it has closed — schema.org `validThrough`
  (Workday, Meta, iCIMS) or Oracle's `ExternalPostedEndDate` in the past — is
  not kept.
- A posting first published more than 365 days ago is treated as an
  always-open listing, not kept, and closed if already in the catalog
  (`job_source_boards.without_stale`, `job_sources.mark_stale_catalog_jobs_unavailable`).
  Applying it on 2026-10-10 closed 2,656 postings (Lever 1,104, Greenhouse
  913, Ashby 482, career sites 116, Workday 34, Workable 7).
- Titles marking an always-open pool ("general application", "talent
  community", "evergreen", …) are not openings.
- Apple's `PIPE` requisition type was briefly treated as a pool and then
  reverted: it covers ordinary specific roles (58 were wrongly closed and
  restored).

## China-market sources

The 2026-09-28 hold was lifted by the owner on 2026-10-12 ("the goal is to
have job data; decide how"). China sources follow the North American rule:
employers' own career sites, read only where `robots.txt` allows, with legal
and terms review still outstanding before public launch. Job aggregators
(BOSS直聘, 智联招聘, 猎聘, 前程无忧) are **not** read: their terms forbid
automated collection, Chinese courts have treated scraping recruitment
platforms as unfair competition, and their pages carry recruiters' personal
information. `scripts/ingest_jobs.py --catalog [--close-missing]` remains
available for a file-export source with written authorization.

## Source record: large employers' career sites — China

**Status: implemented 2026-10-12 on the owner's decision; legal/terms review
outstanding.** `careeros_api/job_source_china.py`, source key
`careersite-cn`, seed `careersite-cn_china.json`. Each reader checks the
site's `robots.txt` (RFC 9309) first and fails the board, closing nothing, if
a needed path is disallowed. Requests are 1 s apart per employer with the
generic CareerOS User-Agent. The endpoints are the JSON the sites' own pages
call, not documented APIs; `robots.txt` permitting them is not a license.

Only postings with at least one mainland-China city are kept
(`market=CHINA`, `country_code=CN`). Hong Kong, Macau, Taiwan, and overseas
postings are skipped. City names are matched against
`careeros_api/china_places.py` (31 provinces and ~380 prefecture-level
cities, from ByteDance's public location tree); an unlisted name counts as
outside the market rather than guessed.

| Employer | What is read | Completeness and closing |
|---|---|---|
| Tencent | `careers.tencent.com/tencentcareer/api/post/Query?area=cn` + `ByPostId` per new posting (the listing has duties only, not requirements); no `robots.txt` (redirects to a 404 page) | Listing paged to its count, so absence closes. ~2,260 listed, ~2,000 mainland. |
| Feishu-hosted portals: ByteDance and Feishu Recruiting tenants | One shared API at `{origin}/api/v1` for the portal path in the seed's `site_url` (`jobs.bytedance.com/society`, `{tenant}.jobs.feishu.cn/{path}`; only those hosts are accepted): a CSRF token, then `search/job/posts`. ByteDance's `robots.txt` disallows only `/referral`; tenants have none (404) | A portal under the 10,000-result cap is read in one pass. ByteDance is over it, so it is read one mainland city at a time from `config/job/filters/2` and the 中国大陆 subtree of `config/location/nodes/` (largest, Beijing, ~5,600); a capped city keeps absent known postings open. ByteDance ~10,900 listed. |
| Meituan | `zhaopin.meituan.com/api/official/job/getJobList`; no `robots.txt` (SPA page) | Paged to `totalPage`; absence closes. ~3,090 listed, ~2,870 mainland (Saudi Arabia, Gulf, Brazil, Hong Kong skipped). |
| NetEase | `hr.163.com/api/hr163/position/queryPage`; no `robots.txt` (SPA page) | Paged to `pages`; absence closes. ~2,690 mainland. |
| Baidu | — | **Not read.** The listing API answers `no-auth / illegal-visit` to anonymous requests. |
| Kuaishou | — | **Not read.** `robots.txt` disallows everything. |
| Pinduoduo | — | **Not read.** The site answers 403. |

Feishu tenants read on 2026-10-13 (portal path, postings kept): NIO (`index`,
925), XPeng (`index`, 948), Poizon/得物 (`index`, 307), Kuro Games (`index`,
251), Momenta (`talent`, 114), CHAGEE (`index`, 107), Shengshu (`index`,
105), ModelBest (`career`, 92), SenseTime (`exp`, 83), 01.AI (`index`, 44),
Infinigence (`infinigence`, 39), QCraft (`index`, 17). Tenants found with an
empty portal (no filters, no postings) are not seeded: Kimi/Moonshot, Keep,
Luckin, Meicai, Huya, RoboSense, Roborock, Hisense, Mafengwo, Xueqiu. About
half of NIO's, XPeng's, Poizon's, and Momenta's listed postings were first
published over a year ago and are dropped; Feishu postings whose description
is empty or a placeholder ("1", "SFL") are dropped by the short-description
rule (the detail endpoint is empty for them too). A single network error is
retried once.

Employment type is set only from an explicit signal: Feishu's 社招 + 正式
(regular) or 全职 (full-time), experienced hire → `FULL_TIME` (consistent with the owner's
2026-09-28 confirmation that 社招/校招 are full-time); ByteDance 实习,
Meituan `jobType` 2 (its internship channel), and NetEase `workType` 1 →
`INTERNSHIP`; otherwise a title containing 实习 → `INTERNSHIP`, else
`UNKNOWN`. No workplace-type signal is read.

Freshness (owner rule, 2026-10-12: keep only postings that are current and
still recruiting): absence from a complete listing closes a posting, as for
every source. Only ByteDance gives a first-publish time, so the shared
over-a-year rule applies to it directly (about 5,000 of ~10,900 listed
ByteDance postings were first published more than a year ago, some in 2018,
and are dropped). Tencent (`LastUpdateTime`, Beijing date), Meituan
(`refreshTime`), and NetEase (`updateTime`) give only update times; those are
not stored as `posted_at`, but a posting not updated for over a year is
treated as abandoned and dropped (on 2026-10-12: 23, 99, and 52 postings).

Quality rules on top of the shared freshness rules: placeholder postings
(talent pools, résumé drop boxes, referral-only "内推专用" roles — 人才库,
人才池, 人才储备, 人才交流, 内推专用, 简历投递, 岗位专项, …) are not openings and
are dropped like English standing-interest postings, as is any posting whose
whole description is under 50 characters (NetEase's "核心人才交流岗位" reads
only "核心人才交流"). A known posting is checked against these rules before it
is retained unread, so one that goes stale is closed. Descriptions are plain
text with HTML entities decoded, and each section gets a 职责/要求 heading
unless its text already opens with one. Agency-staffed roles marked in the title
as 派遣 or 外包 (e.g. "（派遣）", "【网易外包】") are kept but typed `CONTRACT`,
since the listed employer is not the direct employer. Management-trainee
"储备" roles are real openings and are kept. Identical postings repeated per
team are not merged at ingestion; Discover's company+title collapse shows
them as one row.

Audit on 2026-10-13 after the final sync: 14,353 open postings from 16
employers (ByteDance 5,908, Meituan 2,772, NetEase 2,638, Tencent 2,003, and
the Feishu tenants above); all `CHINA`/`CN`; none older than a year; no
placeholder titles, HTML, or entities left; a live check of 25 random open
postings per employer against its own API found all 392 still listed.

Not yet probed or not yet working: Alibaba (CSRF-gated search), JD and Huawei
(endpoints not found), Xiaomi, Li Auto and other employers whose Feishu
tenant slug was not guessed, Moka-hosted employers (no live tenant page found
yet; `app.mokahr.com/robots.txt` disallows only two tenants), and the public
iguopin.com API (`robots.txt` allows everything, but listings cap at 20 pages
per query and rows carry a `contact_user` field that must not be stored).

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
