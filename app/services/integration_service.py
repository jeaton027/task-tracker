import logging
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.habit_integration import HabitIntegration, IntegrationMatchMode
from app.repositories import integration_repository, habit_log_repository
from app.schemas.integration import HookPayload, IntegrationConfig
from app.services.habit_log_service import today_utc

log = logging.getLogger(__name__)


def _matches(integration: HabitIntegration, payload: HookPayload) -> bool:
	if integration.match_mode == IntegrationMatchMode.ANY:
		return True

	if payload.workout_id and payload.workout_id in integration.workout_ids:
		return True
	if payload.category and payload.category in integration.category_ids:
		return True
	if any(cid in integration.collection_ids for cid in payload.collection_ids):
		return True

	return False


async def process_hook(
	db: AsyncSession,
	user_id: uuid.UUID,
	payload: HookPayload,
) -> list[str]:
	integrations = await integration_repository.get_all_by_source(
		db, user_id, payload.source,
	)

	logged_habit_names: list[str] = []
	log_date = today_utc()

	for integration in integrations:
		if not _matches(integration, payload):
			continue

		from app.models.habit import Habit
		habit = await db.get(Habit, integration.habit_id)
		if not habit or not habit.is_active:
			continue

		await habit_log_repository.create(
			db, integration.habit_id, log_date, habit.increment,
		)
		logged_habit_names.append(habit.name)
		log.info(
			"Auto-logged habit %s (id=%s) from %s event %s",
			habit.name, habit.id, payload.source, payload.event_id,
		)

	return logged_habit_names


async def set_integration(
	db: AsyncSession,
	habit_id: uuid.UUID,
	user_id: uuid.UUID,
	config: IntegrationConfig,
) -> HabitIntegration:
	from app.services import habit_service
	await habit_service.get_habit(db, habit_id, user_id)

	result = await integration_repository.upsert(
		db,
		habit_id=habit_id,
		source=config.source,
		match_mode=IntegrationMatchMode(config.match_mode),
		workout_ids=config.workout_ids,
		category_ids=config.category_ids,
		collection_ids=config.collection_ids,
	)
	await db.commit()
	return result


async def remove_integration(
	db: AsyncSession,
	habit_id: uuid.UUID,
	user_id: uuid.UUID,
) -> None:
	from app.services import habit_service
	await habit_service.get_habit(db, habit_id, user_id)
	await integration_repository.remove(db, habit_id)
	await db.commit()


async def get_integration(
	db: AsyncSession,
	habit_id: uuid.UUID,
	user_id: uuid.UUID,
) -> HabitIntegration | None:
	from app.services import habit_service
	await habit_service.get_habit(db, habit_id, user_id)
	return await integration_repository.get_by_habit(db, habit_id)


async def list_integrations(
	db: AsyncSession,
	user_id: uuid.UUID,
) -> list[HabitIntegration]:
	return await integration_repository.get_all_for_user(db, user_id)
