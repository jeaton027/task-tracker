import uuid

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tag import Tag
from app.repositories import tag_repository


async def list_tags(db: AsyncSession, user_id: uuid.UUID) -> list[Tag]:
	return await tag_repository.get_all_by_user(db, user_id)


async def get_tag(
	db: AsyncSession, tag_id: uuid.UUID, user_id: uuid.UUID
) -> Tag:
	"""fetch one tag, verify it belongs to requesting user.

	returns 404: whether or not the tag DNE OR belongs to someone
	else —> don't leak other user's tags (if exist or no).
	"""
	tag = await tag_repository.get_by_id(db, tag_id)
	if not tag or tag.user_id != user_id:
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tag not found.")
	return tag


async def create_tag(
	db: AsyncSession, user_id: uuid.UUID, name: str
) -> Tag:
	try:
		return await tag_repository.create(db, user_id=user_id, name=name)
	except IntegrityError:
		# unique constraint on (user_id, name) was violated
		await db.rollback()
		raise HTTPException(
			status_code=status.HTTP_409_CONFLICT,
			detail=f"You already have a tag named '{name}'.",
		)


async def update_tag(
	db: AsyncSession, tag_id: uuid.UUID, user_id: uuid.UUID, name: str
) -> Tag:
	tag = await get_tag(db, tag_id, user_id)	# 404 if not found/owned
	try:
		return await tag_repository.update(db, tag, name=name)
	except IntegrityError:
		await db.rollback()
		raise HTTPException(
			status_code=status.HTTP_409_CONFLICT,
			detail=f"You already have a tag named '{name}'.",
		)


async def delete_tag(
	db: AsyncSession, tag_id: uuid.UUID, user_id: uuid.UUID
) -> None:
	tag = await get_tag(db, tag_id, user_id)	# 404 if not found/owned
	await tag_repository.delete(db, tag)
