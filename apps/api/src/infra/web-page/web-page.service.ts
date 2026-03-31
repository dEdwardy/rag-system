import { BadGatewayException, BadRequestException, Injectable } from "@nestjs/common";
import {
  assertRobotsAllowUrl,
  fetchWithRetry,
  isRetryableFetchException,
  normalizeSourceFetchFailureMessage,
  resolveSourceFetchRuntimeConfig
} from "../http/fetch-with-retry";

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
  bodyMissing: boolean;
  bodyQualityLow: boolean;
  bodyReadabilitySignal?: "body_missing" | "body_quality_low" | "body_content_sparse" | "body_structure_poor";
  bodyTextLength: number;
  contentDensity: number;
  paragraphCount: number;
  hasHeadings: boolean;
  retryable: boolean;
  retryableFailureCount: number;
  nonRetryableFailureCount: number;
  partial: boolean;
};

const MIN_BODY_QUALITY_TEXT_LENGTH = 120;
const MIN_BODY_CONTENT_DENSITY = 0.3;
const MIN_PARAGRAPH_COUNT = 2;

@Injectable()
export class WebPageService {
  async fetchWebPage(url: string) {
    let response: Response;
    const fetchConfig = resolveSourceFetchRuntimeConfig();

    try {
      await assertRobotsAllowUrl(url);
      response = await fetchWithRetry({
        url,
        timeoutMs: fetchConfig.timeoutMs,
        attempts: fetchConfig.attempts,
        headers: {
          Accept: "text/html,application/xhtml+xml"
        }
      });
    } catch (error) {
      throw this.buildFetchException("Failed to fetch web page", error);
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
    const bodyQuality = this.buildBodyQualityDiagnostics(payload);
    const bodyReadabilitySignal = this.resolveBodyReadabilitySignal(bodyQuality);
    const partial = htmlPayloadByFallback || bodyQuality.bodyMissing || bodyQuality.bodyQualityLow;

    return {
      ...extracted,
      diagnostics: partial
        ? {
            sourceKind: "web",
            schemaVersion: 2,
            contentTypeFallbackApplied: htmlPayloadByFallback,
            upstreamContentType: diagnosticsContentType,
            bodyMissing: bodyQuality.bodyMissing,
            bodyQualityLow: bodyQuality.bodyQualityLow,
            ...(bodyReadabilitySignal ? { bodyReadabilitySignal } : {}),
            bodyTextLength: bodyQuality.bodyTextLength,
            contentDensity: bodyQuality.contentDensity,
            paragraphCount: bodyQuality.paragraphCount,
            hasHeadings: bodyQuality.hasHeadings,
            retryable: false,
            retryableFailureCount: 0,
            nonRetryableFailureCount: 0,
            partial: true
          }
        : null
    };
  }

  private resolveBodyReadabilitySignal(input: { bodyMissing: boolean; bodyQualityLow: boolean; contentDensity?: number; paragraphCount?: number; hasHeadings?: boolean }) {
    if (input.bodyMissing) {
      return "body_missing" as const;
    }

    if (input.bodyQualityLow) {
      // 更详细的质量问题信号
      if (input.contentDensity && input.contentDensity < MIN_BODY_CONTENT_DENSITY) {
        return "body_content_sparse" as const;
      }
      if ((input.paragraphCount && input.paragraphCount < MIN_PARAGRAPH_COUNT) || !input.hasHeadings) {
        return "body_structure_poor" as const;
      }
      return "body_quality_low" as const;
    }

    return null;
  }

  extractFromHtml(html: string): FetchedWebPage {
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? this.normalizeInlineText(titleMatch[1]) : null;

    const stripped = this.stripHtmlToText(html);

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

  private buildBodyQualityDiagnostics(html: string) {
    const bodyMatch = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
    const bodyMissing = !bodyMatch;
    const bodyContent = bodyMatch ? bodyMatch[1] : "";
    const bodyText = this.normalizeBlockText(this.stripHtmlToText(bodyContent));
    const bodyTextLength = bodyText.length;
    
    // 计算内容密度（文本长度与HTML长度的比值）
    const bodyHtmlLength = bodyContent.length;
    const contentDensity = bodyHtmlLength > 0 ? bodyTextLength / bodyHtmlLength : 0;
    
    // 计算段落数量
    const paragraphCount = (bodyContent.match(/<p\b[^>]*>|<br\s*\/>|<\/p>/gi) || []).length;
    
    // 检查标题层级结构
    const hasHeadings = /<h[1-6]\b[^>]*>/i.test(bodyContent);
    
    // 综合评估正文质量
    let bodyQualityLow = false;
    if (!bodyMissing && bodyTextLength > 0) {
      const lengthCheck = bodyTextLength < MIN_BODY_QUALITY_TEXT_LENGTH;
      const densityCheck = contentDensity < MIN_BODY_CONTENT_DENSITY;
      const paragraphCheck = paragraphCount < MIN_PARAGRAPH_COUNT;
      
      bodyQualityLow = lengthCheck || densityCheck || paragraphCheck;
    }

    return {
      bodyMissing,
      bodyQualityLow,
      bodyTextLength,
      contentDensity,
      paragraphCount,
      hasHeadings
    };
  }

  private stripHtmlToText(html: string) {
    return html
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<(script|style|noscript|svg|iframe)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
      .replace(/<(br|\/p|\/div|\/section|\/article|\/main|\/li|\/ul|\/ol|\/h[1-6]|\/header|\/footer|\/table|\/tr)\s*>/gi, "\n")
      .replace(/<[^>]+>/g, " ");
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
