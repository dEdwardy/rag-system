import { HttpException } from '@nestjs/common';
import {
  SseSlowClientError,
  SseStreamClosedError
} from '../../common/sse-stream-writer';

export type AskStreamErrorKind =
  | 'aborted'
  | 'slow_client'
  | 'retryable'
  | 'fatal';

export function classifyAskStreamError(error: unknown): AskStreamErrorKind {
  if (error instanceof SseStreamClosedError) {
    return 'aborted';
  }

  if (error instanceof SseSlowClientError) {
    return 'slow_client';
  }

  if (error instanceof Error && error.name === 'AbortError') {
    return 'aborted';
  }

  if (error instanceof HttpException) {
    const status = error.getStatus();
    return status >= 500 || status === 408 || status === 429
      ? 'retryable'
      : 'fatal';
  }

  return 'retryable';
}

export function isRetryableAskStreamError(error: unknown) {
  return classifyAskStreamError(error) === 'retryable';
}
