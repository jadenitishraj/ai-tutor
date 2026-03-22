from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
import logging

from ..services.curriculum_service import refine_lesson_curriculum
from ..utils.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()

class RefineCurriculumRequest(BaseModel):
    lesson_id: str
    suggestion: str
    chapter_count: int = Field(default=0, ge=0, le=30)

class RefineCurriculumResponse(BaseModel):
    lesson_id: str
    curriculum: list[str]

@router.post("", response_model=RefineCurriculumResponse)
async def refine_curriculum(body: RefineCurriculumRequest, user_id: str = Depends(get_current_user)):
    if not body.suggestion.strip():
        raise HTTPException(status_code=400, detail="lessonId and suggestion are required.")

    result = await refine_lesson_curriculum(
        user_id=user_id,
        lesson_id=body.lesson_id,
        suggestion=body.suggestion,
        chapter_count=body.chapter_count
    )
    
    logger.info("Curriculum refined for lesson %s", body.lesson_id)
    return RefineCurriculumResponse(
        lesson_id=result["lesson_id"], 
        curriculum=result["curriculum"]
    )
