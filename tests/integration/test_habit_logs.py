"""Tests for the daily check-in endpoints (GET /habits/today, POST/DELETE /habits/{id}/log)."""
from datetime import date, datetime, timezone

import pytest
from httpx import AsyncClient


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

def _today_utc() -> str:
	return datetime.now(timezone.utc).date().isoformat()


async def _register_and_login(client: AsyncClient, email: str = "log@example.com") -> str:
	creds = {"email": email, "password": "securepassword123"}
	await client.post("/api/v1/auth/register", json=creds)
	resp = await client.post("/api/v1/auth/login", json=creds)
	return resp.json()["access_token"]


def _auth(token: str) -> dict:
	return {"Authorization": f"Bearer {token}"}


async def _first_category_id(client: AsyncClient, token: str) -> str:
	resp = await client.get("/api/v1/categories", headers=_auth(token))
	return resp.json()[0]["id"]


async def _make_habit(
	client: AsyncClient,
	token: str,
	cat_id: str,
	*,
	name: str = "Drink Water",
	mode: str = "DO",
	frequency: str = "DAILY",
	start_date: str = "2026-01-01",
	end_date: str | None = None,
	is_active: bool = True,
) -> str:
	body = {
		"name": name,
		"mode": mode,
		"frequency": frequency,
		"start_date": start_date,
		"category_id": cat_id,
		"is_active": is_active,
	}
	if end_date:
		body["end_date"] = end_date
	resp = await client.post("/api/v1/habits", json=body, headers=_auth(token))
	return resp.json()["id"]


# ---------------------------------------------------------------------------
# POST /habits/{id}/log  — mark done
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_mark_habit_done_today(client: AsyncClient) -> None:
	token = await _register_and_login(client)
	cat_id = await _first_category_id(client, token)
	habit_id = await _make_habit(client, token, cat_id)

	resp = await client.post(
		f"/api/v1/habits/{habit_id}/log", json={}, headers=_auth(token)
	)
	assert resp.status_code == 200
	body = resp.json()
	assert body["habit_id"] == habit_id
	assert body["log_date"] == _today_utc()


@pytest.mark.anyio
async def test_mark_habit_done_specific_date(client: AsyncClient) -> None:
	token = await _register_and_login(client)
	cat_id = await _first_category_id(client, token)
	habit_id = await _make_habit(client, token, cat_id)

	resp = await client.post(
		f"/api/v1/habits/{habit_id}/log",
		json={"log_date": "2026-05-01"},
		headers=_auth(token),
	)
	assert resp.status_code == 200
	assert resp.json()["log_date"] == "2026-05-01"


@pytest.mark.anyio
async def test_mark_done_twice_is_idempotent(client: AsyncClient) -> None:
	"""Second POST returns 200 with the same log — no error."""
	token = await _register_and_login(client)
	cat_id = await _first_category_id(client, token)
	habit_id = await _make_habit(client, token, cat_id)

	first = await client.post(
		f"/api/v1/habits/{habit_id}/log", json={}, headers=_auth(token)
	)
	second = await client.post(
		f"/api/v1/habits/{habit_id}/log", json={}, headers=_auth(token)
	)
	assert first.status_code == 200
	assert second.status_code == 200
	assert first.json()["id"] == second.json()["id"]		# same row


@pytest.mark.anyio
async def test_mark_done_future_date_fails(client: AsyncClient) -> None:
	token = await _register_and_login(client)
	cat_id = await _first_category_id(client, token)
	habit_id = await _make_habit(client, token, cat_id)

	resp = await client.post(
		f"/api/v1/habits/{habit_id}/log",
		json={"log_date": "2099-01-01"},
		headers=_auth(token),
	)
	assert resp.status_code == 422


@pytest.mark.anyio
async def test_mark_done_other_users_habit_returns_404(client: AsyncClient) -> None:
	token_a = await _register_and_login(client, "user_a@example.com")
	token_b = await _register_and_login(client, "user_b@example.com")
	cat_a = await _first_category_id(client, token_a)
	habit_a = await _make_habit(client, token_a, cat_a)

	resp = await client.post(
		f"/api/v1/habits/{habit_a}/log", json={}, headers=_auth(token_b)
	)
	assert resp.status_code == 404


# ---------------------------------------------------------------------------
# DELETE /habits/{id}/log  — unmark
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_unmark_habit(client: AsyncClient) -> None:
	token = await _register_and_login(client)
	cat_id = await _first_category_id(client, token)
	habit_id = await _make_habit(client, token, cat_id)

	# log it, then remove
	await client.post(f"/api/v1/habits/{habit_id}/log", json={}, headers=_auth(token))
	resp = await client.delete(
		f"/api/v1/habits/{habit_id}/log", headers=_auth(token)
	)
	assert resp.status_code == 204

	# logging again should succeed (slot is free)
	again = await client.post(
		f"/api/v1/habits/{habit_id}/log", json={}, headers=_auth(token)
	)
	assert again.status_code == 200


@pytest.mark.anyio
async def test_unmark_when_no_log_returns_404(client: AsyncClient) -> None:
	token = await _register_and_login(client)
	cat_id = await _first_category_id(client, token)
	habit_id = await _make_habit(client, token, cat_id)

	resp = await client.delete(
		f"/api/v1/habits/{habit_id}/log", headers=_auth(token)
	)
	assert resp.status_code == 404


@pytest.mark.anyio
async def test_unmark_specific_date(client: AsyncClient) -> None:
	token = await _register_and_login(client)
	cat_id = await _first_category_id(client, token)
	habit_id = await _make_habit(client, token, cat_id)

	await client.post(
		f"/api/v1/habits/{habit_id}/log",
		json={"log_date": "2026-05-01"},
		headers=_auth(token),
	)
	resp = await client.delete(
		f"/api/v1/habits/{habit_id}/log?date=2026-05-01",
		headers=_auth(token),
	)
	assert resp.status_code == 204


@pytest.mark.anyio
async def test_unmark_other_users_habit_returns_404(client: AsyncClient) -> None:
	token_a = await _register_and_login(client, "user_a@example.com")
	token_b = await _register_and_login(client, "user_b@example.com")
	cat_a = await _first_category_id(client, token_a)
	habit_a = await _make_habit(client, token_a, cat_a)
	await client.post(f"/api/v1/habits/{habit_a}/log", json={}, headers=_auth(token_a))

	resp = await client.delete(
		f"/api/v1/habits/{habit_a}/log", headers=_auth(token_b)
	)
	assert resp.status_code == 404


# ---------------------------------------------------------------------------
# GET /habits/today
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_today_daily_do_pending_then_success(client: AsyncClient) -> None:
	token = await _register_and_login(client)
	cat_id = await _first_category_id(client, token)
	habit_id = await _make_habit(client, token, cat_id, mode="DO")

	# before logging
	resp = await client.get("/api/v1/habits/today", headers=_auth(token))
	assert resp.status_code == 200
	items = resp.json()
	assert len(items) == 1
	assert items[0]["id"] == habit_id
	assert items[0]["status"] == "PENDING"

	# log it
	await client.post(f"/api/v1/habits/{habit_id}/log", json={}, headers=_auth(token))

	# now SUCCESS
	resp = await client.get("/api/v1/habits/today", headers=_auth(token))
	assert resp.json()[0]["status"] == "SUCCESS"


@pytest.mark.anyio
async def test_today_avoid_inverts_status(client: AsyncClient) -> None:
	"""AVOID habit: not logged = SUCCESS, logged = FAILED."""
	token = await _register_and_login(client)
	cat_id = await _first_category_id(client, token)
	habit_id = await _make_habit(client, token, cat_id, mode="AVOID")

	resp = await client.get("/api/v1/habits/today", headers=_auth(token))
	assert resp.json()[0]["status"] == "SUCCESS"

	await client.post(f"/api/v1/habits/{habit_id}/log", json={}, headers=_auth(token))

	resp = await client.get("/api/v1/habits/today", headers=_auth(token))
	assert resp.json()[0]["status"] == "FAILED"


@pytest.mark.anyio
async def test_today_with_date_query_param(client: AsyncClient) -> None:
	"""Client passes the date — server uses it instead of UTC today."""
	token = await _register_and_login(client)
	cat_id = await _first_category_id(client, token)
	habit_id = await _make_habit(
		client, token, cat_id, mode="DO", start_date="2026-05-01"
	)
	await client.post(
		f"/api/v1/habits/{habit_id}/log",
		json={"log_date": "2026-05-15"},
		headers=_auth(token),
	)

	resp = await client.get(
		"/api/v1/habits/today?date=2026-05-15", headers=_auth(token)
	)
	items = resp.json()
	assert any(h["id"] == habit_id and h["status"] == "SUCCESS" for h in items)


@pytest.mark.anyio
async def test_today_weekly_only_on_monday(client: AsyncClient) -> None:
	"""WEEKLY habits appear only on Mondays."""
	token = await _register_and_login(client)
	cat_id = await _first_category_id(client, token)
	weekly_id = await _make_habit(
		client, token, cat_id, name="Weekly", frequency="WEEKLY",
		start_date="2026-01-01",
	)

	# 2026-06-01 is a Monday
	resp_mon = await client.get(
		"/api/v1/habits/today?date=2026-06-01", headers=_auth(token)
	)
	assert any(h["id"] == weekly_id for h in resp_mon.json())

	# 2026-06-02 is a Tuesday
	resp_tue = await client.get(
		"/api/v1/habits/today?date=2026-06-02", headers=_auth(token)
	)
	assert not any(h["id"] == weekly_id for h in resp_tue.json())


@pytest.mark.anyio
async def test_today_monthly_only_on_first(client: AsyncClient) -> None:
	"""MONTHLY habits appear only on the 1st."""
	token = await _register_and_login(client)
	cat_id = await _first_category_id(client, token)
	monthly_id = await _make_habit(
		client, token, cat_id, name="Monthly", frequency="MONTHLY",
		start_date="2026-01-01",
	)

	resp_first = await client.get(
		"/api/v1/habits/today?date=2026-06-01", headers=_auth(token)
	)
	assert any(h["id"] == monthly_id for h in resp_first.json())

	resp_second = await client.get(
		"/api/v1/habits/today?date=2026-06-02", headers=_auth(token)
	)
	assert not any(h["id"] == monthly_id for h in resp_second.json())


@pytest.mark.anyio
async def test_today_excludes_custom_frequency(client: AsyncClient) -> None:
	"""CUSTOM habits are excluded until Phase 6 adds the scheduling fields."""
	token = await _register_and_login(client)
	cat_id = await _first_category_id(client, token)
	custom_id = await _make_habit(
		client, token, cat_id, name="Custom", frequency="CUSTOM",
		start_date="2026-01-01",
	)

	resp = await client.get(
		"/api/v1/habits/today?date=2026-06-01", headers=_auth(token)
	)
	assert not any(h["id"] == custom_id for h in resp.json())


@pytest.mark.anyio
async def test_today_excludes_inactive_habits(client: AsyncClient) -> None:
	token = await _register_and_login(client)
	cat_id = await _first_category_id(client, token)
	habit_id = await _make_habit(
		client, token, cat_id, name="Paused", is_active=False,
	)

	resp = await client.get("/api/v1/habits/today", headers=_auth(token))
	assert not any(h["id"] == habit_id for h in resp.json())


@pytest.mark.anyio
async def test_today_excludes_habits_outside_date_range(
	client: AsyncClient,
) -> None:
	"""start_date in the future or end_date in the past -> not due."""
	token = await _register_and_login(client)
	cat_id = await _first_category_id(client, token)
	future_id = await _make_habit(
		client, token, cat_id, name="Future", start_date="2030-01-01"
	)
	past_id = await _make_habit(
		client, token, cat_id, name="Past",
		start_date="2020-01-01", end_date="2020-12-31",
	)

	resp = await client.get(
		"/api/v1/habits/today?date=2026-06-01", headers=_auth(token)
	)
	ids = [h["id"] for h in resp.json()]
	assert future_id not in ids
	assert past_id not in ids


@pytest.mark.anyio
async def test_today_is_user_scoped(client: AsyncClient) -> None:
	"""Each user only sees their own habits in /today."""
	token_a = await _register_and_login(client, "user_a@example.com")
	token_b = await _register_and_login(client, "user_b@example.com")
	cat_a = await _first_category_id(client, token_a)
	habit_a = await _make_habit(client, token_a, cat_a, name="A only")

	resp = await client.get("/api/v1/habits/today", headers=_auth(token_b))
	assert not any(h["id"] == habit_a for h in resp.json())
