"""
POST /api/ai-tutor/chat

Sends a user message to OpenAI with chapter content + recent chat history
as context, saves the exchange to MongoDB, and returns the AI reply.
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

HISTORY_WINDOW = 10  # mirror JS: last 10 messages
CONTENT_PREVIEW = 3000  # chars of chapter content sent as context


# ── schemas ───────────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    lesson_id: str
    chapter_title: str
    message: str


class ChatResponse(BaseModel):
    role: str
    content: str


# ── endpoint ──────────────────────────────────────────────────────────────────

@router.post("", response_model=ChatResponse)
async def chat(body: ChatRequest, user_id: str = Depends(get_current_user)):
    settings = get_settings()
    db = get_db()

    if not ObjectId.is_valid(body.lesson_id):
        raise HTTPException(status_code=400, detail="Invalid lesson ID")

    lesson = await db["ailessons"].find_one({"_id": ObjectId(body.lesson_id), "userId": user_id})
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    chapters: list[dict] = lesson.get("chapters", [])
    chapter_idx = next(
        (i for i, ch in enumerate(chapters) if ch.get("title") == body.chapter_title),
        -1,
    )
    if chapter_idx == -1:
        raise HTTPException(
            status_code=404,
            detail="Chapter content not found. Please generate it first.",
        )

    chapter = chapters[chapter_idx]

    # Build context
    recent_history = chapter.get("chatHistory", [])[-HISTORY_WINDOW:]
    messages_for_ai = [
        {"role": msg["role"], "content": msg["content"]} for msg in recent_history
    ]

    content_preview = (chapter.get("content") or "")[:CONTENT_PREVIEW]

    system_prompt = (
        "You are a helpful AI Tutor. The user is asking a question about the following lesson content:\n\n"
        "---\n"
        f"TITLE: {chapter['title']}\n"
        f"CONTENT:\n{content_preview} ... (truncated if long)\n"
        "---\n\n"
        "Answer the user's question based on the content provided or your general knowledge "
        "if the content is insufficient. Keep answers concise and helpful."
    )

    if not settings.openai_api_key:
        raise HTTPException(status_code=500, detail="OpenAI API Key is missing")

    client = AsyncOpenAI(api_key=settings.openai_api_key)

    completion = await client.chat.completions.create(
        messages=[
            {"role": "system", "content": system_prompt},
            *messages_for_ai,
            {"role": "user", "content": body.message},
        ],
        model="gpt-4o-mini",
    )

    ai_response = completion.choices[0].message.content or ""

    # Persist chat history
    chapters[chapter_idx].setdefault("chatHistory", [])
    chapters[chapter_idx]["chatHistory"].extend([
        {"role": "user", "content": body.message},
        {"role": "assistant", "content": ai_response},
    ])

    await db["ailessons"].update_one(
        {"_id": ObjectId(body.lesson_id)},
        {"$set": {"chapters": chapters, "updatedAt": datetime.now(timezone.utc)}},
    )

    return ChatResponse(role="assistant", content=ai_response)
