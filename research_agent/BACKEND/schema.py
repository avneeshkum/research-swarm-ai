import operator
from typing import Annotated, TypedDict, List, Dict, Any, Optional
from pydantic import BaseModel, Field

# =========================
# 1. STRUCTURED OUTPUT MODELS (Pydantic)
# =========================
# Assignment Requirement: Use structured outputs for agent responses 

class ReviewResult(BaseModel):
    """Review Agent ka output schema [cite: 38]"""
    score: int = Field(description="Quality score between 1-10", ge=1, le=10)
    feedback: str = Field(description="Feedback or instructions for improvement")
    is_approved: bool = Field(description="True if score >= 7, else False [cite: 39]")

class AnalysisResult(BaseModel):
    """Paper Analyzer ka output [cite: 33, 120]"""
    problem_statement: str
    methodology: str
    key_findings: str

class SummaryResult(BaseModel):
    """Summarizer ka output (150-200 words) [cite: 34, 125]"""
    summary: str

# =========================
# 2. LANGGRAPH STATE SCHEMA
# =========================

class ResearchState(TypedDict):
    """
    Vilambo Assignment State Schema 
    Har field unki requirements se mapped hai.
    """
    
    # --- Input Data ---
    paper_text: str           # PDF se nikala hua raw text [cite: 59, 153]
    vector_store: Any         # RAG ke liye (Optional but recommended for context)
    client: Any               # LLM Client (Cohere/OpenAI) [cite: 54]
    model_name: str           # e.g., command-r, gpt-4o-mini [cite: 104]
    quality_threshold: int    # Default: 7 [cite: 39]

    # --- Agent Outputs  ---
    analysis: Optional[str]   # Methodology & Findings [cite: 33]
    summary: Optional[str]    # Executive Summary [cite: 34]
    citations: Optional[List[str]] # References list [cite: 35]
    insights: Optional[str]   # Bonus: Practical takeaways [cite: 36]
    
    # --- Metadata ---
    metadata: Dict[str, str]  # Title, Authors, Year [cite: 118]

    # --- Orchestration & Quality Control ---
    current_agent: str        # Track karne ke liye ki kaunsa agent chal raha hai [cite: 26]
    
    # Reviewer ke updates merge karne ke liye Annotated use kar rahe hain
    review_scores: Annotated[Dict[str, int], operator.ior]     # Scores (1-10) 
    review_feedback: Annotated[Dict[str, str], operator.ior]   # Improvement feedback [cite: 38]
    
    # Retry counter: Max 2 retries per agent allowed 
    retry_counts: Annotated[Dict[str, int], operator.ior]

    # --- Final Result ---
    final_brief: Optional[str] # All-in-one combined report [cite: 51, 153]