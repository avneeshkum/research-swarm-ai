from schema import ResearchState
from utils.llm_provider import call_llm

async def insights_node(state: ResearchState):
    emit = state.get("_emit")
    print("-" * 30)
    print(f"INSIGHTS AGENT: Generating research insights using {state['model_name']}...")
    if emit: await emit("insights", f"Generating insights using {state['model_name']}...", "running")

    try:
        queries = [
            "limitations drawbacks weaknesses open problems",
            "future work directions extensions next steps",
            "practical applications real world use cases deployment",
            "unique contributions novelty innovation key findings",
        ]
        seen, chunks = set(), []
        for q in queries:
            docs = state["vector_store"].similarity_search(q, k=3)
            for d in docs:
                txt = d.page_content.strip()
                if txt not in seen:
                    seen.add(txt)
                    chunks.append(txt)
            if len(chunks) >= 12:
                break

        context = "\n\n---\n\n".join(chunks)
        if emit: await emit("insights", f"Retrieved {len(chunks)} chunks for insights", "running")
        print(f"  Insights: using {len(chunks)} vector chunks")

        prompt = f"""
You are an expert research analyst. Generate a structured insights report:

1. **Key Contributions & Novelty** — What is unique about this work?
2. **Limitations & Weaknesses** — Honest shortcomings admitted by the paper.
3. **Practical Applications** — Real-world use cases, industries, products.
4. **Future Directions** — Open problems and what to build next.

Be specific. Cite numbers/results where available.

CONTEXT:
{context}
"""
        if emit: await emit("insights", "Generating structured insights report...", "running")
        content = await call_llm(state, prompt)
        if emit: await emit("insights", "Insights report complete ✓", "done")

    except Exception as e:
        print(f"Insights Error: {e}")
        if emit: await emit("insights", f"Error: {str(e)}", "error")
        content = "Insights generation failed."

    return { "insights": content, "insights_done": True, "current_agent": "insights" }