from fastapi import APIRouter, Depends, Query
import logging

from ..services.lesson_service import list_user_lessons, remove_lesson
from ..utils.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("")
async def get_my_lessons(
    user_id: str = Depends(get_current_user),
):
    lessons = await list_user_lessons(user_id=user_id)
    return lessons

@router.delete("")
async def delete_lesson(
    id: str = Query(..., description="Lesson ObjectId"),
    user_id: str = Depends(get_current_user),
):
    result = await remove_lesson(user_id=user_id, lesson_id=id)
    logger.info("Lesson deleted: %s", id)
    return result
