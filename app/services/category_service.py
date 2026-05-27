import uuid

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.category import Category
from app.repositories import category_repository

_DEFAULT_CATEGORIES = ["Morning", "Day", "Evening"]


async def seed_defaults(db: AsyncSession, user_id: uuid.UUID) -> None:
	"""creates three default categories for new user."""
	for name in _DEFAULT_CATEGORIES:
		await category_repository.create(db, user_id=user_id, name=name)


async def list_categories(db: AsyncSession, user_id: uuid.UUID) -> list[Category]:
	return await category_repository.get_all_by_user(db, user_id)


async def get_category(
	db: AsyncSession, category_id: uuid.UUID, user_id: uuid.UUID
) -> Category:
	"""fetch one category, verify it belongs to requesting user.

	returns 404: whether or not the category DNE OR belongs to someone
	else —> don't leak other user's categories (if exist or no).
	"""
	category = await category_repository.get_by_id(db, category_id)
	if not category or category.user_id != user_id:
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found.")
	return category


async def create_category(
	db: AsyncSession, user_id: uuid.UUID, name: str
) -> Category:
	try:
		return await category_repository.create(db, user_id=user_id, name=name)
	except IntegrityError:
		# unique constraint on (user_id, name) was violated
		await db.rollback()
		raise HTTPException(
			status_code=status.HTTP_409_CONFLICT,
			detail=f"You already have a category named '{name}'.",
		)


async def update_category(
	db: AsyncSession, category_id: uuid.UUID, user_id: uuid.UUID, name: str
) -> Category:
	category = await get_category(db, category_id, user_id)	# 404 if not found/owned
	try:
		return await category_repository.update(db, category, name=name)
	except IntegrityError:
		await db.rollback()
		raise HTTPException(
			status_code=status.HTTP_409_CONFLICT,
			detail=f"You already have a category named '{name}'.",
		)


async def delete_category(
	db: AsyncSession, category_id: uuid.UUID, user_id: uuid.UUID
) -> None:
	category = await get_category(db, category_id, user_id)	# 404 if not found/owned
	await category_repository.delete(db, category)
