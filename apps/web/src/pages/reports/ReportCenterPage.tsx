import { Badge, Button, Paper, Select, Stack, Table, Text, TextInput } from "@mantine/core";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { StatePanel } from "../../components/StatePanel";
import { useAssistants, useRunEvalQuestionSet } from "../../features/api/hooks";
import { useI18n } from "../../i18n/I18nProvider";

export function ReportCenterPage() {
  const assistantsQuery = useAssistants();
  const runEvalMutation = useRunEvalQuestionSet();
  const { locale, formatDateTime } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const [questionSetId, setQuestionSetId] = useState(() => searchParams.get("questionSetId") ?? "");
  const [assistantId, setAssistantId] = useState(() => searchParams.get("assistantId") ?? "");
  const [baselineSnapshotId, setBaselineSnapshotId] = useState(() => searchParams.get("baselineSnapshotId") ?? "");

  const assistantOptions = useMemo(
    () =>
      (assistantsQuery.data ?? []).map(assistant => ({
        value: assistant.id,
        label: `${assistant.name} (${assistant.id})`
      })),
    [assistantsQuery.data]
  );

  useEffect(() => {
    if (!assistantId && assistantOptions.length > 0) {
      setAssistantId(assistantOptions[0].value);
    }
  }, [assistantId, assistantOptions]);

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

  const qualitySummaryRows = useMemo(() => {
    if (!runEvalMutation.data) {
      return [];
    }

    const counts = new Map<string, number>();
    for (const item of runEvalMutation.data.items) {
      const quality = item.qualityOverall ?? (locale === "zh" ? "未标注" : "unlabeled");
      counts.set(quality, (counts.get(quality) ?? 0) + 1);
    }

    return Array.from(counts.entries())
      .map(([quality, count]) => ({ quality, count }))
      .sort((a, b) => b.count - a.count);
  }, [locale, runEvalMutation.data]);

  const regressionDrilldownItems = runEvalMutation.data?.baselineComparison?.failureDrilldown?.weakestItems ?? [];
  const runDiffSummary = runEvalMutation.data?.baselineComparison?.diffSummary;
  const showPreRunGuidance = !runEvalMutation.data && !runEvalMutation.isError && !runEvalMutation.isPending;

  function getRegressionReasonLabel(reasonCode: string) {
    if (locale === "zh") {
      if (reasonCode === "became_failed") return "由成功变为失败";
      if (reasonCode === "became_insufficient_context") return "由 grounded 变为 insufficient_context";
      if (reasonCode === "quality_degraded") return "质量等级下降";
      if (reasonCode === "fallback_introduced") return "新增 fallback 依赖";
      if (reasonCode === "citations_decreased") return "引用数量下降";
      return reasonCode;
    }

    if (reasonCode === "became_failed") return "Succeeded -> failed";
    if (reasonCode === "became_insufficient_context") return "Grounded -> insufficient_context";
    if (reasonCode === "quality_degraded") return "Quality degraded";
    if (reasonCode === "fallback_introduced") return "Fallback introduced";
    if (reasonCode === "citations_decreased") return "Citation count decreased";
    return reasonCode;
  }

  async function onRunEvalSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedQuestionSetId = questionSetId.trim();
    const trimmedAssistantId = assistantId.trim();
    const trimmedBaselineSnapshotId = baselineSnapshotId.trim();

    if (!trimmedQuestionSetId || !trimmedAssistantId) {
      return;
    }

    const nextSearchParams = new URLSearchParams();
    nextSearchParams.set("questionSetId", trimmedQuestionSetId);
    nextSearchParams.set("assistantId", trimmedAssistantId);
    if (trimmedBaselineSnapshotId) {
      nextSearchParams.set("baselineSnapshotId", trimmedBaselineSnapshotId);
    }
    setSearchParams(nextSearchParams, { replace: true });

    await runEvalMutation.mutateAsync({
      questionSetId: trimmedQuestionSetId,
      assistantId: trimmedAssistantId,
      ...(trimmedBaselineSnapshotId ? { baselineSnapshotId: trimmedBaselineSnapshotId } : {})
    });
  }

  function downloadReport(format: "markdown" | "json" | "html") {
    const report = runEvalMutation.data?.reportExports?.[format];
    if (!report) {
      return;
    }

    const blob = new Blob([report.content], {
      type: report.mimeType
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = report.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-4">
      <Paper className="workspace-hero" p="lg" radius="xl">
        <div className="workspace-hero-split">
          <div className="workspace-hero-copy">
            <div className="workspace-hero-kicker">{locale === "zh" ? "P5 v1 质量报告" : "P5 v1 quality reports"}</div>
            <h1 className="mt-1 font-['Space_Grotesk'] text-3xl font-semibold tracking-[-0.03em] text-[var(--app-text)]">
              {locale === "zh" ? "报告中心" : "Report center"}
            </h1>
            <p className="mt-2 text-sm text-[var(--app-text-muted)]">
              {locale === "zh"
                ? "把评测输出和质量汇总集中在同一页面，维持 scan-first 的回归与 Trace 复盘路径。"
                : "Keep eval outputs and quality summaries in one scan-first page for regression checks and trace-guided replay."}
            </p>
          </div>
          <Badge color={evalRunStatusColor} radius="sm" variant="light">
            {evalRunStatusLabel}
          </Badge>
        </div>
      </Paper>

      <Paper className="workspace-panel-hover workspace-panel-strong" p="lg" radius="xl">
        <Stack gap="md">
          <div>
            <div className="workspace-section-heading">{locale === "zh" ? "评测执行" : "Eval run"}</div>
            <p className="mt-2 text-sm text-[var(--app-text-muted)]">
              {locale === "zh"
                ? "固定 P5 v1 输入参数并触发一次 question-set run，保持可扫读的对比上下文。"
                : "Run one question-set eval with fixed P5 v1 inputs to keep comparisons scan-first and consistent."}
            </p>
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
              <Button className="workspace-button" color="indigo" loading={runEvalMutation.isPending} radius="xl" type="submit" variant="light">
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

          {showPreRunGuidance ? (
            <StatePanel
              description={
                locale === "zh"
                  ? "先执行一次 question-set run，再从质量摘要、差异摘要和弱项列表开始 scan-first 复盘。"
                  : "Run one question-set eval first, then scan quality summary, diff summary, and weakest items for replay."}
              title={locale === "zh" ? "先跑一次 scan-first run" : "Start with one scan-first run"}
              tone="empty"
            />
          ) : null}
        </Stack>
      </Paper>

      {runEvalMutation.data ? (
        <Stack gap="md">
          <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
            <Paper className="workspace-subpanel" p="md" radius="xl">
              <Text className="workspace-section-heading">{locale === "zh" ? "总题数" : "Total"}</Text>
              <Text c="var(--app-text)" fw={700} mt={6} size="xl">
                {runEvalMutation.data.summary?.total ?? runEvalMutation.data.totals.total}
              </Text>
            </Paper>
            <Paper className="workspace-subpanel" p="md" radius="xl">
              <Text className="workspace-section-heading">{locale === "zh" ? "成功率" : "Success rate"}</Text>
              <Text c="var(--app-text)" fw={700} mt={6} size="xl">
                {runEvalMutation.data.summary ? `${(runEvalMutation.data.summary.successRate * 100).toFixed(1)}%` : "-"}
              </Text>
            </Paper>
            <Paper className="workspace-subpanel" p="md" radius="xl">
              <Text className="workspace-section-heading">{locale === "zh" ? "Grounded" : "Grounded"}</Text>
              <Text c="var(--app-text)" fw={700} mt={6} size="xl">
                {runEvalMutation.data.summary ? `${(runEvalMutation.data.summary.groundedRate * 100).toFixed(1)}%` : "-"}
              </Text>
            </Paper>
            <Paper className="workspace-subpanel" p="md" radius="xl">
              <Text className="workspace-section-heading">{locale === "zh" ? "Strong" : "Strong"}</Text>
              <Text c="var(--app-text)" fw={700} mt={6} size="xl">
                {runEvalMutation.data.summary ? `${(runEvalMutation.data.summary.strongRate * 100).toFixed(1)}%` : "-"}
              </Text>
            </Paper>
            <Paper className="workspace-subpanel" p="md" radius="xl">
              <Text className="workspace-section-heading">{locale === "zh" ? "Fallback" : "Fallback"}</Text>
              <Text c="var(--app-text)" fw={700} mt={6} size="xl">
                {runEvalMutation.data.summary ? `${(runEvalMutation.data.summary.fallbackRate * 100).toFixed(1)}%` : "-"}
              </Text>
            </Paper>
            <Paper className="workspace-subpanel" p="md" radius="xl">
              <Text className="workspace-section-heading">{locale === "zh" ? "平均引用" : "Avg citations"}</Text>
              <Text c="var(--app-text)" fw={700} mt={6} size="xl">
                {runEvalMutation.data.summary ? runEvalMutation.data.summary.averageCitationCount.toFixed(2) : "-"}
              </Text>
            </Paper>
          </div>

          <Paper className="workspace-panel-hover workspace-panel-muted" p="lg" radius="xl">
            <Stack gap="sm">
              <div className="workspace-section-heading">{locale === "zh" ? "质量分布" : "Quality distribution"}</div>
              {qualitySummaryRows.length > 0 ? (
                <div className="grid gap-2 md:grid-cols-3">
                  {qualitySummaryRows.map(row => (
                    <div className="workspace-meta-row" key={row.quality}>
                      <span className="workspace-meta-label">{row.quality}</span>
                      <span className="workspace-meta-value">{row.count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <Text c="var(--app-text-muted)" size="sm">
                  {locale === "zh" ? "暂无可汇总的质量结果。" : "No quality results available yet."}
                </Text>
              )}
            </Stack>
          </Paper>

          <Paper className="workspace-panel-hover workspace-panel-muted" p="lg" radius="xl">
            <Stack gap="sm">
              <div className="workspace-section-heading">{locale === "zh" ? "Run 差异摘要" : "Run diff summary"}</div>
              {runDiffSummary ? (
                <>
                  <Text c="var(--app-text-muted)" size="sm">
                    {runDiffSummary.headline}
                  </Text>
                  <div className="grid gap-2 md:grid-cols-2">
                    <div className="workspace-meta-row">
                      <span className="workspace-meta-label">regressedMetrics</span>
                      <span className="workspace-meta-value">{runDiffSummary.regressedMetricCount}</span>
                    </div>
                    <div className="workspace-meta-row">
                      <span className="workspace-meta-label">improvedMetrics</span>
                      <span className="workspace-meta-value">{runDiffSummary.improvedMetricCount}</span>
                    </div>
                  </div>
                  {runDiffSummary.topRegressionReasons.length > 0 ? (
                    <div className="grid gap-2">
                      {runDiffSummary.topRegressionReasons.map(reason => (
                        <div className="workspace-meta-row" key={reason.reasonCode}>
                          <span className="workspace-meta-label">{getRegressionReasonLabel(reason.reasonCode)}</span>
                          <span className="workspace-meta-value">{reason.count}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </>
              ) : (
                <Text c="var(--app-text-muted)" size="sm">
                  {locale === "zh"
                    ? "当前 run 缺少可用差异摘要（通常需 baseline 对照已就绪）。"
                    : "Run diff summary is unavailable for this comparison (baseline delta not ready)."}
                </Text>
              )}
            </Stack>
          </Paper>

          <Paper className="workspace-panel-hover workspace-panel-muted" p="lg" radius="xl">
            <Stack gap="sm">
              <div className="workspace-section-heading">{locale === "zh" ? "回归弱项聚焦" : "Regression weakest items"}</div>
              <Text c="var(--app-text-muted)" size="sm">
                {locale === "zh"
                  ? "按严重程度列出最需要优先复盘的问题。"
                  : "Prioritized per-question regressions so review can focus on weakest items first."}
              </Text>
              {runEvalMutation.data.baselineComparison?.failureDrilldown ? (
                <>
                  <div className="workspace-meta-row">
                    <span className="workspace-meta-label">regressedQuestionCount</span>
                    <span className="workspace-meta-value">{runEvalMutation.data.baselineComparison.failureDrilldown.regressedQuestionCount}</span>
                  </div>
                  {regressionDrilldownItems.length > 0 ? (
                    <div className="grid gap-2">
                      {regressionDrilldownItems.map(item => (
                        <div className="workspace-meta-row" key={`${item.index}-${item.question}`}>
                          <span className="workspace-meta-label">
                            #{item.index} · {item.severity}
                          </span>
                          <span className="workspace-meta-value text-right">
                            {item.reasonCodes.map(getRegressionReasonLabel).join("; ")}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Text c="var(--app-text-muted)" size="sm">
                      {locale === "zh" ? "当前 run 未检测到题目级回归。" : "No per-question regressions detected in this run."}
                    </Text>
                  )}
                </>
              ) : (
                <Text c="var(--app-text-muted)" size="sm">
                  {locale === "zh"
                    ? "当前 baseline 缺少题目级对照数据（通常需在最新格式 baseline 初始化后可用）。"
                    : "Per-question drilldown is unavailable for this baseline (initialize baseline with latest run format)."}
                </Text>
              )}
            </Stack>
          </Paper>

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

          <Paper className="workspace-panel-hover workspace-panel-muted" p="lg" radius="xl">
            <Stack gap="sm">
              <div className="workspace-section-heading">{locale === "zh" ? "报告导出" : "Report export"}</div>
              <Text c="var(--app-text-muted)" size="sm">
                {locale === "zh"
                  ? "将本次评测结果导出为可复用文件，便于存档和分享。"
                  : "Export this eval run into reusable files for storage and sharing."}
              </Text>
              <div className="flex flex-wrap gap-2">
                <Button
                  className="workspace-button"
                  color="indigo"
                  onClick={() => downloadReport("markdown")}
                  radius="xl"
                  size="xs"
                  variant="light"
                >
                  Markdown
                </Button>
                <Button
                  className="workspace-button"
                  color="indigo"
                  onClick={() => downloadReport("json")}
                  radius="xl"
                  size="xs"
                  variant="light"
                >
                  JSON
                </Button>
                <Button
                  className="workspace-button"
                  color="indigo"
                  onClick={() => downloadReport("html")}
                  radius="xl"
                  size="xs"
                  variant="light"
                >
                  HTML
                </Button>
              </div>
            </Stack>
          </Paper>

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
                    <Table.Th>{locale === "zh" ? "Trace / 问题" : "Trace / issue"}</Table.Th>
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
    </div>
  );
}
