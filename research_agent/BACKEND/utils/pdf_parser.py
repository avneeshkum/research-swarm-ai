import PyPDF2
import io

def extract_text_from_pdf(pdf_bytes):
    """
    Extracts all text from a PDF file provided as bytes.
    Handles multi-page research papers and returns a single string.
    Page numbers added so vector store chunks retain context.
    """
    try:
        pdf_file = io.BytesIO(pdf_bytes)
        reader   = PyPDF2.PdfReader(pdf_file)
        total    = len(reader.pages)

        extracted_text = ""

        for i, page in enumerate(reader.pages):
            page_text = page.extract_text()
            if page_text:
                # Page marker helps vector store retrieval
                extracted_text += f"\n[Page {i+1}/{total}]\n{page_text}\n"

        clean_text = extracted_text.strip()

        if not clean_text:
            print("Warning: PDF contains no extractable text.")
            return None

        print(f"PDF extracted: {total} pages, {len(clean_text)} characters")
        return clean_text

    except Exception as e:
        print(f"Error during PDF text extraction: {str(e)}")
        return None