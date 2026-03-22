import { BadGatewayException, BadRequestException, Injectable } from "@nestjs/common";
import { fetchWithRetry } from "../http/fetch-with-retry";
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
  diagnostics: SitemapFetchDiagnostics | null;
};

type SitemapFetchDiagnostics = {
  attemptedPageCount: number;
  succeededPageCount: number;
  failedPageCount: number;
  failedPageUrls: string[];
  failedPages?: Array<{
    url: string;
    message: string;
    retryable: boolean;
  }>;
  failedPagesTruncated?: boolean;
  failedPagesOmittedCount?: number;
  partial: boolean;
  attemptedChildSitemapCount?: number;
  succeededChildSitemapCount?: number;
  failedChildSitemapCount?: number;
  failedChildSitemapUrls?: string[];
  failedChildSitemaps?: Array<{
    url: string;
    message: string;
    retryable: boolean;
  }>;
  failedChildSitemapsTruncated?: boolean;
  failedChildSitemapsOmittedCount?: number;
};

type PageFetchFailure = {
  url: string;
  error: unknown;
};

type ChildSitemapFailure = {
  url: string;
  error: unknown;
};

type ResolvedSitemapPages = {
  pageUrls: string[];
  diagnostics: Pick<
    SitemapFetchDiagnostics,
    | "attemptedChildSitemapCount"
    | "succeededChildSitemapCount"
    | "failedChildSitemapCount"
    | "failedChildSitemapUrls"
    | "failedChildSitemaps"
    | "partial"
  > | null;
};

// Keep sitemap-index expansion bounded so one request cannot fan out indefinitely.
const MAX_CHILD_SITEMAPS = 20;
const MAX_FAILURE_SUMMARY_ITEMS = 10;

@Injectable()
export class SitemapSourceService {
  constructor(private readonly webPageService: WebPageService) {}

  async fetchSitemap(options: FetchSitemapOptions): Promise<FetchedSitemap> {
    let response: Response;

    try {
      response = await fetchWithRetry({
        url: options.url,
        timeoutMs: 10000,
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
    const resolvedSitemap = await this.resolvePageUrls(xml, options);
    const builtSitemap = await this.buildCombinedContent(
      options.url,
      resolvedSitemap.pageUrls,
      resolvedSitemap.diagnostics
    );

    return {
      content: builtSitemap.content,
      diagnostics: builtSitemap.diagnostics
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

  private async resolvePageUrls(xml: string, options: ExtractSitemapOptions): Promise<ResolvedSitemapPages> {
    const normalizedXml = xml.trim();
    if (!normalizedXml) {
      throw new BadRequestException("Sitemap payload is empty.");
    }

    if (/<urlset\b/i.test(normalizedXml)) {
      return {
        pageUrls: this.extractPageUrls(normalizedXml, options),
        diagnostics: null
      };
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
    const failedChildSitemapUrls: string[] = [];
    const childSitemapFailures: ChildSitemapFailure[] = [];
    let succeededChildSitemapCount = 0;

    for (const childSitemapUrl of childSitemapUrls.slice(0, MAX_CHILD_SITEMAPS)) {
      if (collectedPageUrls.length >= options.maxPages) {
        break;
      }

      let childXml: string;

      try {
        childXml = await this.fetchSitemapXml(childSitemapUrl);
      } catch (error) {
        failedChildSitemapUrls.push(childSitemapUrl);
        childSitemapFailures.push({
          url: childSitemapUrl,
          error: this.normalizeChildSitemapFetchError(error)
        });
        continue;
      }

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

      succeededChildSitemapCount += 1;
    }

    if (!collectedPageUrls.length) {
      if (failedChildSitemapUrls.length > 0) {
        throw this.buildAllChildSitemapsFailedError(childSitemapFailures);
      }

      throw new BadRequestException("Extracted sitemap page URLs are empty.");
    }

    return {
      pageUrls: collectedPageUrls,
      diagnostics:
        failedChildSitemapUrls.length > 0
          ? {
              ...this.buildFailureSummary(
                childSitemapFailures,
                "failedChildSitemaps",
                "failedChildSitemapsTruncated",
                "failedChildSitemapsOmittedCount",
                failure => ({
                  url: failure.url,
                  message: this.getErrorMessage(failure.error),
                  retryable: this.isRetryableFetchError(failure.error)
                })
              ),
              attemptedChildSitemapCount: childSitemapUrls.slice(0, MAX_CHILD_SITEMAPS).length,
              succeededChildSitemapCount,
              failedChildSitemapCount: failedChildSitemapUrls.length,
              failedChildSitemapUrls: failedChildSitemapUrls.slice(0, MAX_FAILURE_SUMMARY_ITEMS),
              partial: true
            }
          : null
    };
  }

  private async buildCombinedContent(
    sourceUrl: string,
    pageUrls: string[],
    existingDiagnostics: ResolvedSitemapPages["diagnostics"] = null
  ) {
    const lines = [`Sitemap Source URL: ${sourceUrl}`];
    const failedPageUrls: string[] = [];
    const pageFailures: PageFetchFailure[] = [];
    let succeededPageCount = 0;

    for (const [index, pageUrl] of pageUrls.entries()) {
      let fetchedPage;

      try {
        fetchedPage = await this.webPageService.fetchWebPage(pageUrl);
      } catch (error) {
        failedPageUrls.push(pageUrl);
        pageFailures.push({
          url: pageUrl,
          error: this.normalizePageFetchError(error)
        });
        continue;
      }

      const entryLines = [`Page ${index + 1}: ${pageUrl}`];

      if (fetchedPage.title) {
        entryLines.push(`Title: ${fetchedPage.title}`);
      }

      entryLines.push(`Content:\n${fetchedPage.content}`);
      lines.push(entryLines.join("\n"));
      succeededPageCount += 1;
    }

    const content = lines.join("\n\n").trim();
    if (succeededPageCount === 0) {
      throw this.buildAllPagesFailedError(pageFailures);
    }

    if (!content) {
      throw new BadRequestException("Extracted sitemap content is empty.");
    }

    const diagnostics =
      failedPageUrls.length > 0 || existingDiagnostics?.partial
        ? {
            ...this.buildFailureSummary(
              pageFailures,
              "failedPages",
              "failedPagesTruncated",
              "failedPagesOmittedCount",
              failure => ({
                url: failure.url,
                message: this.getErrorMessage(failure.error),
                retryable: this.isRetryableFetchError(failure.error)
              })
            ),
            attemptedPageCount: pageUrls.length,
            succeededPageCount,
            failedPageCount: failedPageUrls.length,
            failedPageUrls: failedPageUrls.slice(0, MAX_FAILURE_SUMMARY_ITEMS),
            partial: true,
            ...(existingDiagnostics ?? {})
          }
        : null;

    return {
      content,
      diagnostics
    };
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
      response = await fetchWithRetry({
        url,
        timeoutMs: 10000,
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

  private normalizePageFetchError(error: unknown) {
    if (error instanceof BadRequestException || error instanceof BadGatewayException) {
      return error;
    }

    const message = error instanceof Error ? error.message : "Unknown fetch error.";
    return new BadGatewayException(`Failed to fetch sitemap page: ${message}`);
  }

  private normalizeChildSitemapFetchError(error: unknown) {
    if (error instanceof BadRequestException || error instanceof BadGatewayException) {
      return error;
    }

    const message = error instanceof Error ? error.message : "Unknown fetch error.";
    return new BadGatewayException(`Failed to fetch sitemap: ${message}`);
  }

  private buildAllPagesFailedError(pageFailures: PageFetchFailure[]) {
    const firstFailure = pageFailures[0]?.error;
    const message = "Failed to fetch sitemap pages: all sitemap pages failed.";

    if (firstFailure instanceof BadRequestException) {
      return new BadRequestException(message);
    }

    if (firstFailure instanceof BadGatewayException) {
      return new BadGatewayException(message);
    }

    return new BadGatewayException(message);
  }

  private buildAllChildSitemapsFailedError(childSitemapFailures: ChildSitemapFailure[]) {
    const firstFailure = childSitemapFailures[0]?.error;
    const message = "Failed to fetch sitemap index children: all child sitemap fetches failed.";

    if (firstFailure instanceof BadRequestException) {
      return new BadRequestException(message);
    }

    if (firstFailure instanceof BadGatewayException) {
      return new BadGatewayException(message);
    }

    return new BadGatewayException(message);
  }

  private getErrorMessage(error: unknown) {
    if (error instanceof Error) {
      return error.message;
    }

    return "Unknown fetch error.";
  }

  private isRetryableFetchError(error: unknown) {
    return !(error instanceof BadRequestException);
  }

  private buildFailureSummary<T, TResult>(
    failures: T[],
    itemsKey: string,
    truncatedKey: string,
    omittedCountKey: string,
    mapItem: (failure: T) => TResult
  ) {
    const items = failures.slice(0, MAX_FAILURE_SUMMARY_ITEMS).map(mapItem);
    const omittedCount = Math.max(0, failures.length - items.length);

    return {
      [itemsKey]: items,
      [truncatedKey]: omittedCount > 0,
      [omittedCountKey]: omittedCount
    };
  }
}
