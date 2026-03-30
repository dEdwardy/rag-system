export const DEFAULT_NETWORK_RETRY_COUNT = 3;
export const DEFAULT_NETWORK_RETRY_BASE_DELAY_MS = 1000;

export function createApiClient(baseUrl, username, password, messageWaitMs, pollIntervalMs) {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");
  const headers = {
    "content-type": "application/json"
  };

  if (password) {
    const authUser = username ?? "opencode";
    headers.authorization = `Basic ${Buffer.from(`${authUser}:${password}`).toString("base64")}`;
  }

  return {
    async createSession(body) {
      const response = await requestJson({
        method: "POST",
        url: `${normalizedBaseUrl}/session`,
        headers,
        body
      });

      if (!response?.id) {
        throw new Error("OpenCode /session 响应缺少 session id。");
      }

      return response;
    },

    async listMessages({ sessionId }) {
      const response = await requestJson({
        method: "GET",
        url: buildSessionMessagesUrl(normalizedBaseUrl, sessionId),
        headers
      });

      return Array.isArray(response) ? response : [];
    },

    async findAssistantMessage({ sessionId, messageId }) {
      if (!messageId) {
        return null;
      }

      const messages = await this.listMessages({ sessionId });
      return findAssistantMessageById(messages, messageId);
    },

    async getLatestAssistantMessage({ sessionId }) {
      const messages = await this.listMessages({ sessionId });
      return findLatestAssistantMessage(messages);
    },

    async sendMessage({ sessionId, agent, model, promptText, afterMessageId }) {
      const normalizedModel = normalizeModelInput(model);

      let response;

      try {
        response = await requestJson({
          method: "POST",
          url: `${normalizedBaseUrl}/session/${encodeURIComponent(sessionId)}/message`,
          headers,
          body: {
            ...(agent ? { agent } : {}),
            ...(normalizedModel ? { model: normalizedModel } : {}),
            ...(afterMessageId ? { afterMessageId } : {}),
            parts: [{ type: "text", text: promptText }]
          }
        });
      } catch (error) {
        if (!isFetchFailedError(error)) {
          throw error;
        }

        response = null;
      }

      if (isAssistantMessage(response) && response.info?.id !== afterMessageId) {
        return response;
      }

      return await waitForAssistantMessage({
        listMessages: this.listMessages,
        normalizedBaseUrl,
        sessionId,
        headers,
        messageWaitMs,
        pollIntervalMs,
        afterMessageId
      });
    },

    async waitForAssistantMessage({ sessionId, afterMessageId }) {
      return await waitForAssistantMessage({
        listMessages: this.listMessages,
        normalizedBaseUrl,
        sessionId,
        headers,
        messageWaitMs,
        pollIntervalMs,
        afterMessageId
      });
    }
  };
}

export function extractAssistantText(parts) {
  if (!Array.isArray(parts)) {
    return "";
  }

  const textParts = parts
    .filter(part => part?.type === "text" && typeof part.text === "string")
    .map(part => part.text.trim())
    .filter(Boolean);

  if (textParts.length > 0) {
    return `${textParts.join("\n\n")}\n`;
  }

  return `${JSON.stringify(parts, null, 2)}\n`;
}

export function isAssistantMessageTimeoutError(error) {
  return error instanceof AssistantMessageTimeoutError;
}

class AssistantMessageTimeoutError extends Error {
  constructor(sessionId, waitMs) {
    super(`OpenCode 在 ${waitMs}ms 内没有为 session ${sessionId} 返回 assistant 消息。`);
    this.name = "AssistantMessageTimeoutError";
    this.sessionId = sessionId;
    this.waitMs = waitMs;
  }
}

function isAssistantMessage(message) {
  return Boolean(
    message &&
      typeof message === "object" &&
      !Array.isArray(message) &&
      message.info?.role === "assistant" &&
      Array.isArray(message.parts)
  );
}

function isFetchFailedError(error) {
  return error instanceof Error && (error.message === "fetch failed" || error.message.includes("fetch failed"));
}

async function waitForAssistantMessage({
  listMessages,
  normalizedBaseUrl,
  sessionId,
  headers,
  messageWaitMs,
  pollIntervalMs,
  afterMessageId
}) {
  const waitMs = Number.isFinite(messageWaitMs) && messageWaitMs > 0 ? messageWaitMs : 180000;
  const intervalMs = Number.isFinite(pollIntervalMs) && pollIntervalMs > 0 ? pollIntervalMs : 2000;
  const deadline = Date.now() + waitMs;

  while (Date.now() <= deadline) {
    let fallback;

    try {
      fallback = listMessages
        ? await listMessages({ sessionId })
        : await requestJson({
            method: "GET",
            url: buildSessionMessagesUrl(normalizedBaseUrl, sessionId),
            headers
          });
    } catch (error) {
      if (isFetchFailedError(error)) {
        await sleep(intervalMs);
        continue;
      }

      throw error;
    }

    if (Array.isArray(fallback)) {
      const lastAssistant = findAssistantMessageAfter(fallback, afterMessageId);

      if (lastAssistant) {
        return lastAssistant;
      }
    }

    await sleep(intervalMs);
  }

  throw new AssistantMessageTimeoutError(sessionId, waitMs);
}

async function requestJson({ method, url, headers, body }) {
  return await retryJsonRequest({ method, url, headers, body });
}

async function retryJsonRequest({ method, url, headers, body }) {
  const maxAttempts = DEFAULT_NETWORK_RETRY_COUNT + 1;
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await requestJsonOnce({ method, url, headers, body });
    } catch (error) {
      lastError = error;
      if (!shouldRetryNetworkRequest(error) || attempt >= maxAttempts) {
        throw error;
      }

      await sleep(computeNetworkRetryDelayMs(attempt));
    }
  }

  throw lastError ?? new Error(`OpenCode request failed unexpectedly: ${method} ${url}`);
}

async function requestJsonOnce({ method, url, headers, body }) {
  let response;

  try {
    response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
  } catch (error) {
    throw normalizeNetworkRequestError(error, { method, url });
  }

  const raw = await response.text();
  if (!response.ok) {
    const requestError = new Error(`OpenCode request failed: ${method} ${url} -> ${response.status} ${raw}`);
    requestError.statusCode = response.status;
    requestError.responseBody = raw;
    throw requestError;
  }

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`OpenCode 为 ${method} ${url} 返回了非 JSON 内容。`);
  }
}

function shouldRetryNetworkRequest(error) {
  if (!(error instanceof Error)) {
    return false;
  }

  if (isFetchFailedError(error)) {
    return true;
  }

  const statusCode = Number.isInteger(error.statusCode) ? error.statusCode : null;
  if (statusCode && [408, 425, 429, 500, 502, 503, 504].includes(statusCode)) {
    return true;
  }

  return false;
}

function computeNetworkRetryDelayMs(attempt) {
  const exponent = Math.max(0, attempt - 1);
  return DEFAULT_NETWORK_RETRY_BASE_DELAY_MS * 2 ** exponent;
}

function normalizeNetworkRequestError(error, { method, url }) {
  if (error instanceof Error) {
    if (isFetchFailedError(error)) {
      error.requestMethod = method;
      error.requestUrl = url;
      return error;
    }

    return new Error(`${method} ${url} failed: ${error.message}`);
  }

  return new Error(`${method} ${url} failed: ${String(error)}`);
}

function buildSessionMessagesUrl(normalizedBaseUrl, sessionId, limit = 200) {
  return `${normalizedBaseUrl}/session/${encodeURIComponent(sessionId)}/message?limit=${limit}`;
}

function findLatestAssistantMessage(messages) {
  if (!Array.isArray(messages)) {
    return null;
  }

  return [...messages].reverse().find(isAssistantMessage) ?? null;
}

function findAssistantMessageById(messages, messageId) {
  if (!Array.isArray(messages) || !messageId) {
    return null;
  }

  return messages.find(message => isAssistantMessage(message) && message.info?.id === messageId) ?? null;
}

function findAssistantMessageAfter(messages, afterMessageId) {
  if (!Array.isArray(messages)) {
    return null;
  }

  if (!afterMessageId) {
    return findLatestAssistantMessage(messages);
  }

  const baselineIndex = messages.findIndex(message => message?.info?.id === afterMessageId);
  if (baselineIndex === -1) {
    const latestAssistant = findLatestAssistantMessage(messages);
    return latestAssistant?.info?.id === afterMessageId ? null : latestAssistant;
  }

  for (let index = messages.length - 1; index > baselineIndex; index -= 1) {
    if (isAssistantMessage(messages[index])) {
      return messages[index];
    }
  }

  return null;
}

function normalizeModelInput(model) {
  if (!model) {
    return undefined;
  }

  if (typeof model === "object" && !Array.isArray(model)) {
    const providerID = typeof model.providerID === "string" ? model.providerID.trim() : "";
    const modelID = typeof model.modelID === "string" ? model.modelID.trim() : "";

    if (providerID && modelID) {
      return { providerID, modelID };
    }

    return undefined;
  }

  if (typeof model !== "string") {
    return undefined;
  }

  const normalized = model.trim();
  if (!normalized) {
    return undefined;
  }

  const separatorIndex = normalized.indexOf("/");
  if (separatorIndex === -1) {
    return undefined;
  }

  const providerID = normalized.slice(0, separatorIndex).trim();
  const modelID = normalized.slice(separatorIndex + 1).trim();

  if (!providerID || !modelID) {
    return undefined;
  }

  return { providerID, modelID };
}

function sleep(ms) {
  return new Promise(resolvePromise => {
    setTimeout(resolvePromise, ms);
  });
}
