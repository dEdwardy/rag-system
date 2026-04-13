import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { Injectable } from "@nestjs/common";
import { type SupabaseStorageRuntimeConfig, type OssStorageRuntimeConfig } from "./storage-runtime-config";
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
  saveFileByStorageKey(input: {
    storageKey: string;
    buffer: Buffer;
    contentType?: string;
  }): Promise<{ storageKey: string; absolutePath: string | null }>;
  readFileByStorageKey(storageKey: string): Promise<Buffer>;
  getStorageRoot(): string | null;
}

type ResolvedObjectTarget = {
  bucket: string;
  objectPath: string;
};

type OssClient = {
  put: (name: string, data: Buffer, options?: { headers?: Record<string, string> }) => Promise<unknown>;
  get: (name: string) => Promise<{ content: Buffer | NodeJS.ReadableStream | string }>;
};

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

  async saveFileByStorageKey(input: { storageKey: string; buffer: Buffer; contentType?: string }) {
    const { bucket, objectPath } = this.resolveSupabaseTarget(input.storageKey);
    const response = await fetch(
      `${this.runtimeConfig.supabaseUrl}/storage/v1/object/${bucket}/${encodeStoragePath(objectPath)}`,
      {
        method: "POST",
        headers: this.buildSupabaseHeaders({
          contentType: input.contentType || "application/octet-stream"
        }),
        body: new Uint8Array(input.buffer)
      }
    );

    if (!response.ok) {
      throw new Error(`Supabase storage upload failed (${response.status}): ${await safeReadResponseText(response)}`);
    }

    return {
      storageKey: input.storageKey,
      absolutePath: null
    };
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

@Injectable()
export class OssStorageProviderService implements StorageProviderService {
  private clientCache = new Map<string, Promise<OssClient>>();

  constructor(
    private readonly runtimeConfig: OssStorageRuntimeConfig,
    private readonly clientFactory?: (bucket: string) => Promise<OssClient> | OssClient
  ) {}

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

  async saveFileByStorageKey(input: { storageKey: string; buffer: Buffer; contentType?: string }) {
    const target = this.resolveObjectTarget(input.storageKey);
    const client = await this.getClient(target.bucket);

    try {
      await client.put(target.objectPath, input.buffer, {
        headers: {
          "Content-Type": input.contentType || "application/octet-stream"
        }
      });
    } catch (error) {
      throw new Error(`OSS storage upload failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    return {
      storageKey: input.storageKey,
      absolutePath: null
    };
  }

  async readFileByStorageKey(storageKey: string) {
    const target = this.resolveObjectTarget(storageKey);
    const client = await this.getClient(target.bucket);

    try {
      const response = await client.get(target.objectPath);
      return await this.readOssContent(response.content);
    } catch (error) {
      throw new Error(`OSS storage read failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  getStorageRoot() {
    return null;
  }

  private async saveBuffer(input: SaveBufferInput) {
    const fileName = `${Date.now()}-${randomUUID()}${input.extension}`;
    const relativePath = join(input.directory, fileName).replaceAll("\\", "/");
    const target = this.resolveObjectTarget(relativePath);
    const client = await this.getClient(target.bucket);

    try {
      await client.put(target.objectPath, input.buffer, {
        headers: {
          "Content-Type": input.contentType
        }
      });
    } catch (error) {
      throw new Error(`OSS storage upload failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    return {
      storageKey: relativePath,
      absolutePath: null
    };
  }

  private resolveObjectTarget(storageKey: string): ResolvedObjectTarget {
    const normalizedStorageKey = storageKey.replaceAll("\\", "/");

    if (normalizedStorageKey.startsWith("uploads/")) {
      return {
        bucket: this.runtimeConfig.bucket,
        objectPath: this.prependObjectPrefix(normalizedStorageKey)
      };
    }

    if (normalizedStorageKey.startsWith("generated/")) {
      return {
        bucket: this.runtimeConfig.bucket,
        objectPath: this.prependObjectPrefix(normalizedStorageKey)
      };
    }

    throw new Error(`Unsupported storage key for OSS storage: ${storageKey}`);
  }

  private async getClient(bucket: string) {
    const cached = this.clientCache.get(bucket);
    if (cached) {
      return cached;
    }

    const created = this.createClient(bucket);
    this.clientCache.set(bucket, created);
    return created;
  }

  private prependObjectPrefix(storageKey: string) {
    return `${this.runtimeConfig.objectPrefix}/${storageKey}`;
  }

  private async createClient(bucket: string): Promise<OssClient> {
    if (this.clientFactory) {
      return await this.clientFactory(bucket);
    }

    const ossModule = await import("ali-oss");
    const OSS = ossModule.default;
    const endpoint = new URL(this.runtimeConfig.endpoint);

    return new OSS({
      region: this.runtimeConfig.region,
      endpoint: this.runtimeConfig.endpoint,
      bucket,
      accessKeyId: this.runtimeConfig.accessKeyId,
      accessKeySecret: this.runtimeConfig.accessKeySecret,
      stsToken: this.runtimeConfig.securityToken,
      secure: endpoint.protocol === "https:"
    }) as OssClient;
  }

  private async readOssContent(content: Buffer | NodeJS.ReadableStream | string) {
    if (Buffer.isBuffer(content)) {
      return content;
    }

    if (typeof content === "string") {
      return Buffer.from(content, "utf8");
    }

    const chunks: Buffer[] = [];
    for await (const chunk of content) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
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

  async saveFileByStorageKey(input: { storageKey: string; buffer: Buffer }) {
    const normalizedStorageKey = input.storageKey.replaceAll("/", "\\");
    const absolutePath = join(this.storageRoot, normalizedStorageKey);
    const absoluteDirectory = dirname(absolutePath);

    if (!existsSync(absoluteDirectory)) {
      mkdirSync(absoluteDirectory, { recursive: true });
    }

    writeFileSync(absolutePath, input.buffer);

    return {
      storageKey: input.storageKey,
      absolutePath
    };
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
