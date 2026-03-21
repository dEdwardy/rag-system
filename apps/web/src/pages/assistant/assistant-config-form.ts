import type {
  AnswerPolicy,
  Assistant,
  RetrievalProfile,
  RetrievalProfileFilters
} from "../../types/api";

export const DEFAULT_ANSWER_POLICY: Required<AnswerPolicy> = {
  responseStyle: "concise",
  tone: "neutral",
  outputFormat: "paragraph",
  language: "auto",
  citationMode: "required",
  maxCitations: 3,
  noAnswerBehavior: "say_insufficient_context",
  includeMissingInformation: true
};

export type AssistantConfigFormValues = {
  name: string;
  description: string;
  systemPrompt: string;
  status: "active" | "inactive";
  topK: number;
  chunkWindow: number;
  enableHybrid: boolean;
  enableRerank: boolean;
  scoreThreshold: number;
  responseStyle: AnswerPolicy["responseStyle"];
  tone: Required<AnswerPolicy>["tone"];
  outputFormat: Required<AnswerPolicy>["outputFormat"];
  language: Required<AnswerPolicy>["language"];
  citationMode: AnswerPolicy["citationMode"];
  maxCitations: number;
  noAnswerBehavior: AnswerPolicy["noAnswerBehavior"];
  includeMissingInformation: boolean;
  documentIdsInclude: string;
  documentIdsExclude: string;
  sectionTitlesInclude: string;
  sectionTitlesExclude: string;
  sectionTitlesContains: string;
  pageNumbersInclude: string;
  pageNumbersExclude: string;
  pageNumbersMin: number | null;
  pageNumbersMax: number | null;
};

function joinLines(values?: string[] | number[] | null) {
  return values?.join("\n") ?? "";
}

function normalizeStringList(value: string) {
  const items = value
    .split(/[\n,]/)
    .map(item => item.trim())
    .filter(Boolean);

  return items.length > 0 ? Array.from(new Set(items)) : undefined;
}

function normalizeNumberList(value: string) {
  const items = value
    .split(/[\n,]/)
    .map(item => item.trim())
    .filter(item => item.length > 0)
    .map(item => Number(item))
    .filter(item => Number.isInteger(item) && item >= 0);

  return items.length > 0 ? Array.from(new Set(items)) : undefined;
}

function compactObject<T extends Record<string, unknown>>(value: T) {
  const normalized = Object.fromEntries(
    Object.entries(value).filter(([, fieldValue]) => fieldValue !== undefined)
  ) as T;

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function buildFiltersJson(values: AssistantConfigFormValues): RetrievalProfileFilters | null {
  const filters = compactObject({
    documentIds: compactObject({
      include: normalizeStringList(values.documentIdsInclude),
      exclude: normalizeStringList(values.documentIdsExclude)
    }),
    sectionTitles: compactObject({
      include: normalizeStringList(values.sectionTitlesInclude),
      exclude: normalizeStringList(values.sectionTitlesExclude),
      contains: normalizeStringList(values.sectionTitlesContains)
    }),
    pageNumbers: compactObject({
      include: normalizeNumberList(values.pageNumbersInclude),
      exclude: normalizeNumberList(values.pageNumbersExclude),
      min: values.pageNumbersMin ?? undefined,
      max: values.pageNumbersMax ?? undefined
    })
  });

  return filters ?? null;
}

export function createAssistantConfigFormValues(
  assistant: Assistant | null,
  retrievalProfile: RetrievalProfile | null
): AssistantConfigFormValues {
  const answerPolicy = {
    ...DEFAULT_ANSWER_POLICY,
    ...(assistant?.answerPolicyJson ?? {})
  };
  const filters = retrievalProfile?.filtersJson ?? null;

  return {
    name: assistant?.name ?? "",
    description: assistant?.description ?? "",
    systemPrompt: assistant?.systemPrompt ?? "",
    status: assistant?.status ?? "active",
    topK: retrievalProfile?.topK ?? 3,
    chunkWindow: retrievalProfile?.chunkWindow ?? 0,
    enableHybrid: retrievalProfile?.enableHybrid ?? false,
    enableRerank: retrievalProfile?.enableRerank ?? false,
    scoreThreshold: retrievalProfile?.scoreThreshold ?? 0,
    responseStyle: answerPolicy.responseStyle,
    tone: answerPolicy.tone,
    outputFormat: answerPolicy.outputFormat,
    language: answerPolicy.language,
    citationMode: answerPolicy.citationMode,
    maxCitations: answerPolicy.maxCitations,
    noAnswerBehavior: answerPolicy.noAnswerBehavior,
    includeMissingInformation: answerPolicy.includeMissingInformation,
    documentIdsInclude: joinLines(filters?.documentIds?.include),
    documentIdsExclude: joinLines(filters?.documentIds?.exclude),
    sectionTitlesInclude: joinLines(filters?.sectionTitles?.include),
    sectionTitlesExclude: joinLines(filters?.sectionTitles?.exclude),
    sectionTitlesContains: joinLines(filters?.sectionTitles?.contains),
    pageNumbersInclude: joinLines(filters?.pageNumbers?.include),
    pageNumbersExclude: joinLines(filters?.pageNumbers?.exclude),
    pageNumbersMin: filters?.pageNumbers?.min ?? null,
    pageNumbersMax: filters?.pageNumbers?.max ?? null
  };
}

export function buildAssistantUpdatePayload(values: AssistantConfigFormValues) {
  return {
    name: values.name,
    description: values.description.trim() ? values.description : null,
    systemPrompt: values.systemPrompt,
    status: values.status,
    answerPolicyJson: {
      responseStyle: values.responseStyle,
      tone: values.tone,
      outputFormat: values.outputFormat,
      language: values.language,
      citationMode: values.citationMode,
      maxCitations: values.maxCitations,
      noAnswerBehavior: values.noAnswerBehavior,
      includeMissingInformation: values.includeMissingInformation
    } satisfies AnswerPolicy
  };
}

export function buildRetrievalProfileUpdatePayload(values: AssistantConfigFormValues) {
  return {
    topK: values.topK,
    chunkWindow: values.chunkWindow,
    enableHybrid: values.enableHybrid,
    enableRerank: values.enableRerank,
    scoreThreshold: values.scoreThreshold,
    filtersJson: buildFiltersJson(values)
  };
}
