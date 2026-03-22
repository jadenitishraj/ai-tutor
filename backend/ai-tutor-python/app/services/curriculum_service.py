from bson import ObjectId
from datetime import datetime, timezone
from fastapi import HTTPException

from ..database import get_db
from ..agents.agent import invoke_tutor_agent


async def create_lesson_curriculum(
    user_id: str, topic: str, vibe: str, custom_vibe: str, chapter_count: int
) -> dict:
    """Generate and store curriculum for a new lesson via the central TutorAgent graph."""
    result = await invoke_tutor_agent({
        "task": "generate_curriculum",
        "topic": topic,
        "vibe": vibe,
        "custom_vibe": custom_vibe,
        "chapter_count": chapter_count,
    })

    if result.get("error") or not result.get("curriculum_result"):
        raise HTTPException(status_code=500, detail=result.get("error") or "Failed to generate curriculum")

    curriculum: list[str] = result["curriculum_result"]

    db = get_db()
    doc = {
        "userId": user_id,
        "topic": topic,
        "vibe": vibe if vibe != "Custom" else custom_vibe,
        "curriculum": curriculum,
        "chapters": [],
        "currentChapterIndex": 0,
        "createdAt": datetime.now(timezone.utc),
        "updatedAt": datetime.now(timezone.utc),
    }

    insert_result = await db["ailessons"].insert_one(doc)
    return {
        "lesson_id": str(insert_result.inserted_id),
        "curriculum": curriculum,
    }


async def refine_lesson_curriculum(
    user_id: str, lesson_id: str, suggestion: str, chapter_count: int
) -> dict:
    """Refine an existing curriculum via the central TutorAgent graph."""
    db = get_db()

    if not ObjectId.is_valid(lesson_id):
        raise HTTPException(status_code=400, detail="Invalid lesson ID")

    lesson = await db["ailessons"].find_one({"_id": ObjectId(lesson_id), "userId": user_id})
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found.")

    existing_curriculum: list[str] = lesson.get("curriculum", [])
    safe_count = (
        min(max(chapter_count, 1), 30)
        if chapter_count > 0
        else max(len(existing_curriculum), 5)
    )

    result = await invoke_tutor_agent({
        "task": "refine_curriculum",
        "topic": lesson.get("topic", ""),
        "vibe": lesson.get("vibe", "Standard"),
        "existing_curriculum": existing_curriculum,
        "suggestion": suggestion,
        "chapter_count": safe_count,
    })

    if result.get("error") or not result.get("curriculum_result"):
        raise HTTPException(
            status_code=500,
            detail=result.get("error") or "Failed to generate updated curriculum.",
        )

    curriculum: list[str] = result["curriculum_result"]

    new_chapters = [
        ch for ch in lesson.get("chapters", []) if ch.get("title") in curriculum
    ]

    await db["ailessons"].update_one(
        {"_id": ObjectId(lesson_id)},
        {
            "$set": {
                "curriculum": curriculum,
                "chapters": new_chapters,
                "currentChapterIndex": 0,
                "updatedAt": datetime.now(timezone.utc),
            }
        },
    )

    return {"lesson_id": lesson_id, "curriculum": curriculum}
