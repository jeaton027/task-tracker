"""Tests for Step 14 — grace period (3 days back) on habit log create/delete."""
from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient

from app.services import habit_log_service


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

@pytest.fixture
def grace_3(monkeypatch):
	"""Restore the real 3-day window for these tests (conftest disables it)."""
	monkeypatch.setattr(habit_log_service, "GRACE_PERIOD_DAYS", 3)


def _today() -> str:
	return datetime.now(timezone.utc).date().isoformat()


def _days_back(n: int) -> str:
	return (datetime.now(timezone.utc).date() - timedelta(days=n)).isoformat()


async def _register_and_login(client: AsyncClient, email: str = "grace@example.com") -> str:
	creds = {"email": email, "password": "securepassword123"}
	await client.post("/api/v1/auth/register", json=creds)
	resp = await client.post("/api/v1/auth/login", json=creds)
	return resp.json()["access_token"]


def _auth(token: str) -> dict:
	return {"Authorization": f"Bearer {token}"}


async def _first_category_id(client: AsyncClient, token: str) -> str:
	resp = await client.get("/api/v1/categories", headers=_auth(token))
	return resp.json()[0]["id"]


async def _make_habit(client: AsyncClient, token: str) -> str:
	cat = await _first_category_id(client, token)
	body = {
		"name": "Drink Water", "mode": "DO", "frequency": "DAILY",
		# start_date in the past so backfill is logically possible
		"start_date": _days_back(30), "category_id": cat,
	}
	resp = await client.post("/api/v1/habits", json=body, headers=_auth(token))
	return resp.json()["id"]


# ---------------------------------------------------------------------------
# POST /log — grace window
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_log_today_succeeds(grace_3, client: AsyncClient) -> None:
	token = await _register_and_login(client)
	habit_id = await _make_habit(client, token)
	resp = await client.post(
		f"/api/v1/habits/{habit_id}/log",
		json={"log_date": _today()}, headers=_auth(token),
	)
	assert resp.status_code == 201


@pytest.mark.anyio
async def test_log_three_days_back_succeeds(grace_3, client: AsyncClient) -> None:
	"""Boundary — today - 3 is the earliest allowed."""
	token = await _register_and_login(client)
	habit_id = await _make_habit(client, token)
	resp = await client.post(
		f"/api/v1/habits/{habit_id}/log",
		json={"log_date": _days_back(3)}, headers=_auth(token),
	)
	assert resp.status_code == 201


@pytest.mark.anyio
async def test_log_four_days_back_fails(grace_3, client: AsyncClient) -> None:
	"""Just outside the window."""
	token = await _register_and_login(client)
	habit_id = await _make_habit(client, token)
	resp = await client.post(
		f"/api/v1/habits/{habit_id}/log",
		json={"log_date": _days_back(4)}, headers=_auth(token),
	)
	assert resp.status_code == 422
	assert "3 days" in resp.json()["detail"]


@pytest.mark.anyio
async def test_log_future_still_rejected(grace_3, client: AsyncClient) -> None:
	"""Future-date rejection is unchanged from earlier — different error message."""
	token = await _register_and_login(client)
	habit_id = await _make_habit(client, token)
	resp = await client.post(
		f"/api/v1/habits/{habit_id}/log",
		json={"log_date": _days_back(-1)},		# tomorrow
		headers=_auth(token),
	)
	assert resp.status_code == 422
	assert resp.json()["detail"] == "Cannot log a future date."


# ---------------------------------------------------------------------------
# DELETE /log — grace window
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_delete_within_grace_succeeds(grace_3, client: AsyncClient) -> None:
	token = await _register_and_login(client)
	habit_id = await _make_habit(client, token)
	# Log 2 days back (within grace), then delete it
	await client.post(
		f"/api/v1/habits/{habit_id}/log",
		json={"log_date": _days_back(2)}, headers=_auth(token),
	)
	resp = await client.delete(
		f"/api/v1/habits/{habit_id}/log?date={_days_back(2)}",
		headers=_auth(token),
	)
	assert resp.status_code == 204


@pytest.mark.anyio
async def test_delete_outside_grace_fails(grace_3, client: AsyncClient) -> None:
	"""Even if the log exists (created before grace was enforced), DELETE
	outside the window is rejected — logs are immutable past the grace edge."""
	token = await _register_and_login(client)
	habit_id = await _make_habit(client, token)

	# Create a log 5 days back by temporarily lifting the grace limit
	habit_log_service.GRACE_PERIOD_DAYS = 100
	await client.post(
		f"/api/v1/habits/{habit_id}/log",
		json={"log_date": _days_back(5)}, headers=_auth(token),
	)
	habit_log_service.GRACE_PERIOD_DAYS = 3

	# Now try to delete that old log — rejected
	resp = await client.delete(
		f"/api/v1/habits/{habit_id}/log?date={_days_back(5)}",
		headers=_auth(token),
	)
	assert resp.status_code == 422
	assert "3 days" in resp.json()["detail"]
