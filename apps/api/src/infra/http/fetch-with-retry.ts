type FetchWithRetryInput = {
  url: string;
  headers?: HeadersInit;
  timeoutMs: number;
  attempts?: number;
};

const DEFAULT_ATTEMPTS = 2;

export async function fetchWithRetry(input: FetchWithRetryInput) {
  const attempts = Math.max(1, input.attempts ?? DEFAULT_ATTEMPTS);
  let lastError: unknown;
  let lastResponse: Response | undefined;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(input.url, {
        signal: AbortSignal.timeout(input.timeoutMs),
        headers: input.headers
      });

      if (!shouldRetryResponse(response.status) || attempt === attempts) {
        return response;
      }

      lastResponse = response;
    } catch (error) {
      lastError = error;
      if (attempt === attempts) {
        throw error;
      }
    }
  }

  if (lastResponse) {
    return lastResponse;
  }

  throw lastError instanceof Error ? lastError : new Error("Unknown fetch error.");
}

function shouldRetryResponse(status: number) {
  return status === 429 || status >= 500;
}
