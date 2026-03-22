from bson import ObjectId
from fastapi import HTTPException

from ..database import get_db
from ..agents.agent import invoke_tutor_agent

CONTENT_PREVIEW = 6000  # give the summarizer more context


async def get_chapter_summary(user_id: str, lesson_id: str, chapter_title: str) -> list[str]:
    """Fetches chapter content from DB and invokes the summary agent."""
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
    if chapter.get("summary_result"):
        return chapter["summary_result"]

    result = await invoke_tutor_agent({
        "task": "summarize_chapter",
        "chapter_title": chapter_title,
        "chapter_content": chapter.get("content", "")[:CONTENT_PREVIEW],
    })

    if result.get("error") or not result.get("summary_result"):
        raise HTTPException(
            status_code=500,
            detail=result.get("error") or "Failed to generate summary.",
        )

    # Cache the result in the database
    await db["ailessons"].update_one(
        {"_id": ObjectId(lesson_id), "userId": user_id, "chapters.title": chapter_title},
        {"$set": {"chapters.$.summary_result": result["summary_result"]}}
    )

    return result["summary_result"]
