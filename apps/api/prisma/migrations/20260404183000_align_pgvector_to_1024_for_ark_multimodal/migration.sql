TRUNCATE TABLE "ChunkEmbedding";

ALTER TABLE "ChunkEmbedding"
  ALTER COLUMN "embedding" TYPE vector(1024);
