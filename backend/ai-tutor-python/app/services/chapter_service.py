from bson import ObjectId
from datetime import datetime, timezone
from fastapi import HTTPException

from ..database import get_db
from ..agents.agent import invoke_tutor_agent


CONTENT_PREVIEW = 3000


async def fetch_or_generate_chapter(
    user_id: str, lesson_id: str, chapter_index: int
) -> dict:
    """Return cached chapter or generate it via the central TutorAgent graph."""
    db = get_db()

    if not ObjectId.is_valid(lesson_id):
        raise HTTPException(status_code=400, detail="Invalid lesson ID")

    lesson = await db["ailessons"].find_one({"_id": ObjectId(lesson_id), "userId": user_id})
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    curriculum: list[str] = lesson.get("curriculum", [])
    if chapter_index < 0 or chapter_index >= len(curriculum):
        raise HTTPException(status_code=400, detail="Invalid chapter index")

    chapter_title = curriculum[chapter_index]

    # ── cache hit ─────────────────────────────────────────────────────────────
    existing = next(
        (ch for ch in lesson.get("chapters", []) if ch.get("title") == chapter_title),
        None,
    )
    if existing and existing.get("content"):
        return {
            "title": existing["title"],
            "content": existing["content"],
            "chat_history": existing.get("chatHistory", []),
        }

    # ── invoke agent ──────────────────────────────────────────────────────────
    result = await invoke_tutor_agent({
        "task": "generate_chapter",
        "chapter_title": chapter_title,
        "topic": lesson.get("topic", ""),
        "vibe": lesson.get("vibe", "Standard"),
    })

    if result.get("error") or not result.get("chapter_result"):
        raise HTTPException(
            status_code=500,
            detail=result.get("error") or "Failed to generate chapter content.",
        )

    content: str = result["chapter_result"]

    # ── persist ───────────────────────────────────────────────────────────────
    chapters: list[dict] = lesson.get("chapters", [])
    existing_idx = next(
        (i for i, ch in enumerate(chapters) if ch.get("title") == chapter_title),
        -1,
    )
    if existing_idx >= 0:
        chapters[existing_idx]["content"] = content
    else:
        chapters.append({"title": chapter_title, "content": content, "chatHistory": []})

    await db["ailessons"].update_one(
        {"_id": ObjectId(lesson_id)},
        {"$set": {"chapters": chapters, "updatedAt": datetime.now(timezone.utc)}},
    )

    return {"title": chapter_title, "content": content, "chat_history": []}
