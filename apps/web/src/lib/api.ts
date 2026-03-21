const API_BASE_URL = "http://localhost:3000";

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
};

type StreamErrorPayload = {
  type: "error";
  message: string;
  code?: string;
  traceId?: string | null;
  details?: unknown;
};

export async function apiRequest<T>(path: string, options: RequestOptions = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
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

    throw new Error(message);
  }

  return (await response.json()) as T;
}

export async function apiStreamRequest<TEvent>(
  path: string,
  options: RequestOptions & {
    onEvent: (event: TEvent) => void;
  }
) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
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

    throw new Error(message);
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
