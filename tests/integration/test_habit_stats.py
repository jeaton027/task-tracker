"""Tests for GET /habits/{id}/stats and GET /stats/overview."""
from datetime import date, timedelta

import pytest
from httpx import AsyncClient


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

async def _register_and_login(client: AsyncClient, email: str = "stats@example.com") -> str:
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
		"name": "Drink Water", "mode": "DO", "frequency": "DAILY",
		"start_date": "2026-01-01", "category_id": cat,
	}
	body.update(overrides)
	resp = await client.post("/api/v1/habits", json=body, headers=_auth(token))
	return resp.json()["id"]


async def _log_on(
	client: AsyncClient, token: str, habit_id: str, log_date: str, amount: float | None = None,
) -> None:
	payload = {"log_date": log_date}
	if amount is not None:
		payload["amount"] = amount
	await client.post(
		f"/api/v1/habits/{habit_id}/log", json=payload, headers=_auth(token),
	)


# ---------------------------------------------------------------------------
# basics
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_stats_for_brand_new_habit(client: AsyncClient) -> None:
	"""Habit with no logs -> 0 streak, 0 events, no records."""
	token = await _register_and_login(client)
	habit_id = await _make_habit(client, token)

	resp = await client.get(f"/api/v1/habits/{habit_id}/stats", headers=_auth(token))
	assert resp.status_code == 200
	body = resp.json()
	assert body["current_streak"]["length"] == 0
	assert body["best_streak"]["length"] == 0
	assert body["records"]["best_month"] is None
	assert body["records"]["best_year"] is None


@pytest.mark.anyio
async def test_stats_for_other_users_habit_returns_404(client: AsyncClient) -> None:
	token_a = await _register_and_login(client, "user_a@example.com")
	token_b = await _register_and_login(client, "user_b@example.com")
	habit_a = await _make_habit(client, token_a)

	resp = await client.get(f"/api/v1/habits/{habit_a}/stats", headers=_auth(token_b))
	assert resp.status_code == 404


@pytest.mark.anyio
async def test_stats_for_custom_frequency_returns_empty_payload(
	client: AsyncClient,
) -> None:
	"""CUSTOM habits have no scheduling logic — return empty stats, not 422."""
	token = await _register_and_login(client)
	habit_id = await _make_habit(client, token, frequency="CUSTOM")

	resp = await client.get(f"/api/v1/habits/{habit_id}/stats", headers=_auth(token))
	assert resp.status_code == 200
	body = resp.json()
	assert body["current_streak"]["length"] == 0
	assert body["best_streak"]["length"] == 0
	assert body["periods"] == {}


# ---------------------------------------------------------------------------
# streaks
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_best_streak_finds_longest_run(client: AsyncClient) -> None:
	"""DAILY habit. Logs: Jan 1-5 (5-day run), gap, Jan 10-12 (3-day run).
	Best streak = 5, Jan 1 to Jan 5.
	"""
	token = await _register_and_login(client)
	habit_id = await _make_habit(client, token)

	for d in ("2026-01-01", "2026-01-02", "2026-01-03", "2026-01-04", "2026-01-05"):
		await _log_on(client, token, habit_id, d)
	for d in ("2026-01-10", "2026-01-11", "2026-01-12"):
		await _log_on(client, token, habit_id, d)

	resp = await client.get(f"/api/v1/habits/{habit_id}/stats", headers=_auth(token))
	body = resp.json()
	assert body["best_streak"]["length"] == 5
	assert body["best_streak"]["start_date"] == "2026-01-01"
	assert body["best_streak"]["end_date"] == "2026-01-05"


@pytest.mark.anyio
async def test_current_streak_broken_by_failed_day(client: AsyncClient) -> None:
	"""Once a day in the past is FAILED (unlogged for DO), the current
	streak walking backwards from now must stop at that gap.
	"""
	token = await _register_and_login(client)
	habit_id = await _make_habit(client, token)

	# Log Jan 1-3, skip Jan 4, log Jan 5
	for d in ("2026-01-01", "2026-01-02", "2026-01-03", "2026-01-05"):
		await _log_on(client, token, habit_id, d)

	resp = await client.get(f"/api/v1/habits/{habit_id}/stats", headers=_auth(token))
	body = resp.json()
	# Best streak = 3 (Jan 1-3)
	assert body["best_streak"]["length"] == 3
	# Current streak walks backwards from today (~June 2026), and since Jan 6+ are all
	# FAILED, hits a FAIL almost immediately -> 0
	assert body["current_streak"]["length"] == 0


@pytest.mark.anyio
async def test_weekly_streak_counts_weeks(client: AsyncClient) -> None:
	"""WEEKLY target=3, log 3 events in two consecutive weeks -> 2-week streak."""
	token = await _register_and_login(client)
	habit_id = await _make_habit(
		client, token,
		name="Run 3x/week", frequency="WEEKLY", target_per_period=3,
	)

	# Week of 2026-01-05 (Mon) - 2026-01-11 (Sun): log Mon/Wed/Fri
	for d in ("2026-01-05", "2026-01-07", "2026-01-09"):
		await _log_on(client, token, habit_id, d)
	# Week of 2026-01-12 - 2026-01-18: log Tue/Thu/Sat
	for d in ("2026-01-13", "2026-01-15", "2026-01-17"):
		await _log_on(client, token, habit_id, d)

	resp = await client.get(f"/api/v1/habits/{habit_id}/stats", headers=_auth(token))
	body = resp.json()
	assert body["best_streak"]["length"] == 2


# ---------------------------------------------------------------------------
# completion rate (DO habits)
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_day_view_rate_for_daily_habit(client: AsyncClient) -> None:
	"""DAILY 2x: day view -> events/2."""
	token = await _register_and_login(client)
	habit_id = await _make_habit(
		client, token, name="Drink 2", target_per_period=2,
	)

	# Log today twice (default amount=1 each)
	await client.post(
		f"/api/v1/habits/{habit_id}/log", json={}, headers=_auth(token),
	)
	await client.post(
		f"/api/v1/habits/{habit_id}/log", json={}, headers=_auth(token),
	)

	resp = await client.get(f"/api/v1/habits/{habit_id}/stats", headers=_auth(token))
	day = resp.json()["periods"]["day"]
	assert day["events"] == 2.0
	assert day["expected"] == 2.0
	assert day["completion_rate"] == pytest.approx(1.0)


@pytest.mark.anyio
async def test_day_view_for_weekly_habit_returns_no_rate_on_non_monday(
	client: AsyncClient,
) -> None:
	"""WEEKLY habit on a Tuesday -> day view has no expected/rate (period is the week)."""
	token = await _register_and_login(client)
	habit_id = await _make_habit(
		client, token, name="Weekly", frequency="WEEKLY", target_per_period=3,
	)

	# Stats endpoint uses "today" — we can't pick the date, so this test relies on
	# the assertion holding regardless of today's weekday: events count is 0,
	# expected is either None (most days) or 3.0 (if today happens to be Monday).
	resp = await client.get(f"/api/v1/habits/{habit_id}/stats", headers=_auth(token))
	day = resp.json()["periods"]["day"]
	assert day["events"] == 0.0
	# On a non-Monday the expected/rate are null; on Monday they're 3 / None
	# (no logs). Either way completion_rate is null.
	assert day["completion_rate"] is None


# ---------------------------------------------------------------------------
# period-success semantics
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_overshoot_does_not_inflate_rate(client: AsyncClient) -> None:
	"""DAILY 1x over Jan 1-2: Jan 1 logged 10x, Jan 2 missed.
	Volume math would say 10/2 = 500%; period-success says 1 of 2 days = 50%.
	"""
	token = await _register_and_login(client)
	habit_id = await _make_habit(client, token, end_date="2026-01-02")
	await _log_on(client, token, habit_id, "2026-01-01", amount=10)

	resp = await client.get(f"/api/v1/habits/{habit_id}/stats", headers=_auth(token))
	all_time = resp.json()["periods"]["all_time"]
	assert all_time["events"] == 10.0			# volume still reported raw
	assert all_time["periods_succeeded"] == 1
	assert all_time["periods_total"] == 2
	assert all_time["completion_rate"] == pytest.approx(0.5)


@pytest.mark.anyio
async def test_weekly_rate_counts_period_successes(client: AsyncClient) -> None:
	"""WEEKLY 3x over two weeks: week 1 hits target, week 2 logs only once.
	Rate = 1 successful week of 2 = 50% (not 4 events / 6 expected = 67%).
	"""
	token = await _register_and_login(client)
	habit_id = await _make_habit(
		client, token,
		name="Run 3x/week", frequency="WEEKLY", target_per_period=3,
		end_date="2026-01-18",
	)

	# Week of Jan 5-11: 3 logs -> SUCCESS
	for d in ("2026-01-05", "2026-01-07", "2026-01-09"):
		await _log_on(client, token, habit_id, d)
	# Week of Jan 12-18: 1 log -> FAILED
	await _log_on(client, token, habit_id, "2026-01-13")

	resp = await client.get(f"/api/v1/habits/{habit_id}/stats", headers=_auth(token))
	all_time = resp.json()["periods"]["all_time"]
	assert all_time["periods_succeeded"] == 1
	assert all_time["periods_total"] == 2
	assert all_time["completion_rate"] == pytest.approx(0.5)


@pytest.mark.anyio
async def test_avoid_habit_gets_clean_period_rate(client: AsyncClient) -> None:
	"""AVOID target=0 over Jan 1-4 with one slip on Jan 2 -> 3/4 clean days."""
	token = await _register_and_login(client)
	habit_id = await _make_habit(client, token, mode="AVOID", end_date="2026-01-04")
	await _log_on(client, token, habit_id, "2026-01-02")

	resp = await client.get(f"/api/v1/habits/{habit_id}/stats", headers=_auth(token))
	all_time = resp.json()["periods"]["all_time"]
	assert all_time["periods_succeeded"] == 3
	assert all_time["periods_total"] == 4
	assert all_time["completion_rate"] == pytest.approx(0.75)


@pytest.mark.anyio
async def test_pending_today_excluded_from_rate(client: AsyncClient) -> None:
	"""DAILY habit with nothing logged today: the day view's only period is
	PENDING, so nothing has been judged and the rate is null (not 0%).
	"""
	token = await _register_and_login(client)
	habit_id = await _make_habit(client, token)

	resp = await client.get(f"/api/v1/habits/{habit_id}/stats", headers=_auth(token))
	day = resp.json()["periods"]["day"]
	assert day["periods_total"] == 0
	assert day["completion_rate"] is None


# ---------------------------------------------------------------------------
# records
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_best_month_for_do_habit(client: AsyncClient) -> None:
	token = await _register_and_login(client)
	habit_id = await _make_habit(client, token)

	# 3 logs in January, 5 in February
	for d in ("2026-01-01", "2026-01-02", "2026-01-03"):
		await _log_on(client, token, habit_id, d)
	for d in ("2026-02-01", "2026-02-02", "2026-02-03", "2026-02-04", "2026-02-05"):
		await _log_on(client, token, habit_id, d)

	resp = await client.get(f"/api/v1/habits/{habit_id}/stats", headers=_auth(token))
	rec = resp.json()["records"]
	assert rec["best_month"]["month"] == "2026-02"
	assert rec["best_month"]["count"] == 5.0
	assert rec["best_year"]["year"] == "2026"
	assert rec["best_year"]["count"] == 8.0


@pytest.mark.anyio
async def test_records_for_avoid_habit_are_empty(client: AsyncClient) -> None:
	"""AVOID habits skip records — 'best month' would be misleading."""
	token = await _register_and_login(client)
	habit_id = await _make_habit(client, token, mode="AVOID")
	await _log_on(client, token, habit_id, "2026-01-01")		# one slip

	resp = await client.get(f"/api/v1/habits/{habit_id}/stats", headers=_auth(token))
	rec = resp.json()["records"]
	assert rec["best_month"] is None
	assert rec["best_year"] is None


# ---------------------------------------------------------------------------
# aggregate overview
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_overview_streaks_and_totals_ignore_range_filter(
	client: AsyncClient,
) -> None:
	"""Streaks and totals are all-time facts. A 21-day run must survive a
	'last week' range filter — only completion_rate respects the range.
	"""
	token = await _register_and_login(client)
	today = date.today()
	start = today - timedelta(days=20)
	habit_id = await _make_habit(client, token, start_date=start.isoformat())
	for i in range(21):		# every day from start through today
		await _log_on(client, token, habit_id, (start + timedelta(days=i)).isoformat())

	week_start = (today - timedelta(days=7)).isoformat()
	resp = await client.get(
		f"/api/v1/stats/overview?start={week_start}", headers=_auth(token),
	)
	assert resp.status_code == 200
	body = resp.json()
	assert body["active_streak_count"] == 1
	assert body["today_done"] == 1
	assert body["today_total"] == 1

	h = body["habits"][0]
	assert h["current_streak"] == 21
	assert h["best_streak"] == 21
	assert h["total_events"] == 21.0
	assert h["completion_rate"] == pytest.approx(1.0)


@pytest.mark.anyio
async def test_overview_avoid_habit_clean_rate_and_slip(client: AsyncClient) -> None:
	"""AVOID summary: clean-period rate, and days_since_last_slip counts from
	the last FAILED period (not merely the last log)."""
	token = await _register_and_login(client)
	today = date.today()
	start = today - timedelta(days=9)
	habit_id = await _make_habit(
		client, token, mode="AVOID", start_date=start.isoformat(),
	)
	slip = today - timedelta(days=3)
	await _log_on(client, token, habit_id, slip.isoformat())

	resp = await client.get("/api/v1/stats/overview", headers=_auth(token))
	assert resp.status_code == 200
	h = resp.json()["avoid_habits"][0]
	# 10 judged days (AVOID has no PENDING), 1 slip -> 9/10 clean
	assert h["completion_rate"] == pytest.approx(0.9)
	assert h["days_since_last_slip"] == 3
	assert h["current_streak"] == 3


# ---------------------------------------------------------------------------
# AVOID + streaks
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_avoid_streak_counts_clean_days(client: AsyncClient) -> None:
	"""AVOID target=0: no logs Jan 1-5 -> 5-day SUCCESS streak.
	Log on Jan 6 -> streak breaks. Use end_date=Jan 10 so the post-Jan-6
	clean run is only 4 days, making the Jan 1-5 streak the longest.
	"""
	token = await _register_and_login(client)
	habit_id = await _make_habit(
		client, token, mode="AVOID", end_date="2026-01-10",
	)

	# Log one slip on Jan 6
	await _log_on(client, token, habit_id, "2026-01-06")

	resp = await client.get(f"/api/v1/habits/{habit_id}/stats", headers=_auth(token))
	body = resp.json()
	# Jan 1-5: 5 clean, Jan 6 FAIL, Jan 7-10: 4 clean. Best = 5.
	assert body["best_streak"]["length"] == 5
	assert body["best_streak"]["start_date"] == "2026-01-01"
	assert body["best_streak"]["end_date"] == "2026-01-05"
