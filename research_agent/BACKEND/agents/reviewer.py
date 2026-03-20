from schema import ResearchState
from utils.llm_provider import call_llm

async def reviewer_node(state: ResearchState):
    current = state["current_agent"]
    emit    = state.get("_emit")
    threshold = state.get("quality_threshold", 7)

    print("-" * 30)
    print(f"REVIEWER AGENT: Checking {current.upper()}...")
    if emit: await emit("reviewer", f"Reviewing {current} output...", "running")

    content_map = {
        "analyzer":   state.get("analysis", ""),
        "summarizer": state.get("summary", ""),
        "citations":  str(state.get("citations", [])),
        "insights":   state.get("insights", ""),
    }
    content = content_map.get(current, "")
    content_preview = content[:3000] + ("..." if len(content) > 3000 else "")

    prompt = f"""
You are a Senior Peer Reviewer. Rate the following research {current} output from 1 to 10.

Scoring Criteria:
- Accuracy & Factual Correctness (0-3)
- Technical Depth & Detail (0-4)
- Completeness & Coverage (0-3)

Return ONLY a single integer between 1 and 10. No explanation, no text.

CONTENT:
{content_preview}
"""

    try:
        score_text = await call_llm(state, prompt)
        digits = "".join(filter(str.isdigit, score_text))
        score  = min(int(digits), 10) if digits else 1
    except Exception as e:
        print(f"Reviewer Error: {e}")
        if emit: await emit("reviewer", f"Reviewer error: {str(e)}", "error")
        score = 1

    state["review_scores"][current] = score

    if score < threshold:
        retries = state["retry_counts"].get(current, 0)
        state["retry_counts"][current] = retries + 1
        msg = f"{current.capitalize()} scored {score}/10 — below threshold, retrying ({state['retry_counts'][current]}/2)"
        print(f"REVIEWER SCORE for {current}: {score}/10")
        print(f"REVIEWER FEEDBACK: Quality below threshold ({score}<{threshold}). Attempt: {state['retry_counts'][current]}/2")
        if emit: await emit("reviewer", msg, "error")
    else:
        msg = f"{current.capitalize()} passed quality check — {score}/10 ✓"
        print(f"REVIEWER SCORE for {current}: {score}/10")
        print(f"REVIEWER FEEDBACK: Quality is good. Moving to next step.")
        if emit: await emit("reviewer", msg, "done")

    print("-" * 30)
    return state