import { BadGatewayException, BadRequestException, Injectable } from "@nestjs/common";
import { fetchWithRetry } from "../http/fetch-with-retry";

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
};

type FeedEntry = {
  title: string | null;
  summary: string | null;
  link: string | null;
  publishedAt: string | null;
};

@Injectable()
export class FeedSourceService {
  async fetchFeed(options: FetchFeedOptions) {
    let response: Response;

    try {
      response = await fetchWithRetry({
        url: options.url,
        timeoutMs: 10000,
        headers: {
          Accept: "application/rss+xml,application/atom+xml,application/xml,text/xml"
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown fetch error.";
      throw new BadGatewayException(`Failed to fetch feed: ${message}`);
    }

    if (!response.ok) {
      throw new BadGatewayException(`Failed to fetch feed: upstream responded with ${response.status}.`);
    }

    const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
    if (!this.isSupportedFeedContentType(contentType)) {
      throw new BadRequestException(`Unsupported feed content type: ${contentType || "unknown"}.`);
    }

    return this.extractFromXml(await response.text(), options);
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
    const itemBlocks = this.extractBlocks(channelBlock ?? xml, "item").slice(0, options.maxItems);
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
      sourceUrl: options.url
    });
  }

  private extractFromAtom(xml: string, options: ExtractFeedOptions): FetchedFeed {
    const title = this.extractTextValue(xml, "title");
    const description = this.extractTextValue(xml, "subtitle");
    const entryBlocks = this.extractBlocks(xml, "entry").slice(0, options.maxItems);
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
      sourceUrl: options.url
    });
  }

  private buildFeedResult(input: {
    title: string | null;
    description: string | null;
    entries: FeedEntry[];
    sourceUrl: string;
  }): FetchedFeed {
    const lines: string[] = [];

    if (input.title) {
      lines.push(`Feed: ${input.title}`);
    }

    lines.push(`Source URL: ${input.sourceUrl}`);

    if (input.description) {
      lines.push(`Description: ${input.description}`);
    }

    input.entries.forEach((entry, index) => {
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
    if (!content) {
      throw new BadRequestException("Extracted feed content is empty.");
    }

    return {
      title: input.title ?? null,
      content
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
