import asyncio
import logging
import math
from typing import List

log = logging.getLogger("vector_service")

# Threshold length to consider a mood a "complex natural language query"
COMPLEX_QUERY_MIN_LEN = 15

async def generate_embeddings(texts: List[str]) -> List[List[float]]:
    """Generate embeddings for a batch of strings using text-embedding-004."""
    if not texts:
        return []
    try:
        from services.recommendation.pipeline import _get_client
        client = _get_client()
        # Ensure we pass strings
        texts = [str(t)[:1500] for t in texts] # truncate to avoid limits
        res = await client.aio.models.embed_content(
            model="text-embedding-004",
            contents=texts,
        )
        return [embedding.values for embedding in res.embeddings]
    except Exception as e:
        log.warning(f"[VECTOR] Failed to generate embeddings: {e}")
        return [[] for _ in texts]

def cosine_similarity(v1: List[float], v2: List[float]) -> float:
    """Compute the cosine similarity between two vectors."""
    if not v1 or not v2 or len(v1) != len(v2):
        return 0.0
    dot_product = sum(a * b for a, b in zip(v1, v2))
    mag1 = math.sqrt(sum(a * a for a in v1))
    mag2 = math.sqrt(sum(b * b for b in v2))
    if mag1 == 0 or mag2 == 0:
        return 0.0
    return dot_product / (mag1 * mag2)