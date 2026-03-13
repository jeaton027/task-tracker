import pytest
from httpx import AsyncClient


@pytest.mark.anyio
async def test_register_returns_user(client: AsyncClient) -> None:
	response = await client.post(
		"/api/v1/auth/register",
		json={"email": "test@example.com", "password": "securepassword123"},
	)
	assert response.status_code ==201
	data = response.json()
	assert data["email"] == "test@example.com"
	assert "hashed_password" not in data 		#should never be exposed
	assert "id" in data


@pytest.mark.anyio
async def test_register_duplicate_email_fails(client: AsyncClient) -> None:
	payload = {"email": "dupe@example.com", "password": "securepassword123"}
	await client.post("/api/v1/auth/register", json=payload)
	response = await client.post("/api/v1/auth/register", json=payload)
	assert response.status_code == 409


@pytest.mark.anyio
async def test_login_returns_tokens(client: AsyncClient) -> None:
	creds = {"email": "login@example.com", "password": "securepassword123"}
	await client.post("/api/v1/auth/register", json=creds)
	response = await client.post("/api/v1/auth/login", json=creds)
	assert response.status_code == 200
	data = response.json()
	assert "access_token" in data
	assert "refresh_token" in data
	assert data["token_type"] == "bearer"


@pytest.mark.anyio
async def test_login_wrong_password_fails(client: AsyncClient) -> None:
	await client.post(
		"/api/v1/auth/register",
		json={"email": "wrong@example.com", "password": "correctpassword123"},
	)
	response = await client.post(
		"/api/v1/auth/login",
		json={"email": "wrong@example.com", "password": "wrongpassword"},
	)
	assert response.status_code == 401


@pytest.mark.anyio
async def test_me_returns_current_user(client: AsyncClient) -> None:
	creds = {"email": "me@example.com", "password": "securepassword123"}
	await client.post("/api/v1/auth/register", json=creds)
	login = await client.post("/api/v1/auth/login", json=creds)
	token = login.json()["access_token"]

	response = await client.get(
		"/api/v1/auth/me",
		headers={"Authorization": f"Bearer {token}"},
	)
	assert response.status_code == 200
	assert response.json()["email"] == "me@example.com"


@pytest.mark.anyio
async def test_me_without_token_fails(client: AsyncClient) -> None:
	response = await client.get("/api/v1/auth/me")
	assert response.status_code == 403  # HTTPBearer returns 403 when header is missing")