from fastapi import APIRouter, Depends, Query
import logging

from ..services.lesson_service import get_single_lesson
from ..utils.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("")
async def get_lesson(
    id: str = Query(..., description="Lesson ObjectId"),
    user_id: str = Depends(get_current_user),
):
    lesson_data = await get_single_lesson(user_id=user_id, lesson_id=id)
    return lesson_data
