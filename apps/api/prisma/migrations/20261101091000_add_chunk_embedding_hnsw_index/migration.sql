-- Approximate nearest-neighbour index for pgvector retrieval.
-- Cosine distance matches the vector search ordering used at runtime.
CREATE INDEX IF NOT EXISTS "ChunkEmbedding_embedding_hnsw_idx"
ON "ChunkEmbedding"
USING hnsw ("embedding" vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
