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


def _get_client():
    """Lazy-init shared ChromaDB persistent client."""
    global _client
    if _client is None:
        _client = chromadb.PersistentClient(path=str(CHROMA_DIR))
    return _client


def _get_collection():
    """Lazy-init image asset embeddings collection."""
    global _collection
    if _collection is None:
        _collection = _get_client().get_or_create_collection(
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


# ---------------------------------------------------------------------------
# Video frame collection (separate from image embeddings)
# ---------------------------------------------------------------------------
_video_collection = None


def _get_video_collection():
    """Lazy-init video frame embeddings collection."""
    global _video_collection
    if _video_collection is None:
        _video_collection = _get_client().get_or_create_collection(
            name="video_frame_embeddings",
            metadata={"hnsw:space": "cosine"},
        )
    return _video_collection


def add_video_frames(asset_id: str, embeddings: list):
    """
    Store all frame embeddings for a video asset.
    IDs: {asset_id}_frame_0, {asset_id}_frame_1, ...
    Metadata records asset_id for filtering during search.
    """
    collection = _get_video_collection()
    ids = [f"{asset_id}_frame_{i}" for i in range(len(embeddings))]
    metadatas = [{"asset_id": asset_id, "frame_idx": i} for i in range(len(embeddings))]
    collection.add(ids=ids, embeddings=embeddings, metadatas=metadatas)


def query_video_frames(embedding: list, top_k: int = 30) -> list:
    """
    Query the video frame collection for similar frames.
    Returns list of dicts: [{"id": ..., "asset_id": ..., "similarity": ...}, ...]
    """
    collection = _get_video_collection()
    if collection.count() == 0:
        return []

    results = collection.query(
        query_embeddings=[embedding],
        n_results=min(top_k, collection.count()),
        include=["distances", "metadatas"],
    )

    matches = []
    if results and results["ids"] and results["ids"][0]:
        for i, doc_id in enumerate(results["ids"][0]):
            distance = results["distances"][0][i]
            meta = results["metadatas"][0][i]
            matches.append({
                "id": doc_id,
                "asset_id": meta.get("asset_id", ""),
                "similarity": 1.0 - distance,
            })
    return matches


def delete_video_frames(asset_id: str, frame_count: int):
    """Remove all frame embeddings for a video asset."""
    collection = _get_video_collection()
    ids = [f"{asset_id}_frame_{i}" for i in range(frame_count)]
    existing = [i for i in ids]
    try:
        collection.delete(ids=existing)
    except Exception:
        pass
