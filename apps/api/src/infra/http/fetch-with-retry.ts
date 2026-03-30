type FetchWithRetryInput = {
  url: string;
  headers?: HeadersInit;
  timeoutMs: number;
  attempts?: number;
};

const MAX_FOLLOW_REDIRECTS = 5;
const MAX_REDIRECT_TARGET_DIAGNOSTIC_LENGTH = 160;
const FETCH_URL_PREFIX_PATTERN = /^Failed to fetch\s+\S+:\s*/i;
const COURTESY_ROBOTS_TIMEOUT_MS = 5000;
const COURTESY_USER_AGENT = "rag-system-bot";
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
      const normalizedError = normalizeFetchError(error, input.url, input.timeoutMs);
      lastError = normalizedError;
      if (attempt === attempts || !isRetryableFetchException(error)) {
        throw withRetryAttemptContext(normalizedError, attempt);
      }
    }
  }

  if (lastResponse) {
    return lastResponse;
  }

  throw lastError instanceof Error ? lastError : new Error("Unknown fetch error.");
}

export async function assertRobotsAllowUrl(url: string) {
  const robotsUrl = buildRobotsUrl(url);
  if (!robotsUrl) {
    return;
  }

  let response: Response;
  try {
    response = await fetchWithFollowRedirects(robotsUrl, {
      signal: AbortSignal.timeout(COURTESY_ROBOTS_TIMEOUT_MS),
      headers: {
        Accept: "text/plain"
      }
    });
  } catch {
    return;
  }

  if (!response.ok) {
    return;
  }

  const robotsPayload = await response.text();
  if (isPathDisallowedByRobots(robotsPayload, url)) {
    throw new Error(`Blocked by robots.txt for ${url}.`);
  }
}

export function normalizeSourceFetchFailureMessage(message: string) {
  const trimmedMessage = message.trim();
  return trimmedMessage.replace(FETCH_URL_PREFIX_PATTERN, "");
}

export function isUrlWithinDomainBoundary(candidateUrl: string, boundaryUrl: string) {
  let candidate: URL;
  let boundary: URL;

  try {
    candidate = new URL(candidateUrl);
    boundary = new URL(boundaryUrl);
  } catch {
    return false;
  }

  const candidateHost = candidate.hostname.trim().toLowerCase();
  const boundaryHost = boundary.hostname.trim().toLowerCase();

  if (!candidateHost || !boundaryHost) {
    return false;
  }

  return (
    candidateHost === boundaryHost ||
    candidateHost.endsWith(`.${boundaryHost}`) ||
    boundaryHost.endsWith(`.${candidateHost}`)
  );
}

function withRetryAttemptContext(error: unknown, attempt: number) {
  if (!(error instanceof Error)) {
    return error;
  }

  const message = error.message.trim();
  const shouldAttachAttemptContext =
    message.startsWith("Failed to fetch ") || message.startsWith("Failed to follow redirect for ");

  if (!shouldAttachAttemptContext || /\(after \d+ attempts?\)\.?$/i.test(message)) {
    return error;
  }

  const attemptLabel = attempt === 1 ? "attempt" : "attempts";
  return new Error(`${message} (after ${attempt} ${attemptLabel}).`);
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
      throw new Error(`Failed to follow redirect for ${currentUrl}: missing redirect location header.`);
    }

    const nextUrl = resolveRedirectUrl(currentUrl, redirectLocation);
    assertHttpUrl(nextUrl, currentUrl, redirectLocation);
    assertRedirectDomainBoundary(nextUrl, url, currentUrl, redirectLocation);
    currentUrl = nextUrl;
  }

  throw new Error(`Failed to follow redirect for ${url}: too many redirects.`);
}

function assertRedirectDomainBoundary(nextUrl: string, sourceUrl: string, currentUrl: string, rawRedirectTarget: string) {
  if (isUrlWithinDomainBoundary(nextUrl, sourceUrl)) {
    return;
  }

  throw new Error(
    `Failed to follow redirect for ${currentUrl}: redirect target must stay within source domain boundary (${formatRedirectTargetForDiagnostics(rawRedirectTarget)}).`
  );
}

function isRedirectStatus(status: number) {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

function resolveRedirectUrl(currentUrl: string, redirectLocation: string) {
  try {
    return new URL(redirectLocation, currentUrl).toString();
  } catch {
    throw new Error(
      `Failed to follow redirect for ${currentUrl}: invalid redirect location (${formatRedirectTargetForDiagnostics(redirectLocation)}).`
    );
  }
}

function assertHttpUrl(url: string, sourceUrl: string, rawRedirectTarget: string) {
  let parsed: URL;

  try {
    parsed = new URL(url);
  } catch {
    throw new Error(
      `Failed to follow redirect for ${sourceUrl}: invalid redirect location (${formatRedirectTargetForDiagnostics(rawRedirectTarget)}).`
    );
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(
      `Failed to follow redirect for ${sourceUrl}: redirect target must use http/https (${formatRedirectTargetForDiagnostics(rawRedirectTarget)}).`
    );
  }
}

function formatRedirectTargetForDiagnostics(target: string) {
  if (target.length <= MAX_REDIRECT_TARGET_DIAGNOSTIC_LENGTH) {
    return target;
  }

  return `${target.slice(0, MAX_REDIRECT_TARGET_DIAGNOSTIC_LENGTH)}...<truncated>`;
}

function buildRobotsUrl(url: string) {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return null;
  }

  parsed.pathname = "/robots.txt";
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString();
}

function isPathDisallowedByRobots(robotsPayload: string, targetUrl: string) {
  let targetPath = "/";
  try {
    const parsedTarget = new URL(targetUrl);
    targetPath = parsedTarget.pathname || "/";
  } catch {
    return false;
  }

  const rules = parseRobotsRulesForCourtesyAgent(robotsPayload);
  let matchedAllowLength = -1;
  let matchedDisallowLength = -1;

  for (const rule of rules) {
    if (!targetPath.startsWith(rule.path)) {
      continue;
    }

    if (rule.kind === "allow") {
      matchedAllowLength = Math.max(matchedAllowLength, rule.path.length);
      continue;
    }

    matchedDisallowLength = Math.max(matchedDisallowLength, rule.path.length);
  }

  if (matchedDisallowLength < 0) {
    return false;
  }

  return matchedDisallowLength >= matchedAllowLength;
}

function parseRobotsRulesForCourtesyAgent(robotsPayload: string) {
  const lines = robotsPayload.split(/\r?\n/);
  const rules: Array<{ kind: "allow" | "disallow"; path: string }> = [];
  let currentGroupMatches = false;
  let hasUserAgentInCurrentGroup = false;

  for (const rawLine of lines) {
    const line = rawLine.replace(/#.*/, "").trim();
    if (!line) {
      currentGroupMatches = false;
      hasUserAgentInCurrentGroup = false;
      continue;
    }

    const separatorIndex = line.indexOf(":");
    if (separatorIndex <= 0) {
      continue;
    }

    const rawDirective = line.slice(0, separatorIndex).trim().toLowerCase();
    const value = line.slice(separatorIndex + 1).trim();

    if (rawDirective === "user-agent") {
      const normalizedAgent = value.toLowerCase();
      if (!hasUserAgentInCurrentGroup) {
        currentGroupMatches = false;
        hasUserAgentInCurrentGroup = true;
      }

      if (normalizedAgent === "*" || normalizedAgent === COURTESY_USER_AGENT) {
        currentGroupMatches = true;
      }

      continue;
    }

    if (!hasUserAgentInCurrentGroup || !currentGroupMatches) {
      continue;
    }

    if (rawDirective !== "allow" && rawDirective !== "disallow") {
      continue;
    }

    if (!value || value === "") {
      continue;
    }

    if (!value.startsWith("/")) {
      continue;
    }

    rules.push({
      kind: rawDirective,
      path: value
    });
  }

  return rules;
}

function normalizeFetchError(error: unknown, sourceUrl: string, timeoutMs: number) {
  if (!(error instanceof Error)) {
    return error;
  }

  if (error.name === "AbortError" || error.name === "TimeoutError") {
    const timeoutMessage = error.message.trim().replace(/[.]+$/, "");
    return new Error(
      `Failed to fetch ${sourceUrl}: request timed out after ${timeoutMs}ms${timeoutMessage ? `: ${timeoutMessage}` : ""}.`
    );
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

  return new Error(`Failed to fetch ${sourceUrl}: ${normalizedMessage}`);

}

export function isRetryableFetchException(error: unknown) {
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
