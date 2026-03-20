from schema import ResearchState
from utils.llm_provider import call_llm

async def analyzer_node(state: ResearchState):
    emit = state.get("_emit")
    print("-" * 30)
    print(f"ANALYZER AGENT: Extracting methodology using {state['model_name']}...")
    if emit: await emit("analyzer", f"Extracting methodology using {state['model_name']}...", "running")

    try:
        queries = [
            "methodology technical architecture model design approach",
            "algorithm implementation training procedure steps",
            "dataset evaluation metrics experimental setup benchmark",
            "mathematical formulation equations loss function objective",
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
        if emit: await emit("analyzer", f"Retrieved {len(chunks)} relevant chunks from vector store", "running")
        print(f"  Analyzer: using {len(chunks)} vector chunks (~{len(context)} chars)")

        prompt = f"""
You are a senior ML/AI researcher performing a deep technical analysis.
Based on the research paper context below, produce a structured technical breakdown:

1. **Problem Formulation** — What exact problem is being solved?
2. **Proposed Architecture / Methodology** — Describe the model/algorithm in technical detail.
3. **Training & Optimization** — Loss functions, optimizers, hyperparameters.
4. **Datasets & Evaluation** — Benchmarks, metrics, scores achieved.
5. **Key Technical Innovations** — What makes this approach novel?

Be precise. Use bullet points. Cite numbers where available.

CONTEXT:
{context}
"""
        if emit: await emit("analyzer", "Calling LLM for technical analysis...", "running")
        content = await call_llm(state, prompt)
        if emit: await emit("analyzer", "Technical analysis complete ✓", "done")

    except Exception as e:
        print(f"Analyzer Error: {e}")
        if emit: await emit("analyzer", f"Error: {str(e)}", "error")
        content = "Analysis failed due to an internal error."

    return { "analysis": content, "analyzer_done": True, "current_agent": "analyzer" }