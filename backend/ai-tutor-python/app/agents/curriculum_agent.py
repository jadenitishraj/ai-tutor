"""
app/agents/curriculum_agent.py
───────────────────────────────
Plain LLM functions — no graph, no compile.
Called by `generate_curriculum` / `refine_curriculum` nodes in app/agents/agent.py.
"""

import json
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage
from ..utils.curriculum import extract_curriculum_from_text, sanitize_curriculum_for_save


async def generate_curriculum_agent(
    topic: str, vibe: str, custom_vibe: str, chapter_count: int
) -> list[str]:
    """
    Generates a brand-new curriculum.
    Returns a list of chapter title strings.
    """
    model = ChatOpenAI(model="gpt-4o-mini", temperature=0.7)

    active_vibe = custom_vibe if vibe == "Custom" else vibe

    prompt = (
        f'You are an expert tutor. Create a highly engaging course curriculum.\n'
        f'Course topic: "{topic}".\n'
        f'Tone/vibe: "{active_vibe}".\n\n'
        f'Create exactly {chapter_count} chapter titles that logically progress from beginner to advanced.\n'
        'Return ONLY a JSON array of strings, e.g. ["Chapter 1: Intro", "Chapter 2: Next"].\n'
        'Do not use placeholder names like "Key Concepts" or "Generic". Make them descriptive and exciting to read.'
    )

    response = await model.ainvoke([
        SystemMessage(content="You are a helpful JSON generator."),
        HumanMessage(content=prompt),
    ])
    text = response.content or ""

    curriculum = extract_curriculum_from_text(text, chapter_count)
    curriculum = sanitize_curriculum_for_save(curriculum, chapter_count, topic)
    return curriculum


async def refine_curriculum_agent(
    topic: str, vibe: str, existing_curriculum: list[str], suggestion: str, chapter_count: int
) -> list[str]:
    """
    Refines an existing curriculum based on a user suggestion.
    Returns an updated list of chapter title strings.
    """
    model = ChatOpenAI(model="gpt-4o-mini", temperature=0.7)

    prompt = (
        f'You are an expert tutor.\n'
        f'Course topic: "{topic}".\n'
        f'Tone: "{vibe}".\n'
        f'Existing curriculum: {json.dumps(existing_curriculum)}\n'
        f'User requested changes: "{suggestion}".\n\n'
        f'Create an updated curriculum with exactly {chapter_count} chapter titles.\n'
        'Return ONLY a JSON array of strings.\n'
        'Do not use placeholder names like "Key Concepts" or "Generic".'
    )

    response = await model.ainvoke([
        SystemMessage(content="You are a helpful JSON generator."),
        HumanMessage(content=prompt),
    ])
    text = response.content or ""

    curriculum = extract_curriculum_from_text(text, chapter_count)
    curriculum = sanitize_curriculum_for_save(curriculum, chapter_count, topic)
    return curriculum
