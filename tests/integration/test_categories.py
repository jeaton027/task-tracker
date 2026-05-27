import pytest
from httpx import AsyncClient

# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

async def _register_and_login(client: AsyncClient, email: str = "cat@example.com") -> str:
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
async def test_register_seeds_default_categories(client: AsyncClient) -> None:
	token = await _register_and_login(client)
	resp = await client.get("/api/v1/categories", headers=_auth(token))
	assert resp.status_code == 200
	names = [c["name"] for c in resp.json()]
	assert names == ["Morning", "Day", "Evening"]


# ---------------------------------------------------------------------------
# create
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_create_category(client: AsyncClient) -> None:
	token = await _register_and_login(client)
	resp = await client.post(
		"/api/v1/categories",
		json={"name": "Work"},
		headers=_auth(token),
	)
	assert resp.status_code == 201
	assert resp.json()["name"] == "Work"


@pytest.mark.anyio
async def test_create_duplicate_category_fails(client: AsyncClient) -> None:
	token = await _register_and_login(client)
	await client.post("/api/v1/categories", json={"name": "Work"}, headers=_auth(token))
	resp = await client.post("/api/v1/categories", json={"name": "Work"}, headers=_auth(token))
	assert resp.status_code == 409


@pytest.mark.anyio
async def test_categories_are_user_scoped(client: AsyncClient) -> None:
	"""Two different users should have separate categories."""
	token_a = await _register_and_login(client, "user_a@example.com")
	token_b = await _register_and_login(client, "user_b@example.com")

	await client.post("/api/v1/categories", json={"name": "Private"}, headers=_auth(token_a))

	resp_b = await client.get("/api/v1/categories", headers=_auth(token_b))
	names_b = [c["name"] for c in resp_b.json()]
	assert "Private" not in names_b


# ---------------------------------------------------------------------------
# get single
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_get_category(client: AsyncClient) -> None:
	token = await _register_and_login(client)
	create = await client.post(
		"/api/v1/categories", json={"name": "Work"}, headers=_auth(token)
	)
	cat_id = create.json()["id"]
	resp = await client.get(f"/api/v1/categories/{cat_id}", headers=_auth(token))
	assert resp.status_code == 200
	assert resp.json()["name"] == "Work"


@pytest.mark.anyio
async def test_get_another_users_category_returns_404(client: AsyncClient) -> None:
	token_a = await _register_and_login(client, "user_a@example.com")
	token_b = await _register_and_login(client, "user_b@example.com")

	create = await client.post(
		"/api/v1/categories", json={"name": "Secret"}, headers=_auth(token_a)
	)
	cat_id = create.json()["id"]

	resp = await client.get(f"/api/v1/categories/{cat_id}", headers=_auth(token_b))
	assert resp.status_code == 404


# ---------------------------------------------------------------------------
# update
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_update_category(client: AsyncClient) -> None:
	token = await _register_and_login(client)
	create = await client.post(
		"/api/v1/categories", json={"name": "Old Name"}, headers=_auth(token)
	)
	cat_id = create.json()["id"]
	resp = await client.patch(
		f"/api/v1/categories/{cat_id}",
		json={"name": "New Name"},
		headers=_auth(token),
	)
	assert resp.status_code == 200
	assert resp.json()["name"] == "New Name"


# ---------------------------------------------------------------------------
# delete
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_delete_category(client: AsyncClient) -> None:
	token = await _register_and_login(client)
	create = await client.post(
		"/api/v1/categories", json={"name": "Temporary"}, headers=_auth(token)
	)
	cat_id = create.json()["id"]
	del_resp = await client.delete(f"/api/v1/categories/{cat_id}", headers=_auth(token))
	assert del_resp.status_code == 204

	get_resp = await client.get(f"/api/v1/categories/{cat_id}", headers=_auth(token))
	assert get_resp.status_code == 404


@pytest.mark.anyio
async def test_delete_another_users_category_returns_404(client: AsyncClient) -> None:
	token_a = await _register_and_login(client, "user_a@example.com")
	token_b = await _register_and_login(client, "user_b@example.com")

	create = await client.post(
		"/api/v1/categories", json={"name": "Mine"}, headers=_auth(token_a)
	)
	cat_id = create.json()["id"]

	resp = await client.delete(f"/api/v1/categories/{cat_id}", headers=_auth(token_b))
	assert resp.status_code == 404
