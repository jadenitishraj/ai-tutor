"""
app/agents/vocab_agent.py
─────────────────────────
Plain LLM function to extract advanced/unusual vocabulary from a chapter's content.
Called by the `generate_vocab` node inside app/agents/agent.py.
"""

from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage


async def extract_vocab(chapter_title: str, content: str) -> list[dict]:
    """
    Extracts unusual, advanced, or key domain vocabulary from the chapter content.
    Returns a list of dicts: [{"word": "...", "definition": "..."}]
    """
    model = ChatOpenAI(model="gpt-4o-mini", temperature=0.2)

    prompt = (
        f'You are an expert AI English Tutor and Lexicographer.\n'
        f'Analyze the following chapter to extract advanced, unusual, or domain-specific vocabulary words.\n'
        f'Chapter Title: "{chapter_title}"\n\n'
        f'Chapter Content (HTML):\n{content}\n\n'
        'Instructions:\n'
        '- Identify 5 to 10 advanced or unfamiliar words actually used in the text.\n'
        '- Provide a clear, concise definition for each word exactly as it is used in the context of the chapter.\n'
        '- Return ONLY a valid JSON array of objects with "word" and "definition" keys.\n'
        '- Do not include any other text, explanations, or markdown blocks outside the JSON.\n\n'
        'Example output:\n'
        '[\n'
        '  {"word": "Ephemeral", "definition": "Lasting for a very short time."},\n'
        '  {"word": "Ubiquitous", "definition": "Present, appearing, or found everywhere."}\n'
        ']'
    )

    response = await model.ainvoke([
        SystemMessage(content="You are a helpful JSON generator that ONLY outputs a JSON array containing vocabulary words."),
        HumanMessage(content=prompt),
    ])

    text = response.content or "[]"
    
    # Safely extract and parse JSON array
    import json, re
    code_block_match = re.search(r"```[\w]*\n(.*?)```", text, re.DOTALL)
    if code_block_match:
        text = code_block_match.group(1)
        
    text = text.strip()
    
    try:
        data = json.loads(text)
        if isinstance(data, list):
            # Ensure it only has the keys we want
            return [{"word": str(i.get("word", "")), "definition": str(i.get("definition", ""))} for i in data if i.get("word")]
    except Exception:
        pass
        
    return []
