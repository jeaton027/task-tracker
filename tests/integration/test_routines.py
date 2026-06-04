"""Tests for /routines CRUD (Chunk 3 — no sessions yet)."""
import pytest
from httpx import AsyncClient


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

async def _register_and_login(client: AsyncClient, email: str = "rou@example.com") -> str:
	creds = {"email": email, "password": "securepassword123"}
	await client.post("/api/v1/auth/register", json=creds)
	resp = await client.post("/api/v1/auth/login", json=creds)
	return resp.json()["access_token"]


def _auth(token: str) -> dict:
	return {"Authorization": f"Bearer {token}"}


async def _first_category_id(client: AsyncClient, token: str) -> str:
	resp = await client.get("/api/v1/categories", headers=_auth(token))
	return resp.json()[0]["id"]


async def _make_habit(client: AsyncClient, token: str, cat_id: str, name: str = "Habit") -> str:
	body = {
		"name": name, "mode": "DO", "frequency": "DAILY",
		"start_date": "2026-01-01", "category_id": cat_id,
	}
	resp = await client.post("/api/v1/habits", json=body, headers=_auth(token))
	return resp.json()["id"]


def _routine_payload(**overrides) -> dict:
	base = {
		"name": "Morning",
		"frequency": "DAILY",
		"start_date": "2026-01-01",
	}
	base.update(overrides)
	return base


# ---------------------------------------------------------------------------
# list
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_new_user_has_no_routines(client: AsyncClient) -> None:
	token = await _register_and_login(client)
	resp = await client.get("/api/v1/routines", headers=_auth(token))
	assert resp.status_code == 200
	assert resp.json() == []


# ---------------------------------------------------------------------------
# create — basics
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_create_empty_daily_routine(client: AsyncClient) -> None:
	token = await _register_and_login(client)
	resp = await client.post(
		"/api/v1/routines", json=_routine_payload(), headers=_auth(token),
	)
	assert resp.status_code == 201
	body = resp.json()
	assert body["name"] == "Morning"
	assert body["frequency"] == "DAILY"
	assert body["habits"] == []
	assert body["is_active"] is True


@pytest.mark.anyio
async def test_create_routine_with_habit_slots(client: AsyncClient) -> None:
	token = await _register_and_login(client)
	cat_id = await _first_category_id(client, token)
	a = await _make_habit(client, token, cat_id, "Stretch")
	b = await _make_habit(client, token, cat_id, "Brush teeth")

	resp = await client.post(
		"/api/v1/routines",
		json=_routine_payload(
			habits=[
				{"habit_id": a, "timer_seconds": 300, "timer_type": "COUNTDOWN"},
				{"habit_id": b, "timer_seconds": 120, "timer_type": "TIMER"},
			],
		),
		headers=_auth(token),
	)
	assert resp.status_code == 201
	slots = resp.json()["habits"]
	assert len(slots) == 2
	# position derived from array order
	assert slots[0]["position"] == 0
	assert slots[1]["position"] == 1
	assert slots[0]["habit"]["id"] == a
	assert slots[0]["timer_seconds"] == 300
	assert slots[0]["timer_type"] == "COUNTDOWN"
	assert slots[1]["timer_type"] == "TIMER"


@pytest.mark.anyio
async def test_create_weekly_routine_with_scheduled_weekdays(
	client: AsyncClient,
) -> None:
	token = await _register_and_login(client)
	resp = await client.post(
		"/api/v1/routines",
		json=_routine_payload(
			name="Workout", frequency="WEEKLY", scheduled_weekdays=[0, 2, 4],
		),
		headers=_auth(token),
	)
	assert resp.status_code == 201
	assert resp.json()["scheduled_weekdays"] == [0, 2, 4]


@pytest.mark.anyio
async def test_create_monthly_routine_with_scheduled_days(
	client: AsyncClient,
) -> None:
	token = await _register_and_login(client)
	resp = await client.post(
		"/api/v1/routines",
		json=_routine_payload(
			name="Bills", frequency="MONTHLY", scheduled_days_of_month=[1, 15],
		),
		headers=_auth(token),
	)
	assert resp.status_code == 201
	assert resp.json()["scheduled_days_of_month"] == [1, 15]


# ---------------------------------------------------------------------------
# create — validation
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_create_daily_routine_cannot_set_scheduled(client: AsyncClient) -> None:
	token = await _register_and_login(client)
	resp = await client.post(
		"/api/v1/routines",
		json=_routine_payload(scheduled_weekdays=[0]),
		headers=_auth(token),
	)
	assert resp.status_code == 422


@pytest.mark.anyio
async def test_create_weekly_routine_requires_weekdays(client: AsyncClient) -> None:
	token = await _register_and_login(client)
	resp = await client.post(
		"/api/v1/routines",
		json=_routine_payload(frequency="WEEKLY"),	# no scheduled_weekdays
		headers=_auth(token),
	)
	assert resp.status_code == 422


@pytest.mark.anyio
async def test_create_routine_timer_partial_fails(client: AsyncClient) -> None:
	"""timer_seconds set without timer_type (or vice versa) is invalid."""
	token = await _register_and_login(client)
	cat_id = await _first_category_id(client, token)
	a = await _make_habit(client, token, cat_id)

	resp = await client.post(
		"/api/v1/routines",
		json=_routine_payload(
			habits=[{"habit_id": a, "timer_seconds": 300}],		# no timer_type
		),
		headers=_auth(token),
	)
	assert resp.status_code == 422


@pytest.mark.anyio
async def test_create_routine_duplicate_habit_fails(client: AsyncClient) -> None:
	token = await _register_and_login(client)
	cat_id = await _first_category_id(client, token)
	a = await _make_habit(client, token, cat_id)

	resp = await client.post(
		"/api/v1/routines",
		json=_routine_payload(
			habits=[{"habit_id": a}, {"habit_id": a}],
		),
		headers=_auth(token),
	)
	assert resp.status_code == 422


@pytest.mark.anyio
async def test_create_routine_with_other_users_habit_returns_404(
	client: AsyncClient,
) -> None:
	token_a = await _register_and_login(client, "user_a@example.com")
	token_b = await _register_and_login(client, "user_b@example.com")
	cat_a = await _first_category_id(client, token_a)
	habit_a = await _make_habit(client, token_a, cat_a)

	resp = await client.post(
		"/api/v1/routines",
		json=_routine_payload(habits=[{"habit_id": habit_a}]),
		headers=_auth(token_b),
	)
	assert resp.status_code == 404


@pytest.mark.anyio
async def test_create_duplicate_routine_name_fails(client: AsyncClient) -> None:
	token = await _register_and_login(client)
	await client.post("/api/v1/routines", json=_routine_payload(), headers=_auth(token))
	resp = await client.post(
		"/api/v1/routines", json=_routine_payload(), headers=_auth(token),
	)
	assert resp.status_code == 409


# ---------------------------------------------------------------------------
# get / scope
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_get_routine(client: AsyncClient) -> None:
	token = await _register_and_login(client)
	create = await client.post(
		"/api/v1/routines", json=_routine_payload(), headers=_auth(token),
	)
	rid = create.json()["id"]
	resp = await client.get(f"/api/v1/routines/{rid}", headers=_auth(token))
	assert resp.status_code == 200
	assert resp.json()["id"] == rid


@pytest.mark.anyio
async def test_get_other_users_routine_returns_404(client: AsyncClient) -> None:
	token_a = await _register_and_login(client, "user_a@example.com")
	token_b = await _register_and_login(client, "user_b@example.com")
	create = await client.post(
		"/api/v1/routines", json=_routine_payload(), headers=_auth(token_a),
	)
	rid = create.json()["id"]
	resp = await client.get(f"/api/v1/routines/{rid}", headers=_auth(token_b))
	assert resp.status_code == 404


@pytest.mark.anyio
async def test_routines_user_scoped(client: AsyncClient) -> None:
	token_a = await _register_and_login(client, "user_a@example.com")
	token_b = await _register_and_login(client, "user_b@example.com")
	await client.post(
		"/api/v1/routines",
		json=_routine_payload(name="A only"),
		headers=_auth(token_a),
	)
	resp_b = await client.get("/api/v1/routines", headers=_auth(token_b))
	assert resp_b.json() == []


# ---------------------------------------------------------------------------
# update
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_update_routine_name(client: AsyncClient) -> None:
	token = await _register_and_login(client)
	create = await client.post(
		"/api/v1/routines",
		json=_routine_payload(name="Old"),
		headers=_auth(token),
	)
	rid = create.json()["id"]
	resp = await client.patch(
		f"/api/v1/routines/{rid}", json={"name": "New"}, headers=_auth(token),
	)
	assert resp.status_code == 200
	assert resp.json()["name"] == "New"


@pytest.mark.anyio
async def test_update_routine_replaces_habit_slots(client: AsyncClient) -> None:
	token = await _register_and_login(client)
	cat_id = await _first_category_id(client, token)
	a = await _make_habit(client, token, cat_id, "A")
	b = await _make_habit(client, token, cat_id, "B")
	c = await _make_habit(client, token, cat_id, "C")

	create = await client.post(
		"/api/v1/routines",
		json=_routine_payload(habits=[{"habit_id": a}, {"habit_id": b}]),
		headers=_auth(token),
	)
	rid = create.json()["id"]

	resp = await client.patch(
		f"/api/v1/routines/{rid}",
		json={"habits": [{"habit_id": c}]},
		headers=_auth(token),
	)
	assert resp.status_code == 200
	slots = resp.json()["habits"]
	assert [s["habit"]["id"] for s in slots] == [c]


@pytest.mark.anyio
async def test_update_omitting_habits_leaves_slots_alone(client: AsyncClient) -> None:
	token = await _register_and_login(client)
	cat_id = await _first_category_id(client, token)
	a = await _make_habit(client, token, cat_id, "A")

	create = await client.post(
		"/api/v1/routines",
		json=_routine_payload(habits=[{"habit_id": a}]),
		headers=_auth(token),
	)
	rid = create.json()["id"]

	resp = await client.patch(
		f"/api/v1/routines/{rid}",
		json={"name": "Renamed"},
		headers=_auth(token),
	)
	assert resp.status_code == 200
	assert [s["habit"]["id"] for s in resp.json()["habits"]] == [a]


@pytest.mark.anyio
async def test_update_with_empty_habits_clears_slots(client: AsyncClient) -> None:
	token = await _register_and_login(client)
	cat_id = await _first_category_id(client, token)
	a = await _make_habit(client, token, cat_id, "A")

	create = await client.post(
		"/api/v1/routines",
		json=_routine_payload(habits=[{"habit_id": a}]),
		headers=_auth(token),
	)
	rid = create.json()["id"]

	resp = await client.patch(
		f"/api/v1/routines/{rid}", json={"habits": []}, headers=_auth(token),
	)
	assert resp.status_code == 200
	assert resp.json()["habits"] == []


# ---------------------------------------------------------------------------
# delete
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_delete_routine(client: AsyncClient) -> None:
	token = await _register_and_login(client)
	create = await client.post(
		"/api/v1/routines", json=_routine_payload(), headers=_auth(token),
	)
	rid = create.json()["id"]
	resp = await client.delete(f"/api/v1/routines/{rid}", headers=_auth(token))
	assert resp.status_code == 204

	get_resp = await client.get(f"/api/v1/routines/{rid}", headers=_auth(token))
	assert get_resp.status_code == 404


@pytest.mark.anyio
async def test_deleting_habit_cascades_routine_slot(client: AsyncClient) -> None:
	"""When a habit is deleted, its slot in any routine is also removed (FK CASCADE)."""
	token = await _register_and_login(client)
	cat_id = await _first_category_id(client, token)
	a = await _make_habit(client, token, cat_id, "A")
	b = await _make_habit(client, token, cat_id, "B")

	create = await client.post(
		"/api/v1/routines",
		json=_routine_payload(habits=[{"habit_id": a}, {"habit_id": b}]),
		headers=_auth(token),
	)
	rid = create.json()["id"]

	# delete habit a
	await client.delete(f"/api/v1/habits/{a}", headers=_auth(token))

	resp = await client.get(f"/api/v1/routines/{rid}", headers=_auth(token))
	remaining_ids = [s["habit"]["id"] for s in resp.json()["habits"]]
	assert remaining_ids == [b]
