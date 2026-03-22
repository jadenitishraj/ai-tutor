from fastapi import APIRouter, Depends
from pydantic import BaseModel
import logging

from ..services.summary_service import get_chapter_summary
from ..utils.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()

class SummaryRequest(BaseModel):
    lesson_id: str
    chapter_title: str

class SummaryResponse(BaseModel):
    bullets: list[str]

@router.post("", response_model=SummaryResponse)
async def generate_summary(body: SummaryRequest, user_id: str = Depends(get_current_user)):
    bullets = await get_chapter_summary(
        user_id=user_id,
        lesson_id=body.lesson_id,
        chapter_title=body.chapter_title
    )
    return SummaryResponse(bullets=bullets)
