type Locale = "zh" | "en";

export function buildRunSummaryActionTarget(args: {
  locale: Locale;
  latestFailureDocumentId?: string | null;
}) {
  if (args.latestFailureDocumentId) {
    return {
      label: args.locale === "zh" ? "打开失败文档" : "Open failed document",
      to: `/documents/${args.latestFailureDocumentId}`
    };
  }

  return {
    label: args.locale === "zh" ? "查看运行摘要" : "Open run summary",
    to: "/knowledge-base"
  };
}
