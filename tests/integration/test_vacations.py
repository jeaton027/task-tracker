"""Tests for vacation mode: CRUD + integration with today/calendar/stats."""
import pytest
from httpx import AsyncClient


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

async def _register_and_login(client: AsyncClient, email: str = "vac@example.com") -> str:
	creds = {"email": email, "password": "securepassword123"}
	await client.post("/api/v1/auth/register", json=creds)
	resp = await client.post("/api/v1/auth/login", json=creds)
	return resp.json()["access_token"]


def _auth(token: str) -> dict:
	return {"Authorization": f"Bearer {token}"}


async def _first_category_id(client: AsyncClient, token: str) -> str:
	resp = await client.get("/api/v1/categories", headers=_auth(token))
	return resp.json()[0]["id"]


async def _make_habit(client: AsyncClient, token: str, **overrides) -> str:
	cat = await _first_category_id(client, token)
	body = {
		"name": "Habit", "mode": "DO", "frequency": "DAILY",
		"start_date": "2026-01-01", "category_id": cat,
	}
	body.update(overrides)
	resp = await client.post("/api/v1/habits", json=body, headers=_auth(token))
	return resp.json()["id"]


async def _make_vacation(
	client: AsyncClient, token: str, start_date: str, end_date: str,
	name: str | None = None,
) -> str:
	body: dict = {"start_date": start_date, "end_date": end_date}
	if name:
		body["name"] = name
	resp = await client.post("/api/v1/vacations", json=body, headers=_auth(token))
	return resp.json()["id"]


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_new_user_has_no_vacations(client: AsyncClient) -> None:
	token = await _register_and_login(client)
	resp = await client.get("/api/v1/vacations", headers=_auth(token))
	assert resp.status_code == 200
	assert resp.json() == []


@pytest.mark.anyio
async def test_create_vacation(client: AsyncClient) -> None:
	token = await _register_and_login(client)
	resp = await client.post(
		"/api/v1/vacations",
		json={"name": "Paris", "start_date": "2026-06-10", "end_date": "2026-06-17"},
		headers=_auth(token),
	)
	assert resp.status_code == 201
	body = resp.json()
	assert body["name"] == "Paris"
	assert body["start_date"] == "2026-06-10"
	assert body["end_date"] == "2026-06-17"


@pytest.mark.anyio
async def test_create_vacation_in_the_past_is_allowed(client: AsyncClient) -> None:
	"""Retroactive marking — user got home and now wants to pardon last week."""
	token = await _register_and_login(client)
	resp = await client.post(
		"/api/v1/vacations",
		json={"start_date": "2020-01-01", "end_date": "2020-01-07"},
		headers=_auth(token),
	)
	assert resp.status_code == 201


@pytest.mark.anyio
async def test_create_vacation_with_end_before_start_fails(client: AsyncClient) -> None:
	token = await _register_and_login(client)
	resp = await client.post(
		"/api/v1/vacations",
		json={"start_date": "2026-06-10", "end_date": "2026-06-01"},
		headers=_auth(token),
	)
	assert resp.status_code == 422


@pytest.mark.anyio
async def test_overlapping_vacations_allowed(client: AsyncClient) -> None:
	"""Two trips back-to-back or overlapping just OR — both rows kept."""
	token = await _register_and_login(client)
	await _make_vacation(client, token, "2026-06-10", "2026-06-15")
	# Overlaps the first by 3 days — still accepted
	resp = await client.post(
		"/api/v1/vacations",
		json={"start_date": "2026-06-13", "end_date": "2026-06-20"},
		headers=_auth(token),
	)
	assert resp.status_code == 201
	list_resp = await client.get("/api/v1/vacations", headers=_auth(token))
	assert len(list_resp.json()) == 2


@pytest.mark.anyio
async def test_update_vacation(client: AsyncClient) -> None:
	token = await _register_and_login(client)
	vid = await _make_vacation(client, token, "2026-06-10", "2026-06-15", "Trip")
	resp = await client.patch(
		f"/api/v1/vacations/{vid}",
		json={"end_date": "2026-06-20"},
		headers=_auth(token),
	)
	assert resp.status_code == 200
	assert resp.json()["end_date"] == "2026-06-20"


@pytest.mark.anyio
async def test_update_to_invalid_range_fails(client: AsyncClient) -> None:
	token = await _register_and_login(client)
	vid = await _make_vacation(client, token, "2026-06-10", "2026-06-15")
	resp = await client.patch(
		f"/api/v1/vacations/{vid}",
		json={"end_date": "2026-06-01"},		# before start
		headers=_auth(token),
	)
	assert resp.status_code == 422


@pytest.mark.anyio
async def test_delete_vacation(client: AsyncClient) -> None:
	token = await _register_and_login(client)
	vid = await _make_vacation(client, token, "2026-06-10", "2026-06-15")
	resp = await client.delete(f"/api/v1/vacations/{vid}", headers=_auth(token))
	assert resp.status_code == 204
	get_resp = await client.get(f"/api/v1/vacations/{vid}", headers=_auth(token))
	assert get_resp.status_code == 404


@pytest.mark.anyio
async def test_other_users_vacation_returns_404(client: AsyncClient) -> None:
	token_a = await _register_and_login(client, "user_a@example.com")
	token_b = await _register_and_login(client, "user_b@example.com")
	vid = await _make_vacation(client, token_a, "2026-06-10", "2026-06-15")
	resp = await client.get(f"/api/v1/vacations/{vid}", headers=_auth(token_b))
	assert resp.status_code == 404


# ---------------------------------------------------------------------------
# /today integration
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_today_shows_vacation_status_during_vacation(
	client: AsyncClient,
) -> None:
	"""Habit on a vacation day -> status VACATION (not PENDING/FAILED)."""
	token = await _register_and_login(client)
	habit_id = await _make_habit(client, token, mode="DO")
	# Vacation covering today (?date param)
	await _make_vacation(client, token, "2026-01-10", "2026-01-15")

	resp = await client.get(
		"/api/v1/habits/today?date=2026-01-12", headers=_auth(token),
	)
	daily = resp.json()["daily"]["habits"]
	matches = [h for h in daily if h["id"] == habit_id]
	assert matches[0]["status"] == "VACATION"


@pytest.mark.anyio
async def test_today_outside_vacation_unaffected(client: AsyncClient) -> None:
	token = await _register_and_login(client)
	habit_id = await _make_habit(client, token, mode="DO")
	await _make_vacation(client, token, "2026-01-10", "2026-01-15")

	# Day before vacation -> normal status
	resp = await client.get(
		"/api/v1/habits/today?date=2026-01-09", headers=_auth(token),
	)
	daily = resp.json()["daily"]["habits"]
	matches = [h for h in daily if h["id"] == habit_id]
	assert matches[0]["status"] != "VACATION"


# ---------------------------------------------------------------------------
# Calendar integration
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_weekly_calendar_marks_vacation_days(client: AsyncClient) -> None:
	"""Calendar cells inside a vacation get status=VACATION regardless of logs."""
	token = await _register_and_login(client)
	await _make_habit(client, token)
	await _make_vacation(client, token, "2026-01-05", "2026-01-08")

	# Week of 2026-01-05 (Mon) - 2026-01-11 (Sun)
	resp = await client.get(
		"/api/v1/calendar/weekly?date=2026-01-07", headers=_auth(token),
	)
	days = {d["date"]: d["status"] for d in resp.json()[0]["days"]}
	# Mon-Thu are in vacation
	for d in ("2026-01-05", "2026-01-06", "2026-01-07", "2026-01-08"):
		assert days[d] == "VACATION"
	# Fri-Sun are not — should NOT be VACATION
	for d in ("2026-01-09", "2026-01-10", "2026-01-11"):
		assert days[d] != "VACATION"


# ---------------------------------------------------------------------------
# Stats integration
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_stats_streak_skips_vacation_periods(client: AsyncClient) -> None:
	"""DAILY habit. Logs Jan 1-3, vacation Jan 4-5, logs Jan 6-8.
	Best streak should bridge the vacation -> 6 successful days (Jan 1-3 + Jan 6-8),
	not be broken into two runs.
	"""
	token = await _register_and_login(client)
	habit_id = await _make_habit(client, token, end_date="2026-01-08")
	# vacation covers Jan 4-5
	await _make_vacation(client, token, "2026-01-04", "2026-01-05")
	# logs around the vacation
	for d in ("2026-01-01", "2026-01-02", "2026-01-03",
	          "2026-01-06", "2026-01-07", "2026-01-08"):
		await client.post(
			f"/api/v1/habits/{habit_id}/log",
			json={"log_date": d}, headers=_auth(token),
		)

	resp = await client.get(f"/api/v1/habits/{habit_id}/stats", headers=_auth(token))
	assert resp.json()["best_streak"]["length"] == 6


@pytest.mark.anyio
async def test_stats_completion_rate_excludes_vacation_period(
	client: AsyncClient,
) -> None:
	"""DAILY 1x habit. 10 day lifespan with 2 vacation days. 8 actual periods.
	Log 4 of those 8 -> rate 4/8 = 0.5, not 4/10 = 0.4.
	"""
	token = await _register_and_login(client)
	habit_id = await _make_habit(
		client, token, start_date="2026-01-01", end_date="2026-01-10",
	)
	await _make_vacation(client, token, "2026-01-04", "2026-01-05")
	for d in ("2026-01-01", "2026-01-02", "2026-01-03", "2026-01-06"):
		await client.post(
			f"/api/v1/habits/{habit_id}/log",
			json={"log_date": d}, headers=_auth(token),
		)

	resp = await client.get(f"/api/v1/habits/{habit_id}/stats", headers=_auth(token))
	all_time = resp.json()["periods"]["all_time"]
	assert all_time["expected"] == 8.0			# 10 days - 2 vacation
	assert all_time["events"] == 4.0
	assert all_time["completion_rate"] == pytest.approx(0.5)


@pytest.mark.anyio
async def test_stats_records_include_vacation_logs(client: AsyncClient) -> None:
	"""Vacation logs are off-the-books for streaks/rate but DO count toward records."""
	token = await _register_and_login(client)
	habit_id = await _make_habit(client, token, end_date="2026-02-28")
	await _make_vacation(client, token, "2026-01-10", "2026-01-20")
	# 3 logs in January (during vacation)
	for d in ("2026-01-12", "2026-01-15", "2026-01-18"):
		await client.post(
			f"/api/v1/habits/{habit_id}/log",
			json={"log_date": d}, headers=_auth(token),
		)
	# 1 log in February (no vacation)
	await client.post(
		f"/api/v1/habits/{habit_id}/log",
		json={"log_date": "2026-02-01"}, headers=_auth(token),
	)

	resp = await client.get(f"/api/v1/habits/{habit_id}/stats", headers=_auth(token))
	rec = resp.json()["records"]
	# January wins with 3 logs (vacation logs count for records)
	assert rec["best_month"]["month"] == "2026-01"
	assert rec["best_month"]["count"] == 3.0


@pytest.mark.anyio
async def test_partial_week_vacation_does_not_exempt_weekly_habit(
	client: AsyncClient,
) -> None:
	"""WEEKLY 3x habit, vacation Mon-Wed only. Week is NOT exempt — user still
	had Thu/Fri/Sat/Sun to log. With 0 logs the week is FAILED, not VACATION-skipped.
	"""
	token = await _register_and_login(client)
	habit_id = await _make_habit(
		client, token,
		name="Run 3x", frequency="WEEKLY", target_per_period=3,
		end_date="2026-01-11",		# end on Sunday so we have exactly one full week
	)
	# vacation Mon-Wed only
	await _make_vacation(client, token, "2026-01-05", "2026-01-07")

	resp = await client.get(f"/api/v1/habits/{habit_id}/stats", headers=_auth(token))
	# Week Jan 5-11 not exempt; no logs -> failed -> 0 best streak
	assert resp.json()["best_streak"]["length"] == 0
