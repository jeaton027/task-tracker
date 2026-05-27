import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tag import Tag


async def get_by_id(db: AsyncSession, tag_id: uuid.UUID) -> Tag | None:
	result = await db.execute(select(Tag).where(Tag.id == tag_id))
	return result.scalar_one_or_none()


async def get_all_by_user(db: AsyncSession, user_id: uuid.UUID) -> list[Tag]:
	result = await db.execute(
		select(Tag)
		.where(Tag.user_id == user_id)
		.order_by(Tag.created_at)		# consistent ordering: oldest first
	)
	return list(result.scalars().all())


async def create(db: AsyncSession, user_id: uuid.UUID, name: str) -> Tag:
	tag = Tag(user_id=user_id, name=name)
	db.add(tag)
	await db.commit()
	await db.refresh(tag)
	return tag


async def update(db: AsyncSession, tag: Tag, name: str) -> Tag:
	tag.name = name
	await db.commit()
	await db.refresh(tag)
	return tag


async def delete(db: AsyncSession, tag: Tag) -> None:
	await db.delete(tag)
	await db.commit()
