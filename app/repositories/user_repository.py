import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User


async def get_by_email(db: AsyncSession, email:str) -> User | None:
	result = await db.execute(select(User).where(User.email == email))
	return result.scalar_one_or_none()
	# sclar one or none() : return the single result, or none if not found
	# raises error if >1 row matches (email should be unique)


async def get_by_id(db: AsyncSession, user_id: uuid.UUID) -> User | None:
	result = await db.execute(select(User).where(User.id == user_id))
	return result.scalar_one_or_none()


async def create(db: AsyncSession, email: str, hashed_password: str) -> User:
	user = User(email=email, hashed_password=hashed_password)
	db.add(user)			# not yet in db, stage new row
	await db.commit()		# write to db : Insert now actually runs
	await db.refresh(user)	# re-read the row from db to get server generated vals
	return user				# created_at, updated_at and UUID were set by db