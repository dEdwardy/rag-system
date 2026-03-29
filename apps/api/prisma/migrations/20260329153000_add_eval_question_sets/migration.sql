CREATE TYPE "EvalQuestionSetStatus" AS ENUM ('draft', 'locked', 'archived');

CREATE TABLE "EvalQuestionSet" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "questionsJson" JSONB NOT NULL,
  "status" "EvalQuestionSetStatus" NOT NULL DEFAULT 'draft',
  "lockedAt" TIMESTAMP(3),
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "EvalQuestionSet_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EvalQuestionSet_tenantId_idx" ON "EvalQuestionSet"("tenantId");

CREATE INDEX "EvalQuestionSet_ownerId_idx" ON "EvalQuestionSet"("ownerId");

CREATE INDEX "EvalQuestionSet_status_idx" ON "EvalQuestionSet"("status");

ALTER TABLE "EvalQuestionSet"
ADD CONSTRAINT "EvalQuestionSet_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EvalQuestionSet"
ADD CONSTRAINT "EvalQuestionSet_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
