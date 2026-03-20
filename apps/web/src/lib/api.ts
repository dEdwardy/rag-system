const API_BASE_URL = "http://localhost:3000";

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
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

