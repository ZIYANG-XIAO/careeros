# CareerOS M14 Application Memory Contract

> Status: Implemented domain and API
> Last Updated: 2026-09-28

## 1. Purpose and boundary

Application Memory is the durable record of work toward or completion of one
job application. It supports both CareerOS Jobs and jobs found elsewhere without
requiring prior discovery, saving, or Job Intelligence.

M14 implements the canonical domain and authenticated API. M15 connects that
domain to the Applications Web UI and explicit extension-side recording; the
domain invariants in this document remain authoritative.

## 2. Application identity and context

Each Application stores:

- authenticated user ownership;
- optional owned canonical Job relationship;
- optional exact owned Resume Version relationship;
- origin: CareerOS Job, external page, or manual;
- immutable company, role, application URL, and source snapshots;
- current V1 status;
- applied, status-updated, created, and updated timestamps; and
- a create idempotency key and request fingerprint.

When a canonical Job is supplied, company and role are copied from that owned
Job. Later Job changes or deletion do not rewrite the Application snapshot.
When no Job exists, company and role are required directly.

## 3. Status and lifecycle policy

Supported statuses are:

- `PREPARING`
- `APPLIED`
- `ASSESSMENT`
- `INTERVIEW`
- `FINAL`
- `REJECTED`
- `OFFER`
- `WITHDRAWN`

`PREPARING` cannot introduce an applied timestamp. Entering any later status
sets `applied_at` from an explicit timezone-aware value or the server clock when
it was previously unknown. Once recorded, `applied_at` is preserved across later
status changes.

Current status remains on the Application for efficient workflow queries.
`ApplicationStatusHistory` preserves the initial state and each real transition
as insert-only history. Idempotent retries and no-op updates do not duplicate
history rows.

## 4. User-planned activities

An Application may have user-authored activities of three explicit types:

- `NOTE` — freeform context with no scheduled date;
- `FOLLOW_UP` — a scheduled next action that may be completed or reopened; and
- `INTERVIEW` — a scheduled interview record.

Activities are owner-scoped through their parent Application. They store a
short title, optional details, an applicable timezone-aware scheduled date,
completion state, and timestamps. Creation is retry-safe through an
Application-scoped idempotency key and request fingerprint. Activities are
planning records and must not be presented as externally confirmed events.

## 4a. Contacts and deletion

Each Application may hold user-entered contacts (see `docs/DATA_MODEL.md`
15.2a). An Application can be deleted by its owner, which removes its answers,
status history, activities, and contacts; deleting its Job keeps the
Application and only clears `job_id`.

## 5. Application-specific answer history

Create requests may include up to 200 ordered, user-confirmed answers. Stored
answers are immutable and remain attached to that Application. They do not
become reusable answers or Career Evidence.

Current persistence is deliberately narrow:

- only `STANDARD` policy answers with `NONE` sensitivity are accepted;
- every answer requires explicit `user_confirmed: true`;
- accepted sources are Identity, Career Brain, Resume Version, or user-provided;
  and
- a Resume Version answer requires an owned selected Resume Version.

Sensitive and consequential answers are not persisted until an explicit
retention, access, and reuse policy is approved.

## 6. Idempotency

Application creation requires a client-generated UUID idempotency key. Retrying
the same normalized request returns the existing Application; reusing that key
for different content returns a conflict.

Status updates also require UUID idempotency keys. A durable operation record
prevents repeated or delayed retries from duplicating or reverting the update.
Reusing an update key for another Application or payload returns a conflict.

## 7. Ownership and historical stability

Job, Resume Version, Application, and nested update references are resolved
under the authenticated owner. Foreign IDs return not found and never disclose
whether another user's record exists.

Application snapshots and answers do not follow later mutable Career Brain,
Job, or answer changes. Resume history references the exact immutable Resume
Version. There are no M14 endpoints that edit or delete historical answers.

## 8. API

- `POST /applications` — idempotently create Application Memory.
- `GET /applications` — list owned Application summaries without answer text,
  optionally filtered by status.
- `GET /applications/{id}` — get one owned Application and answer history.
- `PATCH /applications/{id}/status` — idempotently update lifecycle status.
- `POST /applications/{id}/submission` — idempotently record explicit user
  submission, preserve a previously unset exact Resume Version, and append
  approved answer history without regressing later status.
- `GET /applications/{id}/status-history` — list immutable lifecycle history.
- `GET /applications/status-history` — the caller's lifecycle history across all
  owned applications (each entry carries `application_id`), oldest first; used
  by the Pipeline list to date each stage in one request.
- `GET/POST /applications/{id}/activities` — list or idempotently create notes,
  follow-ups, and interviews.
- `PATCH /applications/{id}/activities/{activity_id}` — update owned planning
  details or complete/reopen a follow-up.
- `GET /applications/activities/upcoming` — list owned incomplete follow-ups
  and future interviews for the Home workspace.

M15 consumes these APIs from Web and extension surfaces without duplicating
Application truth. See `docs/APPLICATION_INTEGRATION.md`.
