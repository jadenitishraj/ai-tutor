"""
app/agents/chapter_agent.py
────────────────────────────
Plain LLM function — no graph, no compile.
Called by the `generate_chapter` node inside app/agents/agent.py.
"""

from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage


async def generate_chapter_content(chapter_title: str, topic: str, vibe: str) -> str:
    """
    Generates HTML lesson content for a single chapter.
    Returns the content as a plain string.
    """
    model = ChatOpenAI(model="gpt-4o-mini", temperature=0.7)

    prompt = (
        f'Write a comprehensive lesson for the chapter: "{chapter_title}"\n'
        f'Course Topic: "{topic}"\n'
        f'Tone: "{vibe}"\n\n'
        "Format the output as clean HTML (without <html> or <body> tags). "
        "Use <h3> for headings, <p> for paragraphs, <ul>/<li> for lists, "
        "and <pre><code> for any code examples. Make it engaging and educational."
    )

    response = await model.ainvoke([
        SystemMessage(content="You are an expert tutor."),
        HumanMessage(content=prompt),
    ])
    return response.content or ""
