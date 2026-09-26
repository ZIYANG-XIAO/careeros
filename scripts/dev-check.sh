#!/usr/bin/env bash
# CareerOS development environment check

set -u

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

READY=()
ATTENTION=()

note_ready() {
  READY+=("$1")
}

note_attention() {
  ATTENTION+=("$1")
}

section() {
  printf '\n== %s ==\n' "$1"
}

version_ge() {
  printf '%s\n%s\n' "$2" "$1" | sort -C -V
}

check_tool() {
  local label=$1
  local command_name=$2

  if ! command -v "$command_name" >/dev/null 2>&1; then
    note_attention "$label is not installed."
    return 1
  fi

  note_ready "$label available ($(command -v "$command_name"))"
  return 0
}

section "Required tools"

if check_tool "node" "node"; then
  node_version="$(node -p "process.versions.node")"
  if version_ge "$node_version" "22.0.0"; then
    note_ready "node version $node_version meets >= 22"
  else
    note_attention "node $node_version found; >= 22 is required."
  fi
fi

check_tool "npm" "npm"

if check_tool "python3" "python3"; then
  if python3 -c 'import sys; raise SystemExit(0 if sys.version_info >= (3, 13) else 1)'; then
    py_version="$(python3 -c 'import sys; print(".".join(map(str, sys.version_info[:3])))')"
    note_ready "python3 version $py_version meets >= 3.13"
  else
    py_version="$(python3 -c 'import sys; print(".".join(map(str, sys.version_info[:3])))')"
    note_attention "python3 $py_version found; >= 3.13 is required."
  fi
fi

check_tool "docker" "docker"

section "Environment files"

if [[ -f "$REPO_ROOT/.env" ]]; then
  note_ready ".env present at repository root"
else
  note_attention ".env missing. Copy .env.example to .env and fill in Clerk values."
fi

section "PostgreSQL"

if command -v docker >/dev/null 2>&1; then
  if docker compose --env-file .env -f infra/compose.yaml ps postgres 2>/dev/null | grep -q "running"; then
    note_ready "PostgreSQL container is running"
  else
    note_attention "PostgreSQL is not running. Start it with: docker compose --env-file .env -f infra/compose.yaml up -d postgres"
  fi
else
  note_attention "Docker unavailable; skipped PostgreSQL status check."
fi

section "Database migrations"

EXPECTED_HEAD=""
CURRENT_HEAD=""

if [[ -x "$REPO_ROOT/.venv/bin/alembic" ]]; then
  EXPECTED_HEAD="$("$REPO_ROOT/.venv/bin/alembic" -c apps/api/alembic.ini heads 2>/dev/null | awk 'NF {print $1; exit}')"
  if [[ -n "$EXPECTED_HEAD" ]]; then
    note_ready "Latest migration head: $EXPECTED_HEAD"
  else
    note_attention "Could not determine latest Alembic head."
  fi

  if [[ -f "$REPO_ROOT/.env" ]]; then
    CURRENT_HEAD="$("$REPO_ROOT/.venv/bin/alembic" -c apps/api/alembic.ini current 2>/dev/null | awk 'NF {print $1; exit}')"
    if [[ -n "$CURRENT_HEAD" && -n "$EXPECTED_HEAD" ]]; then
      if [[ "$CURRENT_HEAD" == "$EXPECTED_HEAD" ]]; then
        note_ready "Database is at migration head ($CURRENT_HEAD)"
      else
        note_attention "Database is at $CURRENT_HEAD; expected $EXPECTED_HEAD. Run: .venv/bin/alembic -c apps/api/alembic.ini upgrade head"
      fi
    elif [[ -z "$CURRENT_HEAD" ]]; then
      note_attention "Could not read current migration. Ensure PostgreSQL is running, then run alembic upgrade head."
    fi
  fi
else
  note_attention "Alembic not found in .venv. Install API dependencies with: .venv/bin/python -m pip install -e 'apps/api[dev]'"
fi

section "Extension build"

if npm run extension:build; then
  BUILD_DIR="$REPO_ROOT/apps/extension/build"
  note_ready "Extension built successfully"
  printf '\nExtension build directory:\n  %s\n' "$BUILD_DIR"
  printf '\nReload reminder:\n  Open chrome://extensions and click Reload on the CareerOS extension after each rebuild.\n'
else
  note_attention "Extension build failed. Check Clerk extension env values and npm output above."
fi

section "Start services"

cat <<'EOF'
API:
  .venv/bin/uvicorn --app-dir apps/api/src careeros_api.main:app --reload --host 127.0.0.1 --port 8000

Web:
  npm run web:dev

Local fixture:
  npm --workspace @careeros/extension run fixture
  open http://localhost:4173/application-page.html
EOF

section "Summary"

if ((${#READY[@]} > 0)); then
  printf 'Ready:\n'
  for item in "${READY[@]}"; do
    printf '  - %s\n' "$item"
  done
fi

if ((${#ATTENTION[@]} > 0)); then
  printf '\nNeeds attention:\n'
  for item in "${ATTENTION[@]}"; do
    printf '  - %s\n' "$item"
  done
  exit 1
fi

printf '\nDevelopment environment looks ready.\n'
exit 0
