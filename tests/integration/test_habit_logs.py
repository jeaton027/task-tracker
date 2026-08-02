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


def _all_today_habits(body: dict) -> list[dict]:
	"""Flatten all habits across every section of the new sectioned /today response."""
	return [
		h
		for section in body.values()
		for h in section["habits"]
	]


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
	assert resp.status_code == 201
	body = resp.json()
	assert body["habit_id"] == habit_id
	assert body["log_date"] == _today_utc()
	assert body["amount"] == 1.0		# default increment


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
	assert resp.status_code == 201
	assert resp.json()["log_date"] == "2026-05-01"


@pytest.mark.anyio
async def test_mark_done_twice_creates_two_logs(client: AsyncClient) -> None:
	"""POST is no longer idempotent — each call creates a new log row."""
	token = await _register_and_login(client)
	cat_id = await _first_category_id(client, token)
	habit_id = await _make_habit(client, token, cat_id)

	first = await client.post(
		f"/api/v1/habits/{habit_id}/log", json={}, headers=_auth(token)
	)
	second = await client.post(
		f"/api/v1/habits/{habit_id}/log", json={}, headers=_auth(token)
	)
	assert first.status_code == 201
	assert second.status_code == 201
	assert first.json()["id"] != second.json()["id"]		# distinct rows


@pytest.mark.anyio
async def test_mark_done_with_explicit_amount(client: AsyncClient) -> None:
	"""amount in body overrides habit.increment for this single event."""
	token = await _register_and_login(client)
	cat_id = await _first_category_id(client, token)
	habit_id = await _make_habit(client, token, cat_id)

	resp = await client.post(
		f"/api/v1/habits/{habit_id}/log",
		json={"amount": 2.5},
		headers=_auth(token),
	)
	assert resp.status_code == 201
	assert resp.json()["amount"] == 2.5


@pytest.mark.anyio
async def test_mark_done_default_amount_is_habit_increment(client: AsyncClient) -> None:
	"""When amount omitted, log uses habit.increment (default = the habit's own increment)."""
	token = await _register_and_login(client)
	cat_id = await _first_category_id(client, token)
	# create a habit with custom increment
	body = {
		"name": "Run 6k/week",
		"mode": "DO",
		"frequency": "WEEKLY",
		"start_date": "2026-01-01",
		"category_id": cat_id,
		"target_per_period": 6,
		"increment": 2.0,
	}
	create_resp = await client.post("/api/v1/habits", json=body, headers=_auth(token))
	habit_id = create_resp.json()["id"]

	resp = await client.post(
		f"/api/v1/habits/{habit_id}/log",
		json={"log_date": "2026-01-05"},		# Monday (WEEKLY currently only Monday)
		headers=_auth(token),
	)
	assert resp.status_code == 201
	assert resp.json()["amount"] == 2.0


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
async def test_unmark_habit_removes_latest(client: AsyncClient) -> None:
	"""DELETE removes the most recent log for the day, leaving older ones intact."""
	token = await _register_and_login(client)
	cat_id = await _first_category_id(client, token)
	habit_id = await _make_habit(client, token, cat_id)

	# log twice, then delete once
	await client.post(f"/api/v1/habits/{habit_id}/log", json={}, headers=_auth(token))
	await client.post(f"/api/v1/habits/{habit_id}/log", json={}, headers=_auth(token))
	resp = await client.delete(
		f"/api/v1/habits/{habit_id}/log", headers=_auth(token)
	)
	assert resp.status_code == 204

	# one log remains -> POSTing again gives a fresh 201
	again = await client.post(
		f"/api/v1/habits/{habit_id}/log", json={}, headers=_auth(token)
	)
	assert again.status_code == 201


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

	resp = await client.get("/api/v1/habits/today", headers=_auth(token))
	assert resp.status_code == 200
	body = resp.json()
	# DAILY habit lives in the "daily" section
	assert len(body["daily"]["habits"]) == 1
	assert body["daily"]["habits"][0]["id"] == habit_id
	assert body["daily"]["habits"][0]["status"] == "PENDING"

	await client.post(f"/api/v1/habits/{habit_id}/log", json={}, headers=_auth(token))

	resp = await client.get("/api/v1/habits/today", headers=_auth(token))
	assert resp.json()["daily"]["habits"][0]["status"] == "SUCCESS"


@pytest.mark.anyio
async def test_today_quantified_do_partial_stays_pending(client: AsyncClient) -> None:
	"""DO with target=3: 2 logs today -> still PENDING; 3rd log -> SUCCESS."""
	token = await _register_and_login(client)
	cat_id = await _first_category_id(client, token)
	body = {
		"name": "Drink 3 glasses", "mode": "DO", "frequency": "DAILY",
		"start_date": "2026-01-01", "category_id": cat_id, "target_per_period": 3,
	}
	create = await client.post("/api/v1/habits", json=body, headers=_auth(token))
	habit_id = create.json()["id"]

	for _ in range(2):
		await client.post(
			f"/api/v1/habits/{habit_id}/log", json={}, headers=_auth(token)
		)
	resp = await client.get("/api/v1/habits/today", headers=_auth(token))
	assert resp.json()["daily"]["habits"][0]["status"] == "PENDING"

	await client.post(f"/api/v1/habits/{habit_id}/log", json={}, headers=_auth(token))
	resp = await client.get("/api/v1/habits/today", headers=_auth(token))
	assert resp.json()["daily"]["habits"][0]["status"] == "SUCCESS"


@pytest.mark.anyio
async def test_today_avoid_with_target_tolerates_under_limit(
	client: AsyncClient,
) -> None:
	"""AVOID with target=2: under limit = SUCCESS, going over = FAILED."""
	token = await _register_and_login(client)
	cat_id = await _first_category_id(client, token)
	body = {
		"name": "Max 2 takeout/day", "mode": "AVOID", "frequency": "DAILY",
		"start_date": "2026-01-01", "category_id": cat_id, "target_per_period": 2,
	}
	create = await client.post("/api/v1/habits", json=body, headers=_auth(token))
	habit_id = create.json()["id"]

	resp = await client.get("/api/v1/habits/today", headers=_auth(token))
	assert resp.json()["daily"]["habits"][0]["status"] == "SUCCESS"

	for _ in range(2):
		await client.post(f"/api/v1/habits/{habit_id}/log", json={}, headers=_auth(token))
	resp = await client.get("/api/v1/habits/today", headers=_auth(token))
	assert resp.json()["daily"]["habits"][0]["status"] == "SUCCESS"

	await client.post(f"/api/v1/habits/{habit_id}/log", json={}, headers=_auth(token))
	resp = await client.get("/api/v1/habits/today", headers=_auth(token))
	assert resp.json()["daily"]["habits"][0]["status"] == "FAILED"


@pytest.mark.anyio
async def test_today_avoid_inverts_status(client: AsyncClient) -> None:
	token = await _register_and_login(client)
	cat_id = await _first_category_id(client, token)
	habit_id = await _make_habit(client, token, cat_id, mode="AVOID")

	resp = await client.get("/api/v1/habits/today", headers=_auth(token))
	assert resp.json()["daily"]["habits"][0]["status"] == "SUCCESS"

	await client.post(f"/api/v1/habits/{habit_id}/log", json={}, headers=_auth(token))
	resp = await client.get("/api/v1/habits/today", headers=_auth(token))
	assert resp.json()["daily"]["habits"][0]["status"] == "FAILED"


@pytest.mark.anyio
async def test_today_with_date_query_param(client: AsyncClient) -> None:
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
	habits = _all_today_habits(resp.json())
	assert any(h["id"] == habit_id and h["status"] == "SUCCESS" for h in habits)


@pytest.mark.anyio
async def test_today_weekly_flexible_shows_every_day(client: AsyncClient) -> None:
	"""WEEKLY with no scheduled_weekdays = flexible: shows every day in the week."""
	token = await _register_and_login(client)
	cat_id = await _first_category_id(client, token)
	weekly_id = await _make_habit(
		client, token, cat_id, name="Weekly flex", frequency="WEEKLY",
		start_date="2026-01-01",
	)

	for d in ("2026-06-01", "2026-06-03"):
		resp = await client.get(f"/api/v1/habits/today?date={d}", headers=_auth(token))
		habits = _all_today_habits(resp.json())
		assert any(h["id"] == weekly_id for h in habits), f"missing on {d}"


@pytest.mark.anyio
async def test_today_weekly_anchored_to_specific_days(client: AsyncClient) -> None:
	"""WEEKLY with scheduled_weekdays=[0,2,4] (MWF) only shows those days."""
	token = await _register_and_login(client)
	cat_id = await _first_category_id(client, token)
	body = {
		"name": "Run MWF", "mode": "DO", "frequency": "WEEKLY",
		"start_date": "2026-01-01", "category_id": cat_id,
		"scheduled_weekdays": [0, 2, 4], "target_per_period": 3,
	}
	create = await client.post("/api/v1/habits", json=body, headers=_auth(token))
	habit_id = create.json()["id"]

	for d, present in [("2026-06-01", True), ("2026-06-02", False), ("2026-06-03", True)]:
		resp = await client.get(f"/api/v1/habits/today?date={d}", headers=_auth(token))
		habits = _all_today_habits(resp.json())
		assert any(h["id"] == habit_id for h in habits) == present


@pytest.mark.anyio
async def test_today_monthly_flexible_shows_every_day(client: AsyncClient) -> None:
	token = await _register_and_login(client)
	cat_id = await _first_category_id(client, token)
	monthly_id = await _make_habit(
		client, token, cat_id, name="Monthly flex", frequency="MONTHLY",
		start_date="2026-01-01",
	)
	for d in ("2026-06-01", "2026-06-15"):
		resp = await client.get(f"/api/v1/habits/today?date={d}", headers=_auth(token))
		habits = _all_today_habits(resp.json())
		assert any(h["id"] == monthly_id for h in habits), f"missing on {d}"


@pytest.mark.anyio
async def test_today_monthly_anchored_to_specific_days(client: AsyncClient) -> None:
	token = await _register_and_login(client)
	cat_id = await _first_category_id(client, token)
	body = {
		"name": "Bills 1st & 15th", "mode": "DO", "frequency": "MONTHLY",
		"start_date": "2026-01-01", "category_id": cat_id,
		"scheduled_days_of_month": [1, 15], "target_per_period": 2,
	}
	create = await client.post("/api/v1/habits", json=body, headers=_auth(token))
	habit_id = create.json()["id"]

	for d, present in [("2026-06-01", True), ("2026-06-15", True), ("2026-06-02", False)]:
		resp = await client.get(f"/api/v1/habits/today?date={d}", headers=_auth(token))
		habits = _all_today_habits(resp.json())
		assert any(h["id"] == habit_id for h in habits) == present


@pytest.mark.anyio
async def test_today_yearly_anchored_to_date(client: AsyncClient) -> None:
	token = await _register_and_login(client)
	cat_id = await _first_category_id(client, token)
	body = {
		"name": "Tax day", "mode": "DO", "frequency": "YEARLY",
		"start_date": "2026-01-01", "category_id": cat_id,
		"scheduled_dates": ["04-15"],
	}
	create = await client.post("/api/v1/habits", json=body, headers=_auth(token))
	habit_id = create.json()["id"]

	# YEARLY habit lives in the "yearly" section
	resp = await client.get("/api/v1/habits/today?date=2026-04-15", headers=_auth(token))
	assert any(h["id"] == habit_id for h in resp.json()["yearly"]["habits"])
	resp = await client.get("/api/v1/habits/today?date=2026-04-14", headers=_auth(token))
	assert not any(h["id"] == habit_id for h in resp.json()["yearly"]["habits"])


@pytest.mark.anyio
async def test_today_interval_every_n_days(client: AsyncClient) -> None:
	token = await _register_and_login(client)
	cat_id = await _first_category_id(client, token)
	body = {
		"name": "Water plants", "mode": "DO", "frequency": "INTERVAL",
		"start_date": "2026-01-01", "category_id": cat_id, "interval_days": 3,
	}
	create = await client.post("/api/v1/habits", json=body, headers=_auth(token))
	habit_id = create.json()["id"]

	# INTERVAL habit lives in the "interval" section
	resp = await client.get("/api/v1/habits/today?date=2026-01-04", headers=_auth(token))
	assert any(h["id"] == habit_id for h in resp.json()["interval"]["habits"])
	resp = await client.get("/api/v1/habits/today?date=2026-01-05", headers=_auth(token))
	assert not any(h["id"] == habit_id for h in resp.json()["interval"]["habits"])


@pytest.mark.anyio
async def test_today_weekly_flexible_status_uses_week_total(
	client: AsyncClient,
) -> None:
	"""Run 3x/week, log 3 across Mon+Wed+Fri -> SUCCESS on any of those days."""
	token = await _register_and_login(client)
	cat_id = await _first_category_id(client, token)
	body = {
		"name": "Run 3x/week", "mode": "DO", "frequency": "WEEKLY",
		"start_date": "2026-01-01", "category_id": cat_id, "target_per_period": 3,
	}
	create = await client.post("/api/v1/habits", json=body, headers=_auth(token))
	habit_id = create.json()["id"]

	for d in ("2026-01-05", "2026-01-07", "2026-01-09"):
		await client.post(
			f"/api/v1/habits/{habit_id}/log",
			json={"log_date": d}, headers=_auth(token),
		)

	resp = await client.get("/api/v1/habits/today?date=2026-01-11", headers=_auth(token))
	habits = _all_today_habits(resp.json())
	matches = [h for h in habits if h["id"] == habit_id]
	assert matches, "habit not in today response"
	assert matches[0]["status"] == "SUCCESS"


@pytest.mark.anyio
async def test_today_excludes_custom_frequency(client: AsyncClient) -> None:
	"""CUSTOM habits are excluded from all sections (no scheduling logic yet)."""
	token = await _register_and_login(client)
	cat_id = await _first_category_id(client, token)
	custom_id = await _make_habit(
		client, token, cat_id, name="Custom", frequency="CUSTOM",
		start_date="2026-01-01",
	)

	resp = await client.get(
		"/api/v1/habits/today?date=2026-06-01", headers=_auth(token)
	)
	habits = _all_today_habits(resp.json())
	assert not any(h["id"] == custom_id for h in habits)


@pytest.mark.anyio
async def test_today_excludes_inactive_habits(client: AsyncClient) -> None:
	token = await _register_and_login(client)
	cat_id = await _first_category_id(client, token)
	habit_id = await _make_habit(
		client, token, cat_id, name="Paused", is_active=False,
	)

	resp = await client.get("/api/v1/habits/today", headers=_auth(token))
	habits = _all_today_habits(resp.json())
	assert not any(h["id"] == habit_id for h in habits)


@pytest.mark.anyio
async def test_today_excludes_habits_outside_date_range(
	client: AsyncClient,
) -> None:
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
	habits = _all_today_habits(resp.json())
	ids = [h["id"] for h in habits]
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
	habits = _all_today_habits(resp.json())
	assert not any(h["id"] == habit_a for h in habits)


# ---------------------------------------------------------------------------
# /today sections — routines + structure
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_today_has_all_sections_even_when_empty(client: AsyncClient) -> None:
	"""Empty account -> all five sections present, each with empty habits & routines."""
	token = await _register_and_login(client)
	resp = await client.get("/api/v1/habits/today", headers=_auth(token))
	assert resp.status_code == 200
	body = resp.json()
	for key in ("daily", "weekly", "monthly", "yearly", "interval"):
		assert key in body
		assert body[key]["habits"] == []
		assert body[key]["routines"] == []


@pytest.mark.anyio
async def test_today_includes_daily_routine_with_pending_status(
	client: AsyncClient,
) -> None:
	"""A DAILY routine appears in daily.routines with status PENDING until completed."""
	token = await _register_and_login(client)
	body = {"name": "Morning", "frequency": "DAILY", "start_date": "2026-01-01"}
	create = await client.post("/api/v1/routines", json=body, headers=_auth(token))
	rid = create.json()["id"]

	resp = await client.get("/api/v1/habits/today", headers=_auth(token))
	routines = resp.json()["daily"]["routines"]
	matches = [r for r in routines if r["id"] == rid]
	assert matches
	assert matches[0]["status"] == "PENDING"


@pytest.mark.anyio
async def test_today_routine_status_success_after_session_completed(
	client: AsyncClient,
) -> None:
	token = await _register_and_login(client)
	body = {"name": "Morning", "frequency": "DAILY", "start_date": "2026-01-01"}
	create = await client.post("/api/v1/routines", json=body, headers=_auth(token))
	rid = create.json()["id"]

	# start + complete a session today
	start = await client.post(f"/api/v1/routines/{rid}/start", headers=_auth(token))
	sid = start.json()["id"]
	await client.patch(
		f"/api/v1/routines/sessions/{sid}/complete", headers=_auth(token),
	)

	resp = await client.get("/api/v1/habits/today", headers=_auth(token))
	routines = resp.json()["daily"]["routines"]
	matches = [r for r in routines if r["id"] == rid]
	assert matches[0]["status"] == "SUCCESS"


@pytest.mark.anyio
async def test_today_weekly_routine_only_on_scheduled_days(client: AsyncClient) -> None:
	"""WEEKLY routine with scheduled_weekdays=[0,2,4] -> only Mon/Wed/Fri."""
	token = await _register_and_login(client)
	body = {
		"name": "MWF Workout", "frequency": "WEEKLY", "start_date": "2026-01-01",
		"scheduled_weekdays": [0, 2, 4],
	}
	create = await client.post("/api/v1/routines", json=body, headers=_auth(token))
	rid = create.json()["id"]

	# 2026-06-01 Monday — should appear
	resp = await client.get(
		"/api/v1/habits/today?date=2026-06-01", headers=_auth(token),
	)
	weekly_rids = [r["id"] for r in resp.json()["weekly"]["routines"]]
	assert rid in weekly_rids

	# 2026-06-02 Tuesday — should NOT appear
	resp = await client.get(
		"/api/v1/habits/today?date=2026-06-02", headers=_auth(token),
	)
	weekly_rids = [r["id"] for r in resp.json()["weekly"]["routines"]]
	assert rid not in weekly_rids


@pytest.mark.anyio
async def test_today_routines_are_user_scoped(client: AsyncClient) -> None:
	token_a = await _register_and_login(client, "user_a@example.com")
	token_b = await _register_and_login(client, "user_b@example.com")
	body = {"name": "A's routine", "frequency": "DAILY", "start_date": "2026-01-01"}
	create = await client.post("/api/v1/routines", json=body, headers=_auth(token_a))
	rid = create.json()["id"]

	resp = await client.get("/api/v1/habits/today", headers=_auth(token_b))
	for sec in resp.json().values():
		assert not any(r["id"] == rid for r in sec["routines"])


# ---------------------------------------------------------------------------
# GET /habits/today?scope=... — Week/Month/Year tab inclusion
# ---------------------------------------------------------------------------

async def _make_scoped_habit(
	client: AsyncClient, token: str, cat_id: str, **overrides,
) -> str:
	body = {
		"name": "Habit", "mode": "DO", "frequency": "DAILY",
		"start_date": "2026-01-01", "category_id": cat_id,
	}
	body.update(overrides)
	resp = await client.post("/api/v1/habits", json=body, headers=_auth(token))
	assert resp.status_code == 201, resp.text
	return resp.json()["id"]


async def _habit_names_for_scope(
	client: AsyncClient, token: str, target: str, scope: str | None,
) -> set[str]:
	url = f"/api/v1/habits/today?date={target}"
	if scope:
		url += f"&scope={scope}"
	resp = await client.get(url, headers=_auth(token))
	assert resp.status_code == 200
	return {
		h["name"]
		for sec in resp.json().values()
		for h in sec["habits"]
	}


@pytest.mark.anyio
async def test_scope_week_includes_unscheduled_weekly_habit(
	client: AsyncClient,
) -> None:
	"""A Mon-Fri weekly habit isn't due on Saturday, but still belongs on the
	Week tab. 2026-01-10 is a Saturday.
	"""
	token = await _register_and_login(client)
	cat_id = await _first_category_id(client, token)
	await _make_scoped_habit(
		client, token, cat_id,
		name="Center", frequency="WEEKLY", scheduled_weekdays=[0, 1, 2, 3, 4],
	)

	assert "Center" not in await _habit_names_for_scope(client, token, "2026-01-10", None)
	assert "Center" in await _habit_names_for_scope(client, token, "2026-01-10", "week")


@pytest.mark.anyio
async def test_scope_tabs_filter_by_frequency(client: AsyncClient) -> None:
	"""Week = daily+weekly (+intervals <=7d); Month adds monthly (+intervals
	<=31d); Year has everything.
	"""
	token = await _register_and_login(client)
	cat_id = await _first_category_id(client, token)
	await _make_scoped_habit(client, token, cat_id, name="D", frequency="DAILY")
	await _make_scoped_habit(client, token, cat_id, name="W", frequency="WEEKLY")
	await _make_scoped_habit(client, token, cat_id, name="M", frequency="MONTHLY")
	await _make_scoped_habit(client, token, cat_id, name="Y", frequency="YEARLY")
	await _make_scoped_habit(
		client, token, cat_id, name="I3", frequency="INTERVAL", interval_days=3,
	)
	await _make_scoped_habit(
		client, token, cat_id, name="I60", frequency="INTERVAL", interval_days=60,
	)

	assert await _habit_names_for_scope(client, token, "2026-01-10", "week") == {"D", "W", "I3"}
	assert await _habit_names_for_scope(client, token, "2026-01-10", "month") == {"D", "W", "M", "I3"}
	assert await _habit_names_for_scope(client, token, "2026-01-10", "year") == {
		"D", "W", "M", "Y", "I3", "I60",
	}
