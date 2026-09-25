# M14 Durable Application Domain Validation

> Status: Automated validation passed
> Validated: 2026-09-25

## Scope

This validation covers the Application schema/API, external and canonical Job
contexts, exact Resume Version association, immutable answer history, ownership,
lifecycle timestamps, and retry idempotency. It does not validate the planned
M15 Applications UI or extension capture workflow.

## Automated verification

- An external application can be created without a canonical Job or analysis.
- A CareerOS Job is ownership-checked and copied into stable company, role, URL,
  and source snapshots.
- An exact owned Resume Version can be associated; foreign versions are rejected.
- Application lists and details are owner-scoped and support status filtering.
- All eight V1 statuses are schema/database constrained.
- Non-preparing status records `applied_at`, and later status updates preserve it.
- Create retries return one Application for the same key/payload and conflict on
  changed content.
- Status retries are durably recorded and conflict when a key is reused for a
  different Application or update.
- Approved standard answers remain ordered and immutable.
- Unconfirmed, sensitive, or consequential answer history is rejected.
- Later canonical Job changes do not rewrite historical Application snapshots.
- Unauthenticated and cross-user access is rejected.
- The Alembic chain declares the Application, answer, and operation tables,
  ownership foreign keys, indexes, checks, and idempotency constraints.

## Known limitations

- The Applications Web surface and extension/Application integration begin in
  M15.
- Status history beyond the current status and status-update timestamp is not
  stored yet.
- Sensitive/consequential answers are intentionally excluded pending explicit
  retention policy.
- Application deletion/retention behavior requires a later product/legal
  decision; M14 exposes no delete endpoint.
- Representative extension browser validation remains deferred at the user's
  direction and is not represented as passed.
