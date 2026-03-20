import { Injectable } from "@nestjs/common";
import { extname } from "node:path";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

@Injectable()
export class ParsingService {
  async parseDocument(input: { sourceName: string; mimeType: string; fileBuffer: Buffer }) {
    const extension = extname(input.sourceName).toLowerCase();
    const normalizedMimeType = input.mimeType.toLowerCase();

    if (this.isPdfDocument(extension, normalizedMimeType)) {
      return this.parsePdfDocument(input.fileBuffer);
    }

    if (this.isDocxDocument(extension, normalizedMimeType)) {
      return this.parseDocxDocument(input.fileBuffer);
    }

    if (this.isTextLikeDocument(extension, normalizedMimeType)) {
      return input.fileBuffer.toString("utf8");
    }

    throw new Error(`Unsupported file type for ingestion: ${input.sourceName} (${input.mimeType}).`);
  }

  private isPdfDocument(extension: string, mimeType: string) {
    return extension === ".pdf" || mimeType === "application/pdf";
  }

  private isDocxDocument(extension: string, mimeType: string) {
    return (
      extension === ".docx" ||
      mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
  }

  private isTextLikeDocument(extension: string, mimeType: string) {
    return (
      extension === ".md" ||
      extension === ".txt" ||
      mimeType.startsWith("text/") ||
      mimeType === "application/json"
    );
  }

  private async parsePdfDocument(fileBuffer: Buffer) {
    const parser = new PDFParse({
      data: new Uint8Array(fileBuffer)
    });

    try {
      const parsed = await parser.getText();
      const normalizedText = parsed.text
        .replace(/\r\n/g, "\n")
        .replace(/\u0000/g, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

      if (!normalizedText) {
        throw new Error("Parsed PDF content is empty.");
      }

      return normalizedText;
    } finally {
      await parser.destroy();
    }
  }

  private async parseDocxDocument(fileBuffer: Buffer) {
    const parsed = await mammoth.extractRawText({
      buffer: fileBuffer
    });
    const normalizedText = parsed.value
      .replace(/\r\n/g, "\n")
      .replace(/\u0000/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    if (!normalizedText) {
      throw new Error("Parsed DOCX content is empty.");
    }

    return normalizedText;
  }
}
