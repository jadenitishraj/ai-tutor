"""
GET /api/ai-tutor/get-lesson?id=<lessonId>&user_id=<userId>

Returns a single full lesson document owned by the requesting user.
"""

import logging
from fastapi import APIRouter, HTTPException, Query, Depends
from bson import ObjectId

from ..database import get_db
from ..utils.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()


def _serialize(doc: dict) -> dict:
    """Convert ObjectId fields to strings for JSON serialisation."""
    doc["_id"] = str(doc["_id"])
    for ch in doc.get("chapters", []):
        pass  # no nested ObjectIds in chapters
    return doc


@router.get("")
async def get_lesson(
    id: str = Query(..., description="Lesson ObjectId"),
    user_id: str = Depends(get_current_user),
):
    db = get_db()

    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="ID required and must be a valid ObjectId")

    lesson = await db["ailessons"].find_one({"_id": ObjectId(id), "userId": user_id})

    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    return _serialize(lesson)
