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
import { Link, useParams, useSearchParams } from "react-router-dom";
import { StatePanel } from "../../components/StatePanel";
import { useConversationMessages, useTrace } from "../../features/api/hooks";
import { useI18n } from "../../i18n/I18nProvider";
import type { Citation, JsonValue } from "../../types/api";
import {
  buildFailureTaxonomy,
  getFailureTaxonomyLabel,
  getFailureTaxonomyColor,
  buildRawPayload,
  buildDocumentChunkLink
} from "./trace-detail-page-helpers";

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

type TraceDiagnosticSummarySlice = {
  issueLine: string;
  retrievalLine: string;
  answerLine: string;
};

const TRACE_DETAIL_SECTION_IDS = {
  retrievedChunks: "trace-detail-retrieved-chunks",
  citations: "trace-detail-citations",
  rawPayload: "trace-detail-raw-payload",
  requestResponse: "trace-detail-request-response"
} as const;



function getPrimaryIssueReadabilityLabel(primaryIssue: string, locale: "zh" | "en") {
  if (primaryIssue === "no_retrieval_hits") {
    return locale === "zh" ? "检索未命中" : "No retrieval hits";
  }
  if (primaryIssue === "insufficient_context") {
    return locale === "zh" ? "检索上下文不足" : "Retrieved context is insufficient";
  }
  if (primaryIssue === "missing_information") {
    return locale === "zh" ? "回答缺失关键信息" : "Missing key information";
  }
  if (primaryIssue === "low_retrieval_score") {
    return locale === "zh" ? "检索置信度偏低" : "Low retrieval confidence";
  }
  if (primaryIssue === "fallback_generation") {
    return locale === "zh" ? "回答走了回退生成路径" : "Fallback generation path";
  }
  if (primaryIssue === "other") {
    return locale === "zh" ? "其他问题" : "Other issue";
  }

  return primaryIssue;
}

function getAnswerStatusReadabilityLabel(answerStatus: string | null | undefined, locale: "zh" | "en") {
  if (!answerStatus) {
    return locale === "zh" ? "未知" : "Unknown";
  }

  if (answerStatus === "grounded") {
    return locale === "zh" ? "有依据（grounded）" : "Grounded (grounded)";
  }

  if (answerStatus === "insufficient_context") {
    return locale === "zh" ? "上下文不足（insufficient_context）" : "Insufficient context (insufficient_context)";
  }

  return answerStatus;
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
        ? `${locale === "zh" ? "主要问题" : "Primary issue"}: ${getPrimaryIssueReadabilityLabel(summary.primaryIssue, locale)}`
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



function formatScore(value: number | null) {
  return value == null ? "-" : value.toFixed(4);
}

export function TraceDetailPage() {
  const { traceId = null } = useParams();
  const [searchParams] = useSearchParams();
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
  const reportSource = searchParams.get("from") === "report";
  const reportQuestion = searchParams.get("question");
  const reportHandling = searchParams.get("handling");
  const reportPriority = searchParams.get("priority");
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
  const answerStatusValue = traceSummary?.answerStatus ?? (trace?.status === "success" ? "grounded" : "insufficient_context");
  const scanFirstDocumentTarget =
    rankedEntries.find(entry => entry.documentId)?.documentId ?? citations.find(citation => citation.documentId)?.documentId ?? null;
  const scanFirstDocumentTitle =
    rankedEntries.find(entry => entry.documentId && entry.documentTitle)?.documentTitle ??
    citations.find(citation => citation.documentTitle)?.documentTitle ??
    null;
  const runFailureSummary =
    trace == null
      ? null
      : traceSummary?.failureReadabilitySentence ||
        trace.errorMessage ||
        (trace.status === "failed"
          ? locale === "zh"
            ? "运行失败，先回看文档详情页中的 run 失败摘要。"
            : "Run failed. Start with the run failure summary from Document Detail."
          : locale === "zh"
            ? "本轮未记录失败摘要。"
            : "No failure summary was recorded for this run.");
  const traceScanItems = trace
    ? [
        {
          key: "status",
          label: locale === "zh" ? "结果" : "Outcome",
          value:
            trace.status === "success"
              ? locale === "zh"
                ? "已完成"
                : "Completed"
              : locale === "zh"
                ? "需排查"
                : "Needs review",
          copy:
            trace.errorMessage ??
            (locale === "zh"
              ? "先看执行摘要，再决定是否展开 chunk 与原始载荷。"
              : "Start with the execution summary before expanding chunks or raw payload.")
        },
        {
          key: "retrieval",
          label: locale === "zh" ? "检索规模" : "Retrieval size",
          value:
            locale === "zh"
              ? `${retrievedChunkIds.length} 个 chunk / ${citations.length} 条引用`
              : `${retrievedChunkIds.length} chunks / ${citations.length} citations`,
          copy:
            scores.length > 0
              ? locale === "zh"
                ? "已保留评分，可直接继续看排序结果。"
                : "Scores are available for ranked inspection."
              : locale === "zh"
                ? "当前只保留了 trace 顺序。"
                : "Only trace order is available for this run."
        },
        {
          key: "taxonomy",
          label: locale === "zh" ? "失败分类" : "Failure taxonomy",
          value:
            failureTaxonomy.length > 0
              ? failureTaxonomy.map(category => getFailureTaxonomyLabel(category, locale)).join(" / ")
              : locale === "zh"
                ? "未命中失败分类"
                : "No failure taxonomy",
          copy:
            diagnosticSummarySlice?.issueLine ??
            (locale === "zh"
              ? "当前没有额外问题线索。"
              : "No additional issue signal is available.")
        }
      ]
    : [];
  const reviewFocusItems = trace
    ? [
        {
          key: "issue",
          label: locale === "zh" ? "先看问题线索" : "Start with issue signal",
          value:
            diagnosticSummarySlice?.issueLine ??
            (locale === "zh" ? "当前没有额外问题线索。" : "No additional issue signal is available."),
          href: "#trace-detail-review-focus",
          actionLabel: locale === "zh" ? "留在当前区块" : "Stay here"
        },
        {
          key: "retrieval",
          label: locale === "zh" ? "再看检索与引用" : "Then check retrieval and citations",
          value:
            diagnosticSummarySlice?.retrievalLine ??
            (locale === "zh" ? "暂无检索来源诊断摘要。" : "No retrieval-source diagnostic summary available."),
          href: `#${TRACE_DETAIL_SECTION_IDS.retrievedChunks}`,
          actionLabel: locale === "zh" ? "查看命中 Chunk" : "Go to retrieved chunks"
        },
        {
          key: "answer",
          label: locale === "zh" ? "最后看回答与原始载荷" : "Finish with answer and raw payload",
          value:
            diagnosticSummarySlice?.answerLine ??
            (locale === "zh" ? "暂无回答状态溯源摘要。" : "No answer-status provenance summary available."),
          href: `#${TRACE_DETAIL_SECTION_IDS.requestResponse}`,
          actionLabel: locale === "zh" ? "查看请求与响应" : "Go to request and response"
        }
      ]
    : [];

  return (
    <Stack gap="md">
      <Paper className="workspace-hero" p="lg" radius="xl">
        <Stack gap="sm">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Text c="var(--app-text-muted)" className="workspace-link" component={Link} size="sm" to="/workbench">
              {locale === "zh" ? "返回工作台概览" : "Back to workbench overview"}
            </Text>
            <Text c="var(--app-text-muted)" size="sm">/</Text>
            <Text c="var(--app-text-muted)" className="workspace-link" component={Link} size="sm" to="/traces">
              {locale === "zh" ? "返回诊断列表" : "Back to diagnostics list"}
            </Text>
          </div>
          <div className="workspace-hero-split">
            <div className="workspace-hero-copy">
              <Text className="workspace-hero-kicker">Workbench</Text>
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
                    ? "保留 Trace 原始数据、引用、chunk 深链和评分展示，只把页面更明确地收成诊断视图。"
                    : "Keep raw payload, citations, chunk deep links, and scoring intact while framing the page more clearly as diagnostics."}
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
          {reportSource && (reportQuestion || reportHandling || reportPriority) ? (
            <Paper className="workspace-panel-hover workspace-panel-strong" p="lg" radius="xl">
              <Stack gap="sm">
                <div className="workspace-section-heading">
                  {locale === "zh" ? "来自质量报告的复盘上下文" : "Review context from quality reports"}
                </div>
                <Text c="var(--app-text-muted)" size="sm">
                  {locale === "zh"
                    ? "这条诊断是从质量报告跳进来的。先按这里的治理上下文理解问题，再继续看下面的复盘顺序。"
                    : "This trace was opened from quality reports. Read it through the governance context below before following the review order underneath."}
                </Text>
                <div className="workspace-meta-list">
                  {reportPriority ? (
                    <div className="workspace-meta-row">
                      <span className="workspace-meta-label">{locale === "zh" ? "优先级" : "Priority"}</span>
                      <span className="workspace-meta-value">{reportPriority}</span>
                    </div>
                  ) : null}
                  {reportHandling ? (
                    <div className="workspace-meta-row">
                      <span className="workspace-meta-label">{locale === "zh" ? "处理建议" : "Handling strategy"}</span>
                      <span className="workspace-meta-value">{reportHandling}</span>
                    </div>
                  ) : null}
                  {reportQuestion ? (
                    <div className="workspace-meta-row">
                      <span className="workspace-meta-label">{locale === "zh" ? "题目" : "Question"}</span>
                      <span className="workspace-meta-value">{reportQuestion}</span>
                    </div>
                  ) : null}
                </div>
              </Stack>
            </Paper>
          ) : null}

          <div className="workspace-scan-grid">
            {traceScanItems.map(item => (
              <div className="workspace-scan-card" key={item.key}>
                <span className="workspace-scan-label">{item.label}</span>
                <span className="workspace-scan-value">{item.value}</span>
                <span className="workspace-scan-copy">{item.copy}</span>
              </div>
            ))}
          </div>

          <Paper className="workspace-panel-hover workspace-panel-strong" id="trace-detail-review-focus" p="lg" radius="xl">
            <Stack gap="md">
              <Group justify="space-between" wrap="nowrap">
                <div>
                  <Text className="workspace-section-heading">
                    {locale === "zh" ? "首屏复盘顺序" : "First-screen review order"}
                  </Text>
                  <Text className="workspace-section-copy">
                    {locale === "zh"
                      ? "从质量报告跳进来时，先看问题线索，再看检索与引用，最后再展开回答正文和原始载荷。"
                      : "When entering from quality reports, review issue signal first, then retrieval/citations, and only then expand the answer body or raw payload."}
                  </Text>
                </div>
                {failureTaxonomy.length > 0 ? (
                  <Group gap="xs" justify="flex-end">
                    {failureTaxonomy.map(category => (
                      <Badge color={getFailureTaxonomyColor(category)} key={category} variant="light">
                        {getFailureTaxonomyLabel(category, locale)}
                      </Badge>
                    ))}
                  </Group>
                ) : null}
              </Group>

              <div className="workspace-diagnostic-grid">
                {reviewFocusItems.map(item => (
                  <div className="workspace-diagnostic-item workspace-diagnostic-item-issue" key={item.key}>
                    <div className="workspace-diagnostic-label">{item.label}</div>
                    <div className="workspace-diagnostic-value">{item.value}</div>
                    <Anchor href={item.href} mt={10} size="sm">
                      {item.actionLabel}
                    </Anchor>
                  </div>
                ))}
              </div>
            </Stack>
          </Paper>

          <Paper className="workspace-panel-hover workspace-panel-muted" p="lg" radius="xl">
            <Stack gap="sm">
                  <Text className="workspace-section-heading">
                    {locale === "zh" ? "建议排查路径" : "Suggested diagnostic path"}
                  </Text>
                  <Text className="workspace-section-copy">
                    {locale === "zh"
                      ? "按同一顺序查看：先进入文档详情，再看运行失败摘要，最后继续查看诊断详情。"
                      : "Follow one order: open Document Detail first, review the run failure summary second, then continue through diagnostics."}
                  </Text>
              <div className="workspace-meta-list">
                <div className="workspace-meta-row">
                  <span className="workspace-meta-label">{locale === "zh" ? "步骤 1：文档详情" : "Step 1: Document Detail"}</span>
                  <span className="workspace-meta-value">
                    {scanFirstDocumentTarget ? (
                      <Anchor component={Link} to={`/documents/${scanFirstDocumentTarget}`}>
                        {scanFirstDocumentTitle ?? scanFirstDocumentTarget}
                      </Anchor>
                    ) : locale === "zh" ? (
                      "当前诊断记录没有可跳转的文档。"
                    ) : (
                      "No document deep link is available for this diagnostic record."
                    )}
                  </span>
                </div>
                <div className="workspace-meta-row">
                  <span className="workspace-meta-label">{locale === "zh" ? "步骤 2：运行失败摘要" : "Step 2: Run failure summary"}</span>
                  <span className="workspace-meta-value">{runFailureSummary}</span>
                </div>
                <div className="workspace-meta-row">
                  <span className="workspace-meta-label">{locale === "zh" ? "步骤 3：诊断查看顺序" : "Step 3: Diagnostics review order"}</span>
                  <span className="workspace-meta-value">
                    {locale === "zh"
                      ? "问题线索 -> 检索线索 -> 回答线索"
                      : "Issue signal -> Retrieval signal -> Answer signal"}
                  </span>
                </div>
              </div>
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
                <Paper className={`workspace-metric-card workspace-metric-card-compact ${trace.status === "success" ? "workspace-metric-card-success" : "workspace-metric-card-warning"}`} p="lg" radius="xl">
                  <div className="workspace-metric-header">
                    <Text className="workspace-metric-label">{locale === "zh" ? "本轮结果" : "Outcome"}</Text>
                    <Badge color={trace.status === "success" ? "teal" : "orange"} variant="light">
                      {t(`common.status.${trace.status}`)}
                    </Badge>
                  </div>
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
                <Paper className="workspace-metric-card workspace-metric-card-compact workspace-metric-card-info" p="lg" radius="xl">
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
                <Paper className="workspace-metric-card workspace-metric-card-compact workspace-metric-card-info" p="lg" radius="xl">
                  <Text className="workspace-metric-label">{locale === "zh" ? "引用数量" : "Citations"}</Text>
                  <Text className="workspace-metric-value">{citations.length}</Text>
                  <Text className="workspace-metric-subtle">
                    {locale === "zh"
                      ? "右下区域保留可跳转文档的引用卡片。"
                      : "Citations remain directly linked to their source documents."}
                  </Text>
                </Paper>
                <Paper className="workspace-metric-card workspace-metric-card-compact workspace-metric-card-info" p="lg" radius="xl">
                  <Text className="workspace-metric-label">{locale === "zh" ? "总耗时" : "Latency"}</Text>
                  <Text className="workspace-metric-value">{trace.latencyMs ?? "-"} ms</Text>
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

                <Paper
                  className="workspace-panel-hover workspace-panel-muted"
                  id={TRACE_DETAIL_SECTION_IDS.requestResponse}
                  p="md"
                  radius="lg"
                  style={{ scrollMarginTop: "96px" }}
                >
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
                      {getAnswerStatusReadabilityLabel(answerStatusValue, locale)}
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

          <div className="workspace-page-grid">
          <div className="workspace-page-side-stack">
            <div className="workspace-sticky-panel">
              <Stack gap="md">
                <Paper className="workspace-panel-hover workspace-panel-strong" p="lg" radius="xl">
                  <Stack gap="md">
                    <Text className="workspace-section-heading">
                      {locale === "zh" ? "诊断元数据" : "Diagnostic metadata"}
                    </Text>
                    <div className="workspace-metadata-grid">
                      <div className="workspace-metadata-item">
                        <div className="workspace-metadata-label">{t("common.fields.created")}</div>
                        <div className="workspace-metadata-value">{formatDateTime(trace.createdAt)}</div>
                      </div>
                      <div className="workspace-metadata-item">
                        <div className="workspace-metadata-label">{t("common.fields.conversation")}</div>
                        <div className="workspace-metadata-value workspace-metadata-value-code">{trace.conversationId}</div>
                      </div>
                      <div className="workspace-metadata-item">
                        <div className="workspace-metadata-label">{t("common.fields.assistant")}</div>
                        <div className="workspace-metadata-value workspace-metadata-value-code">{trace.assistantId}</div>
                      </div>
                      <div className="workspace-metadata-item">
                        <div className="workspace-metadata-label">{t("common.fields.latency")}</div>
                        <div className="workspace-metadata-value">{trace.latencyMs ?? "-"} ms</div>
                      </div>
                      <div className="workspace-metadata-item">
                        <div className="workspace-metadata-label">{t("common.fields.model")}</div>
                        <div className="workspace-metadata-value">{trace.modelName ?? "-"}</div>
                      </div>
                    </div>
                    {trace.errorMessage ? (
                      <Alert color="red" radius="xl" variant="light">
                        <Text size="sm" c="var(--app-text-danger)">
                          {locale === "zh" ? "错误信息" : "Error message"}
                        </Text>
                        <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
                          {trace.errorMessage}
                        </Text>
                      </Alert>
                    ) : null}
                  </Stack>
                </Paper>

                <Paper className="workspace-panel-hover workspace-panel-muted" p="lg" radius="xl">
                  <Stack gap="sm">
                    <Text className="workspace-section-heading">
                      {locale === "zh" ? "页内快速跳转" : "In-page quick jumps"}
                    </Text>
                    <Text className="workspace-section-copy">
                        {locale === "zh"
                          ? "优先跳到 chunk、引用或原始载荷区，不必反复滚动。"
                          : "Jump directly to chunks, citations, or raw payload without rescanning the whole diagnostics page."}
                    </Text>
                    <Stack gap={6}>
                      <Anchor href={`#${TRACE_DETAIL_SECTION_IDS.retrievedChunks}`} size="sm">
                        {locale === "zh" ? "查看命中 Chunk" : "Go to retrieved chunks"}
                      </Anchor>
                      <Anchor href={`#${TRACE_DETAIL_SECTION_IDS.requestResponse}`} size="sm">
                        {locale === "zh" ? "查看请求与响应" : "Go to request and response"}
                      </Anchor>
                      <Anchor href={`#${TRACE_DETAIL_SECTION_IDS.citations}`} size="sm">
                        {locale === "zh" ? "查看引用" : "Go to citations"}
                      </Anchor>
                      <Anchor href={`#${TRACE_DETAIL_SECTION_IDS.rawPayload}`} size="sm">
                        {locale === "zh" ? "查看原始载荷" : "Go to raw payload"}
                      </Anchor>
                    </Stack>
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
              <Paper
                className="workspace-panel-hover workspace-panel-strong"
                id={TRACE_DETAIL_SECTION_IDS.retrievedChunks}
                p="lg"
                radius="xl"
                style={{ scrollMarginTop: "96px" }}
              >
                <Stack gap="md">
                  <Group justify="space-between">
                    <div>
                      <Text className="workspace-section-heading">{t("trace.retrievedChunks")}</Text>
                      <Text className="workspace-section-copy">
                        {scores.length > 0 ? t("trace.sortedByScore") : t("trace.sortedByTraceOrder")}
                      </Text>
                      <Text c="var(--app-text-muted)" mt={6} size="sm">
                        {locale === "zh"
                          ? "从这里跳到文档时会保留当前 trace、rank、score 和 cited 上下文。"
                          : "Opening a document from here preserves the current trace, rank, score, and cited context."}
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

                              <div className="workspace-score-grid">
                                {item.vectorScore != null && (
                                  <div className="workspace-score-item">
                                    <span className="workspace-score-label">{t("trace.vectorScoreLabel", { score: "" })}</span>
                                    <span className="workspace-score-value">{formatScore(item.vectorScore)}</span>
                                  </div>
                                )}
                                {item.lexicalScore != null && (
                                  <div className="workspace-score-item">
                                    <span className="workspace-score-label">{t("trace.lexicalScoreLabel", { score: "" })}</span>
                                    <span className="workspace-score-value">{formatScore(item.lexicalScore)}</span>
                                  </div>
                                )}
                                {item.hybridScore != null && (
                                  <div className="workspace-score-item">
                                    <span className="workspace-score-label">{t("trace.hybridScoreLabel", { score: "" })}</span>
                                    <span className="workspace-score-value">{formatScore(item.hybridScore)}</span>
                                  </div>
                                )}
                                {item.rerankScore != null && (
                                  <div className="workspace-score-item">
                                    <span className="workspace-score-label">{t("trace.rerankScoreLabel", { score: "" })}</span>
                                    <span className="workspace-score-value">{formatScore(item.rerankScore)}</span>
                                  </div>
                                )}
                              </div>

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
                <Paper
                  className="workspace-panel-hover workspace-panel-muted"
                  id={TRACE_DETAIL_SECTION_IDS.citations}
                  p="lg"
                  radius="xl"
                  style={{ scrollMarginTop: "96px" }}
                >
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
                  <details id={TRACE_DETAIL_SECTION_IDS.rawPayload} style={{ scrollMarginTop: "96px" }} open={false}>
                    <summary className="workspace-collapsible-summary">
                      <span>{t("common.fields.rawPayload")}</span>
                      <span className="workspace-inline-chip workspace-inline-chip-secondary">
                        {locale === "zh" ? "仅开发调试使用" : "For development only"}
                      </span>
                    </summary>
                    <Text c="var(--app-text-muted)" mt="sm" size="sm">
                      {locale === "zh"
                        ? "原始 trace 数据，仅在需要深度调试时查看。" 
                        : "Raw trace payload, only for deep debugging purposes."}
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
