import uuid
from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.vacation_period import VacationPeriod


async def get_by_id(
	db: AsyncSession, vacation_id: uuid.UUID
) -> VacationPeriod | None:
	result = await db.execute(
		select(VacationPeriod).where(VacationPeriod.id == vacation_id)
	)
	return result.scalar_one_or_none()


async def get_all_by_user(
	db: AsyncSession, user_id: uuid.UUID
) -> list[VacationPeriod]:
	result = await db.execute(
		select(VacationPeriod)
		.where(VacationPeriod.user_id == user_id)
		.order_by(VacationPeriod.start_date)
	)
	return list(result.scalars().all())


async def create(
	db: AsyncSession,
	*,
	user_id: uuid.UUID,
	name: str | None,
	start_date: date,
	end_date: date,
) -> VacationPeriod:
	vac = VacationPeriod(
		user_id=user_id, name=name,
		start_date=start_date, end_date=end_date,
	)
	db.add(vac)
	await db.commit()
	await db.refresh(vac)
	return vac


async def update(
	db: AsyncSession, vacation: VacationPeriod, **fields
) -> VacationPeriod:
	for k, v in fields.items():
		setattr(vacation, k, v)
	await db.commit()
	await db.refresh(vacation)
	return vacation


async def delete(db: AsyncSession, vacation: VacationPeriod) -> None:
	await db.delete(vacation)
	await db.commit()
