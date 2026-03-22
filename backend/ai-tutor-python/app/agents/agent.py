"""
app/agents/agent.py
───────────────────
Central LangGraph Orchestrator for the AI Tutor backend.

Architecture
────────────
                      ┌─────────────┐
                      │  __start__  │
                      └──────┬──────┘
                             │
                      ┌──────▼──────┐
                      │   router    │  ← reads state["task"], picks a branch
                      └──────┬──────┘
           ┌─────────────────┼─────────────────┐
           │                 │                 │
    ┌──────▼──────┐  ┌───────▼──────┐  ┌──────▼──────────┐
    │generate_    │  │ generate_    │  │     chat        │
    │curriculum   │  │ chapter      │  │                 │
    └──────┬──────┘  └───────┬──────┘  └──────┬──────────┘
           │                 │                 │
           └─────────────────▼─────────────────┘
                      ┌──────┴──────┐
                      │   __end__   │
                      └─────────────┘

Tasks
─────
  "generate_curriculum"  →  generate_curriculum node
  "refine_curriculum"    →  refine_curriculum node
  "generate_chapter"     →  generate_chapter node
  "chat"                 →  chat node
  "summarize_chapter"    →  summarize_chapter node
  "generate_mindmap"     →  generate_mindmap node
  "generate_vocab"       →  generate_vocab node
  "generate_mcq"         →  generate_mcq node

State
─────
  task              : one of the 4 task strings above
  ── curriculum inputs ──
  topic             : str
  vibe              : str
  custom_vibe       : str
  chapter_count     : int
  existing_curriculum: list[str]
  suggestion        : str
  ── chapter inputs ──
  chapter_title     : str
  ── chat inputs ──
  chapter_content   : str
  recent_history    : list[dict]  [{"role": ..., "content": ...}]
  messages          : list of LangChain BaseMessage (accumulated)
  ── outputs ──
  curriculum_result : list[str]
  chapter_result    : str
  chat_result       : str
  summary_result    : list[str]
  mindmap_result    : str
  vocab_result      : list[dict]
  mcq_result        : dict       # Only 1 MCQ returned per run
  error             : str | None
"""

import operator
import logging
from typing import TypedDict, Annotated, Sequence, Optional

from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage, AIMessage
from langgraph.graph import StateGraph, END

# ── import sub-agents ─────────────────────────────────────────────────────────
from .curriculum_agent import generate_curriculum_agent, refine_curriculum_agent
from .chapter_agent import generate_chapter_content
from .chat_agent import run_chat_agent
from .summary_agent import summarize_chapter_content
from .mindmap_agent import generate_mindmap_content
from .vocab_agent import extract_vocab
from .mcq_agent import generate_single_mcq

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# 1.  Shared State
# ─────────────────────────────────────────────────────────────────────────────

class TutorAgentState(TypedDict, total=False):
    # ── routing ──────────────────────────────────────────────────────────────
    task: str                          # Required – which node to run

    # ── curriculum inputs ────────────────────────────────────────────────────
    topic: str
    vibe: str
    custom_vibe: str
    chapter_count: int
    existing_curriculum: list[str]
    suggestion: str

    # ── chapter inputs ───────────────────────────────────────────────────────
    chapter_title: str

    # ── chat inputs ──────────────────────────────────────────────────────────
    chapter_content: str
    recent_history: list[dict]
    messages: Annotated[Sequence[BaseMessage], operator.add]

    # ── mcq inputs ───────────────────────────────────────────────────────────
    existing_mcqs: list[str]       # Texts of existing questions to avoid

    # ── outputs ──────────────────────────────────────────────────────────────
    curriculum_result: list[str]
    chapter_result: str
    chat_result: str
    summary_result: list[str]
    mindmap_result: str
    vocab_result: list[dict]
    mcq_result: dict
    error: Optional[str]


# ─────────────────────────────────────────────────────────────────────────────
# 2.  Node definitions
# ─────────────────────────────────────────────────────────────────────────────

async def router_node(state: TutorAgentState) -> TutorAgentState:
    """
    Pure routing node — does no LLM work, just validates task + logs the
    incoming request so every graph run has an audit trail.
    """
    task = state.get("task", "unknown")
    logger.info("[TutorAgent] Routing task: %s", task)

    valid_tasks = {"generate_curriculum", "refine_curriculum", "generate_chapter", "chat", "summarize_chapter", "generate_mindmap", "generate_vocab", "generate_mcq"}
    if task not in valid_tasks:
        logger.error("[TutorAgent] Unknown task '%s'", task)
        return {**state, "error": f"Unknown task: '{task}'"}

    return {**state, "error": None}


async def generate_curriculum_node(state: TutorAgentState) -> TutorAgentState:
    """Calls the Curriculum Agent to create a brand-new curriculum."""
    logger.info("[TutorAgent] Node: generate_curriculum | topic=%s", state.get("topic"))
    try:
        result = await generate_curriculum_agent(
            topic=state.get("topic", ""),
            vibe=state.get("vibe", "Standard"),
            custom_vibe=state.get("custom_vibe", ""),
            chapter_count=state.get("chapter_count", 5),
        )
        return {**state, "curriculum_result": result}
    except Exception as exc:
        logger.exception("[TutorAgent] generate_curriculum failed")
        return {**state, "error": str(exc), "curriculum_result": []}


async def refine_curriculum_node(state: TutorAgentState) -> TutorAgentState:
    """Calls the Curriculum Agent to refine an existing curriculum."""
    logger.info("[TutorAgent] Node: refine_curriculum | topic=%s", state.get("topic"))
    try:
        result = await refine_curriculum_agent(
            topic=state.get("topic", ""),
            vibe=state.get("vibe", "Standard"),
            existing_curriculum=state.get("existing_curriculum", []),
            suggestion=state.get("suggestion", ""),
            chapter_count=state.get("chapter_count", 5),
        )
        return {**state, "curriculum_result": result}
    except Exception as exc:
        logger.exception("[TutorAgent] refine_curriculum failed")
        return {**state, "error": str(exc), "curriculum_result": []}


async def generate_chapter_node(state: TutorAgentState) -> TutorAgentState:
    """Calls the Chapter Agent to produce HTML lesson content."""
    logger.info("[TutorAgent] Node: generate_chapter | chapter=%s", state.get("chapter_title"))
    try:
        content = await generate_chapter_content(
            chapter_title=state.get("chapter_title", ""),
            topic=state.get("topic", ""),
            vibe=state.get("vibe", "Standard"),
        )
        return {**state, "chapter_result": content}
    except Exception as exc:
        logger.exception("[TutorAgent] generate_chapter failed")
        return {**state, "error": str(exc), "chapter_result": ""}


async def chat_node(state: TutorAgentState) -> TutorAgentState:
    """
    Calls the Chat Agent.
    Reconstructs the final human turn from the messages list (last HumanMessage)
    so the service layer doesn't need to know about LangChain internals.
    """
    logger.info("[TutorAgent] Node: chat | chapter=%s", state.get("chapter_title"))
    try:
        # The service pushes history + current message into recent_history,
        # and the current message as the last item separately.
        recent_history: list[dict] = state.get("recent_history", [])
        # Last entry in recent_history IS the current user message (already appended
        # by the service before calling the graph). Extract it.
        current_message = ""
        history_for_llm = recent_history
        if recent_history and recent_history[-1].get("role") == "user":
            current_message = recent_history[-1]["content"]
            history_for_llm = recent_history[:-1]   # history without current

        reply = await run_chat_agent(
            recent_history=history_for_llm,
            current_message=current_message,
            chapter_title=state.get("chapter_title", ""),
            content_preview=state.get("chapter_content", ""),
        )
        return {**state, "chat_result": reply}
    except Exception as exc:
        logger.exception("[TutorAgent] chat failed")
        return {**state, "error": str(exc), "chat_result": ""}


async def summarize_chapter_node(state: TutorAgentState) -> TutorAgentState:
    """Calls the Summary Agent to bullet-summarise a chapter."""
    logger.info("[TutorAgent] Node: summarize_chapter | chapter=%s", state.get("chapter_title"))
    try:
        bullets = await summarize_chapter_content(
            chapter_title=state.get("chapter_title", ""),
            content=state.get("chapter_content", ""),
        )
        return {**state, "summary_result": bullets}
    except Exception as exc:
        logger.exception("[TutorAgent] summarize_chapter failed")
        return {**state, "error": str(exc), "summary_result": []}


async def generate_mindmap_node(state: TutorAgentState) -> TutorAgentState:
    """Calls the Mindmap Agent to generate an ASCII tree representation."""
    logger.info("[TutorAgent] Node: generate_mindmap | chapter=%s", state.get("chapter_title"))
    try:
        tree_text = await generate_mindmap_content(
            chapter_title=state.get("chapter_title", ""),
            content=state.get("chapter_content", ""),
        )
        return {**state, "mindmap_result": tree_text}
    except Exception as exc:
        logger.exception("[TutorAgent] generate_mindmap failed")
        return {**state, "error": str(exc), "mindmap_result": ""}


async def generate_vocab_node(state: TutorAgentState) -> TutorAgentState:
    """Calls the Vocab Agent to extract unknown keywords."""
    logger.info("[TutorAgent] Node: generate_vocab | chapter=%s", state.get("chapter_title"))
    try:
        vocab_list = await extract_vocab(
            chapter_title=state.get("chapter_title", ""),
            content=state.get("chapter_content", ""),
        )
        return {**state, "vocab_result": vocab_list}
    except Exception as exc:
        logger.exception("[TutorAgent] generate_vocab failed")
        return {**state, "error": str(exc), "vocab_result": []}


async def generate_mcq_node(state: TutorAgentState) -> TutorAgentState:
    """Calls the MCQ Agent to append 1 question to the chapter assessment."""
    logger.info("[TutorAgent] Node: generate_mcq | chapter=%s", state.get("chapter_title"))
    try:
        mcq_obj = await generate_single_mcq(
            chapter_title=state.get("chapter_title", ""),
            content=state.get("chapter_content", ""),
            existing_questions=state.get("existing_mcqs", []),
        )
        return {**state, "mcq_result": mcq_obj}
    except Exception as exc:
        logger.exception("[TutorAgent] generate_mcq failed")
        return {**state, "error": str(exc), "mcq_result": {}}


# ─────────────────────────────────────────────────────────────────────────────
# 3.  Conditional edge — router decides which node runs next
# ─────────────────────────────────────────────────────────────────────────────

def route_by_task(state: TutorAgentState) -> str:
    """Return the name of the node that should run after the router."""
    if state.get("error"):
        return END                          # bail out early on bad task
    task = state.get("task", "")
    mapping = {
        "generate_curriculum": "generate_curriculum",
        "refine_curriculum":   "refine_curriculum",
        "generate_chapter":    "generate_chapter",
        "chat":                "chat",
        "summarize_chapter":   "summarize_chapter",
        "generate_mindmap":    "generate_mindmap",
        "generate_vocab":      "generate_vocab",
        "generate_mcq":        "generate_mcq",
    }
    return mapping.get(task, END)


# ─────────────────────────────────────────────────────────────────────────────
# 4.  Build & compile the graph
# ─────────────────────────────────────────────────────────────────────────────

def build_tutor_graph() -> StateGraph:
    graph = StateGraph(TutorAgentState)

    # ── nodes ─────────────────────────────────────────────────────────────────
    graph.add_node("router",              router_node)
    graph.add_node("generate_curriculum", generate_curriculum_node)
    graph.add_node("refine_curriculum",   refine_curriculum_node)
    graph.add_node("generate_chapter",    generate_chapter_node)
    graph.add_node("chat",                chat_node)
    graph.add_node("summarize_chapter",   summarize_chapter_node)
    graph.add_node("generate_mindmap",    generate_mindmap_node)
    graph.add_node("generate_vocab",      generate_vocab_node)
    graph.add_node("generate_mcq",        generate_mcq_node)

    # ── entry ─────────────────────────────────────────────────────────────────
    graph.set_entry_point("router")

    # ── conditional branch from router → sub-agent nodes ─────────────────────
    graph.add_conditional_edges(
        "router",
        route_by_task,
        {
            "generate_curriculum": "generate_curriculum",
            "refine_curriculum":   "refine_curriculum",
            "generate_chapter":    "generate_chapter",
            "chat":                "chat",
            "summarize_chapter":   "summarize_chapter",
            "generate_mindmap":    "generate_mindmap",
            "generate_vocab":      "generate_vocab",
            "generate_mcq":        "generate_mcq",
            END:                   END,
        },
    )

    # ── terminal edges (all sub-agent nodes → END) ────────────────────────────
    graph.add_edge("generate_curriculum", END)
    graph.add_edge("refine_curriculum",   END)
    graph.add_edge("generate_chapter",    END)
    graph.add_edge("chat",                END)
    graph.add_edge("summarize_chapter",   END)
    graph.add_edge("generate_mindmap",    END)
    graph.add_edge("generate_vocab",      END)
    graph.add_edge("generate_mcq",        END)

    return graph


# Compile once at import time – thread/coroutine safe.
tutor_graph = build_tutor_graph().compile()


# ─────────────────────────────────────────────────────────────────────────────
# 5.  Public invoke helper used by all services
# ─────────────────────────────────────────────────────────────────────────────

async def invoke_tutor_agent(state: dict) -> TutorAgentState:
    """
    Single entry-point for all services.

    Usage example (from curriculum_service.py):
        result = await invoke_tutor_agent({
            "task": "generate_curriculum",
            "topic": "React Hooks",
            "vibe": "Thinker",
            "custom_vibe": "",
            "chapter_count": 5,
        })
        curriculum = result["curriculum_result"]
    """
    logger.info("[TutorAgent] invoke_tutor_agent with task=%s", state.get("task"))
    final_state: TutorAgentState = await tutor_graph.ainvoke(state)
    if final_state.get("error"):
        logger.error("[TutorAgent] Graph finished with error: %s", final_state["error"])
    return final_state
