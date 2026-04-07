import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";
import { Injectable } from "@nestjs/common";
import { type SupabaseStorageRuntimeConfig, type LocalStorageRuntimeConfig } from "./storage-runtime-config";
import { resolveStorageRoot } from "./storage-root";

type SaveFileInput = {
  buffer: Buffer;
  originalName: string;
  mimeType?: string;
};

type SaveBufferInput = {
  buffer: Buffer;
  directory: string;
  extension: string;
  contentType: string;
};

export const STORAGE_PROVIDER_SERVICE = Symbol("STORAGE_PROVIDER_SERVICE");

export interface StorageProviderService {
  saveUploadedFile(input: SaveFileInput): Promise<{ storageKey: string; absolutePath: string | null }>;
  saveGeneratedTextFile(input: { content: string }): Promise<{ storageKey: string; absolutePath: string | null }>;
  readFileByStorageKey(storageKey: string): Promise<Buffer>;
  getStorageRoot(): string | null;
}

@Injectable()
export class SupabaseStorageProviderService implements StorageProviderService {
  constructor(private readonly runtimeConfig: SupabaseStorageRuntimeConfig) {}

  async saveUploadedFile(input: SaveFileInput) {
    return this.saveBuffer({
      buffer: input.buffer,
      directory: "uploads",
      extension: extname(input.originalName),
      contentType: input.mimeType || "application/octet-stream"
    });
  }

  async saveGeneratedTextFile(input: { content: string }) {
    return this.saveBuffer({
      buffer: Buffer.from(input.content, "utf8"),
      directory: "generated",
      extension: ".txt",
      contentType: "text/plain; charset=utf-8"
    });
  }

  async readFileByStorageKey(storageKey: string) {
    const { bucket, objectPath } = this.resolveSupabaseTarget(storageKey);
    const response = await fetch(
      `${this.runtimeConfig.supabaseUrl}/storage/v1/object/authenticated/${bucket}/${encodeStoragePath(objectPath)}`,
      {
        method: "GET",
        headers: this.buildSupabaseHeaders()
      }
    );

    if (!response.ok) {
      throw new Error(`Supabase storage read failed (${response.status}): ${await safeReadResponseText(response)}`);
    }

    return Buffer.from(await response.arrayBuffer());
  }

  getStorageRoot() {
    return null;
  }

  private async saveBuffer(input: SaveBufferInput) {
    const fileName = `${Date.now()}-${randomUUID()}${input.extension}`;
    const relativeDirectory = join(input.directory);
    const relativePath = join(relativeDirectory, fileName).replaceAll("\\", "/");
    const { bucket, objectPath } = this.resolveSupabaseTarget(relativePath);
    const response = await fetch(
      `${this.runtimeConfig.supabaseUrl}/storage/v1/object/${bucket}/${encodeStoragePath(objectPath)}`,
      {
        method: "POST",
        headers: this.buildSupabaseHeaders({ contentType: input.contentType }),
        body: new Uint8Array(input.buffer)
      }
    );

    if (!response.ok) {
      throw new Error(`Supabase storage upload failed (${response.status}): ${await safeReadResponseText(response)}`);
    }

    return {
      storageKey: relativePath,
      absolutePath: null
    };
  }

  private resolveSupabaseTarget(storageKey: string) {
    const normalizedStorageKey = storageKey.replaceAll("\\", "/");

    if (normalizedStorageKey.startsWith("uploads/")) {
      return {
        bucket: this.runtimeConfig.buckets.uploads,
        objectPath: normalizedStorageKey.slice("uploads/".length)
      };
    }

    if (normalizedStorageKey.startsWith("generated/")) {
      return {
        bucket: this.runtimeConfig.buckets.generated,
        objectPath: normalizedStorageKey.slice("generated/".length)
      };
    }

    throw new Error(`Unsupported storage key for Supabase storage: ${storageKey}`);
  }

  private buildSupabaseHeaders(input?: { contentType?: string }) {
    return {
      Authorization: `Bearer ${this.runtimeConfig.serviceRoleKey}`,
      apikey: this.runtimeConfig.serviceRoleKey,
      ...(input?.contentType ? { "Content-Type": input.contentType } : {})
    };
  }
}

function encodeStoragePath(path: string) {
  return path
    .split("/")
    .filter(Boolean)
    .map(segment => encodeURIComponent(segment))
    .join("/");
}

async function safeReadResponseText(response: Response) {
  try {
    return await response.text();
  } catch {
    return "<unreadable response body>";
  }
}

@Injectable()
export class LocalStorageProviderService implements StorageProviderService {
  private readonly storageRoot: string;

  constructor() {
    this.storageRoot = resolveStorageRoot();
  }

  async saveUploadedFile(input: SaveFileInput) {
    return this.saveBuffer({
      buffer: input.buffer,
      directory: "uploads",
      extension: extname(input.originalName),
      contentType: input.mimeType || "application/octet-stream"
    });
  }

  async saveGeneratedTextFile(input: { content: string }) {
    return this.saveBuffer({
      buffer: Buffer.from(input.content, "utf8"),
      directory: "generated",
      extension: ".txt",
      contentType: "text/plain; charset=utf-8"
    });
  }

  async readFileByStorageKey(storageKey: string) {
    const absolutePath = join(this.storageRoot, storageKey);
    return readFileSync(absolutePath);
  }

  getStorageRoot() {
    return this.storageRoot;
  }

  private async saveBuffer(input: SaveBufferInput) {
    const fileName = `${Date.now()}-${randomUUID()}${input.extension}`;
    const relativeDirectory = join(input.directory);
    const relativePath = join(relativeDirectory, fileName).replaceAll("\\", "/");
    const absoluteDirectory = join(this.storageRoot, input.directory);
    const absolutePath = join(absoluteDirectory, fileName);

    if (!existsSync(absoluteDirectory)) {
      mkdirSync(absoluteDirectory, { recursive: true });
    }

    writeFileSync(absolutePath, input.buffer);

    return {
      storageKey: relativePath,
      absolutePath
    };
  }
}
