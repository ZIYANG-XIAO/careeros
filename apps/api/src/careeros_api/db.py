from functools import lru_cache

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine


@lru_cache
def get_engine(database_url: str) -> AsyncEngine:
    return create_async_engine(database_url, pool_pre_ping=True)


async def database_is_connected(database_url: str) -> bool:
    engine = get_engine(database_url)
    async with engine.connect() as connection:
        await connection.execute(text("SELECT 1"))
    return True
