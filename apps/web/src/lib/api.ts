const LOCAL_API_PORT = '3000';
const LOCAL_VITE_DEV_PORT = '5173';
const VITE_ENV = (
  import.meta as ImportMeta & {
    env?: {
      VITE_API_BASE_URL?: string;
      BASE_URL?: string;
      DEV?: boolean;
    };
  }
).env;

const API_BASE_URL = resolveApiBaseUrl();

function resolveApiBaseUrl() {
  const configuredBaseUrl = normalizeConfiguredApiBaseUrl(
    VITE_ENV?.VITE_API_BASE_URL
  );
  if (configuredBaseUrl) {
    return configuredBaseUrl;
  }

  if (supportsSameOriginApiBase()) {
    return resolveSameOriginApiBase(VITE_ENV?.BASE_URL);
  }

  return resolveLocalhostApiBase(window.location);
}

function normalizeConfiguredApiBaseUrl(value: string | undefined) {
  const trimmedValue = value?.trim();
  if (!trimmedValue) {
    return null;
  }

  return trimmedValue.replace(/\/+$/, '');
}

function supportsSameOriginApiBase() {
  if (typeof window === 'undefined') {
    return true;
  }

  return hasViteDevProxy() || !isLocalViteDevOrigin(window.location);
}

function isLocalViteDevOrigin(location: Location) {
  return (
    isLoopbackHostname(location.hostname) &&
    location.port === LOCAL_VITE_DEV_PORT
  );
}

function hasViteDevProxy() {
  return typeof VITE_ENV?.DEV === 'boolean' && VITE_ENV.DEV;
}

function resolveLocalhostApiBase(location: Location) {
  return `${location.protocol}//${normalizeLoopbackHostname(location.hostname)}:${LOCAL_API_PORT}`;
}

function resolveSameOriginApiBase(baseUrl: string | undefined) {
  const normalizedBasePath = normalizeBasePath(baseUrl);
  return normalizedBasePath === '/' ? '/api' : `${normalizedBasePath}/api`;
}

function normalizeBasePath(value: string | undefined) {
  const trimmedValue = value?.trim();
  if (!trimmedValue || trimmedValue === '/') {
    return '/';
  }

  const withoutTrailingSlash = trimmedValue.endsWith('/')
    ? trimmedValue.slice(0, -1)
    : trimmedValue;
  return withoutTrailingSlash.startsWith('/')
    ? withoutTrailingSlash
    : `/${withoutTrailingSlash}`;
}

function isLoopbackHostname(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

function normalizeLoopbackHostname(hostname: string) {
  return hostname === '127.0.0.1' ? 'localhost' : hostname;
}

export function resolveApiUrl(path: string) {
  return `${API_BASE_URL}${path}`;
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
};

export type ApiRequestError = Error & {
  status?: number;
  code?: string;
  traceId?: string | null;
  details?: unknown;
};

const API_UNREACHABLE_CODE = 'API_UNREACHABLE';
const API_UNREACHABLE_MESSAGE =
  'Cannot reach the API service. Start the backend and refresh the page.';
const AUTH_REFRESH_PATH = '/auth/refresh';
const LOGIN_REDIRECT_NOTICE_STORAGE_KEY = 'rag-login-redirect-notice';

let inFlightRefresh: Promise<boolean> | null = null;

type StreamErrorPayload = {
  type: 'error';
  message: string;
  code?: string;
  traceId?: string | null;
  details?: unknown;
};

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {}
) {
  const response = await performApiFetch(path, options, {
    allowRefreshRetry: true
  });

  if (!response.ok) {
    const errorPayload = await readErrorResponsePayload(response);
    if (isLikelyDevProxyStartupFailure(response, errorPayload.rawText)) {
      throw createApiRequestError(API_UNREACHABLE_MESSAGE, {
        status: response.status,
        code: API_UNREACHABLE_CODE
      });
    }

    const message =
      errorPayload.message ?? `Request failed with status ${response.status}.`;

    throw createApiRequestError(message, {
      status: response.status,
      code: errorPayload.code,
      traceId: errorPayload.traceId,
      details: errorPayload.details
    });
  }

  return (await response.json()) as T;
}

export async function apiStreamRequest<TEvent>(
  path: string,
  options: RequestOptions & {
    onEvent: (event: TEvent) => void;
  }
) {
  const response = await performApiFetch(path, options, {
    allowRefreshRetry: true,
    stream: true
  });

  if (!response.ok || !response.body) {
    const errorPayload = await readErrorResponsePayload(response);
    if (isLikelyDevProxyStartupFailure(response, errorPayload.rawText)) {
      throw createApiRequestError(API_UNREACHABLE_MESSAGE, {
        status: response.status,
        code: API_UNREACHABLE_CODE
      });
    }

    const message =
      errorPayload.message ?? `Request failed with status ${response.status}.`;

    throw createApiRequestError(message, {
      status: response.status,
      code: errorPayload.code,
      traceId: errorPayload.traceId,
      details: errorPayload.details
    });
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });

    while (true) {
      const newlineIndex = buffer.indexOf('\n');
      if (newlineIndex < 0) {
        break;
      }

      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);

      if (!line) {
        continue;
      }

      const event = JSON.parse(line) as TEvent;
      options.onEvent(event);
      throwIfStreamError(event);
    }
  }

  const trailing = buffer.trim();
  if (trailing) {
    const event = JSON.parse(trailing) as TEvent;
    options.onEvent(event);
    throwIfStreamError(event);
  }
}

async function performApiFetch(
  path: string,
  options: RequestOptions,
  fetchOptions: {
    allowRefreshRetry: boolean;
    stream?: boolean;
  }
) {
  let response = await executeFetch(
    path,
    options,
    fetchOptions.stream === true
  );
  if (shouldRetryWithRefresh(path, response, fetchOptions.allowRefreshRetry)) {
    const refreshed = await refreshAccessToken(options.signal);
    if (refreshed) {
      response = await executeFetch(
        path,
        options,
        fetchOptions.stream === true
      );
    }
  }

  return response;
}

async function executeFetch(
  path: string,
  options: RequestOptions,
  stream: boolean
) {
  try {
    return await fetch(resolveApiUrl(path), {
      method: options.method ?? 'GET',
      credentials: 'include',
      signal: options.signal,
      headers: resolveRequestHeaders(options.body, stream),
      body: resolveRequestBody(options.body)
    });
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }

    throw createApiRequestError(API_UNREACHABLE_MESSAGE, {
      cause: error,
      code: API_UNREACHABLE_CODE
    });
  }
}

function resolveRequestHeaders(body: unknown, stream: boolean) {
  const headers: Record<string, string> = {};

  if (!(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  if (stream) {
    headers.Accept = 'application/x-ndjson';
  }

  return Object.keys(headers).length > 0 ? headers : undefined;
}

function resolveRequestBody(body: unknown) {
  if (body == null) {
    return undefined;
  }

  return body instanceof FormData ? body : JSON.stringify(body);
}

async function readErrorResponsePayload(response: Response): Promise<{
  message: string | null;
  code?: string;
  traceId?: string | null;
  details?: unknown;
  rawText: string | null;
}> {
  try {
    const rawText = await response.text();
    if (!rawText) {
      return { message: null, rawText: null };
    }

    try {
      const parsed = JSON.parse(rawText) as {
        message?: string;
        code?: string;
        traceId?: string | null;
        details?: unknown;
      };
      return {
        message: typeof parsed.message === 'string' ? parsed.message : null,
        code: typeof parsed.code === 'string' ? parsed.code : undefined,
        traceId:
          typeof parsed.traceId === 'string' || parsed.traceId === null
            ? parsed.traceId
            : undefined,
        details: parsed.details,
        rawText
      };
    } catch {
      return {
        message: rawText.trim() || null,
        rawText
      };
    }
  } catch {
    return { message: null, rawText: null };
  }
}

function isLikelyDevProxyStartupFailure(
  response: Response,
  rawText: string | null
) {
  if (!isSameOriginDevApiBase() || response.status !== 500 || !rawText) {
    return false;
  }

  const normalizedText = rawText.toLowerCase();
  return (
    normalizedText.includes('error occurred while trying to proxy') ||
    normalizedText.includes('econnrefused') ||
    normalizedText.includes('socket hang up') ||
    normalizedText.includes('proxy error')
  );
}

function isSameOriginDevApiBase() {
  return API_BASE_URL === '/api';
}

function shouldRetryWithRefresh(
  path: string,
  response: Response,
  allowRefreshRetry: boolean
) {
  return (
    allowRefreshRetry && response.status === 401 && path !== AUTH_REFRESH_PATH
  );
}

async function refreshAccessToken(signal?: AbortSignal): Promise<boolean> {
  if (inFlightRefresh == null) {
    inFlightRefresh = (async () => {
      try {
        const response = await executeFetch(
          AUTH_REFRESH_PATH,
          { method: 'POST', signal },
          false
        );
        if (!response.ok) {
          await persistRefreshFailureNotice(response);
        }
        return response.ok;
      } catch (error) {
        if (isAbortError(error)) {
          throw error;
        }

        return false;
      } finally {
        inFlightRefresh = null;
      }
    })();
  }

  return inFlightRefresh;
}

async function persistRefreshFailureNotice(response: Response) {
  if (typeof window === 'undefined') {
    return;
  }

  const notice = await resolveRefreshFailureNotice(response);
  if (notice == null) {
    return;
  }

  window.sessionStorage.setItem(LOGIN_REDIRECT_NOTICE_STORAGE_KEY, notice);
}

async function resolveRefreshFailureNotice(
  response: Response
): Promise<'expired' | 'missing' | null> {
  try {
    const errorPayload = (await response.clone().json()) as {
      message?: string;
    };
    const message = errorPayload.message?.trim().toLowerCase() ?? '';
    if (message.includes('missing')) {
      return 'missing';
    }

    if (message.includes('invalid') || message.includes('expired')) {
      return 'expired';
    }
  } catch {
    // ignore parsing failures and fall back to a generic auth expiry message
  }

  return response.status === 401 ? 'expired' : null;
}

function throwIfStreamError(
  event: unknown
): asserts event is Exclude<unknown, StreamErrorPayload> {
  if (!isStreamErrorPayload(event)) {
    return;
  }

  const error = new Error(event.message) as Error & {
    code?: string;
    traceId?: string | null;
    details?: unknown;
  };
  error.code = event.code;
  error.traceId = event.traceId ?? null;
  error.details = event.details ?? null;
  throw error;
}

function isStreamErrorPayload(event: unknown): event is StreamErrorPayload {
  if (typeof event !== 'object' || event == null) {
    return false;
  }

  const candidate = event as Partial<StreamErrorPayload>;
  return candidate.type === 'error' && typeof candidate.message === 'string';
}

function isAbortError(error: unknown) {
  return error instanceof DOMException
    ? error.name === 'AbortError'
    : error instanceof Error && error.name === 'AbortError';
}

function createApiRequestError(
  message: string,
  options: {
    status?: number;
    code?: string;
    traceId?: string | null;
    details?: unknown;
    cause?: unknown;
  } = {}
) {
  const error = new Error(message) as ApiRequestError & { cause?: unknown };
  error.status = options.status;
  error.code = options.code;
  error.traceId = options.traceId;
  error.details = options.details;
  error.cause = options.cause;
  return error;
}

export function isApiUnavailableError(error: unknown) {
  return (
    typeof error === 'object' &&
    error != null &&
    (error as ApiRequestError).code === API_UNREACHABLE_CODE
  );
}
