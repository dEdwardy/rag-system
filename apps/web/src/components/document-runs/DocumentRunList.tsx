import { Badge, Button, Group, Paper, Stack, Text, Title } from '@mantine/core';
import { Link } from 'react-router-dom';
import { memo } from 'react';
import { StatePanel } from '../StatePanel';
import { useI18n } from '../../i18n/I18nProvider';
import type {
  DocumentRunRecord,
  KnowledgeBaseDocumentRunRecord
} from '../../types/api';
import {
  buildRunSummaryText,
  buildRunDiagnosticsHighlights,
  describeRunMeta
} from './document-run-observability';

type RunRecord = DocumentRunRecord | KnowledgeBaseDocumentRunRecord;
type TranslateFn = (key: string) => string;

function getStatusColor(status: RunRecord['status']) {
  switch (status) {
    case 'ready':
      return 'indigo';
    case 'failed':
      return 'red';
    case 'skipped':
      return 'gray';
    default:
      return 'yellow';
  }
}

function getStatusLabel(status: RunRecord['status'], t: TranslateFn) {
  if (status === 'skipped') {
    return t('documentRuns.skippedStatus');
  }

  return t(`common.status.${status}`);
}

function getDiagnosticsSummaryLabel(key: string, t: TranslateFn) {
  const labels: Record<string, string> = {
    code: t('documentRuns.diagnosticsSummary.code'),
    retryable: t('documentRuns.diagnosticsSummary.retryable'),
    partial: t('documentRuns.diagnosticsSummary.partial'),
    failedPages: t('documentRuns.diagnosticsSummary.failedPages'),
    failedChildSitemaps: t(
      'documentRuns.diagnosticsSummary.failedChildSitemaps'
    ),
    failedEntries: t('documentRuns.diagnosticsSummary.failedEntries'),
    attemptedPages: t('documentRuns.diagnosticsSummary.attemptedPages'),
    attemptedEntries: t('documentRuns.diagnosticsSummary.attemptedEntries')
  };

  return labels[key] ?? key;
}

function getRunDocument(run: RunRecord) {
  return 'document' in run ? run.document : null;
}

function getRunFinishedLabel(
  run: RunRecord,
  formatDateTime: (value: string) => string,
  t: TranslateFn
) {
  const meta = describeRunMeta(run);

  if (meta.finishedAt) {
    return `${t('documentRuns.finishedPrefix')} ${formatDateTime(meta.finishedAt)}`;
  }

  return `${t('documentRuns.startedPrefix')} ${formatDateTime(meta.startedAt)}`;
}

const RunStatusBadges = memo(function RunStatusBadges({
  run,
  t
}: {
  run: RunRecord;
  t: TranslateFn;
}) {
  const meta = describeRunMeta(run);

  return (
    <Group gap="xs">
      <Badge color={getStatusColor(run.status)} variant="light">
        {getStatusLabel(run.status, t)}
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
});

const RunDocumentSummary = memo(function RunDocumentSummary({
  run
}: {
  run: RunRecord;
}) {
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
});

const RunMetaSummary = memo(function RunMetaSummary({
  run,
  formatDateTime,
  t
}: {
  run: RunRecord;
  formatDateTime: (value: string) => string;
  t: TranslateFn;
}) {
  const meta = describeRunMeta(run);

  return (
    <div className="workspace-meta-list">
      <div className="workspace-meta-row">
        <span className="workspace-meta-label">
          {t('documentRuns.startedAt')}
        </span>
        <span className="workspace-meta-value">
          {formatDateTime(meta.startedAt)}
        </span>
      </div>
      <div className="workspace-meta-row">
        <span className="workspace-meta-label">
          {t('documentRuns.finishedAt')}
        </span>
        <span className="workspace-meta-value">
          {meta.finishedAt
            ? formatDateTime(meta.finishedAt)
            : t('documentRuns.inProgress')}
        </span>
      </div>
      {meta.failedStageLabel ? (
        <div className="workspace-meta-row">
          <span className="workspace-meta-label">
            {t('documentRuns.failedStage')}
          </span>
          <span className="workspace-meta-value">{meta.failedStageLabel}</span>
        </div>
      ) : null}
    </div>
  );
});

const RunFailureSummary = memo(function RunFailureSummary({
  run
}: {
  run: RunRecord;
}) {
  const meta = describeRunMeta(run);

  if (!meta.failureMessage) {
    return null;
  }

  return (
    <Text c="var(--app-text-secondary)" size="sm">
      {meta.failureMessage}
    </Text>
  );
});

const RunSummaryText = memo(function RunSummaryText({
  run,
  locale
}: {
  run: RunRecord;
  locale: string;
}) {
  return (
    <Text c="var(--app-text-secondary)" size="sm">
      {buildRunSummaryText(run, locale)}
    </Text>
  );
});

const RunDiagnosticsHighlights = memo(function RunDiagnosticsHighlights({
  run,
  t
}: {
  run: RunRecord;
  t: TranslateFn;
}) {
  const diagnosticsHighlights = buildRunDiagnosticsHighlights(
    run.diagnosticsJson
  );

  if (diagnosticsHighlights.length === 0) {
    return null;
  }

  return (
    <Group gap="xs">
      {diagnosticsHighlights.map((item) => (
        <Badge color="gray" key={item.key} variant="light">
          {getDiagnosticsSummaryLabel(item.key, t)}: {item.value}
        </Badge>
      ))}
    </Group>
  );
});

const RunActions = memo(function RunActions({
  run,
  onReindexRun,
  t
}: {
  run: RunRecord;
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
        {t('documentRuns.openDocument')}
      </Button>
      {onReindexRun && (run.status === 'failed' || run.status === 'skipped') ? (
        <Button
          className="workspace-button"
          color="indigo"
          onClick={() => onReindexRun?.(run)}
          radius="xl"
          size="xs"
          variant="light"
        >
          {t('common.actions.reindex')}
        </Button>
      ) : null}
    </Group>
  );
});

const RunDiagnosticsDetails = memo(function RunDiagnosticsDetails({
  run,
  t
}: {
  run: RunRecord;
  t: TranslateFn;
}) {
  if (!run.diagnosticsJson) {
    return null;
  }

  return (
    <details>
      <summary className="workspace-collapsible-summary">
        {t('documentRuns.minimalDiagnostics')}
      </summary>
      <pre
        className="workspace-code-block workspace-code-block-scroll"
        style={{ marginTop: '0.9rem' }}
      >
        {JSON.stringify(run.diagnosticsJson, null, 2)}
      </pre>
    </details>
  );
});

const DocumentRunCard = memo(function DocumentRunCard({
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
            <RunStatusBadges run={run} t={t} />
            <RunDocumentSummary run={run} />
          </Stack>

          <Text c="var(--app-text-muted)" size="xs" ta="right">
            {getRunFinishedLabel(run, formatDateTime, t)}
          </Text>
        </Group>

        <RunMetaSummary formatDateTime={formatDateTime} run={run} t={t} />
        <RunSummaryText locale={locale} run={run} />
        <RunFailureSummary run={run} />
        <RunDiagnosticsHighlights run={run} t={t} />
        <RunActions onReindexRun={onReindexRun} run={run} t={t} />
        <RunDiagnosticsDetails run={run} t={t} />
      </Stack>
    </Paper>
  );
});

type Props = {
  title: string;
  description: string;
  runs: RunRecord[];
  emptyTitle: string;
  emptyDescription: string;
  onReindexRun?: (run: RunRecord) => Promise<void> | void;
};

export const DocumentRunList = memo(function DocumentRunList(props: Props) {
  const { formatDateTime, locale, t } = useI18n();

  return (
    <Paper
      className="workspace-panel-hover workspace-panel-strong"
      p="lg"
      radius="xl"
    >
      <Stack gap="md">
        <div>
          <Text className="workspace-section-heading">{props.title}</Text>
          <Text className="workspace-section-copy">{props.description}</Text>
        </div>

        {props.runs.length === 0 ? (
          <StatePanel
            title={props.emptyTitle}
            description={props.emptyDescription}
          />
        ) : (
          <Stack gap="sm">
            {props.runs.map((run) => (
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
});
