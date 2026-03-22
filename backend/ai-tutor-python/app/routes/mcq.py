from fastapi import APIRouter, Depends
from pydantic import BaseModel
import logging

from ..services.mcq_service import get_chapter_mcqs, generate_next_mcq
from ..utils.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()

class MCQRequest(BaseModel):
    lesson_id: str
    chapter_title: str

class MCQResponse(BaseModel):
    mcq: dict = None
    existing_mcqs: list[dict] = []

@router.get("", response_model=MCQResponse)
async def list_mcqs(lesson_id: str, chapter_title: str, user_id: str = Depends(get_current_user)):
    mcqs = await get_chapter_mcqs(user_id, lesson_id, chapter_title)
    return MCQResponse(existing_mcqs=mcqs)

@router.post("", response_model=MCQResponse)
async def create_mcq(body: MCQRequest, user_id: str = Depends(get_current_user)):
    mcq = await generate_next_mcq(
        user_id=user_id,
        lesson_id=body.lesson_id,
        chapter_title=body.chapter_title
    )
    return MCQResponse(mcq=mcq)
