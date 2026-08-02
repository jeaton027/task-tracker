## 3 items:
# async engine - connection to POstgreSQL
# session factory - stamps the database sessions
# get_db dependency - fnc FastAPI calls to hand session to route handler, and
# 	then cleans up after request is done.

from collections.abc import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from app.core.config import get_settings

settings = get_settings()

_raw_url = settings.database_url
if _raw_url.startswith("postgresql://"):
    _raw_url = _raw_url.replace("postgresql://", "postgresql+psycopg://", 1)
_async_database_url = _raw_url.replace(
    "postgresql+psycopg://",
    "postgresql+psycopg_async://",
)

# engine manages pool of real connections to PostgreSQL
# FORDEVELOPMENT prints echo=True for every SQL console 
# opens a connection pool. Does NOT connect immediately — connects lazily on first use
engine = create_async_engine(
	_async_database_url,
	echo=settings.app_env == "development",
)

#stamp new AsyncSession objects on demand
# expire_on_commit=False :: after a commit don't wipe attribute values from memory
# prevents crash due to async, after accessing user.email -> triggering another DB query
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)

async def get_db() -> AsyncGenerator[AsyncSession, None]:
	"""FastAPI dependency provides a db session per request
	Usage in a route:
		async def my_route(db: AsyncSession = Depends(get_db)): ...
	"""
	async with AsyncSessionLocal() as session:
		yield session
