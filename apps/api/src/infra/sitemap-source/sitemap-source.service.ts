import { BadGatewayException, BadRequestException, Injectable } from "@nestjs/common";
import {
  assertRobotsAllowUrl,
  fetchWithRetry,
  isUrlWithinDomainBoundary,
  isRetryableFetchException,
  normalizeSourceFetchFailureMessage,
  resolveSourceFetchRuntimeConfig
} from "../http/fetch-with-retry";
import { WebPageService } from "../web-page/web-page.service";

type FetchSitemapOptions = {
  url: string;
  maxPages: number;
};

type ExtractSitemapOptions = {
  url: string;
  maxPages: number;
  sourceBoundaryUrl?: string;
};

type FetchedSitemap = {
  content: string;
  diagnostics: SitemapFetchDiagnostics | null;
};

type SitemapFetchDiagnostics = {
  sourceKind: "sitemap";
  schemaVersion: 2;
  retryable: boolean;
  contentTypeFallbackApplied: boolean;
  upstreamContentType: string;
  attemptedPageCount: number;
  succeededPageCount: number;
  failedPageCount: number;
  retryableFailureCount: number;
  nonRetryableFailureCount: number;
  failedPageUrls: string[];
  failedPages: Array<{
    url: string;
    code: string;
    message: string;
    retryable: boolean;
  }>;
  failedPagesTruncated: boolean;
  failedPagesOmittedCount: number;
  partial: boolean;
  attemptedChildSitemapCount: number;
  succeededChildSitemapCount: number;
  failedChildSitemapCount: number;
  failedChildSitemapUrls: string[];
  failedChildSitemaps: Array<{
    url: string;
    code: string;
    message: string;
    retryable: boolean;
  }>;
  failedChildSitemapsTruncated: boolean;
  failedChildSitemapsOmittedCount: number;
  boundaryHit: boolean;
  boundaryReasons: string[];
  boundary: {
    maxPages: number;
    maxChildSitemaps: number;
    totalExtractedPageUrlCount: number;
    selectedPageUrlCount: number;
    droppedPageUrlCount: number;
    totalExtractedChildSitemapCount: number;
    selectedChildSitemapCount: number;
    droppedChildSitemapCount: number;
  };
};

type PageFetchFailure = {
  url: string;
  error: unknown;
};

type ChildSitemapFailure = {
  url: string;
  error: unknown;
};

type ExtractPageUrlsResult = {
  urls: string[];
  totalExtractedCount: number;
};

type SitemapPayloadAcceptance = {
  contentTypeFallbackApplied: boolean;
  upstreamContentType: string;
};

type ResolvedSitemapPages = {
  pageUrls: string[];
  diagnostics:
    | Partial<
        Pick<
          SitemapFetchDiagnostics,
          | "attemptedPageCount"
          | "succeededPageCount"
          | "failedPageCount"
          | "failedPageUrls"
          | "attemptedChildSitemapCount"
          | "succeededChildSitemapCount"
          | "failedChildSitemapCount"
          | "failedChildSitemapUrls"
          | "failedChildSitemaps"
          | "retryable"
          | "partial"
          | "retryableFailureCount"
          | "nonRetryableFailureCount"
          | "boundaryHit"
          | "boundaryReasons"
          | "boundary"
        >
      >
    | null;
};

// Keep sitemap-index expansion bounded so one request cannot fan out indefinitely.
const MAX_CHILD_SITEMAPS = 20;
const MAX_FAILURE_SUMMARY_ITEMS = 10;
const SITEMAP_BOUNDARY_REASON_MAX_PAGES_REACHED = "MAX_PAGES_REACHED";
const SITEMAP_BOUNDARY_REASON_MAX_CHILD_SITEMAPS_REACHED = "MAX_CHILD_SITEMAPS_REACHED";
const NESTED_SITEMAP_INDEX_UNSUPPORTED_MESSAGE = "Nested sitemap indexes are not supported.";
const URLSET_TAG_PATTERN = /<(?:[a-z0-9_-]+:)?urlset\b/i;
const SITEMAP_INDEX_TAG_PATTERN = /<(?:[a-z0-9_-]+:)?sitemapindex\b/i;
const SITEMAP_URL_ENTRY_PATTERN =
  /<(?:[a-z0-9_-]+:)?url\b[^>]*>[\s\S]*?<(?:[a-z0-9_-]+:)?loc\b[^>]*>([\s\S]*?)<\/(?:[a-z0-9_-]+:)?loc>[\s\S]*?<\/(?:[a-z0-9_-]+:)?url>/gi;
const CHILD_SITEMAP_ENTRY_PATTERN =
  /<(?:[a-z0-9_-]+:)?sitemap\b[^>]*>[\s\S]*?<(?:[a-z0-9_-]+:)?loc\b[^>]*>([\s\S]*?)<\/(?:[a-z0-9_-]+:)?loc>[\s\S]*?<\/(?:[a-z0-9_-]+:)?sitemap>/gi;

@Injectable()
export class SitemapSourceService {
  constructor(private readonly webPageService: WebPageService) {}

  async fetchSitemap(options: FetchSitemapOptions): Promise<FetchedSitemap> {
    let response: Response;
    const fetchConfig = resolveSourceFetchRuntimeConfig();

    try {
      await assertRobotsAllowUrl(options.url);
      response = await fetchWithRetry({
        url: options.url,
        timeoutMs: fetchConfig.timeoutMs,
        attempts: fetchConfig.attempts,
        headers: {
          Accept: "application/xml,text/xml"
        }
      });
    } catch (error) {
      throw this.buildFetchException("Failed to fetch sitemap", error);
    }

    if (!response.ok) {
      throw this.buildUpstreamFetchError("Failed to fetch sitemap", response.status);
    }

    const xml = await response.text();
    const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
    const payloadAcceptance = this.assertSupportedSitemapPayload(contentType, xml);
    const resolvedSitemap = await this.resolvePageUrls(xml, options, payloadAcceptance);
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
    return this.extractPageUrlsWithStats(xml, options).urls;
  }

  private extractPageUrlsWithStats(xml: string, options: ExtractSitemapOptions): ExtractPageUrlsResult {
    const normalizedXml = xml.trim();
    if (!normalizedXml) {
      throw new BadRequestException("Sitemap payload is empty.");
    }

    if (!URLSET_TAG_PATTERN.test(normalizedXml)) {
      throw new BadRequestException("Unsupported sitemap format. Only direct urlset sitemaps are supported.");
    }

    const extractedUrls = [...normalizedXml.matchAll(SITEMAP_URL_ENTRY_PATTERN)]
      .map(match => this.decodeEntities(this.stripCdata(match[1])).trim())
      .filter(url => this.isHttpUrl(url));
    const sourceBoundaryUrl = options.sourceBoundaryUrl ?? options.url;

    for (const extractedUrl of extractedUrls) {
      this.assertSitemapUrlWithinDomainBoundary(extractedUrl, sourceBoundaryUrl, "page");
    }

    const allUniqueUrls = this.deduplicateSitemapUrls(extractedUrls);
    const selectedUrls = allUniqueUrls.slice(0, options.maxPages);

    if (!selectedUrls.length) {
      throw new BadRequestException("Extracted sitemap page URLs are empty.");
    }

    return {
      urls: selectedUrls,
      totalExtractedCount: allUniqueUrls.length
    };
  }

  private async resolvePageUrls(
    xml: string,
    options: ExtractSitemapOptions,
    rootPayloadAcceptance: SitemapPayloadAcceptance
  ): Promise<ResolvedSitemapPages> {
    const normalizedXml = xml.trim();
    if (!normalizedXml) {
      throw new BadRequestException("Sitemap payload is empty.");
    }

    if (URLSET_TAG_PATTERN.test(normalizedXml)) {
      const extracted = this.extractPageUrlsWithStats(normalizedXml, options);
      const droppedPageUrlCount = Math.max(0, extracted.totalExtractedCount - extracted.urls.length);
      const boundaryHit = droppedPageUrlCount > 0;
      return {
        pageUrls: extracted.urls,
        diagnostics:
          boundaryHit || rootPayloadAcceptance.contentTypeFallbackApplied
            ? {
                retryable: false,
                partial: true,
                attemptedPageCount: extracted.urls.length,
                succeededPageCount: extracted.urls.length,
                failedPageCount: 0,
                failedPageUrls: [],
                retryableFailureCount: 0,
                nonRetryableFailureCount: 0,
                contentTypeFallbackApplied: rootPayloadAcceptance.contentTypeFallbackApplied,
                upstreamContentType: rootPayloadAcceptance.upstreamContentType,
                boundaryHit,
                boundaryReasons: boundaryHit ? [SITEMAP_BOUNDARY_REASON_MAX_PAGES_REACHED] : [],
                boundary: {
                  maxPages: options.maxPages,
                  maxChildSitemaps: MAX_CHILD_SITEMAPS,
                  totalExtractedPageUrlCount: extracted.totalExtractedCount,
                  selectedPageUrlCount: extracted.urls.length,
                  droppedPageUrlCount,
                  totalExtractedChildSitemapCount: 0,
                  selectedChildSitemapCount: 0,
                  droppedChildSitemapCount: 0
                },
                attemptedChildSitemapCount: 0,
                succeededChildSitemapCount: 0,
                failedChildSitemapCount: 0,
                failedChildSitemapUrls: [],
                failedChildSitemaps: [],
                failedChildSitemapsTruncated: false,
                failedChildSitemapsOmittedCount: 0,
                failedPages: [],
                failedPagesTruncated: false,
                failedPagesOmittedCount: 0
              }
            : null
      };
    }

    if (!SITEMAP_INDEX_TAG_PATTERN.test(normalizedXml)) {
      throw new BadRequestException(
        "Unsupported sitemap format. Only direct urlset and one-level sitemapindex payloads are supported."
      );
    }

    const childSitemapUrls = this.extractChildSitemapUrls(normalizedXml, options.url);
    if (!childSitemapUrls.length) {
      throw new BadRequestException("Extracted sitemap child URLs are empty.");
    }
    const selectedChildSitemapUrls = childSitemapUrls.slice(0, MAX_CHILD_SITEMAPS);
    const droppedChildSitemapCount = Math.max(0, childSitemapUrls.length - selectedChildSitemapUrls.length);

    const collectedPageUrls: string[] = [];
    const seenPageUrls = new Set<string>();
    const failedChildSitemapUrls: string[] = [];
    const childSitemapFailures: ChildSitemapFailure[] = [];
    let succeededChildSitemapCount = 0;
    let maxPagesLimitReached = false;
    let totalExtractedPageUrlCount = 0;
    let droppedPageUrlCount = 0;
    let contentTypeFallbackApplied = rootPayloadAcceptance.contentTypeFallbackApplied;
    let fallbackUpstreamContentType = rootPayloadAcceptance.upstreamContentType;

    for (const childSitemapUrl of selectedChildSitemapUrls) {
      if (collectedPageUrls.length >= options.maxPages) {
        maxPagesLimitReached = true;
        break;
      }

      let childXml: string;

      try {
        const childSitemapResult = await this.fetchSitemapXml(childSitemapUrl);
        childXml = childSitemapResult.xml;
        if (childSitemapResult.contentTypeFallbackApplied) {
          contentTypeFallbackApplied = true;
          fallbackUpstreamContentType = childSitemapResult.upstreamContentType;
        }
      } catch (error) {
        failedChildSitemapUrls.push(childSitemapUrl);
        childSitemapFailures.push({
          url: childSitemapUrl,
          error: this.normalizeChildSitemapFetchError(error)
        });
        continue;
      }

      const normalizedChildXml = childXml.trim();

      if (SITEMAP_INDEX_TAG_PATTERN.test(normalizedChildXml)) {
        // Keep nested sitemapindex payloads as an explicit unsupported boundary (one-level only).
        throw new BadRequestException(NESTED_SITEMAP_INDEX_UNSUPPORTED_MESSAGE);
      }

      const extractedChildPageUrls = this.extractPageUrlsWithStats(normalizedChildXml, {
        ...options,
        url: childSitemapUrl,
        maxPages: options.maxPages,
        sourceBoundaryUrl: options.url
      });
      totalExtractedPageUrlCount += extractedChildPageUrls.totalExtractedCount;

      for (const pageUrl of extractedChildPageUrls.urls) {
        const pageDedupKey = this.normalizeSitemapUrlForDedup(pageUrl);
        if (seenPageUrls.has(pageDedupKey)) {
          continue;
        }

        if (collectedPageUrls.length >= options.maxPages) {
          maxPagesLimitReached = true;
          droppedPageUrlCount += 1;
          break;
        }

        seenPageUrls.add(pageDedupKey);
        collectedPageUrls.push(pageUrl);
      }

      succeededChildSitemapCount += 1;
    }

    if (!collectedPageUrls.length) {
      if (failedChildSitemapUrls.length > 0) {
        throw this.buildAllChildSitemapsFailedError(childSitemapFailures);
      }

      throw new BadRequestException("Extracted sitemap page URLs are empty.");
    }

    const retryableFailureCount = childSitemapFailures.reduce(
      (count, failure) => count + (this.isRetryableFetchError(failure.error) ? 1 : 0),
      0
    );
    const nonRetryableFailureCount = childSitemapFailures.length - retryableFailureCount;
    const boundaryHit = droppedChildSitemapCount > 0 || maxPagesLimitReached;
    const boundaryReasons = [
      ...(maxPagesLimitReached ? [SITEMAP_BOUNDARY_REASON_MAX_PAGES_REACHED] : []),
      ...(droppedChildSitemapCount > 0 ? [SITEMAP_BOUNDARY_REASON_MAX_CHILD_SITEMAPS_REACHED] : [])
    ];

    return {
      pageUrls: collectedPageUrls,
      diagnostics:
        failedChildSitemapUrls.length > 0 || boundaryHit || contentTypeFallbackApplied
          ? {
              ...this.buildFailureSummary(
                childSitemapFailures,
                "failedChildSitemaps",
                "failedChildSitemapsTruncated",
                "failedChildSitemapsOmittedCount",
                failure => ({
                  url: failure.url,
                  code: this.getFailureCode(failure.error),
                  message: this.getErrorMessage(failure.error),
                  retryable: this.isRetryableFetchError(failure.error)
                })
              ),
                attemptedChildSitemapCount: selectedChildSitemapUrls.length,
                succeededChildSitemapCount,
                failedChildSitemapCount: failedChildSitemapUrls.length,
                failedChildSitemapUrls: failedChildSitemapUrls.slice(0, MAX_FAILURE_SUMMARY_ITEMS),
                retryableFailureCount,
                nonRetryableFailureCount,
                retryable: retryableFailureCount > 0,
                contentTypeFallbackApplied: contentTypeFallbackApplied,
                upstreamContentType: fallbackUpstreamContentType,
                boundaryHit,
                boundaryReasons,
                boundary: {
                  maxPages: options.maxPages,
                  maxChildSitemaps: MAX_CHILD_SITEMAPS,
                  totalExtractedPageUrlCount,
                  selectedPageUrlCount: collectedPageUrls.length,
                  droppedPageUrlCount,
                  totalExtractedChildSitemapCount: childSitemapUrls.length,
                  selectedChildSitemapCount: selectedChildSitemapUrls.length,
                  droppedChildSitemapCount
                },
                partial: true,
                attemptedPageCount: 0,
                succeededPageCount: 0,
                failedPageCount: 0,
                failedPageUrls: [],
                failedPages: [],
                failedPagesTruncated: false,
                failedPagesOmittedCount: 0
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

    const pageRetryableFailureCount = pageFailures.reduce(
      (count, failure) => count + (this.isRetryableFetchError(failure.error) ? 1 : 0),
      0
    );
    const pageNonRetryableFailureCount = pageFailures.length - pageRetryableFailureCount;

    const diagnostics = failedPageUrls.length > 0 || existingDiagnostics?.partial
        ? {
            ...(existingDiagnostics ?? {
              attemptedChildSitemapCount: 0,
              succeededChildSitemapCount: 0,
              failedChildSitemapCount: 0,
              failedChildSitemapUrls: [],
              failedChildSitemaps: [],
              failedChildSitemapsTruncated: false,
              failedChildSitemapsOmittedCount: 0,
              contentTypeFallbackApplied: false,
              upstreamContentType: "unknown"
            }),
            ...this.buildFailureSummary(
              pageFailures,
              "failedPages",
              "failedPagesTruncated",
              "failedPagesOmittedCount",
              failure => ({
                url: failure.url,
                code: this.getFailureCode(failure.error),
                message: this.getErrorMessage(failure.error),
                retryable: this.isRetryableFetchError(failure.error)
              })
            ),
            attemptedPageCount: pageUrls.length,
            succeededPageCount,
            failedPageCount: failedPageUrls.length,
            failedPageUrls: failedPageUrls.slice(0, MAX_FAILURE_SUMMARY_ITEMS),
            retryableFailureCount: pageRetryableFailureCount + (existingDiagnostics?.retryableFailureCount ?? 0),
            nonRetryableFailureCount:
              pageNonRetryableFailureCount + (existingDiagnostics?.nonRetryableFailureCount ?? 0),
            retryable:
              pageFailures.some(failure => this.isRetryableFetchError(failure.error)) ||
              existingDiagnostics?.retryable === true,
            partial: true,
            boundaryHit: existingDiagnostics?.boundaryHit ?? false,
            boundaryReasons: existingDiagnostics?.boundaryReasons ?? [],
            boundary: existingDiagnostics?.boundary ?? {
              maxPages: pageUrls.length,
              maxChildSitemaps: MAX_CHILD_SITEMAPS,
              totalExtractedPageUrlCount: pageUrls.length,
              selectedPageUrlCount: pageUrls.length,
              droppedPageUrlCount: 0,
              totalExtractedChildSitemapCount: existingDiagnostics?.attemptedChildSitemapCount ?? 0,
              selectedChildSitemapCount: existingDiagnostics?.attemptedChildSitemapCount ?? 0,
              droppedChildSitemapCount: 0
            }
          }
        : null;

    return {
      content,
      diagnostics: diagnostics
        ? {
            ...diagnostics,
            sourceKind: "sitemap" as const,
            schemaVersion: 2 as const
          }
        : null
    };
  }

  private isSupportedSitemapContentType(contentType: string) {
    return contentType.startsWith("application/xml") || contentType.startsWith("text/xml");
  }

  private isContentTypeFallbackEligible(contentType: string) {
    return !contentType || contentType.startsWith("text/plain");
  }

  private looksLikeSitemapPayload(payload: string) {
    const normalizedPayload = payload.trim();
    return URLSET_TAG_PATTERN.test(normalizedPayload) || SITEMAP_INDEX_TAG_PATTERN.test(normalizedPayload);
  }

  private assertSupportedSitemapPayload(contentType: string, payload: string): SitemapPayloadAcceptance {
    if (this.isSupportedSitemapContentType(contentType)) {
      return {
        contentTypeFallbackApplied: false,
        upstreamContentType: contentType || "unknown"
      };
    }

    if (this.isContentTypeFallbackEligible(contentType) && this.looksLikeSitemapPayload(payload)) {
      return {
        contentTypeFallbackApplied: true,
        upstreamContentType: contentType || "unknown"
      };
    }

    throw new BadRequestException(`Unsupported sitemap content type: ${contentType || "unknown"}.`);
  }

  private extractChildSitemapUrls(xml: string, sourceBoundaryUrl: string) {
    const extractedChildSitemapUrls = [...xml.matchAll(CHILD_SITEMAP_ENTRY_PATTERN)]
      .map(match => this.decodeEntities(this.stripCdata(match[1])).trim())
      .filter(url => this.isHttpUrl(url));

    for (const childSitemapUrl of extractedChildSitemapUrls) {
      this.assertSitemapUrlWithinDomainBoundary(childSitemapUrl, sourceBoundaryUrl, "child sitemap");
    }

    return this.deduplicateSitemapUrls(extractedChildSitemapUrls);
  }

  private deduplicateSitemapUrls(urls: string[]) {
    const deduplicatedUrls: string[] = [];
    const seenKeys = new Set<string>();

    for (const url of urls) {
      const dedupKey = this.normalizeSitemapUrlForDedup(url);
      if (seenKeys.has(dedupKey)) {
        continue;
      }

      seenKeys.add(dedupKey);
      deduplicatedUrls.push(url);
    }

    return deduplicatedUrls;
  }

  private normalizeSitemapUrlForDedup(url: string) {
    const normalizedUrl = url.trim();

    if (!normalizedUrl) {
      return "";
    }

    try {
      const parsed = new URL(normalizedUrl);
      parsed.hash = "";
      return parsed.toString();
    } catch {
      return normalizedUrl;
    }
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

  private async fetchSitemapXml(url: string): Promise<{ xml: string } & SitemapPayloadAcceptance> {
    let response: Response;
    const fetchConfig = resolveSourceFetchRuntimeConfig();

    try {
      await assertRobotsAllowUrl(url);
      response = await fetchWithRetry({
        url,
        timeoutMs: fetchConfig.timeoutMs,
        attempts: fetchConfig.attempts,
        headers: {
          Accept: "application/xml,text/xml"
        }
      });
    } catch (error) {
      throw this.buildFetchException("Failed to fetch sitemap", error);
    }

    if (!response.ok) {
      throw this.buildUpstreamFetchError("Failed to fetch sitemap", response.status);
    }

    const xml = await response.text();
    const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
    const payloadAcceptance = this.assertSupportedSitemapPayload(contentType, xml);

    return {
      xml,
      ...payloadAcceptance
    };
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

  private buildUpstreamFetchError(prefix: string, status: number) {
    const message = `${prefix}: upstream responded with ${status}.`;
    return this.isRetryableUpstreamStatus(status)
      ? new BadGatewayException(message)
      : new BadRequestException(message);
  }

  private buildFetchException(prefix: string, error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown fetch error.";
    const normalizedMessage = normalizeSourceFetchFailureMessage(message);
    const wrappedMessage = `${prefix}: ${normalizedMessage}`;
    const retryable = error instanceof Error ? isRetryableFetchException(error) : true;

    return retryable ? new BadGatewayException(wrappedMessage) : new BadRequestException(wrappedMessage);
  }

  private isRetryableUpstreamStatus(status: number) {
    return status === 408 || status === 429 || status >= 500;
  }

  private buildAllPagesFailedError(pageFailures: PageFetchFailure[]) {
    const firstFailure = pageFailures[0]?.error;
    const firstFailedUrl = pageFailures[0]?.url ?? "unknown";
    const retryTimeoutDetail = this.readRetryTimeoutFailureDetail(firstFailure);
    const message =
      `Failed to fetch sitemap pages: all sitemap pages failed. First failed page URL: ${firstFailedUrl}.` +
      (retryTimeoutDetail ? ` Retry/timeout detail: ${retryTimeoutDetail}.` : "");

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
    const firstFailedUrl = childSitemapFailures[0]?.url ?? "unknown";
    const retryTimeoutDetail = this.readRetryTimeoutFailureDetail(firstFailure);
    const message =
      "Failed to fetch sitemap index children: all child sitemap fetches failed." +
      ` First failed child sitemap URL: ${firstFailedUrl}.` +
      (retryTimeoutDetail ? ` Retry/timeout detail: ${retryTimeoutDetail}.` : "");

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

  private readRetryTimeoutFailureDetail(error: unknown) {
    if (!(error instanceof Error)) {
      return null;
    }

    const normalizedMessage = normalizeSourceFetchFailureMessage(error.message)
      .replace(/^Failed to fetch\s+(web page|feed|sitemap):\s*/i, "")
      .trim();

    if (!normalizedMessage) {
      return null;
    }

    const isRetryTimeoutMessage = /timed out|timeout|fetch failed|network error/i.test(normalizedMessage);
    return isRetryTimeoutMessage ? normalizedMessage.replace(/[.]+$/g, "") : null;
  }

  private isRetryableFetchError(error: unknown) {
    return !(error instanceof BadRequestException);
  }

  private getFailureCode(error: unknown) {
    const message = this.getErrorMessage(error);

    if (message.startsWith("Unsupported web page content type:")) {
      return "UNSUPPORTED_CONTENT_TYPE";
    }

    if (message.startsWith("Unsupported sitemap content type:") || message.includes("payload is empty")) {
      return "INVALID_PAYLOAD";
    }

    if (message.startsWith("Failed to fetch sitemap: upstream responded with")) {
      return "UPSTREAM_FETCH_FAILED";
    }

    if (message.startsWith("Failed to fetch web page: upstream responded with")) {
      return "UPSTREAM_FETCH_FAILED";
    }

    return "UNKNOWN_FETCH_ERROR";
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

  private assertSitemapUrlWithinDomainBoundary(url: string, sourceBoundaryUrl: string, urlKind: "page" | "child sitemap") {
    if (isUrlWithinDomainBoundary(url, sourceBoundaryUrl)) {
      return;
    }

    throw new BadRequestException(
      `Sitemap ${urlKind} URL is outside source domain boundary: ${url}.`
    );
  }
}
