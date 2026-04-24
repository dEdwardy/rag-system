import { Anchor, Badge, Group, Paper, Stack, Text, Alert } from '@mantine/core';
import { Link } from 'react-router-dom';
import { StatePanel } from '../../components/StatePanel';
import type { SupportedLocale } from '../../i18n/messages';
import type { Citation, TraceRecord } from '../../types/api';
import { buildTraceExecutionToolLabel } from '@rag-system/shared';
import {
  buildDocumentChunkLink,
  buildRawPayload
} from './trace-detail-page-helpers';
import { routeShortcutLabels } from '../reports/route-view-helpers';

type TraceDetailSectionIds = {
  retrievedChunks: string;
  citations: string;
  rawPayload: string;
  requestResponse: string;
};

type TranslationFn = (
  key: string,
  values?: Record<string, string | number>
) => string;

type TraceDetailSidebarPanelsProps = {
  formatDateTime: (value: string) => string;
  hasRewrite: boolean;
  locale: SupportedLocale;
  sectionIds: TraceDetailSectionIds;
  t: TranslationFn;
  trace: TraceRecord;
};

type TraceDetailSecondaryPanelsProps = {
  citations: Citation[];
  locale: SupportedLocale;
  sectionIds: TraceDetailSectionIds;
  t: TranslationFn;
  trace: TraceRecord;
};

function formatJson(value: unknown) {
  if (value == null) {
    return 'null';
  }

  return JSON.stringify(value, null, 2);
}

function formatTimingValue(value: number | null | undefined) {
  return value == null ? '-' : `${value} ms`;
}

function normalizeExternalSources(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((source) => {
      if (
        typeof source !== 'object' ||
        source === null ||
        typeof source.url !== 'string'
      ) {
        return null;
      }

      return {
        url: source.url,
        kind: typeof source.kind === 'string' ? source.kind : '-',
        title: typeof source.title === 'string' ? source.title : null,
        diagnostics: 'diagnostics' in source ? source.diagnostics : null
      };
    })
    .filter(
      (
        source
      ): source is {
        url: string;
        kind: string;
        title: string | null;
        diagnostics: unknown;
      } => source !== null
    );
}

function buildTimingBottleneck(trace: TraceRecord, locale: SupportedLocale) {
  const timing = trace.traceSummary?.timingSummary;
  if (!timing) {
    return null;
  }

  const candidates = [
    {
      label: locale === 'zh' ? '首 token' : 'First token',
      value: timing.firstTokenMs
    },
    {
      label: locale === 'zh' ? '首 token 前置' : 'Pre-generation',
      value: timing.preGenerationMs
    },
    {
      label: locale === 'zh' ? 'LLM 首 token' : 'LLM first token',
      value: timing.llmFirstTokenMs
    },
    {
      label: locale === 'zh' ? '回答生成' : 'Answer generation',
      value: timing.answerGenerationMs
    },
    {
      label: locale === 'zh' ? '检索' : 'Retrieval',
      value: timing.retrievalMs
    },
    {
      label: locale === 'zh' ? '会话加载' : 'Conversation load',
      value: timing.conversationLoadMs
    },
    {
      label: locale === 'zh' ? '用户消息落库' : 'Persist user',
      value: timing.userMessagePersistMs
    },
    {
      label: locale === 'zh' ? '助手消息落库' : 'Persist assistant',
      value: timing.assistantMessagePersistMs
    }
  ].filter(
    (item): item is { label: string; value: number } =>
      typeof item.value === 'number'
  );

  if (candidates.length === 0) {
    return null;
  }

  const bottleneck = candidates.reduce((current, item) =>
    item.value > current.value ? item : current
  );
  const total = timing.totalMs ?? 0;
  const share = total > 0 ? Math.round((bottleneck.value / total) * 100) : null;

  return {
    label: bottleneck.label,
    value: bottleneck.value,
    share
  };
}

function buildTimingItems(trace: TraceRecord, locale: SupportedLocale) {
  const timing = trace.traceSummary?.timingSummary;
  if (!timing) {
    return [];
  }

  return [
    {
      key: 'first-token',
      label: locale === 'zh' ? '首 token' : 'First token',
      value: formatTimingValue(timing.firstTokenMs)
    },
    {
      key: 'pre-generation',
      label: locale === 'zh' ? '首 token 前置' : 'Pre-generation',
      value: formatTimingValue(timing.preGenerationMs)
    },
    {
      key: 'llm-first-token',
      label: locale === 'zh' ? 'LLM 首 token' : 'LLM first token',
      value: formatTimingValue(timing.llmFirstTokenMs)
    },
    {
      key: 'generation',
      label: locale === 'zh' ? '回答生成' : 'Answer generation',
      value: formatTimingValue(timing.answerGenerationMs)
    },
    {
      key: 'retrieval',
      label: locale === 'zh' ? '检索' : 'Retrieval',
      value: formatTimingValue(timing.retrievalMs)
    },
    {
      key: 'conversation',
      label: locale === 'zh' ? '会话加载' : 'Conversation load',
      value: formatTimingValue(timing.conversationLoadMs)
    },
    {
      key: 'persist-user',
      label: locale === 'zh' ? '用户消息落库' : 'Persist user',
      value: formatTimingValue(timing.userMessagePersistMs)
    },
    {
      key: 'persist-assistant',
      label: locale === 'zh' ? '助手消息落库' : 'Persist assistant',
      value: formatTimingValue(timing.assistantMessagePersistMs)
    },
    {
      key: 'llm-queue',
      label: locale === 'zh' ? 'LLM 排队' : 'LLM queue',
      value: formatTimingValue(timing.llmQueueWaitMs)
    },
    {
      key: 'retrieval-queue',
      label: locale === 'zh' ? '检索排队' : 'Retrieval queue',
      value: formatTimingValue(timing.retrievalQueueWaitMs)
    }
  ];
}

function buildExecutionStepTone(status: string) {
  if (status === 'completed') {
    return 'green';
  }

  if (status === 'failed') {
    return 'red';
  }

  if (status === 'running') {
    return 'blue';
  }

  return 'gray';
}

function buildExecutionModeTone(mode: string | null | undefined) {
  if (mode === 'workflow') {
    return 'blue';
  }

  if (mode === 'manual') {
    return 'gray';
  }

  return 'gray';
}

export function TraceDetailSidebarPanels({
  formatDateTime,
  hasRewrite,
  locale,
  sectionIds,
  t,
  trace
}: TraceDetailSidebarPanelsProps) {
  const timingItems = buildTimingItems(trace, locale);
  const timingBottleneck = buildTimingBottleneck(trace, locale);
  const routeDecision = trace.traceSummary?.routeDecisionSummary ?? null;
  const executionPlan = trace.traceSummary?.executionPlan ?? null;
  const executionMode = trace.traceSummary?.executionMode ?? null;
  const executionSteps = trace.traceSummary?.executionPlan?.steps ?? null;

  return (
    <div className="workspace-page-side-stack">
      <div className="workspace-sticky-panel">
        <Stack gap="md">
          <Paper
            className="workspace-panel-hover workspace-panel-strong"
            p="lg"
            radius="xl"
          >
            <Stack gap="md">
              <Text className="workspace-section-heading">
                {locale === 'zh' ? '诊断元数据' : 'Diagnostic metadata'}
              </Text>
              <div className="workspace-metadata-grid">
                <div className="workspace-metadata-item">
                  <div className="workspace-metadata-label">
                    {t('common.fields.created')}
                  </div>
                  <div className="workspace-metadata-value">
                    {formatDateTime(trace.createdAt)}
                  </div>
                </div>
                <div className="workspace-metadata-item">
                  <div className="workspace-metadata-label">
                    {t('common.fields.conversation')}
                  </div>
                  <div className="workspace-metadata-value workspace-metadata-value-code">
                    {trace.conversationId}
                  </div>
                </div>
                <div className="workspace-metadata-item">
                  <div className="workspace-metadata-label">
                    {t('common.fields.assistant')}
                  </div>
                  <div className="workspace-metadata-value workspace-metadata-value-code">
                    {trace.assistantId}
                  </div>
                </div>
                <div className="workspace-metadata-item">
                  <div className="workspace-metadata-label">
                    {t('common.fields.latency')}
                  </div>
                  <div className="workspace-metadata-value">
                    {trace.latencyMs ?? '-'} ms
                  </div>
                </div>
                <div className="workspace-metadata-item">
                  <div className="workspace-metadata-label">
                    {t('common.fields.model')}
                  </div>
                  <div className="workspace-metadata-value">
                    {trace.modelName ?? '-'}
                  </div>
                </div>
              </div>
              {routeDecision ? (
                <div className="workspace-content-block">
                  <Stack gap={8}>
                    <Group gap="xs">
                      <Text
                        className="workspace-section-copy"
                        fw={600}
                        size="sm"
                      >
                        {locale === 'zh' ? '路由决策' : 'Route decision'}
                      </Text>
                      <Badge color="indigo" radius="sm" variant="light">
                        {routeShortcutLabels[routeDecision.routeType] ??
                          routeDecision.routeType}
                      </Badge>
                    </Group>
                    <Text c="var(--app-text-muted)" size="sm">
                      {locale === 'zh'
                        ? `Reason: ${routeDecision.routeReason}`
                        : `Reason: ${routeDecision.routeReason}`}
                    </Text>
                  </Stack>
                </div>
              ) : null}
              {executionSteps && executionSteps.length > 0 ? (
                <div className="workspace-content-block">
                  <Stack gap={8}>
                    <Group gap="xs">
                      <Text
                        className="workspace-section-copy"
                        fw={600}
                        size="sm"
                      >
                        {locale === 'zh' ? '执行步骤' : 'Execution steps'}
                      </Text>
                      <Badge
                        color={buildExecutionModeTone(executionMode)}
                        radius="sm"
                        variant="light"
                      >
                        {executionMode ?? 'manual'}
                      </Badge>
                    </Group>
                    <Text c="var(--app-text-muted)" size="xs">
                      {locale === 'zh'
                        ? `总览：${executionPlan?.steps.length ?? 0} 个步骤`
                        : `Overview: ${executionPlan?.steps.length ?? 0} step(s)`}
                    </Text>
                    <Stack gap={6}>
                      {executionSteps.map((step) => (
                        <Group
                          key={step.key}
                          align="flex-start"
                          gap="xs"
                          wrap="nowrap"
                        >
                          <Badge
                            color={buildExecutionStepTone(step.status)}
                            radius="sm"
                            variant="light"
                          >
                            {step.status}
                          </Badge>
                          <Stack gap={2}>
                            <Text c="var(--app-text)" size="sm" fw={600}>
                              {step.label}
                            </Text>
                            {step.toolName ? (
                              <Badge color="cyan" radius="sm" variant="light">
                                {buildTraceExecutionToolLabel(step.toolName) ??
                                  step.toolName}
                              </Badge>
                            ) : null}
                            <Text c="var(--app-text-muted)" size="xs">
                              {step.detail ??
                                (locale === 'zh'
                                  ? '无补充说明'
                                  : 'No extra detail')}
                              {step.durationMs != null
                                ? ` · ${step.durationMs} ms`
                                : ''}
                            </Text>
                          </Stack>
                        </Group>
                      ))}
                    </Stack>
                  </Stack>
                </div>
              ) : null}
              {trace.errorMessage ? (
                <Alert color="red" radius="xl" variant="light">
                  <Text size="sm" c="var(--app-text-danger)">
                    {locale === 'zh' ? '错误信息' : 'Error message'}
                  </Text>
                  <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                    {trace.errorMessage}
                  </Text>
                </Alert>
              ) : null}
            </Stack>
          </Paper>

          {timingItems.length > 0 ? (
            <Paper
              className="workspace-panel-hover workspace-panel-muted"
              p="lg"
              radius="xl"
            >
              <Stack gap="md">
                <Text className="workspace-section-heading">
                  {locale === 'zh' ? '阶段耗时' : 'Stage timings'}
                </Text>
                <div className="workspace-metadata-grid">
                  {timingItems.map((item) => (
                    <div className="workspace-metadata-item" key={item.key}>
                      <div className="workspace-metadata-label">
                        {item.label}
                      </div>
                      <div className="workspace-metadata-value">
                        {item.value}
                      </div>
                    </div>
                  ))}
                  {timingBottleneck ? (
                    <div className="workspace-metadata-item">
                      <div className="workspace-metadata-label">
                        {locale === 'zh' ? '最慢阶段' : 'Slowest stage'}
                      </div>
                      <div className="workspace-metadata-value">
                        {timingBottleneck.label}
                        {timingBottleneck.value != null
                          ? ` · ${formatTimingValue(timingBottleneck.value)}`
                          : ''}
                        {timingBottleneck.share != null
                          ? ` · ${timingBottleneck.share}%`
                          : ''}
                      </div>
                    </div>
                  ) : null}
                </div>
                <Text c="var(--app-text-muted)" size="sm">
                  {trace.traceSummary?.timingReadabilitySentence ??
                    (locale === 'zh'
                      ? '当前 trace 没有可读的阶段耗时摘要。'
                      : 'This trace does not include a readable timing summary.')}
                </Text>
              </Stack>
            </Paper>
          ) : null}

          <Paper
            className="workspace-panel-hover workspace-panel-muted"
            p="lg"
            radius="xl"
          >
            <Stack gap="sm">
              <Text className="workspace-section-heading">
                {locale === 'zh' ? '页内快速跳转' : 'In-page quick jumps'}
              </Text>
              <Text className="workspace-section-copy">
                {locale === 'zh'
                  ? '优先跳到 chunk、引用或原始载荷区，不必反复滚动。'
                  : 'Jump directly to chunks, citations, or raw payload without rescanning the whole diagnostics page.'}
              </Text>
              <Stack gap={6}>
                <Anchor href={`#${sectionIds.retrievedChunks}`} size="sm">
                  {locale === 'zh'
                    ? '查看命中 Chunk'
                    : 'Go to retrieved chunks'}
                </Anchor>
                <Anchor href={`#${sectionIds.requestResponse}`} size="sm">
                  {locale === 'zh'
                    ? '查看请求与响应'
                    : 'Go to request and response'}
                </Anchor>
                <Anchor href={`#${sectionIds.citations}`} size="sm">
                  {locale === 'zh' ? '查看引用' : 'Go to citations'}
                </Anchor>
                <Anchor href={`#${sectionIds.rawPayload}`} size="sm">
                  {locale === 'zh' ? '查看原始载荷' : 'Go to raw payload'}
                </Anchor>
              </Stack>
            </Stack>
          </Paper>

          <Paper
            className="workspace-panel-hover workspace-panel-muted"
            p="lg"
            radius="xl"
          >
            <Stack gap="md">
              <Group justify="space-between">
                <Text className="workspace-section-heading">
                  {t('trace.queryComparison')}
                </Text>
                <Badge color={hasRewrite ? 'blue' : 'gray'} variant="light">
                  {hasRewrite
                    ? t('trace.rewriteApplied')
                    : t('trace.rewriteNotApplied')}
                </Badge>
              </Group>
              <Text className="workspace-section-copy">
                {t('trace.queryComparisonDescription')}
              </Text>
              <Stack gap="sm">
                <div className="workspace-content-block">
                  <Stack gap={6}>
                    <Text c="var(--app-text-muted)" size="xs">
                      {t('common.fields.userQuery')}
                    </Text>
                    <Text
                      c="var(--app-text)"
                      size="sm"
                      style={{ whiteSpace: 'pre-wrap' }}
                    >
                      {trace.userQuery}
                    </Text>
                  </Stack>
                </div>
                <div className="workspace-content-block">
                  <Stack gap={6}>
                    <Text c="var(--app-text-muted)" size="xs">
                      {t('common.fields.rewrittenQuery')}
                    </Text>
                    <Text
                      c="var(--app-text)"
                      size="sm"
                      style={{ whiteSpace: 'pre-wrap' }}
                    >
                      {trace.rewrittenQuery ?? t('trace.rewriteSameAsOriginal')}
                    </Text>
                  </Stack>
                </div>
              </Stack>
            </Stack>
          </Paper>
        </Stack>
      </div>
    </div>
  );
}

export function TraceDetailSecondaryPanels({
  citations,
  locale,
  sectionIds,
  t,
  trace
}: TraceDetailSecondaryPanelsProps) {
  const rawPromptSnapshot =
    trace.answeringMetadataJson &&
    typeof trace.answeringMetadataJson === 'object' &&
    !Array.isArray(trace.answeringMetadataJson) &&
    typeof trace.answeringMetadataJson.promptSnapshot === 'object' &&
    trace.answeringMetadataJson.promptSnapshot !== null &&
    !Array.isArray(trace.answeringMetadataJson.promptSnapshot)
      ? trace.answeringMetadataJson.promptSnapshot
      : null;
  const promptSnapshot =
    rawPromptSnapshot &&
    typeof rawPromptSnapshot.systemPrompt === 'string' &&
    typeof rawPromptSnapshot.userPrompt === 'string'
      ? {
          systemPrompt: rawPromptSnapshot.systemPrompt,
          userPrompt: rawPromptSnapshot.userPrompt
        }
      : null;
  const rawRetrievalMetadata =
    trace.retrievalMetadataJson &&
    typeof trace.retrievalMetadataJson === 'object' &&
    !Array.isArray(trace.retrievalMetadataJson)
      ? trace.retrievalMetadataJson
      : null;
  const externalSources = normalizeExternalSources(
    rawRetrievalMetadata && 'externalSources' in rawRetrievalMetadata
      ? rawRetrievalMetadata.externalSources
      : null
  );

  return (
    <div className="workspace-detail-secondary-grid">
      <Paper
        className="workspace-panel-hover workspace-panel-muted"
        id={sectionIds.citations}
        p="lg"
        radius="xl"
        style={{ scrollMarginTop: '96px' }}
      >
        <Stack gap="md">
          <Group justify="space-between">
            <Text className="workspace-section-heading">
              {t('trace.citations')}
            </Text>
            <Badge variant="light">{citations.length}</Badge>
          </Group>

          {citations.length > 0 ? (
            <div className="workspace-collection-grid">
              {citations.map((citation) => (
                <Paper
                  className="workspace-citation-card"
                  key={citation.chunkId}
                  p="md"
                  radius="lg"
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.06)'
                  }}
                >
                  <Stack gap="xs">
                    <Group justify="space-between" align="flex-start">
                      <Anchor
                        component={Link}
                        fw={600}
                        to={buildDocumentChunkLink(
                          citation.documentId,
                          citation.chunkId,
                          {
                            traceId: trace.id,
                            isCited: true
                          }
                        )}
                      >
                        <Text c="var(--app-text)" fw={600} span>
                          {citation.documentTitle}
                        </Text>
                      </Anchor>
                      <span className="workspace-inline-chip">
                        {citation.chunkId}
                      </span>
                    </Group>
                    <Text c="var(--app-text-muted)" size="sm">
                      {citation.sectionTitle ?? t('common.misc.noSection')}
                      {citation.pageNo != null
                        ? ` / ${t('common.misc.pageLong', { pageNo: citation.pageNo })}`
                        : ''}
                    </Text>
                    <div className="workspace-content-block">
                      <Text
                        c="var(--app-text-secondary)"
                        size="sm"
                        style={{ whiteSpace: 'pre-wrap' }}
                      >
                        {citation.snippet}
                      </Text>
                    </div>
                  </Stack>
                </Paper>
              ))}
            </div>
          ) : (
            <StatePanel
              description={t('trace.noCitations')}
              title={t('trace.citations')}
            />
          )}
        </Stack>
      </Paper>

      <Paper
        className="workspace-panel-hover workspace-panel-muted"
        p="lg"
        radius="xl"
      >
        <details open={false}>
          <summary className="workspace-collapsible-summary">
            <span>{locale === 'zh' ? '外部来源' : 'External sources'}</span>
            <span className="workspace-inline-chip workspace-inline-chip-secondary">
              {externalSources.length}
            </span>
          </summary>
          <Text c="var(--app-text-muted)" mt="sm" size="sm">
            {locale === 'zh'
              ? '展示这条 trace 实际进入 answering 的显式来源。'
              : 'Shows the explicit sources that actually entered answering for this trace.'}
          </Text>
          {externalSources.length > 0 ? (
            <Stack gap="xs" mt="sm">
              {externalSources.map((source) => (
                <div className="workspace-content-block" key={source.url}>
                  <Stack gap={4}>
                    <Text
                      c="var(--app-text)"
                      fw={600}
                      size="sm"
                      style={{ whiteSpace: 'pre-wrap' }}
                    >
                      {source.title ?? source.url}
                    </Text>
                    <Text c="var(--app-text-muted)" size="xs">
                      {source.kind} · {source.url}
                    </Text>
                    {source.diagnostics != null ? (
                      <pre
                        className="workspace-code-block workspace-code-block-scroll"
                        style={{ marginTop: '0.5rem' }}
                      >
                        {formatJson(source.diagnostics)}
                      </pre>
                    ) : null}
                  </Stack>
                </div>
              ))}
            </Stack>
          ) : (
            <Text c="var(--app-text-muted)" mt="sm" size="sm">
              {locale === 'zh'
                ? '当前 trace 没有显式外部来源。'
                : 'This trace does not include explicit external sources.'}
            </Text>
          )}
        </details>

        {promptSnapshot ? (
          <details open={false}>
            <summary className="workspace-collapsible-summary">
              <span>{locale === 'zh' ? '回答 Prompt' : 'Answer prompt'}</span>
              <span className="workspace-inline-chip workspace-inline-chip-secondary">
                {locale === 'zh' ? '本次请求快照' : 'Request snapshot'}
              </span>
            </summary>
            <Text c="var(--app-text-muted)" mt="sm" size="sm">
              {locale === 'zh'
                ? '这里展示本次实际发送给模型的 system prompt 和 user prompt。'
                : 'This shows the system prompt and user prompt sent for this answer.'}
            </Text>
            <Stack gap="sm" mt="sm">
              <div className="workspace-content-block">
                <Stack gap={6}>
                  <Text c="var(--app-text-muted)" size="xs">
                    System prompt
                  </Text>
                  <pre className="workspace-code-block workspace-code-block-scroll">
                    {promptSnapshot.systemPrompt}
                  </pre>
                </Stack>
              </div>
              <div className="workspace-content-block">
                <Stack gap={6}>
                  <Text c="var(--app-text-muted)" size="xs">
                    User prompt
                  </Text>
                  <pre className="workspace-code-block workspace-code-block-scroll">
                    {promptSnapshot.userPrompt}
                  </pre>
                </Stack>
              </div>
            </Stack>
          </details>
        ) : null}

        <details
          id={sectionIds.rawPayload}
          style={{ scrollMarginTop: '96px' }}
          open={false}
        >
          <summary className="workspace-collapsible-summary">
            <span>{t('common.fields.rawPayload')}</span>
            <span className="workspace-inline-chip workspace-inline-chip-secondary">
              {locale === 'zh' ? '仅开发调试使用' : 'For development only'}
            </span>
          </summary>
          <Text c="var(--app-text-muted)" mt="sm" size="sm">
            {locale === 'zh'
              ? '原始 trace 数据，仅在需要深度调试时查看。'
              : 'Raw trace payload, only for deep debugging purposes.'}
          </Text>
          <pre
            className="workspace-code-block workspace-code-block-scroll"
            style={{ marginTop: '0.9rem' }}
          >
            {formatJson(buildRawPayload(trace))}
          </pre>
        </details>
      </Paper>
    </div>
  );
}
