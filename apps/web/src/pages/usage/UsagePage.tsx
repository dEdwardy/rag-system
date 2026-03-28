import { Badge, Button, Paper } from "@mantine/core";
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { StatePanel } from "../../components/StatePanel";
import { useAssistants, useConversations, useDocuments, useKnowledgeBases } from "../../features/api/hooks";
import { useI18n } from "../../i18n/I18nProvider";

export function UsagePage() {
  const knowledgeBasesQuery = useKnowledgeBases();
  const assistantsQuery = useAssistants();
  const conversationsQuery = useConversations();
  const activeKnowledgeBase = knowledgeBasesQuery.data?.[0] ?? null;
  const documentsQuery = useDocuments(activeKnowledgeBase?.id ?? "default-kb");
  const { locale, t } = useI18n();

  const documents = documentsQuery.data ?? [];
  const assistants = assistantsQuery.data ?? [];
  const conversations = conversationsQuery.data ?? [];
  const { readyDocuments, processingDocuments, failedDocuments, totalChunks } = useMemo(
    () =>
      documents.reduce(
        (acc, document) => {
          acc.totalChunks += document.chunkCount;
          if (document.status === "ready") {
            acc.readyDocuments += 1;
          } else if (document.status === "pending" || document.status === "processing") {
            acc.processingDocuments += 1;
          } else if (document.status === "failed") {
            acc.failedDocuments += 1;
          }

          return acc;
        },
        {
          readyDocuments: 0,
          processingDocuments: 0,
          failedDocuments: 0,
          totalChunks: 0
        }
      ),
    [documents]
  );

  const metrics = useMemo(
    () => [
      { label: locale === "zh" ? "知识库" : "Knowledge bases", value: knowledgeBasesQuery.data?.length ?? 0 },
      { label: locale === "zh" ? "文档" : "Documents", value: documents.length },
      { label: locale === "zh" ? "Chunk" : "Chunks", value: totalChunks },
      { label: locale === "zh" ? "助手" : "Assistants", value: assistants.length },
      { label: locale === "zh" ? "会话" : "Conversations", value: conversations.length },
      { label: locale === "zh" ? "就绪文档" : "Ready docs", value: readyDocuments }
    ],
    [assistants.length, conversations.length, documents.length, knowledgeBasesQuery.data?.length, locale, readyDocuments, totalChunks]
  );

  const hasError = useMemo(
    () =>
      knowledgeBasesQuery.isError ||
      assistantsQuery.isError ||
      conversationsQuery.isError ||
      documentsQuery.isError,
    [assistantsQuery.isError, conversationsQuery.isError, documentsQuery.isError, knowledgeBasesQuery.isError]
  );
  const isUsageLoading = useMemo(
    () =>
      !hasError &&
      (knowledgeBasesQuery.isLoading ||
        assistantsQuery.isLoading ||
        conversationsQuery.isLoading ||
        documentsQuery.isLoading),
    [assistantsQuery.isLoading, conversationsQuery.isLoading, documentsQuery.isLoading, hasError, knowledgeBasesQuery.isLoading]
  );

  return (
    <div className="flex flex-col gap-4">
      <Paper className="workspace-hero" p="lg" radius="xl">
        <div className="workspace-hero-split">
          <div className="workspace-hero-copy">
            <div className="workspace-hero-kicker">{locale === "zh" ? "桌面端使用统计" : "Desktop usage"}</div>
            <h1 className="mt-1 font-['Space_Grotesk'] text-3xl font-semibold tracking-[-0.03em] text-[var(--app-text)]">
              {locale === "zh" ? "使用统计" : "Usage"}
            </h1>
            <p className="mt-2 text-sm text-[var(--app-text-muted)]">
              {locale === "zh"
                ? "只展示当前前端已经拿到的真实工作区数据，不伪造任何统计项。"
                : "Show only real workspace data already available to the frontend, with no fabricated metrics."}
            </p>
          </div>

          <div className="flex flex-col items-end gap-2">
            <Badge color={processingDocuments > 0 ? "yellow" : "indigo"} radius="sm" variant="light">
              {processingDocuments > 0
                ? locale === "zh"
                  ? `处理中 ${processingDocuments}`
                  : `${processingDocuments} processing`
                : locale === "zh"
                  ? "桌面视图"
                  : "Desktop view"}
            </Badge>
            <p className="max-w-sm text-right text-[13px] leading-6 text-[var(--app-text-muted)]">
              {locale === "zh"
                ? "这里聚合知识库、文档、助手和会话的当前真实数据，作为独立于“知识库”的唯一路由页面。"
                : "This page aggregates current real knowledge-base, document, assistant, and conversation data on a dedicated route separate from the knowledge base."}
            </p>
          </div>
        </div>
      </Paper>

      {hasError ? (
        <StatePanel
          description={
            (knowledgeBasesQuery.error instanceof Error && knowledgeBasesQuery.error.message) ||
            (assistantsQuery.error instanceof Error && assistantsQuery.error.message) ||
            (conversationsQuery.error instanceof Error && conversationsQuery.error.message) ||
            (documentsQuery.error instanceof Error && documentsQuery.error.message) ||
            undefined
          }
          title={locale === "zh" ? "统计数据加载失败" : "Failed to load usage data"}
          tone="error"
        />
      ) : null}

      {isUsageLoading ? (
        <div aria-live="polite" className="workspace-loading-grid metrics" role="status">
          {Array.from({ length: 6 }).map((_, index) => (
            <Paper className="workspace-metric-card workspace-skeleton-panel" key={index} p="lg" radius="xl">
              <div className="workspace-skeleton-line short" />
              <div className="mt-6 workspace-skeleton-line metric" />
            </Paper>
          ))}
          <span className="sr-only">{locale === "zh" ? "加载统计中" : "Loading usage"}</span>
        </div>
      ) : null}

      {!hasError && !isUsageLoading ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {metrics.map(metric => (
              <Paper className="workspace-metric-card" key={metric.label} p="lg" radius="xl">
                <div className="workspace-section-heading">{metric.label}</div>
                <div className="mt-3 font-['Space_Grotesk'] text-3xl font-semibold text-[var(--app-text)]">
                  {metric.value}
                </div>
              </Paper>
            ))}
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
            <Paper className="workspace-panel-hover workspace-panel-strong" p="lg" radius="xl">
              <div className="flex flex-col gap-4">
                <div>
                  <div className="workspace-section-heading">{locale === "zh" ? "当前语料状态" : "Current corpus state"}</div>
                  <p className="mt-2 text-sm text-[var(--app-text-muted)]">
                    {locale === "zh"
                      ? "使用当前知识库下的真实文档状态，帮助判断桌面端工作区是否处于可检索状态。"
                      : "Use the real document states under the current knowledge base to understand desktop workspace readiness."}
                  </p>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <div className="workspace-subpanel rounded-[20px] p-4">
                    <div className="workspace-section-heading">{locale === "zh" ? "就绪" : "Ready"}</div>
                    <div className="mt-2 text-2xl font-semibold text-[var(--app-text)]">{readyDocuments}</div>
                  </div>
                  <div className="workspace-subpanel rounded-[20px] p-4">
                    <div className="workspace-section-heading">{locale === "zh" ? "处理中" : "Processing"}</div>
                    <div className="mt-2 text-2xl font-semibold text-[var(--app-text)]">{processingDocuments}</div>
                  </div>
                  <div className="workspace-subpanel rounded-[20px] p-4">
                    <div className="workspace-section-heading">{locale === "zh" ? "失败" : "Failed"}</div>
                    <div className="mt-2 text-2xl font-semibold text-[var(--app-text)]">{failedDocuments}</div>
                  </div>
                </div>
              </div>
            </Paper>

            <Paper className="workspace-panel-hover workspace-panel-muted" p="lg" radius="xl">
              <div className="flex flex-col gap-4">
                <div className="workspace-section-heading">{locale === "zh" ? "桌面端入口" : "Desktop entry points"}</div>
                <Button className="workspace-button" color="indigo" component={Link} radius="xl" to="/knowledge-base" variant="light">
                  {locale === "zh" ? "打开知识库" : "Open knowledge base"}
                </Button>
                <Button className="workspace-button" color="indigo" component={Link} radius="xl" to="/documents" variant="light">
                  {locale === "zh" ? "打开文档" : "Open documents"}
                </Button>
                <Button className="workspace-button" color="indigo" component={Link} radius="xl" to="/assistant" variant="light">
                  {locale === "zh" ? "打开助手配置" : "Open assistant"}
                </Button>
              </div>
            </Paper>
          </div>
        </>
      ) : null}
    </div>
  );
}
