ALTER TABLE "EvalQuestionSet"
ADD COLUMN "pinnedBaselineResultJson" JSONB,
ADD COLUMN "pinnedBaselineCapturedAt" TIMESTAMP(3),
ADD COLUMN "latestEvalResultSummaryJson" JSONB,
ADD COLUMN "latestEvalRanAt" TIMESTAMP(3);
