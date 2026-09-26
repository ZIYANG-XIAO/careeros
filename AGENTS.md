# CareerOS — Repository Instructions

CareerOS is a modular monolith for a resume-first, evidence-grounded job-search
workflow. Treat the repository and `docs/` as the source of truth. Do not claim
planned behavior is implemented or expand beyond the current roadmap milestone.

## Read the relevant source of truth

Read only the documents needed for the task:

- Product scope or UX: `docs/PRODUCT.md`, `docs/PRD.md`, `docs/USER_FLOW.md`
- Domain or schema changes: `docs/DATA_MODEL.md`
- AI, grounding, or answer policy: `docs/AI_SPEC.md`, `docs/ANSWER_ENGINE.md`
- System boundaries: `docs/ARCHITECTURE.md`
- Sequencing and current implementation: `docs/ROADMAP.md`
- Extension forms and execution: `docs/FORM_MODEL.md`, `docs/FORM_EXECUTION.md`
- Application history/integration: `docs/APPLICATION_MEMORY.md`,
  `docs/APPLICATION_INTEGRATION.md`

When documents conflict, surface the conflict. The roadmap controls sequencing.
Use the OpenAI developer documentation MCP for current OpenAI/Codex/API facts.

## Architecture

- `apps/web`: Next.js, React, TypeScript, Clerk UI/session integration.
- `apps/api`: FastAPI, Pydantic, SQLAlchemy, Alembic, server-side ownership and
  AI/provider boundaries.
- `apps/extension`: React/TypeScript Manifest V3 assistant. Credentials remain
  in the background worker; page code is untrusted.
- `infra`: local PostgreSQL Compose configuration.
- `docs`: approved product and engineering contracts.
- `.agents/skills`: reusable CareerOS engineering workflows.
- `tests/e2e`: small Playwright browser smoke tests.

PostgreSQL is canonical. Web and extension clients are not authoritative for
ownership, professional truth, answer policy, or application history.

## Engineering rules

- Derive the user on the server and enforce ownership for every private or
  nested resource. Never trust client-provided ownership identifiers.
- Preserve stable identities and immutable history for evidence revisions,
  resume versions, job snapshots/analyses, approved answers, and application
  context. Use Alembic for every schema change.
- Career Brain professional truth, `UserContactInfo`, reusable answers, and
  application-specific answers are distinct concepts. Unknown stays unknown.
- Never fabricate professional claims or infer sensitive/consequential answers.
- Treat resumes, jobs, web pages, forms, and provider output as untrusted input.
  Validate schemas and keep provider logic behind existing adapters.
- The extension may fill only after explicit user action and must never submit
  an application. Preserve least-privilege permissions and background-only
  credentials.
- Keep `OPENAI_API_KEY`, Clerk secrets, database credentials, tokens, and real
  user data out of committed files and client bundles.
- Preserve the modular monolith. Do not add microservices, generic plugin/event
  infrastructure, or new providers without an approved need.
- Do not edit generated output (`.next`, extension `build`, caches, coverage,
  `next-env.d.ts`) manually.

## Canonical commands

Setup and development:

```bash
npm install
python3 -m venv .venv
.venv/bin/python -m pip install -e 'apps/api[dev]'
docker compose --env-file .env -f infra/compose.yaml up -d postgres
.venv/bin/alembic -c apps/api/alembic.ini upgrade head
.venv/bin/uvicorn --app-dir apps/api/src careeros_api.main:app --reload --host 127.0.0.1 --port 8000
npm run web:dev
npm run extension:build
```

Validation:

```bash
.venv/bin/ruff check apps/api
.venv/bin/ruff format --check apps/api
.venv/bin/mypy apps/api/src
.venv/bin/pytest apps/api/tests
npm run web:lint
npm run web:typecheck
npm run web:test
npm run web:format
npm run web:build
npm run extension:typecheck
npm run extension:test
npm run extension:format
npm run extension:build
npm run e2e
```

Tests marked `integration` use PostgreSQL. Destructive migration tests require
an explicitly disposable `TEST_DATABASE_URL` different from `DATABASE_URL`.
Install the Playwright Chromium binary once with `npx playwright install chromium`.

## Definition of done

For meaningful changes:

1. Implement the smallest coherent approved change.
2. Add behavior-oriented regression coverage at the lowest valuable layer.
3. Run the focused checks, then the broader checks affected by the diff.
4. Validate migrations and client/server contracts when either changes.
5. Review the complete diff for ownership, history, sensitive data, extension
   boundaries, accidental secrets, and generated files.
6. Update authoritative documentation when behavior or a contract changes.
7. Report validation results and remaining risks. Do not commit or push unless
   explicitly requested.
