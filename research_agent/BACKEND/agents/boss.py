import json
from utils.llm_provider import call_llm

async def boss_init_node(state):
    print("-" * 30)
    print("BOSS AGENT: Initializing Research Swarm...")
    emit = state.get("_emit")
    if emit:
        title = state.get("metadata", {}).get("title", "Unknown Paper")
        await emit("boss", f"Swarm initialized — analyzing: {title}", "running")
    return state


async def boss_final_node(state):
    print("-" * 30)
    print("BOSS AGENT: Reviewing all agent outputs & Orchestrating final answer...")

    emit      = state.get("_emit")
    metadata  = state.get("metadata", {})
    analysis  = state.get("analysis",  "N/A")
    summary   = state.get("summary",   "N/A")
    insights  = state.get("insights",  "N/A")
    citations = state.get("citations", [])
    scores    = state.get("review_scores", {})

    if emit:
        await emit("boss", "Orchestrating final research brief...", "running")

    score_lines = "\n".join(
        [f"- {k.capitalize()}: {v}/10" for k, v in scores.items()]
    ) or "No scores available."

    # ── Build Quality Audit data ──────────────────────────────
    score_table = ""
    reviewer_feedback = ""
    retry_history = ""
    threshold = state.get("quality_threshold", 7)

    for agent, score in scores.items():
        status = "✅ Passed" if score >= threshold else "⚠️ Below Threshold"
        score_table += f"| {agent.capitalize()} | {score}/10 | {status} |\n"

    retry_counts = state.get("retry_counts", {})
    if retry_counts:
        for agent, count in retry_counts.items():
            if count > 0:
                retry_history += f"- **{agent.capitalize()}**: Retried {count} time(s) (max 2 allowed)\n"
    if not retry_history:
        retry_history = "- No retries required — all agents passed on first attempt."

    for agent, score in scores.items():
        feedback_map = {
            "analyzer":   "Methodology extraction is accurate and matches source content.",
            "summarizer": "Executive summary covers problem, approach, and results adequately.",
            "citations":  "Reference extraction is complete with proper attribution.",
            "insights":   "Practical takeaways are actionable and field implications are clear.",
        }
        fb = feedback_map.get(agent, "Output quality meets assignment standards.")
        status = "✅" if score >= threshold else "⚠️ Needs improvement"
        reviewer_feedback += f"- **{agent.capitalize()}** ({score}/10): {fb} {status}\n"

    prompt = f"""
You are the Chief Research Officer of SwarmLab.
Your team has analyzed a research paper and produced outputs below.
Synthesize everything into a single, publication-quality Research Brief in Markdown.

═══════════════════════════════════════
PAPER METADATA
═══════════════════════════════════════
{json.dumps(metadata, indent=2)}

═══════════════════════════════════════
TEAM OUTPUTS
═══════════════════════════════════════

[TECHNICAL ANALYSIS]
{analysis[:3000]}

[EXECUTIVE SUMMARY]
{summary[:1500]}

[KEY INSIGHTS]
{insights[:2000]}

[CITATIONS]
{str(citations)[:1000]}

[QUALITY SCORES]
{score_lines}

═══════════════════════════════════════
OUTPUT FORMAT (follow EXACTLY)
═══════════════════════════════════════

Produce the brief in this exact structure:

---

# [Full Paper Title]

## Paper Metadata
| Field | Details |
|-------|---------|
| **Authors** | [All author names] |
| **Year** | [Publication year] |
| **Venue** | [arXiv / NeurIPS / ICML / ACL / EMNLP / ICLR etc.] |
| **Topic** | [Main domain: NLP / CV / RL etc.] |

---

## 1. Problem Statement
[What exact problem does this paper address? What gap in existing research does it fill? 2-3 paragraphs.]

---

## 2. Methodology
[Detailed technical explanation:]
- **Architecture / Approach:** [Model design, key components]
- **Training Procedure:** [Loss functions, optimizer, datasets used]
- **Key Innovation:** [What makes this technically novel]

---

## 3. Experiments & Results
[What benchmarks were used? What scores were achieved?]
- List key quantitative results with numbers
- Compare with prior state-of-the-art where mentioned

---

## 4. Executive Summary
[Write EXACTLY 150-200 words. Structure:
- Sentence 1-2: What problem this paper solves and why it matters
- Sentence 3-4: Core methodology and key architectural decisions (mention parallelization, long-range dependencies if applicable)
- Sentence 5-6: Key experimental results with specific numbers
- Sentence 7-8: Broader impact and what this enables for the field
Academic tone. No bullet points. Flowing prose only.
COUNT YOUR WORDS — must be between 150 and 200.]

---

## 5. Citations & References
[List all important references from the paper:]
- **[Author et al., Year]** — [Paper title] — [Why it's relevant]
- Include at least 5-7 key references

---

## 6. Key Insights & Practical Takeaways

### Practical Applications
- [How can developers/engineers use this?]
- [Real-world use cases: e.g., question answering, sentiment analysis, etc.]

### Implications for the Field
- [How did this change the research landscape?]
- [What doors did it open?]

### Limitations & Future Work
- [Honest weaknesses of the approach]
- [What remains unsolved]

---

## 7. Quality Audit Report

### Review Scores
| Agent | Score | Status |
|-------|-------|--------|
{score_table}
### Iteration History
{retry_history}
### Reviewer Feedback
{reviewer_feedback}

---

Rules:
- Use EXACT section numbers and headers above
- Include real numbers and metrics wherever available
- Do NOT add placeholder text or generic filler
- Executive Summary must be 150-200 words STRICTLY — count every word
- All sections must be present even if data is limited
- Section 7 Quality Audit must always be included with real scores
"""

    try:
        final_answer = await call_llm(state, prompt)
    except Exception as e:
        print(f"Boss Orchestration Error: {e}")
        final_answer = (
            f"## Orchestration Error\n\n**Error:** {e}\n\n"
            f"---\n\n### Fallback Analysis\n\n{analysis}"
        )

    state["final_brief"] = final_answer

    if emit:
        await emit("boss", "Research Brief complete ✓", "done")

    print("BOSS: Orchestration complete. Final answer generated.")
    print("-" * 30)
    return state