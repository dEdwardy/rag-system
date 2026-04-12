import { Inject, Injectable } from "@nestjs/common";
import {
  createResolvedEmbeddingConfigFromProviderResponse,
  EmbeddingRuntimeConfigError,
  EmbeddingVector,
  OllamaEmbeddingRuntimeConfig,
  OpenAiEmbeddingRuntimeConfig,
  resolveEmbeddingRuntimeConfig,
  resolveProviderResponseDimensions
} from "./embedding-runtime-config";
import { EmbeddingCacheService } from "./embedding-cache.service";

@Injectable()
export class EmbeddingService {
  constructor(@Inject(EmbeddingCacheService) private readonly embeddingCacheService: EmbeddingCacheService) {}

  async embedTexts(texts: string[]): Promise<EmbeddingVector[]> {
    const normalizedTexts = texts.map(text => text.trim());

    if (normalizedTexts.length === 0) {
      return [];
    }

    const { cached, uncached, indices } = this.embeddingCacheService.getBatch(normalizedTexts);

    if (uncached.length === 0) {
      const result: EmbeddingVector[] = [];
      for (let i = 0; i < normalizedTexts.length; i++) {
        result.push(cached.get(i)!);
      }
      return result;
    }

    const runtimeConfig = resolveEmbeddingRuntimeConfig();
    let uncachedEmbeddings: EmbeddingVector[] | null = null;
    const providerFailures: string[] = [];

    for (const providerConfig of runtimeConfig.providers) {
      if (providerConfig.provider === "ollama") {
        try {
          uncachedEmbeddings = await this.embedWithOllama(providerConfig, uncached);
          break;
        } catch (error) {
          if (error instanceof EmbeddingRuntimeConfigError) {
            throw error;
          }
          providerFailures.push(this.formatProviderFailure(providerConfig.provider, providerConfig.model, error));
          continue;
        }
      }

      if (providerConfig.provider === "openai") {
        try {
          uncachedEmbeddings = await this.embedWithOpenAI(providerConfig, uncached);
          break;
        } catch (error) {
          if (error instanceof EmbeddingRuntimeConfigError) {
            throw error;
          }
          providerFailures.push(this.formatProviderFailure(providerConfig.provider, providerConfig.model, error));
          continue;
        }
      }
    }

    if (!uncachedEmbeddings) {
      if (providerFailures.length > 0) {
        throw new Error(`Embedding provider request failed for all configured providers: ${providerFailures.join("; ")}`);
      }

      throw new EmbeddingRuntimeConfigError(
        "Invalid embedding config: no usable embedding provider is configured. Configure OpenAI or Ollama embeddings before indexing or retrieval."
      );
    }

    this.embeddingCacheService.setBatch(uncached, uncachedEmbeddings);

    const result: EmbeddingVector[] = [];
    let uncachedIndex = 0;
    for (let i = 0; i < normalizedTexts.length; i++) {
      const cachedEmbedding = cached.get(i);
      if (cachedEmbedding) {
        result.push(cachedEmbedding);
      } else {
        result.push(uncachedEmbeddings[uncachedIndex]);
        uncachedIndex++;
      }
    }

    return result;
  }

  async embedQuery(text: string): Promise<EmbeddingVector> {
    const [embedding] = await this.embedTexts([text]);

    if (!embedding) {
      throw new Error("Embedding query resolution returned no embedding.");
    }

    return embedding;
  }

  private formatProviderFailure(provider: "ollama" | "openai", model: string, error: unknown) {
    const reason = error instanceof Error ? error.message : "Unknown provider error.";
    return `${provider}:${model} -> ${reason}`;
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

}
