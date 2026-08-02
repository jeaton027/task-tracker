import uuid
from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.user import User
from app.schemas.stats import AggregateStatsResponse, TrendsResponse
from app.services import auth_service, stats_service

router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("/overview", response_model=AggregateStatsResponse)
async def get_overview(
	db: AsyncSession = Depends(get_db),
	current_user: User = Depends(auth_service.get_current_user),
	start_date: date | None = Query(default=None, alias="start"),
	end_date: date | None = Query(default=None, alias="end"),
) -> object:
	return await stats_service.get_aggregate_stats(
		db, current_user.id, start_date, end_date,
	)


@router.get("/trends", response_model=TrendsResponse)
async def get_trends(
	db: AsyncSession = Depends(get_db),
	current_user: User = Depends(auth_service.get_current_user),
	start_date: date | None = Query(default=None, alias="start"),
	end_date: date | None = Query(default=None, alias="end"),
	habit_ids: list[uuid.UUID] | None = Query(default=None, alias="habit_id"),
) -> object:
	return await stats_service.get_trends(
		db, current_user.id, start_date, end_date, habit_ids,
	)
