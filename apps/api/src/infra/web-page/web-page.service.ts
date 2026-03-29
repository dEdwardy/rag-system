import { BadGatewayException, BadRequestException, Injectable } from "@nestjs/common";
import { fetchWithRetry, resolveSourceFetchRuntimeConfig } from "../http/fetch-with-retry";

type FetchedWebPage = {
  title: string | null;
  content: string;
  diagnostics: WebPageFetchDiagnostics | null;
};

type WebPageFetchDiagnostics = {
  sourceKind: "web";
  schemaVersion: 2;
  contentTypeFallbackApplied: boolean;
  upstreamContentType: string;
  partial: boolean;
};

@Injectable()
export class WebPageService {
  async fetchWebPage(url: string) {
    let response: Response;
    const fetchConfig = resolveSourceFetchRuntimeConfig();

    try {
      response = await fetchWithRetry({
        url,
        timeoutMs: fetchConfig.timeoutMs,
        attempts: fetchConfig.attempts,
        headers: {
          Accept: "text/html,application/xhtml+xml"
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown fetch error.";
      throw new BadGatewayException(`Failed to fetch web page: ${message}`);
    }

    if (!response.ok) {
      throw this.buildUpstreamFetchError("Failed to fetch web page", response.status);
    }

    const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
    const diagnosticsContentType = this.normalizeDiagnosticsContentType(contentType);
    const payload = await response.text();
    const htmlPayloadByFallback = this.isFallbackSniffingContentType(contentType) && this.looksLikeHtmlPayload(payload);

    if (!this.isHtmlContentType(contentType) && !htmlPayloadByFallback) {
      throw new BadRequestException(`Unsupported web page content type: ${contentType || "unknown"}.`);
    }

    const extracted = this.extractFromHtml(payload);

    return {
      ...extracted,
      diagnostics: htmlPayloadByFallback
        ? {
            sourceKind: "web",
            schemaVersion: 2,
            contentTypeFallbackApplied: true,
            upstreamContentType: diagnosticsContentType,
            partial: true
          }
        : null
    };
  }

  extractFromHtml(html: string): FetchedWebPage {
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? this.normalizeInlineText(titleMatch[1]) : null;

    const stripped = html
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<(script|style|noscript|svg|iframe)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
      .replace(/<(br|\/p|\/div|\/section|\/article|\/main|\/li|\/ul|\/ol|\/h[1-6]|\/header|\/footer|\/table|\/tr)\s*>/gi, "\n")
      .replace(/<[^>]+>/g, " ");

    const content = this.normalizeBlockText(stripped);
    if (!content) {
      throw new BadRequestException("Extracted web page content is empty.");
    }

    return {
      title: title || null,
      content,
      diagnostics: null
    };
  }

  private isHtmlContentType(contentType: string) {
    return contentType.startsWith("text/html") || contentType.startsWith("application/xhtml+xml");
  }

  private isFallbackSniffingContentType(contentType: string) {
    return !contentType || contentType.startsWith("text/plain");
  }

  private looksLikeHtmlPayload(payload: string) {
    return /<!doctype\s+html\b|<html\b|<head\b|<body\b|<title\b/i.test(payload);
  }

  private normalizeDiagnosticsContentType(contentType: string) {
    if (!contentType) {
      return "unknown";
    }

    return contentType
      .split(";")
      .map(part => part.trim())
      .filter(Boolean)
      .join("; ");
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

  private normalizeInlineText(value: string) {
    return this.decodeHtmlEntities(value)
      .replace(/\s+/g, " ")
      .trim();
  }

  private normalizeBlockText(value: string) {
    return this.decodeHtmlEntities(value)
      .replace(/\r\n/g, "\n")
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n[ \t]+/g, "\n")
      .replace(/[ \t]{2,}/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  private decodeHtmlEntities(value: string) {
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
