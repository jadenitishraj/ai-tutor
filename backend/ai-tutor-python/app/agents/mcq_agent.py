"""
app/agents/mcq_agent.py
───────────────────────
Plain LLM function to generate a single Multiple Choice Question.
Called by the `generate_mcq` node inside app/agents/agent.py.
"""

from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage


async def generate_single_mcq(chapter_title: str, content: str, existing_questions: list[str]) -> dict:
    """
    Generates a single, novel MCQ from the chapter content.
    Avoids repeating questions in `existing_questions`.
    Returns a dict: {"question": "...", "options": ["A", "B", "C", "D"], "answer": "...", "explanation": "..."}
    """
    model = ChatOpenAI(model="gpt-4o-mini", temperature=0.5)

    avoid_block = ""
    if existing_questions:
        avoid_str = "\n".join(f"- {q}" for q in existing_questions)
        avoid_block = f"\nDO NOT repeat or closely paraphrase any of these existing questions:\n{avoid_str}\n"

    prompt = (
        f'You are an expert Educational Assessor.\n'
        f'Create exactly ONE challenging multiple-choice question based on the following chapter.\n'
        f'Chapter Title: "{chapter_title}"\n'
        f'Chapter Content (HTML):\n{content}\n\n'
        f'{avoid_block}'
        'Requirements:\n'
        '- Exactly 4 options (plausible distractors).\n'
        '- The correct answer must match exactly one of the options.\n'
        '- Provide a short explanation of why the answer is correct.\n'
        '- Return ONLY a valid JSON object with keys: "question" (str), "options" (list of 4 str), "answer" (str), "explanation" (str).\n'
        '- Do not include any other text or markdown wrappers outside the JSON.\n'
    )

    response = await model.ainvoke([
        SystemMessage(content="You are a helpful JSON generator that ONLY outputs a single JSON object for an MCQ."),
        HumanMessage(content=prompt),
    ])

    text = response.content or "{}"
    
    # Safely extract and parse JSON object
    import json, re
    code_block_match = re.search(r"```[\w]*\n(.*?)```", text, re.DOTALL)
    if code_block_match:
        text = code_block_match.group(1)
        
    text = text.strip()
    
    try:
        data = json.loads(text)
        if "question" in data and "options" in data and "answer" in data:
            return data
    except Exception:
        pass
        
    return {}
