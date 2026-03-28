import { BadGatewayException, BadRequestException, Injectable } from "@nestjs/common";
import { fetchWithRetry, resolveSourceFetchRuntimeConfig } from "../http/fetch-with-retry";

type FetchFeedOptions = {
  url: string;
  maxItems: number;
};

type ExtractFeedOptions = {
  url: string;
  maxItems: number;
};

type FetchedFeed = {
  title: string | null;
  content: string;
  diagnostics: FeedFetchDiagnostics | null;
};

type FeedEntry = {
  title: string | null;
  summary: string | null;
  link: string | null;
  publishedAt: string | null;
};

type FeedFetchDiagnostics = {
  sourceKind: "feed";
  schemaVersion: 2;
  attemptedEntryCount: number;
  succeededEntryCount: number;
  failedEntryCount: number;
  retryableFailureCount: number;
  nonRetryableFailureCount: number;
  failedEntryRefs: string[];
  failedEntries: Array<{
    ref: string;
    code: string;
    message: string;
    retryable: boolean;
  }>;
  skippedDuplicateEntryCount: number;
  skippedDuplicateEntryRefs: string[];
  skippedDuplicatesTruncated: boolean;
  skippedDuplicatesOmittedCount: number;
  boundaryHit: boolean;
  boundaryReasons: string[];
  boundary: {
    maxItems: number;
    totalExtractedEntryCount: number;
    selectedEntryCount: number;
    droppedByLimitCount: number;
  };
  failedEntriesTruncated: boolean;
  failedEntriesOmittedCount: number;
  partial: boolean;
};

type FeedEntryFailure = {
  ref: string;
  code: string;
  message: string;
  retryable: boolean;
};

type FeedEntryBoundary = {
  maxItems: number;
  totalExtractedEntryCount: number;
  selectedEntryCount: number;
  droppedByLimitCount: number;
};

const MAX_FAILURE_SUMMARY_ITEMS = 10;

@Injectable()
export class FeedSourceService {
  async fetchFeed(options: FetchFeedOptions) {
    let response: Response;
    const fetchConfig = resolveSourceFetchRuntimeConfig();

    try {
      response = await fetchWithRetry({
        url: options.url,
        timeoutMs: fetchConfig.timeoutMs,
        attempts: fetchConfig.attempts,
        headers: {
          Accept: "application/rss+xml,application/atom+xml,application/xml,text/xml"
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown fetch error.";
      throw new BadGatewayException(`Failed to fetch feed: ${message}`);
    }

    if (!response.ok) {
      throw this.buildUpstreamFetchError("Failed to fetch feed", response.status);
    }

    const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
    const payload = await response.text();
    const xmlPayloadByFallback = this.isFallbackSniffingContentType(contentType) && this.looksLikeFeedXmlPayload(payload);

    if (!this.isSupportedFeedContentType(contentType) && !xmlPayloadByFallback) {
      throw new BadRequestException(`Unsupported feed content type: ${contentType || "unknown"}.`);
    }

    return this.extractFromXml(payload, options);
  }

  extractFromXml(xml: string, options: ExtractFeedOptions): FetchedFeed {
    const normalizedXml = xml.trim();

    if (!normalizedXml) {
      throw new BadRequestException("Feed payload is empty.");
    }

    if (/<rss\b/i.test(normalizedXml)) {
      return this.extractFromRss(normalizedXml, options);
    }

    if (/<feed\b/i.test(normalizedXml) && /<entry\b/i.test(normalizedXml)) {
      return this.extractFromAtom(normalizedXml, options);
    }

    throw new BadRequestException("Unsupported feed format. Only RSS and Atom are supported.");
  }

  private extractFromRss(xml: string, options: ExtractFeedOptions): FetchedFeed {
    const channelBlock = this.extractBlock(xml, "channel");
    const title = this.extractTextValue(channelBlock ?? xml, "title");
    const description = this.extractTextByPattern(channelBlock ?? xml, /<description\b[^>]*>([\s\S]*?)<\/description>/i);
    const allItemBlocks = this.extractBlocks(channelBlock ?? xml, "item");
    const itemBlocks = this.selectEntryBlocksByFreshness(allItemBlocks, options.maxItems, block =>
      this.extractTextByPattern(block, /<(?:pubDate|dc:date)\b[^>]*>([\s\S]*?)<\/(?:pubDate|dc:date)>/i)
    );
    const entries = itemBlocks.map(block => ({
      title: this.extractTextValue(block, "title"),
      summary: this.extractTextByPattern(block, /<(?:description|content:encoded)\b[^>]*>([\s\S]*?)<\/(?:description|content:encoded)>/i),
      link: this.extractTextValue(block, "link"),
      publishedAt: this.extractTextByPattern(block, /<(?:pubDate|dc:date)\b[^>]*>([\s\S]*?)<\/(?:pubDate|dc:date)>/i)
    }));

    return this.buildFeedResult({
      title,
      description,
      entries,
      sourceUrl: options.url,
      boundary: {
        maxItems: options.maxItems,
        totalExtractedEntryCount: allItemBlocks.length,
        selectedEntryCount: itemBlocks.length,
        droppedByLimitCount: Math.max(0, allItemBlocks.length - itemBlocks.length)
      }
    });
  }

  private extractFromAtom(xml: string, options: ExtractFeedOptions): FetchedFeed {
    const title = this.extractTextValue(xml, "title");
    const description = this.extractTextValue(xml, "subtitle");
    const allEntryBlocks = this.extractBlocks(xml, "entry");
    const entryBlocks = this.selectEntryBlocksByFreshness(allEntryBlocks, options.maxItems, block =>
      this.extractTextByPattern(block, /<(?:updated|published)\b[^>]*>([\s\S]*?)<\/(?:updated|published)>/i)
    );
    const entries = entryBlocks.map(block => ({
      title: this.extractTextValue(block, "title"),
      summary: this.extractTextByPattern(block, /<(?:summary|content)\b[^>]*>([\s\S]*?)<\/(?:summary|content)>/i),
      link: this.extractAtomLink(block),
      publishedAt: this.extractTextByPattern(block, /<(?:updated|published)\b[^>]*>([\s\S]*?)<\/(?:updated|published)>/i)
    }));

    return this.buildFeedResult({
      title,
      description,
      entries,
      sourceUrl: options.url,
      boundary: {
        maxItems: options.maxItems,
        totalExtractedEntryCount: allEntryBlocks.length,
        selectedEntryCount: entryBlocks.length,
        droppedByLimitCount: Math.max(0, allEntryBlocks.length - entryBlocks.length)
      }
    });
  }

  private buildFeedResult(input: {
    title: string | null;
    description: string | null;
    entries: FeedEntry[];
    sourceUrl: string;
    boundary: FeedEntryBoundary;
  }): FetchedFeed {
    const lines: string[] = [];
    const failedEntries: FeedEntryFailure[] = [];
    const skippedDuplicateEntryRefs: string[] = [];
    const seenEntryKeys = new Set<string>();

    if (input.title) {
      lines.push(`Feed: ${input.title}`);
    }

    lines.push(`Source URL: ${input.sourceUrl}`);

    if (input.description) {
      lines.push(`Description: ${input.description}`);
    }

    input.entries.forEach(entry => {
      const failure = this.validateEntry(entry);
      if (failure) {
        failedEntries.push(failure);
        return;
      }

      const dedupKey = this.buildEntryDedupKey(entry, input.sourceUrl);
      if (seenEntryKeys.has(dedupKey)) {
        skippedDuplicateEntryRefs.push(entry.link ?? entry.title ?? "Untitled");
        return;
      }

      seenEntryKeys.add(dedupKey);

      const index = lines.filter(line => line.startsWith("Entry ")).length;
      const entryLines = [`Entry ${index + 1}: ${entry.title ?? "Untitled"}`];

      if (entry.publishedAt) {
        entryLines.push(`Published: ${entry.publishedAt}`);
      }

      if (entry.link) {
        entryLines.push(`Link: ${entry.link}`);
      }

      if (entry.summary) {
        entryLines.push(`Summary: ${entry.summary}`);
      }

      lines.push(entryLines.join("\n"));
    });

    const content = lines.join("\n\n").trim();
    if (!input.entries.length) {
      throw new BadRequestException("Extracted feed content is empty.");
    }

    if (input.entries.length > 0 && failedEntries.length === input.entries.length) {
      const firstFailedEntryRef = failedEntries[0]?.ref ?? "unknown";
      throw new BadRequestException(
        `Extracted feed content is empty: all feed entries were invalid. First failed entry ref: ${firstFailedEntryRef}.`
      );
    }

    if (!content) {
      throw new BadRequestException("Extracted feed content is empty.");
    }

    const summarizedFailedEntries = failedEntries.slice(0, MAX_FAILURE_SUMMARY_ITEMS);
    const summarizedSkippedDuplicateRefs = skippedDuplicateEntryRefs.slice(0, MAX_FAILURE_SUMMARY_ITEMS);
    const boundaryHit = input.boundary.droppedByLimitCount > 0;
    const boundaryReasons = boundaryHit ? ["MAX_ITEMS_LIMIT_REACHED"] : [];
    const retryableFailureCount = failedEntries.reduce((count, entry) => count + (entry.retryable ? 1 : 0), 0);
    const nonRetryableFailureCount = failedEntries.length - retryableFailureCount;
    const partial = failedEntries.length > 0 || skippedDuplicateEntryRefs.length > 0 || boundaryHit;

    return {
      title: input.title ?? null,
      content,
      diagnostics: partial
        ? {
            sourceKind: "feed",
            schemaVersion: 2,
            attemptedEntryCount: input.entries.length,
            succeededEntryCount: Math.max(0, input.entries.length - failedEntries.length - skippedDuplicateEntryRefs.length),
            failedEntryCount: failedEntries.length,
            retryableFailureCount,
            nonRetryableFailureCount,
            failedEntryRefs: failedEntries.slice(0, MAX_FAILURE_SUMMARY_ITEMS).map(entry => entry.ref),
            failedEntries: summarizedFailedEntries,
            skippedDuplicateEntryCount: skippedDuplicateEntryRefs.length,
            skippedDuplicateEntryRefs: summarizedSkippedDuplicateRefs,
            skippedDuplicatesTruncated: skippedDuplicateEntryRefs.length > summarizedSkippedDuplicateRefs.length,
            skippedDuplicatesOmittedCount: Math.max(0, skippedDuplicateEntryRefs.length - summarizedSkippedDuplicateRefs.length),
            boundaryHit,
            boundaryReasons,
            boundary: input.boundary,
            failedEntriesTruncated: failedEntries.length > summarizedFailedEntries.length,
            failedEntriesOmittedCount: Math.max(0, failedEntries.length - summarizedFailedEntries.length),
            partial: true
          }
        : null
    };
  }

  private buildEntryDedupKey(entry: FeedEntry, sourceUrl: string) {
    const normalizedTitle = entry.title?.trim().toLowerCase() ?? "";
    const normalizedLink = this.normalizeEntryLinkForDedup(entry.link, sourceUrl);
    const normalizedPublishedAt = entry.publishedAt?.trim().toLowerCase() ?? "";
    const normalizedSummary = entry.summary?.trim().toLowerCase() ?? "";

    if (normalizedLink) {
      return `link:${normalizedLink}`;
    }

    return [normalizedTitle, normalizedPublishedAt, normalizedSummary].join("|");
  }

  private normalizeEntryLinkForDedup(link: string | null, sourceUrl: string) {
    const normalizedLink = link?.trim().toLowerCase() ?? "";
    if (!normalizedLink) {
      return "";
    }

    try {
      const parsed = new URL(normalizedLink, sourceUrl);
      parsed.hash = "";
      return parsed.toString();
    } catch {
      return normalizedLink;
    }
  }

  private selectEntryBlocksByFreshness(
    allBlocks: string[],
    maxItems: number,
    getPublishedAt: (block: string) => string | null
  ) {
    if (allBlocks.length <= maxItems) {
      return allBlocks;
    }

    const blocksWithPublishedAt = allBlocks.map((block, index) => ({
      block,
      index,
      timestamp: this.resolveFeedTimestamp(getPublishedAt(block))
    }));
    const hasAnyTimestamp = blocksWithPublishedAt.some(item => item.timestamp !== null);

    if (!hasAnyTimestamp) {
      return allBlocks.slice(0, maxItems);
    }

    const newestBlocks = [...blocksWithPublishedAt]
      .sort((left, right) => {
        if (left.timestamp === null && right.timestamp === null) {
          return left.index - right.index;
        }

        if (left.timestamp === null) {
          return 1;
        }

        if (right.timestamp === null) {
          return -1;
        }

        if (left.timestamp === right.timestamp) {
          return left.index - right.index;
        }

        return right.timestamp - left.timestamp;
      })
      .slice(0, maxItems);

    return newestBlocks.sort((left, right) => left.index - right.index).map(item => item.block);
  }

  private resolveFeedTimestamp(value: string | null) {
    if (!value) {
      return null;
    }

    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) ? timestamp : null;
  }

  private validateEntry(entry: FeedEntry): FeedEntryFailure | null {
    const hasSummary = Boolean(entry.summary?.trim());
    const hasLink = Boolean(entry.link?.trim());

    if (hasSummary || hasLink) {
      return null;
    }

    return {
      ref: entry.title ?? "Untitled",
      code: "ENTRY_CONTENT_EMPTY",
      message: "Feed entry is missing both summary and link.",
      retryable: false
    };
  }

  private isSupportedFeedContentType(contentType: string) {
    return (
      contentType.startsWith("application/rss+xml") ||
      contentType.startsWith("application/atom+xml") ||
      contentType.startsWith("application/xml") ||
      contentType.startsWith("text/xml")
    );
  }

  private isFallbackSniffingContentType(contentType: string) {
    return !contentType || contentType.startsWith("text/plain");
  }

  private looksLikeFeedXmlPayload(payload: string) {
    return /<rss\b|<feed\b/i.test(payload);
  }

  private buildUpstreamFetchError(prefix: string, status: number) {
    const message = `${prefix}: upstream responded with ${status}.`;
    return this.isRetryableUpstreamStatus(status)
      ? new BadGatewayException(message)
      : new BadRequestException(message);
  }

  private isRetryableUpstreamStatus(status: number) {
    return status === 408 || status === 429 || status >= 500;
  }

  private extractBlock(value: string, tagName: string) {
    const match = value.match(new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i"));
    return match ? match[1] : null;
  }

  private extractBlocks(value: string, tagName: string) {
    return [...value.matchAll(new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "gi"))].map(
      match => match[1]
    );
  }

  private extractTextValue(value: string, tagName: string) {
    return this.extractTextByPattern(value, new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i"));
  }

  private extractTextByPattern(value: string, pattern: RegExp) {
    const match = value.match(pattern);
    return match ? this.normalizeText(match[1]) : null;
  }

  private extractAtomLink(value: string) {
    const hrefMatch = value.match(/<link\b[^>]*href="([^"]+)"[^>]*?(?:rel="alternate")?[^>]*\/?>/i);
    if (hrefMatch) {
      return this.decodeEntities(hrefMatch[1]).trim();
    }

    return this.extractTextValue(value, "link");
  }

  private normalizeText(value: string) {
    return this.decodeEntities(this.stripTags(this.stripCdata(value)))
      .replace(/\r\n/g, "\n")
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n[ \t]+/g, "\n")
      .replace(/[ \t]{2,}/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  private stripCdata(value: string) {
    return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  }

  private stripTags(value: string) {
    return value
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<(br|\/p|\/div|\/section|\/article|\/main|\/li|\/ul|\/ol|\/h[1-6]|\/header|\/footer)\s*>/gi, "\n")
      .replace(/<[^>]+>/g, " ");
  }

  private decodeEntities(value: string) {
    return value
      .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
      .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&apos;/gi, "'");
  }
}
