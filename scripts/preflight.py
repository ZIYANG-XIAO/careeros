#!/usr/bin/env python3
"""Check that the local Python runtime can reach Clerk JWKS."""

from __future__ import annotations

import os
import ssl
import sys
from pathlib import Path
from urllib.error import URLError

CERTIFICATE_DIAGNOSTIC = """\
TLS certificate verification failed while fetching Clerk JWKS.

Python on macOS sometimes ships without the system CA bundle configured. Authenticated
API requests will return 503 until TLS verification can reach Clerk.

Fix options:

1. Install certifi and point Python at its CA bundle:

   pip install certifi
   export SSL_CERT_FILE=$(python -c "import certifi; print(certifi.where())")

2. If you installed Python from python.org, run Apple's certificate installer:

   /Applications/Python 3.13/Install Certificates.command

macOS certificate setup:

- Prefer option 1 in your shell profile so every Python process inherits SSL_CERT_FILE.
- Option 2 updates the python.org installer bundle once; you may still need option 1
  in virtual environments.

Verify your SSL paths:

   python -c "import ssl; print(ssl.get_default_verify_paths())"

Then re-run this script:

   python scripts/preflight.py
"""


def load_env_file(path: Path) -> None:
    if not path.is_file():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, _, value = stripped.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def is_certificate_verification_failure(error: BaseException) -> bool:
    if isinstance(error, ssl.SSLCertVerificationError):
        return True
    if isinstance(error, URLError) and error.reason is not None:
        return isinstance(error.reason, ssl.SSLCertVerificationError)
    return "CERTIFICATE_VERIFY_FAILED" in str(error)


def print_certificate_help() -> None:
    print(CERTIFICATE_DIAGNOSTIC, file=sys.stderr)
    print(
        "Exact export command:\n"
        '  export SSL_CERT_FILE=$(python -c "import certifi; print(certifi.where())")',
        file=sys.stderr,
    )


def main() -> int:
    repo_root = Path(__file__).resolve().parent.parent
    load_env_file(repo_root / ".env")

    issuer_url = os.environ.get("CLERK_ISSUER_URL", "").strip()
    if not issuer_url:
        print(
            "CLERK_ISSUER_URL is not set. Add it to .env or export it in your shell.",
            file=sys.stderr,
        )
        return 1

    jwks_url = f"{issuer_url.rstrip('/')}/.well-known/jwks.json"

    try:
        from jwt import PyJWKClient
        from jwt.exceptions import PyJWKClientConnectionError, PyJWKClientError

        client = PyJWKClient(jwks_url)
        client.get_signing_keys()
    except ImportError:
        print(
            "PyJWT is not installed. Install API dependencies first, for example:\n"
            "  pip install -e apps/api",
            file=sys.stderr,
        )
        return 1
    except (PyJWKClientConnectionError, PyJWKClientError, URLError, OSError) as error:
        if is_certificate_verification_failure(error.__cause__ or error):
            print_certificate_help()
            return 1
        print(f"Could not reach Clerk JWKS: {error}", file=sys.stderr)
        return 1

    print("Clerk JWKS is reachable and TLS verification succeeded.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
