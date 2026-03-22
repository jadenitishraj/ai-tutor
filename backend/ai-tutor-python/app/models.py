"""
Pydantic models that mirror the Mongoose AILesson schema.
"""

from datetime import datetime
from typing import Optional
from bson import ObjectId
from pydantic import BaseModel, Field


# ── helpers ───────────────────────────────────────────────────────────────────

class PyObjectId(str):
    """Serialisable wrapper around bson.ObjectId."""

    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v):
        if isinstance(v, ObjectId):
            return str(v)
        if ObjectId.is_valid(str(v)):
            return str(v)
        raise ValueError(f"Invalid ObjectId: {v}")

    @classmethod
    def __get_pydantic_core_schema__(cls, source_type, handler):
        from pydantic_core import core_schema
        return core_schema.no_info_plain_validator_function(cls.validate)


# ── sub-documents ─────────────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str          # "user" | "assistant" | "system"
    content: str


class Chapter(BaseModel):
    title: str
    content: Optional[str] = None
    chat_history: list[ChatMessage] = Field(default_factory=list, alias="chatHistory")

    class Config:
        populate_by_name = True


# ── main document ─────────────────────────────────────────────────────────────

class AILessonDocument(BaseModel):
    """Full document as stored in MongoDB."""
    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    user_id: str = Field(alias="userId")
    topic: str
    vibe: str
    curriculum: list[str] = Field(default_factory=list)
    chapters: list[Chapter] = Field(default_factory=list)
    current_chapter_index: int = Field(default=0, alias="currentChapterIndex")
    created_at: Optional[datetime] = Field(default=None, alias="createdAt")
    updated_at: Optional[datetime] = Field(default=None, alias="updatedAt")

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True


class AILessonSummary(BaseModel):
    """Lightweight projection used by my-lessons."""
    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    topic: str
    vibe: str
    created_at: Optional[datetime] = Field(default=None, alias="createdAt")

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
