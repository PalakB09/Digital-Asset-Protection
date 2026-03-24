"""
Vector store service — ChromaDB wrapper for CLIP embedding storage and search.
"""

import chromadb
from app.config import CHROMA_DIR

# ---------------------------------------------------------------------------
# Singleton ChromaDB client + collection
# ---------------------------------------------------------------------------
_client = None
_collection = None


def _get_collection():
    """Lazy-init ChromaDB persistent client and collection."""
    global _client, _collection
    if _client is None:
        _client = chromadb.PersistentClient(path=str(CHROMA_DIR))
        _collection = _client.get_or_create_collection(
            name="asset_embeddings",
            metadata={"hnsw:space": "cosine"},
        )
    return _collection


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def add_embedding(asset_id: str, embedding: list[float]):
    """
    Store an embedding in ChromaDB, keyed by asset_id.
    """
    collection = _get_collection()
    collection.add(
        ids=[asset_id],
        embeddings=[embedding],
    )


def query_similar(embedding: list[float], top_k: int = 5) -> list[dict]:
    """
    Query ChromaDB for the most similar embeddings.
    
    Returns a list of dicts:
      [{"id": asset_id, "distance": cosine_distance}, ...]
    
    Note: ChromaDB returns cosine *distance* (1 - similarity).
    We convert to similarity for the caller.
    """
    collection = _get_collection()

    # If collection is empty, return no matches
    if collection.count() == 0:
        return []

    results = collection.query(
        query_embeddings=[embedding],
        n_results=min(top_k, collection.count()),
    )

    matches = []
    if results and results["ids"] and results["ids"][0]:
        for i, asset_id in enumerate(results["ids"][0]):
            distance = results["distances"][0][i]
            similarity = 1.0 - distance  # cosine distance → similarity
            matches.append({
                "id": asset_id,
                "similarity": similarity,
                "distance": distance,
            })

    return matches


def delete_embedding(asset_id: str):
    """Remove an embedding from ChromaDB."""
    collection = _get_collection()
    try:
        collection.delete(ids=[asset_id])
    except Exception:
        pass  # Silently ignore if not found
