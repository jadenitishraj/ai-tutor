from fastapi import APIRouter, Depends
from pydantic import BaseModel
import logging

from ..services.question_answer_service import get_chapter_question_answer
from ..utils.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()


class QuestionAnswerRequest(BaseModel):
    lesson_id: str
    chapter_title: str


class QuestionAnswerResponse(BaseModel):
    question_answers: list[dict]


@router.post("", response_model=QuestionAnswerResponse)
async def generate_question_answer(body: QuestionAnswerRequest, user_id: str = Depends(get_current_user)):
    question_answers = await get_chapter_question_answer(
        user_id=user_id,
        lesson_id=body.lesson_id,
        chapter_title=body.chapter_title,
    )
    return QuestionAnswerResponse(question_answers=question_answers)
