export function validateSourceEntryUrl(
  rawValue: string,
  t: (key: string) => string
): { normalizedUrl: string; error: string | null } {
  const normalizedUrl = rawValue.trim();
  if (!normalizedUrl) {
    return {
      normalizedUrl,
      error: t("documents.sourceEntryInlineErrorRequired")
    };
  }

  try {
    const parsed = new URL(normalizedUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return {
        normalizedUrl,
        error: t("documents.sourceEntryInlineErrorInvalidHttpUrl")
      };
    }
  } catch {
    return {
      normalizedUrl,
      error: t("documents.sourceEntryInlineErrorInvalidHttpUrl")
    };
  }

  return {
    normalizedUrl,
    error: null
  };
}