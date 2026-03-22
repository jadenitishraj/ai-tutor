from bson import ObjectId
from fastapi import HTTPException

from ..database import get_db
from ..agents.agent import invoke_tutor_agent

CONTENT_PREVIEW = 8000


async def get_chapter_mcqs(user_id: str, lesson_id: str, chapter_title: str) -> list[dict]:
    """Retrieves existing MCQs for a chapter from the DB."""
    db = get_db()

    if not ObjectId.is_valid(lesson_id):
        raise HTTPException(status_code=400, detail="Invalid lesson ID")

    lesson = await db["ailessons"].find_one({"_id": ObjectId(lesson_id), "userId": user_id})
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    chapter = next(
        (ch for ch in lesson.get("chapters", []) if ch.get("title") == chapter_title),
        None,
    )
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")

    return chapter.get("mcqs", [])


async def generate_next_mcq(user_id: str, lesson_id: str, chapter_title: str) -> dict:
    """Generates a new MCQ, saves it to DB, and returns it."""
    db = get_db()

    if not ObjectId.is_valid(lesson_id):
        raise HTTPException(status_code=400, detail="Invalid lesson ID")

    lesson = await db["ailessons"].find_one({"_id": ObjectId(lesson_id), "userId": user_id})
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    chapter = next(
        (ch for ch in lesson.get("chapters", []) if ch.get("title") == chapter_title),
        None,
    )
    if not chapter or not chapter.get("content"):
        raise HTTPException(
            status_code=404,
            detail="Chapter content not found.",
        )

    existing_mcqs = chapter.get("mcqs", [])
    existing_texts = [m["question"] for m in existing_mcqs]

    result = await invoke_tutor_agent({
        "task": "generate_mcq",
        "chapter_title": chapter_title,
        "chapter_content": chapter.get("content", "")[:CONTENT_PREVIEW],
        "existing_mcqs": existing_texts
    })

    if result.get("error") or not result.get("mcq_result"):
        raise HTTPException(
            status_code=500,
            detail=result.get("error") or "Failed to generate MCQ.",
        )

    new_mcq = result["mcq_result"]

    # Save to database
    await db["ailessons"].update_one(
        {"_id": ObjectId(lesson_id), "userId": user_id, "chapters.title": chapter_title},
        {"$push": {"chapters.$.mcqs": new_mcq}}
    )

    return new_mcq
