"""
app/agents/summary_agent.py
────────────────────────────
Plain LLM function — no graph, no compile.
Called by the `summarize_chapter` node inside app/agents/agent.py.
"""

from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage


async def summarize_chapter_content(chapter_title: str, content: str) -> list[str]:
    """
    Generates a concise bullet-point summary of a chapter's HTML content.
    Returns a list of bullet strings (without leading dashes/bullets).
    """
    model = ChatOpenAI(model="gpt-4o-mini", temperature=0.3)

    prompt = (
        f'You are an expert AI Tutor summarising a lesson chapter.\n'
        f'Chapter Title: "{chapter_title}"\n\n'
        f'Chapter Content (HTML):\n{content}\n\n'
        'Create a concise bullet-point summary of the key takeaways from this chapter.\n'
        'Rules:\n'
        '- Return ONLY a JSON array of strings, one string per bullet point.\n'
        '- Each bullet should be a single clear sentence (max 20 words).\n'
        '- Aim for 5 to 8 bullets.\n'
        '- Do NOT include any markdown, dashes, or bullet symbols inside the strings.\n'
        'Example output: ["Key concept A explained here.", "Important detail B matters because..."]'
    )

    response = await model.ainvoke([
        SystemMessage(content="You are a helpful JSON generator that creates concise summaries."),
        HumanMessage(content=prompt),
    ])

    import json, re
    text = response.content or "[]"
    # Strip markdown code fences if present
    text = re.sub(r"```json|```", "", text).strip()
    try:
        bullets = json.loads(text)
        if isinstance(bullets, list):
            return [str(b).strip() for b in bullets if str(b).strip()]
    except Exception:
        pass
    # Fallback: split by newlines
    return [line.strip("- •\t") for line in text.splitlines() if line.strip()]
