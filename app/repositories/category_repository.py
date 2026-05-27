import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.category import Category


async def get_by_id(db: AsyncSession, category_id: uuid.UUID) -> Category | None:
	result = await db.execute(select(Category).where(Category.id == category_id))
	return result.scalar_one_or_none()


async def get_all_by_user(db: AsyncSession, user_id: uuid.UUID) -> list[Category]:
	result = await db.execute(
		select(Category)
		.where(Category.user_id == user_id)
		.order_by(Category.created_at)		# consistent ordering: oldest first
	)
	return list(result.scalars().all())


async def create(db: AsyncSession, user_id: uuid.UUID, name: str) -> Category:
	category = Category(user_id=user_id, name=name)
	db.add(category)
	await db.commit()
	await db.refresh(category)
	return category


async def update(db: AsyncSession, category: Category, name: str) -> Category:
	category.name = name
	await db.commit()
	await db.refresh(category)
	return category


async def delete(db: AsyncSession, category: Category) -> None:
	await db.delete(category)
	await db.commit()
