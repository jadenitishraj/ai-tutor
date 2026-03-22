"""
app/agents/question_answer_agent.py
───────────────────────────────────
Plain LLM function to generate likely reader questions and concise answers.
Called by the `generate_question_answer` node inside app/agents/agent.py.
"""

from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage


async def generate_question_answer_pairs(chapter_title: str, content: str) -> list[dict]:
    """
    Generates likely learner questions about the chapter and answers them.
    Returns a list of dicts: [{"question": "...", "answer": "..."}]
    """
    model = ChatOpenAI(model="gpt-4o-mini", temperature=0.3)

    prompt = (
        f'You are an expert AI Tutor.\n'
        f'Analyze the following chapter and generate helpful reader questions with answers.\n'
        f'Chapter Title: "{chapter_title}"\n\n'
        f'Chapter Content (HTML):\n{content}\n\n'
        'Instructions:\n'
        '- Generate 5 to 8 natural questions a student is likely to ask while reading this page.\n'
        '- Every answer must be grounded in the chapter content.\n'
        '- Keep answers concise, clear, and practical.\n'
        '- Return ONLY a valid JSON array of objects with "question" and "answer" keys.\n'
        '- Do not include markdown, labels, explanations, or extra text outside the JSON.\n\n'
        'Example output:\n'
        '[\n'
        '  {"question": "What is X?", "answer": "X is ..."},\n'
        '  {"question": "Why does Y matter?", "answer": "Y matters because ..."}\n'
        ']'
    )

    response = await model.ainvoke([
        SystemMessage(content="You are a helpful JSON generator that ONLY outputs a JSON array of question-answer pairs."),
        HumanMessage(content=prompt),
    ])

    text = response.content or "[]"

    import json
    import re

    code_block_match = re.search(r"```[\w]*\n(.*?)```", text, re.DOTALL)
    if code_block_match:
        text = code_block_match.group(1)

    text = text.strip()

    try:
        data = json.loads(text)
        if isinstance(data, list):
            return [
                {
                    "question": str(item.get("question", "")).strip(),
                    "answer": str(item.get("answer", "")).strip(),
                }
                for item in data
                if item.get("question") and item.get("answer")
            ]
    except Exception:
        pass

    return []
