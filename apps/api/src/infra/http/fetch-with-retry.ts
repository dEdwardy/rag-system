type FetchWithRetryInput = {
  url: string;
  headers?: HeadersInit;
  timeoutMs: number;
  attempts?: number;
};

export const DEFAULT_SOURCE_FETCH_TIMEOUT_MS = 10000;
export const DEFAULT_SOURCE_FETCH_RETRY_ATTEMPTS = 2;

export function resolveSourceFetchRuntimeConfig(env: NodeJS.ProcessEnv = process.env) {
  return {
    timeoutMs: readPositiveInteger(env.SOURCE_FETCH_TIMEOUT_MS, DEFAULT_SOURCE_FETCH_TIMEOUT_MS),
    attempts: readPositiveInteger(env.SOURCE_FETCH_RETRY_ATTEMPTS, DEFAULT_SOURCE_FETCH_RETRY_ATTEMPTS)
  };
}

export async function fetchWithRetry(input: FetchWithRetryInput) {
  const attempts = Math.max(1, input.attempts ?? DEFAULT_SOURCE_FETCH_RETRY_ATTEMPTS);
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

function readPositiveInteger(value: string | undefined, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}
