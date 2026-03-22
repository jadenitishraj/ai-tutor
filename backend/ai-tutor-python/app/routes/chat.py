from fastapi import APIRouter, Depends
from pydantic import BaseModel
import logging

from ..services.chat_service import process_chat_message
from ..utils.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()

class ChatRequest(BaseModel):
    lesson_id: str
    chapter_title: str
    message: str

class ChatResponse(BaseModel):
    role: str
    content: str

@router.post("", response_model=ChatResponse)
async def chat(body: ChatRequest, user_id: str = Depends(get_current_user)):
    ai_response = await process_chat_message(
        user_id=user_id,
        lesson_id=body.lesson_id,
        chapter_title=body.chapter_title,
        message=body.message
    )
    return ChatResponse(role="assistant", content=ai_response)
