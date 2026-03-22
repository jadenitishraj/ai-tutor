"""
POST /api/ai-tutor/refine-curriculum

Takes an existing lesson + user suggestion, regenerates the curriculum
via OpenAI, sanitises it, saves it, and clears any chapters whose titles
are no longer present in the new curriculum.
"""

import logging
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from openai import AsyncOpenAI
from bson import ObjectId
from datetime import datetime, timezone

from ..database import get_db
from ..config import get_settings
from ..utils.curriculum import (
    extract_curriculum_from_text,
    sanitize_curriculum_for_save,
)
from ..utils.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()


# ── schemas ───────────────────────────────────────────────────────────────────

class RefineCurriculumRequest(BaseModel):
    lesson_id: str
    suggestion: str
    chapter_count: int = Field(default=0, ge=0, le=30)


class RefineCurriculumResponse(BaseModel):
    lesson_id: str
    curriculum: list[str]


# ── endpoint ──────────────────────────────────────────────────────────────────

@router.post("", response_model=RefineCurriculumResponse)
async def refine_curriculum(body: RefineCurriculumRequest, user_id: str = Depends(get_current_user)):
    settings = get_settings()
    db = get_db()

    if not body.suggestion.strip():
        raise HTTPException(status_code=400, detail="lessonId and suggestion are required.")

    if not ObjectId.is_valid(body.lesson_id):
        raise HTTPException(status_code=400, detail="Invalid lesson ID")

    lesson = await db["ailessons"].find_one(
        {"_id": ObjectId(body.lesson_id), "userId": user_id}
    )
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found.")

    if not settings.openai_api_key:
        raise HTTPException(status_code=500, detail="OpenAI API Key is missing. Please add it to .env")

    existing_curriculum: list[str] = lesson.get("curriculum", [])
    safe_count = (
        min(max(body.chapter_count, 1), 30)
        if body.chapter_count > 0
        else max(len(existing_curriculum), 5)
    )

    client = AsyncOpenAI(api_key=settings.openai_api_key)

    import json as _json
    prompt = (
        f'You are an expert tutor.\n'
        f'Course topic: "{lesson["topic"]}".\n'
        f'Tone: "{lesson["vibe"]}".\n'
        f'Existing curriculum: {_json.dumps(existing_curriculum)}\n'
        f'User requested changes: "{body.suggestion}".\n\n'
        f'Create an updated curriculum with exactly {safe_count} chapter titles.\n'
        'Return ONLY a JSON array of strings.\n'
        'Do not use placeholder names like "Key Concepts" or "Generic".'
    )

    completion = await client.chat.completions.create(
        messages=[
            {"role": "system", "content": "You are a helpful JSON generator."},
            {"role": "user", "content": prompt},
        ],
        model="gpt-4o-mini",
    )

    text = completion.choices[0].message.content or ""
    curriculum = extract_curriculum_from_text(text, safe_count)
    curriculum = sanitize_curriculum_for_save(curriculum, safe_count)

    if not curriculum:
        raise HTTPException(status_code=500, detail="Failed to generate updated curriculum.")

    # Remove chapters whose titles no longer exist in the new curriculum
    new_chapters = [
        ch for ch in lesson.get("chapters", []) if ch.get("title") in curriculum
    ]

    await db["ailessons"].update_one(
        {"_id": ObjectId(body.lesson_id)},
        {
            "$set": {
                "curriculum": curriculum,
                "chapters": new_chapters,
                "currentChapterIndex": 0,
                "updatedAt": datetime.now(timezone.utc),
            }
        },
    )

    logger.info("Curriculum refined for lesson %s", body.lesson_id)
    return RefineCurriculumResponse(lesson_id=body.lesson_id, curriculum=curriculum)
