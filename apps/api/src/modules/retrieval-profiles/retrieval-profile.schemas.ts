import { z } from "zod";

export type RetrievalProfileFilters = {
  documentIds?: string[];
  sectionTitles?: string[];
  pageNumbers?: number[];
};

const optionalStringArraySchema = z
  .array(z.string().min(1))
  .optional()
  .transform(value => {
    if (!value || value.length === 0) {
      return undefined;
    }

    return Array.from(new Set(value));
  });

const optionalNumberArraySchema = z
  .array(z.number().int().nonnegative())
  .optional()
  .transform(value => {
    if (!value || value.length === 0) {
      return undefined;
    }

    return Array.from(new Set(value));
  });

export const retrievalProfileFiltersSchema: z.ZodType<RetrievalProfileFilters | undefined> = z
  .object({
    documentIds: optionalStringArraySchema,
    sectionTitles: optionalStringArraySchema,
    pageNumbers: optionalNumberArraySchema
  })
  .strict()
  .transform(value => {
    const normalized = Object.fromEntries(
      Object.entries(value).filter(([, fieldValue]) => fieldValue !== undefined)
    );

    return Object.keys(normalized).length > 0 ? normalized : undefined;
  });

export const createRetrievalProfileSchema = z.object({
  name: z.string().min(1).max(120),
  topK: z.number().int().min(1).max(20).default(3),
  chunkWindow: z.number().int().min(0).max(5).default(0),
  enableHybrid: z.boolean().default(false),
  enableRerank: z.boolean().default(false),
  scoreThreshold: z.number().min(0).max(100).default(0),
  filtersJson: retrievalProfileFiltersSchema.optional()
});

export const updateRetrievalProfileSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  topK: z.number().int().min(1).max(20).optional(),
  chunkWindow: z.number().int().min(0).max(5).optional(),
  enableHybrid: z.boolean().optional(),
  enableRerank: z.boolean().optional(),
  scoreThreshold: z.number().min(0).max(100).optional(),
  filtersJson: retrievalProfileFiltersSchema.optional()
});

export type CreateRetrievalProfileInput = z.infer<typeof createRetrievalProfileSchema>;
export type UpdateRetrievalProfileInput = z.infer<typeof updateRetrievalProfileSchema>;
