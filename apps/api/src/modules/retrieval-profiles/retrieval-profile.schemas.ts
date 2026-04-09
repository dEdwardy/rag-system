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

type RetrievalMode = "vector" | "hybrid" | "lexical";

export type RetrievalStrategy = {
  queryRewrite?: {
    enabled?: boolean;
  };
  candidateSelection?: {
    mode?: RetrievalMode;
    candidateMultiplier?: number;
    minCandidates?: number;
  };
  hybrid?: {
    vectorWeight?: number;
    lexicalWeight?: number;
  };
  rerank?: {
    enabled?: boolean;
  };
};

export type ResolvedRetrievalStrategy = {
  queryRewrite: {
    enabled: boolean;
  };
  candidateSelection: {
    mode: RetrievalMode;
    candidateMultiplier: number;
    minCandidates: number;
  };
  hybrid: {
    vectorWeight: number;
    lexicalWeight: number;
  };
  rerank: {
    enabled: boolean;
  };
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

const queryRewriteStrategySchema = z
  .object({
    enabled: z.boolean().optional()
  })
  .strict()
  .transform(value => normalizeObject(value));

const candidateSelectionStrategySchema = z
  .object({
    mode: z.enum(["vector", "hybrid", "lexical"]).optional(),
    candidateMultiplier: z.number().int().min(1).max(10).optional(),
    minCandidates: z.number().int().min(1).max(100).optional()
  })
  .strict()
  .transform(value => normalizeObject(value));

const hybridStrategySchema = z
  .object({
    vectorWeight: z.number().min(0).max(1).optional(),
    lexicalWeight: z.number().min(0).max(1).optional()
  })
  .strict()
  .refine(
    value => (value.vectorWeight ?? 0) + (value.lexicalWeight ?? 0) > 0 || Object.keys(value).length === 0,
    {
      message: "hybrid.vectorWeight and hybrid.lexicalWeight cannot both be zero"
    }
  )
  .transform(value => normalizeObject(value));

const rerankStrategySchema = z
  .object({
    enabled: z.boolean().optional()
  })
  .strict()
  .transform(value => normalizeObject(value));

export const retrievalStrategySchema = z
  .object({
    queryRewrite: queryRewriteStrategySchema.optional(),
    candidateSelection: candidateSelectionStrategySchema.optional(),
    hybrid: hybridStrategySchema.optional(),
    rerank: rerankStrategySchema.optional()
  })
  .strict()
  .transform(value => normalizeObject(value) as RetrievalStrategy | undefined);

export const createRetrievalProfileSchema = z.object({
  name: z.string().min(1).max(120),
  topK: z.number().int().min(1).max(20).default(3),
  chunkWindow: z.number().int().min(0).max(5).default(0),
  enableHybrid: z.boolean().default(false),
  enableRerank: z.boolean().default(false),
  scoreThreshold: z.number().min(0).max(100).default(0),
  filtersJson: retrievalProfileFiltersSchema.optional(),
  strategyJson: retrievalStrategySchema.optional()
});

export const updateRetrievalProfileSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  topK: z.number().int().min(1).max(20).optional(),
  chunkWindow: z.number().int().min(0).max(5).optional(),
  enableHybrid: z.boolean().optional(),
  enableRerank: z.boolean().optional(),
  scoreThreshold: z.number().min(0).max(100).optional(),
  filtersJson: retrievalProfileFiltersSchema.nullable().optional(),
  strategyJson: retrievalStrategySchema.nullable().optional()
});

export function resolveRetrievalStrategy(input: {
  topK: number;
  enableHybrid?: boolean | null;
  enableRerank?: boolean | null;
  strategyJson?: RetrievalStrategy | null;
}): ResolvedRetrievalStrategy {
  const normalizedStrategy = retrievalStrategySchema.optional().parse(input.strategyJson ?? undefined);
  const hasStrategyOverride = normalizedStrategy !== undefined;

  return {
    queryRewrite: {
      enabled: normalizedStrategy?.queryRewrite?.enabled ?? false
    },
    candidateSelection: {
      mode:
        normalizedStrategy?.candidateSelection?.mode ??
        (hasStrategyOverride ? "vector" : input.enableHybrid ? "hybrid" : "vector"),
      candidateMultiplier: normalizedStrategy?.candidateSelection?.candidateMultiplier ?? 3,
      minCandidates: normalizedStrategy?.candidateSelection?.minCandidates ?? input.topK
    },
    hybrid: {
      vectorWeight: normalizedStrategy?.hybrid?.vectorWeight ?? 0.7,
      lexicalWeight: normalizedStrategy?.hybrid?.lexicalWeight ?? 0.3
    },
    rerank: {
      enabled: normalizedStrategy?.rerank?.enabled ?? (hasStrategyOverride ? false : Boolean(input.enableRerank))
    }
  };
}

export type CreateRetrievalProfileInput = z.infer<typeof createRetrievalProfileSchema>;
export type UpdateRetrievalProfileInput = z.infer<typeof updateRetrievalProfileSchema>;
