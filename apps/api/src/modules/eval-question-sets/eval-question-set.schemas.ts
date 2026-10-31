import { z } from "zod";

const questionPromptSchema = z.string().trim().min(1).max(2000);

const expectedIdSchema = z.string().trim().min(1).max(191);

/**
 * A question is either a plain prompt (the historical shape, still accepted) or
 * a prompt plus the evidence it is expected to retrieve. Expectations are
 * optional because most existing question sets do not declare any.
 */
const questionEntrySchema = z.union([
  questionPromptSchema,
  z
    .object({
      question: questionPromptSchema,
      expectedDocumentIds: z.array(expectedIdSchema).max(50).optional(),
      expectedChunkIds: z.array(expectedIdSchema).max(200).optional()
    })
    .strict()
]);

export const createEvalQuestionSetSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional(),
  questions: z.array(questionEntrySchema).min(1).max(200)
});

export const updateEvalQuestionSetSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    questions: z.array(questionEntrySchema).min(1).max(200).optional()
  })
  .strict();

export const chooseEvalQuestionSetBaselineSchema = z
  .object({
    snapshotId: z.string().trim().min(1).max(191)
  })
  .strict();

export const runEvalQuestionSetSchema = z
  .object({
    assistantId: z.string().trim().min(1).max(191),
    baselineSnapshotId: z.string().trim().min(1).max(191).optional(),
    qualityGateMode: z.enum(["warn", "fail"]).optional()
  })
  .strict();

export type CreateEvalQuestionSetInput = z.infer<typeof createEvalQuestionSetSchema>;
export type UpdateEvalQuestionSetInput = z.infer<typeof updateEvalQuestionSetSchema>;
export type ChooseEvalQuestionSetBaselineInput = z.infer<typeof chooseEvalQuestionSetBaselineSchema>;
export type RunEvalQuestionSetInput = z.infer<typeof runEvalQuestionSetSchema>;
