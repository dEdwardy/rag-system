import type { Citation } from "../../types/api";

export function formatConversationUpdatedAt(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

export function buildCitationContext(
  citation: Pick<Citation, "pageNo" | "sectionTitle">,
  labels: {
    pageLabel: (pageNo: number) => string;
  }
) {
  const parts: string[] = [];

  if (citation.pageNo != null) {
    parts.push(labels.pageLabel(citation.pageNo));
  }

  if (citation.sectionTitle) {
    parts.push(citation.sectionTitle);
  }

  return parts.length > 0 ? parts.join(" • ") : null;
}
