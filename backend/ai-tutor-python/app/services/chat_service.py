from bson import ObjectId
from datetime import datetime, timezone
from fastapi import HTTPException

from ..database import get_db
from ..agents.agent import invoke_tutor_agent

HISTORY_WINDOW = 10
CONTENT_PREVIEW = 3000


async def process_chat_message(
    user_id: str, lesson_id: str, chapter_title: str, message: str
) -> str:
    """Process a user chat message via the central TutorAgent graph."""
    db = get_db()

    if not ObjectId.is_valid(lesson_id):
        raise HTTPException(status_code=400, detail="Invalid lesson ID")

    lesson = await db["ailessons"].find_one({"_id": ObjectId(lesson_id), "userId": user_id})
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    chapters = lesson.get("chapters", [])
    chapter_idx = next(
        (i for i, ch in enumerate(chapters) if ch.get("title") == chapter_title),
        -1,
    )
    if chapter_idx == -1:
        raise HTTPException(
            status_code=404,
            detail="Chapter content not found. Please generate it first.",
        )

    chapter = chapters[chapter_idx]
    # Build sliding window history and append current user message at the end.
    # The chat_node in agent.py will split this list to separate history from current.
    history_window = chapter.get("chatHistory", [])[-HISTORY_WINDOW:]
    recent_history = list(history_window) + [{"role": "user", "content": message}]

    content_preview = (chapter.get("content") or "")[:CONTENT_PREVIEW]

    # ── invoke agent ──────────────────────────────────────────────────────────
    result = await invoke_tutor_agent({
        "task": "chat",
        "chapter_title": chapter_title,
        "chapter_content": content_preview,
        "recent_history": recent_history,
    })

    if result.get("error") or not result.get("chat_result"):
        raise HTTPException(
            status_code=500,
            detail=result.get("error") or "Chat agent failed to respond.",
        )

    ai_response: str = result["chat_result"]

    # ── persist both turns ────────────────────────────────────────────────────
    chapters[chapter_idx].setdefault("chatHistory", [])
    chapters[chapter_idx]["chatHistory"].extend([
        {"role": "user",      "content": message},
        {"role": "assistant", "content": ai_response},
    ])

    await db["ailessons"].update_one(
        {"_id": ObjectId(lesson_id)},
        {"$set": {"chapters": chapters, "updatedAt": datetime.now(timezone.utc)}},
    )

    return ai_response
