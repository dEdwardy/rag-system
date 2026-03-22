import { z } from "zod";

export const createDocumentSchema = z.object({
  sourceType: z.string().min(1).max(50),
  sourceName: z.string().min(1).max(255),
  title: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(120),
  storageKey: z.string().min(1).max(500)
});

export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;

export const createWebPageDocumentSchema = z.object({
  url: z
    .string()
    .url()
    .refine(value => {
      const parsed = new URL(value);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    }, "URL must use http or https."),
  title: z.string().min(1).max(255).optional()
});

export type CreateWebPageDocumentInput = z.infer<typeof createWebPageDocumentSchema>;

export const createFeedDocumentSchema = z.object({
  url: z
    .string()
    .url()
    .refine(value => {
      const parsed = new URL(value);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    }, "URL must use http or https."),
  title: z.string().min(1).max(255).optional(),
  maxItems: z.number().int().min(1).max(50).optional().default(20)
});

export type CreateFeedDocumentInput = z.infer<typeof createFeedDocumentSchema>;

export const createSitemapDocumentSchema = z.object({
  url: z
    .string()
    .url()
    .refine(value => {
      const parsed = new URL(value);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    }, "URL must use http or https."),
  title: z.string().min(1).max(255).optional(),
  maxPages: z.number().int().min(1).max(50).optional().default(20)
});

export type CreateSitemapDocumentInput = z.infer<typeof createSitemapDocumentSchema>;

export const listKnowledgeBaseDocumentRunsSchema = z.object({
  documentId: z.string().min(1).optional(),
  sourceType: z.string().min(1).max(50).optional(),
  status: z.enum(["pending", "processing", "ready", "failed", "skipped"]).optional(),
  trigger: z.enum(["upload", "reindex", "external_resync"]).optional(),
  sinceHours: z.coerce.number().positive().max(24 * 30).optional(),
  includeDiagnostics: z.coerce.boolean().optional().default(false),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20)
});

export type ListKnowledgeBaseDocumentRunsInput = z.infer<typeof listKnowledgeBaseDocumentRunsSchema>;
