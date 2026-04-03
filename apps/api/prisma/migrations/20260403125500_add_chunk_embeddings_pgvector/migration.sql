CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE "ChunkEmbedding" (
  "id" TEXT NOT NULL,
  "kbId" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "chunkId" TEXT NOT NULL,
  "chunkIndex" INTEGER NOT NULL,
  "sectionTitle" TEXT,
  "pageNo" INTEGER,
  "content" TEXT NOT NULL,
  "modelName" TEXT NOT NULL,
  "dimensions" INTEGER NOT NULL,
  "metadataJson" JSONB,
  "embedding" vector(768) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ChunkEmbedding_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ChunkEmbedding_kbId_idx" ON "ChunkEmbedding"("kbId");
CREATE INDEX "ChunkEmbedding_documentId_idx" ON "ChunkEmbedding"("documentId");
CREATE INDEX "ChunkEmbedding_kbId_modelName_dimensions_idx" ON "ChunkEmbedding"("kbId", "modelName", "dimensions");
