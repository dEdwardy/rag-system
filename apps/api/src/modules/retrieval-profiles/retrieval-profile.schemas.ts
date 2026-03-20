import { z } from "zod";

export const createRetrievalProfileSchema = z.object({
  name: z.string().min(1).max(120),
  topK: z.number().int().min(1).max(20).default(3),
  chunkWindow: z.number().int().min(0).max(5).default(0),
  enableHybrid: z.boolean().default(false),
  enableRerank: z.boolean().default(false),
  scoreThreshold: z.number().min(0).max(100).default(0)
});

export const updateRetrievalProfileSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  topK: z.number().int().min(1).max(20).optional(),
  chunkWindow: z.number().int().min(0).max(5).optional(),
  enableHybrid: z.boolean().optional(),
  enableRerank: z.boolean().optional(),
  scoreThreshold: z.number().min(0).max(100).optional()
});

export type CreateRetrievalProfileInput = z.infer<typeof createRetrievalProfileSchema>;
export type UpdateRetrievalProfileInput = z.infer<typeof updateRetrievalProfileSchema>;

