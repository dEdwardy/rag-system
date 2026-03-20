import { Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";

type EmbeddingVector = {
  vector: number[];
  modelName: string;
  dimensions: number;
  provider: "ollama" | "openai" | "fallback";
};

@Injectable()
export class EmbeddingService {
  async embedTexts(texts: string[]) {
    const normalizedTexts = texts.map(text => text.trim());

    if (normalizedTexts.length === 0) {
      return [];
    }

    const ollamaBaseUrl = process.env.OLLAMA_BASE_URL;
    const ollamaModel = process.env.OLLAMA_EMBEDDING_MODEL ?? process.env.OLLAMA_MODEL;

    if (ollamaBaseUrl && ollamaModel) {
      try {
        return await this.embedWithOllama(ollamaBaseUrl, ollamaModel, normalizedTexts);
      } catch {
        // Keep ingestion and retrieval available when local model is not ready.
      }
    }

    const openAiApiKey = process.env.OPENAI_API_KEY;
    const openAiModel = process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small";

    if (openAiApiKey) {
      try {
        return await this.embedWithOpenAI(openAiApiKey, openAiModel, normalizedTexts);
      } catch {
        // Fall through to deterministic local embedding.
      }
    }

    return normalizedTexts.map(text => this.buildFallbackEmbedding(text));
  }

  async embedQuery(text: string) {
    const [embedding] = await this.embedTexts([text]);
    return embedding;
  }

  private async embedWithOllama(baseUrl: string, model: string, inputs: string[]): Promise<EmbeddingVector[]> {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/embed`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
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

    return embeddings.map(vector => ({
      vector,
      modelName: `ollama:${model}`,
      dimensions: vector.length,
      provider: "ollama"
    }));
  }

  private async embedWithOpenAI(apiKey: string, model: string, input: string[]): Promise<EmbeddingVector[]> {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        input
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI embedding request failed with status ${response.status}.`);
    }

    const data = (await response.json()) as {
      data?: Array<{ embedding: number[]; index: number }>;
    };

    const sortedItems = [...(data.data ?? [])].sort((left, right) => left.index - right.index);
    if (sortedItems.length !== input.length || sortedItems.some(item => !Array.isArray(item.embedding))) {
      throw new Error("OpenAI embedding response shape is invalid.");
    }

    return sortedItems.map(item => ({
      vector: item.embedding,
      modelName: `openai:${model}`,
      dimensions: item.embedding.length,
      provider: "openai"
    }));
  }

  private buildFallbackEmbedding(text: string): EmbeddingVector {
    const dimensions = 256;
    const vector = new Array<number>(dimensions).fill(0);
    const terms = this.tokenize(text);

    if (terms.length === 0) {
      return {
        vector,
        modelName: "fallback:hash-v1",
        dimensions,
        provider: "fallback"
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
      modelName: "fallback:hash-v1",
      dimensions,
      provider: "fallback"
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
