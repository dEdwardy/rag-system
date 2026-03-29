const LOCAL_API_PORT = "3000";
const LOCAL_VITE_DEV_PORT = "5173";

const API_BASE_URL = resolveApiBaseUrl();

function resolveApiBaseUrl() {
  const configuredBaseUrl = normalizeConfiguredApiBaseUrl(import.meta.env.VITE_API_BASE_URL);
  if (configuredBaseUrl) {
    return configuredBaseUrl;
  }

  if (supportsSameOriginApiBase(window.location)) {
    return "/api";
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

function supportsSameOriginApiBase(location: Location) {
  return !isLocalViteDevOrigin(location);
}

function isLocalViteDevOrigin(location: Location) {
  return isLoopbackHostname(location.hostname) && location.port === LOCAL_VITE_DEV_PORT;
}

function resolveLocalhostApiBase(location: Location) {
  return `${location.protocol}//${normalizeLoopbackHostname(location.hostname)}:${LOCAL_API_PORT}`;
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
};

export type ApiRequestError = Error & {
  status?: number;
};

type StreamErrorPayload = {
  type: "error";
  message: string;
  code?: string;
  traceId?: string | null;
  details?: unknown;
};

export async function apiRequest<T>(path: string, options: RequestOptions = {}) {
  const response = await fetch(resolveApiUrl(path), {
    method: options.method ?? "GET",
    credentials: "include",
    headers:
      options.body instanceof FormData
        ? undefined
        : {
            "Content-Type": "application/json"
          },
    body:
      options.body == null
        ? undefined
        : options.body instanceof FormData
          ? options.body
          : JSON.stringify(options.body)
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}.`;

    try {
      const errorPayload = (await response.json()) as { message?: string };
      message = errorPayload.message ?? message;
    } catch {
      // ignore parsing failures
    }

    const error = new Error(message) as ApiRequestError;
    error.status = response.status;
    throw error;
  }

  return (await response.json()) as T;
}

export async function apiStreamRequest<TEvent>(
  path: string,
  options: RequestOptions & {
    onEvent: (event: TEvent) => void;
  }
) {
  const response = await fetch(resolveApiUrl(path), {
    method: options.method ?? "GET",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/x-ndjson"
    },
    body: options.body == null ? undefined : JSON.stringify(options.body)
  });

  if (!response.ok || !response.body) {
    let message = `Request failed with status ${response.status}.`;

    try {
      const errorPayload = (await response.json()) as { message?: string };
      message = errorPayload.message ?? message;
    } catch {
      // ignore parsing failures
    }

    const error = new Error(message) as ApiRequestError;
    error.status = response.status;
    throw error;
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
