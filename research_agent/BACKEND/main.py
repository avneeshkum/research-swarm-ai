import os
import time
import asyncio
import logging
import re
from fastapi import FastAPI, HTTPException, UploadFile, File, Form, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from typing import Optional

from sarvamai import AsyncSarvamAI
from groq import AsyncGroq

print("--- 🛠️  LOADING SYSTEM LIBRARIES ---", flush=True)
from schema import ResearchState
from graph import app as workflow_app
from utils.vector_store import create_vector_store
from utils.pdf_parser import extract_text_from_pdf
from utils.url_fetcher import fetch_url_text

load_dotenv()
SARVAM_API_KEY = os.getenv("SARVAM_API_KEY")
GROQ_API_KEY   = os.getenv("GROQ_API_KEY")
PROVIDER       = os.getenv("PROVIDER", "sarvam").lower()

if PROVIDER == "groq":
    MODEL_NAME    = os.getenv("GROQ_MODEL", "openai/gpt-oss-20b")
    active_client = AsyncGroq(api_key=GROQ_API_KEY)
    print(f"--- ⚡ PROVIDER: GROQ    | MODEL: {MODEL_NAME} ---", flush=True)
elif PROVIDER == "openai":
    from openai import AsyncOpenAI
    MODEL_NAME    = os.getenv("OPENAI_MODEL", "gpt-4o")
    active_client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    print(f"--- 🤖 PROVIDER: OPENAI  | MODEL: {MODEL_NAME} ---", flush=True)
elif PROVIDER == "gemini":
    import google.generativeai as genai
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
    genai.configure(api_key=GEMINI_API_KEY)
    MODEL_NAME    = os.getenv("GEMINI_MODEL", "gemini-3.0-flash")
    active_client = genai.GenerativeModel(MODEL_NAME)
    print(f"--- 💎 PROVIDER: GEMINI  | MODEL: {MODEL_NAME} ---", flush=True)
elif PROVIDER == "cohere":
    import cohere
    MODEL_NAME    = os.getenv("COHERE_MODEL", "command-a-03-2025")
    active_client = cohere.Client(api_key=os.getenv("COHERE_API_KEY"))
    print(f"--- 🦄 PROVIDER: COHERE  | MODEL: {MODEL_NAME} ---", flush=True)
else:
    MODEL_NAME    = os.getenv("SARVAM_MODEL", "sarvam-30b")
    active_client = AsyncSarvamAI(api_subscription_key=SARVAM_API_KEY)
    print(f"--- 🔥 PROVIDER: SARVAM  | MODEL: {MODEL_NAME} ---", flush=True)

# ── FastAPI ────────────────────────────────────────────────────
app = FastAPI(title="SwarmLab - AI Research Agent")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class TextRequest(BaseModel):
    text: str
    title: str = "Manual Input"

# ── WebSocket Log Manager ──────────────────────────────────────
class LogManager:
    def __init__(self):
        self.connections: list[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.connections.append(ws)

    def disconnect(self, ws: WebSocket):
        if ws in self.connections:
            self.connections.remove(ws)

    async def broadcast(self, data: dict):
        dead = []
        for ws in self.connections:
            try:
                await ws.send_json(data)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)

log_manager = LogManager()

async def emit(agent: str, message: str, status: str = "running"):
    """
    status: running | done | error | score
    """
    await log_manager.broadcast({
        "agent":   agent,
        "message": message,
        "status":  status,
        "ts":      time.strftime("%H:%M:%S"),
    })
    # Also print to terminal
    print(f"[{agent.upper()}] {message}", flush=True)

# ── WebSocket Endpoint ─────────────────────────────────────────
@app.websocket("/ws/logs")
async def websocket_logs(ws: WebSocket):
    await log_manager.connect(ws)
    try:
        while True:
            await ws.receive_text()   # keep alive
    except WebSocketDisconnect:
        log_manager.disconnect(ws)

# ── Core Logic ─────────────────────────────────────────────────
async def run_research_logic(text_content, title_name, collection_name="fast_test", client_override=None, model_override=None):
    start_time = time.time()

    await emit("system", f"🚀 Starting Research Swarm: {title_name}", "running")
    await emit("system", f"Provider: {PROVIDER} | Model: {MODEL_NAME}", "running")

    try:
        await emit("system", "Initializing Vector Store...", "running")
        vector_store = create_vector_store(text_content, collection_name=collection_name)
        doc_count = vector_store._collection.count() if hasattr(vector_store, "_collection") else "N/A"
        await emit("system", f"Vector Store ready — {doc_count} chunks ✓", "done")

        initial_state: ResearchState = {
            "paper_text":      text_content,
            "vector_store":    vector_store,
            "client":          client_override or active_client,
            "model_name":      model_override  or MODEL_NAME,
            "quality_threshold": 7,
            "analysis":        None,
            "summary":         None,
            "citations":       [],
            "insights":        None,
            "metadata":        {"title": title_name},
            "final_brief":     None,
            "current_agent":   "boss_init",
            "review_scores":   {},
            "review_feedback": {},
            "retry_counts":    {},
            "analyzer_done":   False,
            "summarizer_done": False,
            "citations_done":  False,
            "insights_done":   False,
            "_emit":           emit,   # pass emit to agents
        }

        await emit("boss", "Initializing Research Swarm...", "running")
        final_state = await workflow_app.ainvoke(initial_state)

        # Emit scores
        scores = final_state.get("review_scores", {})
        for agent, score in scores.items():
            status = "done" if score >= 7 else "error"
            await emit("reviewer", f"{agent.capitalize()} final score: {score}/10", status)

        elapsed = round(time.time() - start_time, 1)
        await emit("system", f"✅ Swarm complete in {elapsed}s", "done")
        return final_state

    except Exception as e:
        await emit("system", f"❌ Crash: {str(e)}", "error")
        print(f"!!! CRASH !!! {str(e)}", flush=True)
        return None

# ── /analyze-pdf ───────────────────────────────────────────────
@app.post("/analyze-pdf")
async def analyze_pdf_api(
    file: UploadFile = File(...),
    query:      Optional[str] = Form(None),
    api_key:    Optional[str] = Form(None),   # ← frontend se aata hai
    provider:   Optional[str] = Form(None),   # ← groq / sarvam / openai
    model_name: Optional[str] = Form(None),   # ← user selected model
):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Sirf PDF files allowed hain.")

    pdf_bytes = await file.read()
    if len(pdf_bytes) == 0:
        raise HTTPException(status_code=400, detail="File empty hai.")

    try:
        paper_text = extract_text_from_pdf(pdf_bytes)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"PDF parse error: {str(e)}")

    if query:
        paper_text = f"User Query: {query}\n\n---\n\n{paper_text}"

    # ── Dynamic client based on frontend config ────────────────
    req_provider   = (provider   or PROVIDER).lower()
    req_model      = model_name  or MODEL_NAME
    req_api_key    = api_key     or ""

    if req_provider == "groq":
        from groq import AsyncGroq
        key = req_api_key or os.getenv("GROQ_API_KEY","")
        req_client = AsyncGroq(api_key=key)
    elif req_provider == "openai":
        from openai import AsyncOpenAI
        key = req_api_key or os.getenv("OPENAI_API_KEY","")
        req_client = AsyncOpenAI(api_key=key)
    elif req_provider == "gemini":
        import google.generativeai as genai
        key = req_api_key or os.getenv("GEMINI_API_KEY","")
        genai.configure(api_key=key)
        req_client = genai.GenerativeModel(req_model)
    elif req_provider == "cohere":
        import cohere
        key = req_api_key or os.getenv("COHERE_API_KEY","")
        req_client = cohere.Client(api_key=key)
    else:
        req_client = active_client

    collection_name = file.filename.replace(".pdf", "").replace(" ", "_")[:50]
    result = await run_research_logic(
        paper_text, file.filename,
        collection_name=collection_name,
        client_override=req_client,
        model_override=req_model,
    )

    if not result:
        raise HTTPException(status_code=500, detail="Research swarm fail ho gaya.")

    return {
        "report":   result.get("final_brief", "No report generated."),
        "scores":   result.get("review_scores", {}),
        "title":    file.filename,
        "provider": req_provider,
        "model":    req_model,
    }

@app.post("/analyze-text")
async def analyze_text_api(request: TextRequest):
    result = await run_research_logic(request.text, request.title)
    if not result:
        raise HTTPException(status_code=500, detail="Workflow failed.")
    return result

@app.get("/health")
async def health():
    return {"status": "online", "model": MODEL_NAME, "provider": PROVIDER}

# ── /analyze-text — Raw pasted text → full swarm ──────────────
@app.post("/analyze-text")
async def analyze_text_endpoint(
    text:       str           = Form(...),
    query:      Optional[str] = Form(None),
    api_key:    Optional[str] = Form(None),
    provider:   Optional[str] = Form(None),
    model_name: Optional[str] = Form(None),
):
    if len(text.strip()) < 200:
        raise HTTPException(status_code=400, detail="Text bahut chota hai. Kam se kam 200 characters chahiye.")

    await emit("system", f"📝 Raw text received ({len(text):,} chars) — running swarm...", "running")

    if query:
        text = f"User Query: {query}\n\n---\n\n{text}"

    req_provider = (provider or PROVIDER).lower()
    req_model    = model_name or MODEL_NAME
    req_api_key  = api_key or ""

    if req_provider == "groq":
        from groq import AsyncGroq
        req_client = AsyncGroq(api_key=req_api_key or GROQ_API_KEY)
    elif req_provider == "openai":
        from openai import AsyncOpenAI
        req_client = AsyncOpenAI(api_key=req_api_key)
    elif req_provider == "gemini":
        import google.generativeai as genai
        genai.configure(api_key=req_api_key or os.getenv("GEMINI_API_KEY",""))
        req_client = genai.GenerativeModel(req_model)
    elif req_provider == "cohere":
        import cohere
        req_client = cohere.Client(api_key=req_api_key or os.getenv("COHERE_API_KEY",""))
    else:
        req_client = active_client

    title = "Pasted Research Text"
    collection_name = f"pasted_{int(time.time())}"
    result = await run_research_logic(
        text, title,
        collection_name=collection_name,
        client_override=req_client,
        model_override=req_model,
    )

    if not result:
        raise HTTPException(status_code=500, detail="Swarm fail ho gaya.")

    return {
        "report":   result.get("final_brief", "No report generated."),
        "scores":   result.get("review_scores", {}),
        "title":    title,
        "provider": req_provider,
        "model":    req_model,
    }

# ── /chat-with-paper — Chat about analyzed paper ──────────────
@app.post("/chat-with-paper")
async def chat_with_paper_api(
    message:         str           = Form(...),
    paper_context:   Optional[str] = Form(None),   # paper title/collection
    api_key:         Optional[str] = Form(None),
    provider:        Optional[str] = Form(None),
    model_name:      Optional[str] = Form(None),
):
    req_provider = (provider or PROVIDER).lower()
    req_model    = model_name or MODEL_NAME
    req_api_key  = api_key or ""

    if req_provider == "groq":
        from groq import AsyncGroq
        req_client = AsyncGroq(api_key=req_api_key or GROQ_API_KEY)
    elif req_provider == "openai":
        from openai import AsyncOpenAI
        req_client = AsyncOpenAI(api_key=req_api_key)
    elif req_provider == "gemini":
        import google.generativeai as genai
        genai.configure(api_key=req_api_key or os.getenv("GEMINI_API_KEY",""))
        req_client = genai.GenerativeModel(req_model)
    elif req_provider == "cohere":
        import cohere
        req_client = cohere.Client(api_key=req_api_key or os.getenv("COHERE_API_KEY",""))
    else:
        req_client = active_client

    # Load vector store if paper_context given
    context_text = ""
    if paper_context:
        try:
            safe_name = "".join([c if c.isalnum() else "_" for c in paper_context])
            from utils.vector_store import create_vector_store, get_embeddings
            from langchain_chroma import Chroma
            persist_dir = os.path.join(os.getcwd(), "db", safe_name[:50])
            if os.path.exists(persist_dir):
                vs = Chroma(persist_directory=persist_dir, embedding_function=get_embeddings())
                docs = vs.similarity_search(message, k=5)
                context_text = "\n\n---\n\n".join([d.page_content for d in docs])
        except Exception as e:
            print(f"Vector store load error: {e}")

    system_prompt = f"""You are an expert research assistant helping a user understand a research paper.
{"Use the following paper context to answer accurately:" if context_text else "Answer based on your knowledge."}

{"PAPER CONTEXT:\n" + context_text if context_text else ""}

Be concise, precise, and helpful. If you don't know, say so."""

    full_prompt = f"{system_prompt}\n\nUser Question: {message}"

    fake_state = {
        "model_name": req_model,
        "client":     req_client,
        "_emit":      emit,
    }
    from utils.llm_provider import call_llm
    await emit("system", f"💬 Chat query — searching paper context...", "running")
    try:
        response = await call_llm(fake_state, full_prompt)
        await emit("system", "Response ready ✓", "done")
        return {"report": response, "mode": "chat_with_paper"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ── /chat — Boss Agent direct chat ────────────────────────────
@app.post("/chat")
async def chat_api(
    message:    str           = Form(...),
    api_key:    Optional[str] = Form(None),
    provider:   Optional[str] = Form(None),
    model_name: Optional[str] = Form(None),
):
    req_provider = (provider or PROVIDER).lower()
    req_model    = model_name or MODEL_NAME
    req_api_key  = api_key or ""

    if req_provider == "groq":
        from groq import AsyncGroq
        req_client = AsyncGroq(api_key=req_api_key or GROQ_API_KEY)
    elif req_provider == "openai":
        from openai import AsyncOpenAI
        req_client = AsyncOpenAI(api_key=req_api_key)
    elif req_provider == "gemini":
        import google.generativeai as genai
        genai.configure(api_key=req_api_key or os.getenv("GEMINI_API_KEY",""))
        req_client = genai.GenerativeModel(req_model)
    elif req_provider == "cohere":
        import cohere
        req_client = cohere.Client(api_key=req_api_key or os.getenv("COHERE_API_KEY",""))
    else:
        req_client = active_client

    from utils.llm_provider import call_llm

    # Boss Agent system prompt
    boss_prompt = f"""You are the Boss Agent of SwarmLab — an expert AI Research Assistant.
You are highly knowledgeable about:
- Machine Learning, Deep Learning, NLP, Computer Vision
- Research papers, methodologies, architectures
- Mathematics, statistics, algorithms
- Scientific writing and analysis

Your personality:
- Precise and technical but easy to understand
- Direct answers — no unnecessary fluff
- Use markdown formatting (bold, lists, code blocks) where helpful
- If asked about a research topic, give depth

User message: {message}

Respond helpfully and concisely."""

    await emit("boss", f"Processing chat: {message[:50]}...", "running")
    try:
        state = {"model_name": req_model, "client": req_client, "_emit": emit}
        response = await call_llm(state, boss_prompt)
        await emit("boss", "Response ready ✓", "done")
        return {"report": response, "mode": "chat"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ── /analyze-url — URL/arXiv se PDF download karke full swarm ─
@app.post("/analyze-url")
async def analyze_url_api(
    url:        str           = Form(...),
    query:      Optional[str] = Form(None),
    api_key:    Optional[str] = Form(None),
    provider:   Optional[str] = Form(None),
    model_name: Optional[str] = Form(None),
):
    await emit("system", f"🔗 Fetching: {url}", "running")

    try:
        text_content, title = await fetch_url_text(url)
    except Exception as e:
        await emit("system", f"❌ Fetch failed: {str(e)}", "error")
        raise HTTPException(status_code=422, detail=f"URL fetch error: {str(e)}")

    if not text_content or len(text_content) < 100:
        raise HTTPException(status_code=422, detail="URL se koi content nahi mila.")

    char_count = len(text_content)
    await emit("system", f"✓ Downloaded: {title} ({char_count:,} chars)", "done")

    if query:
        text_content = f"User Query: {query}\n\n---\n\n{text_content}"

    # ── Build client ──────────────────────────────────────
    req_provider = (provider or PROVIDER).lower()
    req_model    = model_name or MODEL_NAME
    req_api_key  = api_key or ""

    if req_provider == "groq":
        from groq import AsyncGroq
        req_client = AsyncGroq(api_key=req_api_key or GROQ_API_KEY)
    elif req_provider == "openai":
        from openai import AsyncOpenAI
        req_client = AsyncOpenAI(api_key=req_api_key)
    elif req_provider == "gemini":
        import google.generativeai as genai
        genai.configure(api_key=req_api_key or os.getenv("GEMINI_API_KEY",""))
        req_client = genai.GenerativeModel(req_model)
    elif req_provider == "cohere":
        import cohere
        req_client = cohere.Client(api_key=req_api_key or os.getenv("COHERE_API_KEY",""))
    else:
        req_client = active_client

    # ── Run full research swarm ───────────────────────────
    collection_name = re.sub(r"[^a-zA-Z0-9]", "_", title)[:50]
    result = await run_research_logic(
        text_content, title,
        collection_name=collection_name,
        client_override=req_client,
        model_override=req_model,
    )

    if not result:
        raise HTTPException(status_code=500, detail="Research swarm fail ho gaya.")

    return {
        "report":   result.get("final_brief", "No report generated."),
        "scores":   result.get("review_scores", {}),
        "title":    title,
        "source":   url,
        "provider": req_provider,
        "model":    req_model,
    }