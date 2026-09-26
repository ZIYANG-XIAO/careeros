---
name: db-migration-reviewer
description: Create or review CareerOS PostgreSQL and Alembic changes. Use for schema, constraint, index, data migration, ORM-model, or migration-safety work.
---

# CareerOS database migration reviewer

Treat `docs/DATA_MODEL.md`, SQLAlchemy models, and the full Alembic chain as one
contract.

For a proposed change:

1. Confirm the schema is authorized by the current roadmap milestone and keeps
   canonical ownership/history semantics intact.
2. Inspect the current Alembic head and related tables, constraints, indexes,
   relationships, enums, and API assumptions.
3. Review upgrade and downgrade behavior, nullability, server/application
   defaults, foreign keys, uniqueness, indexes, data backfill, transaction size,
   locking, compatibility with running code, and failure recovery.
4. Flag destructive or irreversible operations explicitly. Prefer expand/migrate/
   contract sequencing when existing data or mixed application versions make a
   one-step change unsafe.
5. Keep ORM models, schemas, tests, and `docs/DATA_MODEL.md` consistent with the
   migration.
6. Validate on a disposable database: upgrade from base/current head, inspect
   the resulting schema, exercise downgrade/re-upgrade when supported, and run
   affected API tests.

Never run destructive commands against production or an ambiguous database.
`TEST_DATABASE_URL` must be explicitly disposable and different from
`DATABASE_URL`. Report findings by severity, including rollback and operational
risk.
