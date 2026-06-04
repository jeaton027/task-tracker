"""Tests for routine session endpoints (Chunk 4: start/complete/list)."""
import pytest
from httpx import AsyncClient


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

async def _register_and_login(client: AsyncClient, email: str = "ses@example.com") -> str:
	creds = {"email": email, "password": "securepassword123"}
	await client.post("/api/v1/auth/register", json=creds)
	resp = await client.post("/api/v1/auth/login", json=creds)
	return resp.json()["access_token"]


def _auth(token: str) -> dict:
	return {"Authorization": f"Bearer {token}"}


async def _make_routine(client: AsyncClient, token: str, name: str = "Morning") -> str:
	body = {"name": name, "frequency": "DAILY", "start_date": "2026-01-01"}
	resp = await client.post("/api/v1/routines", json=body, headers=_auth(token))
	return resp.json()["id"]


# ---------------------------------------------------------------------------
# POST /routines/{id}/start
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_start_session(client: AsyncClient) -> None:
	token = await _register_and_login(client)
	rid = await _make_routine(client, token)

	resp = await client.post(f"/api/v1/routines/{rid}/start", headers=_auth(token))
	assert resp.status_code == 201
	body = resp.json()
	assert body["routine_id"] == rid
	assert body["status"] == "IN_PROGRESS"
	assert body["completed_at"] is None
	assert body["abandoned_at"] is None
	assert body["duration_seconds"] is None


@pytest.mark.anyio
async def test_starting_new_session_abandons_old_one(client: AsyncClient) -> None:
	"""Only one in-progress session per routine — starting a new one abandons the old."""
	token = await _register_and_login(client)
	rid = await _make_routine(client, token)

	first = await client.post(f"/api/v1/routines/{rid}/start", headers=_auth(token))
	first_id = first.json()["id"]

	second = await client.post(f"/api/v1/routines/{rid}/start", headers=_auth(token))
	assert second.status_code == 201
	assert second.json()["id"] != first_id

	# verify first is now abandoned
	resp = await client.patch(
		f"/api/v1/routines/sessions/{first_id}/complete", headers=_auth(token),
	)
	assert resp.status_code == 409


@pytest.mark.anyio
async def test_start_non_existent_routine_returns_404(client: AsyncClient) -> None:
	token = await _register_and_login(client)
	bogus = "00000000-0000-0000-0000-000000000000"
	resp = await client.post(f"/api/v1/routines/{bogus}/start", headers=_auth(token))
	assert resp.status_code == 404


@pytest.mark.anyio
async def test_start_other_users_routine_returns_404(client: AsyncClient) -> None:
	token_a = await _register_and_login(client, "user_a@example.com")
	token_b = await _register_and_login(client, "user_b@example.com")
	rid_a = await _make_routine(client, token_a)

	resp = await client.post(f"/api/v1/routines/{rid_a}/start", headers=_auth(token_b))
	assert resp.status_code == 404


# ---------------------------------------------------------------------------
# PATCH /routines/sessions/{id}/complete
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_complete_session(client: AsyncClient) -> None:
	token = await _register_and_login(client)
	rid = await _make_routine(client, token)
	start = await client.post(f"/api/v1/routines/{rid}/start", headers=_auth(token))
	sid = start.json()["id"]

	resp = await client.patch(
		f"/api/v1/routines/sessions/{sid}/complete", headers=_auth(token),
	)
	assert resp.status_code == 200
	body = resp.json()
	assert body["status"] == "COMPLETED"
	assert body["completed_at"] is not None
	# duration_seconds computed and non-negative
	assert body["duration_seconds"] is not None
	assert body["duration_seconds"] >= 0


@pytest.mark.anyio
async def test_completing_twice_is_idempotent(client: AsyncClient) -> None:
	token = await _register_and_login(client)
	rid = await _make_routine(client, token)
	start = await client.post(f"/api/v1/routines/{rid}/start", headers=_auth(token))
	sid = start.json()["id"]

	first = await client.patch(
		f"/api/v1/routines/sessions/{sid}/complete", headers=_auth(token),
	)
	second = await client.patch(
		f"/api/v1/routines/sessions/{sid}/complete", headers=_auth(token),
	)
	assert first.status_code == 200
	assert second.status_code == 200
	# completed_at is the same — second call didn't overwrite it
	assert first.json()["completed_at"] == second.json()["completed_at"]


@pytest.mark.anyio
async def test_completing_abandoned_session_returns_409(client: AsyncClient) -> None:
	token = await _register_and_login(client)
	rid = await _make_routine(client, token)

	first = await client.post(f"/api/v1/routines/{rid}/start", headers=_auth(token))
	first_id = first.json()["id"]
	# starting another session abandons the first
	await client.post(f"/api/v1/routines/{rid}/start", headers=_auth(token))

	resp = await client.patch(
		f"/api/v1/routines/sessions/{first_id}/complete", headers=_auth(token),
	)
	assert resp.status_code == 409


@pytest.mark.anyio
async def test_complete_other_users_session_returns_404(client: AsyncClient) -> None:
	token_a = await _register_and_login(client, "user_a@example.com")
	token_b = await _register_and_login(client, "user_b@example.com")
	rid_a = await _make_routine(client, token_a)
	start = await client.post(f"/api/v1/routines/{rid_a}/start", headers=_auth(token_a))
	sid = start.json()["id"]

	resp = await client.patch(
		f"/api/v1/routines/sessions/{sid}/complete", headers=_auth(token_b),
	)
	assert resp.status_code == 404


# ---------------------------------------------------------------------------
# GET /routines/{id}/sessions
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_list_sessions_for_month(client: AsyncClient) -> None:
	token = await _register_and_login(client)
	rid = await _make_routine(client, token)

	# create a session and complete it
	start = await client.post(f"/api/v1/routines/{rid}/start", headers=_auth(token))
	sid = start.json()["id"]
	await client.patch(
		f"/api/v1/routines/sessions/{sid}/complete", headers=_auth(token),
	)

	# determine which month the session lives in (now-ish)
	from datetime import datetime, timezone
	now_month = datetime.now(timezone.utc).strftime("%Y-%m")
	resp = await client.get(
		f"/api/v1/routines/{rid}/sessions?month={now_month}", headers=_auth(token),
	)
	assert resp.status_code == 200
	body = resp.json()
	assert len(body) == 1
	assert body[0]["id"] == sid
	assert body[0]["status"] == "COMPLETED"


@pytest.mark.anyio
async def test_list_sessions_for_empty_month(client: AsyncClient) -> None:
	token = await _register_and_login(client)
	rid = await _make_routine(client, token)
	# no sessions started yet
	resp = await client.get(
		f"/api/v1/routines/{rid}/sessions?month=2026-01", headers=_auth(token),
	)
	assert resp.status_code == 200
	assert resp.json() == []


@pytest.mark.anyio
async def test_list_sessions_bad_month_format(client: AsyncClient) -> None:
	token = await _register_and_login(client)
	rid = await _make_routine(client, token)
	resp = await client.get(
		f"/api/v1/routines/{rid}/sessions?month=June2026", headers=_auth(token),
	)
	assert resp.status_code == 422


@pytest.mark.anyio
async def test_list_sessions_other_users_routine_returns_404(
	client: AsyncClient,
) -> None:
	token_a = await _register_and_login(client, "user_a@example.com")
	token_b = await _register_and_login(client, "user_b@example.com")
	rid_a = await _make_routine(client, token_a)

	resp = await client.get(
		f"/api/v1/routines/{rid_a}/sessions?month=2026-01", headers=_auth(token_b),
	)
	assert resp.status_code == 404


@pytest.mark.anyio
async def test_deleting_routine_cascades_sessions(client: AsyncClient) -> None:
	token = await _register_and_login(client)
	rid = await _make_routine(client, token)
	await client.post(f"/api/v1/routines/{rid}/start", headers=_auth(token))
	await client.delete(f"/api/v1/routines/{rid}", headers=_auth(token))

	# routine gone -> listing returns 404
	resp = await client.get(
		f"/api/v1/routines/{rid}/sessions?month=2026-01", headers=_auth(token),
	)
	assert resp.status_code == 404
