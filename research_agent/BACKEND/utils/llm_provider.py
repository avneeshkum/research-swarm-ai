import os
from groq import AsyncGroq

async def call_llm(state, prompt):
    """
    Universal Provider: Sarvam, Groq, OpenAI, Gemini, Cohere
    """
    model  = state["model_name"].lower()
    client = state["client"]
    MAX_TOKENS = 4096

    try:
        # ── SARVAM ────────────────────────────────────────────
        if "sarvam" in model:
            response = await client.chat.completions(
                model=state["model_name"],
                messages=[{"role":"user","content":prompt}],
                max_tokens=MAX_TOKENS,
            )
            if response and hasattr(response,"choices") and response.choices:
                content = response.choices[0].message.content
                if content: return str(content).strip()
            return "No response from Sarvam."

        # ── GROQ (llama, gemma, qwen, kimi, gpt-oss) ─────────
        elif any(x in model for x in ["llama","gemma","qwen","kimi","gpt-oss","groq","mixtral"]):
            groq_client = client if isinstance(client, AsyncGroq) else AsyncGroq(
                api_key=os.getenv("GROQ_API_KEY")
            )
            response = await groq_client.chat.completions.create(
                model=state["model_name"],
                messages=[{"role":"user","content":prompt}],
                max_tokens=MAX_TOKENS,
                temperature=0.7,
            )
            if response and hasattr(response,"choices") and response.choices:
                content = response.choices[0].message.content
                if content: return str(content).strip()
            return "No response from Groq."

        # ── OPENAI (gpt-4o, gpt-3.5) ─────────────────────────
        elif "gpt" in model and "oss" not in model:
            response = await client.chat.completions.create(
                model=state["model_name"],
                messages=[{"role":"user","content":prompt}],
                max_tokens=MAX_TOKENS,
            )
            if response and hasattr(response,"choices") and response.choices:
                content = response.choices[0].message.content
                if content: return str(content).strip()
            return "No response from OpenAI."

        # ── GEMINI ────────────────────────────────────────────
        elif "gemini" in model:
            # client = google.generativeai configured model
            response = await client.generate_content_async(prompt)
            if response and hasattr(response,"text"):
                return response.text.strip()
            return "No response from Gemini."

        # ── COHERE ────────────────────────────────────────────
        elif "command" in model:
            response = client.chat(
                model=state["model_name"],
                message=prompt,
                max_tokens=MAX_TOKENS,
            )
            if response and hasattr(response,"text"):
                return response.text.strip()
            return "No response from Cohere."

        else:
            raise ValueError(f"Model '{state['model_name']}' not supported.")

    except Exception as e:
        print(f"LLM Provider Error ({state['model_name']}): {e}")
        return f"Error during processing: {str(e)}"