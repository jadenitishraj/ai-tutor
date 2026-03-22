# AI Tutor – FastAPI Python Backend

A faithful Python/FastAPI port of the original Next.js API routes.

## Structure

```
ai-tutor-python/
├── app/
│   ├── main.py               ← FastAPI app, CORS, route registration
│   ├── config.py             ← Settings loaded from .env
│   ├── database.py           ← Motor (async MongoDB) connection
│   ├── models.py             ← Pydantic models (mirrors Mongoose schema)
│   ├── routes/
│   │   ├── curriculum.py     ← POST /api/ai-tutor/curriculum
│   │   ├── chapter.py        ← POST /api/ai-tutor/chapter
│   │   ├── chat.py           ← POST /api/ai-tutor/chat
│   │   ├── get_lesson.py     ← GET  /api/ai-tutor/get-lesson
│   │   ├── my_lessons.py     ← GET | DELETE /api/ai-tutor/my-lessons
│   │   └── refine_curriculum.py ← POST /api/ai-tutor/refine-curriculum
│   └── utils/
│       └── curriculum.py     ← Parsing / sanitisation helpers
├── .env                      ← Secrets (gitignored)
├── requirements.txt
└── start.sh                  ← One-shot dev launcher
```

## Quick Start

```bash
cd ai-tutor-python
chmod +x start.sh
./start.sh
```

Or manually:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| POST | `/api/ai-tutor/curriculum` | Generate a new curriculum & lesson |
| POST | `/api/ai-tutor/chapter` | Generate / fetch a chapter |
| POST | `/api/ai-tutor/chat` | Chat with AI about a chapter |
| GET | `/api/ai-tutor/get-lesson` | Fetch a full lesson by ID |
| GET | `/api/ai-tutor/my-lessons` | List all lessons for a user |
| DELETE | `/api/ai-tutor/my-lessons` | Delete a lesson |
| POST | `/api/ai-tutor/refine-curriculum` | Refine existing curriculum |

Interactive docs: **http://localhost:8000/docs**

## Auth Note

The original JS code used NextAuth sessions to get `userId`.
In this FastAPI version, `user_id` is passed as a **request body field** (POST routes)
or **query param** (GET/DELETE routes).  
When you add JWT auth, swap it for a `Depends(get_current_user)` dependency.
