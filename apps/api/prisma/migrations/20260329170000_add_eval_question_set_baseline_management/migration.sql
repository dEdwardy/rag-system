ALTER TABLE "EvalQuestionSet"
ADD COLUMN "currentVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "baselineSnapshotId" TEXT,
ADD COLUMN "baselineChosenAt" TIMESTAMP(3);

CREATE TABLE "EvalQuestionSetBaselineSnapshot" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "questionSetId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "questionsJson" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "EvalQuestionSetBaselineSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EvalQuestionSetBaselineSnapshot_questionSetId_version_key"
ON "EvalQuestionSetBaselineSnapshot"("questionSetId", "version");

CREATE INDEX "EvalQuestionSetBaselineSnapshot_tenantId_idx"
ON "EvalQuestionSetBaselineSnapshot"("tenantId");

CREATE INDEX "EvalQuestionSetBaselineSnapshot_ownerId_idx"
ON "EvalQuestionSetBaselineSnapshot"("ownerId");

CREATE INDEX "EvalQuestionSetBaselineSnapshot_questionSetId_idx"
ON "EvalQuestionSetBaselineSnapshot"("questionSetId");

CREATE INDEX "EvalQuestionSet_baselineSnapshotId_idx"
ON "EvalQuestionSet"("baselineSnapshotId");

ALTER TABLE "EvalQuestionSet"
ADD CONSTRAINT "EvalQuestionSet_baselineSnapshotId_fkey" FOREIGN KEY ("baselineSnapshotId") REFERENCES "EvalQuestionSetBaselineSnapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EvalQuestionSetBaselineSnapshot"
ADD CONSTRAINT "EvalQuestionSetBaselineSnapshot_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EvalQuestionSetBaselineSnapshot"
ADD CONSTRAINT "EvalQuestionSetBaselineSnapshot_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EvalQuestionSetBaselineSnapshot"
ADD CONSTRAINT "EvalQuestionSetBaselineSnapshot_questionSetId_fkey" FOREIGN KEY ("questionSetId") REFERENCES "EvalQuestionSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
