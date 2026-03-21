import { BadGatewayException, BadRequestException, Injectable } from "@nestjs/common";
import { WebPageService } from "../web-page/web-page.service";

type FetchSitemapOptions = {
  url: string;
  maxPages: number;
};

type ExtractSitemapOptions = {
  url: string;
  maxPages: number;
};

type FetchedSitemap = {
  content: string;
};

// Keep sitemap-index expansion bounded so one request cannot fan out indefinitely.
const MAX_CHILD_SITEMAPS = 20;

@Injectable()
export class SitemapSourceService {
  constructor(private readonly webPageService: WebPageService) {}

  async fetchSitemap(options: FetchSitemapOptions): Promise<FetchedSitemap> {
    let response: Response;

    try {
      response = await fetch(options.url, {
        signal: AbortSignal.timeout(10000),
        headers: {
          Accept: "application/xml,text/xml"
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown fetch error.";
      throw new BadGatewayException(`Failed to fetch sitemap: ${message}`);
    }

    if (!response.ok) {
      throw new BadGatewayException(`Failed to fetch sitemap: upstream responded with ${response.status}.`);
    }

    const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
    if (!this.isSupportedSitemapContentType(contentType)) {
      throw new BadRequestException(`Unsupported sitemap content type: ${contentType || "unknown"}.`);
    }

    const xml = await response.text();
    const pageUrls = await this.resolvePageUrls(xml, options);
    const content = await this.buildCombinedContent(options.url, pageUrls);

    return {
      content
    };
  }

  extractPageUrls(xml: string, options: ExtractSitemapOptions) {
    const normalizedXml = xml.trim();
    if (!normalizedXml) {
      throw new BadRequestException("Sitemap payload is empty.");
    }

    if (!/<urlset\b/i.test(normalizedXml)) {
      throw new BadRequestException("Unsupported sitemap format. Only direct urlset sitemaps are supported.");
    }

    const extractedUrls = [...normalizedXml.matchAll(/<url\b[^>]*>[\s\S]*?<loc\b[^>]*>([\s\S]*?)<\/loc>[\s\S]*?<\/url>/gi)]
      .map(match => this.decodeEntities(this.stripCdata(match[1])).trim())
      .filter(url => this.isHttpUrl(url));

    const uniqueUrls = [...new Set(extractedUrls)].slice(0, options.maxPages);

    if (!uniqueUrls.length) {
      throw new BadRequestException("Extracted sitemap page URLs are empty.");
    }

    return uniqueUrls;
  }

  private async resolvePageUrls(xml: string, options: ExtractSitemapOptions) {
    const normalizedXml = xml.trim();
    if (!normalizedXml) {
      throw new BadRequestException("Sitemap payload is empty.");
    }

    if (/<urlset\b/i.test(normalizedXml)) {
      return this.extractPageUrls(normalizedXml, options);
    }

    if (!/<sitemapindex\b/i.test(normalizedXml)) {
      throw new BadRequestException(
        "Unsupported sitemap format. Only direct urlset and one-level sitemapindex payloads are supported."
      );
    }

    const childSitemapUrls = this.extractChildSitemapUrls(normalizedXml);
    if (!childSitemapUrls.length) {
      throw new BadRequestException("Extracted sitemap child URLs are empty.");
    }

    const collectedPageUrls: string[] = [];
    const seenPageUrls = new Set<string>();

    for (const childSitemapUrl of childSitemapUrls.slice(0, MAX_CHILD_SITEMAPS)) {
      if (collectedPageUrls.length >= options.maxPages) {
        break;
      }

      const childXml = await this.fetchSitemapXml(childSitemapUrl);
      const normalizedChildXml = childXml.trim();

      if (/<sitemapindex\b/i.test(normalizedChildXml)) {
        throw new BadRequestException("Nested sitemap indexes are not supported.");
      }

      const childPageUrls = this.extractPageUrls(normalizedChildXml, {
        ...options,
        url: childSitemapUrl,
        maxPages: options.maxPages
      });

      for (const pageUrl of childPageUrls) {
        if (seenPageUrls.has(pageUrl)) {
          continue;
        }

        seenPageUrls.add(pageUrl);
        collectedPageUrls.push(pageUrl);

        if (collectedPageUrls.length >= options.maxPages) {
          break;
        }
      }
    }

    if (!collectedPageUrls.length) {
      throw new BadRequestException("Extracted sitemap page URLs are empty.");
    }

    return collectedPageUrls;
  }

  private async buildCombinedContent(sourceUrl: string, pageUrls: string[]) {
    const lines = [`Sitemap Source URL: ${sourceUrl}`];

    for (const [index, pageUrl] of pageUrls.entries()) {
      let fetchedPage;

      try {
        fetchedPage = await this.webPageService.fetchWebPage(pageUrl);
      } catch (error) {
        if (error instanceof BadRequestException || error instanceof BadGatewayException) {
          throw error;
        }

        const message = error instanceof Error ? error.message : "Unknown fetch error.";
        throw new BadGatewayException(`Failed to fetch sitemap page: ${message}`);
      }

      const entryLines = [`Page ${index + 1}: ${pageUrl}`];

      if (fetchedPage.title) {
        entryLines.push(`Title: ${fetchedPage.title}`);
      }

      entryLines.push(`Content:\n${fetchedPage.content}`);
      lines.push(entryLines.join("\n"));
    }

    const content = lines.join("\n\n").trim();
    if (!content) {
      throw new BadRequestException("Extracted sitemap content is empty.");
    }

    return content;
  }

  private isSupportedSitemapContentType(contentType: string) {
    return contentType.startsWith("application/xml") || contentType.startsWith("text/xml");
  }

  private extractChildSitemapUrls(xml: string) {
    return [...xml.matchAll(/<sitemap\b[^>]*>[\s\S]*?<loc\b[^>]*>([\s\S]*?)<\/loc>[\s\S]*?<\/sitemap>/gi)]
      .map(match => this.decodeEntities(this.stripCdata(match[1])).trim())
      .filter(url => this.isHttpUrl(url))
      .filter((url, index, urls) => urls.indexOf(url) === index);
  }

  private isHttpUrl(value: string) {
    try {
      const parsed = new URL(value);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  }

  private stripCdata(value: string) {
    return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  }

  private decodeEntities(value: string) {
    return value
      .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
      .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&apos;/gi, "'");
  }

  private async fetchSitemapXml(url: string) {
    let response: Response;

    try {
      response = await fetch(url, {
        signal: AbortSignal.timeout(10000),
        headers: {
          Accept: "application/xml,text/xml"
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown fetch error.";
      throw new BadGatewayException(`Failed to fetch sitemap: ${message}`);
    }

    if (!response.ok) {
      throw new BadGatewayException(`Failed to fetch sitemap: upstream responded with ${response.status}.`);
    }

    const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
    if (!this.isSupportedSitemapContentType(contentType)) {
      throw new BadRequestException(`Unsupported sitemap content type: ${contentType || "unknown"}.`);
    }

    return response.text();
  }
}
