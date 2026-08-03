import hashlib
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.integration_key import IntegrationKey


def _hash_key(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


async def get_by_user(db: AsyncSession, user_id: uuid.UUID) -> IntegrationKey | None:
    result = await db.execute(
        select(IntegrationKey).where(IntegrationKey.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def get_user_id_by_key(db: AsyncSession, raw_key: str) -> uuid.UUID | None:
    h = _hash_key(raw_key)
    result = await db.execute(
        select(IntegrationKey.user_id).where(IntegrationKey.key_hash == h)
    )
    row = result.scalar_one_or_none()
    return row


async def create(
    db: AsyncSession, user_id: uuid.UUID, raw_key: str, label: str = "RepCue",
) -> IntegrationKey:
    key = IntegrationKey(
        user_id=user_id,
        key_hash=_hash_key(raw_key),
        label=label,
    )
    db.add(key)
    await db.commit()
    await db.refresh(key)
    return key


async def delete_by_user(db: AsyncSession, user_id: uuid.UUID) -> bool:
    existing = await get_by_user(db, user_id)
    if not existing:
        return False
    await db.delete(existing)
    await db.commit()
    return True
