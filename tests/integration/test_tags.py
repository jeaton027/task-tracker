import pytest
from httpx import AsyncClient

# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

async def _register_and_login(client: AsyncClient, email: str = "tag@example.com") -> str:
	"""Register a user and return their access token."""
	creds = {"email": email, "password": "securepassword123"}
	await client.post("/api/v1/auth/register", json=creds)
	resp = await client.post("/api/v1/auth/login", json=creds)
	return resp.json()["access_token"]


def _auth(token: str) -> dict:
	"""Return Authorization header dict."""
	return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# list
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_new_user_has_no_tags(client: AsyncClient) -> None:
	"""Tags are freeform — nothing is seeded on registration."""
	token = await _register_and_login(client)
	resp = await client.get("/api/v1/tags", headers=_auth(token))
	assert resp.status_code == 200
	assert resp.json() == []


# ---------------------------------------------------------------------------
# create
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_create_tag(client: AsyncClient) -> None:
	token = await _register_and_login(client)
	resp = await client.post(
		"/api/v1/tags",
		json={"name": "health"},
		headers=_auth(token),
	)
	assert resp.status_code == 201
	assert resp.json()["name"] == "health"


@pytest.mark.anyio
async def test_create_duplicate_tag_fails(client: AsyncClient) -> None:
	token = await _register_and_login(client)
	await client.post("/api/v1/tags", json={"name": "health"}, headers=_auth(token))
	resp = await client.post("/api/v1/tags", json={"name": "health"}, headers=_auth(token))
	assert resp.status_code == 409


@pytest.mark.anyio
async def test_tags_are_user_scoped(client: AsyncClient) -> None:
	"""Two different users should have separate tags."""
	token_a = await _register_and_login(client, "user_a@example.com")
	token_b = await _register_and_login(client, "user_b@example.com")

	await client.post("/api/v1/tags", json={"name": "private"}, headers=_auth(token_a))

	resp_b = await client.get("/api/v1/tags", headers=_auth(token_b))
	names_b = [t["name"] for t in resp_b.json()]
	assert "private" not in names_b


# ---------------------------------------------------------------------------
# get single
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_get_tag(client: AsyncClient) -> None:
	token = await _register_and_login(client)
	create = await client.post(
		"/api/v1/tags", json={"name": "work"}, headers=_auth(token)
	)
	tag_id = create.json()["id"]
	resp = await client.get(f"/api/v1/tags/{tag_id}", headers=_auth(token))
	assert resp.status_code == 200
	assert resp.json()["name"] == "work"


@pytest.mark.anyio
async def test_get_another_users_tag_returns_404(client: AsyncClient) -> None:
	token_a = await _register_and_login(client, "user_a@example.com")
	token_b = await _register_and_login(client, "user_b@example.com")

	create = await client.post(
		"/api/v1/tags", json={"name": "secret"}, headers=_auth(token_a)
	)
	tag_id = create.json()["id"]

	resp = await client.get(f"/api/v1/tags/{tag_id}", headers=_auth(token_b))
	assert resp.status_code == 404


# ---------------------------------------------------------------------------
# update
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_update_tag(client: AsyncClient) -> None:
	token = await _register_and_login(client)
	create = await client.post(
		"/api/v1/tags", json={"name": "old-name"}, headers=_auth(token)
	)
	tag_id = create.json()["id"]
	resp = await client.patch(
		f"/api/v1/tags/{tag_id}",
		json={"name": "new-name"},
		headers=_auth(token),
	)
	assert resp.status_code == 200
	assert resp.json()["name"] == "new-name"


# ---------------------------------------------------------------------------
# delete
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_delete_tag(client: AsyncClient) -> None:
	token = await _register_and_login(client)
	create = await client.post(
		"/api/v1/tags", json={"name": "temporary"}, headers=_auth(token)
	)
	tag_id = create.json()["id"]
	del_resp = await client.delete(f"/api/v1/tags/{tag_id}", headers=_auth(token))
	assert del_resp.status_code == 204

	get_resp = await client.get(f"/api/v1/tags/{tag_id}", headers=_auth(token))
	assert get_resp.status_code == 404


@pytest.mark.anyio
async def test_delete_another_users_tag_returns_404(client: AsyncClient) -> None:
	token_a = await _register_and_login(client, "user_a@example.com")
	token_b = await _register_and_login(client, "user_b@example.com")

	create = await client.post(
		"/api/v1/tags", json={"name": "mine"}, headers=_auth(token_a)
	)
	tag_id = create.json()["id"]

	resp = await client.delete(f"/api/v1/tags/{tag_id}", headers=_auth(token_b))
	assert resp.status_code == 404
