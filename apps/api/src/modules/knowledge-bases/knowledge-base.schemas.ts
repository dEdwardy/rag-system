import { z } from "zod";

export const createKnowledgeBaseSchema = z.object({
  tenantId: z.string().min(1),
  ownerId: z.string().min(1),
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional()
});

export const updateKnowledgeBaseSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(500).nullable().optional(),
  status: z.enum(["active", "inactive"]).optional()
});

export type CreateKnowledgeBaseInput = z.infer<typeof createKnowledgeBaseSchema>;
export type UpdateKnowledgeBaseInput = z.infer<typeof updateKnowledgeBaseSchema>;

