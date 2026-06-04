import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.user import User
from app.schemas.routine import RoutineCreate, RoutineResponse, RoutineUpdate
from app.schemas.routine_session import RoutineSessionResponse
from app.services import auth_service, routine_service, routine_session_service

router = APIRouter(prefix="/routines", tags=["routines"])


@router.get("", response_model=list[RoutineResponse])
async def list_routines(
	db: AsyncSession = Depends(get_db),
	current_user: User = Depends(auth_service.get_current_user),
) -> list:
	return await routine_service.list_routines(db, current_user.id)


@router.post("", response_model=RoutineResponse, status_code=status.HTTP_201_CREATED)
async def create_routine(
	payload: RoutineCreate,
	db: AsyncSession = Depends(get_db),
	current_user: User = Depends(auth_service.get_current_user),
) -> object:
	return await routine_service.create_routine(
		db,
		user_id=current_user.id,
		name=payload.name,
		description=payload.description,
		is_active=payload.is_active,
		frequency=payload.frequency,
		scheduled_weekdays=payload.scheduled_weekdays,
		scheduled_days_of_month=payload.scheduled_days_of_month,
		start_date=payload.start_date,
		end_date=payload.end_date,
		habits=payload.habits,
	)


@router.get("/{routine_id}", response_model=RoutineResponse)
async def get_routine(
	routine_id: uuid.UUID,
	db: AsyncSession = Depends(get_db),
	current_user: User = Depends(auth_service.get_current_user),
) -> object:
	return await routine_service.get_routine(db, routine_id, current_user.id)


@router.patch("/{routine_id}", response_model=RoutineResponse)
async def update_routine(
	routine_id: uuid.UUID,
	payload: RoutineUpdate,
	db: AsyncSession = Depends(get_db),
	current_user: User = Depends(auth_service.get_current_user),
) -> object:
	fields = payload.model_dump(exclude_unset=True)
	return await routine_service.update_routine(
		db, routine_id=routine_id, user_id=current_user.id, fields=fields,
	)


@router.delete("/{routine_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_routine(
	routine_id: uuid.UUID,
	db: AsyncSession = Depends(get_db),
	current_user: User = Depends(auth_service.get_current_user),
) -> None:
	await routine_service.delete_routine(db, routine_id, current_user.id)


# ---------------------------------------------------------------------------
# Sessions (playthrough tracking)
# ---------------------------------------------------------------------------

@router.post(
	"/{routine_id}/start",
	response_model=RoutineSessionResponse,
	status_code=status.HTTP_201_CREATED,
)
async def start_session(
	routine_id: uuid.UUID,
	db: AsyncSession = Depends(get_db),
	current_user: User = Depends(auth_service.get_current_user),
) -> object:
	return await routine_session_service.start_session(
		db, routine_id, current_user.id,
	)


@router.patch(
	"/sessions/{session_id}/complete",
	response_model=RoutineSessionResponse,
)
async def complete_session(
	session_id: uuid.UUID,
	db: AsyncSession = Depends(get_db),
	current_user: User = Depends(auth_service.get_current_user),
) -> object:
	return await routine_session_service.complete_session(
		db, session_id, current_user.id,
	)


@router.get(
	"/{routine_id}/sessions",
	response_model=list[RoutineSessionResponse],
)
async def list_sessions(
	routine_id: uuid.UUID,
	month: str = Query(..., description="YYYY-MM"),
	db: AsyncSession = Depends(get_db),
	current_user: User = Depends(auth_service.get_current_user),
) -> list:
	try:
		return await routine_session_service.list_sessions_for_month(
			db, routine_id, current_user.id, month,
		)
	except ValueError as exc:
		raise HTTPException(
			status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
			detail=str(exc),
		)
