import { Badge, Button, Group, Paper, Stack, Text, Title } from "@mantine/core";
import { Link } from "react-router-dom";
import { StatePanel } from "../StatePanel";
import { useI18n } from "../../i18n/I18nProvider";
import type { DocumentRunRecord, KnowledgeBaseDocumentRunRecord } from "../../types/api";
import {
  buildRunSummaryText,
  buildRunDiagnosticsHighlights,
  describeRunMeta
} from "./document-run-observability";

type RunRecord = DocumentRunRecord | KnowledgeBaseDocumentRunRecord;
type TranslateFn = (key: string) => string;

function getStatusColor(status: RunRecord["status"]) {
  switch (status) {
    case "ready":
      return "indigo";
    case "failed":
      return "red";
    case "skipped":
      return "gray";
    default:
      return "yellow";
  }
}

function getStatusLabel(status: RunRecord["status"], locale: string, t: (key: string) => string) {
  if (status === "skipped") {
    return locale === "zh" ? "已跳过" : "skipped";
  }

  return t(`common.status.${status}`);
}

function getDiagnosticsSummaryLabel(key: string, locale: string) {
  if (locale === "zh") {
    switch (key) {
      case "code":
        return "代码";
      case "retryable":
        return "可重试";
      case "partial":
        return "部分成功";
      case "failedPages":
        return "失败页面";
      case "failedChildSitemaps":
        return "失败子站点图";
      case "failedEntries":
        return "失败条目";
      case "attemptedPages":
        return "尝试页面";
      case "attemptedEntries":
        return "尝试条目";
      default:
        return key;
    }
  }

  switch (key) {
    case "code":
      return "Code";
    case "retryable":
      return "Retryable";
    case "partial":
      return "Partial";
    case "failedPages":
      return "Failed pages";
    case "failedChildSitemaps":
      return "Failed child sitemaps";
    case "failedEntries":
      return "Failed entries";
    case "attemptedPages":
      return "Attempted pages";
    case "attemptedEntries":
      return "Attempted entries";
    default:
      return key;
  }
}

function getRunDocument(run: RunRecord) {
  return "document" in run ? run.document : null;
}

function getRunFinishedLabel(run: RunRecord, locale: string, formatDateTime: (value: string) => string) {
  const meta = describeRunMeta(run);

  if (meta.finishedAt) {
    return `${locale === "zh" ? "完成" : "Finished"} ${formatDateTime(meta.finishedAt)}`;
  }

  return `${locale === "zh" ? "开始" : "Started"} ${formatDateTime(meta.startedAt)}`;
}

function RunStatusBadges({ run, locale, t }: { run: RunRecord; locale: string; t: TranslateFn }) {
  const meta = describeRunMeta(run);

  return (
    <Group gap="xs">
      <Badge color={getStatusColor(run.status)} variant="light">
        {getStatusLabel(run.status, locale, t)}
      </Badge>
      <Badge color="gray" variant="light">
        {meta.triggerLabel}
      </Badge>
      {meta.sourceTypeLabel ? (
        <Badge color="blue" variant="light">
          {meta.sourceTypeLabel}
        </Badge>
      ) : null}
      <Badge color="gray" variant="outline">
        v{run.version}
      </Badge>
    </Group>
  );
}

function RunDocumentSummary({ run }: { run: RunRecord }) {
  const document = getRunDocument(run);

  if (!document) {
    return null;
  }

  return (
    <div>
      <Title c="var(--app-text)" order={5}>
        {document.title}
      </Title>
      <Text c="var(--app-text-muted)" size="sm">
        {document.sourceName}
      </Text>
    </div>
  );
}

function RunMetaSummary({ run, locale, formatDateTime }: { run: RunRecord; locale: string; formatDateTime: (value: string) => string }) {
  const meta = describeRunMeta(run);

  return (
    <div className="workspace-meta-list">
      <div className="workspace-meta-row">
        <span className="workspace-meta-label">{locale === "zh" ? "开始时间" : "Started"}</span>
        <span className="workspace-meta-value">{formatDateTime(meta.startedAt)}</span>
      </div>
      <div className="workspace-meta-row">
        <span className="workspace-meta-label">{locale === "zh" ? "结束时间" : "Finished"}</span>
        <span className="workspace-meta-value">
          {meta.finishedAt ? formatDateTime(meta.finishedAt) : locale === "zh" ? "进行中" : "In progress"}
        </span>
      </div>
      {meta.failedStageLabel ? (
        <div className="workspace-meta-row">
          <span className="workspace-meta-label">{locale === "zh" ? "失败阶段" : "Failed stage"}</span>
          <span className="workspace-meta-value">{meta.failedStageLabel}</span>
        </div>
      ) : null}
    </div>
  );
}

function RunFailureSummary({ run }: { run: RunRecord }) {
  const meta = describeRunMeta(run);

  if (!meta.failureMessage) {
    return null;
  }

  return (
    <Text c="var(--app-text-secondary)" size="sm">
      {meta.failureMessage}
    </Text>
  );
}

function RunSummaryText({ run, locale }: { run: RunRecord; locale: string }) {
  return (
    <Text c="var(--app-text-secondary)" size="sm">
      {buildRunSummaryText(run, locale)}
    </Text>
  );
}

function RunDiagnosticsHighlights({ run, locale }: { run: RunRecord; locale: string }) {
  const diagnosticsHighlights = buildRunDiagnosticsHighlights(run.diagnosticsJson);

  if (diagnosticsHighlights.length === 0) {
    return null;
  }

  return (
    <Group gap="xs">
      {diagnosticsHighlights.map(item => (
        <Badge color="gray" key={item.key} variant="light">
          {getDiagnosticsSummaryLabel(item.key, locale)}: {item.value}
        </Badge>
      ))}
    </Group>
  );
}

function RunActions({
  run,
  locale,
  onReindexRun,
  t
}: {
  run: RunRecord;
  locale: string;
  onReindexRun?: (run: RunRecord) => Promise<void> | void;
  t: TranslateFn;
}) {
  const document = getRunDocument(run);

  if (!document) {
    return null;
  }

  return (
    <Group gap="xs">
      <Button
        className="workspace-button"
        color="indigo"
        component={Link}
        radius="xl"
        size="xs"
        to={`/documents/${run.documentId}`}
        variant="light"
      >
        {locale === "zh" ? "查看文档" : "Open document"}
      </Button>
      {onReindexRun && (run.status === "failed" || run.status === "skipped") ? (
        <Button
          className="workspace-button"
          color="indigo"
          onClick={() => onReindexRun?.(run)}
          radius="xl"
          size="xs"
          variant="light"
        >
          {t("common.actions.reindex")}
        </Button>
      ) : null}
    </Group>
  );
}

function RunDiagnosticsDetails({ run, locale }: { run: RunRecord; locale: string }) {
  if (!run.diagnosticsJson) {
    return null;
  }

  return (
    <details>
      <summary className="workspace-collapsible-summary">
        {locale === "zh" ? "最小诊断详情" : "Minimal diagnostics"}
      </summary>
      <pre className="workspace-code-block workspace-code-block-scroll" style={{ marginTop: "0.9rem" }}>
        {JSON.stringify(run.diagnosticsJson, null, 2)}
      </pre>
    </details>
  );
}

function DocumentRunCard({
  run,
  locale,
  formatDateTime,
  onReindexRun,
  t
}: {
  run: RunRecord;
  locale: string;
  formatDateTime: (value: string) => string;
  onReindexRun?: (run: RunRecord) => Promise<void> | void;
  t: TranslateFn;
}) {
  return (
    <Paper className="workspace-subpanel" p="md" radius="xl">
      <Stack gap="sm">
        <Group align="flex-start" justify="space-between" wrap="nowrap">
          <Stack gap={6} style={{ minWidth: 0, flex: 1 }}>
            <RunStatusBadges locale={locale} run={run} t={t} />
            <RunDocumentSummary run={run} />
          </Stack>

          <Text c="var(--app-text-muted)" size="xs" ta="right">
            {getRunFinishedLabel(run, locale, formatDateTime)}
          </Text>
        </Group>

        <RunMetaSummary formatDateTime={formatDateTime} locale={locale} run={run} />
        <RunSummaryText locale={locale} run={run} />
        <RunFailureSummary run={run} />
        <RunDiagnosticsHighlights locale={locale} run={run} />
        <RunActions locale={locale} onReindexRun={onReindexRun} run={run} t={t} />
        <RunDiagnosticsDetails locale={locale} run={run} />
      </Stack>
    </Paper>
  );
}

type Props = {
  title: string;
  description: string;
  runs: RunRecord[];
  emptyTitle: string;
  emptyDescription: string;
  onReindexRun?: (run: RunRecord) => Promise<void> | void;
};

export function DocumentRunList(props: Props) {
  const { formatDateTime, locale, t } = useI18n();

  return (
    <Paper className="workspace-panel-hover workspace-panel-strong" p="lg" radius="xl">
      <Stack gap="md">
        <div>
          <Text className="workspace-section-heading">{props.title}</Text>
          <Text className="workspace-section-copy">{props.description}</Text>
        </div>

        {props.runs.length === 0 ? (
          <StatePanel title={props.emptyTitle} description={props.emptyDescription} />
        ) : (
          <Stack gap="sm">
            {props.runs.map(run => (
              <DocumentRunCard
                formatDateTime={formatDateTime}
                key={run.id}
                locale={locale}
                onReindexRun={props.onReindexRun}
                run={run}
                t={t}
              />
            ))}
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}
