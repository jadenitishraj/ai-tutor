"""
app/agents/mindmap_agent.py
───────────────────────────
Plain LLM function to generate an ASCII tree/mind map from chapter content.
Called by the `generate_mindmap` node inside app/agents/agent.py.
"""

from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage


async def generate_mindmap_content(chapter_title: str, content: str) -> str:
    """
    Generates a hierarchical ASCII tree representing the chapter's conceptual data flow.
    Returns the string representing the map.
    """
    model = ChatOpenAI(model="gpt-4o-mini", temperature=0.3)

    prompt = (
        f'You are an expert AI Tutor and systems architect. Analyze the following chapter.\n'
        f'Chapter Title: "{chapter_title}"\n\n'
        f'Chapter Content (HTML):\n{content}\n\n'
        'Create a conceptual Mind Map or Concept Tree summarizing the logical flow or components covered in this chapter.\n'
        'Return ONLY valid ASCII tree text format containing the map, no markdown blocks, no extra leading/trailing text.\n\n'
        'Example format:\n'
        'CONCEPT TREE — [MAIN TOPIC]\n'
        '│\n'
        '├── 1. [Category 1]\n'
        '│ ├── [Subtopic 1A]\n'
        '│ └── [Subtopic 1B]\n'
        '│\n'
        '├── 2. [Category 2]\n'
        '│ ├── [Subtopic 2A]\n'
        '│ └── [Subtopic 2B]\n'
    )

    response = await model.ainvoke([
        SystemMessage(content="You are a helpful text generator that ONLY outputs ASCII trees without any backticks, code blocks, or explanations."),
        HumanMessage(content=prompt),
    ])

    text = response.content or ""
    # Extract from inside code blocks if the model outputs them
    import re
    code_block_match = re.search(r"```[\w]*\n(.*?)```", text, re.DOTALL)
    if code_block_match:
        text = code_block_match.group(1)
    
    return text.strip()
