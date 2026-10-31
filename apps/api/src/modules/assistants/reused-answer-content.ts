/**
 * Normalizes the assistant message content that the conversation-reuse path
 * returns.
 *
 * Assistant messages are persisted as the parsed answer, but historical rows
 * written before that held on (or rows where structured parsing failed and the
 * raw model output was stored verbatim) contain the raw JSON payload:
 * `{"answer":"...","status":"grounded",...}`. Reusing such a row surfaced that
 * JSON to the user, which looked like repeated questions were broken.
 *
 * This only unwraps the payload; it never invents an answer. When the embedded
 * answer is missing or empty the original content is returned unchanged, so a
 * genuinely broken row stays visible instead of being silently masked.
 */
export function resolveReusableAnswerContent(content: string): string {
  const trimmed = content.trim();
  if (!trimmed.startsWith('{')) {
    return content;
  }

  let payload: unknown;
  try {
    payload = JSON.parse(trimmed);
  } catch {
    return content;
  }

  if (typeof payload !== 'object' || payload == null) {
    return content;
  }

  const answer = (payload as Record<string, unknown>).answer;
  if (typeof answer !== 'string') {
    return content;
  }

  const normalized = answer.trim();
  return normalized.length > 0 ? normalized : content;
}
