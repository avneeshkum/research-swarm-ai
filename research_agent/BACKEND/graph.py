from langgraph.graph import StateGraph, END
from schema import ResearchState
from agents.boss import boss_init_node, boss_final_node
from agents.analyzer import analyzer_node
from agents.summarizer import summarizer_node
from agents.citations import citations_node
from agents.insights import insights_node
from agents.reviewer import reviewer_node

def reviewer_router(state: ResearchState):
    current = state.get("current_agent", "unknown")
    score = state["review_scores"].get(current, 0)
    retries = state["retry_counts"].get(current, 0)

    # Retry logic: Sirf tab jab score < 7 ho aur retries baki hon
    if score < 7 and retries < 2 and current != "boss_init":
        print(f"ROUTER: Retrying {current} (Score: {score}, Retry: {retries+1})")
        return f"retry_{current}"

    # Sequential mapping: Agla agent kaunsa hoga?
    mapping = {
        "analyzer": "summarizer",
        "summarizer": "citations",
        "citations": "insights",
        "insights": "boss_final"
    }
    
    return mapping.get(current, "boss_final")

workflow = StateGraph(ResearchState)

# Nodes setup
workflow.add_node("boss_init", boss_init_node)
workflow.add_node("analyzer", analyzer_node)
workflow.add_node("summarizer", summarizer_node)
workflow.add_node("citations", citations_node)
workflow.add_node("insights", insights_node)
workflow.add_node("reviewer", reviewer_node)
workflow.add_node("boss_final", boss_final_node)

# Sequential Edges (Flow logic)
workflow.set_entry_point("boss_init")
workflow.add_edge("boss_init", "analyzer")

# Har agent ke baad reviewer par jana hai
workflow.add_edge("analyzer", "reviewer")
workflow.add_edge("summarizer", "reviewer")
workflow.add_edge("citations", "reviewer")
workflow.add_edge("insights", "reviewer")

# Router logic: Score ke base par decision
workflow.add_conditional_edges(
    "reviewer",
    reviewer_router,
    {
        "retry_analyzer": "analyzer",
        "retry_summarizer": "summarizer",
        "retry_citations": "citations",
        "retry_insights": "insights",
        "summarizer": "summarizer",
        "citations": "citations",
        "insights": "insights",
        "boss_final": "boss_final"
    }
)

workflow.add_edge("boss_final", END)
app = workflow.compile()