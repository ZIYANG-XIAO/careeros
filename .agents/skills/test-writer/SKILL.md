---
name: test-writer
description: Add focused, behavior-oriented tests for CareerOS code. Use when new coverage, a regression test, or a test strategy is requested across Python, TypeScript, database, API, or browser layers.
---

# CareerOS test writer

Choose the lowest layer that proves the behavior:

- pure policy/parser/normalization logic: unit test;
- FastAPI ownership, validation, persistence, or idempotency: API test;
- PostgreSQL constraints or Alembic behavior: disposable-database integration test;
- React interaction and UI states: Vitest + Testing Library;
- extension messages, adapters, execution, or security boundaries: Vitest and
  the extension production build validator;
- a real navigation/browser contract: Playwright smoke test.

Reuse existing fixtures, factories, auth overrides, and naming conventions.
Test observable outcomes, negative paths, and important invariants without
copying implementation details into assertions. Keep AI-dependent tests
deterministic; do not require live OpenAI calls. Keep external pages and resumes
untrusted in fixtures.

Database migration tests may be destructive only against an explicit disposable
`TEST_DATABASE_URL` that differs from `DATABASE_URL`. Browser tests must not
claim the pending signed-in unpacked-extension M16 gate has passed.

Run the focused test, then the affected suite and relevant static/build checks
from `AGENTS.md`. State what the test proves and what remains outside its scope.
