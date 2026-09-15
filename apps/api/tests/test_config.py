import pytest
from pydantic import ValidationError

from careeros_api.config import Settings


def test_required_configuration_fails_clearly(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.delenv("WEB_ORIGIN", raising=False)
    monkeypatch.delenv("CLERK_ISSUER_URL", raising=False)

    with pytest.raises(ValidationError) as error:
        Settings(_env_file=None)  # type: ignore[call-arg]

    missing_fields = {item["loc"][0] for item in error.value.errors()}
    assert missing_fields == {"database_url", "web_origin", "clerk_issuer_url"}
