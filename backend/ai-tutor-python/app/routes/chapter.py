"""
POST /api/ai-tutor/chapter

Given a lessonId and chapterIndex, returns the chapter content.
If the chapter was already generated it is served from the DB cache;
otherwise it is generated via OpenAI and then saved.
"""

import logging
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from openai import AsyncOpenAI
from bson import ObjectId
from datetime import datetime, timezone

from ..database import get_db
from ..config import get_settings
from ..utils.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()


# ── schemas ───────────────────────────────────────────────────────────────────

class ChapterRequest(BaseModel):
    lesson_id: str
    chapter_index: int


class ChapterResponse(BaseModel):
    title: str
    content: str
    chat_history: list[dict]


# ── endpoint ──────────────────────────────────────────────────────────────────

@router.post("", response_model=ChapterResponse)
async def generate_chapter(body: ChapterRequest, user_id: str = Depends(get_current_user)):
    settings = get_settings()
    db = get_db()

    if not ObjectId.is_valid(body.lesson_id):
        raise HTTPException(status_code=400, detail="Invalid lesson ID")

    lesson = await db["ailessons"].find_one({"_id": ObjectId(body.lesson_id), "userId": user_id})
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    curriculum: list[str] = lesson.get("curriculum", [])
    if body.chapter_index < 0 or body.chapter_index >= len(curriculum):
        raise HTTPException(status_code=400, detail="Invalid chapter index")

    chapter_title = curriculum[body.chapter_index]

    # Cache hit: chapter already generated
    existing = next(
        (ch for ch in lesson.get("chapters", []) if ch.get("title") == chapter_title),
        None,
    )
    if existing and existing.get("content"):
        return ChapterResponse(
            title=existing["title"],
            content=existing["content"],
            chat_history=existing.get("chatHistory", []),
        )

    # Generate via OpenAI
    if not settings.openai_api_key:
        raise HTTPException(status_code=500, detail="OpenAI API Key is missing")

    client = AsyncOpenAI(api_key=settings.openai_api_key)

    prompt = (
        f'Write a comprehensive lesson for the chapter: "{chapter_title}"\n'
        f'Course Topic: "{lesson["topic"]}"\n'
        f'Tone: "{lesson["vibe"]}"\n\n'
        "Format the output as clean HTML (without <html> or <body> tags). "
        "Use <h3> for headings, <p> for paragraphs, <ul>/<li> for lists, "
        "and <pre><code> for any code examples. Make it engaging and educational."
    )

    completion = await client.chat.completions.create(
        messages=[
            {"role": "system", "content": "You are an expert tutor."},
            {"role": "user", "content": prompt},
        ],
        model="gpt-4o-mini",
    )

    content = completion.choices[0].message.content or ""

    # Upsert the chapter into the chapters array
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
        {"_id": ObjectId(body.lesson_id)},
        {"$set": {"chapters": chapters, "updatedAt": datetime.now(timezone.utc)}},
    )

    logger.info("Chapter generated: '%s' for lesson %s", chapter_title, body.lesson_id)

    return ChapterResponse(title=chapter_title, content=content, chat_history=[])
