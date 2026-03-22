from datetime import datetime, timezone
from pathlib import Path

from bson import ObjectId
from fastapi import HTTPException

from ..database import get_db
from ..agents.agent import invoke_tutor_agent

CHAT_CONTENT_PREVIEW = 3000
PAGE_CONTENT_PREVIEW = 8000
CHAT_HISTORY_WINDOW = 10


def extract_pdf_pages(file_path: Path) -> list[dict]:
    try:
        from pypdf import PdfReader
    except ImportError as exc:
        raise HTTPException(
            status_code=500,
            detail="PDF processing dependency missing. Install `pypdf` in the backend environment.",
        ) from exc

    try:
        reader = PdfReader(str(file_path))
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Failed to read PDF file.") from exc

    pages: list[dict] = []
    for index, page in enumerate(reader.pages, start=1):
        try:
            text = (page.extract_text() or "").strip()
        except Exception:
            text = ""
        pages.append(
            {
                "pageNumber": index,
                "title": f"Page {index}",
                "text": text,
                "chatHistory": [],
            }
        )
    return pages


async def create_uploaded_pdf_lesson(
    user_id: str,
    *,
    filename: str,
    stored_filename: str,
    content_type: str | None,
    size: int,
    file_path: Path,
    file_url: str,
) -> dict:
    db = get_db()
    pages = extract_pdf_pages(file_path)
    now = datetime.now(timezone.utc)
    lesson = {
        "userId": user_id,
        "topic": filename,
        "vibe": "Upload",
        "type": "uploaded_pdf",
        "fileName": filename,
        "storedFileName": stored_filename,
        "contentType": content_type,
        "filePath": str(file_path),
        "fileUrl": file_url,
        "fileSize": size,
        "pageCount": len(pages),
        "pages": pages,
        "createdAt": now,
        "updatedAt": now,
    }
    result = await db["uploaded_pdf_lessons"].insert_one(lesson)
    lesson["_id"] = result.inserted_id
    return serialize_uploaded_pdf_lesson(lesson)


def serialize_uploaded_pdf_lesson(doc: dict) -> dict:
    return {
        "_id": str(doc["_id"]),
        "topic": doc.get("topic", ""),
        "type": doc.get("type", "uploaded_pdf"),
        "fileName": doc.get("fileName", ""),
        "fileUrl": doc.get("fileUrl", ""),
        "fileSize": doc.get("fileSize", 0),
        "pageCount": doc.get("pageCount", 0),
        "createdAt": doc.get("createdAt"),
    }


async def get_uploaded_pdf_lesson(user_id: str, lesson_id: str) -> dict:
    db = get_db()
    if not ObjectId.is_valid(lesson_id):
        raise HTTPException(status_code=400, detail="Invalid lesson ID")
    lesson = await db["uploaded_pdf_lessons"].find_one({"_id": ObjectId(lesson_id), "userId": user_id})
    if not lesson:
        raise HTTPException(status_code=404, detail="Uploaded PDF lesson not found")
    return lesson


async def get_uploaded_pdf_lesson_summary(user_id: str, lesson_id: str) -> dict:
    lesson = await get_uploaded_pdf_lesson(user_id, lesson_id)
    return serialize_uploaded_pdf_lesson(lesson)


async def get_uploaded_pdf_page(user_id: str, lesson_id: str, page_number: int) -> dict:
    lesson = await get_uploaded_pdf_lesson(user_id, lesson_id)
    page = _get_page(lesson, page_number)
    return {
        "pageNumber": page_number,
        "title": page.get("title") or f"Page {page_number}",
        "text": page.get("text", ""),
        "pageCount": lesson.get("pageCount", 0),
        "fileUrl": lesson.get("fileUrl", ""),
        "topic": lesson.get("topic", ""),
        "chatHistory": page.get("chatHistory", []),
    }


def _get_page(lesson: dict, page_number: int) -> dict:
    pages = lesson.get("pages", [])
    if page_number < 1 or page_number > len(pages):
        raise HTTPException(status_code=404, detail="PDF page not found")
    return pages[page_number - 1]


async def _update_pages(lesson: dict) -> None:
    db = get_db()
    await db["uploaded_pdf_lessons"].update_one(
        {"_id": lesson["_id"]},
        {"$set": {"pages": lesson["pages"], "updatedAt": datetime.now(timezone.utc)}},
    )


async def get_uploaded_pdf_summary(user_id: str, lesson_id: str, page_number: int) -> list[str]:
    lesson = await get_uploaded_pdf_lesson(user_id, lesson_id)
    page = _get_page(lesson, page_number)
    if page.get("summary_result"):
        return page["summary_result"]

    text = page.get("text", "").strip()
    if not text:
        return []

    result = await invoke_tutor_agent({
        "task": "summarize_chapter",
        "chapter_title": page.get("title", f"Page {page_number}"),
        "chapter_content": text[:PAGE_CONTENT_PREVIEW],
    })
    bullets = result.get("summary_result")
    if result.get("error") or bullets is None:
        raise HTTPException(status_code=500, detail=result.get("error") or "Failed to generate summary.")

    page["summary_result"] = bullets
    await _update_pages(lesson)
    return bullets


async def get_uploaded_pdf_mindmap(user_id: str, lesson_id: str, page_number: int) -> str:
    lesson = await get_uploaded_pdf_lesson(user_id, lesson_id)
    page = _get_page(lesson, page_number)
    if page.get("mindmap_result"):
        return page["mindmap_result"]

    text = page.get("text", "").strip()
    if not text:
        return ""

    result = await invoke_tutor_agent({
        "task": "generate_mindmap",
        "chapter_title": page.get("title", f"Page {page_number}"),
        "chapter_content": text[:PAGE_CONTENT_PREVIEW],
    })
    tree = result.get("mindmap_result")
    if result.get("error") or tree is None:
        raise HTTPException(status_code=500, detail=result.get("error") or "Failed to generate mindmap.")

    page["mindmap_result"] = tree
    await _update_pages(lesson)
    return tree


async def get_uploaded_pdf_vocab(user_id: str, lesson_id: str, page_number: int) -> list[dict]:
    lesson = await get_uploaded_pdf_lesson(user_id, lesson_id)
    page = _get_page(lesson, page_number)
    if "vocab_result" in page:
        return page["vocab_result"]

    text = page.get("text", "").strip()
    if not text:
        return []

    result = await invoke_tutor_agent({
        "task": "generate_vocab",
        "chapter_title": page.get("title", f"Page {page_number}"),
        "chapter_content": text[:PAGE_CONTENT_PREVIEW],
    })
    vocab = result.get("vocab_result", [])
    if result.get("error"):
        raise HTTPException(status_code=500, detail=result.get("error") or "Failed to extract vocabulary.")

    page["vocab_result"] = vocab
    await _update_pages(lesson)
    return vocab


async def generate_uploaded_pdf_mcq(user_id: str, lesson_id: str, page_number: int) -> dict:
    lesson = await get_uploaded_pdf_lesson(user_id, lesson_id)
    page = _get_page(lesson, page_number)
    text = page.get("text", "").strip()
    if not text:
        return {}

    existing_mcqs = page.get("mcqs", [])
    existing_texts = [m.get("question", "") for m in existing_mcqs]

    result = await invoke_tutor_agent({
        "task": "generate_mcq",
        "chapter_title": page.get("title", f"Page {page_number}"),
        "chapter_content": text[:PAGE_CONTENT_PREVIEW],
        "existing_mcqs": existing_texts,
    })
    mcq = result.get("mcq_result")
    if result.get("error") or not mcq:
        raise HTTPException(status_code=500, detail=result.get("error") or "Failed to generate MCQ.")

    page.setdefault("mcqs", []).append(mcq)
    await _update_pages(lesson)
    return mcq


async def get_uploaded_pdf_question_answer(user_id: str, lesson_id: str, page_number: int) -> list[dict]:
    lesson = await get_uploaded_pdf_lesson(user_id, lesson_id)
    page = _get_page(lesson, page_number)
    if "question_answer_result" in page:
        return page["question_answer_result"]

    text = page.get("text", "").strip()
    if not text:
        return []

    result = await invoke_tutor_agent({
        "task": "generate_question_answer",
        "chapter_title": page.get("title", f"Page {page_number}"),
        "chapter_content": text[:PAGE_CONTENT_PREVIEW],
    })
    qa = result.get("question_answer_result", [])
    if result.get("error"):
        raise HTTPException(status_code=500, detail=result.get("error") or "Failed to generate Q&A.")

    page["question_answer_result"] = qa
    await _update_pages(lesson)
    return qa


async def process_uploaded_pdf_chat_message(user_id: str, lesson_id: str, page_number: int, message: str) -> str:
    lesson = await get_uploaded_pdf_lesson(user_id, lesson_id)
    page = _get_page(lesson, page_number)
    history_window = page.get("chatHistory", [])[-CHAT_HISTORY_WINDOW:]
    recent_history = list(history_window) + [{"role": "user", "content": message}]
    text = (page.get("text") or "")[:CHAT_CONTENT_PREVIEW]

    result = await invoke_tutor_agent({
        "task": "chat",
        "chapter_title": page.get("title", f"Page {page_number}"),
        "chapter_content": text,
        "recent_history": recent_history,
    })
    ai_response = result.get("chat_result")
    if result.get("error") or not ai_response:
        raise HTTPException(status_code=500, detail=result.get("error") or "Chat agent failed to respond.")

    page.setdefault("chatHistory", []).extend([
        {"role": "user", "content": message},
        {"role": "assistant", "content": ai_response},
    ])
    await _update_pages(lesson)
    return ai_response
