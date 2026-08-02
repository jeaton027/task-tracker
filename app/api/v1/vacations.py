import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.user import User
from app.schemas.vacation import VacationCreate, VacationResponse, VacationUpdate
from app.services import auth_service, vacation_service

router = APIRouter(prefix="/vacations", tags=["vacations"])


@router.get("", response_model=list[VacationResponse])
async def list_vacations(
	db: AsyncSession = Depends(get_db),
	current_user: User = Depends(auth_service.get_current_user),
) -> list:
	return await vacation_service.list_vacations(db, current_user.id)


@router.post("", response_model=VacationResponse, status_code=status.HTTP_201_CREATED)
async def create_vacation(
	payload: VacationCreate,
	db: AsyncSession = Depends(get_db),
	current_user: User = Depends(auth_service.get_current_user),
) -> object:
	return await vacation_service.create_vacation(
		db,
		user_id=current_user.id,
		name=payload.name,
		start_date=payload.start_date,
		end_date=payload.end_date,
	)


@router.get("/{vacation_id}", response_model=VacationResponse)
async def get_vacation(
	vacation_id: uuid.UUID,
	db: AsyncSession = Depends(get_db),
	current_user: User = Depends(auth_service.get_current_user),
) -> object:
	return await vacation_service.get_vacation(db, vacation_id, current_user.id)


@router.patch("/{vacation_id}", response_model=VacationResponse)
async def update_vacation(
	vacation_id: uuid.UUID,
	payload: VacationUpdate,
	db: AsyncSession = Depends(get_db),
	current_user: User = Depends(auth_service.get_current_user),
) -> object:
	fields = payload.model_dump(exclude_unset=True)
	return await vacation_service.update_vacation(
		db, vacation_id=vacation_id, user_id=current_user.id, fields=fields,
	)


@router.delete("/{vacation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_vacation(
	vacation_id: uuid.UUID,
	db: AsyncSession = Depends(get_db),
	current_user: User = Depends(auth_service.get_current_user),
) -> None:
	await vacation_service.delete_vacation(db, vacation_id, current_user.id)
