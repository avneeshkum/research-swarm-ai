import os
import shutil
import time
import gc
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_chroma import Chroma
from langchain_text_splitters import RecursiveCharacterTextSplitter

# --- Global cache ---
_embeddings_cache = None

def get_embeddings():
    global _embeddings_cache
    if _embeddings_cache is None:
        print("Loading embedding model (one time only)...")
        _embeddings_cache = HuggingFaceEmbeddings(
            model_name="BAAI/bge-small-en-v1.5",
            model_kwargs={"device": "cpu"},
            encode_kwargs={
                "normalize_embeddings": True,
                "batch_size": 128,   # 64 → 128: faster on CPU
            },
        )
        print("Embedding model ready ✓")
    return _embeddings_cache

def safe_delete(path, retries=5, delay=1.5):
    """Windows pe file lock hoti hai — retry logic with aggressive GC"""
    if not os.path.exists(path):
        return True
    for attempt in range(retries):
        try:
            gc.collect()
            time.sleep(delay)
            shutil.rmtree(path)
            print(f"Deleted: {path}")
            return True
        except PermissionError:
            if attempt < retries - 1:
                print(f"File locked, retrying ({attempt+1}/{retries})...")
            else:
                print(f"Cannot delete — manually delete: {path}")
        except Exception as e:
            print(f"Error deleting path: {e}")
            break
    return False

def create_vector_store(text, collection_name="research_paper"):
    # Clean collection name for Windows folder compatibility
    safe_name = "".join([c if c.isalnum() else "_" for c in collection_name])
    persist_directory = os.path.join(os.getcwd(), "db", safe_name)
    embeddings = get_embeddings()

    # --- Load existing DB ---
    if os.path.exists(persist_directory) and os.listdir(persist_directory):
        print(f"Loading existing local vector store from: {persist_directory}")
        vs = None
        try:
            vs = Chroma(
                persist_directory=persist_directory,
                embedding_function=embeddings,
            )
            count = vs._collection.count()
            print(f"Vector store has {count} documents")
            if count > 0:
                return vs
            print("Empty DB — closing and rebuilding...")
        except Exception as e:
            print(f"Load error: {e}")
        finally:
            if vs is not None:
                vs = None
                gc.collect()

        time.sleep(1.0)
        safe_delete(persist_directory)

    # --- Build fresh ---
    os.makedirs(persist_directory, exist_ok=True)
    print(f"Creating NEW vector store: {safe_name}")

    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=2000,    # 1500 → 2000: fewer chunks = faster
        chunk_overlap=200,
        separators=["\n\n\n", "\n\n", "\n", ". ", " ", ""],
        length_function=len,
    )

    chunks = text_splitter.split_text(text)
    total = len(chunks)
    print(f"Split into {total} chunks — embedding started...")

    t = time.time()
    BATCH = 100
    if total <= BATCH:
        vector_store = Chroma.from_texts(
            texts=chunks,
            embedding=embeddings,
            persist_directory=persist_directory,
        )
    else:
        print(f"Large doc — embedding in batches of {BATCH}...")
        vector_store = Chroma.from_texts(
            texts=chunks[:BATCH],
            embedding=embeddings,
            persist_directory=persist_directory,
        )
        for i in range(BATCH, total, BATCH):
            vector_store.add_texts(chunks[i : i + BATCH])
            done = min(i + BATCH, total)
            print(f"  Embedded {done}/{total} chunks ({round(done/total*100)}%)")

    print(f"Vector store ready — {total} chunks in {round(time.time()-t, 1)}s ✓")
    return vector_store