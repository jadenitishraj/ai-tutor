from fastapi import APIRouter, Depends
from pydantic import BaseModel
import logging

from ..services.mindmap_service import get_chapter_mindmap
from ..utils.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()

class MindmapRequest(BaseModel):
    lesson_id: str
    chapter_title: str

class MindmapResponse(BaseModel):
    tree: str

@router.post("", response_model=MindmapResponse)
async def generate_mindmap(body: MindmapRequest, user_id: str = Depends(get_current_user)):
    tree = await get_chapter_mindmap(
        user_id=user_id,
        lesson_id=body.lesson_id,
        chapter_title=body.chapter_title
    )
    return MindmapResponse(tree=tree)
