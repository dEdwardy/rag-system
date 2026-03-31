export enum ErrorCode {
  // External source errors
  EXTERNAL_SOURCE_FETCH_FAILED = "EXTERNAL_SOURCE_FETCH_FAILED",
  EXTERNAL_SOURCE_PERSIST_FAILED = "EXTERNAL_SOURCE_PERSIST_FAILED",
  EXTERNAL_SOURCE_CONFIG_INVALID = "EXTERNAL_SOURCE_CONFIG_INVALID",
  EXTERNAL_SOURCE_ENQUEUE_FAILED = "EXTERNAL_SOURCE_ENQUEUE_FAILED",
  EXTERNAL_SOURCE_PARTIAL_SUCCESS = "EXTERNAL_SOURCE_PARTIAL_SUCCESS",
  EXTERNAL_SOURCE_RUN_SUPERSEDED = "EXTERNAL_SOURCE_RUN_SUPERSEDED",
  
  // Ingestion errors
  INGESTION_ENQUEUE_FAILED = "INGESTION_ENQUEUE_FAILED",
  INGESTION_PARSING_FAILED = "INGESTION_PARSING_FAILED",
  INGESTION_UNSUPPORTED_FILE_TYPE = "INGESTION_UNSUPPORTED_FILE_TYPE",
  INGESTION_EMPTY_CONTENT = "INGESTION_EMPTY_CONTENT",
  INGESTION_RUN_SUPERSEDED = "INGESTION_RUN_SUPERSEDED"
}

export interface ErrorDiagnostics {
  code: ErrorCode;
  failedStage: string;
  retryable: boolean;
  documentVersion: number;
  message: string;
  sourceType?: string;
  sourceName?: string;
  [key: string]: any;
}

export interface PartialErrorDiagnostics extends ErrorDiagnostics {
  partial: boolean;
  sourceKind: "feed" | "sitemap" | "web";
  schemaVersion: number;
  category: string;
  partialFailureCount: number;
  retryableFailureCount: number;
  nonRetryableFailureCount: number;
  boundaryHit?: boolean;
  boundaryReasons?: string[];
}

export const createErrorDiagnostics = (
  code: ErrorCode,
  failedStage: string,
  retryable: boolean,
  documentVersion: number,
  message: string,
  options?: {
    sourceType?: string;
    sourceName?: string;
    [key: string]: any;
  }
): ErrorDiagnostics => {
  return {
    code,
    failedStage,
    retryable,
    documentVersion,
    message,
    ...options
  };
};

export const createPartialErrorDiagnostics = (
  code: ErrorCode,
  failedStage: string,
  retryable: boolean,
  documentVersion: number,
  message: string,
  sourceKind: "feed" | "sitemap" | "web",
  partialFailureCount: number,
  retryableFailureCount: number,
  nonRetryableFailureCount: number,
  options?: {
    sourceType?: string;
    sourceName?: string;
    boundaryHit?: boolean;
    boundaryReasons?: string[];
    [key: string]: any;
  }
): PartialErrorDiagnostics => {
  return {
    code,
    failedStage,
    retryable,
    documentVersion,
    message,
    sourceKind,
    schemaVersion: 2,
    category: "external_source_partial",
    partial: true,
    partialFailureCount,
    retryableFailureCount,
    nonRetryableFailureCount,
    ...options
  };
};