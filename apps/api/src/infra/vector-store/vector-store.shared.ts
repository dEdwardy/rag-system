import type { EmbeddingProvider, EmbeddingVector } from "../embedding/embedding-runtime-config";
import type { RetrievalProfileFilters } from "../../modules/retrieval-profiles/retrieval-profile.schemas";
import type {
  IndexedEmbeddingDiagnostics,
  ReplaceDocumentVectorsInput,
  VectorStoreEmbeddingDiagnostics,
  VectorStoreRecord
} from "./vector-store.types";
import { VectorStoreCompatibilityError } from "./vector-store.types";

export function matchesVectorStoreFilters(record: VectorStoreRecord, filters?: RetrievalProfileFilters) {
  if (!filters) {
    return true;
  }

  if (filters.documentIds?.include && !filters.documentIds.include.includes(record.documentId)) {
    return false;
  }

  if (filters.documentIds?.exclude && filters.documentIds.exclude.includes(record.documentId)) {
    return false;
  }

  const sectionTitle = record.sectionTitle ?? "";
  const sectionTitleIncludes = filters.sectionTitles?.include;
  const sectionTitleContains = filters.sectionTitles?.contains;
  if (sectionTitleIncludes || sectionTitleContains) {
    const matchesInclude = sectionTitleIncludes?.includes(sectionTitle) ?? false;
    const normalizedSectionTitle = sectionTitle.toLowerCase();
    const matchesContains =
      sectionTitleContains?.some(value => normalizedSectionTitle.includes(value.toLowerCase())) ?? false;

    if (!matchesInclude && !matchesContains) {
      return false;
    }
  }

  if (filters.sectionTitles?.exclude && filters.sectionTitles.exclude.includes(sectionTitle)) {
    return false;
  }

  if (filters.pageNumbers?.exclude && record.pageNo != null && filters.pageNumbers.exclude.includes(record.pageNo)) {
    return false;
  }

  if (
    filters.pageNumbers?.include ||
    filters.pageNumbers?.min !== undefined ||
    filters.pageNumbers?.max !== undefined
  ) {
    if (record.pageNo == null) {
      return false;
    }

    const matchesInclude = filters.pageNumbers.include?.includes(record.pageNo) ?? false;
    const matchesRange =
      (filters.pageNumbers.min === undefined || record.pageNo >= filters.pageNumbers.min) &&
      (filters.pageNumbers.max === undefined || record.pageNo <= filters.pageNumbers.max);

    if (!matchesInclude && !matchesRange) {
      return false;
    }
  }

  return true;
}

export function summarizeUpsertEmbeddings(input: ReplaceDocumentVectorsInput) {
  if (input.records.length === 0) {
    return null;
  }

  const uniqueConfigs = new Map<string, EmbeddingVector>();

  for (const record of input.records) {
    uniqueConfigs.set(createEmbeddingConfigKey(record.embedding.modelName, record.embedding.dimensions), record.embedding);
  }

  if (uniqueConfigs.size > 1) {
    throw new VectorStoreCompatibilityError(
      `Embedding index compatibility error for knowledge base "${input.kbId}": document "${input.documentId}" resolved multiple embedding configs in one indexing batch (${[
        ...uniqueConfigs.values()
      ]
        .map(embedding => formatEmbeddingConfig(embedding.modelName, embedding.dimensions))
        .join(", ")}). Indexing requires one embedding config per knowledge base.`
    );
  }

  const [embedding] = [...uniqueConfigs.values()];
  return buildActiveEmbeddingDiagnostics(embedding);
}

export function summarizeIndexedEmbedding(records: VectorStoreRecord[], kbId: string): IndexedEmbeddingDiagnostics | null {
  if (records.length === 0) {
    return null;
  }

  const uniqueConfigs = new Map<
    string,
    {
      provider: EmbeddingProvider;
      model: string;
      modelName: string;
      dimensions: number;
      recordCount: number;
      documentIds: Set<string>;
    }
  >();

  for (const record of records) {
    const parsed = parseEmbeddingModelName(record.modelName, kbId);
    const key = createEmbeddingConfigKey(record.modelName, record.dimensions);
    const existing = uniqueConfigs.get(key);

    if (existing) {
      existing.recordCount += 1;
      existing.documentIds.add(record.documentId);
      continue;
    }

    uniqueConfigs.set(key, {
      provider: parsed.provider,
      model: parsed.model,
      modelName: record.modelName,
      dimensions: record.dimensions,
      recordCount: 1,
      documentIds: new Set([record.documentId])
    });
  }

  if (uniqueConfigs.size > 1) {
    throw new VectorStoreCompatibilityError(
      `Embedding index compatibility error for knowledge base "${kbId}": indexed vectors contain multiple embedding configs (${[
        ...uniqueConfigs.values()
      ]
        .map(config => `${formatEmbeddingConfig(config.modelName, config.dimensions)} x${config.recordCount}`)
        .join(", ")}). Retrieval and indexing require one embedding config per knowledge base. Reindex the affected documents before continuing.`
    );
  }

  const [config] = [...uniqueConfigs.values()];
  return {
    provider: config.provider,
    model: config.model,
    modelName: config.modelName,
    dimensions: config.dimensions,
    fallbackState: config.provider === "fallback" ? "local_deterministic" : "none",
    recordCount: config.recordCount,
    documentCount: config.documentIds.size
  };
}

export function buildEmbeddingDiagnostics(
  queryEmbedding: EmbeddingVector,
  indexedEmbedding: IndexedEmbeddingDiagnostics | null
): VectorStoreEmbeddingDiagnostics {
  return {
    active: buildActiveEmbeddingDiagnostics(queryEmbedding),
    indexed: indexedEmbedding
  };
}

export function buildActiveEmbeddingDiagnostics(embedding: EmbeddingVector): VectorStoreEmbeddingDiagnostics["active"] {
  return {
    provider: embedding.provider,
    model: embedding.model,
    modelName: embedding.modelName,
    dimensions: embedding.dimensions,
    modelSource: embedding.provenance.modelSource,
    dimensionsSource: embedding.provenance.dimensionsSource,
    fallbackState: embedding.provenance.fallback
  };
}

export function assertCompatibleEmbeddingConfigs(input: {
  kbId: string;
  active: VectorStoreEmbeddingDiagnostics["active"];
  indexed: IndexedEmbeddingDiagnostics;
  action: "indexing" | "retrieval";
  diagnostics?: VectorStoreEmbeddingDiagnostics;
}) {
  const sameModel = input.active.modelName === input.indexed.modelName;
  const sameDimensions = input.active.dimensions === input.indexed.dimensions;

  if (sameModel && sameDimensions) {
    return;
  }

  const actionLabel = input.action === "indexing" ? "Active indexing embedding config" : "Active retrieval embedding config";
  throw new VectorStoreCompatibilityError(
    `Embedding index compatibility error for knowledge base "${input.kbId}": ${actionLabel} ${formatEmbeddingConfig(
      input.active.modelName,
      input.active.dimensions
    )} (fallback=${input.active.fallbackState}) is incompatible with indexed vectors ${formatEmbeddingConfig(
      input.indexed.modelName,
      input.indexed.dimensions
    )} across ${input.indexed.documentCount} document(s). Reindex this knowledge base with one embedding config before continuing.`,
    input.diagnostics ?? {
      active: input.active,
      indexed: input.indexed
    }
  );
}

export function shouldReplaceIndexedFallbackDuringIndexing(input: {
  active: VectorStoreEmbeddingDiagnostics["active"];
  indexed: IndexedEmbeddingDiagnostics;
}) {
  return input.active.provider !== "fallback" && input.indexed.provider === "fallback";
}

export function parseEmbeddingModelName(modelName: string, kbId: string) {
  const separatorIndex = modelName.indexOf(":");
  const provider = separatorIndex > 0 ? modelName.slice(0, separatorIndex) : null;
  const model = separatorIndex > 0 ? modelName.slice(separatorIndex + 1) : null;

  if (!provider || !model || !isEmbeddingProvider(provider)) {
    throw new VectorStoreCompatibilityError(
      `Embedding index compatibility error for knowledge base "${kbId}": indexed vectors contain an invalid embedding model name "${modelName}".`
    );
  }

  return {
    provider,
    model
  };
}

function isEmbeddingProvider(value: string): value is EmbeddingProvider {
  return value === "ollama" || value === "openai" || value === "fallback";
}

function createEmbeddingConfigKey(modelName: string, dimensions: number) {
  return `${modelName}::${dimensions}`;
}

function formatEmbeddingConfig(modelName: string, dimensions: number) {
  return `${modelName} (${dimensions}d)`;
}
