from fastapi import APIRouter
from pydantic import BaseModel, Field

from ..agents.chat_agent import run_chat_agent
from ..agents.mcq_agent import generate_single_mcq
from ..agents.mindmap_agent import generate_mindmap_content
from ..agents.question_answer_agent import generate_question_answer_pairs
from ..agents.summary_agent import summarize_chapter_content
from ..agents.vocab_agent import extract_vocab

router = APIRouter()


class ContentRequest(BaseModel):
    chapter_title: str
    chapter_content: str


class ContentChatRequest(ContentRequest):
    message: str
    recent_history: list[dict] = Field(default_factory=list)


class ContentMcqRequest(ContentRequest):
    existing_mcqs: list[str] = Field(default_factory=list)


class SummaryResponse(BaseModel):
    bullets: list[str]


class MindmapResponse(BaseModel):
    tree: str


class VocabResponse(BaseModel):
    vocab: list[dict]


class MCQResponse(BaseModel):
    mcq: dict


class QuestionAnswerResponse(BaseModel):
    question_answers: list[dict]


class ChatResponse(BaseModel):
    role: str
    content: str


@router.post("/summary", response_model=SummaryResponse)
async def generate_summary(body: ContentRequest):
    bullets = await summarize_chapter_content(body.chapter_title, body.chapter_content)
    return SummaryResponse(bullets=bullets)


@router.post("/mindmap", response_model=MindmapResponse)
async def generate_mindmap(body: ContentRequest):
    tree = await generate_mindmap_content(body.chapter_title, body.chapter_content)
    return MindmapResponse(tree=tree)


@router.post("/vocab", response_model=VocabResponse)
async def generate_vocab(body: ContentRequest):
    vocab = await extract_vocab(body.chapter_title, body.chapter_content)
    return VocabResponse(vocab=vocab)


@router.post("/mcq", response_model=MCQResponse)
async def generate_mcq(body: ContentMcqRequest):
    mcq = await generate_single_mcq(body.chapter_title, body.chapter_content, body.existing_mcqs)
    return MCQResponse(mcq=mcq)


@router.post("/question-answer", response_model=QuestionAnswerResponse)
async def generate_question_answer(body: ContentRequest):
    question_answers = await generate_question_answer_pairs(body.chapter_title, body.chapter_content)
    return QuestionAnswerResponse(question_answers=question_answers)


@router.post("/chat", response_model=ChatResponse)
async def chat(body: ContentChatRequest):
    content = await run_chat_agent(
        recent_history=body.recent_history,
        current_message=body.message,
        chapter_title=body.chapter_title,
        content_preview=body.chapter_content,
    )
    return ChatResponse(role="assistant", content=content)
