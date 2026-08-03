import secrets
import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.user import User
from app.repositories import integration_key_repository
from app.schemas.integration import (
	HookPayload,
	HookResponse,
	IntegrationConfig,
	IntegrationKeyResponse,
	IntegrationResponse,
)
from app.services import auth_service, integration_service

router = APIRouter(prefix="/integrations", tags=["integrations"])


@router.post("/hooks/log", response_model=HookResponse)
async def receive_hook(
	payload: HookPayload,
	db: AsyncSession = Depends(get_db),
	current_user: User = Depends(auth_service.get_current_user),
) -> HookResponse:
	logged = await integration_service.process_hook(db, current_user.id, payload)
	return HookResponse(matched_habits=len(logged), logged_habits=logged)


# ── Integration API Keys (must be before /{habit_id} routes) ─────────


@router.get("/keys/current", response_model=IntegrationKeyResponse | None)
async def get_current_key(
	db: AsyncSession = Depends(get_db),
	current_user: User = Depends(auth_service.get_current_user),
) -> IntegrationKeyResponse | None:
	existing = await integration_key_repository.get_by_user(db, current_user.id)
	if not existing:
		return None
	return IntegrationKeyResponse(
		id=str(existing.id),
		label=existing.label,
		created_at=existing.created_at.isoformat(),
	)


@router.post("/keys", response_model=IntegrationKeyResponse, status_code=201)
async def create_key(
	db: AsyncSession = Depends(get_db),
	current_user: User = Depends(auth_service.get_current_user),
) -> IntegrationKeyResponse:
	await integration_key_repository.delete_by_user(db, current_user.id)
	raw_key = f"dbk_{secrets.token_hex(32)}"
	record = await integration_key_repository.create(db, current_user.id, raw_key)
	return IntegrationKeyResponse(
		id=str(record.id),
		label=record.label,
		created_at=record.created_at.isoformat(),
		key=raw_key,
	)


@router.delete("/keys", status_code=204)
async def revoke_key(
	db: AsyncSession = Depends(get_db),
	current_user: User = Depends(auth_service.get_current_user),
) -> None:
	await integration_key_repository.delete_by_user(db, current_user.id)


# ── Integration config ───────────────────────────────────────────────


@router.get("", response_model=list[IntegrationResponse])
async def list_integrations(
	db: AsyncSession = Depends(get_db),
	current_user: User = Depends(auth_service.get_current_user),
) -> list[IntegrationResponse]:
	items = await integration_service.list_integrations(db, current_user.id)
	return [
		IntegrationResponse(
			id=str(i.id),
			habit_id=str(i.habit_id),
			source=i.source,
			match_mode=i.match_mode.value,
			workout_ids=i.workout_ids,
			category_ids=i.category_ids,
			collection_ids=i.collection_ids,
		)
		for i in items
	]


@router.put("/{habit_id}", response_model=IntegrationResponse)
async def set_integration(
	habit_id: uuid.UUID,
	config: IntegrationConfig,
	db: AsyncSession = Depends(get_db),
	current_user: User = Depends(auth_service.get_current_user),
) -> IntegrationResponse:
	i = await integration_service.set_integration(
		db, habit_id, current_user.id, config,
	)
	return IntegrationResponse(
		id=str(i.id),
		habit_id=str(i.habit_id),
		source=i.source,
		match_mode=i.match_mode.value,
		workout_ids=i.workout_ids,
		category_ids=i.category_ids,
		collection_ids=i.collection_ids,
	)


@router.delete("/{habit_id}", status_code=204)
async def remove_integration(
	habit_id: uuid.UUID,
	db: AsyncSession = Depends(get_db),
	current_user: User = Depends(auth_service.get_current_user),
) -> None:
	await integration_service.remove_integration(
		db, habit_id, current_user.id,
	)


@router.get("/{habit_id}", response_model=IntegrationResponse | None)
async def get_integration(
	habit_id: uuid.UUID,
	db: AsyncSession = Depends(get_db),
	current_user: User = Depends(auth_service.get_current_user),
) -> IntegrationResponse | None:
	i = await integration_service.get_integration(
		db, habit_id, current_user.id,
	)
	if not i:
		return None
	return IntegrationResponse(
		id=str(i.id),
		habit_id=str(i.habit_id),
		source=i.source,
		match_mode=i.match_mode.value,
		workout_ids=i.workout_ids,
		category_ids=i.category_ids,
		collection_ids=i.collection_ids,
	)
