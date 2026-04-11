import { z } from "zod";

const trimmedOptionalString = z
  .string()
  .optional()
  .transform(value => {
    const normalized = value?.trim();
    return normalized ? normalized : undefined;
  });

const criticalEnvSchema = z
  .object({
    DATABASE_URL: trimmedOptionalString,

    SUPABASE_URL: trimmedOptionalString,
    SUPABASE_SERVICE_ROLE_KEY: trimmedOptionalString,
    SUPABASE_STORAGE_BUCKET_UPLOADS: trimmedOptionalString,
    SUPABASE_STORAGE_BUCKET_GENERATED: trimmedOptionalString,
    QUEUE_PROVIDER: z.enum(["database", "pgmq"]).optional().default("pgmq"),
    VECTOR_STORE_PROVIDER: z.enum(["filesystem", "pgvector"]).optional().default("pgvector"),
    OLLAMA_BASE_URL: trimmedOptionalString,
    OLLAMA_MODEL: trimmedOptionalString,
    OLLAMA_EMBEDDING_MODEL: trimmedOptionalString,
    OPENAI_API_KEY: trimmedOptionalString,
    OPENAI_EMBEDDING_MODEL: trimmedOptionalString
  })
  .superRefine((env, ctx) => {
    if (!env.DATABASE_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["DATABASE_URL"],
        message: "DATABASE_URL is required."
      });
    }

    const supabaseStorageFields = [
      ["SUPABASE_URL", env.SUPABASE_URL],
      ["SUPABASE_SERVICE_ROLE_KEY", env.SUPABASE_SERVICE_ROLE_KEY],
      ["SUPABASE_STORAGE_BUCKET_UPLOADS", env.SUPABASE_STORAGE_BUCKET_UPLOADS],
      ["SUPABASE_STORAGE_BUCKET_GENERATED", env.SUPABASE_STORAGE_BUCKET_GENERATED]
    ] as const;

    // Always require Supabase storage
    for (const [key, value] of supabaseStorageFields) {
      if (!value) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: `${key} is required for Supabase Storage.`
        });
      }
    }

    if (env.SUPABASE_URL) {
      const urlResult = z.string().url().safeParse(env.SUPABASE_URL);
      if (!urlResult.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["SUPABASE_URL"],
          message: "SUPABASE_URL must be a valid URL."
        });
      }
    }

    const hasAnyOllamaField = Boolean(env.OLLAMA_BASE_URL || env.OLLAMA_MODEL || env.OLLAMA_EMBEDDING_MODEL);
    if (hasAnyOllamaField) {
      if (!env.OLLAMA_BASE_URL) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["OLLAMA_BASE_URL"],
          message: "OLLAMA_BASE_URL is required when Ollama model settings are configured."
        });
      }

      if (!env.OLLAMA_MODEL && !env.OLLAMA_EMBEDDING_MODEL) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["OLLAMA_MODEL"],
          message: "Set OLLAMA_MODEL or OLLAMA_EMBEDDING_MODEL when OLLAMA_BASE_URL is configured."
        });
      }
    }

    if (env.OPENAI_EMBEDDING_MODEL && !env.OPENAI_API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["OPENAI_API_KEY"],
        message: "OPENAI_API_KEY is required when OPENAI_EMBEDDING_MODEL is configured."
      });
    }
  });

export class CriticalEnvValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CriticalEnvValidationError";
  }
}

export function validateCriticalRuntimeEnv(env: NodeJS.ProcessEnv = process.env) {
  const result = criticalEnvSchema.safeParse(env);

  if (result.success) {
    return result.data;
  }

  const issues = result.error.issues.map(issue => {
    const path = issue.path.length > 0 ? issue.path.join(".") : "env";
    return `${path}: ${issue.message}`;
  });

  throw new CriticalEnvValidationError(`Invalid runtime environment:\n- ${issues.join("\n- ")}`);
}
