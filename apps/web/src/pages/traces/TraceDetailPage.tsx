import {
  Alert,
  Anchor,
  Badge,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Title
} from "@mantine/core";
import { Link, useParams } from "react-router-dom";
import { StatePanel } from "../../components/StatePanel";
import { useConversationMessages, useTrace } from "../../features/api/hooks";
import { useI18n } from "../../i18n/I18nProvider";
import type { Citation, JsonValue } from "../../types/api";

type RetrievalScoreRecord = {
  chunkId: string;
  documentId: string | null;
  documentTitle: string | null;
  chunkIndex: number | null;
  contentPreview: string | null;
  isPrimary: boolean | null;
  pageNo: number | null;
  sectionTitle: string | null;
  score: number;
  vectorScore: number | null;
  lexicalScore: number | null;
  hybridScore: number | null;
  rerankScore: number | null;
};

type RankedEntry = RetrievalScoreRecord;

type FailureTaxonomyKey = "no_hit" | "fallback" | "slow_path" | "timeout" | "source_failure";

type TraceDiagnosticSummarySlice = {
  issueLine: string;
  retrievalLine: string;
  answerLine: string;
};

const SLOW_PATH_LATENCY_MS = 10_000;

function buildFailureTaxonomy(trace: {
  status: "success" | "failed";
  latencyMs: number | null;
  errorMessage: string | null;
  traceSummary?: {
    primaryIssue: string | null;
    insufficientContextReason: string | null;
    usedFallback: boolean;
    strategySummary: {
      usedFallback: boolean | null;
    };
    retrievedChunkCount: number;
    failureMessage: string | null;
    failureReadabilitySentence: string;
  } | null;
}): FailureTaxonomyKey[] {
  const taxonomy: FailureTaxonomyKey[] = [];
  const summary = trace.traceSummary ?? null;
  const diagnosticsText = [trace.errorMessage, summary?.failureMessage, summary?.failureReadabilitySentence]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLowerCase();

  const noHitDetected =
    summary?.primaryIssue === "no_retrieval_hits" ||
    summary?.insufficientContextReason === "no_retrieval_hits" ||
    summary?.retrievedChunkCount === 0;
  if (noHitDetected) {
    taxonomy.push("no_hit");
  }

  const fallbackDetected = Boolean(summary?.usedFallback || summary?.strategySummary.usedFallback || summary?.primaryIssue === "fallback_generation");
  if (fallbackDetected) {
    taxonomy.push("fallback");
  }

  const slowPathDetected = (trace.latencyMs ?? 0) >= SLOW_PATH_LATENCY_MS;
  if (slowPathDetected) {
    taxonomy.push("slow_path");
  }

  const timeoutDetected =
    trace.status === "failed" &&
    ["timeout", "timed out", "abort", "aborted", "deadline exceeded"].some(keyword => diagnosticsText.includes(keyword));
  if (timeoutDetected) {
    taxonomy.push("timeout");
  }

  const sourceFailureDetected =
    trace.status === "failed" &&
    ["source", "fetch", "web page", "feed", "sitemap", "content-type", "redirect", "external"].some(keyword =>
      diagnosticsText.includes(keyword)
    );
  if (sourceFailureDetected) {
    taxonomy.push("source_failure");
  }

  return taxonomy;
}

function getFailureTaxonomyLabel(key: FailureTaxonomyKey, locale: "zh" | "en") {
  if (key === "no_hit") {
    return locale === "zh" ? "无命中检索（no-hit）" : "No-hit retrieval";
  }
  if (key === "fallback") {
    return locale === "zh" ? "回退路径（fallback）" : "Fallback path";
  }
  if (key === "slow_path") {
    return locale === "zh" ? "慢路径（slow-path）" : "Slow path";
  }
  if (key === "timeout") {
    return locale === "zh" ? "超时（timeout）" : "Timeout";
  }

  return locale === "zh" ? "来源失败（source-failure）" : "Source failure";
}

function getFailureTaxonomyColor(key: FailureTaxonomyKey) {
  if (key === "no_hit") {
    return "gray";
  }
  if (key === "fallback") {
    return "yellow";
  }
  if (key === "slow_path") {
    return "orange";
  }
  if (key === "timeout") {
    return "red";
  }

  return "pink";
}

function buildTraceDiagnosticSummarySlice(
  trace: {
    status: "success" | "failed";
    errorMessage: string | null;
    traceSummary?: {
      primaryIssue: string | null;
      retrievalModeProvenanceSentence: string;
      failureReadabilitySentence: string;
      answerStatusSourceReadabilitySentence: string;
      missingInformationProvenanceSentence: string;
    } | null;
  },
  locale: "zh" | "en"
): TraceDiagnosticSummarySlice {
  const summary = trace.traceSummary ?? null;
  const issueSource =
    trace.status === "failed"
      ? summary?.failureReadabilitySentence || trace.errorMessage || (locale === "zh" ? "执行失败，需继续查看下方诊断。" : "Execution failed. Continue with diagnostics below.")
      : summary?.primaryIssue && summary.primaryIssue !== "none"
        ? `${locale === "zh" ? "主要问题" : "Primary issue"}: ${summary.primaryIssue}`
        : locale === "zh"
          ? "未发现阻断性主问题。"
          : "No blocking primary issue detected.";

  const retrievalLine =
    summary?.retrievalModeProvenanceSentence ||
    (locale === "zh" ? "暂无检索来源诊断摘要。" : "No retrieval-source diagnostic summary available.");

  const answerLine =
    summary?.answerStatusSourceReadabilitySentence || summary?.missingInformationProvenanceSentence ||
    (locale === "zh" ? "暂无回答状态溯源摘要。" : "No answer-status provenance summary available.");

  return {
    issueLine: issueSource,
    retrievalLine,
    answerLine
  };
}

function formatJson(value: JsonValue | unknown) {
  if (value == null) {
    return "null";
  }

  return JSON.stringify(value, null, 2);
}

function normalizeChunkIds(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function normalizeScores(value: unknown): RetrievalScoreRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(item => {
      if (
        typeof item !== "object" ||
        item === null ||
        !("chunkId" in item) ||
        !("score" in item) ||
        typeof item.chunkId !== "string" ||
        typeof item.score !== "number"
      ) {
        return null;
      }

      return {
        chunkId: item.chunkId,
        documentId: typeof item.documentId === "string" ? item.documentId : null,
        documentTitle: typeof item.documentTitle === "string" ? item.documentTitle : null,
        chunkIndex: typeof item.chunkIndex === "number" ? item.chunkIndex : null,
        contentPreview: typeof item.contentPreview === "string" ? item.contentPreview : null,
        isPrimary: typeof item.isPrimary === "boolean" ? item.isPrimary : null,
        pageNo: typeof item.pageNo === "number" ? item.pageNo : null,
        sectionTitle: typeof item.sectionTitle === "string" ? item.sectionTitle : null,
        score: item.score,
        vectorScore: typeof item.vectorScore === "number" ? item.vectorScore : null,
        lexicalScore: typeof item.lexicalScore === "number" ? item.lexicalScore : null,
        hybridScore: typeof item.hybridScore === "number" ? item.hybridScore : null,
        rerankScore: typeof item.rerankScore === "number" ? item.rerankScore : null
      };
    })
    .filter((item): item is RetrievalScoreRecord => item !== null);
}

function normalizeCitations(value: unknown): Citation[] {
  return Array.isArray(value) ? (value as Citation[]) : [];
}

function createUnscoredRankedEntry(chunkId: string): RankedEntry {
  return {
    chunkId,
    documentId: null,
    documentTitle: null,
    chunkIndex: null,
    contentPreview: null,
    isPrimary: null,
    pageNo: null,
    sectionTitle: null,
    score: 0,
    vectorScore: null,
    lexicalScore: null,
    hybridScore: null,
    rerankScore: null
  };
}

function buildRankedEntries(scores: RetrievalScoreRecord[], retrievedChunkIds: string[]): RankedEntry[] {
  const scoreChunkIds = new Set(scores.map(item => item.chunkId));
  const scoredEntries = scores
    .slice()
    .sort((left, right) => right.score - left.score || left.chunkId.localeCompare(right.chunkId));
  const unscoredEntries = retrievedChunkIds
    .filter(chunkId => !scoreChunkIds.has(chunkId))
    .map(chunkId => createUnscoredRankedEntry(chunkId));

  return [...scoredEntries, ...unscoredEntries];
}

function buildRawPayload(trace: {
  retrievedChunkIdsJson: unknown;
  retrievalScoresJson: unknown;
  citationsJson: unknown;
}): Record<string, unknown> {
  return {
    retrievedChunkIdsJson: trace.retrievedChunkIdsJson,
    retrievalScoresJson: trace.retrievalScoresJson,
    citationsJson: trace.citationsJson
  };
}

function buildDocumentChunkLink(
  documentId: string,
  chunkId: string,
  context?: {
    traceId?: string;
    rank?: number;
    isPrimary?: boolean | null;
    isCited?: boolean;
    score?: number | null;
  }
) {
  const searchParams = new URLSearchParams({
    chunkId
  });

  if (context?.traceId) {
    searchParams.set("fromTrace", context.traceId);
  }
  if (context?.rank != null) {
    searchParams.set("rank", String(context.rank));
  }
  if (context?.isPrimary != null) {
    searchParams.set("isPrimary", context.isPrimary ? "1" : "0");
  }
  if (context?.isCited) {
    searchParams.set("isCited", "1");
  }
  if (context?.score != null) {
    searchParams.set("score", context.score.toFixed(4));
  }

  return `/documents/${documentId}?${searchParams.toString()}`;
}

function formatScore(value: number | null) {
  return value == null ? "-" : value.toFixed(4);
}

export function TraceDetailPage() {
  const { traceId = null } = useParams();
  const traceQuery = useTrace(traceId);
  const trace = traceQuery.data;
  const conversationMessagesQuery = useConversationMessages(trace?.conversationId ?? null);
  const conversationMessages = conversationMessagesQuery.data ?? [];
  const retrievedChunkIds = normalizeChunkIds(trace?.retrievedChunkIdsJson);
  const scores = normalizeScores(trace?.retrievalScoresJson);
  const citations = normalizeCitations(trace?.citationsJson);
  const { formatDateTime, t, locale } = useI18n();
  const citationsByChunkId = new Map(citations.map(citation => [citation.chunkId, citation]));
  const rankedEntries = buildRankedEntries(scores, retrievedChunkIds);
  const hasRewrite = Boolean(trace?.rewrittenQuery);
  const traceSummary = trace?.traceSummary ?? null;
  const diagnosticSummarySlice = trace
    ? buildTraceDiagnosticSummarySlice(
        {
          status: trace.status,
          errorMessage: trace.errorMessage,
          traceSummary
        },
        locale
      )
    : null;
  const failureTaxonomy = trace
    ? buildFailureTaxonomy({
        status: trace.status,
        latencyMs: trace.latencyMs,
        errorMessage: trace.errorMessage,
        traceSummary
      })
    : [];
  const userRequestText =
    (trace?.userMessageId
      ? conversationMessages.find(message => message.id === trace.userMessageId)?.content
      : null) ??
    trace?.userQuery ??
    "";
  const assistantResponseText =
    (trace?.assistantMessageId
      ? conversationMessages.find(message => message.id === trace.assistantMessageId)?.content
      : null) ??
    conversationMessages.find(message => message.role === "assistant" && message.traceId === trace?.id)?.content ??
    null;

  return (
    <Stack gap="md">
      <Paper className="workspace-hero" p="lg" radius="xl">
        <Stack gap="sm">
          <Text c="var(--app-text-muted)" className="workspace-link" component={Link} size="sm" to="/traces">
            {locale === "zh" ? "返回 Trace 列表" : "Back to trace list"}
          </Text>
          <div className="workspace-hero-split">
            <div className="workspace-hero-copy">
              <Text className="workspace-hero-kicker">Trace detail</Text>
              <Title
                order={3}
                c="var(--app-text)"
                style={{ fontFamily: "var(--app-font-display)", letterSpacing: "-0.03em" }}
              >
                {trace?.id ?? t("trace.title")}
              </Title>
              <Text c="var(--app-text-muted)" mt={4}>
                {t("trace.subtitle")}
              </Text>
            </div>
            {trace ? (
              <Stack align="flex-end" gap={10}>
                <Group gap="xs">
                  <Badge color={trace.status === "success" ? "teal" : "red"} variant="light">
                    {t(`common.status.${trace.status}`)}
                  </Badge>
                  <Badge color="gray" variant="light">
                    {trace.modelName ?? "-"}
                  </Badge>
                </Group>
                <Text className="workspace-hero-sidecopy" ta="right">
                  {locale === "zh"
                    ? "保留 trace 原始数据、引用、chunk 深链和评分展示，只进一步统一 B 主题 panel 语言。"
                    : "Keep raw payload, citations, chunk deep links, and scoring intact while tightening the B-theme panel language."}
                </Text>
              </Stack>
            ) : null}
          </div>
        </Stack>
      </Paper>

      {traceQuery.isLoading ? (
        <StatePanel description={t("trace.subtitle")} title={t("trace.title")} tone="loading" />
      ) : null}
      {traceQuery.isError ? (
        <Alert color="red" radius="xl" variant="light">
          {traceQuery.error instanceof Error ? traceQuery.error.message : t("trace.loadError")}
        </Alert>
      ) : null}

      {trace ? (
        <>
          <Paper className="workspace-panel-hover workspace-panel-strong" p="lg" radius="xl">
            <Stack gap="md">
              <Group justify="space-between" wrap="nowrap">
                <div>
                  <Text className="workspace-section-heading">
                    {locale === "zh" ? "请求 / 响应 / 步骤" : "Request / response / steps"}
                  </Text>
                  <Text className="workspace-section-copy">
                    {locale === "zh"
                      ? "在一个视图里先看用户请求、最终响应，再快速扫过本轮检索与回答步骤。"
                      : "Start with the user request and final response, then scan retrieval/answering steps in one view."}
                  </Text>
                </div>
                <Badge color={trace.status === "success" ? "teal" : "red"} variant="light">
                  {trace.status === "success"
                    ? locale === "zh"
                      ? "完整链路"
                      : "Full chain"
                    : locale === "zh"
                      ? "失败链路"
                      : "Failed chain"}
                </Badge>
              </Group>

              <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
                <Paper className="workspace-panel-hover workspace-panel-muted" p="md" radius="lg">
                  <Stack gap="xs">
                    <Text className="workspace-section-heading">{locale === "zh" ? "请求" : "Request"}</Text>
                    <Text c="var(--app-text-secondary)" size="sm" style={{ whiteSpace: "pre-wrap" }}>
                      {userRequestText || (locale === "zh" ? "未记录用户请求。" : "No user request captured.")}
                    </Text>
                    <Text c="var(--app-text-muted)" size="xs">
                      {locale === "zh" ? "改写查询" : "Rewrite query"}
                    </Text>
                    <Text c="var(--app-text)" size="sm" style={{ whiteSpace: "pre-wrap" }}>
                      {trace.rewrittenQuery ?? (locale === "zh" ? "与原问题一致" : "Same as original question")}
                    </Text>
                  </Stack>
                </Paper>

                <Paper className="workspace-panel-hover workspace-panel-muted" p="md" radius="lg">
                  <Stack gap="xs">
                    <Text className="workspace-section-heading">{locale === "zh" ? "响应" : "Response"}</Text>
                    <Text c="var(--app-text-secondary)" size="sm" style={{ whiteSpace: "pre-wrap" }}>
                      {assistantResponseText
                        ? assistantResponseText
                        : conversationMessagesQuery.isLoading
                          ? locale === "zh"
                            ? "正在加载响应正文..."
                            : "Loading response text..."
                          : locale === "zh"
                            ? "未记录响应正文（可继续查看下方溯源摘要与引用）。"
                            : "No response text captured. Use provenance and citations below for diagnostics."}
                    </Text>
                    <Text c="var(--app-text-muted)" size="xs">
                      {locale === "zh" ? "回答状态" : "Answer status"}
                    </Text>
                    <Text c="var(--app-text)" size="sm" style={{ whiteSpace: "pre-wrap" }}>
                      {traceSummary?.answerStatus ?? (trace.status === "success" ? "grounded" : "insufficient_context")}
                    </Text>
                  </Stack>
                </Paper>

                <Paper className="workspace-panel-hover workspace-panel-muted" p="md" radius="lg">
                  <Stack gap="xs">
                    <Text className="workspace-section-heading">{locale === "zh" ? "步骤" : "Steps"}</Text>
                    <div className="workspace-meta-list">
                      <div className="workspace-meta-row">
                        <span className="workspace-meta-label">{locale === "zh" ? "步骤 1：查询准备" : "Step 1: query prep"}</span>
                        <span className="workspace-meta-value">
                          {traceSummary?.rewriteReadabilityLabel ??
                            (hasRewrite
                              ? locale === "zh"
                                ? "已执行 query rewrite"
                                : "query rewrite applied"
                              : locale === "zh"
                                ? "未执行 query rewrite"
                                : "query rewrite not applied")}
                        </span>
                      </div>
                      <div className="workspace-meta-row">
                        <span className="workspace-meta-label">{locale === "zh" ? "步骤 2：检索" : "Step 2: retrieval"}</span>
                        <span className="workspace-meta-value">
                          {traceSummary?.strategyReadabilityLabel ??
                            (locale === "zh" ? "暂无检索策略摘要。" : "No retrieval strategy summary.")}
                        </span>
                      </div>
                      <div className="workspace-meta-row">
                        <span className="workspace-meta-label">{locale === "zh" ? "步骤 3：回答" : "Step 3: answer"}</span>
                        <span className="workspace-meta-value">
                          {traceSummary?.answerProvenanceSentence ??
                            (locale === "zh" ? "暂无回答溯源摘要。" : "No answer provenance summary.")}
                        </span>
                      </div>
                      {traceSummary?.failureReadabilitySentence ? (
                        <div className="workspace-meta-row">
                          <span className="workspace-meta-label">{locale === "zh" ? "失败诊断" : "Failure"}</span>
                          <span className="workspace-meta-value">{traceSummary.failureReadabilitySentence}</span>
                        </div>
                      ) : null}
                    </div>
                  </Stack>
                </Paper>
              </SimpleGrid>
            </Stack>
          </Paper>

          <Paper className="workspace-panel-hover workspace-panel-strong" p="lg" radius="xl">
            <Stack gap="md">
              <Group justify="space-between" wrap="nowrap">
                <div>
                  <Text className="workspace-section-heading">
                    {locale === "zh" ? "执行摘要" : "Execution summary"}
                  </Text>
                  <Text className="workspace-section-copy">
                    {locale === "zh"
                      ? "先看结果、检索规模、引用数量和耗时，再决定是否继续看评分与原始载荷。"
                      : "Scan outcome, retrieval volume, citation count, and latency first, then drill into scores or raw payload only when needed."}
                  </Text>
                </div>
                <Badge color={trace.status === "success" ? "teal" : "red"} variant="light">
                  {t(`common.status.${trace.status}`)}
                </Badge>
              </Group>

              <div className="workspace-metric-grid">
                <Paper className="workspace-metric-card workspace-metric-card-compact" p="lg" radius="xl">
                  <Text className="workspace-metric-label">{locale === "zh" ? "本轮结果" : "Outcome"}</Text>
                  <Text className="workspace-metric-value">
                    {trace.status === "success"
                      ? locale === "zh"
                        ? "已完成"
                        : "Completed"
                      : locale === "zh"
                        ? "需排查"
                        : "Needs review"}
                  </Text>
                  <Text className="workspace-metric-subtle">
                    {trace.errorMessage
                      ? trace.errorMessage
                      : locale === "zh"
                        ? "回答链路已结束，可继续检查引用与评分。"
                        : "The answer pipeline finished. Continue with citations and score details if needed."}
                  </Text>
                </Paper>
                <Paper className="workspace-metric-card workspace-metric-card-compact" p="lg" radius="xl">
                  <Text className="workspace-metric-label">{locale === "zh" ? "命中 Chunk" : "Retrieved chunks"}</Text>
                  <Text className="workspace-metric-value">{retrievedChunkIds.length}</Text>
                  <Text className="workspace-metric-subtle">
                    {scores.length > 0
                      ? locale === "zh"
                        ? "已保存分数明细，可继续查看排序。"
                        : "Score breakdown is available for ranked inspection."
                      : locale === "zh"
                        ? "仅保留了 Trace 顺序，没有完整分数明细。"
                        : "Only trace order was persisted, without full score detail."}
                  </Text>
                </Paper>
                <Paper className="workspace-metric-card workspace-metric-card-compact" p="lg" radius="xl">
                  <Text className="workspace-metric-label">{locale === "zh" ? "引用数量" : "Citations"}</Text>
                  <Text className="workspace-metric-value">{citations.length}</Text>
                  <Text className="workspace-metric-subtle">
                    {locale === "zh"
                      ? "右下区域保留可跳转文档的引用卡片。"
                      : "Citations remain directly linked to their source documents."}
                  </Text>
                </Paper>
                <Paper className="workspace-metric-card workspace-metric-card-compact" p="lg" radius="xl">
                  <Text className="workspace-metric-label">{locale === "zh" ? "总耗时" : "Latency"}</Text>
                  <Text className="workspace-metric-value">{trace.latencyMs ?? "-"}</Text>
                  <Text className="workspace-metric-subtle">
                    {locale === "zh"
                      ? hasRewrite
                        ? "本轮已启用问题改写。"
                        : "本轮未触发问题改写。"
                      : hasRewrite
                        ? "Query rewrite was applied for this run."
                        : "No query rewrite was applied for this run."}
                  </Text>
                </Paper>
              </div>

              <Paper className="workspace-panel-hover workspace-panel-muted" p="md" radius="lg">
                <Stack gap="xs">
                  <Text className="workspace-section-heading">
                    {locale === "zh" ? "失败分类（P6 v1）" : "Failure taxonomy (P6 v1)"}
                  </Text>
                  <Text c="var(--app-text-muted)" size="xs">
                    {locale === "zh"
                      ? "按 no-hit / fallback / slow-path / timeout / source-failure 归类当前 trace，便于快速定位问题类型。"
                      : "Categorizes this trace into no-hit, fallback, slow-path, timeout, and source-failure for faster triage."}
                  </Text>
                  {failureTaxonomy.length > 0 ? (
                    <Group gap="xs">
                      {failureTaxonomy.map(category => (
                        <Badge color={getFailureTaxonomyColor(category)} key={category} variant="light">
                          {getFailureTaxonomyLabel(category, locale)}
                        </Badge>
                      ))}
                    </Group>
                  ) : (
                    <Text c="var(--app-text-secondary)" size="sm">
                      {locale === "zh"
                        ? "当前 trace 未命中以上失败分类。"
                        : "No failure taxonomy category was detected for this trace."}
                    </Text>
                  )}
                </Stack>
              </Paper>

              {diagnosticSummarySlice ? (
                <Paper className="workspace-panel-hover workspace-panel-muted" p="md" radius="lg">
                  <Stack gap="xs">
                    <Text className="workspace-section-heading">
                      {locale === "zh" ? "诊断摘要切片（scan-first）" : "Diagnostic summary slice (scan-first)"}
                    </Text>
                    <Text c="var(--app-text-muted)" size="xs">
                      {locale === "zh"
                        ? "先看一条问题线索 + 一条检索线索 + 一条回答线索，快速决定下一步排查方向。"
                        : "Scan one issue line, one retrieval line, and one answer line before drilling into raw detail."}
                    </Text>
                    <div className="workspace-meta-list">
                      <div className="workspace-meta-row">
                        <span className="workspace-meta-label">{locale === "zh" ? "问题线索" : "Issue signal"}</span>
                        <span className="workspace-meta-value">{diagnosticSummarySlice.issueLine}</span>
                      </div>
                      <div className="workspace-meta-row">
                        <span className="workspace-meta-label">{locale === "zh" ? "检索线索" : "Retrieval signal"}</span>
                        <span className="workspace-meta-value">{diagnosticSummarySlice.retrievalLine}</span>
                      </div>
                      <div className="workspace-meta-row">
                        <span className="workspace-meta-label">{locale === "zh" ? "回答线索" : "Answer signal"}</span>
                        <span className="workspace-meta-value">{diagnosticSummarySlice.answerLine}</span>
                      </div>
                    </div>
                  </Stack>
                </Paper>
              ) : null}

              {traceSummary ? (
                <div className="workspace-meta-list">
                  <div className="workspace-meta-row">
                    <span className="workspace-meta-label">{locale === "zh" ? "检索策略摘要" : "Retrieval strategy"}</span>
                    <span className="workspace-meta-value">{traceSummary.strategyReadabilityLabel}</span>
                  </div>
                  <div className="workspace-meta-row">
                    <span className="workspace-meta-label">{locale === "zh" ? "改写摘要" : "Rewrite summary"}</span>
                    <span className="workspace-meta-value">{traceSummary.rewriteReadabilityLabel}</span>
                  </div>
                  <div className="workspace-meta-row">
                    <span className="workspace-meta-label">{locale === "zh" ? "候选规模" : "Candidate flow"}</span>
                    <span className="workspace-meta-value">{traceSummary.candidateCountReadabilityLabel}</span>
                  </div>
                  <div className="workspace-meta-row">
                    <span className="workspace-meta-label">{locale === "zh" ? "引用摘要" : "Citation summary"}</span>
                    <span className="workspace-meta-value">{traceSummary.citationCountReadabilityLabel}</span>
                  </div>
                  <div className="workspace-meta-row">
                    <span className="workspace-meta-label">{locale === "zh" ? "回答溯源" : "Answer provenance"}</span>
                    <span className="workspace-meta-value">{traceSummary.answerProvenanceSentence}</span>
                  </div>
                  <div className="workspace-meta-row">
                    <span className="workspace-meta-label">
                      {locale === "zh" ? "缺失信息溯源" : "Missing-information provenance"}
                    </span>
                    <span className="workspace-meta-value">{traceSummary.missingInformationProvenanceSentence}</span>
                  </div>
                </div>
              ) : null}
            </Stack>
          </Paper>

          <div className="workspace-page-grid">
          <div className="workspace-page-side-stack">
            <div className="workspace-sticky-panel">
              <Stack gap="md">
                <Paper className="workspace-panel-hover workspace-panel-strong" p="lg" radius="xl">
                  <Stack gap="md">
                    <Text className="workspace-section-heading">
                      {locale === "zh" ? "Trace 元数据" : "Trace metadata"}
                    </Text>
                    <div className="workspace-meta-list">
                      <div className="workspace-meta-row">
                        <span className="workspace-meta-label">{t("common.fields.created")}</span>
                        <span className="workspace-meta-value">{formatDateTime(trace.createdAt)}</span>
                      </div>
                      <div className="workspace-meta-row">
                        <span className="workspace-meta-label">{t("common.fields.conversation")}</span>
                        <span className="workspace-meta-value">{trace.conversationId}</span>
                      </div>
                      <div className="workspace-meta-row">
                        <span className="workspace-meta-label">{t("common.fields.assistant")}</span>
                        <span className="workspace-meta-value">{trace.assistantId}</span>
                      </div>
                      <div className="workspace-meta-row">
                        <span className="workspace-meta-label">{t("common.fields.latency")}</span>
                        <span className="workspace-meta-value">{trace.latencyMs ?? "-"} ms</span>
                      </div>
                      <div className="workspace-meta-row">
                        <span className="workspace-meta-label">{t("common.fields.model")}</span>
                        <span className="workspace-meta-value">{trace.modelName ?? "-"}</span>
                      </div>
                    </div>
                    {trace.errorMessage ? (
                      <Alert color="red" radius="xl" variant="light">
                        {trace.errorMessage}
                      </Alert>
                    ) : null}
                  </Stack>
                </Paper>

                <Paper className="workspace-panel-hover workspace-panel-muted" p="lg" radius="xl">
                  <Stack gap="md">
                    <Group justify="space-between">
                      <Text className="workspace-section-heading">{t("trace.queryComparison")}</Text>
                      <Badge color={hasRewrite ? "blue" : "gray"} variant="light">
                        {hasRewrite ? t("trace.rewriteApplied") : t("trace.rewriteNotApplied")}
                      </Badge>
                    </Group>
                    <Text className="workspace-section-copy">{t("trace.queryComparisonDescription")}</Text>
                    <Stack gap="sm">
                      <div className="workspace-content-block">
                        <Stack gap={6}>
                          <Text c="var(--app-text-muted)" size="xs">
                            {t("common.fields.userQuery")}
                          </Text>
                          <Text c="var(--app-text)" size="sm" style={{ whiteSpace: "pre-wrap" }}>
                            {trace.userQuery}
                          </Text>
                        </Stack>
                      </div>
                      <div className="workspace-content-block">
                        <Stack gap={6}>
                          <Text c="var(--app-text-muted)" size="xs">
                            {t("common.fields.rewrittenQuery")}
                          </Text>
                          <Text c="var(--app-text)" size="sm" style={{ whiteSpace: "pre-wrap" }}>
                            {trace.rewrittenQuery ?? t("trace.rewriteSameAsOriginal")}
                          </Text>
                        </Stack>
                      </div>
                    </Stack>
                  </Stack>
                </Paper>
              </Stack>
            </div>
          </div>

          <div className="workspace-page-main-stack">
            <Stack gap="md">
              <Paper className="workspace-panel-hover workspace-panel-strong" p="lg" radius="xl">
                <Stack gap="md">
                  <Group justify="space-between">
                    <div>
                      <Text className="workspace-section-heading">{t("trace.retrievedChunks")}</Text>
                      <Text className="workspace-section-copy">
                        {scores.length > 0 ? t("trace.sortedByScore") : t("trace.sortedByTraceOrder")}
                      </Text>
                    </div>
                    <Badge variant="light">{retrievedChunkIds.length}</Badge>
                  </Group>

                  {rankedEntries.length > 0 ? (
                    <div className="workspace-collection-grid">
                      {rankedEntries.map((item, index) => {
                        const linkedCitation = citationsByChunkId.get(item.chunkId);
                        const linkDocumentId = item.documentId ?? linkedCitation?.documentId ?? null;
                        const canLink = linkDocumentId != null;
                        const titleText = item.documentTitle ?? linkedCitation?.documentTitle ?? item.chunkId;
                        const sectionText = item.sectionTitle ?? linkedCitation?.sectionTitle ?? null;
                        const pageNo = item.pageNo ?? linkedCitation?.pageNo ?? null;
                        const isCited = linkedCitation != null;

                        return (
                          <Paper className="workspace-citation-card workspace-panel-muted" key={item.chunkId} p="md" radius="lg">
                            <Stack gap="sm">
                              <Group justify="space-between" align="flex-start">
                                <Stack gap={8}>
                                  <Group gap="xs">
                                    <Badge variant="light">{t("trace.rankLabel", { rank: index + 1 })}</Badge>
                                    {item.isPrimary === true ? (
                                      <Badge color="teal" variant="light">
                                        {t("trace.primaryChunk")}
                                      </Badge>
                                    ) : item.isPrimary === false ? (
                                      <Badge color="gray" variant="light">
                                        {t("trace.neighborChunk")}
                                      </Badge>
                                    ) : null}
                                    {isCited ? (
                                      <Badge color="blue" variant="light">
                                        {t("trace.citedChunk")}
                                      </Badge>
                                    ) : null}
                                  </Group>

                                  {canLink ? (
                                    <Anchor
                                      component={Link}
                                      to={buildDocumentChunkLink(linkDocumentId, item.chunkId, {
                                        traceId: trace.id,
                                        rank: index + 1,
                                        isPrimary: item.isPrimary,
                                        isCited,
                                        score: item.score
                                      })}
                                    >
                                      <Text c="var(--app-text)" fw={600} span>
                                        {titleText}
                                      </Text>
                                    </Anchor>
                                  ) : (
                                    <Text c="var(--app-text)" fw={600}>
                                      {titleText}
                                    </Text>
                                  )}

                                  <Group gap="xs">
                                    <span className="workspace-inline-chip">{item.chunkId}</span>
                                    {item.chunkIndex != null ? <Badge variant="light">#{item.chunkIndex}</Badge> : null}
                                  </Group>

                                  {sectionText || pageNo != null ? (
                                    <Text c="var(--app-text-muted)" size="sm">
                                      {sectionText ?? t("common.misc.noSection")}
                                      {pageNo != null ? ` / ${t("common.misc.pageLong", { pageNo })}` : ""}
                                    </Text>
                                  ) : null}
                                </Stack>

                                <Badge color="blue" size="lg" variant="light">
                                  {t("trace.finalScoreLabel", { score: formatScore(item.score) })}
                                </Badge>
                              </Group>

                              <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="xs">
                                <Badge color="gray" variant="light">
                                  {t("trace.vectorScoreLabel", { score: formatScore(item.vectorScore) })}
                                </Badge>
                                <Badge color="gray" variant="light">
                                  {t("trace.lexicalScoreLabel", { score: formatScore(item.lexicalScore) })}
                                </Badge>
                                <Badge color="gray" variant="light">
                                  {t("trace.hybridScoreLabel", { score: formatScore(item.hybridScore) })}
                                </Badge>
                                <Badge color="gray" variant="light">
                                  {t("trace.rerankScoreLabel", { score: formatScore(item.rerankScore) })}
                                </Badge>
                              </SimpleGrid>

                              {item.contentPreview || linkedCitation ? (
                                <div className="workspace-content-block">
                                  <Stack gap={6}>
                                    <Text c="var(--app-text-muted)" size="xs">
                                      {t("trace.chunkPreview")}
                                    </Text>
                                    <Text c="var(--app-text-secondary)" size="sm" style={{ whiteSpace: "pre-wrap" }}>
                                      {isCited ? linkedCitation.snippet : item.contentPreview}
                                    </Text>
                                  </Stack>
                                </div>
                              ) : null}
                            </Stack>
                          </Paper>
                        );
                      })}
                    </div>
                  ) : (
                    <StatePanel description={t("trace.noRetrievedChunks")} title={t("trace.retrievedChunks")} />
                  )}
                </Stack>
              </Paper>

              <div className="workspace-detail-secondary-grid">
                <Paper className="workspace-panel-hover workspace-panel-muted" p="lg" radius="xl">
                  <Stack gap="md">
                    <Group justify="space-between">
                      <Text className="workspace-section-heading">{t("trace.citations")}</Text>
                      <Badge variant="light">{citations.length}</Badge>
                    </Group>

                    {citations.length > 0 ? (
                      <div className="workspace-collection-grid">
                        {citations.map(citation => (
                          <Paper
                            className="workspace-citation-card"
                            key={citation.chunkId}
                            p="md"
                            radius="lg"
                            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                          >
                            <Stack gap="xs">
                              <Group justify="space-between" align="flex-start">
                                <Anchor
                                  component={Link}
                                  fw={600}
                                  to={buildDocumentChunkLink(citation.documentId, citation.chunkId, {
                                    traceId: trace.id,
                                    isCited: true
                                  })}
                                >
                                  <Text c="var(--app-text)" fw={600} span>
                                    {citation.documentTitle}
                                  </Text>
                                </Anchor>
                                <span className="workspace-inline-chip">{citation.chunkId}</span>
                              </Group>
                              <Text c="var(--app-text-muted)" size="sm">
                                {citation.sectionTitle ?? t("common.misc.noSection")}
                                {citation.pageNo != null ? ` / ${t("common.misc.pageLong", { pageNo: citation.pageNo })}` : ""}
                              </Text>
                              <div className="workspace-content-block">
                                <Text c="var(--app-text-secondary)" size="sm" style={{ whiteSpace: "pre-wrap" }}>
                                  {citation.snippet}
                                </Text>
                              </div>
                            </Stack>
                          </Paper>
                        ))}
                      </div>
                    ) : (
                      <StatePanel description={t("trace.noCitations")} title={t("trace.citations")} />
                    )}
                  </Stack>
                </Paper>

                <Paper className="workspace-panel-hover workspace-panel-muted" p="lg" radius="xl">
                  <details>
                    <summary className="workspace-collapsible-summary">
                      <span>{t("common.fields.rawPayload")}</span>
                      <span className="workspace-inline-chip">
                        {locale === "zh" ? "次级诊断" : "Secondary diagnostics"}
                      </span>
                    </summary>
                    <Text c="var(--app-text-muted)" mt="sm" size="sm">
                      {locale === "zh"
                        ? "仅在需要核对原始 trace 载荷时展开。"
                        : "Expand only when you need to inspect the captured trace payload directly."}
                    </Text>
                    <pre className="workspace-code-block workspace-code-block-scroll" style={{ marginTop: "0.9rem" }}>
                      {formatJson(buildRawPayload(trace))}
                    </pre>
                  </details>
                </Paper>
              </div>
            </Stack>
          </div>
          </div>
        </>
      ) : null}
    </Stack>
  );
}
