from bson import ObjectId
from fastapi import HTTPException

from ..database import get_db
from ..agents.agent import invoke_tutor_agent

CONTENT_PREVIEW = 8000  # Context to find words


async def get_chapter_vocab(user_id: str, lesson_id: str, chapter_title: str) -> list[dict]:
    """Fetches chapter content from DB and invokes the vocab agent."""
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
    if "vocab_result" in chapter:
        return chapter["vocab_result"]

    result = await invoke_tutor_agent({
        "task": "generate_vocab",
        "chapter_title": chapter_title,
        "chapter_content": chapter.get("content", "")[:CONTENT_PREVIEW],
    })

    if result.get("error"):
        raise HTTPException(
            status_code=500,
            detail=result.get("error") or "Failed to extract vocabulary.",
        )
        
    # Vocab result may be [] but that's a valid extraction if no words found.
    vocab_data = result.get("vocab_result", [])
    
    # Cache the result in the database
    await db["ailessons"].update_one(
        {"_id": ObjectId(lesson_id), "userId": user_id, "chapters.title": chapter_title},
        {"$set": {"chapters.$.vocab_result": vocab_data}}
    )
    
    return vocab_data
