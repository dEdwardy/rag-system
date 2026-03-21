import { z } from "zod";

type IncludeExcludeFilter<T> = {
  include?: T[];
  exclude?: T[];
};

type StringStrategyFilter = IncludeExcludeFilter<string> & {
  contains?: string[];
};

type NumberStrategyFilter = IncludeExcludeFilter<number> & {
  min?: number;
  max?: number;
};

export type RetrievalProfileFilters = {
  documentIds?: IncludeExcludeFilter<string>;
  sectionTitles?: StringStrategyFilter;
  pageNumbers?: NumberStrategyFilter;
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

const optionalNumberSchema = z.number().int().nonnegative().optional();

const normalizeObject = <T extends Record<string, unknown>>(value: T) => {
  const normalized = Object.fromEntries(
    Object.entries(value).filter(([, fieldValue]) => fieldValue !== undefined)
  );

  return Object.keys(normalized).length > 0 ? normalized : undefined;
};

const documentIdStrategySchema = z
  .object({
    include: optionalStringArraySchema,
    exclude: optionalStringArraySchema
  })
  .strict()
  .transform(value => normalizeObject(value));

const sectionTitleStrategySchema = z
  .object({
    include: optionalStringArraySchema,
    exclude: optionalStringArraySchema,
    contains: optionalStringArraySchema
  })
  .strict()
  .transform(value => normalizeObject(value));

const pageNumberStrategySchema = z
  .object({
    include: optionalNumberArraySchema,
    exclude: optionalNumberArraySchema,
    min: optionalNumberSchema,
    max: optionalNumberSchema
  })
  .strict()
  .refine(value => value.min === undefined || value.max === undefined || value.min <= value.max, {
    message: "pageNumbers.min must be less than or equal to pageNumbers.max"
  })
  .transform(value => normalizeObject(value));

const documentIdsFilterSchema = z
  .union([optionalStringArraySchema, documentIdStrategySchema])
  .optional()
  .transform(value => {
    if (Array.isArray(value)) {
      return value.length > 0 ? { include: value } : undefined;
    }

    return value;
  });

const sectionTitlesFilterSchema = z
  .union([optionalStringArraySchema, sectionTitleStrategySchema])
  .optional()
  .transform(value => {
    if (Array.isArray(value)) {
      return value.length > 0 ? { include: value } : undefined;
    }

    return value;
  });

const pageNumbersFilterSchema = z
  .union([optionalNumberArraySchema, pageNumberStrategySchema])
  .optional()
  .transform(value => {
    if (Array.isArray(value)) {
      return value.length > 0 ? { include: value } : undefined;
    }

    return value;
  });

export const retrievalProfileFiltersSchema = z
  .object({
    documentIds: documentIdsFilterSchema,
    sectionTitles: sectionTitlesFilterSchema,
    pageNumbers: pageNumbersFilterSchema
  })
  .strict()
  .transform(value => normalizeObject(value) as RetrievalProfileFilters | undefined);

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
