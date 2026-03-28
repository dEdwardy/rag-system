type FetchWithRetryInput = {
  url: string;
  headers?: HeadersInit;
  timeoutMs: number;
  attempts?: number;
};

const MAX_FOLLOW_REDIRECTS = 5;
const TRANSIENT_NETWORK_ERROR_CODES = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "EHOSTUNREACH",
  "ENETDOWN",
  "ENETRESET",
  "ENETUNREACH",
  "ENOTFOUND",
  "EAI_AGAIN",
  "ETIMEDOUT"
]);

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
      const response = await fetchWithFollowRedirects(input.url, {
        signal: AbortSignal.timeout(input.timeoutMs),
        headers: input.headers
      });

      if (!shouldRetryResponse(response.status) || attempt === attempts) {
        return response;
      }

      lastResponse = response;
    } catch (error) {
      const normalizedError = normalizeFetchError(error, input.url);
      lastError = normalizedError;
      if (attempt === attempts || !shouldRetryFetchException(error)) {
        throw normalizedError;
      }
    }
  }

  if (lastResponse) {
    return lastResponse;
  }

  throw lastError instanceof Error ? lastError : new Error("Unknown fetch error.");
}

function shouldRetryResponse(status: number) {
  return status === 408 || status === 429 || status >= 500;
}

async function fetchWithFollowRedirects(url: string, init: RequestInit) {
  let currentUrl = url;

  for (let redirectCount = 0; redirectCount <= MAX_FOLLOW_REDIRECTS; redirectCount += 1) {
    const response = await fetch(currentUrl, {
      ...init,
      redirect: "manual"
    });

    if (!isRedirectStatus(response.status)) {
      return response;
    }

    const redirectLocation = response.headers.get("location");
    if (!redirectLocation) {
      return response;
    }

    const nextUrl = resolveRedirectUrl(currentUrl, redirectLocation);
    assertHttpUrl(nextUrl, currentUrl);
    currentUrl = nextUrl;
  }

  throw new Error(`Failed to follow redirect for ${url}: too many redirects.`);
}

function isRedirectStatus(status: number) {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

function resolveRedirectUrl(currentUrl: string, redirectLocation: string) {
  try {
    return new URL(redirectLocation, currentUrl).toString();
  } catch {
    throw new Error(`Failed to follow redirect for ${currentUrl}: invalid redirect location.`);
  }
}

function assertHttpUrl(url: string, sourceUrl: string) {
  let parsed: URL;

  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Failed to follow redirect for ${sourceUrl}: invalid redirect location.`);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Failed to follow redirect for ${sourceUrl}: redirect target must use http/https.`);
  }
}

function normalizeFetchError(error: unknown, sourceUrl: string) {
  if (!(error instanceof Error)) {
    return error;
  }

  const causeMessage =
    error.cause instanceof Error
      ? error.cause.message
      : typeof error.cause === "string"
        ? error.cause
        : "";
  const combinedMessage = [error.message, causeMessage].filter(Boolean).join(" ");

  if (/redirect/i.test(combinedMessage) && /url scheme must be a http\(s\) scheme/i.test(combinedMessage)) {
    return new Error(`Failed to follow redirect for ${sourceUrl}: redirect target must use http/https.`);
  }

  if (error.message.startsWith("Failed to follow redirect for")) {
    return error;
  }

  const normalizedMessage = error.message.trim() || "Unknown fetch error.";
  if (normalizedMessage.includes(sourceUrl)) {
    return error;
  }

  return new Error(`Fetch request failed for ${sourceUrl}: ${normalizedMessage}`);

}

function shouldRetryFetchException(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  if (error.name === "AbortError" || error.name === "TimeoutError") {
    return true;
  }

  const causeCode = readErrorCode(error.cause);
  if (causeCode && TRANSIENT_NETWORK_ERROR_CODES.has(causeCode)) {
    return true;
  }

  const causeMessage = error.cause instanceof Error ? error.cause.message : "";
  const combinedMessage = `${error.message} ${causeMessage}`.toLowerCase();
  return combinedMessage.includes("fetch failed") || combinedMessage.includes("network error");
}

function readErrorCode(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const maybeCode = Reflect.get(value, "code");
  return typeof maybeCode === "string" ? maybeCode.toUpperCase() : null;
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
