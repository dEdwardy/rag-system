import { Injectable } from "@nestjs/common";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { resolveStorageRoot } from "./storage-root";

import { resolveStorageRuntimeConfig, type SupabaseStorageRuntimeConfig } from "./storage-runtime-config";

type SaveFileInput = {
  buffer: Buffer;
  originalName: string;
  mimeType?: string;
};

@Injectable()
export class StorageService {
  private readonly storageRoot = resolveStorageRoot();
  private readonly runtimeConfig = resolveStorageRuntimeConfig();

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
    if (this.runtimeConfig.provider === "supabase") {
      return this.readSupabaseFile(storageKey);
    }

    const absolutePath = join(this.storageRoot, storageKey);
    return readFile(absolutePath);
  }

  getStorageRoot() {
    return this.runtimeConfig.provider === "local" ? this.storageRoot : null;
  }

  private async saveBuffer(input: { buffer: Buffer; directory: string; extension: string; contentType: string }) {
    const fileName = `${Date.now()}-${randomUUID()}${input.extension}`;
    const relativeDirectory = join(input.directory);
    const relativePath = join(relativeDirectory, fileName);

    if (this.runtimeConfig.provider === "supabase") {
      await this.writeSupabaseFile({
        storageKey: relativePath.replaceAll("\\", "/"),
        buffer: input.buffer,
        contentType: input.contentType
      });

      return {
        storageKey: relativePath.replaceAll("\\", "/"),
        absolutePath: null
      };
    }

    const absoluteDirectory = join(this.storageRoot, relativeDirectory);
    const absolutePath = join(this.storageRoot, relativePath);

    await mkdir(absoluteDirectory, { recursive: true });
    await writeFile(absolutePath, input.buffer);

    return {
      storageKey: relativePath.replaceAll("\\", "/"),
      absolutePath
    };
  }

  private async writeSupabaseFile(input: { storageKey: string; buffer: Buffer; contentType: string }) {
    const runtimeConfig = this.getSupabaseRuntimeConfig();
    const { bucket, objectPath } = this.resolveSupabaseTarget(input.storageKey);
    const response = await fetch(
      `${runtimeConfig.supabaseUrl}/storage/v1/object/${bucket}/${encodeStoragePath(objectPath)}`,
      {
        method: "POST",
        headers: this.buildSupabaseHeaders({ contentType: input.contentType }),
        body: new Uint8Array(input.buffer)
      }
    );

    if (!response.ok) {
      throw new Error(`Supabase storage upload failed (${response.status}): ${await safeReadResponseText(response)}`);
    }
  }

  private async readSupabaseFile(storageKey: string) {
    const runtimeConfig = this.getSupabaseRuntimeConfig();
    const { bucket, objectPath } = this.resolveSupabaseTarget(storageKey);
    const response = await fetch(
      `${runtimeConfig.supabaseUrl}/storage/v1/object/authenticated/${bucket}/${encodeStoragePath(objectPath)}`,
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

  private resolveSupabaseTarget(storageKey: string) {
    if (this.runtimeConfig.provider !== "supabase") {
      throw new Error("Supabase storage target requested while local storage is active.");
    }

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
    const runtimeConfig = this.getSupabaseRuntimeConfig();

    return {
      Authorization: `Bearer ${runtimeConfig.serviceRoleKey}`,
      apikey: runtimeConfig.serviceRoleKey,
      ...(input?.contentType ? { "Content-Type": input.contentType } : {})
    };
  }

  private getSupabaseRuntimeConfig(): SupabaseStorageRuntimeConfig {
    if (this.runtimeConfig.provider !== "supabase") {
      throw new Error("Supabase storage requested while local storage is active.");
    }

    return this.runtimeConfig;
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
