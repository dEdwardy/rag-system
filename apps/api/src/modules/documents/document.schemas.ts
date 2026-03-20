import { z } from "zod";

export const createDocumentSchema = z.object({
  sourceType: z.string().min(1).max(50),
  sourceName: z.string().min(1).max(255),
  title: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(120),
  storageKey: z.string().min(1).max(500)
});

export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;

