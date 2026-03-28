import { Badge, Button, Paper, Select, Stack, Table, Text, TextInput } from "@mantine/core";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { StatePanel } from "../../components/StatePanel";
import { useAssistants, useConversations, useDocuments, useKnowledgeBases, useRunEvalQuestionSet } from "../../features/api/hooks";
import { useI18n } from "../../i18n/I18nProvider";

export function UsagePage() {
  const knowledgeBasesQuery = useKnowledgeBases();
  const assistantsQuery = useAssistants();
  const conversationsQuery = useConversations();
  const activeKnowledgeBase = knowledgeBasesQuery.data?.[0] ?? null;
  const documentsQuery = useDocuments(activeKnowledgeBase?.id ?? "default-kb");
  const runEvalMutation = useRunEvalQuestionSet();
  const { locale, t, formatDateTime } = useI18n();
  const [questionSetId, setQuestionSetId] = useState("");
  const [assistantId, setAssistantId] = useState("");
  const [baselineSnapshotId, setBaselineSnapshotId] = useState("");

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

  const assistantOptions = useMemo(
    () =>
      assistants.map(assistant => ({
        value: assistant.id,
        label: `${assistant.name} (${assistant.id})`
      })),
    [assistants]
  );

  useEffect(() => {
    if (!assistantId && assistantOptions.length > 0) {
      setAssistantId(assistantOptions[0].value);
    }
  }, [assistantId, assistantOptions]);

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

  const evalRunStatus = runEvalMutation.isPending
    ? "running"
    : runEvalMutation.isError
      ? "failed"
      : runEvalMutation.data
        ? "completed"
        : "idle";

  const evalRunStatusColor =
    evalRunStatus === "running"
      ? "yellow"
      : evalRunStatus === "failed"
        ? "red"
        : evalRunStatus === "completed"
          ? "indigo"
          : "gray";

  const evalRunStatusLabel =
    locale === "zh"
      ? evalRunStatus === "running"
        ? "运行中"
        : evalRunStatus === "failed"
          ? "运行失败"
          : evalRunStatus === "completed"
            ? "运行完成"
            : "未运行"
      : evalRunStatus === "running"
        ? "Running"
        : evalRunStatus === "failed"
          ? "Run failed"
          : evalRunStatus === "completed"
            ? "Run completed"
            : "Idle";

  async function onRunEvalSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!questionSetId.trim() || !assistantId.trim()) {
      return;
    }

    await runEvalMutation.mutateAsync({
      questionSetId: questionSetId.trim(),
      assistantId: assistantId.trim(),
      ...(baselineSnapshotId.trim() ? { baselineSnapshotId: baselineSnapshotId.trim() } : {})
    });
  }

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

          <Paper className="workspace-panel-hover workspace-panel-strong" p="lg" radius="xl">
            <Stack gap="md">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="workspace-section-heading">
                    {locale === "zh" ? "P5 v1 结果查看" : "P5 v1 results viewer"}
                  </div>
                  <p className="mt-2 text-sm text-[var(--app-text-muted)]">
                    {locale === "zh"
                      ? "固定展示 run 状态、题目级输出和核心结果字段，优先保证可读与稳定。"
                      : "A stable readout for run status, per-question output, and core result fields."}
                  </p>
                </div>
                <Badge color={evalRunStatusColor} radius="sm" variant="light">
                  {evalRunStatusLabel}
                </Badge>
              </div>

              <form className="grid gap-3 md:grid-cols-3" onSubmit={onRunEvalSubmit}>
                <TextInput
                  label={locale === "zh" ? "Question set ID" : "Question set id"}
                  onChange={event => setQuestionSetId(event.currentTarget.value)}
                  placeholder={locale === "zh" ? "例如：set-1" : "e.g. set-1"}
                  required
                  value={questionSetId}
                />
                <Select
                  data={assistantOptions}
                  label={locale === "zh" ? "Assistant" : "Assistant"}
                  onChange={value => setAssistantId(value ?? "")}
                  placeholder={locale === "zh" ? "选择 assistant" : "Select assistant"}
                  searchable
                  value={assistantId || null}
                />
                <TextInput
                  label={locale === "zh" ? "Baseline snapshot（可选）" : "Baseline snapshot (optional)"}
                  onChange={event => setBaselineSnapshotId(event.currentTarget.value)}
                  placeholder={locale === "zh" ? "例如：snapshot-1" : "e.g. snapshot-1"}
                  value={baselineSnapshotId}
                />

                <div className="md:col-span-3">
                  <Button
                    className="workspace-button"
                    color="indigo"
                    loading={runEvalMutation.isPending}
                    radius="xl"
                    type="submit"
                    variant="light"
                  >
                    {locale === "zh" ? "执行评测 Run" : "Run eval"}
                  </Button>
                </div>
              </form>

              {runEvalMutation.isError ? (
                <StatePanel
                  description={
                    runEvalMutation.error instanceof Error
                      ? runEvalMutation.error.message
                      : locale === "zh"
                        ? "评测 run 执行失败。"
                        : "Eval run failed."
                  }
                  title={locale === "zh" ? "运行失败" : "Run failed"}
                  tone="error"
                />
              ) : null}

              {runEvalMutation.data ? (
                <Stack gap="md">
                  <div className="grid gap-3 md:grid-cols-3">
                    <Paper className="workspace-subpanel" p="md" radius="xl">
                      <Text className="workspace-section-heading">{locale === "zh" ? "题目总数" : "Total"}</Text>
                      <Text c="var(--app-text)" fw={700} mt={6} size="xl">
                        {runEvalMutation.data.totals.total}
                      </Text>
                    </Paper>
                    <Paper className="workspace-subpanel" p="md" radius="xl">
                      <Text className="workspace-section-heading">{locale === "zh" ? "成功" : "Succeeded"}</Text>
                      <Text c="var(--app-text)" fw={700} mt={6} size="xl">
                        {runEvalMutation.data.totals.succeeded}
                      </Text>
                    </Paper>
                    <Paper className="workspace-subpanel" p="md" radius="xl">
                      <Text className="workspace-section-heading">{locale === "zh" ? "失败" : "Failed"}</Text>
                      <Text c="var(--app-text)" fw={700} mt={6} size="xl">
                        {runEvalMutation.data.totals.failed}
                      </Text>
                    </Paper>
                  </div>

                  <div className="workspace-meta-list">
                    <div className="workspace-meta-row">
                      <span className="workspace-meta-label">questionSetId</span>
                      <span className="workspace-meta-value">{runEvalMutation.data.questionSetId}</span>
                    </div>
                    <div className="workspace-meta-row">
                      <span className="workspace-meta-label">baselineSnapshotId</span>
                      <span className="workspace-meta-value">{runEvalMutation.data.baselineSnapshotId}</span>
                    </div>
                    <div className="workspace-meta-row">
                      <span className="workspace-meta-label">baselineVersion</span>
                      <span className="workspace-meta-value">{runEvalMutation.data.baselineVersion}</span>
                    </div>
                    <div className="workspace-meta-row">
                      <span className="workspace-meta-label">assistantId</span>
                      <span className="workspace-meta-value">{runEvalMutation.data.assistantId}</span>
                    </div>
                    <div className="workspace-meta-row">
                      <span className="workspace-meta-label">startedAt</span>
                      <span className="workspace-meta-value">{formatDateTime(runEvalMutation.data.startedAt)}</span>
                    </div>
                    <div className="workspace-meta-row">
                      <span className="workspace-meta-label">finishedAt</span>
                      <span className="workspace-meta-value">{formatDateTime(runEvalMutation.data.finishedAt)}</span>
                    </div>
                  </div>

                  <div className="workspace-table-shell">
                    <Table.ScrollContainer minWidth={1040}>
                      <Table
                        className="workspace-table"
                        highlightOnHover
                        styles={{
                          table: {
                            color: "var(--app-text)"
                          },
                          thead: {
                            background: "rgba(255,255,255,0.03)"
                          },
                          tr: {
                            borderColor: "var(--app-border)"
                          },
                          th: {
                            color: "var(--app-text-secondary)",
                            fontWeight: 700,
                            textTransform: "uppercase",
                            fontSize: 12,
                            letterSpacing: "0.04em"
                          },
                          td: {
                            color: "var(--app-text)"
                          }
                        }}
                      >
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th>#</Table.Th>
                            <Table.Th>{locale === "zh" ? "状态" : "Status"}</Table.Th>
                            <Table.Th>{locale === "zh" ? "问题" : "Question"}</Table.Th>
                            <Table.Th>{locale === "zh" ? "答案状态" : "Answer status"}</Table.Th>
                            <Table.Th>{locale === "zh" ? "质量" : "Quality"}</Table.Th>
                            <Table.Th>{locale === "zh" ? "主问题" : "Primary issue"}</Table.Th>
                            <Table.Th>{locale === "zh" ? "引用数" : "Citations"}</Table.Th>
                            <Table.Th>{locale === "zh" ? "Fallback" : "Fallback"}</Table.Th>
                            <Table.Th>{locale === "zh" ? "Trace / 错误" : "Trace / error"}</Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {runEvalMutation.data.items.map(item => (
                            <Table.Tr key={`${item.index}-${item.question}`}>
                              <Table.Td>{item.index}</Table.Td>
                              <Table.Td>
                                <Badge color={item.status === "succeeded" ? "indigo" : "red"} radius="sm" variant="light">
                                  {item.status}
                                </Badge>
                              </Table.Td>
                              <Table.Td>
                                <Text size="sm">{item.question}</Text>
                              </Table.Td>
                              <Table.Td>{item.answerStatus ?? "-"}</Table.Td>
                              <Table.Td>{item.qualityOverall ?? "-"}</Table.Td>
                              <Table.Td>{item.qualityPrimaryIssue ?? "-"}</Table.Td>
                              <Table.Td>{item.citationCount}</Table.Td>
                              <Table.Td>
                                {item.usedFallback == null ? "-" : item.usedFallback ? (locale === "zh" ? "是" : "yes") : (locale === "zh" ? "否" : "no")}
                              </Table.Td>
                              <Table.Td>
                                <Stack gap={4}>
                                  {item.traceId ? (
                                    <Button
                                      className="workspace-button"
                                      color="indigo"
                                      component={Link}
                                      radius="xl"
                                      size="xs"
                                      to={`/traces/${item.traceId}`}
                                      variant="light"
                                    >
                                      {item.traceId}
                                    </Button>
                                  ) : (
                                    <Text c="var(--app-text-muted)" size="xs">-</Text>
                                  )}
                                  {item.error?.message ? (
                                    <Text c="var(--app-text-secondary)" size="xs">
                                      {item.error.code ? `[${item.error.code}] ` : ""}
                                      {item.error.message}
                                    </Text>
                                  ) : null}
                                </Stack>
                              </Table.Td>
                            </Table.Tr>
                          ))}
                        </Table.Tbody>
                      </Table>
                    </Table.ScrollContainer>
                  </div>
                </Stack>
              ) : null}
            </Stack>
          </Paper>
        </>
      ) : null}
    </div>
  );
}
