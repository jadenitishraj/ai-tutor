from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
import logging

from ..services.curriculum_service import create_lesson_curriculum
from ..utils.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()

class CurriculumRequest(BaseModel):
    topic: str
    vibe: str = "Standard"
    custom_vibe: str = ""
    chapter_count: int = Field(default=5, ge=1, le=30)

class CurriculumResponse(BaseModel):
    lesson_id: str
    curriculum: list[str]

@router.post("", response_model=CurriculumResponse)
async def generate_curriculum(body: CurriculumRequest, user_id: str = Depends(get_current_user)):
    if not body.topic.strip():
        raise HTTPException(status_code=400, detail="topic is required.")

    result = await create_lesson_curriculum(
        user_id=user_id,
        topic=body.topic,
        vibe=body.vibe,
        custom_vibe=body.custom_vibe,
        chapter_count=body.chapter_count
    )

    logger.info("Curriculum created for new lesson")
    return CurriculumResponse(
        lesson_id=result["lesson_id"], 
        curriculum=result["curriculum"]
    )
