import uuid

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.habit_integration import HabitIntegration, IntegrationMatchMode


async def get_by_habit(db: AsyncSession, habit_id: uuid.UUID) -> HabitIntegration | None:
	result = await db.execute(
		select(HabitIntegration).where(HabitIntegration.habit_id == habit_id)
	)
	return result.scalar_one_or_none()


async def get_all_by_source(db: AsyncSession, user_id: uuid.UUID, source: str) -> list[HabitIntegration]:
	from app.models.habit import Habit
	result = await db.execute(
		select(HabitIntegration)
		.join(Habit, HabitIntegration.habit_id == Habit.id)
		.where(Habit.user_id == user_id, HabitIntegration.source == source)
	)
	return list(result.scalars().all())


async def get_all_for_user(db: AsyncSession, user_id: uuid.UUID) -> list[HabitIntegration]:
	from app.models.habit import Habit
	result = await db.execute(
		select(HabitIntegration)
		.join(Habit, HabitIntegration.habit_id == Habit.id)
		.where(Habit.user_id == user_id)
	)
	return list(result.scalars().all())


async def upsert(
	db: AsyncSession,
	habit_id: uuid.UUID,
	source: str,
	match_mode: IntegrationMatchMode,
	workout_ids: list[str],
	category_ids: list[str],
	collection_ids: list[str],
) -> HabitIntegration:
	existing = await get_by_habit(db, habit_id)
	if existing:
		existing.source = source
		existing.match_mode = match_mode
		existing.workout_ids = workout_ids
		existing.category_ids = category_ids
		existing.collection_ids = collection_ids
		await db.flush()
		return existing

	integration = HabitIntegration(
		habit_id=habit_id,
		source=source,
		match_mode=match_mode,
		workout_ids=workout_ids,
		category_ids=category_ids,
		collection_ids=collection_ids,
	)
	db.add(integration)
	await db.flush()
	return integration


async def remove(db: AsyncSession, habit_id: uuid.UUID) -> None:
	await db.execute(
		delete(HabitIntegration).where(HabitIntegration.habit_id == habit_id)
	)
	await db.flush()
