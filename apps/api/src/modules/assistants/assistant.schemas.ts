import { z } from "zod";

export const askAssistantSchema = z.object({
  question: z.string().min(1).max(4000),
  conversationId: z.string().min(1).optional()
});

export const answerPolicySchema = z.object({
  responseStyle: z.enum(["concise", "detailed"]),
  citationMode: z.enum(["required", "optional"]),
  maxCitations: z.number().int().min(1).max(8),
  noAnswerBehavior: z.enum(["say_insufficient_context", "best_effort"])
});

export const updateAssistantSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(500).nullable().optional(),
  systemPrompt: z.string().min(1).max(4000).optional(),
  retrievalProfileId: z.string().min(1).optional(),
  answerPolicyJson: answerPolicySchema.nullable().optional(),
  status: z.enum(["active", "inactive"]).optional()
});

export type AskAssistantInput = z.infer<typeof askAssistantSchema>;
export type AnswerPolicyInput = z.infer<typeof answerPolicySchema>;
export type UpdateAssistantInput = z.infer<typeof updateAssistantSchema>;
