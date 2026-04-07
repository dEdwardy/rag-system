import { Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import type { EmbeddingVector } from "./embedding-runtime-config";

type CacheEntry = {
  embedding: EmbeddingVector;
  timestamp: number;
};

@Injectable()
export class EmbeddingCacheService {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly maxCacheSize = 10000;
  private readonly ttlMs = 3600000;

  private getCacheKey(text: string): string {
    return createHash("sha256").update(text).digest("hex");
  }

  get(text: string): EmbeddingVector | null {
    const key = this.getCacheKey(text);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }

    return entry.embedding;
  }

  set(text: string, embedding: EmbeddingVector): void {
    const key = this.getCacheKey(text);
    
    if (this.cache.size >= this.maxCacheSize) {
      this.evictOldEntries();
    }

    this.cache.set(key, {
      embedding,
      timestamp: Date.now()
    });
  }

  getBatch(texts: string[]): { cached: Map<number, EmbeddingVector>; uncached: string[]; indices: number[] } {
    const cached = new Map<number, EmbeddingVector>();
    const uncached: string[] = [];
    const indices: number[] = [];

    texts.forEach((text, index) => {
      const embedding = this.get(text);
      if (embedding) {
        cached.set(index, embedding);
      } else {
        uncached.push(text);
        indices.push(index);
      }
    });

    return { cached, uncached, indices };
  }

  setBatch(texts: string[], embeddings: EmbeddingVector[]): void {
    texts.forEach((text, index) => {
      if (embeddings[index]) {
        this.set(text, embeddings[index]);
      }
    });
  }

  private evictOldEntries(): void {
    const entries = Array.from(this.cache.entries());
    const sortedEntries = entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    const entriesToRemove = sortedEntries.slice(0, Math.floor(this.maxCacheSize * 0.2));
    
    entriesToRemove.forEach(([key]) => {
      this.cache.delete(key);
    });
  }

  clear(): void {
    this.cache.clear();
  }
}
