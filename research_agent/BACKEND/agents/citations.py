import re
from schema import ResearchState
from utils.llm_provider import call_llm # Universal provider import kiya

async def citations_node(state: ResearchState):
    print("-" * 30)
    print(f"CITATIONS AGENT: Extracting references using {state['model_name']}...")
    
    # Assignment Requirement: Identifying and organizing all citations [cite: 35]
    query = "List all major citations, references, and key papers mentioned."
    
    try:
        # Context retrieval using Vector Store [cite: 59]
        docs = state["vector_store"].similarity_search(query, k=5)
        context = "\n".join([doc.page_content for doc in docs])

        # Prompt engineering for specific extraction [cite: 55]
        prompt = f"Extract all academic citations and references from this context. List them clearly: {context}"
        
        # 🔥 Unified LLM call jo kisi bhi model ko handle kar legi
        content = await call_llm(state, prompt)
        
        # Content ko list mein convert karna (formatting preserved)
        citations_list = [line.strip("- *•") for line in content.split("\n") if line.strip()]
        
    except Exception as e:
        print(f"Citations Error: {e}")
        citations_list = ["Error: Could not extract citations."]

    # COMPLETE FILE RETURN [cite: 153]
    return {
        "citations": citations_list,
        "citations_done": True,
        "current_agent": "citations" # 👈 Reviewer gatekeeper ke liye zaroori [cite: 153]
    }