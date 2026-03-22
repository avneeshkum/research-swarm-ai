<div align="center">

<img src="https://img.shields.io/badge/SwarmLab-AI%20Research%20Agent-f97316?style=for-the-badge&logo=flask&logoColor=white" />

# 🧪 SwarmLab — AI Research Swarm

### *Multi-Agent Orchestration for Deep Research Paper Analysis*

[![Python](https://img.shields.io/badge/Python-3.10%2B-3776AB?style=flat-square&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110%2B-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![LangGraph](https://img.shields.io/badge/LangGraph-Orchestration-6366f1?style=flat-square)](https://langchain-ai.github.io/langgraph)
[![React](https://img.shields.io/badge/React-18%2B-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-5%2B-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev)
[![License](https://img.shields.io/badge/License-MIT-22c55e?style=flat-square)](LICENSE)

---

**SwarmLab** deploys a coordinated team of AI agents on any research paper — from a PDF upload, arXiv URL, or pasted text — and returns a structured, publication-quality research brief in minutes.

[**Demo**](#demo) · [**Quick Start**](#quick-start) · [**Architecture**](#architecture) · [**API Reference**](#api-reference)

</div>

---

## ✨ What It Does

You give SwarmLab a research paper. It deploys **6 specialist AI agents** in parallel, each doing one job extremely well:

| Agent | Job |
|-------|-----|
| 🟠 **Boss** | Orchestrates the swarm, produces the final brief |
| 🔵 **Analyzer** | Deep technical methodology extraction |
| 🟣 **Summarizer** | 150–200 word executive summary |
| 🩷 **Citations** | Reference extraction and attribution |
| 🟡 **Insights** | Practical takeaways and implications |
| 🟢 **Reviewer** | Quality control — scores each agent 1–10 and triggers retries |

Every agent's work is **peer-reviewed** live. You watch the swarm run in real-time inside the chat bubble itself.

---

## 🖼️ Features

- **5 Input Modes** — PDF upload, arXiv/URL link, paste raw text, normal chat, chat-with-paper
- **Real-time Agent Logs** — WebSocket streams every agent step live into the UI
- **PDF Export** — One-click styled PDF download of the full research brief
- **Multi-Provider** — Switch between Groq, Sarvam, OpenAI, Gemini, Cohere from the UI
- **Quality Audit Section** — Every report includes Reviewer scores + iteration history
- **Vector Store** — HuggingFace embeddings (BAAI/bge-small) + ChromaDB for semantic retrieval
- **Mobile Friendly** — Bottom sheet settings, responsive layout, `100dvh` safe

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND (React + Vite)               │
│                                                             │
│  ┌──────────┐  ┌──────────────────────────────────────────┐ │
│  │ Sidebar  │  │              SwarmLab Chat               │ │
│  │          │  │  ┌────────────────────────────────────┐  │ │
│  │ Sessions │  │  │  Live Agent Log (WebSocket)        │  │ │
│  │ Settings │  │  │  ✓ Boss  → Analyzer  → Reviewer... │  │ │
│  │ Status   │  │  └────────────────────────────────────┘  │ │
│  └──────────┘  │  [📎] [✨] [textarea...........] [Send]   │ │
│                └──────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                         │ HTTP + WebSocket
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                     BACKEND (FastAPI)                        │
│                                                             │
│  POST /analyze-pdf     POST /analyze-url                    │
│  POST /analyze-text    POST /chat                           │
│  POST /chat-with-paper GET  /health                         │
│  WS   /ws/logs   ←── real-time agent logs                   │
│                                                             │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                  LangGraph Orchestrator                      │
│                                                             │
│   boss_init ──► analyzer ──► reviewer ──► summarizer        │
│                                    │                        │
│              ◄── retry (max 2) ◄───┘                        │
│                                                             │
│   summarizer ──► reviewer ──► citations ──► reviewer        │
│   citations  ──► reviewer ──► insights  ──► reviewer        │
│   insights   ──► boss_final ──► [Research Brief]            │
│                                                             │
└──────────────────────┬──────────────────────────────────────┘
                       │
          ┌────────────┴─────────────┐
          ▼                          ▼
   ChromaDB (local)           LLM Provider
   HuggingFace Embeddings      ⚡ Groq
   BAAI/bge-small-en-v1.5      🔥 Sarvam
                                🤖 OpenAI
                                💎 Gemini
                                🦄 Cohere
```

---

## 📁 Project Structure

```
research_agent/
├── BACKEND/
│   ├── main.py                  # FastAPI app, all endpoints, WebSocket
│   ├── graph.py                 # LangGraph workflow definition
│   ├── schema.py                # ResearchState TypedDict
│   ├── agents/
│   │   ├── boss_agent.py        # Orchestrator — init + final brief
│   │   ├── analyzer_agent.py    # Technical methodology extraction
│   │   ├── summarizer_agent.py  # Executive summary (150-200 words)
│   │   ├── citations_agent.py   # Reference extraction
│   │   ├── insights_agent.py    # Practical takeaways & implications
│   │   └── reviewer_agent.py    # Quality control + retry logic
│   ├── utils/
│   │   ├── llm_provider.py      # Universal LLM client (5 providers)
│   │   ├── vector_store.py      # ChromaDB + HuggingFace embeddings
│   │   ├── pdf_parser.py        # PyPDF2 text extraction
│   │   └── url_fetcher.py       # arXiv/URL → PDF download
│   ├── data/                    # Drop PDFs here for direct CLI run
│   ├── db/                      # ChromaDB persistence (auto-created)
│   └── requirements.txt
│
├── FRONTEND/
│   ├── src/
│   │   ├── SwarmLab.jsx         # Main app — chat, agents, settings
│   │   ├── Sidebar.jsx          # Session history + system status
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   ├── index.css            # Tailwind v4 + global styles
│   │   └── App.css
│   ├── index.html
│   ├── vite.config.js
│   ├── postcss.config.js
│   └── package.json
│
└── sample-outputs/
    └── attention-is-all-you-need-brief.pdf   # Real SwarmLab generated output
```

---

## 📎 Sample Output

Real output generated by SwarmLab on the original Transformer paper:

**[📄 Attention Is All You Need — Research Brief](https://github.com/avneeshkum/research-swarm-ai/raw/main/research_agent/sample-outputs/attention-is-all-you-need-brief.pdf)**

> Analyzer: 9/10 · Summarizer: 9/10 · Citations: 10/10 · Insights: 9/10 · Zero retries needed.

---

## 🚀 Quick Start

### Prerequisites

- Python 3.10+
- Node.js 18+ / Yarn
- At least one LLM API key (Groq is fastest and free)

---

### 1. Clone

```bash
git clone https://github.com/avneeshkum/swarmlab.git
cd swarmlab
```

### 2. Backend Setup

```bash
cd BACKEND

# Create virtual environment
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # Mac/Linux

# Install dependencies
pip install -r requirements.txt
```

Create a `.env` file in `BACKEND/`:

```env
# ── Choose your provider ──────────────────────
PROVIDER=groq                  # groq | sarvam | openai | gemini | cohere

# ── Groq (recommended — fast & free tier) ────
GROQ_API_KEY=gsk_xxxxxxxxxxxx
GROQ_MODEL=llama-3.3-70b-versatile

# ── Sarvam (default) ─────────────────────────
SARVAM_API_KEY=your_sarvam_key
SARVAM_MODEL=sarvam-30b

# ── OpenAI ───────────────────────────────────
OPENAI_API_KEY=sk-xxxxxxxxxxxx
OPENAI_MODEL=gpt-4o

# ── Gemini ───────────────────────────────────
GEMINI_API_KEY=AIzaxxxxxxxxxx
GEMINI_MODEL=gemini-2.5-flash

# ── Cohere ───────────────────────────────────
COHERE_API_KEY=xxxxxxxxxxxx
COHERE_MODEL=command-a-03-2025
```

Start the backend:

```bash
uvicorn main:app --reload --port 8000
```

You should see:
```
--- ⚡ PROVIDER: GROQ | MODEL: llama-3.3-70b-versatile ---
INFO: Uvicorn running on http://127.0.0.1:8000
INFO: Application startup complete.
```

---

### 3. Frontend Setup

```bash
cd FRONTEND

# Install dependencies
yarn install

# Start dev server
yarn dev
```

Open **http://localhost:5173** — SwarmLab is ready.

---

## 🎮 Usage

### Input Modes

The input bar auto-detects what you're doing:

| What you type/upload | Mode | What happens |
|----------------------|------|--------------|
| Attach a `.pdf` file | 📄 **Swarm** | PDF is parsed → full 6-agent pipeline |
| Paste `https://arxiv.org/abs/...` | 🔗 **URL** | PDF auto-downloaded → full swarm |
| Paste `https://example.com/paper.pdf` | 🔗 **URL** | Direct PDF download → full swarm |
| Paste 500+ characters of text | ⚡ **Swarm** | Text sent directly to swarm pipeline |
| After a paper is analyzed, ask a question | 📖 **Paper Chat** | Vector store queried, context-aware reply |
| Normal short message | 💬 **Chat** | Boss Agent replies directly |

Or click the **✨ mode button** in the input bar to manually select.

---

### Switching Models

Click the **model name button** in the top bar → bottom sheet opens:

- Select **Provider**: Groq ⚡ / Sarvam 🔥 / OpenAI 🤖 / Gemini 💎 / Cohere 🦄
- Select **Model** from the list
- Paste your **API Key** (saved for the session)

Model changes apply immediately to the next request — no restart needed.

---

### Output Format

Every research brief contains:

```
# [Paper Title]

## Paper Metadata
| Authors | Year | Venue | Topic |

## 1. Problem Statement
## 2. Methodology
## 3. Experiments & Results
## 4. Executive Summary (150-200 words)
## 5. Citations & References
## 6. Key Insights & Practical Takeaways
## 7. Quality Audit Report
   - Review Scores per agent (1-10)
   - Iteration History (retry count)
   - Reviewer Feedback
```

Click **Download PDF** under any response to get a styled, print-ready document.

---

## 🔌 API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/analyze-pdf` | Upload PDF → full swarm |
| `POST` | `/analyze-url` | URL/arXiv link → download + swarm |
| `POST` | `/analyze-text` | Raw pasted text → swarm |
| `POST` | `/chat` | Direct chat with Boss Agent |
| `POST` | `/chat-with-paper` | Context-aware chat using vector store |
| `GET`  | `/health` | Server status + active model |
| `WS`   | `/ws/logs` | Real-time agent log stream |

### Example: Analyze a PDF

```bash
curl -X POST http://localhost:8000/analyze-pdf \
  -F "file=@paper.pdf" \
  -F "provider=groq" \
  -F "model_name=llama-3.3-70b-versatile" \
  -F "api_key=gsk_xxxx"
```

### Example: Analyze arXiv

```bash
curl -X POST http://localhost:8000/analyze-url \
  -F "url=https://arxiv.org/abs/1706.03762" \
  -F "provider=groq" \
  -F "model_name=llama-3.3-70b-versatile"
```

---

## ⚙️ Configuration

### Quality Threshold

In `main.py`, the `quality_threshold` controls when Reviewer triggers a retry:

```python
"quality_threshold": 7,  # Retry if score < 7 (max 2 retries per agent)
```

### Embedding Model

In `utils/vector_store.py`:

```python
model_name = "BAAI/bge-small-en-v1.5"  # ~130MB, CPU-optimized
# Downloads on first run, then cached locally
```

### Chunk Size

```python
chunk_size    = 1500  # characters per chunk
chunk_overlap = 200   # overlap for context continuity
```

---

## 📦 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, Vite 5, Tailwind CSS v4, Framer Motion |
| **UI Components** | Lucide React, ReactMarkdown + remark-gfm |
| **Backend** | FastAPI, Python 3.10+, uvicorn |
| **Orchestration** | LangGraph (StateGraph with conditional edges) |
| **Vector Store** | ChromaDB (local persistence) |
| **Embeddings** | HuggingFace `BAAI/bge-small-en-v1.5` |
| **LLM Providers** | Groq, Sarvam AI, OpenAI, Google Gemini, Cohere |
| **HTTP Client** | httpx (async URL fetching) |
| **PDF** | PyPDF2 (extraction), BeautifulSoup4 (HTML scraping) |
| **Real-time** | WebSocket (FastAPI native) |

---

## 🧩 Supported Models

### Groq
| Model | Context | Best For |
|-------|---------|----------|
| `llama-3.3-70b-versatile` | 128K | Best quality |
| `openai/gpt-oss-120b` | 128K | Flagship reasoning |
| `openai/gpt-oss-20b` | 128K | Balanced |
| `qwen/qwen3-32b` | 32K | Multilingual |
| `moonshotai/kimi-k2-instruct-0905` | 256K | Long papers |
| `llama-3.1-8b-instant` | 128K | Fastest |

### Gemini
`gemini-3-flash-preview` · `gemini-3.1-pro-preview` · `gemini-2.5-pro` · `gemini-2.5-flash`

### Cohere
`command-a-03-2025` · `command-r-plus-08-2024` · `command-r-08-2024`

### OpenAI
`gpt-4o` · `gpt-4o-mini` · `gpt-3.5-turbo`

### Sarvam
`sarvam-30b` (Indus-105B backbone)

---

## 🐛 Troubleshooting

**`422 Unprocessable Entity` on PDF upload**
→ Make sure you're not manually setting `Content-Type` header — let the browser set the multipart boundary automatically.

**`[object Object]` error in chat**
→ Update `main.py` — the `/chat` endpoint had double-brace `{{}}` syntax in an f-string.

**Vector store `0 documents` after loading**
→ Delete the `db/<paper_name>/` folder. Old collection name mismatch. Fixed in latest `vector_store.py`.

**`WinError 32` file locked on Windows**
→ `vector_store.py` now handles this with `gc.collect()` + retry logic before `shutil.rmtree`.

**Embedding slow on first run**
→ `BAAI/bge-small-en-v1.5` downloads ~130MB once. Subsequent runs load from cache in ~1s.

---

## 🗺️ Roadmap

- [ ] Streaming responses (token-by-token output)
- [ ] Batch analysis (multiple PDFs in one session)
- [ ] Citation graph visualization
- [ ] Export to Notion / Google Docs
- [ ] Docker Compose for one-command deployment
- [ ] Pinecone / Qdrant cloud vector store option

---

## 🤝 Contributing

Pull requests are welcome. For major changes, please open an issue first.

```bash
# Fork → Clone → Branch
git checkout -b feature/your-feature

# Make changes, then
git commit -m "feat: your feature description"
git push origin feature/your-feature
# Open PR
```

---

## 📄 License

MIT — see [LICENSE](LICENSE)

---

<div align="center">

Built with ❤️ by **Avneesh**

*SwarmLab — Because one AI is never enough.*

</div>
