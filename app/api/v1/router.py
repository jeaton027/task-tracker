from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.calendar import router as calendar_router
from app.api.v1.categories import router as categories_router
from app.api.v1.habits import router as habits_router
from app.api.v1.health import router as health_router
from app.api.v1.routines import router as routines_router
from app.api.v1.stats import router as stats_router
from app.api.v1.tags import router as tags_router
from app.api.v1.vacations import router as vacations_router

router = APIRouter(prefix="/v1")
router.include_router(health_router, tags=["health"])
router.include_router(auth_router)
router.include_router(categories_router)
router.include_router(tags_router)
router.include_router(habits_router)
router.include_router(routines_router)
router.include_router(vacations_router)
router.include_router(calendar_router)
router.include_router(stats_router)
