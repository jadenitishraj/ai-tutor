from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..database import get_db
from ..utils.auth import get_current_user

public_router = APIRouter()
admin_router = APIRouter()


def now_utc():
    return datetime.now(timezone.utc)


SEED_TRACKS = [
    {
        "slug": "agentic-ai",
        "title": "Agentic AI",
        "subtitle": "Master tools, memory, orchestration, safety, and real multi-agent architecture tradeoffs.",
        "accent": "cyan",
        "order": 1,
        "categories": ["Planning", "Tools", "Memory", "Evaluation", "Safety", "Multi-Agent", "Observability"],
        "tags": ["Reliability", "Prompting", "Context", "Tracing", "Metrics", "Governance"],
        "questions": [
            {
                "number": 1,
                "title": "How do you design an agent loop for reliable task execution?",
                "difficulty": "Medium",
                "category": "Planning",
                "tags": ["Tools", "Reliability"],
                "answer_html": "<p>A reliable agent loop should separate planning, execution, observation, and retry decisions instead of letting one prompt do everything.</p><h3>Recommended structure</h3><ul><li>Accept a user goal and convert it into a bounded task plan.</li><li>Run one step at a time through explicit tool calls.</li><li>Capture tool output as structured observations.</li><li>Decide whether to continue, recover, or stop.</li><li>Log every transition for replay and debugging.</li></ul><p>The key interview point is control. The loop needs guardrails for retries, timeouts, bad tool outputs, and stop conditions so the agent does not drift forever.</p>",
            },
            {
                "number": 2,
                "title": "When should an agent use tools vs answer directly from context?",
                "difficulty": "Easy",
                "category": "Tools",
                "tags": ["Prompting"],
                "answer_html": "<p>An agent should answer directly when the available context is sufficient and stable. It should use tools when the answer depends on fresh data, private systems, calculations, or side effects.</p><ul><li>Use direct reasoning for summarization, explanation, and synthesis.</li><li>Use tools for search, retrieval, actions, or verification.</li><li>Prefer tool use when correctness matters more than latency.</li><li>Avoid unnecessary tool calls to reduce cost and failure surface area.</li></ul>",
            },
            {
                "number": 3,
                "title": "How would you add memory to an agent without polluting future decisions?",
                "difficulty": "Medium",
                "category": "Memory",
                "tags": ["Context"],
                "answer_html": "<p>Memory should be selective, typed, and scoped. If you dump raw history into every turn, the agent becomes noisy and starts amplifying stale assumptions.</p><ul><li>Separate working memory from long-term memory.</li><li>Store only durable facts, preferences, and important outcomes.</li><li>Attach timestamps and confidence scores.</li><li>Retrieve memory by relevance instead of dumping everything into the prompt.</li></ul>",
            },
            {
                "number": 4,
                "title": "What failure modes matter most in multi-agent orchestration?",
                "difficulty": "Hard",
                "category": "Multi-Agent",
                "tags": ["Observability", "Safety"],
                "answer_html": "<p>Multi-agent systems fail when coordination is ambiguous. Agents can duplicate work, contradict each other, or pass weak outputs downstream without validation.</p><ul><li>No single source of truth for task state.</li><li>Recursive delegation loops.</li><li>Unclear ownership between planner and worker agents.</li><li>Tool-call storms caused by weak stopping criteria.</li><li>Difficult debugging because traces are fragmented across agents.</li></ul>",
            },
        ],
    },
    {
        "slug": "aws-for-ai",
        "title": "AWS for AI",
        "subtitle": "Architect production-grade GenAI systems on AWS with interviewer-focused depth.",
        "accent": "orange",
        "order": 2,
        "categories": ["RAG", "Bedrock", "Pipelines", "Evaluation", "Security", "Scaling", "OCR"],
        "tags": ["Architecture", "Latency", "Ingestion", "Quality"],
        "questions": [
            {
                "number": 1,
                "title": "How would you build a Bedrock-based RAG system on AWS?",
                "difficulty": "Medium",
                "category": "RAG",
                "tags": ["Bedrock", "Architecture"],
                "answer_html": "<p>A strong AWS RAG answer usually starts with ingestion, indexing, retrieval, orchestration, and monitoring as distinct layers.</p><ul><li>Ingest documents into S3.</li><li>Extract text and metadata through a processing pipeline.</li><li>Store embeddings in a vector-capable store.</li><li>Use a Bedrock model for response generation.</li><li>Add evaluation and observability around retrieval quality and latency.</li></ul>",
            },
            {
                "number": 2,
                "title": "How do you handle PDF parsing and OCR for enterprise knowledge ingestion?",
                "difficulty": "Hard",
                "category": "OCR",
                "tags": ["Pipelines", "Ingestion"],
                "answer_html": "<p>Enterprise PDFs are messy. They include tables, images, scanned pages, headers, and inconsistent structure, so parsing must be staged instead of naive.</p><ul><li>Classify the document type first.</li><li>Use OCR only where text extraction fails.</li><li>Preserve layout-aware chunks for tables and forms.</li><li>Store page-level provenance and confidence scores.</li><li>Route low-confidence pages for fallback or review.</li></ul>",
            },
            {
                "number": 3,
                "title": "What services would you choose for secure GenAI workloads on AWS?",
                "difficulty": "Medium",
                "category": "Security",
                "tags": ["Bedrock"],
                "answer_html": "<p>Security should be described as identity, network, data, and audit controls around the full GenAI workflow.</p><ul><li>Use IAM for scoped access control.</li><li>Keep private data inside VPC-connected services where possible.</li><li>Encrypt data at rest and in transit.</li><li>Separate ingestion, serving, and admin roles.</li><li>Log prompts, outputs, and access events with compliance in mind.</li></ul>",
            },
            {
                "number": 4,
                "title": "How do you evaluate retrieval and generation quality in production?",
                "difficulty": "Medium",
                "category": "Evaluation",
                "tags": ["RAG", "Quality"],
                "answer_html": "<p>Production evaluation should measure both retrieval quality and answer quality, because a good model cannot recover from bad context.</p><ul><li>Track hit rate and relevance for retrieved chunks.</li><li>Measure groundedness and hallucination frequency.</li><li>Use offline golden datasets plus online feedback.</li><li>Evaluate by document type, tenant, and query class.</li><li>Monitor drift when the corpus changes.</li></ul>",
            },
        ],
    },
]


async def ensure_seed_tracks():
    db = get_db()
    collection = db["interview_tracks"]
    count = await collection.count_documents({})
    if count > 0:
        return

    seeded = []
    timestamp = now_utc()
    for track in SEED_TRACKS:
        seeded.append({
            **track,
            "created_at": timestamp,
            "updated_at": timestamp,
        })
    await collection.insert_many(seeded)


def serialize_track(track: dict) -> dict:
    return {
        "slug": track["slug"],
        "title": track["title"],
        "subtitle": track.get("subtitle", ""),
        "accent": track.get("accent", "cyan"),
        "order": track.get("order", 999),
        "categories": track.get("categories", []),
        "tags": track.get("tags", []),
        "question_count": len(track.get("questions", [])),
        "questions": sorted(track.get("questions", []), key=lambda item: item.get("number", 999)),
    }


class TrackCreateRequest(BaseModel):
    title: str
    slug: str
    subtitle: str = ""
    accent: str = "cyan"


class MetadataRequest(BaseModel):
    value: str


class QuestionCreateRequest(BaseModel):
    category: str
    difficulty: str
    title: str
    tags: list[str] = Field(default_factory=list)
    answer_html: str


class QuestionUpdateRequest(QuestionCreateRequest):
    number: int


@public_router.get("")
async def list_tracks():
    await ensure_seed_tracks()
    db = get_db()
    docs = await db["interview_tracks"].find({}).sort("order", 1).to_list(None)
    return {"tracks": [serialize_track(doc) for doc in docs]}


@public_router.get("/{slug}")
async def get_track(slug: str):
    await ensure_seed_tracks()
    db = get_db()
    doc = await db["interview_tracks"].find_one({"slug": slug})
    if not doc:
      raise HTTPException(status_code=404, detail="Track not found")
    return {"track": serialize_track(doc)}


@admin_router.get("")
async def list_admin_tracks(_: str = Depends(get_current_user)):
    await ensure_seed_tracks()
    db = get_db()
    docs = await db["interview_tracks"].find({}).sort("order", 1).to_list(None)
    return {"tracks": [serialize_track(doc) for doc in docs]}


@admin_router.post("")
async def create_track(body: TrackCreateRequest, _: str = Depends(get_current_user)):
    await ensure_seed_tracks()
    db = get_db()
    existing = await db["interview_tracks"].find_one({"slug": body.slug})
    if existing:
        raise HTTPException(status_code=400, detail="Track slug already exists")

    order = await db["interview_tracks"].count_documents({})
    doc = {
        "slug": body.slug,
        "title": body.title,
        "subtitle": body.subtitle,
        "accent": body.accent,
        "order": order + 1,
        "categories": [],
        "tags": [],
        "questions": [],
        "created_at": now_utc(),
        "updated_at": now_utc(),
    }
    await db["interview_tracks"].insert_one(doc)
    return {"track": serialize_track(doc)}


@admin_router.post("/{slug}/categories")
async def add_category(slug: str, body: MetadataRequest, _: str = Depends(get_current_user)):
    await ensure_seed_tracks()
    db = get_db()
    value = body.value.strip()
    if not value:
        raise HTTPException(status_code=400, detail="Category is required")
    await db["interview_tracks"].update_one(
        {"slug": slug},
        {"$addToSet": {"categories": value}, "$set": {"updated_at": now_utc()}},
    )
    doc = await db["interview_tracks"].find_one({"slug": slug})
    if not doc:
        raise HTTPException(status_code=404, detail="Track not found")
    return {"track": serialize_track(doc)}


@admin_router.post("/{slug}/tags")
async def add_tag(slug: str, body: MetadataRequest, _: str = Depends(get_current_user)):
    await ensure_seed_tracks()
    db = get_db()
    value = body.value.strip()
    if not value:
        raise HTTPException(status_code=400, detail="Tag is required")
    await db["interview_tracks"].update_one(
        {"slug": slug},
        {"$addToSet": {"tags": value}, "$set": {"updated_at": now_utc()}},
    )
    doc = await db["interview_tracks"].find_one({"slug": slug})
    if not doc:
        raise HTTPException(status_code=404, detail="Track not found")
    return {"track": serialize_track(doc)}


@admin_router.post("/{slug}/questions")
async def add_question(slug: str, body: QuestionCreateRequest, _: str = Depends(get_current_user)):
    await ensure_seed_tracks()
    db = get_db()
    doc = await db["interview_tracks"].find_one({"slug": slug})
    if not doc:
        raise HTTPException(status_code=404, detail="Track not found")

    questions = sorted(doc.get("questions", []), key=lambda item: item.get("number", 0))
    next_number = (questions[-1]["number"] if questions else 0) + 1
    tags = [tag.strip() for tag in body.tags if tag.strip()]
    question_doc = {
        "number": next_number,
        "title": body.title.strip(),
        "difficulty": body.difficulty.strip(),
        "category": body.category.strip(),
        "tags": tags,
        "answer_html": body.answer_html,
    }

    await db["interview_tracks"].update_one(
        {"slug": slug},
        {
            "$push": {"questions": question_doc},
            "$addToSet": {"categories": body.category.strip(), "tags": {"$each": tags}},
            "$set": {"updated_at": now_utc()},
        },
    )

    updated = await db["interview_tracks"].find_one({"slug": slug})
    if not updated:
        raise HTTPException(status_code=404, detail="Track not found")
    return {"track": serialize_track(updated)}


@admin_router.put("/{slug}/questions/{question_number}")
async def update_question(slug: str, question_number: int, body: QuestionUpdateRequest, _: str = Depends(get_current_user)):
    await ensure_seed_tracks()
    db = get_db()
    doc = await db["interview_tracks"].find_one({"slug": slug})
    if not doc:
        raise HTTPException(status_code=404, detail="Track not found")

    tags = [tag.strip() for tag in body.tags if tag.strip()]
    updated_questions = []
    found = False
    for question in doc.get("questions", []):
        if question.get("number") == question_number:
            updated_questions.append({
                "number": question_number,
                "title": body.title.strip(),
                "difficulty": body.difficulty.strip(),
                "category": body.category.strip(),
                "tags": tags,
                "answer_html": body.answer_html,
            })
            found = True
        else:
            updated_questions.append(question)

    if not found:
        raise HTTPException(status_code=404, detail="Question not found")

    categories = sorted({*(doc.get("categories", [])), body.category.strip()})
    all_tags = sorted({*doc.get("tags", []), *tags})

    await db["interview_tracks"].update_one(
        {"slug": slug},
        {
            "$set": {
                "questions": updated_questions,
                "categories": categories,
                "tags": all_tags,
                "updated_at": now_utc(),
            }
        },
    )

    updated = await db["interview_tracks"].find_one({"slug": slug})
    return {"track": serialize_track(updated)}


@admin_router.delete("/{slug}/questions/{question_number}")
async def delete_question(slug: str, question_number: int, _: str = Depends(get_current_user)):
    await ensure_seed_tracks()
    db = get_db()
    doc = await db["interview_tracks"].find_one({"slug": slug})
    if not doc:
        raise HTTPException(status_code=404, detail="Track not found")

    remaining = [question for question in doc.get("questions", []) if question.get("number") != question_number]
    if len(remaining) == len(doc.get("questions", [])):
        raise HTTPException(status_code=404, detail="Question not found")

    renumbered = []
    for index, question in enumerate(sorted(remaining, key=lambda item: item.get("number", 999)), start=1):
        renumbered.append({**question, "number": index})

    await db["interview_tracks"].update_one(
        {"slug": slug},
        {"$set": {"questions": renumbered, "updated_at": now_utc()}},
    )

    updated = await db["interview_tracks"].find_one({"slug": slug})
    return {"track": serialize_track(updated)}
