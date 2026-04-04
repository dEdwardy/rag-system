import { Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import {
  createResolvedEmbeddingConfigFromProviderResponse,
  EmbeddingRuntimeConfigError,
  EmbeddingVector,
  FallbackEmbeddingRuntimeConfig,
  OllamaEmbeddingRuntimeConfig,
  OpenAiEmbeddingRuntimeConfig,
  resolveEmbeddingRuntimeConfig,
  resolveProviderResponseDimensions
} from "./embedding-runtime-config";

@Injectable()
export class EmbeddingService {
  async embedTexts(texts: string[]): Promise<EmbeddingVector[]> {
    const normalizedTexts = texts.map(text => text.trim());

    if (normalizedTexts.length === 0) {
      return [];
    }

    const runtimeConfig = resolveEmbeddingRuntimeConfig();

    for (const providerConfig of runtimeConfig.providers) {
      if (providerConfig.provider === "ollama") {
        try {
          return await this.embedWithOllama(providerConfig, normalizedTexts);
        } catch (error) {
          if (error instanceof EmbeddingRuntimeConfigError) {
            throw error;
          }

          // Keep ingestion and retrieval available when local model is not ready.
          continue;
        }
      }

      if (providerConfig.provider === "openai") {
        try {
          return await this.embedWithOpenAI(providerConfig, normalizedTexts);
        } catch (error) {
          if (error instanceof EmbeddingRuntimeConfigError) {
            throw error;
          }

          // Fall through to deterministic local embedding.
          continue;
        }
      }

      return normalizedTexts.map(text => this.buildFallbackEmbedding(text, providerConfig));
    }

    throw new Error("Embedding runtime resolution returned no embedding provider.");
  }

  async embedQuery(text: string): Promise<EmbeddingVector> {
    const [embedding] = await this.embedTexts([text]);

    if (!embedding) {
      throw new Error("Embedding query resolution returned no embedding.");
    }

    return embedding;
  }

  private async embedWithOllama(providerConfig: OllamaEmbeddingRuntimeConfig, inputs: string[]): Promise<EmbeddingVector[]> {
    const response = await fetch(`${providerConfig.baseUrl}/api/embed`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: providerConfig.model,
        input: inputs
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama embedding request failed with status ${response.status}.`);
    }

    const data = (await response.json()) as {
      embeddings?: number[][];
      embedding?: number[];
    };

    const embeddings = Array.isArray(data.embeddings)
      ? data.embeddings
      : Array.isArray(data.embedding)
        ? [data.embedding]
        : [];

    if (embeddings.length !== inputs.length || embeddings.some(vector => !Array.isArray(vector))) {
      throw new Error("Ollama embedding response shape is invalid.");
    }

    const dimensions = resolveProviderResponseDimensions(providerConfig, embeddings);

    return embeddings.map(vector => ({
      vector,
      ...createResolvedEmbeddingConfigFromProviderResponse(providerConfig, dimensions)
    }));
  }

  private async embedWithOpenAI(providerConfig: OpenAiEmbeddingRuntimeConfig, input: string[]): Promise<EmbeddingVector[]> {
    if (providerConfig.apiMode === "multimodal_text") {
      const embeddings: EmbeddingVector[] = [];

      for (const text of input) {
        const response = await fetch(providerConfig.apiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${providerConfig.apiKey}`
          },
          body: JSON.stringify({
            model: providerConfig.model,
            dimensions: providerConfig.expectedDimensions,
            input: [{ type: "text", text }]
          })
        });

        if (!response.ok) {
          throw new Error(`OpenAI embedding request failed with status ${response.status}.`);
        }

        const data = (await response.json()) as {
          data?: { embedding?: number[] };
        };

        if (!data.data || !Array.isArray(data.data.embedding)) {
          throw new Error("OpenAI embedding response shape is invalid.");
        }

        const dimensions = resolveProviderResponseDimensions(providerConfig, [data.data.embedding]);
        embeddings.push({
          vector: data.data.embedding,
          ...createResolvedEmbeddingConfigFromProviderResponse(providerConfig, dimensions)
        });
      }

      return embeddings;
    }

    const response = await fetch(providerConfig.apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${providerConfig.apiKey}`
      },
      body: JSON.stringify({
        model: providerConfig.model,
        dimensions: providerConfig.expectedDimensions,
        input
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI embedding request failed with status ${response.status}.`);
    }

    const data = (await response.json()) as {
      data?: Array<{ embedding: number[]; index: number }> | { embedding?: number[] };
    };

    const sortedItems = Array.isArray(data.data)
      ? [...data.data].sort((left, right) => left.index - right.index)
      : input.length === 1 && data.data && Array.isArray(data.data.embedding)
        ? [{ embedding: data.data.embedding, index: 0 }]
        : [];

    if (sortedItems.length !== input.length || sortedItems.some(item => !Array.isArray(item.embedding))) {
      throw new Error("OpenAI embedding response shape is invalid.");
    }

    const dimensions = resolveProviderResponseDimensions(
      providerConfig,
      sortedItems.map(item => item.embedding)
    );

    return sortedItems.map(item => ({
      vector: item.embedding,
      ...createResolvedEmbeddingConfigFromProviderResponse(providerConfig, dimensions)
    }));
  }

  private buildFallbackEmbedding(text: string, fallbackConfig: FallbackEmbeddingRuntimeConfig): EmbeddingVector {
    const dimensions = fallbackConfig.config.dimensions;
    const vector = new Array<number>(dimensions).fill(0);
    const terms = this.tokenize(text);

    if (terms.length === 0) {
      return {
        vector,
        ...fallbackConfig.config
      };
    }

    for (const term of terms) {
      const hash = createHash("sha256").update(term).digest();
      const bucket = hash.readUInt16BE(0) % dimensions;
      const direction = hash[2] % 2 === 0 ? 1 : -1;
      vector[bucket] += direction;
    }

    return {
      vector: this.normalizeVector(vector),
      ...fallbackConfig.config
    };
  }

  private tokenize(text: string) {
    return text
      .toLowerCase()
      .split(/[^a-z0-9\u4e00-\u9fa5]+/i)
      .map(term => term.trim())
      .filter(Boolean);
  }

  private normalizeVector(vector: number[]) {
    const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));

    if (magnitude === 0) {
      return vector;
    }

    return vector.map(value => value / magnitude);
  }
}
