"""
FastAPI application entry point.

Run with:
    uvicorn app.main:app --reload --port 8000
"""

import logging
from contextlib import asynccontextmanager
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware

from .config import get_settings
from .database import connect_db, close_db
from .routes import curriculum, chapter, chat, get_lesson, my_lessons, refine_curriculum, auth

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)


# ── lifespan (startup / shutdown) ─────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    yield
    await close_db()


# ── app factory ───────────────────────────────────────────────────────────────

def create_app() -> FastAPI:
    settings = get_settings()

    application = FastAPI(
        title="AI Tutor API",
        description="FastAPI backend for AI Tutor – curriculum, chapters, & chat.",
        version="1.0.0",
        lifespan=lifespan,
    )

    # CORS
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Session Middleware required for Authlib state token passing
    application.add_middleware(
        SessionMiddleware, secret_key=settings.secret_key
    )

    # Routes – mirroring the original Next.js /app/api/ai-tutor/* paths
    application.include_router(auth.router,              prefix="/api/auth",                 tags=["Auth"])
    application.include_router(curriculum.router,        prefix="/api/ai-tutor/curriculum",        tags=["Curriculum"])
    application.include_router(chapter.router,           prefix="/api/ai-tutor/chapter",           tags=["Chapter"])
    application.include_router(chat.router,              prefix="/api/ai-tutor/chat",              tags=["Chat"])
    application.include_router(get_lesson.router,        prefix="/api/ai-tutor/get-lesson",        tags=["Lessons"])
    application.include_router(my_lessons.router,        prefix="/api/ai-tutor/my-lessons",        tags=["Lessons"])
    application.include_router(refine_curriculum.router, prefix="/api/ai-tutor/refine-curriculum", tags=["Curriculum"])

    @application.get("/health", tags=["Health"])
    async def health():
        return {"status": "ok"}

    return application


app = create_app()
