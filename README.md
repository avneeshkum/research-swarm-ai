
# 🧠 Research Swarm AI

An AI-powered multi-agent research paper analyzer built with LangGraph and FastAPI for automated deep analysis, summarization, and citation extraction.

**🔗 [Watch the 3-Minute Demo Video Here] (Insert your Google Drive/YouTube link here)**

## 🚀 Architecture & Workflow

This system utilizes a hierarchical multi-agent architecture powered by LangGraph. A Boss Agent delegates tasks to specialized sub-agents, and a Reviewer Agent ensures output quality before final delivery.

```mermaid
graph TD
    A[User Input: PDF / URL / Text] --> B{Boss Agent}
    B -->|Delegates Context| C(Parallel Processing)
    C --> D[Analyzer Agent: Methodology & Findings]
    C --> E[Summarizer Agent: Executive Summary]
    C --> F[Citations Agent: Extraction]
    C --> G[Insights Agent: Practical Takeaways]
    D & E & F & G --> H{Reviewer Agent}
    H -->|Score < 8 / Retry| C
    H -->|Score >= 8 / Approved| I[Final Research Brief + Quality Audit Report]
    
    style B fill:#f9f,stroke:#333,stroke-width:2px
    style H fill:#ff9,stroke:#333,stroke-width:2px
    style I fill:#bbf,stroke:#333,stroke-width:2px
```

## ✨ Key Features

* **Multi-Agent Orchestration:** Powered by LangGraph for seamless delegation and parallel processing.
* **Iterative Quality Control:** Built-in Reviewer Agent evaluates sub-agent outputs on a 1-10 scale and triggers retries if quality standards are not met.
* **Flexible Inputs:** Robust parsing system that accepts direct PDF file uploads, research URLs, or raw text.
* **Production-Grade Full-Stack:** FastAPI backend coupled with a modern React/Vite frontend for a seamless user experience.

## 🛠️ Tech Stack

* **Backend:** FastAPI, Python 3.9+
* **AI/LLM:** LangGraph, LangChain, Groq API (Llama 3)
* **Frontend:** React, Vite, Tailwind CSS
* **Vector Store:** ChromaDB / HuggingFace Embeddings

## ⚙️ Setup & Installation

### 1. Clone the Repository
```bash
git clone [https://github.com/YOUR_USERNAME/research-swarm-ai.git](https://github.com/YOUR_USERNAME/research-swarm-ai.git)
cd research-swarm-ai
```

### 2. Backend Setup
Navigate to the backend directory and install dependencies:
```bash
cd BACKEND
pip install -r requirements.txt
```

Create a `.env` file in the `BACKEND` root directory (Do NOT commit this file):
```env
GROQ_API_KEY=your_groq_api_key_here
```

Start the FastAPI server:
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 3. Frontend Setup
Open a new terminal, navigate to the frontend directory, and start the Vite development server:
```bash
cd FRONTEND
npm install  # or yarn install
npm run dev  # or yarn dev
```

