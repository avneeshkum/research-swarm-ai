import httpx
import re
from bs4 import BeautifulSoup

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
}

def is_pdf_url(url: str) -> bool:
    return url.lower().endswith(".pdf") or "/pdf/" in url.lower()

def arxiv_to_pdf(url: str) -> str:
    """
    arxiv.org/abs/1706.03762  →  arxiv.org/pdf/1706.03762.pdf
    arxiv.org/pdf/1706.03762  →  same (already pdf)
    """
    url = url.rstrip("/")
    if "arxiv.org/abs/" in url:
        paper_id = url.split("/abs/")[-1]
        return f"https://arxiv.org/pdf/{paper_id}.pdf"
    if "arxiv.org/pdf/" in url and not url.endswith(".pdf"):
        return url + ".pdf"
    return url

def semanticscholar_to_pdf(url: str) -> str | None:
    """Try to extract direct PDF from Semantic Scholar"""
    # Usually has a PDF link in the page
    return None

async def fetch_url_text(url: str) -> tuple[str, str]:
    """
    Smart URL handler:
    1. arXiv abstract → auto convert to PDF URL
    2. Direct PDF URL → download and parse
    3. HTML page → extract text with BeautifulSoup
    
    Returns: (text_content, title)
    """
    url = url.strip()

    # ── arXiv special handling ──────────────────────────────
    if "arxiv.org" in url:
        pdf_url = arxiv_to_pdf(url)
        print(f"arXiv detected → converting to PDF: {pdf_url}")
        return await _fetch_pdf(pdf_url)

    # ── Direct PDF URL ──────────────────────────────────────
    if is_pdf_url(url):
        return await _fetch_pdf(url)

    # ── HTML page — try to find embedded PDF link ───────────
    async with httpx.AsyncClient(timeout=30, follow_redirects=True, headers=HEADERS) as client:
        r = await client.get(url)
        r.raise_for_status()
        ctype = r.headers.get("content-type", "")

        # Backend returned a PDF even though URL didn't end in .pdf
        if "pdf" in ctype:
            from utils.pdf_parser import extract_text_from_pdf
            text = extract_text_from_pdf(r.content)
            title = url.split("/")[-1].replace(".pdf", "") or "paper"
            return text, title

        # Parse HTML — look for PDF link
        soup = BeautifulSoup(r.text, "html.parser")

        # Find PDF download link on the page
        pdf_link = None
        for a in soup.find_all("a", href=True):
            href = a["href"]
            if href.lower().endswith(".pdf") or "/pdf/" in href.lower():
                if href.startswith("http"):
                    pdf_link = href
                elif href.startswith("/"):
                    from urllib.parse import urlparse
                    base = urlparse(url)
                    pdf_link = f"{base.scheme}://{base.netloc}{href}"
                break

        if pdf_link:
            print(f"Found PDF link on page: {pdf_link}")
            return await _fetch_pdf(pdf_link)

        # Fallback — extract HTML text
        title = soup.title.string.strip() if soup.title and soup.title.string else url
        for tag in soup(["script","style","nav","footer","header","aside","form","button"]):
            tag.decompose()
        main = soup.find("main") or soup.find("article") or soup.body
        text = main.get_text(separator="\n", strip=True) if main else soup.get_text(separator="\n", strip=True)
        text = re.sub(r'\n{3,}', '\n\n', text).strip()
        return text, title


async def _fetch_pdf(pdf_url: str) -> tuple[str, str]:
    """Download PDF bytes and extract text"""
    from utils.pdf_parser import extract_text_from_pdf

    print(f"Downloading PDF: {pdf_url}")
    async with httpx.AsyncClient(timeout=60, follow_redirects=True, headers=HEADERS) as client:
        r = await client.get(pdf_url)
        r.raise_for_status()

    text = extract_text_from_pdf(r.content)
    if not text:
        raise ValueError("PDF mein koi extractable text nahi mila.")

    # Title from URL
    title = pdf_url.split("/")[-1].replace(".pdf", "").replace("_", " ").replace("-", " ")
    return text, title or "research_paper"