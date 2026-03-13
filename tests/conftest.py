import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

from app.db.session import AsyncSessionLocal
from app.main import app

@pytest.fixture(scope="session")
def anyio_backend() -> str:
	return "asyncio"


@pytest.fixture(autouse=True)
async def clean_db() -> None:
	""" wipe users table before every test
	autouse=true : runs automatically for every test in the suit
	no need to request it, the delete runs before the test (above yeild)
	st every test starts w/ clean slate
	"""
	async with AsyncSessionLocal() as session:
		await session.execute(text("DELETE FROM users"))
		await session.commit()
	yield


@pytest.fixture
async def client() -> AsyncClient:
	"""Async HTTP client wired to the FastAPI app.
	Used in tests instead of creating a new client each time.
	"""
	async with AsyncSessionLocal() as session:
		await session.execute(text("DELETE FROM users"))
		await session.commit()
	async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
		yield c