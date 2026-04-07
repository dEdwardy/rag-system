const LOCAL_API_PORT = "3000";
const LOCAL_VITE_DEV_PORT = "5173";
const VITE_ENV = (import.meta as ImportMeta & {
  env?: {
    VITE_API_BASE_URL?: string;
    BASE_URL?: string;
    DEV?: boolean;
  };
}).env;

const API_BASE_URL = resolveApiBaseUrl();

function resolveApiBaseUrl() {
  const configuredBaseUrl = normalizeConfiguredApiBaseUrl(VITE_ENV?.VITE_API_BASE_URL);
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

  return trimmedValue.replace(/\/+$/, "");
}

function supportsSameOriginApiBase() {
  if (typeof window === "undefined") {
    return true;
  }

  return hasViteDevProxy() || !isLocalViteDevOrigin(window.location);
}

function isLocalViteDevOrigin(location: Location) {
  return isLoopbackHostname(location.hostname) && location.port === LOCAL_VITE_DEV_PORT;
}

function hasViteDevProxy() {
  return typeof VITE_ENV?.DEV === "boolean" && VITE_ENV.DEV;
}

function resolveLocalhostApiBase(location: Location) {
  return `${location.protocol}//${normalizeLoopbackHostname(location.hostname)}:${LOCAL_API_PORT}`;
}

function resolveSameOriginApiBase(baseUrl: string | undefined) {
  const normalizedBasePath = normalizeBasePath(baseUrl);
  return normalizedBasePath === "/" ? "/api" : `${normalizedBasePath}/api`;
}

function normalizeBasePath(value: string | undefined) {
  const trimmedValue = value?.trim();
  if (!trimmedValue || trimmedValue === "/") {
    return "/";
  }

  const withoutTrailingSlash = trimmedValue.endsWith("/") ? trimmedValue.slice(0, -1) : trimmedValue;
  return withoutTrailingSlash.startsWith("/") ? withoutTrailingSlash : `/${withoutTrailingSlash}`;
}

function isLoopbackHostname(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

function normalizeLoopbackHostname(hostname: string) {
  return hostname === "127.0.0.1" ? "localhost" : hostname;
}

export function resolveApiUrl(path: string) {
  return `${API_BASE_URL}${path}`;
}

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
};

export type ApiRequestError = Error & {
  status?: number;
  code?: string;
};

const API_UNREACHABLE_CODE = "API_UNREACHABLE";
const API_UNREACHABLE_MESSAGE = "Cannot reach the API service. Start the backend and refresh the page.";
const AUTH_REFRESH_PATH = "/auth/refresh";

let inFlightRefresh: Promise<boolean> | null = null;

type StreamErrorPayload = {
  type: "error";
  message: string;
  code?: string;
  traceId?: string | null;
  details?: unknown;
};

export async function apiRequest<T>(path: string, options: RequestOptions = {}) {
  const response = await performApiFetch(path, options, {
    allowRefreshRetry: true
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}.`;

    try {
      const errorPayload = (await response.json()) as { message?: string };
      message = errorPayload.message ?? message;
    } catch {
      // ignore parsing failures
    }

    throw createApiRequestError(message, { status: response.status });
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
    let message = `Request failed with status ${response.status}.`;

    try {
      const errorPayload = (await response.json()) as { message?: string };
      message = errorPayload.message ?? message;
    } catch {
      // ignore parsing failures
    }

    throw createApiRequestError(message, { status: response.status });
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });

    while (true) {
      const newlineIndex = buffer.indexOf("\n");
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
  let response = await executeFetch(path, options, fetchOptions.stream === true);
  if (shouldRetryWithRefresh(path, response, fetchOptions.allowRefreshRetry)) {
    const refreshed = await refreshAccessToken(options.signal);
    if (refreshed) {
      response = await executeFetch(path, options, fetchOptions.stream === true);
    }
  }

  return response;
}

async function executeFetch(path: string, options: RequestOptions, stream: boolean) {
  try {
    return await fetch(resolveApiUrl(path), {
      method: options.method ?? "GET",
      credentials: "include",
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
    headers["Content-Type"] = "application/json";
  }

  if (stream) {
    headers.Accept = "application/x-ndjson";
  }

  return Object.keys(headers).length > 0 ? headers : undefined;
}

function resolveRequestBody(body: unknown) {
  if (body == null) {
    return undefined;
  }

  return body instanceof FormData ? body : JSON.stringify(body);
}

function shouldRetryWithRefresh(path: string, response: Response, allowRefreshRetry: boolean) {
  return allowRefreshRetry && response.status === 401 && path !== AUTH_REFRESH_PATH;
}

async function refreshAccessToken(signal?: AbortSignal): Promise<boolean> {
  if (inFlightRefresh == null) {
    inFlightRefresh = (async () => {
      try {
        const response = await executeFetch(AUTH_REFRESH_PATH, { method: "POST", signal }, false);
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

function throwIfStreamError(event: unknown): asserts event is Exclude<unknown, StreamErrorPayload> {
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
  if (typeof event !== "object" || event == null) {
    return false;
  }

  const candidate = event as Partial<StreamErrorPayload>;
  return candidate.type === "error" && typeof candidate.message === "string";
}

function isAbortError(error: unknown) {
  return error instanceof DOMException
    ? error.name === "AbortError"
    : error instanceof Error && error.name === "AbortError";
}

function createApiRequestError(
  message: string,
  options: {
    status?: number;
    code?: string;
    cause?: unknown;
  } = {}
) {
  const error = new Error(message) as ApiRequestError & { cause?: unknown };
  error.status = options.status;
  error.code = options.code;
  error.cause = options.cause;
  return error;
}

export function isApiUnavailableError(error: unknown) {
  return typeof error === "object" && error != null && (error as ApiRequestError).code === API_UNREACHABLE_CODE;
}
