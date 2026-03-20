import { z } from "zod";

export const askAssistantSchema = z.object({
  question: z.string().min(1).max(4000),
  conversationId: z.string().min(1).optional()
});

export const updateAssistantSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(500).nullable().optional(),
  systemPrompt: z.string().min(1).max(4000).optional(),
  retrievalProfileId: z.string().min(1).optional(),
  status: z.enum(["active", "inactive"]).optional()
});

export type AskAssistantInput = z.infer<typeof askAssistantSchema>;
export type UpdateAssistantInput = z.infer<typeof updateAssistantSchema>;
