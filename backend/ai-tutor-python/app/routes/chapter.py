from fastapi import APIRouter, Depends
from pydantic import BaseModel
import logging

from ..services.chapter_service import fetch_or_generate_chapter
from ..utils.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()

class ChapterRequest(BaseModel):
    lesson_id: str
    chapter_index: int

class ChapterResponse(BaseModel):
    title: str
    content: str
    chat_history: list[dict]

@router.post("", response_model=ChapterResponse)
async def generate_chapter(body: ChapterRequest, user_id: str = Depends(get_current_user)):
    chapter_dict = await fetch_or_generate_chapter(
        user_id=user_id,
        lesson_id=body.lesson_id,
        chapter_index=body.chapter_index
    )
    return ChapterResponse(
        title=chapter_dict["title"],
        content=chapter_dict["content"],
        chat_history=chapter_dict["chat_history"]
    )
