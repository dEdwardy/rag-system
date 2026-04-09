import { Injectable } from "@nestjs/common";

export type ParsedChunk = {
  content: string;
  sectionTitle: string | null;
  headingPath: string[];
  blockType: "paragraph" | "heading" | "list" | "table" | "faq" | "quote" | "code";
  listOrdinal: number | null;
  isTableLike: boolean;
};

@Injectable()
export class ChunkingService {
  buildChunks(content: string): ParsedChunk[] {
    const targetChunkLength = 900;
    const maxChunkLength = 1200;
    const paragraphs = content
      .replace(/\r\n/g, "\n")
      .split(/\n\s*\n/g)
      .map(paragraph => paragraph.trim())
      .filter(Boolean);

    const chunks: ParsedChunk[] = [];
    let currentSectionTitle: string | null = null;
    let currentHeadingPath: string[] = [];
    let bufferParts: string[] = [];
    let currentBlockType: ParsedChunk["blockType"] = "paragraph";
    let currentListOrdinal: number | null = null;
    let currentIsTableLike = false;

    const pushChunk = (parts: string[], sectionTitle: string | null) => {
      const normalized = parts.join("\n\n").trim();
      if (!normalized) {
        return;
      }

      chunks.push({
        content: normalized,
        sectionTitle,
        headingPath: [...currentHeadingPath],
        blockType: currentBlockType,
        listOrdinal: currentListOrdinal,
        isTableLike: currentIsTableLike
      });
    };

    const flushBuffer = () => {
      if (bufferParts.length === 0) {
        return;
      }

      pushChunk(bufferParts, currentSectionTitle);
      bufferParts = [];
    };

    const getBufferedLength = (parts: string[]) => parts.reduce((sum, part) => sum + part.length, 0) + Math.max(0, parts.length - 1) * 2;

    for (const paragraph of paragraphs) {
      if (this.isHeadingParagraph(paragraph)) {
        flushBuffer();
        currentSectionTitle = this.extractHeadingTitle(paragraph);
        currentHeadingPath = this.updateHeadingPath(currentHeadingPath, paragraph);
        currentBlockType = "heading";
        currentListOrdinal = null;
        currentIsTableLike = false;
        bufferParts = [paragraph];
        continue;
      }

      currentBlockType = this.detectBlockType(paragraph);
      currentListOrdinal = this.extractListOrdinal(paragraph);
      currentIsTableLike = this.isTableLikeParagraph(paragraph);

      const paragraphSegments = this.splitOversizedParagraph(paragraph, maxChunkLength);
      for (const segment of paragraphSegments) {
        const candidateParts = [...bufferParts, segment];
        const candidateLength = getBufferedLength(candidateParts);

        if (candidateLength <= targetChunkLength) {
          bufferParts = candidateParts;
          continue;
        }

        flushBuffer();

        if (segment.length <= maxChunkLength) {
          bufferParts = [segment];
          continue;
        }

        const subSegments = this.splitOversizedParagraph(segment, maxChunkLength);
        for (const subSegment of subSegments) {
          if (subSegment.length > targetChunkLength) {
            pushChunk([subSegment], currentSectionTitle);
          } else {
            if (bufferParts.length > 0 && getBufferedLength([...bufferParts, subSegment]) > targetChunkLength) {
              flushBuffer();
            }
            bufferParts = [...bufferParts, subSegment];
          }
        }
      }
    }

    flushBuffer();

    return chunks.length > 0
      ? chunks
      : [
          {
            content,
            sectionTitle: null,
            headingPath: [],
            blockType: "paragraph",
            listOrdinal: null,
            isTableLike: false
          }
        ];
  }

  private isHeadingParagraph(paragraph: string) {
    return /^#{1,6}\s+/.test(paragraph);
  }

  private extractHeadingTitle(paragraph: string) {
    return paragraph.replace(/^#{1,6}\s*/, "").trim() || null;
  }

  private updateHeadingPath(currentHeadingPath: string[], paragraph: string) {
    const levelMatch = paragraph.match(/^(#{1,6})\s+/);
    const headingTitle = this.extractHeadingTitle(paragraph);
    if (!levelMatch || !headingTitle) {
      return currentHeadingPath;
    }

    const level = levelMatch[1].length;
    return [...currentHeadingPath.slice(0, Math.max(0, level - 1)), headingTitle];
  }

  private detectBlockType(paragraph: string): ParsedChunk["blockType"] {
    if (/^>\s+/.test(paragraph)) {
      return "quote";
    }

    if (/^```/.test(paragraph) || /^( {4}|\t)\S/.test(paragraph)) {
      return "code";
    }

    if (this.isFaqParagraph(paragraph)) {
      return "faq";
    }

    if (this.isTableLikeParagraph(paragraph)) {
      return "table";
    }

    if (/^([-*+]|\d+\.)\s+/.test(paragraph)) {
      return "list";
    }

    return "paragraph";
  }

  private extractListOrdinal(paragraph: string) {
    const match = paragraph.match(/^(\d+)\.\s+/);
    return match ? Number.parseInt(match[1], 10) : null;
  }

  private isTableLikeParagraph(paragraph: string) {
    const lines = paragraph.split("\n").map(line => line.trim()).filter(Boolean);
    if (lines.length < 2) {
      return false;
    }

    return lines.every(line => /\|/.test(line));
  }

  private isFaqParagraph(paragraph: string) {
    const normalized = paragraph.trim();
    return /^(q[:：]|question[:：]|问[:：]).+/i.test(normalized) && /(?:\n|^)(a[:：]|answer[:：]|答[:：]).+/im.test(normalized);
  }

  private splitOversizedParagraph(paragraph: string, maxChunkLength: number) {
    if (paragraph.length <= maxChunkLength) {
      return [paragraph];
    }

    const sentenceSegments = paragraph
      .split(/(?<=[。！？.!?])\s+|\n+/g)
      .map(segment => segment.trim())
      .filter(Boolean);

    if (sentenceSegments.length > 1) {
      return this.packSegments(sentenceSegments, maxChunkLength);
    }

    const lineSegments = paragraph
      .split(/\n+/g)
      .map(segment => segment.trim())
      .filter(Boolean);

    if (lineSegments.length > 1) {
      return this.packSegments(lineSegments, maxChunkLength);
    }

    return this.forceSplitByLength(paragraph, maxChunkLength);
  }

  private packSegments(segments: string[], maxChunkLength: number) {
    const packed: string[] = [];
    let buffer = "";

    const flushBuffer = () => {
      const normalized = buffer.trim();
      if (!normalized) {
        return;
      }

      packed.push(normalized);
      buffer = "";
    };

    for (const segment of segments) {
      if (segment.length > maxChunkLength) {
        flushBuffer();
        packed.push(...this.forceSplitByLength(segment, maxChunkLength));
        continue;
      }

      const nextValue = buffer.length > 0 ? `${buffer} ${segment}` : segment;
      if (nextValue.length > maxChunkLength) {
        flushBuffer();
        buffer = segment;
      } else {
        buffer = nextValue;
      }
    }

    flushBuffer();

    return packed;
  }

  private forceSplitByLength(value: string, maxChunkLength: number) {
    const parts: string[] = [];
    let start = 0;

    while (start < value.length) {
      let end = Math.min(start + maxChunkLength, value.length);
      if (end < value.length) {
        const breakIndex = value.lastIndexOf(" ", end);
        if (breakIndex > start + Math.floor(maxChunkLength * 0.5)) {
          end = breakIndex;
        }
      }

      parts.push(value.slice(start, end).trim());
      start = end;
      while (value[start] === " ") {
        start += 1;
      }
    }

    return parts.filter(Boolean);
  }
}
