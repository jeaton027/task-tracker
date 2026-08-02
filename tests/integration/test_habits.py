import pytest
from httpx import AsyncClient

# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

async def _register_and_login(client: AsyncClient, email: str = "hab@example.com") -> str:
	"""Register a user and return their access token."""
	creds = {"email": email, "password": "securepassword123"}
	await client.post("/api/v1/auth/register", json=creds)
	resp = await client.post("/api/v1/auth/login", json=creds)
	return resp.json()["access_token"]


def _auth(token: str) -> dict:
	"""Return Authorization header dict."""
	return {"Authorization": f"Bearer {token}"}


async def _first_category_id(client: AsyncClient, token: str) -> str:
	"""Pull the first seeded category for a user (Morning)."""
	resp = await client.get("/api/v1/categories", headers=_auth(token))
	return resp.json()[0]["id"]


def _habit_payload(category_id: str, **overrides) -> dict:
	"""Minimal valid habit body. Tests override individual fields as needed."""
	base = {
		"name": "Drink Water",
		"mode": "DO",
		"frequency": "DAILY",
		"start_date": "2026-05-27",
		"category_id": category_id,
	}
	base.update(overrides)
	return base


# ---------------------------------------------------------------------------
# list
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_new_user_has_no_habits(client: AsyncClient) -> None:
	"""Habits are user-created — nothing is seeded on registration."""
	token = await _register_and_login(client)
	resp = await client.get("/api/v1/habits", headers=_auth(token))
	assert resp.status_code == 200
	assert resp.json() == []


# ---------------------------------------------------------------------------
# create
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_create_habit(client: AsyncClient) -> None:
	token = await _register_and_login(client)
	cat_id = await _first_category_id(client, token)
	resp = await client.post(
		"/api/v1/habits",
		json=_habit_payload(cat_id),
		headers=_auth(token),
	)
	assert resp.status_code == 201
	body = resp.json()
	assert body["name"] == "Drink Water"
	assert body["mode"] == "DO"
	assert body["frequency"] == "DAILY"
	assert body["is_active"] is True
	assert body["end_date"] is None
	# quantified-habit defaults: DO + omitted target_per_period -> 1
	assert body["target_per_period"] == 1
	assert body["increment"] == 1.0


@pytest.mark.anyio
async def test_create_avoid_habit_default_target_is_zero(client: AsyncClient) -> None:
	"""AVOID + omitted target_per_period defaults to 0 (binary 'never logged')."""
	token = await _register_and_login(client)
	cat_id = await _first_category_id(client, token)
	resp = await client.post(
		"/api/v1/habits",
		json=_habit_payload(cat_id, name="Quit smoking", mode="AVOID"),
		headers=_auth(token),
	)
	assert resp.status_code == 201
	assert resp.json()["target_per_period"] == 0


@pytest.mark.anyio
async def test_create_quantified_habit(client: AsyncClient) -> None:
	"""Explicit target_per_period and increment round-trip correctly."""
	token = await _register_and_login(client)
	cat_id = await _first_category_id(client, token)
	resp = await client.post(
		"/api/v1/habits",
		json=_habit_payload(
			cat_id, name="Run 6k/week", frequency="WEEKLY",
			target_per_period=6, increment=2.0,
		),
		headers=_auth(token),
	)
	assert resp.status_code == 201
	body = resp.json()
	assert body["target_per_period"] == 6
	assert body["increment"] == 2.0


@pytest.mark.anyio
async def test_create_habit_with_color_key_and_unit(client: AsyncClient) -> None:
	"""color_key and unit round-trip via Create + Response."""
	token = await _register_and_login(client)
	cat_id = await _first_category_id(client, token)
	resp = await client.post(
		"/api/v1/habits",
		json=_habit_payload(cat_id, color_key="olive", unit="glasses"),
		headers=_auth(token),
	)
	assert resp.status_code == 201
	body = resp.json()
	assert body["color_key"] == "olive"
	assert body["unit"] == "glasses"


@pytest.mark.anyio
async def test_create_habit_color_and_unit_default_to_null(
	client: AsyncClient,
) -> None:
	"""Omitting color_key and unit -> nulls (UI falls back to deterministic color)."""
	token = await _register_and_login(client)
	cat_id = await _first_category_id(client, token)
	resp = await client.post(
		"/api/v1/habits", json=_habit_payload(cat_id), headers=_auth(token),
	)
	assert resp.status_code == 201
	body = resp.json()
	assert body["color_key"] is None
	assert body["unit"] is None


# ---------------------------------------------------------------------------
# routine_ids on create
# ---------------------------------------------------------------------------

async def _make_routine(client: AsyncClient, token: str, name: str = "Morning") -> str:
	body = {"name": name, "frequency": "DAILY", "start_date": "2026-01-01"}
	resp = await client.post("/api/v1/routines", json=body, headers=_auth(token))
	return resp.json()["id"]


@pytest.mark.anyio
async def test_create_habit_appended_to_routine(client: AsyncClient) -> None:
	"""Habit created with routine_ids becomes a slot in the routine."""
	token = await _register_and_login(client)
	cat_id = await _first_category_id(client, token)
	rid = await _make_routine(client, token)

	create = await client.post(
		"/api/v1/habits",
		json=_habit_payload(cat_id, routine_ids=[rid]),
		headers=_auth(token),
	)
	assert create.status_code == 201
	habit_id = create.json()["id"]

	# Verify the routine now contains the habit at position 0
	resp = await client.get(f"/api/v1/routines/{rid}", headers=_auth(token))
	slots = resp.json()["habits"]
	assert len(slots) == 1
	assert slots[0]["habit"]["id"] == habit_id
	assert slots[0]["position"] == 0
	assert slots[0]["timer_seconds"] is None
	assert slots[0]["timer_type"] is None


@pytest.mark.anyio
async def test_create_habit_appends_at_next_position(client: AsyncClient) -> None:
	"""When a routine already has slots, the new habit lands at the end."""
	token = await _register_and_login(client)
	cat_id = await _first_category_id(client, token)
	# First habit added to routine via PATCH
	first = await client.post(
		"/api/v1/habits", json=_habit_payload(cat_id, name="Stretch"), headers=_auth(token),
	)
	first_id = first.json()["id"]
	rid = await _make_routine(client, token)
	await client.patch(
		f"/api/v1/routines/{rid}",
		json={"habits": [{"habit_id": first_id}]},
		headers=_auth(token),
	)

	# Now create a new habit and append to the same routine
	second = await client.post(
		"/api/v1/habits",
		json=_habit_payload(cat_id, name="Brush teeth", routine_ids=[rid]),
		headers=_auth(token),
	)
	assert second.status_code == 201
	second_id = second.json()["id"]

	# Routine slots should be [Stretch@0, Brush teeth@1]
	resp = await client.get(f"/api/v1/routines/{rid}", headers=_auth(token))
	slots = resp.json()["habits"]
	assert [s["habit"]["id"] for s in slots] == [first_id, second_id]
	assert [s["position"] for s in slots] == [0, 1]


@pytest.mark.anyio
async def test_create_habit_in_multiple_routines(client: AsyncClient) -> None:
	token = await _register_and_login(client)
	cat_id = await _first_category_id(client, token)
	r1 = await _make_routine(client, token, "Morning")
	r2 = await _make_routine(client, token, "Night")

	create = await client.post(
		"/api/v1/habits",
		json=_habit_payload(cat_id, routine_ids=[r1, r2]),
		headers=_auth(token),
	)
	assert create.status_code == 201
	habit_id = create.json()["id"]

	for rid in (r1, r2):
		resp = await client.get(f"/api/v1/routines/{rid}", headers=_auth(token))
		assert any(s["habit"]["id"] == habit_id for s in resp.json()["habits"])


@pytest.mark.anyio
async def test_create_habit_with_other_users_routine_returns_404(
	client: AsyncClient,
) -> None:
	token_a = await _register_and_login(client, "user_a@example.com")
	token_b = await _register_and_login(client, "user_b@example.com")
	cat_b = await _first_category_id(client, token_b)
	rid_a = await _make_routine(client, token_a)

	resp = await client.post(
		"/api/v1/habits",
		json=_habit_payload(cat_b, routine_ids=[rid_a]),
		headers=_auth(token_b),
	)
	assert resp.status_code == 404


@pytest.mark.anyio
async def test_create_avoid_habit_with_all_fields(client: AsyncClient) -> None:
	token = await _register_and_login(client)
	cat_id = await _first_category_id(client, token)
	resp = await client.post(
		"/api/v1/habits",
		json=_habit_payload(
			cat_id,
			name="No phone after 10pm",
			description="Charge phone in kitchen at 22:00",
			mode="AVOID",
			frequency="DAILY",
			end_date="2026-12-31",
			is_active=True,
		),
		headers=_auth(token),
	)
	assert resp.status_code == 201
	body = resp.json()
	assert body["mode"] == "AVOID"
	assert body["description"] == "Charge phone in kitchen at 22:00"
	assert body["end_date"] == "2026-12-31"


@pytest.mark.anyio
async def test_create_duplicate_habit_fails(client: AsyncClient) -> None:
	token = await _register_and_login(client)
	cat_id = await _first_category_id(client, token)
	await client.post(
		"/api/v1/habits", json=_habit_payload(cat_id), headers=_auth(token)
	)
	resp = await client.post(
		"/api/v1/habits", json=_habit_payload(cat_id), headers=_auth(token)
	)
	assert resp.status_code == 409


@pytest.mark.anyio
async def test_create_habit_with_invalid_mode_fails(client: AsyncClient) -> None:
	token = await _register_and_login(client)
	cat_id = await _first_category_id(client, token)
	resp = await client.post(
		"/api/v1/habits",
		json=_habit_payload(cat_id, mode="MAYBE"),
		headers=_auth(token),
	)
	assert resp.status_code == 422		# pydantic rejects the invalid enum


@pytest.mark.anyio
async def test_create_habit_end_before_start_fails(client: AsyncClient) -> None:
	token = await _register_and_login(client)
	cat_id = await _first_category_id(client, token)
	resp = await client.post(
		"/api/v1/habits",
		json=_habit_payload(
			cat_id, start_date="2026-05-27", end_date="2026-05-01"
		),
		headers=_auth(token),
	)
	assert resp.status_code == 422


@pytest.mark.anyio
async def test_create_habit_with_other_users_category_returns_404(
	client: AsyncClient,
) -> None:
	"""User A cannot attach their habit to User B's category."""
	token_a = await _register_and_login(client, "user_a@example.com")
	token_b = await _register_and_login(client, "user_b@example.com")
	cat_b = await _first_category_id(client, token_b)

	resp = await client.post(
		"/api/v1/habits", json=_habit_payload(cat_b), headers=_auth(token_a)
	)
	assert resp.status_code == 404


@pytest.mark.anyio
async def test_habits_are_user_scoped(client: AsyncClient) -> None:
	"""Two different users should have separate habits."""
	token_a = await _register_and_login(client, "user_a@example.com")
	token_b = await _register_and_login(client, "user_b@example.com")
	cat_a = await _first_category_id(client, token_a)

	await client.post(
		"/api/v1/habits",
		json=_habit_payload(cat_a, name="Private"),
		headers=_auth(token_a),
	)

	resp_b = await client.get("/api/v1/habits", headers=_auth(token_b))
	names_b = [h["name"] for h in resp_b.json()]
	assert "Private" not in names_b


# ---------------------------------------------------------------------------
# get single
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_get_habit(client: AsyncClient) -> None:
	token = await _register_and_login(client)
	cat_id = await _first_category_id(client, token)
	create = await client.post(
		"/api/v1/habits", json=_habit_payload(cat_id), headers=_auth(token)
	)
	habit_id = create.json()["id"]
	resp = await client.get(f"/api/v1/habits/{habit_id}", headers=_auth(token))
	assert resp.status_code == 200
	assert resp.json()["name"] == "Drink Water"


@pytest.mark.anyio
async def test_get_another_users_habit_returns_404(client: AsyncClient) -> None:
	token_a = await _register_and_login(client, "user_a@example.com")
	token_b = await _register_and_login(client, "user_b@example.com")
	cat_a = await _first_category_id(client, token_a)

	create = await client.post(
		"/api/v1/habits",
		json=_habit_payload(cat_a, name="Secret"),
		headers=_auth(token_a),
	)
	habit_id = create.json()["id"]

	resp = await client.get(f"/api/v1/habits/{habit_id}", headers=_auth(token_b))
	assert resp.status_code == 404


# ---------------------------------------------------------------------------
# update
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_update_habit_name(client: AsyncClient) -> None:
	token = await _register_and_login(client)
	cat_id = await _first_category_id(client, token)
	create = await client.post(
		"/api/v1/habits",
		json=_habit_payload(cat_id, name="Old Name"),
		headers=_auth(token),
	)
	habit_id = create.json()["id"]
	resp = await client.patch(
		f"/api/v1/habits/{habit_id}",
		json={"name": "New Name"},
		headers=_auth(token),
	)
	assert resp.status_code == 200
	assert resp.json()["name"] == "New Name"


@pytest.mark.anyio
async def test_update_habit_can_pause(client: AsyncClient) -> None:
	"""is_active=False pauses the habit without deleting it."""
	token = await _register_and_login(client)
	cat_id = await _first_category_id(client, token)
	create = await client.post(
		"/api/v1/habits", json=_habit_payload(cat_id), headers=_auth(token)
	)
	habit_id = create.json()["id"]
	resp = await client.patch(
		f"/api/v1/habits/{habit_id}",
		json={"is_active": False},
		headers=_auth(token),
	)
	assert resp.status_code == 200
	assert resp.json()["is_active"] is False


@pytest.mark.anyio
async def test_update_to_other_users_category_returns_404(
	client: AsyncClient,
) -> None:
	token_a = await _register_and_login(client, "user_a@example.com")
	token_b = await _register_and_login(client, "user_b@example.com")
	cat_a = await _first_category_id(client, token_a)
	cat_b = await _first_category_id(client, token_b)

	create = await client.post(
		"/api/v1/habits", json=_habit_payload(cat_a), headers=_auth(token_a)
	)
	habit_id = create.json()["id"]

	resp = await client.patch(
		f"/api/v1/habits/{habit_id}",
		json={"category_id": cat_b},
		headers=_auth(token_a),
	)
	assert resp.status_code == 404


# ---------------------------------------------------------------------------
# tags on habits
# ---------------------------------------------------------------------------

async def _make_tag(client: AsyncClient, token: str, name: str) -> str:
	resp = await client.post(
		"/api/v1/tags", json={"name": name}, headers=_auth(token)
	)
	return resp.json()["id"]


@pytest.mark.anyio
async def test_create_habit_with_tags(client: AsyncClient) -> None:
	token = await _register_and_login(client)
	cat_id = await _first_category_id(client, token)
	tag_a = await _make_tag(client, token, "health")
	tag_b = await _make_tag(client, token, "morning")

	resp = await client.post(
		"/api/v1/habits",
		json=_habit_payload(cat_id, tag_ids=[tag_a, tag_b]),
		headers=_auth(token),
	)
	assert resp.status_code == 201
	names = sorted(t["name"] for t in resp.json()["tags"])
	assert names == ["health", "morning"]


@pytest.mark.anyio
async def test_create_habit_with_other_users_tag_returns_404(
	client: AsyncClient,
) -> None:
	token_a = await _register_and_login(client, "user_a@example.com")
	token_b = await _register_and_login(client, "user_b@example.com")
	cat_a = await _first_category_id(client, token_a)
	tag_b = await _make_tag(client, token_b, "private")

	resp = await client.post(
		"/api/v1/habits",
		json=_habit_payload(cat_a, tag_ids=[tag_b]),
		headers=_auth(token_a),
	)
	assert resp.status_code == 404


@pytest.mark.anyio
async def test_update_replaces_tag_set(client: AsyncClient) -> None:
	"""PATCH with tag_ids replaces — not appends to — the existing tags."""
	token = await _register_and_login(client)
	cat_id = await _first_category_id(client, token)
	tag_a = await _make_tag(client, token, "health")
	tag_b = await _make_tag(client, token, "morning")
	tag_c = await _make_tag(client, token, "growth")

	create = await client.post(
		"/api/v1/habits",
		json=_habit_payload(cat_id, tag_ids=[tag_a, tag_b]),
		headers=_auth(token),
	)
	habit_id = create.json()["id"]

	# replace [health, morning] with just [growth]
	resp = await client.patch(
		f"/api/v1/habits/{habit_id}",
		json={"tag_ids": [tag_c]},
		headers=_auth(token),
	)
	assert resp.status_code == 200
	names = [t["name"] for t in resp.json()["tags"]]
	assert names == ["growth"]


@pytest.mark.anyio
async def test_update_with_empty_tag_list_clears_tags(client: AsyncClient) -> None:
	token = await _register_and_login(client)
	cat_id = await _first_category_id(client, token)
	tag_a = await _make_tag(client, token, "health")

	create = await client.post(
		"/api/v1/habits",
		json=_habit_payload(cat_id, tag_ids=[tag_a]),
		headers=_auth(token),
	)
	habit_id = create.json()["id"]

	resp = await client.patch(
		f"/api/v1/habits/{habit_id}",
		json={"tag_ids": []},
		headers=_auth(token),
	)
	assert resp.status_code == 200
	assert resp.json()["tags"] == []


@pytest.mark.anyio
async def test_update_without_tag_ids_leaves_tags_alone(client: AsyncClient) -> None:
	"""Patching only `name` must not wipe out the habit's tags."""
	token = await _register_and_login(client)
	cat_id = await _first_category_id(client, token)
	tag_a = await _make_tag(client, token, "health")

	create = await client.post(
		"/api/v1/habits",
		json=_habit_payload(cat_id, tag_ids=[tag_a]),
		headers=_auth(token),
	)
	habit_id = create.json()["id"]

	resp = await client.patch(
		f"/api/v1/habits/{habit_id}",
		json={"name": "Renamed"},
		headers=_auth(token),
	)
	assert resp.status_code == 200
	names = [t["name"] for t in resp.json()["tags"]]
	assert names == ["health"]


@pytest.mark.anyio
async def test_deleting_tag_unlinks_from_habit(client: AsyncClient) -> None:
	"""DB-level CASCADE: deleting a tag drops its links but the habit survives."""
	token = await _register_and_login(client)
	cat_id = await _first_category_id(client, token)
	tag_a = await _make_tag(client, token, "health")

	create = await client.post(
		"/api/v1/habits",
		json=_habit_payload(cat_id, tag_ids=[tag_a]),
		headers=_auth(token),
	)
	habit_id = create.json()["id"]

	# remove the tag itself
	del_resp = await client.delete(f"/api/v1/tags/{tag_a}", headers=_auth(token))
	assert del_resp.status_code == 204

	# habit should still exist, just with no tags
	get_resp = await client.get(f"/api/v1/habits/{habit_id}", headers=_auth(token))
	assert get_resp.status_code == 200
	assert get_resp.json()["tags"] == []


# ---------------------------------------------------------------------------
# delete
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_delete_habit(client: AsyncClient) -> None:
	token = await _register_and_login(client)
	cat_id = await _first_category_id(client, token)
	create = await client.post(
		"/api/v1/habits",
		json=_habit_payload(cat_id, name="Temporary"),
		headers=_auth(token),
	)
	habit_id = create.json()["id"]
	del_resp = await client.delete(f"/api/v1/habits/{habit_id}", headers=_auth(token))
	assert del_resp.status_code == 204

	get_resp = await client.get(f"/api/v1/habits/{habit_id}", headers=_auth(token))
	assert get_resp.status_code == 404


@pytest.mark.anyio
async def test_delete_another_users_habit_returns_404(client: AsyncClient) -> None:
	token_a = await _register_and_login(client, "user_a@example.com")
	token_b = await _register_and_login(client, "user_b@example.com")
	cat_a = await _first_category_id(client, token_a)

	create = await client.post(
		"/api/v1/habits",
		json=_habit_payload(cat_a, name="Mine"),
		headers=_auth(token_a),
	)
	habit_id = create.json()["id"]

	resp = await client.delete(f"/api/v1/habits/{habit_id}", headers=_auth(token_b))
	assert resp.status_code == 404
