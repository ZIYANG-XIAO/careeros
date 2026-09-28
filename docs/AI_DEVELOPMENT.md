# AI-assisted development

This repository uses a small, reviewable agent-tooling layer. The goal is high
autonomy with visible evidence, not maximum tool count.

## Architecture

```text
Developer
  → Codex task
  → AGENTS.md (stable repository rules and routing)
  → relevant .agents/skills workflow
  → optional least-privilege MCP/integration
  → scoped implementation
  → focused tests and affected validation
  → release review and human merge decision
```

`AGENTS.md` stays short because it is loaded for nearly every task. Product
truth remains in `docs/`. Repeatable task procedures live in repository skills.
Live external data belongs behind an authenticated integration rather than in
prompts or committed credentials.

## Installed repository skills

Repository skills live in `.agents/skills` and follow the portable
`SKILL.md` layout.

| Skill                   | Purpose                                                    | Use it when                                                     |
| ----------------------- | ---------------------------------------------------------- | --------------------------------------------------------------- |
| `feature-builder`       | Safely implement the smallest approved vertical slice      | A feature changes Web, API, database, or extension behavior     |
| `bug-fixer`             | Reproduce, isolate, regress, and minimally fix a defect    | Behavior is broken or a test regressed                          |
| `db-migration-reviewer` | Review Alembic/PostgreSQL correctness and operational risk | Models, migrations, constraints, indexes, or stored data change |
| `api-contract-reviewer` | Detect FastAPI/Pydantic/TypeScript contract drift          | Routes, schemas, auth, status codes, or client types change     |
| `test-writer`           | Select and add the lowest valuable behavior-oriented test  | Coverage or a regression test is needed                         |
| `release-reviewer`      | Perform a severity-ranked pre-merge diff review            | A branch or pull request is ready for final review              |

Invoke a skill explicitly when useful, for example:

```text
Use $feature-builder to add the approved behavior.
Use $release-reviewer to review this branch without changing it.
```

Codex may also select a skill automatically from its description. Explicit task
instructions remain authoritative.

## MCP and integrations

### OpenAI developer documentation — configured

Project configuration: `.codex/config.toml`

- Publisher: OpenAI.
- Endpoint: `https://developers.openai.com/mcp`.
- Purpose: current, cited OpenAI API, Codex, skill, and MCP documentation.
- Permissions: anonymous, read-only documentation search and page retrieval.
- Credentials: none.
- Verify: trust the repository, restart/open a new Codex task if necessary, then
  run `codex mcp list` or ask Codex to search official OpenAI documentation.

Do not use this documentation server for private application data or API calls.

### GitHub — recommended, authorization required

CareerOS is hosted on GitHub, so authenticated repository/issue/pull-request and
workflow access is valuable. Prefer the curated GitHub integration available in
Codex, or GitHub's official `github/github-mcp-server`.

Start read-only and grant access only to the CareerOS repository. Add write
permissions later only for a task that requires creating or updating issues or
pull requests. Prefer OAuth/GitHub App authorization over a broad personal
access token. Never commit tokens or place them in `.codex/config.toml`.

Verification after authorization:

1. list or read this repository through the integration;
2. read pull requests and CI status;
3. confirm mutation tools are absent when read-only access was selected.

GitHub integration is not committed as a token-bearing MCP entry because
authorization and permission scope belong to the developer's account.

### PostgreSQL — not installed

The repository already has explicit local database access through Docker
Compose, Alembic, SQLAlchemy, and integration tests. A generic database MCP
would duplicate those paths while increasing credential and destructive-query
risk.

Use:

```bash
docker compose --env-file .env -f infra/compose.yaml up -d postgres
.venv/bin/alembic -c apps/api/alembic.ini current
.venv/bin/alembic -c apps/api/alembic.ini upgrade head
```

Use `TEST_DATABASE_URL` only for an explicitly disposable database and keep it
different from `DATABASE_URL`. Reconsider a read-only database integration only
when a recurring schema-inspection workflow cannot be served safely by these
tools. Never connect an agent directly to production PostgreSQL.

### Other integrations — not needed now

No deployment, observability, error-tracking, ticketing, or cloud database
provider is configured in the repository. Do not add Vercel, Sentry, Supabase,
Linear, Slack, or similar integrations until CareerOS actually adopts the
service and a recurring workflow justifies its permissions.

## Browser automation

Playwright provides a minimal Chromium smoke-test pattern:

```bash
npx playwright install chromium
npm run e2e
```

The current smoke test opens the checked-in generic application fixture in a
real browser. It proves the browser harness, fixture server, and accessible form
selectors work. It is not a substitute for the M16 signed-in, unpacked-Chrome
scenarios, which were validated manually rather than in this suite.

Extend Playwright only for stable cross-surface journeys that cannot be covered
more cheaply by Pytest or Vitest. Keep auth secrets out of tests and prefer
dedicated test tenants/accounts if authenticated automation is later approved.

## Continuous integration

`.github/workflows/ci.yml` runs four independent jobs:

- API: fresh PostgreSQL migration, Ruff, formatting, mypy, and Pytest;
- Web: ESLint, TypeScript, Vitest, Prettier, and production build;
- Extension: TypeScript, Vitest, Prettier, and the security/build validator;
- Browser smoke: Playwright Chromium against the fixture server.

The workflow has read-only repository permissions and no production secrets.
The API migration job validates a fresh upgrade; destructive downgrade/re-upgrade
coverage remains opt-in through a separate disposable `TEST_DATABASE_URL`.

## Recommended workflows

### Feature

```text
$feature-builder
→ implementation
→ $test-writer when coverage design is non-obvious
→ affected validation
→ $release-reviewer
```

### Bug

```text
$bug-fixer
→ reproduce and regression test
→ minimal fix
→ affected validation
→ $release-reviewer
```

### Database

```text
$db-migration-reviewer
→ disposable-database validation
→ API tests
→ $release-reviewer
```

### Full-stack API

```text
$api-contract-reviewer
→ backend and client contract tests
→ $test-writer if a browser boundary is required
→ $release-reviewer
```

## Maintenance

- Keep `AGENTS.md` limited to rules that apply to most tasks.
- Update a skill after repeated real failures, not hypothetical edge cases.
- Remove integrations that are unused or whose publisher/permissions can no
  longer be verified.
- Pin dependencies in lockfiles and review updates normally.
- Keep CI commands aligned with `AGENTS.md` and `README.md`.
- Do not mark manual browser gates complete based on automated unit/smoke tests.
