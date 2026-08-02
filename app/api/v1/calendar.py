import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.user import User
from app.schemas.calendar import MonthlyCalendarResponse, WeeklyCalendarItem, YearlyCalendarItem
from app.services import auth_service, calendar_service

router = APIRouter(prefix="/calendar", tags=["calendar"])


@router.get("/weekly", response_model=list[WeeklyCalendarItem])
async def weekly(
	db: AsyncSession = Depends(get_db),
	current_user: User = Depends(auth_service.get_current_user),
	target_date: date | None = Query(
		default=None,
		alias="date",
		description="Any day in the week to view (YYYY-MM-DD). Server anchors to Monday. Defaults to UTC today.",
	),
) -> list[WeeklyCalendarItem]:
	return await calendar_service.weekly_view(db, current_user.id, target_date)


@router.get("/yearly", response_model=list[YearlyCalendarItem])
async def yearly(
	db: AsyncSession = Depends(get_db),
	current_user: User = Depends(auth_service.get_current_user),
	year: int = Query(..., description="Year to view (e.g. 2026)."),
) -> list[YearlyCalendarItem]:
	return await calendar_service.yearly_view(db, current_user.id, year)


@router.get("/monthly", response_model=MonthlyCalendarResponse)
async def monthly(
	habit_id: uuid.UUID = Query(..., description="The habit to fetch the month for."),
	month: str = Query(..., description="YYYY-MM"),
	db: AsyncSession = Depends(get_db),
	current_user: User = Depends(auth_service.get_current_user),
) -> MonthlyCalendarResponse:
	try:
		return await calendar_service.monthly_view(
			db, user_id=current_user.id, habit_id=habit_id, month_str=month
		)
	except ValueError as exc:
		raise HTTPException(
			status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
			detail=str(exc),
		)
