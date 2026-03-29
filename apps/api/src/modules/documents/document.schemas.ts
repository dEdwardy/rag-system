import { z } from "zod";

const optionalBoundedListLimitSchema = z.coerce.number().int().min(1).max(100).optional();
const boundedListLimitSchema = optionalBoundedListLimitSchema.default(20);

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

export const listKnowledgeBaseDocumentsSchema = z.object({
  limit: optionalBoundedListLimitSchema
});

export type ListKnowledgeBaseDocumentsInput = z.infer<typeof listKnowledgeBaseDocumentsSchema>;

export const listKnowledgeBaseDocumentRunsSchema = z.object({
  documentId: z.string().min(1).optional(),
  sourceType: z.string().min(1).max(50).optional(),
  status: z.enum(["pending", "processing", "ready", "failed", "skipped"]).optional(),
  trigger: z.enum(["upload", "reindex", "external_resync"]).optional(),
  issueOnly: z.coerce.boolean().optional().default(false),
  sinceHours: z.coerce.number().positive().max(24 * 30).optional(),
  includeDiagnostics: z.coerce.boolean().optional().default(false),
  limit: boundedListLimitSchema
});

export type ListKnowledgeBaseDocumentRunsInput = z.infer<typeof listKnowledgeBaseDocumentRunsSchema>;

export const listDocumentRunsSchema = z.object({
  limit: optionalBoundedListLimitSchema
});

export type ListDocumentRunsInput = z.infer<typeof listDocumentRunsSchema>;

export const compareKnowledgeBaseDocumentRunsSchema = z
  .object({
    documentId: z.string().min(1).optional(),
    sourceType: z.string().min(1).max(50).optional(),
    status: z.enum(["pending", "processing", "ready", "failed", "skipped"]).optional(),
    trigger: z.enum(["upload", "reindex", "external_resync"]).optional(),
    issueOnly: z.coerce.boolean().optional().default(false),
    leftRunId: z.string().min(1).optional(),
    rightRunId: z.string().min(1).optional(),
    leftSinceHours: z.coerce.number().positive().max(24 * 30).optional(),
    rightSinceHours: z.coerce.number().positive().max(24 * 30).optional()
  })
  .superRefine((value, ctx) => {
    const hasRunPair = typeof value.leftRunId === "string" && typeof value.rightRunId === "string";
    const hasSnapshotPair = typeof value.leftSinceHours === "number" && typeof value.rightSinceHours === "number";

    if (!hasRunPair && !hasSnapshotPair) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide either leftRunId+rightRunId or leftSinceHours+rightSinceHours."
      });
      return;
    }

    if (hasRunPair && hasSnapshotPair) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Run comparison and snapshot comparison inputs cannot be mixed."
      });
      return;
    }

    if ((value.leftRunId && !value.rightRunId) || (!value.leftRunId && value.rightRunId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "leftRunId and rightRunId must be provided together."
      });
    }

    if (
      (typeof value.leftSinceHours === "number" && typeof value.rightSinceHours !== "number") ||
      (typeof value.leftSinceHours !== "number" && typeof value.rightSinceHours === "number")
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "leftSinceHours and rightSinceHours must be provided together."
      });
    }
  });

export type CompareKnowledgeBaseDocumentRunsInput = z.infer<typeof compareKnowledgeBaseDocumentRunsSchema>;

export const listConversationTracesSchema = z.object({
  limit: boundedListLimitSchema
});

export type ListConversationTracesInput = z.infer<typeof listConversationTracesSchema>;

export const listTracesSchema = z.object({
  query: z.string().trim().min(1).max(200).optional(),
  limit: boundedListLimitSchema
});

export type ListTracesInput = z.infer<typeof listTracesSchema>;
