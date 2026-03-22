"""
app/agents/chat_agent.py
────────────────────────
Plain LLM function — no graph, no compile.
Called by the `chat` node inside app/agents/agent.py.
"""

from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, convert_to_messages

CONTENT_PREVIEW = 3000


async def run_chat_agent(
    recent_history: list[dict],
    current_message: str,
    chapter_title: str,
    content_preview: str,
) -> str:
    """
    Calls the LLM with system context + rolling history + current message.
    Returns the assistant reply as a plain string.
    """
    model = ChatOpenAI(model="gpt-4o-mini", temperature=0.7)

    system_prompt = (
        "You are a helpful AI Tutor. The user is asking a question about the following lesson content:\n\n"
        "---\n"
        f"TITLE: {chapter_title}\n"
        f"CONTENT:\n{content_preview[:CONTENT_PREVIEW]} ... (truncated if long)\n"
        "---\n\n"
        "Answer the user's question based on the content provided or your general knowledge "
        "if the content is insufficient. Keep answers concise and helpful."
    )

    # convert_to_messages handles {"role": ..., "content": ...} dicts natively
    history_msgs = convert_to_messages(recent_history)

    messages = [
        SystemMessage(content=system_prompt),
        *history_msgs,
        # current user turn appended last
        *convert_to_messages([{"role": "user", "content": current_message}]),
    ]

    response = await model.ainvoke(messages)
    return response.content or ""
