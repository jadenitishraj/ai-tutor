"""
GET  /api/ai-tutor/my-lessons?user_id=<userId>   – list all lessons for user
DELETE /api/ai-tutor/my-lessons?id=<lessonId>&user_id=<userId>  – delete a lesson
"""

import logging
from fastapi import APIRouter, HTTPException, Query, Depends
from bson import ObjectId

from ..database import get_db
from ..utils.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()


def _summary(doc: dict) -> dict:
    return {
        "_id": str(doc["_id"]),
        "topic": doc.get("topic", ""),
        "vibe": doc.get("vibe", ""),
        "createdAt": doc.get("createdAt"),
    }


@router.get("")
async def get_my_lessons(
    user_id: str = Depends(get_current_user),
):
    db = get_db()

    cursor = (
        db["ailessons"]
        .find({"userId": user_id}, {"topic": 1, "vibe": 1, "createdAt": 1})
        .sort("createdAt", -1)
    )

    lessons = [_summary(doc) async for doc in cursor]
    return lessons


@router.delete("")
async def delete_lesson(
    id: str = Query(..., description="Lesson ObjectId"),
    user_id: str = Depends(get_current_user),
):
    db = get_db()

    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="ID required and must be a valid ObjectId")

    result = await db["ailessons"].find_one_and_delete(
        {"_id": ObjectId(id), "userId": user_id}
    )

    if not result:
        raise HTTPException(status_code=404, detail="Lesson not found or unauthorized")

    logger.info("Lesson deleted: %s", id)
    return {"success": True}
