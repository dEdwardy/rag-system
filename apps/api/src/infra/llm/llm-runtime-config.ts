const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_OPENAI_CHAT_MODEL = "gpt-4.1-mini";
const DEFAULT_LLM_ANSWER_TEMPERATURE = 0.2;
const DEFAULT_LLM_REWRITE_TEMPERATURE = 0;

export type LlmRuntimeConfig = {
  ollamaBaseUrl: string | null;
  ollamaModel: string | null;
  openAiApiKey: string | null;
  openAiBaseUrl: string;
  openAiChatModel: string;
  answerTemperature: number;
  rewriteTemperature: number;
};

export function resolveLlmRuntimeConfig(env: NodeJS.ProcessEnv = process.env): LlmRuntimeConfig {
  return {
    ollamaBaseUrl: readOptionalString(env.OLLAMA_BASE_URL),
    ollamaModel: readOptionalString(env.OLLAMA_MODEL),
    openAiApiKey: readOptionalString(env.OPENAI_API_KEY),
    openAiBaseUrl: normalizeBaseUrl(readOptionalString(env.OPENAI_BASE_URL) ?? DEFAULT_OPENAI_BASE_URL),
    openAiChatModel: readOptionalString(env.OPENAI_CHAT_MODEL) ?? DEFAULT_OPENAI_CHAT_MODEL,
    answerTemperature: readFiniteNumber(env.LLM_ANSWER_TEMPERATURE, DEFAULT_LLM_ANSWER_TEMPERATURE),
    rewriteTemperature: readFiniteNumber(env.LLM_REWRITE_TEMPERATURE, DEFAULT_LLM_REWRITE_TEMPERATURE)
  };
}

function readOptionalString(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function readFiniteNumber(value: string | undefined, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return parsed;
}

function normalizeBaseUrl(value: string) {
  return value.replace(/\/$/, "");
}
