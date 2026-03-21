-- AlterTable
ALTER TABLE "AnswerTrace"
ADD COLUMN "retrievalMetadataJson" JSONB,
ADD COLUMN "answeringMetadataJson" JSONB;
