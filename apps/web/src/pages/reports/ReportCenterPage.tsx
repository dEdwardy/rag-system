import { Badge, Button, Paper, Select, Stack, Table, Text, TextInput } from "@mantine/core";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { StatePanel } from "../../components/StatePanel";
import { useAssistants, useRunEvalQuestionSet } from "../../features/api/hooks";
import { useI18n } from "../../i18n/I18nProvider";
import { PieChart, Pie, BarChart, Bar, Cell, ResponsiveContainer, Tooltip, Legend, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from "recharts";

type EvalRunParams = {
  questionSetId: string;
  assistantId: string;
  baselineSnapshotId?: string;
};

function normalizeEvalRunParams(params: {
  questionSetId: string;
  assistantId: string;
  baselineSnapshotId: string;
}): EvalRunParams | null {
  const questionSetId = params.questionSetId.trim();
  const assistantId = params.assistantId.trim();
  const baselineSnapshotId = params.baselineSnapshotId.trim();

  if (!questionSetId || !assistantId) {
    return null;
  }

  return {
    questionSetId,
    assistantId,
    ...(baselineSnapshotId ? { baselineSnapshotId } : {})
  };
}

function createEvalRunSearchParams(params: EvalRunParams): URLSearchParams {
  const nextSearchParams = new URLSearchParams();
  nextSearchParams.set("questionSetId", params.questionSetId);
  nextSearchParams.set("assistantId", params.assistantId);
  if (params.baselineSnapshotId) {
    nextSearchParams.set("baselineSnapshotId", params.baselineSnapshotId);
  }
  return nextSearchParams;
}

export function ReportCenterPage() {
  const assistantsQuery = useAssistants();
  const runEvalMutation = useRunEvalQuestionSet();
  const { locale, formatDateTime } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const [questionSetId, setQuestionSetId] = useState(() => searchParams.get("questionSetId") ?? "");
  const [assistantId, setAssistantId] = useState(() => searchParams.get("assistantId") ?? "");
  const [baselineSnapshotId, setBaselineSnapshotId] = useState(() => searchParams.get("baselineSnapshotId") ?? "");
  
  // 表格排序和筛选状态
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'ascending' | 'descending' } | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterQuality, setFilterQuality] = useState<string>("");

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
  const hasRunItems = (runEvalMutation.data?.items.length ?? 0) > 0;
  const baselineSnapshotPlaceholder =
    locale === "zh" ? "scan-first：本次 run 未绑定 baseline snapshot" : "scan-first: this run is not linked to a baseline snapshot";
  const baselineVersionPlaceholder =
    locale === "zh" ? "scan-first：baseline version 暂不可读（先绑定 baseline snapshot）" : "scan-first: baseline version is unavailable until a baseline snapshot is linked";

  // 图表颜色配置
  const COLORS = ["#8884d8", "#82ca9d", "#ffc658", "#ff8042", "#0088fe", "#00C49F"];

  // 质量分布图表数据
  const qualityDistributionData = useMemo(() => {
    if (!runEvalMutation.data) {
      return [];
    }
    return qualitySummaryRows.map((row, index) => ({
      name: row.quality,
      value: row.count,
      color: COLORS[index % COLORS.length]
    }));
  }, [qualitySummaryRows]);

  // 雷达图数据
  const radarData = useMemo(() => {
    if (!runEvalMutation.data?.summary) {
      return [];
    }
    const summary = runEvalMutation.data.summary;
    return [
      {
        subject: locale === "zh" ? "成功率" : "Success Rate",
        A: summary.successRate * 100,
        fullMark: 100
      },
      {
        subject: locale === "zh" ? "Grounded" : "Grounded",
        A: summary.groundedRate * 100,
        fullMark: 100
      },
      {
        subject: locale === "zh" ? "Strong" : "Strong",
        A: summary.strongRate * 100,
        fullMark: 100
      },
      {
        subject: locale === "zh" ? "Fallback" : "Fallback",
        A: summary.fallbackRate * 100,
        fullMark: 100
      },
      {
        subject: locale === "zh" ? "平均引用" : "Avg Citations",
        A: summary.averageCitationCount * 20, // 归一化到 0-100
        fullMark: 100
      }
    ];
  }, [locale, runEvalMutation.data?.summary]);

  // 答案状态分布
  const answerStatusDistribution = useMemo(() => {
    if (!runEvalMutation.data?.items) {
      return [];
    }
    const counts = new Map<string, number>();
    for (const item of runEvalMutation.data.items) {
      const status = item.answerStatus ?? (locale === "zh" ? "未标注" : "unlabeled");
      counts.set(status, (counts.get(status) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count);
  }, [locale, runEvalMutation.data?.items]);

  // 错误类型分布
  const errorTypeDistribution = useMemo(() => {
    if (!runEvalMutation.data?.items) {
      return [];
    }
    const counts = new Map<string, number>();
    for (const item of runEvalMutation.data.items) {
      if (item.error?.code) {
        counts.set(item.error.code, (counts.get(item.error.code) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => b.count - a.count);
  }, [runEvalMutation.data?.items]);

  // 质量门控信息
  const qualityGate = runEvalMutation.data?.qualityGate;

  function getRunContextLabel(field: "questionSetId" | "baselineSnapshotId" | "baselineVersion" | "assistantId") {
    if (locale === "zh") {
      if (field === "questionSetId") return "Question set";
      if (field === "baselineSnapshotId") return "Baseline snapshot";
      if (field === "baselineVersion") return "Baseline version";
      return "Assistant";
    }

    if (field === "questionSetId") return "Question set";
    if (field === "baselineSnapshotId") return "Baseline snapshot";
    if (field === "baselineVersion") return "Baseline version";
    return "Assistant";
  }

  function formatBaselineMetadataValue(
    value: string | number | null | undefined,
    placeholder: string
  ) {
    if (value == null) {
      return placeholder;
    }
    const text = String(value).trim();
    return text.length > 0 ? text : placeholder;
  }

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
    const evalRunParams = normalizeEvalRunParams({
      questionSetId,
      assistantId,
      baselineSnapshotId
    });
    if (!evalRunParams) {
      return;
    }

    setSearchParams(createEvalRunSearchParams(evalRunParams), { replace: true });
    await runEvalMutation.mutateAsync(evalRunParams);
  }

  const [exporting, setExporting] = useState<string | null>(null);

  async function downloadReport(format: "markdown" | "json" | "html") {
    const report = runEvalMutation.data?.reportExports?.[format];
    if (!report) {
      return;
    }

    try {
      setExporting(format);
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
    } catch (error) {
      console.error("Error downloading report:", error);
    } finally {
      setExporting(null);
    }
  }

  // 表格排序处理函数
  function requestSort(key: string) {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  }

  // 排序后的表格数据
  const sortedAndFilteredItems = useMemo(() => {
    if (!runEvalMutation.data?.items) {
      return [];
    }

    let filteredItems = runEvalMutation.data.items.filter(item => {
      const matchesStatus = !filterStatus || item.status === filterStatus;
      const matchesQuality = !filterQuality || item.qualityOverall === filterQuality;
      return matchesStatus && matchesQuality;
    });

    if (sortConfig) {
      filteredItems.sort((a, b) => {
        const aValue = a[sortConfig.key as keyof typeof a];
        const bValue = b[sortConfig.key as keyof typeof b];
        
        // 处理空值情况
        if (aValue === null || aValue === undefined) return 1;
        if (bValue === null || bValue === undefined) return -1;
        
        if (aValue < bValue) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }

    return filteredItems;
  }, [runEvalMutation.data?.items, sortConfig, filterStatus, filterQuality]);

  // 获取唯一的状态和质量值用于筛选
  const statusOptions = useMemo(() => {
    if (!runEvalMutation.data?.items) {
      return [];
    }
    return Array.from(new Set(runEvalMutation.data.items.map(item => item.status)));
  }, [runEvalMutation.data?.items]);

  const qualityOptions = useMemo(() => {
    if (!runEvalMutation.data?.items) {
      return [];
    }
    return Array.from(new Set(runEvalMutation.data.items.map(item => item.qualityOverall).filter((item): item is string => item !== undefined && item !== null)));
  }, [runEvalMutation.data?.items]);

  return (
    <div className="flex flex-col gap-6">
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
          <Badge color={evalRunStatusColor} radius="sm" variant="light" size="lg">
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

          <form className="grid gap-4 md:grid-cols-3" onSubmit={onRunEvalSubmit}>
            <TextInput
              label={locale === "zh" ? "Question set ID" : "Question set id"}
              onChange={event => setQuestionSetId(event.currentTarget.value)}
              placeholder={locale === "zh" ? "例如：set-1" : "e.g. set-1"}
              required
              value={questionSetId}
              size="md"
            />
            <Select
              data={assistantOptions}
              label={locale === "zh" ? "Assistant" : "Assistant"}
              onChange={value => setAssistantId(value ?? "")}
              placeholder={locale === "zh" ? "选择 assistant" : "Select assistant"}
              searchable
              value={assistantId || null}
              size="md"
            />
            <TextInput
              label={locale === "zh" ? "Baseline snapshot（可选）" : "Baseline snapshot (optional)"}
              onChange={event => setBaselineSnapshotId(event.currentTarget.value)}
              placeholder={locale === "zh" ? "例如：snapshot-1" : "e.g. snapshot-1"}
              value={baselineSnapshotId}
              size="md"
            />

            <div className="md:col-span-3">
              <Button className="workspace-button w-full" color="indigo" loading={runEvalMutation.isPending} radius="xl" type="submit" variant="light" size="md">
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
            <Stack gap={6}>
              <StatePanel
                description={
                  locale === "zh"
                    ? "先执行一次 question-set run，再从质量摘要、差异摘要和弱项列表开始 scan-first 复盘。"
                    : "Run one question-set eval first, then scan quality summary, diff summary, and weakest items for replay."}
                title={locale === "zh" ? "先跑一次 scan-first run" : "Start with one scan-first run"}
                tone="empty"
              />
              <Text c="var(--app-text-muted)" data-testid="report-center-pre-run-path" size="xs">
                {locale === "zh"
                  ? "scan path: Eval run（触发首轮）→ Report center（查看质量/差异/弱项）"
                  : "scan path: Eval run (trigger first run) -> Report center (review quality/diff/weakest items)"}
              </Text>
            </Stack>
          ) : null}
        </Stack>
      </Paper>

      {runEvalMutation.isPending ? (
        <Paper className="workspace-panel-hover workspace-panel-strong" p="lg" radius="xl">
          <Stack gap="md" align="center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            <Text c="var(--app-text)" size="lg">
              {locale === "zh" ? "正在执行评测，请稍候..." : "Running evaluation, please wait..."}
            </Text>
            <Text c="var(--app-text-muted)" size="sm">
              {locale === "zh" ? "系统正在处理您的评测请求，这可能需要一些时间。" : "The system is processing your evaluation request, which may take some time."}
            </Text>
          </Stack>
        </Paper>
      ) : runEvalMutation.data ? (
        <Stack gap="md">
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
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

          {/* 质量指标雷达图 */}
          {runEvalMutation.data?.summary && (
            <Paper className="workspace-panel-hover workspace-panel-muted" p="lg" radius="xl">
              <Stack gap="sm">
                <div className="workspace-section-heading">{locale === "zh" ? "质量指标雷达图" : "Quality metrics radar"}</div>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart outerRadius={90} width={730} height={250} data={radarData}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="subject" />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} />
                      <Radar
                        name={locale === "zh" ? "当前评测" : "Current Eval"}
                        dataKey="A"
                        stroke="#8884d8"
                        fill="#8884d8"
                        fillOpacity={0.6}
                      />
                      <Legend />
                      <Tooltip />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </Stack>
            </Paper>
          )}

          <Paper className="workspace-panel-hover workspace-panel-muted" p="lg" radius="xl">
            <Stack gap="sm">
              <div className="workspace-section-heading">{locale === "zh" ? "质量分布" : "Quality distribution"}</div>
              {qualitySummaryRows.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2">
                  <div>
                    {qualitySummaryRows.map(row => (
                      <div className="workspace-meta-row workspace-table-number" key={row.quality}>
                        <span className="workspace-meta-label">{row.quality}</span>
                        <span className="workspace-meta-value">{row.count}</span>
                      </div>
                    ))}
                  </div>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={qualityDistributionData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                          label={({ name, percent }: { name: string; percent: number }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        >
                          {qualityDistributionData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ) : (
                <Text c="var(--app-text-muted)" size="sm">
                  {locale === "zh" ? "暂无可汇总的质量结果。" : "No quality results available yet."}
                </Text>
              )}
            </Stack>
          </Paper>

          {/* 答案状态分布 */}
          {answerStatusDistribution.length > 0 && (
            <Paper className="workspace-panel-hover workspace-panel-muted" p="lg" radius="xl">
              <Stack gap="sm">
                <div className="workspace-section-heading">{locale === "zh" ? "答案状态分布" : "Answer status distribution"}</div>
                <div className="grid gap-2 md:grid-cols-3">
                  {answerStatusDistribution.map((item, index) => (
                    <div className="workspace-meta-row workspace-table-number" key={item.status}>
                      <span className="workspace-meta-label">{item.status}</span>
                      <span className="workspace-meta-value">{item.count}</span>
                    </div>
                  ))}
                </div>
              </Stack>
            </Paper>
          )}

          {/* 错误类型分布 */}
          {errorTypeDistribution.length > 0 && (
            <Paper className="workspace-panel-hover workspace-panel-muted" p="lg" radius="xl">
              <Stack gap="sm">
                <div className="workspace-section-heading">{locale === "zh" ? "错误类型分布" : "Error type distribution"}</div>
                <div className="grid gap-2 md:grid-cols-3">
                  {errorTypeDistribution.map((item, index) => (
                    <div className="workspace-meta-row workspace-table-number" key={item.code}>
                      <span className="workspace-meta-label">{item.code}</span>
                      <span className="workspace-meta-value">{item.count}</span>
                    </div>
                  ))}
                </div>
              </Stack>
            </Paper>
          )}

          {/* 质量门控信息 */}
          {qualityGate && (
            <Paper className="workspace-panel-hover workspace-panel-muted" p="lg" radius="xl">
              <Stack gap="sm">
                <div className="workspace-section-heading">{locale === "zh" ? "质量门控" : "Quality gate"}</div>
                <div className="grid gap-2 md:grid-cols-2">
                  <div className="workspace-meta-row">
                    <span className="workspace-meta-label">{locale === "zh" ? "模式" : "Mode"}</span>
                    <span className="workspace-meta-value">{qualityGate.mode}</span>
                  </div>
                  <div className="workspace-meta-row">
                    <span className="workspace-meta-label">{locale === "zh" ? "状态" : "Status"}</span>
                    <span className="workspace-meta-value">{qualityGate.status}</span>
                  </div>
                  <div className="workspace-meta-row">
                    <span className="workspace-meta-label">{locale === "zh" ? "限制版本" : "Limit version"}</span>
                    <span className="workspace-meta-value">{qualityGate.limitVersion}</span>
                  </div>
                  <div className="workspace-meta-row">
                    <span className="workspace-meta-label">{locale === "zh" ? "违规指标数" : "Breached metrics"}</span>
                    <span className="workspace-meta-value">{qualityGate.breachedMetricCount}</span>
                  </div>
                </div>
                <div className="mt-2">
                  <Text c="var(--app-text-muted)" size="sm">
                    {qualityGate.message}
                  </Text>
                </div>
                {qualityGate.breachedMetrics && qualityGate.breachedMetrics.length > 0 && (
                  <div className="mt-2">
                    <Text c="var(--app-text)" size="sm" fw={600}>
                      {locale === "zh" ? "违规指标：" : "Breached metrics:"}
                    </Text>
                    <div className="grid gap-2 mt-1">
                      {qualityGate.breachedMetrics.map((metric, index) => (
                        <div className="workspace-meta-row" key={index}>
                          <span className="workspace-meta-label">{metric.metric}</span>
                          <span className="workspace-meta-value">
                            {metric.current} vs {metric.limit} ({metric.limitType})
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Stack>
            </Paper>
          )}

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

          <Paper className="workspace-panel-hover workspace-panel-muted" p="lg" radius="xl">
            <Stack gap="sm">
              <div className="workspace-section-heading">{locale === "zh" ? "运行上下文" : "Run context"}</div>
              <div className="grid gap-2 md:grid-cols-2">
                <div className="workspace-meta-row">
                  <span className="workspace-meta-label">{getRunContextLabel("questionSetId")}</span>
                  <span className="workspace-meta-value">{runEvalMutation.data.questionSetId}</span>
                </div>
                <div className="workspace-meta-row">
                  <span className="workspace-meta-label">{getRunContextLabel("assistantId")}</span>
                  <span className="workspace-meta-value">{runEvalMutation.data.assistantId}</span>
                </div>
                <div className="workspace-meta-row">
                  <span className="workspace-meta-label">{getRunContextLabel("baselineSnapshotId")}</span>
                  <span className="workspace-meta-value">
                    {formatBaselineMetadataValue(runEvalMutation.data.baselineSnapshotId, baselineSnapshotPlaceholder)}
                  </span>
                </div>
                <div className="workspace-meta-row">
                  <span className="workspace-meta-label">{getRunContextLabel("baselineVersion")}</span>
                  <span className="workspace-meta-value">
                    {formatBaselineMetadataValue(runEvalMutation.data.baselineVersion, baselineVersionPlaceholder)}
                  </span>
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
            </Stack>
          </Paper>

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
                  loading={exporting === "markdown"}
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
                  loading={exporting === "json"}
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
                  loading={exporting === "html"}
                  radius="xl"
                  size="xs"
                  variant="light"
                >
                  HTML
                </Button>
              </div>
            </Stack>
          </Paper>

          {hasRunItems ? (
            <div className="workspace-table-shell overflow-x-auto">
              <div className="workspace-table-toolbar border-b border-[var(--app-border)] px-4 py-3 flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-4 w-full sm:w-auto">
                  <Text className="workspace-table-hint flex-shrink-0">
                    {locale === "zh"
                      ? "按题逐行扫状态、质量和主问题；Trace 列保留直接跳转。"
                      : "Scan each row by status, quality, and primary issue; the trace column keeps a direct jump."}
                  </Text>
                  <div className="flex flex-wrap items-center gap-3 flex-grow sm:flex-grow-0">
                    <Select
                      data={statusOptions.map(option => ({ value: option, label: option }))}
                      label={locale === "zh" ? "状态筛选" : "Status filter"}
                      onChange={value => setFilterStatus(value ?? "")}
                      placeholder={locale === "zh" ? "全部状态" : "All statuses"}
                      value={filterStatus || null}
                      size="xs"
                    />
                    <Select
                      data={qualityOptions.map(option => ({ value: option, label: option }))}
                      label={locale === "zh" ? "质量筛选" : "Quality filter"}
                      onChange={value => setFilterQuality(value ?? "")}
                      placeholder={locale === "zh" ? "全部质量" : "All quality"}
                      value={filterQuality || null}
                      size="xs"
                    />
                  </div>
                </div>
                <Badge color={runEvalMutation.isError ? "red" : "indigo"} radius="sm" variant="light">
                  {locale === "zh"
                    ? `${sortedAndFilteredItems.length} 条结果`
                    : `${sortedAndFilteredItems.length} results`}
                </Badge>
              </div>
              <Table.ScrollContainer minWidth={1040}>
                <Table
                  className="workspace-table"
                  highlightOnHover
                  striped="odd"
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
                      letterSpacing: "0.04em",
                      cursor: "pointer"
                    },
                    td: {
                      color: "var(--app-text)"
                    }
                  }}
                >
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th onClick={() => requestSort('index')}>
                        # {sortConfig?.key === 'index' && (sortConfig.direction === 'ascending' ? '↑' : '↓')}
                      </Table.Th>
                      <Table.Th onClick={() => requestSort('status')}>
                        {locale === "zh" ? "状态" : "Status"} {sortConfig?.key === 'status' && (sortConfig.direction === 'ascending' ? '↑' : '↓')}
                      </Table.Th>
                      <Table.Th onClick={() => requestSort('question')}>
                        {locale === "zh" ? "问题" : "Question"} {sortConfig?.key === 'question' && (sortConfig.direction === 'ascending' ? '↑' : '↓')}
                      </Table.Th>
                      <Table.Th onClick={() => requestSort('answerStatus')}>
                        {locale === "zh" ? "答案状态" : "Answer status"} {sortConfig?.key === 'answerStatus' && (sortConfig.direction === 'ascending' ? '↑' : '↓')}
                      </Table.Th>
                      <Table.Th onClick={() => requestSort('qualityOverall')}>
                        {locale === "zh" ? "质量" : "Quality"} {sortConfig?.key === 'qualityOverall' && (sortConfig.direction === 'ascending' ? '↑' : '↓')}
                      </Table.Th>
                      <Table.Th onClick={() => requestSort('qualityPrimaryIssue')}>
                        {locale === "zh" ? "主问题" : "Primary issue"} {sortConfig?.key === 'qualityPrimaryIssue' && (sortConfig.direction === 'ascending' ? '↑' : '↓')}
                      </Table.Th>
                      <Table.Th onClick={() => requestSort('citationCount')}>
                        {locale === "zh" ? "引用数" : "Citations"} {sortConfig?.key === 'citationCount' && (sortConfig.direction === 'ascending' ? '↑' : '↓')}
                      </Table.Th>
                      <Table.Th onClick={() => requestSort('usedFallback')}>
                        {locale === "zh" ? "Fallback" : "Fallback"} {sortConfig?.key === 'usedFallback' && (sortConfig.direction === 'ascending' ? '↑' : '↓')}
                      </Table.Th>
                      <Table.Th>{locale === "zh" ? "Trace / 问题" : "Trace / issue"}</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {sortedAndFilteredItems.map(item => (
                      <Table.Tr key={`${item.index}-${item.question}`}>
                        <Table.Td>
                          <Text className="workspace-table-number" fw={600} size="sm">
                            {item.index}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <div className="workspace-table-badge-stack">
                            <Badge color={item.status === "succeeded" ? "indigo" : "red"} radius="sm" variant="light">
                              {item.status}
                            </Badge>
                            {item.error?.code ? <Text className="workspace-table-cell-meta">{item.error.code}</Text> : null}
                          </div>
                        </Table.Td>
                        <Table.Td>
                          <Text className="workspace-table-cell-title-main" lineClamp={3} size="sm">
                            {item.question}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text className="workspace-table-cell-copy">{item.answerStatus ?? "-"}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Text className="workspace-table-cell-copy">{item.qualityOverall ?? "-"}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Text className="workspace-table-cell-copy" lineClamp={2}>{item.qualityPrimaryIssue ?? "-"}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Text className="workspace-table-number" fw={600} size="sm">{item.citationCount}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Text className="workspace-table-cell-copy">
                            {item.usedFallback == null ? "-" : item.usedFallback ? (locale === "zh" ? "是" : "yes") : (locale === "zh" ? "否" : "no")}
                          </Text>
                        </Table.Td>
                        <Table.Td className="workspace-table-action">
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
                                {locale === "zh" ? "打开 Trace" : "Open trace"}
                              </Button>
                            ) : (
                              <Text c="var(--app-text-muted)" size="xs">-</Text>
                            )}
                            {item.traceId ? <Text className="workspace-table-cell-meta">{item.traceId}</Text> : null}
                            {item.error?.message ? (
                              <Text className="workspace-table-cell-copy" lineClamp={3} size="xs">
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
          ) : (
            <StatePanel
              description={
                locale === "zh"
                  ? "当前 run 没有返回可展示题目。请先检查 question-set 输入，再执行一次 scan-first run。"
                  : "This run did not return any displayable items. Verify the question-set input and run one scan-first eval again."
              }
              title={locale === "zh" ? "本次 run 暂无题目结果" : "This run has no eval items yet"}
              tone="empty"
            />
          )}
        </Stack>
      ) : null}
    </div>
  );
}
