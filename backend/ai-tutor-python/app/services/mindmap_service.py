from bson import ObjectId
from fastapi import HTTPException

from ..database import get_db
from ..agents.agent import invoke_tutor_agent

CONTENT_PREVIEW = 8000  # Give decent context for tree


async def get_chapter_mindmap(user_id: str, lesson_id: str, chapter_title: str) -> str:
    """Fetches chapter content from DB and invokes the mindmap agent."""
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
            detail="Chapter content not found. Please generate the chapter first.",
        )

    # Return cached result if it exists
    if chapter.get("mindmap_result"):
        return chapter["mindmap_result"]

    result = await invoke_tutor_agent({
        "task": "generate_mindmap",
        "chapter_title": chapter_title,
        "chapter_content": chapter.get("content", "")[:CONTENT_PREVIEW],
    })

    if result.get("error") or not result.get("mindmap_result"):
        raise HTTPException(
            status_code=500,
            detail=result.get("error") or "Failed to generate mindmap.",
        )

    # Cache the result in the database
    await db["ailessons"].update_one(
        {"_id": ObjectId(lesson_id), "userId": user_id, "chapters.title": chapter_title},
        {"$set": {"chapters.$.mindmap_result": result["mindmap_result"]}}
    )

    return result["mindmap_result"]
