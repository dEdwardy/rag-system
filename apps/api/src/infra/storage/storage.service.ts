import { Injectable } from "@nestjs/common";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { resolveStorageRoot } from "./storage-root";

type SaveFileInput = {
  buffer: Buffer;
  originalName: string;
};

@Injectable()
export class StorageService {
  private readonly storageRoot = resolveStorageRoot();

  async saveUploadedFile(input: SaveFileInput) {
    return this.saveBuffer({
      buffer: input.buffer,
      directory: "uploads",
      extension: extname(input.originalName)
    });
  }

  async saveGeneratedTextFile(input: { content: string }) {
    return this.saveBuffer({
      buffer: Buffer.from(input.content, "utf8"),
      directory: "generated",
      extension: ".txt"
    });
  }

  async readFileByStorageKey(storageKey: string) {
    const absolutePath = join(this.storageRoot, storageKey);
    return readFile(absolutePath);
  }

  getStorageRoot() {
    return this.storageRoot;
  }

  private async saveBuffer(input: { buffer: Buffer; directory: string; extension: string }) {
    const fileName = `${Date.now()}-${randomUUID()}${input.extension}`;
    const relativeDirectory = join(input.directory);
    const relativePath = join(relativeDirectory, fileName);
    const absoluteDirectory = join(this.storageRoot, relativeDirectory);
    const absolutePath = join(this.storageRoot, relativePath);

    await mkdir(absoluteDirectory, { recursive: true });
    await writeFile(absolutePath, input.buffer);

    return {
      storageKey: relativePath.replaceAll("\\", "/"),
      absolutePath
    };
  }
}
