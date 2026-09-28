# CareerOS Workstation Setup

This is the canonical checklist for starting CareerOS on a new development
computer. Keep real keys in ignored local environment files; never commit them.

## 1. Install prerequisites

- Git
- Node.js 22 or newer and npm 10 or newer
- Python 3.13 or newer
- Docker Desktop with Docker Compose
- Google Chrome when testing the extension
- access to the CareerOS Clerk development instance
- an OpenAI API key when testing real resume parsing, job parsing, matching, or
  semantic answer classification

Clone the repository and enter it:

```bash
git clone https://github.com/ZIYANG-XIAO/careeros.git
cd careeros
```

## 2. Create local environment files

```bash
cp .env.example .env
cp apps/web/.env.example apps/web/.env.local
```

### Root `.env` — API and PostgreSQL

Required:

- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT` — local
  Docker PostgreSQL configuration;
- `DATABASE_URL` — must use the same PostgreSQL values;
- `WEB_ORIGIN=http://localhost:3000`;
- `CLERK_ISSUER_URL` — the issuer/frontend API URL for the same Clerk
  development instance used by the Web publishable key.

Optional for real AI behavior:

- `OPENAI_API_KEY` — server-only;
- `OPENAI_RESUME_PARSER_MODEL`;
- `OPENAI_JOB_PARSER_MODEL`;
- `OPENAI_JOB_MATCHER_MODEL`;
- `OPENAI_ANSWER_CLASSIFIER_MODEL`.

Local storage:

- `RESUME_STORAGE_DIR=.local/resume-assets`;
- `MAX_RESUME_SIZE_BYTES=10485760`.

Do not put `OPENAI_API_KEY`, a Clerk secret, or database credentials in a
`NEXT_PUBLIC_` variable.

### `apps/web/.env.local` — Next.js and Clerk

Required:

- `NEXT_PUBLIC_API_URL=http://localhost:8000`;
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` — Clerk development publishable key;
- `CLERK_SECRET_KEY` — matching Clerk development secret key, used only by the
  Next.js server.

The Clerk publishable key, secret key, and `CLERK_ISSUER_URL` must belong to the
same Clerk instance.

### `apps/extension/.env.local` — optional extension override

The extension normally reuses the root/Web configuration. Create this file only
when an override is needed:

```bash
cp apps/extension/.env.example apps/extension/.env.local
```

Keep these values aligned with the local Web/API and the same Clerk instance:

- `EXTENSION_API_URL=http://localhost:8000`;
- `EXTENSION_WEB_URL=http://localhost:3000`;
- `EXTENSION_CLERK_PUBLISHABLE_KEY`;
- `EXTENSION_CLERK_FRONTEND_API`;
- `EXTENSION_CLERK_SYNC_HOST=http://localhost`.

Leave `EXTENSION_CRX_PUBLIC_KEY` empty for normal development so the checked-in
development public key preserves the stable extension ID. Never place
`CLERK_SECRET_KEY` in the extension environment.

## 3. Install dependencies

```bash
npm install
python3 -m venv .venv
.venv/bin/python -m pip install --upgrade pip
.venv/bin/python -m pip install -e 'apps/api[dev]'
```

On macOS, verify that Python can reach Clerk JWKS:

```bash
.venv/bin/python scripts/preflight.py
```

If this reports a certificate error, follow the exact `SSL_CERT_FILE` guidance
printed by the script before debugging authentication code.

## 4. Start PostgreSQL and migrate

```bash
docker compose --env-file .env -f infra/compose.yaml up -d postgres
.venv/bin/alembic -c apps/api/alembic.ini upgrade head
```

The expected migration head is `0021_job_search_goals`. Confirm the workstation:

```bash
./scripts/dev-check.sh
```

`TEST_DATABASE_URL` is optional and must refer to a separate disposable database.
Never point it at `DATABASE_URL`; destructive migration tests enforce this rule.

## 5. Start the product

Use two terminals from the repository root.

Terminal 1 — API:

```bash
.venv/bin/uvicorn --app-dir apps/api/src careeros_api.main:app --reload --host 127.0.0.1 --port 8000
```

Terminal 2 — Web:

```bash
npm run web:dev
```

Open:

- Web: `http://localhost:3000`
- API health: `http://localhost:8000/health`
- API readiness: `http://localhost:8000/readiness`
- API documentation: `http://localhost:8000/docs`

Readiness should report the database connected and Clerk JWKS reachable.

## 6. Build and load the extension

```bash
npm run extension:build
```

In Chrome:

1. open `chrome://extensions`;
2. enable Developer mode;
3. choose **Load unpacked**;
4. select `apps/extension/build`.

The development extension ID should remain
`ibihlmjmbfjegkljfjihhakppeagbpkf`. In the Clerk development instance, enable
Native API and add `chrome-extension://ibihlmjmbfjegkljfjihhakppeagbpkf` to
allowed origins without removing existing origins.

After rebuilding, click **Reload** for the extension on `chrome://extensions`.

## 7. Machine-local data does not follow Git

Git synchronizes source and migrations, but not:

- the PostgreSQL Docker volume;
- `.local/resume-assets`;
- `.env`, `apps/web/.env.local`, or extension overrides;
- the generated extension `build` directory.

A new workstation can safely use a fresh database and new test data. If the same
development data is required, transfer a PostgreSQL dump and resume assets through
an approved encrypted channel. Never commit either one; they may contain personal
and application data.

## 8. Daily startup and shutdown

Startup:

```bash
git pull --ff-only
docker compose --env-file .env -f infra/compose.yaml up -d postgres
.venv/bin/alembic -c apps/api/alembic.ini upgrade head
./scripts/dev-check.sh
```

Then run the API and Web commands from section 5.

Shutdown PostgreSQL without deleting its volume:

```bash
docker compose --env-file .env -f infra/compose.yaml down
```

Do not add `-v` unless the local database is intentionally disposable.

## 9. Baseline verification

```bash
.venv/bin/ruff check apps/api
.venv/bin/mypy apps/api/src
.venv/bin/pytest apps/api/tests
npm run web:lint
npm run web:typecheck
npm run web:test
npm run web:build
npm run extension:typecheck
npm run extension:test
npm run extension:build
```

Playwright browser setup is needed once before `npm run e2e`:

```bash
npx playwright install chromium
```
