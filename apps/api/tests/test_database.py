import pytest

from careeros_api.config import get_settings
from careeros_api.db import database_is_connected


@pytest.mark.integration
@pytest.mark.asyncio
async def test_database_connection() -> None:
    settings = get_settings()
    assert await database_is_connected(settings.database_url)
