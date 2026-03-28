import { z } from "zod";

const questionPromptSchema = z.string().trim().min(1).max(2000);

export const createEvalQuestionSetSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional(),
  questions: z.array(questionPromptSchema).min(1).max(200)
});

export const updateEvalQuestionSetSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    questions: z.array(questionPromptSchema).min(1).max(200).optional()
  })
  .strict();

export const chooseEvalQuestionSetBaselineSchema = z
  .object({
    snapshotId: z.string().trim().min(1).max(191)
  })
  .strict();

export type CreateEvalQuestionSetInput = z.infer<typeof createEvalQuestionSetSchema>;
export type UpdateEvalQuestionSetInput = z.infer<typeof updateEvalQuestionSetSchema>;
export type ChooseEvalQuestionSetBaselineInput = z.infer<typeof chooseEvalQuestionSetBaselineSchema>;
