from bson import ObjectId
from fastapi import HTTPException
from ..database import get_db

def _summary(doc: dict) -> dict:
    return {
        "_id": str(doc["_id"]),
        "topic": doc.get("topic", ""),
        "vibe": doc.get("vibe", ""),
        "type": doc.get("type", "ai_generated"),
        "createdAt": doc.get("createdAt"),
    }

def _serialize(doc: dict) -> dict:
    """Convert ObjectId fields to strings for JSON serialisation."""
    doc["_id"] = str(doc["_id"])
    return doc

async def list_user_lessons(user_id: str) -> list[dict]:
    db = get_db()
    ai_cursor = (
        db["ailessons"]
        .find({"userId": user_id}, {"topic": 1, "vibe": 1, "createdAt": 1, "type": 1})
        .sort("createdAt", -1)
    )
    pdf_cursor = (
        db["uploaded_pdf_lessons"]
        .find({"userId": user_id}, {"topic": 1, "vibe": 1, "createdAt": 1, "type": 1})
        .sort("createdAt", -1)
    )
    lessons = [_summary(doc) async for doc in ai_cursor]
    lessons.extend([_summary(doc) async for doc in pdf_cursor])
    lessons.sort(key=lambda lesson: lesson.get("createdAt") or "", reverse=True)
    return lessons

async def get_single_lesson(user_id: str, lesson_id: str) -> dict:
    db = get_db()
    
    if not ObjectId.is_valid(lesson_id):
        raise HTTPException(status_code=400, detail="ID required and must be a valid ObjectId")

    lesson = await db["ailessons"].find_one({"_id": ObjectId(lesson_id), "userId": user_id})
    if not lesson:
        lesson = await db["uploaded_pdf_lessons"].find_one({"_id": ObjectId(lesson_id), "userId": user_id})

    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    return _serialize(lesson)

async def remove_lesson(user_id: str, lesson_id: str) -> dict:
    db = get_db()
    
    if not ObjectId.is_valid(lesson_id):
        raise HTTPException(status_code=400, detail="ID required and must be a valid ObjectId")

    result = await db["ailessons"].find_one_and_delete(
        {"_id": ObjectId(lesson_id), "userId": user_id}
    )
    if not result:
        result = await db["uploaded_pdf_lessons"].find_one_and_delete(
            {"_id": ObjectId(lesson_id), "userId": user_id}
        )

    if not result:
        raise HTTPException(status_code=404, detail="Lesson not found or unauthorized")

    return {"success": True}
