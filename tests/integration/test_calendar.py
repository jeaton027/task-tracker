"""Tests for the calendar endpoints (GET /calendar/weekly, GET /calendar/monthly)."""
import pytest
from httpx import AsyncClient


# ---------------------------------------------------------------------------
# helpers (same shape as test_habit_logs.py)
# ---------------------------------------------------------------------------

async def _register_and_login(client: AsyncClient, email: str = "cal@example.com") -> str:
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
		"name": name, "mode": mode, "frequency": frequency,
		"start_date": start_date, "category_id": cat_id, "is_active": is_active,
	}
	if end_date:
		body["end_date"] = end_date
	resp = await client.post("/api/v1/habits", json=body, headers=_auth(token))
	return resp.json()["id"]


# ---------------------------------------------------------------------------
# /calendar/weekly
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_weekly_empty_when_no_habits(client: AsyncClient) -> None:
	token = await _register_and_login(client)
	resp = await client.get("/api/v1/calendar/weekly", headers=_auth(token))
	assert resp.status_code == 200
	assert resp.json() == []


@pytest.mark.anyio
async def test_weekly_includes_amount_per_day(client: AsyncClient) -> None:
	"""Each day cell carries the actual logged amount for that day."""
	token = await _register_and_login(client)
	cat = await _first_category_id(client, token)
	habit_id = await _make_habit(client, token, cat, mode="DO")

	# log Wed 2026-01-07 twice — total 2.0
	for _ in range(2):
		await client.post(
			f"/api/v1/habits/{habit_id}/log",
			json={"log_date": "2026-01-07"},
			headers=_auth(token),
		)
	# log Fri 2026-01-09 once — total 1.0
	await client.post(
		f"/api/v1/habits/{habit_id}/log",
		json={"log_date": "2026-01-09"},
		headers=_auth(token),
	)

	resp = await client.get(
		"/api/v1/calendar/weekly?date=2026-01-07", headers=_auth(token),
	)
	days = {d["date"]: d["amount"] for d in resp.json()[0]["days"]}
	assert days["2026-01-07"] == 2.0
	assert days["2026-01-09"] == 1.0
	# unlogged day -> 0.0
	assert days["2026-01-08"] == 0.0


@pytest.mark.anyio
async def test_weekly_returns_7_days_per_habit(client: AsyncClient) -> None:
	token = await _register_and_login(client)
	cat = await _first_category_id(client, token)
	await _make_habit(client, token, cat)

	resp = await client.get(
		"/api/v1/calendar/weekly?date=2026-06-03", headers=_auth(token)
	)
	body = resp.json()
	assert len(body) == 1
	assert len(body[0]["days"]) == 7


@pytest.mark.anyio
async def test_weekly_anchors_to_monday_regardless_of_day_passed(
	client: AsyncClient,
) -> None:
	"""2026-06-03 is a Wednesday — week should still start 2026-06-01 (Mon)."""
	token = await _register_and_login(client)
	cat = await _first_category_id(client, token)
	await _make_habit(client, token, cat)

	resp = await client.get(
		"/api/v1/calendar/weekly?date=2026-06-03", headers=_auth(token)
	)
	days = resp.json()[0]["days"]
	assert days[0]["date"] == "2026-06-01"		# Monday
	assert days[-1]["date"] == "2026-06-07"		# Sunday


@pytest.mark.anyio
async def test_weekly_daily_habit_status_per_day(client: AsyncClient) -> None:
	"""DAILY habit, log one mid-week day -> SUCCESS that day, FAILED other past days."""
	token = await _register_and_login(client)
	cat = await _first_category_id(client, token)
	habit_id = await _make_habit(client, token, cat, mode="DO")

	# log Wednesday 2026-06-03
	await client.post(
		f"/api/v1/habits/{habit_id}/log",
		json={"log_date": "2026-06-03"},
		headers=_auth(token),
	)

	resp = await client.get(
		"/api/v1/calendar/weekly?date=2026-06-03", headers=_auth(token)
	)
	days = {d["date"]: d["status"] for d in resp.json()[0]["days"]}
	# 2026-06-03 is the only day with a log
	# Past unlogged days for a DO habit -> FAILED
	# Future days vs today depends on real "today" — skip those asserts
	assert days["2026-06-03"] == "SUCCESS"
	assert days["2026-06-01"] == "FAILED"
	assert days["2026-06-02"] == "FAILED"


@pytest.mark.anyio
async def test_weekly_weekly_habit_anchored_marks_non_anchor_not_scheduled(
	client: AsyncClient,
) -> None:
	"""WEEKLY habit with scheduled_weekdays=[0] -> NOT_SCHEDULED Tue-Sun.

	Uses a fully-past week (Jan 2026) so the period_end is < today, giving us
	a deterministic FAILED on the anchor Monday regardless of when this runs.
	"""
	token = await _register_and_login(client)
	cat = await _first_category_id(client, token)
	body = {
		"name": "Weekly Mon", "mode": "DO", "frequency": "WEEKLY",
		"start_date": "2026-01-01", "category_id": cat,
		"scheduled_weekdays": [0],
	}
	await client.post("/api/v1/habits", json=body, headers=_auth(token))

	# Week of 2026-01-05 (Mon) -> Sun 2026-01-11. Fully in the past.
	resp = await client.get(
		"/api/v1/calendar/weekly?date=2026-01-07", headers=_auth(token)
	)
	days = {d["date"]: d["status"] for d in resp.json()[0]["days"]}
	for tue_to_sun in [
		"2026-01-06", "2026-01-07", "2026-01-08",
		"2026-01-09", "2026-01-10", "2026-01-11",
	]:
		assert days[tue_to_sun] == "NOT_SCHEDULED"
	# Monday — anchor day, never logged, period fully past -> FAILED
	assert days["2026-01-05"] == "FAILED"


@pytest.mark.anyio
async def test_weekly_flexible_habit_all_days_scheduled(client: AsyncClient) -> None:
	"""WEEKLY without scheduled_weekdays = flexible: all 7 days due."""
	token = await _register_and_login(client)
	cat = await _first_category_id(client, token)
	await _make_habit(client, token, cat, frequency="WEEKLY")		# no schedule

	resp = await client.get(
		"/api/v1/calendar/weekly?date=2026-06-03", headers=_auth(token)
	)
	statuses = {d["status"] for d in resp.json()[0]["days"]}
	# all real statuses (no NOT_SCHEDULED) — past unlogged week -> all FAILED
	assert "NOT_SCHEDULED" not in statuses


@pytest.mark.anyio
async def test_weekly_inactive_habit_all_not_scheduled(client: AsyncClient) -> None:
	token = await _register_and_login(client)
	cat = await _first_category_id(client, token)
	await _make_habit(client, token, cat, is_active=False)

	resp = await client.get(
		"/api/v1/calendar/weekly?date=2026-06-03", headers=_auth(token)
	)
	statuses = {d["status"] for d in resp.json()[0]["days"]}
	assert statuses == {"NOT_SCHEDULED"}


@pytest.mark.anyio
async def test_weekly_avoid_inverts_status(client: AsyncClient) -> None:
	"""AVOID habit + log => FAILED; AVOID habit no log => SUCCESS."""
	token = await _register_and_login(client)
	cat = await _first_category_id(client, token)
	habit_id = await _make_habit(client, token, cat, mode="AVOID")

	await client.post(
		f"/api/v1/habits/{habit_id}/log",
		json={"log_date": "2026-06-02"},
		headers=_auth(token),
	)

	resp = await client.get(
		"/api/v1/calendar/weekly?date=2026-06-03", headers=_auth(token)
	)
	days = {d["date"]: d["status"] for d in resp.json()[0]["days"]}
	assert days["2026-06-02"] == "FAILED"		# slipped
	assert days["2026-06-01"] == "SUCCESS"		# clean day


@pytest.mark.anyio
async def test_weekly_user_scoped(client: AsyncClient) -> None:
	token_a = await _register_and_login(client, "user_a@example.com")
	token_b = await _register_and_login(client, "user_b@example.com")
	cat_a = await _first_category_id(client, token_a)
	await _make_habit(client, token_a, cat_a, name="A only")

	resp = await client.get(
		"/api/v1/calendar/weekly?date=2026-06-03", headers=_auth(token_b)
	)
	assert resp.json() == []


# ---------------------------------------------------------------------------
# /calendar/monthly
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_monthly_june_returns_30_days(client: AsyncClient) -> None:
	token = await _register_and_login(client)
	cat = await _first_category_id(client, token)
	habit_id = await _make_habit(client, token, cat)

	resp = await client.get(
		f"/api/v1/calendar/monthly?habit_id={habit_id}&month=2026-06",
		headers=_auth(token),
	)
	assert resp.status_code == 200
	body = resp.json()
	assert body["month"] == "2026-06"
	assert len(body["days"]) == 30


@pytest.mark.anyio
async def test_monthly_feb_returns_28_days(client: AsyncClient) -> None:
	token = await _register_and_login(client)
	cat = await _first_category_id(client, token)
	habit_id = await _make_habit(client, token, cat)

	resp = await client.get(
		f"/api/v1/calendar/monthly?habit_id={habit_id}&month=2026-02",
		headers=_auth(token),
	)
	assert len(resp.json()["days"]) == 28		# 2026 is not a leap year


@pytest.mark.anyio
async def test_monthly_summary_counts(client: AsyncClient) -> None:
	"""DAILY habit, log 5 days in a fully-past month. Other days -> FAILED.
	Uses Jan 2026 so the test doesn't depend on the real current date —
	mark_done would reject any log_date > today.
	"""
	token = await _register_and_login(client)
	cat = await _first_category_id(client, token)
	habit_id = await _make_habit(client, token, cat, mode="DO")

	# log 5 days in January 2026 — all safely in the past
	for day in ["2026-01-01", "2026-01-02", "2026-01-03", "2026-01-04", "2026-01-05"]:
		await client.post(
			f"/api/v1/habits/{habit_id}/log",
			json={"log_date": day},
			headers=_auth(token),
		)

	resp = await client.get(
		f"/api/v1/calendar/monthly?habit_id={habit_id}&month=2026-01",
		headers=_auth(token),
	)
	body = resp.json()
	summary = body["summary"]
	# DAILY habit -> all 31 days scheduled
	assert summary["scheduled_days"] == 31
	assert summary["successful_days"] == 5
	# successful + failed + pending should equal scheduled
	total = summary["successful_days"] + summary["failed_days"] + summary["pending_days"]
	assert total == summary["scheduled_days"]
	# success_rate matches the math
	assert summary["success_rate"] == pytest.approx(5 / 31)


@pytest.mark.anyio
async def test_monthly_weekly_anchored_only_counts_anchor_days(
	client: AsyncClient,
) -> None:
	"""WEEKLY anchored to Monday — Mondays count as scheduled, others don't."""
	token = await _register_and_login(client)
	cat = await _first_category_id(client, token)
	body = {
		"name": "Weekly Mon", "mode": "DO", "frequency": "WEEKLY",
		"start_date": "2026-01-01", "category_id": cat,
		"scheduled_weekdays": [0],
	}
	create = await client.post("/api/v1/habits", json=body, headers=_auth(token))
	habit_id = create.json()["id"]

	resp = await client.get(
		f"/api/v1/calendar/monthly?habit_id={habit_id}&month=2026-06",
		headers=_auth(token),
	)
	# June 2026 Mondays: 1, 8, 15, 22, 29 -> 5 scheduled days
	assert resp.json()["summary"]["scheduled_days"] == 5


@pytest.mark.anyio
async def test_monthly_other_users_habit_returns_404(client: AsyncClient) -> None:
	token_a = await _register_and_login(client, "user_a@example.com")
	token_b = await _register_and_login(client, "user_b@example.com")
	cat_a = await _first_category_id(client, token_a)
	habit_a = await _make_habit(client, token_a, cat_a)

	resp = await client.get(
		f"/api/v1/calendar/monthly?habit_id={habit_a}&month=2026-06",
		headers=_auth(token_b),
	)
	assert resp.status_code == 404


@pytest.mark.anyio
async def test_monthly_bad_month_format_422(client: AsyncClient) -> None:
	token = await _register_and_login(client)
	cat = await _first_category_id(client, token)
	habit_id = await _make_habit(client, token, cat)

	resp = await client.get(
		f"/api/v1/calendar/monthly?habit_id={habit_id}&month=June2026",
		headers=_auth(token),
	)
	assert resp.status_code == 422
