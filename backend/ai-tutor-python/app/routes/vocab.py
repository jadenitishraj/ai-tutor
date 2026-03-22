from fastapi import APIRouter, Depends
from pydantic import BaseModel
import logging

from ..services.vocab_service import get_chapter_vocab
from ..utils.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()

class VocabRequest(BaseModel):
    lesson_id: str
    chapter_title: str

class VocabResponse(BaseModel):
    vocab: list[dict]

@router.post("", response_model=VocabResponse)
async def generate_vocab(body: VocabRequest, user_id: str = Depends(get_current_user)):
    vocab = await get_chapter_vocab(
        user_id=user_id,
        lesson_id=body.lesson_id,
        chapter_title=body.chapter_title
    )
    return VocabResponse(vocab=vocab)
