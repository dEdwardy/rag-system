export type SupportedLocale = "zh" | "en";
export type MessageValue = string | { [key: string]: MessageValue };
export type Messages = { [key: string]: MessageValue };

const loaders: Record<SupportedLocale, () => Promise<Messages>> = {
  en: async () => (await import("./messages.en")).messages,
  zh: async () => (await import("./messages.zh")).messages
};

export function loadMessages(locale: SupportedLocale) {
  return loaders[locale]();
}
