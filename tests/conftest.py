import os

# ---------------------------------------------------------------------------
# Test-database isolation.
#
# Every test wipes the users table, so the suite must NEVER share a database
# with the running app. Point the app at a dedicated *_test database BEFORE
# any app module is imported — Settings reads real env vars ahead of .env,
# and app.db.session binds its engine at import time.
# ---------------------------------------------------------------------------
TEST_DATABASE_URL = os.environ.get(
	"TEST_DATABASE_URL",
	"postgresql+psycopg://postgres:postgres@db:5432/personal_ops_test",
)
os.environ["DATABASE_URL"] = TEST_DATABASE_URL

import psycopg
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import create_engine, text

from app.db.base import Base
from app.db.session import AsyncSessionLocal, engine
from app.main import app		# noqa: F401 — importing registers all models on Base
from app.services import habit_log_service


def _require_test_db() -> None:
	"""Hard guard: refuse to touch any database not named *_test."""
	db_name = engine.url.database or ""
	if not db_name.endswith("_test"):
		raise RuntimeError(
			f"Refusing to run tests against non-test database {db_name!r} — "
			"the suite deletes all rows. Set TEST_DATABASE_URL to a *_test database."
		)


@pytest.fixture(scope="session", autouse=True)
def _test_database() -> None:
	"""Drop + recreate the test database with the current model schema.

	Runs once per session. Uses a sync psycopg connection to the server's
	maintenance DB because CREATE/DROP DATABASE can't run in a transaction.
	"""
	_require_test_db()
	url = engine.url
	admin_dsn = f"postgresql://{url.username}:{url.password}@{url.host}:{url.port}/postgres"
	with psycopg.connect(admin_dsn, autocommit=True) as conn:
		conn.execute(f'DROP DATABASE IF EXISTS "{url.database}" WITH (FORCE)')
		conn.execute(f'CREATE DATABASE "{url.database}"')

	sync_engine = create_engine(TEST_DATABASE_URL)
	Base.metadata.create_all(sync_engine)
	sync_engine.dispose()


@pytest.fixture(scope="session")
def anyio_backend() -> str:
	return "asyncio"


@pytest.fixture(autouse=True)
def _disable_grace_period():
	"""Most tests use historical dates (e.g. 2026-01-05) for determinism.
	With Step 14's 3-day grace window those would be rejected — so disable
	the limit globally during tests. Step 14's own tests restore it locally
	via monkeypatch.
	"""
	original = habit_log_service.GRACE_PERIOD_DAYS
	habit_log_service.GRACE_PERIOD_DAYS = 100_000
	yield
	habit_log_service.GRACE_PERIOD_DAYS = original


@pytest.fixture(autouse=True)
async def clean_db() -> None:
	""" wipe users table before every test
	autouse=true : runs automatically for every test in the suit
	no need to request it, the delete runs before the test (above yeild)
	st every test starts w/ clean slate
	"""
	_require_test_db()
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
