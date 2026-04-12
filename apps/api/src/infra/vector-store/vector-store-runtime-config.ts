export type FilesystemVectorStoreRuntimeConfig = {
  provider: "filesystem";
};

export type PgVectorStoreRuntimeConfig = {
  provider: "pgvector";
  tableName: string;
  dimensions: number;
};

export type VectorStoreRuntimeConfig = FilesystemVectorStoreRuntimeConfig | PgVectorStoreRuntimeConfig;

export class VectorStoreRuntimeConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VectorStoreRuntimeConfigError";
  }
}

export function resolveVectorStoreRuntimeConfig(env: NodeJS.ProcessEnv = process.env): VectorStoreRuntimeConfig {
  const provider = env.VECTOR_STORE_PROVIDER?.trim() || "pgvector";

  if (provider === "filesystem") {
    return { provider };
  }

  if (provider !== "pgvector") {
    throw new VectorStoreRuntimeConfigError(
      `Unsupported vector store provider "${provider}". Expected "filesystem" or "pgvector".`
    );
  }

  const tableName = env.VECTOR_STORE_PGVECTOR_TABLE?.trim() || "ChunkEmbedding";
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(tableName)) {
    throw new VectorStoreRuntimeConfigError(
      `Invalid VECTOR_STORE_PGVECTOR_TABLE value "${tableName}". Use a valid SQL identifier.`
    );
  }

  const rawDimensions = env.VECTOR_STORE_PGVECTOR_DIMENSIONS?.trim() || "1024";
  const dimensions = Number.parseInt(rawDimensions, 10);
  if (!Number.isInteger(dimensions) || dimensions <= 0) {
    throw new VectorStoreRuntimeConfigError(
      `Invalid VECTOR_STORE_PGVECTOR_DIMENSIONS value "${rawDimensions}". Expected a positive integer.`
    );
  }

  return {
    provider,
    tableName,
    dimensions
  };
}
