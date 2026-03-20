from schema import ResearchState
from utils.llm_provider import call_llm

async def summarizer_node(state: ResearchState):
    emit = state.get("_emit")
    print("-" * 30)
    print(f"SUMMARIZER AGENT: Smart Extraction using {state['model_name']}...")
    if emit: await emit("summarizer", f"Smart extraction using {state['model_name']}...", "running")

    full_text = state["paper_text"]
    LIMIT = 10000

    if len(full_text) <= LIMIT:
        context = full_text
        if emit: await emit("summarizer", "Small paper — using full text", "running")
    elif state.get("vector_store"):
        queries = [
            "problem statement motivation research gap",
            "methodology approach proposed solution architecture",
            "results experiments evaluation metrics performance",
            "conclusion future work contributions",
        ]
        seen, chunks = set(), []
        for q in queries:
            docs = state["vector_store"].similarity_search(q, k=3)
            for d in docs:
                txt = d.page_content.strip()
                if txt not in seen:
                    seen.add(txt)
                    chunks.append(txt)
            if len(chunks) >= 14:
                break
        context = "\n\n---\n\n".join(chunks)
        if emit: await emit("summarizer", f"Retrieved {len(chunks)} chunks for summary context", "running")
        print(f"  Summarizer: using {len(chunks)} vector chunks")
    else:
        head, tail = full_text[:6000], full_text[-4000:]
        context = f"{head}\n\n[... truncated ...]\n\n{tail}"
        if emit: await emit("summarizer", "Using head+tail extraction strategy", "running")

    prompt = f"""
You are a senior research analyst. Create a professional executive summary (150-200 words).
The summary MUST cover:
1. Problem Statement
2. Approach / Methodology (mention key innovations like parallelization, attention, etc.)
3. Key Results (with specific numbers)
4. Conclusion / Impact

Be precise. Flowing academic prose. No bullet points. Strictly 150-200 words.

CONTEXT:
{context}
"""

    try:
        if emit: await emit("summarizer", "Generating executive summary (150-200 words)...", "running")
        content = await call_llm(state, prompt)
        if emit: await emit("summarizer", "Executive summary complete ✓", "done")
    except Exception as e:
        print(f"Summarizer Error: {e}")
        if emit: await emit("summarizer", f"Error: {str(e)}", "error")
        content = "Summary generation failed."

    return { "summary": content, "summarizer_done": True, "current_agent": "summarizer" }