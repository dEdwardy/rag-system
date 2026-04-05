-- Add tenant/owner ownership fields for retrieval profiles.
ALTER TABLE "RetrievalProfile"
ADD COLUMN "tenantId" TEXT,
ADD COLUMN "ownerId" TEXT;

-- Backfill from linked assistant -> knowledge base ownership when available.
UPDATE "RetrievalProfile" AS rp
SET
  "tenantId" = kb."tenantId",
  "ownerId" = kb."ownerId"
FROM "Assistant" AS a
JOIN "KnowledgeBase" AS kb ON kb."id" = a."kbId"
WHERE a."retrievalProfileId" = rp."id"
  AND (rp."tenantId" IS NULL OR rp."ownerId" IS NULL);

-- Fallback for unlinked profiles: use the earliest user as explicit owner assignment baseline.
WITH fallback_user AS (
  SELECT u."id", u."tenantId"
  FROM "User" AS u
  ORDER BY u."createdAt" ASC, u."id" ASC
  LIMIT 1
)
UPDATE "RetrievalProfile" AS rp
SET
  "tenantId" = fu."tenantId",
  "ownerId" = fu."id"
FROM fallback_user AS fu
WHERE rp."tenantId" IS NULL OR rp."ownerId" IS NULL;

ALTER TABLE "RetrievalProfile"
ALTER COLUMN "tenantId" SET NOT NULL,
ALTER COLUMN "ownerId" SET NOT NULL;

ALTER TABLE "RetrievalProfile"
ADD CONSTRAINT "RetrievalProfile_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RetrievalProfile"
ADD CONSTRAINT "RetrievalProfile_ownerId_fkey"
FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "RetrievalProfile_tenantId_idx" ON "RetrievalProfile"("tenantId");
CREATE INDEX "RetrievalProfile_ownerId_idx" ON "RetrievalProfile"("ownerId");
