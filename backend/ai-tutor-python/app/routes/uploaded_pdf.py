from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from ..services.uploaded_pdf_service import (
    generate_uploaded_pdf_mcq,
    get_uploaded_pdf_lesson_summary,
    get_uploaded_pdf_mindmap,
    get_uploaded_pdf_page,
    get_uploaded_pdf_question_answer,
    get_uploaded_pdf_summary,
    get_uploaded_pdf_vocab,
    process_uploaded_pdf_chat_message,
)
from ..utils.auth import get_current_user

router = APIRouter()


class UploadedPdfToolRequest(BaseModel):
    lesson_id: str
    page_number: int


class UploadedPdfChatRequest(BaseModel):
    lesson_id: str
    page_number: int
    message: str


class UploadedPdfChatResponse(BaseModel):
    role: str
    content: str


class UploadedPdfSummaryResponse(BaseModel):
    bullets: list[str]


class UploadedPdfMindmapResponse(BaseModel):
    tree: str


class UploadedPdfVocabResponse(BaseModel):
    vocab: list[dict]


class UploadedPdfMcqResponse(BaseModel):
    mcq: dict = {}


class UploadedPdfQuestionAnswerResponse(BaseModel):
    question_answers: list[dict]


@router.get("")
async def get_uploaded_pdf_lesson(
    id: str = Query(..., description="Uploaded PDF lesson ObjectId"),
    user_id: str = Depends(get_current_user),
):
    return await get_uploaded_pdf_lesson_summary(user_id=user_id, lesson_id=id)


@router.get("/page")
async def get_uploaded_pdf_lesson_page(
    lesson_id: str = Query(...),
    page_number: int = Query(..., ge=1),
    user_id: str = Depends(get_current_user),
):
    return await get_uploaded_pdf_page(user_id=user_id, lesson_id=lesson_id, page_number=page_number)


@router.post("/summary", response_model=UploadedPdfSummaryResponse)
async def generate_uploaded_pdf_summary(body: UploadedPdfToolRequest, user_id: str = Depends(get_current_user)):
    bullets = await get_uploaded_pdf_summary(user_id=user_id, lesson_id=body.lesson_id, page_number=body.page_number)
    return UploadedPdfSummaryResponse(bullets=bullets)


@router.post("/mindmap", response_model=UploadedPdfMindmapResponse)
async def generate_uploaded_pdf_mindmap(body: UploadedPdfToolRequest, user_id: str = Depends(get_current_user)):
    tree = await get_uploaded_pdf_mindmap(user_id=user_id, lesson_id=body.lesson_id, page_number=body.page_number)
    return UploadedPdfMindmapResponse(tree=tree)


@router.post("/vocab", response_model=UploadedPdfVocabResponse)
async def generate_uploaded_pdf_vocab(body: UploadedPdfToolRequest, user_id: str = Depends(get_current_user)):
    vocab = await get_uploaded_pdf_vocab(user_id=user_id, lesson_id=body.lesson_id, page_number=body.page_number)
    return UploadedPdfVocabResponse(vocab=vocab)


@router.post("/mcq", response_model=UploadedPdfMcqResponse)
async def generate_uploaded_pdf_mcq_route(body: UploadedPdfToolRequest, user_id: str = Depends(get_current_user)):
    mcq = await generate_uploaded_pdf_mcq(user_id=user_id, lesson_id=body.lesson_id, page_number=body.page_number)
    return UploadedPdfMcqResponse(mcq=mcq)


@router.post("/question-answer", response_model=UploadedPdfQuestionAnswerResponse)
async def generate_uploaded_pdf_question_answer_route(body: UploadedPdfToolRequest, user_id: str = Depends(get_current_user)):
    question_answers = await get_uploaded_pdf_question_answer(
        user_id=user_id,
        lesson_id=body.lesson_id,
        page_number=body.page_number,
    )
    return UploadedPdfQuestionAnswerResponse(question_answers=question_answers)


@router.post("/chat", response_model=UploadedPdfChatResponse)
async def chat_with_uploaded_pdf(body: UploadedPdfChatRequest, user_id: str = Depends(get_current_user)):
    content = await process_uploaded_pdf_chat_message(
        user_id=user_id,
        lesson_id=body.lesson_id,
        page_number=body.page_number,
        message=body.message,
    )
    return UploadedPdfChatResponse(role="assistant", content=content)
