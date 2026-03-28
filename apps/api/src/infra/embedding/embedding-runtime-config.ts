const DEFAULT_OPENAI_EMBEDDING_MODEL = "text-embedding-3-small";
const DEFAULT_OPENAI_EMBEDDING_DIMENSIONS = 1536;
const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";
const FALLBACK_EMBEDDING_MODEL = "hash-v1";
const FALLBACK_EMBEDDING_DIMENSIONS = 256;

const OPENAI_EMBEDDING_DIMENSIONS_BY_MODEL: Record<string, number> = {
  "text-embedding-3-small": DEFAULT_OPENAI_EMBEDDING_DIMENSIONS,
  "text-embedding-3-large": 3072,
  "text-embedding-ada-002": 1536
};

export type EmbeddingProvider = "ollama" | "openai" | "fallback";

export type EmbeddingModelSource =
  | "env:OLLAMA_EMBEDDING_MODEL"
  | "env:OLLAMA_MODEL"
  | "env:OPENAI_EMBEDDING_MODEL"
  | "default:OPENAI_EMBEDDING_MODEL"
  | "builtin:fallback";

export type EmbeddingDimensionsSource = "provider_response" | "builtin:fallback";

export type EmbeddingFallbackState = "none" | "local_deterministic";

export type ResolvedEmbeddingConfigProvenance = {
  modelSource: EmbeddingModelSource;
  dimensionsSource: EmbeddingDimensionsSource;
  fallback: EmbeddingFallbackState;
};

export type ResolvedEmbeddingConfig = {
  provider: EmbeddingProvider;
  model: string;
  modelName: string;
  dimensions: number;
  provenance: ResolvedEmbeddingConfigProvenance;
};

export type EmbeddingVector = ResolvedEmbeddingConfig & {
  vector: number[];
};

export type OllamaEmbeddingRuntimeConfig = {
  provider: "ollama";
  baseUrl: string;
  model: string;
  modelSource: Extract<EmbeddingModelSource, "env:OLLAMA_EMBEDDING_MODEL" | "env:OLLAMA_MODEL">;
  expectedDimensions: number | null;
};

export type OpenAiEmbeddingRuntimeConfig = {
  provider: "openai";
  apiKey: string;
  apiUrl: string;
  model: string;
  modelSource: Extract<EmbeddingModelSource, "env:OPENAI_EMBEDDING_MODEL" | "default:OPENAI_EMBEDDING_MODEL">;
  expectedDimensions: number;
};

export type FallbackEmbeddingRuntimeConfig = {
  provider: "fallback";
  config: ResolvedEmbeddingConfig;
};

export type EmbeddingProviderRuntimeConfig =
  | OllamaEmbeddingRuntimeConfig
  | OpenAiEmbeddingRuntimeConfig
  | FallbackEmbeddingRuntimeConfig;

export type EmbeddingRuntimeConfig = {
  providers: EmbeddingProviderRuntimeConfig[];
};

export class EmbeddingRuntimeConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmbeddingRuntimeConfigError";
  }
}

type CreateResolvedEmbeddingConfigInput = {
  provider: EmbeddingProvider;
  model: string;
  dimensions: number;
  provenance: ResolvedEmbeddingConfigProvenance;
};

export function createResolvedEmbeddingConfig(input: CreateResolvedEmbeddingConfigInput): ResolvedEmbeddingConfig {
  return {
    provider: input.provider,
    model: input.model,
    modelName: `${input.provider}:${input.model}`,
    dimensions: input.dimensions,
    provenance: input.provenance
  };
}

export function resolveEmbeddingRuntimeConfig(env: NodeJS.ProcessEnv = process.env): EmbeddingRuntimeConfig {
  const providers: EmbeddingProviderRuntimeConfig[] = [];
  const ollamaConfig = resolveOllamaEmbeddingRuntimeConfig(env);
  const openAiConfig = resolveOpenAiEmbeddingRuntimeConfig(env);

  if (ollamaConfig) {
    providers.push(ollamaConfig);
  }

  if (openAiConfig) {
    providers.push(openAiConfig);
  }

  providers.push({
    provider: "fallback",
    config: createResolvedEmbeddingConfig({
      provider: "fallback",
      model: FALLBACK_EMBEDDING_MODEL,
      dimensions: FALLBACK_EMBEDDING_DIMENSIONS,
      provenance: {
        modelSource: "builtin:fallback",
        dimensionsSource: "builtin:fallback",
        fallback: "local_deterministic"
      }
    })
  });

  return { providers };
}

export function createResolvedEmbeddingConfigFromProviderResponse(
  providerConfig: OllamaEmbeddingRuntimeConfig | OpenAiEmbeddingRuntimeConfig,
  dimensions: number
): ResolvedEmbeddingConfig {
  const normalizedDimensions = validateResolvedEmbeddingDimensions(providerConfig, dimensions);

  return createResolvedEmbeddingConfig({
    provider: providerConfig.provider,
    model: providerConfig.model,
    dimensions: normalizedDimensions,
    provenance: {
      modelSource: providerConfig.modelSource,
      dimensionsSource: "provider_response",
      fallback: "none"
    }
  });
}

export function resolveProviderResponseDimensions(
  providerConfig: OllamaEmbeddingRuntimeConfig | OpenAiEmbeddingRuntimeConfig,
  vectors: number[][]
): number {
  const dimensions = vectors[0]?.length ?? 0;

  if (!Number.isInteger(dimensions) || dimensions <= 0) {
    throw new EmbeddingRuntimeConfigError(
      `Invalid embedding config: ${formatProviderLabel(providerConfig.provider)} model "${providerConfig.model}" returned an invalid embedding dimension (${dimensions}).`
    );
  }

  const inconsistentDimensions = [...new Set(vectors.map(vector => vector.length))];
  if (inconsistentDimensions.length > 1) {
    throw new EmbeddingRuntimeConfigError(
      `Invalid embedding config: ${formatProviderLabel(providerConfig.provider)} model "${providerConfig.model}" returned inconsistent embedding dimensions (${inconsistentDimensions.join(", ")}).`
    );
  }

  return validateResolvedEmbeddingDimensions(providerConfig, dimensions);
}

function resolveOllamaEmbeddingRuntimeConfig(env: NodeJS.ProcessEnv): OllamaEmbeddingRuntimeConfig | null {
  const baseUrl = normalizeBaseUrl(readOptionalString(env.OLLAMA_BASE_URL));
  const embeddingModel = readOptionalString(env.OLLAMA_EMBEDDING_MODEL);
  const fallbackModel = readOptionalString(env.OLLAMA_MODEL);
  const expectedDimensions = readOptionalPositiveInteger(env.OLLAMA_EMBEDDING_DIMENSIONS, "OLLAMA_EMBEDDING_DIMENSIONS");
  const model = embeddingModel ?? fallbackModel;

  if (!baseUrl && !model) {
    if (expectedDimensions != null) {
      throw new EmbeddingRuntimeConfigError(
        "Invalid embedding config: OLLAMA_EMBEDDING_DIMENSIONS is set but Ollama embedding provider is disabled. Set OLLAMA_BASE_URL and OLLAMA_EMBEDDING_MODEL (or OLLAMA_MODEL), or unset OLLAMA_EMBEDDING_DIMENSIONS."
      );
    }

    return null;
  }

  if (!baseUrl) {
    throw new EmbeddingRuntimeConfigError(
      "Invalid embedding config: OLLAMA_BASE_URL must be set when OLLAMA_EMBEDDING_MODEL or OLLAMA_MODEL is configured."
    );
  }

  if (!model) {
    throw new EmbeddingRuntimeConfigError(
      "Invalid embedding config: OLLAMA_EMBEDDING_MODEL or OLLAMA_MODEL must be set when OLLAMA_BASE_URL is configured."
    );
  }

  return {
    provider: "ollama",
    baseUrl,
    model,
    modelSource: embeddingModel ? "env:OLLAMA_EMBEDDING_MODEL" : "env:OLLAMA_MODEL",
    expectedDimensions
  };
}

function resolveOpenAiEmbeddingRuntimeConfig(env: NodeJS.ProcessEnv): OpenAiEmbeddingRuntimeConfig | null {
  const apiKey = readOptionalString(env.OPENAI_API_KEY);
  const explicitModel = readOptionalString(env.OPENAI_EMBEDDING_MODEL);
  const openAiBaseUrl = normalizeBaseUrl(readOptionalString(env.OPENAI_BASE_URL) ?? DEFAULT_OPENAI_BASE_URL);

  if (!apiKey && !explicitModel) {
    return null;
  }

  if (!apiKey) {
    throw new EmbeddingRuntimeConfigError(
      "Invalid embedding config: OPENAI_API_KEY must be set when OPENAI_EMBEDDING_MODEL is configured."
    );
  }

  const model = explicitModel ?? DEFAULT_OPENAI_EMBEDDING_MODEL;
  const expectedDimensions = OPENAI_EMBEDDING_DIMENSIONS_BY_MODEL[model];

  if (!expectedDimensions) {
    throw new EmbeddingRuntimeConfigError(
      `Invalid embedding config: OPENAI_EMBEDDING_MODEL="${model}" is unsupported. Supported values: ${Object.keys(OPENAI_EMBEDDING_DIMENSIONS_BY_MODEL).join(", ")}.`
    );
  }

  return {
    provider: "openai",
    apiKey,
    apiUrl: `${openAiBaseUrl}/embeddings`,
    model,
    modelSource: explicitModel ? "env:OPENAI_EMBEDDING_MODEL" : "default:OPENAI_EMBEDDING_MODEL",
    expectedDimensions
  };
}

function validateResolvedEmbeddingDimensions(
  providerConfig: OllamaEmbeddingRuntimeConfig | OpenAiEmbeddingRuntimeConfig,
  dimensions: number
) {
  if (providerConfig.provider !== "openai") {
    if (providerConfig.expectedDimensions != null && dimensions !== providerConfig.expectedDimensions) {
      throw new EmbeddingRuntimeConfigError(
        `Invalid embedding config: OLLAMA_EMBEDDING_DIMENSIONS=${providerConfig.expectedDimensions} but Ollama model "${providerConfig.model}" returned ${dimensions} dimensions.`
      );
    }

    return dimensions;
  }

  if (dimensions !== providerConfig.expectedDimensions) {
    const defaultModelHint =
      providerConfig.modelSource === "default:OPENAI_EMBEDDING_MODEL"
        ? ` OPENAI_EMBEDDING_MODEL is unset, so the default embedding model "${providerConfig.model}" is currently in use.`
        : "";
    const endpointHint = ` Resolved OpenAI embedding endpoint: ${providerConfig.apiUrl}.`;

    throw new EmbeddingRuntimeConfigError(
      `Invalid embedding config: OPENAI_EMBEDDING_MODEL="${providerConfig.model}" expects ${providerConfig.expectedDimensions} dimensions, but the provider returned ${dimensions}. Check OPENAI_EMBEDDING_MODEL and OPENAI_BASE_URL compatibility for the embedding endpoint.${endpointHint}${defaultModelHint}`
    );
  }

  return dimensions;
}

function readOptionalString(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function readOptionalPositiveInteger(value: string | undefined, envName: string) {
  const normalized = readOptionalString(value);

  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new EmbeddingRuntimeConfigError(
      `Invalid embedding config: ${envName} must be a positive integer when configured.`
    );
  }

  return parsed;
}

function normalizeBaseUrl(value: string | null) {
  return value ? value.replace(/\/$/, "") : null;
}

function formatProviderLabel(provider: Exclude<EmbeddingProvider, "fallback">) {
  return provider === "ollama" ? "Ollama" : "OpenAI";
}
