import { Badge, Button, Group, Paper, Stack, Text, Title } from "@mantine/core";
import { Link } from "react-router-dom";
import { StatePanel } from "../StatePanel";
import { useI18n } from "../../i18n/I18nProvider";
import type { DocumentRunRecord, KnowledgeBaseDocumentRunRecord } from "../../types/api";
import {
  buildRunDiagnosticsHighlights,
  describeRunMeta
} from "./document-run-observability";

type RunRecord = DocumentRunRecord | KnowledgeBaseDocumentRunRecord;

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
            {props.runs.map(run => {
              const meta = describeRunMeta(run);
              const diagnosticsHighlights = buildRunDiagnosticsHighlights(run.diagnosticsJson);
              const document = getRunDocument(run);

              return (
                <Paper className="workspace-subpanel" key={run.id} p="md" radius="xl">
                  <Stack gap="sm">
                    <Group align="flex-start" justify="space-between" wrap="nowrap">
                      <Stack gap={6} style={{ minWidth: 0, flex: 1 }}>
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

                        {document ? (
                          <div>
                            <Title c="var(--app-text)" order={5}>
                              {document.title}
                            </Title>
                            <Text c="var(--app-text-muted)" size="sm">
                              {document.sourceName}
                            </Text>
                          </div>
                        ) : null}
                      </Stack>

                      <Text c="var(--app-text-muted)" size="xs" ta="right">
                        {meta.finishedAt
                          ? `${locale === "zh" ? "完成" : "Finished"} ${formatDateTime(meta.finishedAt)}`
                          : `${locale === "zh" ? "开始" : "Started"} ${formatDateTime(meta.startedAt)}`}
                      </Text>
                    </Group>

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

                    {meta.failureMessage ? (
                      <Text c="var(--app-text-secondary)" size="sm">
                        {meta.failureMessage}
                      </Text>
                    ) : null}

                    {diagnosticsHighlights.length > 0 ? (
                      <Group gap="xs">
                        {diagnosticsHighlights.map(item => (
                          <Badge color="gray" key={item.key} variant="light">
                            {getDiagnosticsSummaryLabel(item.key, locale)}: {item.value}
                          </Badge>
                        ))}
                      </Group>
                    ) : null}

                    {document ? (
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
                        {props.onReindexRun && (run.status === "failed" || run.status === "skipped") ? (
                          <Button
                            className="workspace-button"
                            color="indigo"
                            onClick={() => props.onReindexRun?.(run)}
                            radius="xl"
                            size="xs"
                            variant="light"
                          >
                            {t("common.actions.reindex")}
                          </Button>
                        ) : null}
                      </Group>
                    ) : null}

                    {run.diagnosticsJson ? (
                      <details>
                        <summary className="workspace-collapsible-summary">
                          {locale === "zh" ? "最小诊断详情" : "Minimal diagnostics"}
                        </summary>
                        <pre className="workspace-code-block workspace-code-block-scroll" style={{ marginTop: "0.9rem" }}>
                          {JSON.stringify(run.diagnosticsJson, null, 2)}
                        </pre>
                      </details>
                    ) : null}
                  </Stack>
                </Paper>
              );
            })}
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}
