from bson import ObjectId
from fastapi import HTTPException

from ..database import get_db
from ..agents.agent import invoke_tutor_agent

CONTENT_PREVIEW = 8000


async def get_chapter_question_answer(user_id: str, lesson_id: str, chapter_title: str) -> list[dict]:
    """Fetches chapter content from DB and invokes the Q&A agent."""
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

    if "question_answer_result" in chapter:
        return chapter["question_answer_result"]

    result = await invoke_tutor_agent({
        "task": "generate_question_answer",
        "chapter_title": chapter_title,
        "chapter_content": chapter.get("content", "")[:CONTENT_PREVIEW],
    })

    if result.get("error"):
        raise HTTPException(
            status_code=500,
            detail=result.get("error") or "Failed to generate Q&A.",
        )

    qa_data = result.get("question_answer_result", [])

    await db["ailessons"].update_one(
        {"_id": ObjectId(lesson_id), "userId": user_id, "chapters.title": chapter_title},
        {"$set": {"chapters.$.question_answer_result": qa_data}},
    )

    return qa_data
