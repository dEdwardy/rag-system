import {
  Alert,
  Anchor,
  Badge,
  Button,
  Group,
  Loader,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Title
} from '@mantine/core';
import { useDeferredValue, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { StatePanel } from '../../components/StatePanel';
import {
  useLatestConversationTraces,
  usePagedConversations
} from '../../features/api/hooks';
import { useI18n } from '../../i18n/I18nProvider';
import type { TraceRecord } from '../../types/api';
import { routeShortcutLabels } from '../reports/route-view-helpers';
import { TraceRouteFilterPanel } from './TraceRouteFilterPanel';
import { matchesTraceRouteFilter } from './trace-route-helpers';

const TRACE_PAGE_SIZE = 12;

function looksLikeUntranslatedKey(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  return /^[A-Z0-9_.-]+$/.test(value.trim());
}

function GroupLoader() {
  const { t } = useI18n();

  return (
    <Stack aria-live="polite" gap={6} role="status">
      <Loader color="indigo" size="sm" />
      <Text c="var(--app-text-muted)" size="xs">
        {t('trace.copy.loadingLatestTrace')}
      </Text>
    </Stack>
  );
}

function TraceConversationCard({
  conversationTitle,
  latestTrace
}: {
  conversationTitle: string;
  latestTrace: TraceRecord;
}) {
  const { formatDateTime, locale, t } = useI18n();
  const traceSummary = latestTrace.traceSummary;
  const routeDecision = traceSummary.routeDecisionSummary;
  const executionMode = traceSummary.executionMode;
  const executionSteps = traceSummary.executionPlan?.steps ?? null;
  const timing = traceSummary.timingSummary;
  const rewriteAppliedLabel = locale === 'zh' ? '已改写' : 'Rewrite applied';
  const rewriteNotAppliedLabel = locale === 'zh' ? '未改写' : 'No rewrite';
  const rewriteLabel = !looksLikeUntranslatedKey(
    traceSummary?.rewriteReadabilityLabel
  )
    ? traceSummary?.rewriteReadabilityLabel
    : null;
  const rewriteSkipLabel = !looksLikeUntranslatedKey(
    traceSummary?.rewriteSkippedReason
  )
    ? traceSummary?.rewriteSkippedReason
    : null;
  const latencyLabel =
    latestTrace.latencyMs != null
      ? `${latestTrace.latencyMs} ms`
      : t('trace.copy.modelUnknown');
  const candidateLabel =
    traceSummary?.candidateCountReadabilityLabel ??
    `${latestTrace.retrievalScoresJson?.length ?? 0} ${t('trace.copy.citations')}`;
  const bottleneck =
    timing != null
      ? [
          { label: t('trace.copy.firstToken'), value: timing.firstTokenMs },
          {
            label: t('trace.copy.answerGeneration'),
            value: timing.answerGenerationMs
          },
          { label: t('trace.copy.retrieval'), value: timing.retrievalMs }
        ]
          .filter(
            (item): item is { label: string; value: number } =>
              typeof item.value === 'number'
          )
          .reduce(
            (current, item) => (item.value > current.value ? item : current),
            { label: '', value: -1 }
          )
      : null;

  return (
    <Paper
      className="workspace-citation-card workspace-panel-muted"
      p="lg"
      radius="xl"
    >
      <Stack gap="md">
        <Group align="flex-start" justify="space-between" wrap="nowrap">
          <Stack gap={8}>
            <div>
              <Text c="var(--app-text)" fw={700} size="sm">
                {conversationTitle}
              </Text>
              <Text
                c="var(--app-text-secondary)"
                lineClamp={2}
                mt={6}
                size="sm"
              >
                {latestTrace.userQuery}
              </Text>
            </div>
            <Group gap="xs">
              <Badge
                color={latestTrace.status === 'success' ? 'teal' : 'red'}
                radius="sm"
                variant="light"
              >
                {latestTrace.status}
              </Badge>
              <Badge color="gray" radius="sm" variant="light">
                {latestTrace.modelName ?? t('trace.copy.modelUnknown')}
              </Badge>
            </Group>
          </Stack>
          <Text c="var(--app-text-muted)" size="xs">
            {formatDateTime(latestTrace.createdAt)}
          </Text>
        </Group>

        <div className="workspace-meta-list">
          <div className="workspace-meta-row">
            <span className="workspace-meta-label">
              {t('trace.copy.latestResult')}
            </span>
            <span className="workspace-meta-value">
              {latestTrace.status === 'success'
                ? t('trace.copy.latestResultSuccess')
                : t('trace.copy.latestResultNeedsInspection')}
            </span>
          </div>
          <div className="workspace-meta-row">
            <span className="workspace-meta-label">
              {t('trace.copy.traceId')}
            </span>
            <span className="workspace-meta-value">{latestTrace.id}</span>
          </div>
          <div className="workspace-meta-row">
            <span className="workspace-meta-label">
              {t('common.fields.latency')}
            </span>
            <span className="workspace-meta-value">{latencyLabel}</span>
          </div>
          <div className="workspace-meta-row">
            <span className="workspace-meta-label">{rewriteAppliedLabel}</span>
            <span className="workspace-meta-value">
              {rewriteLabel ??
                (latestTrace.rewrittenQuery
                  ? rewriteAppliedLabel
                  : rewriteNotAppliedLabel)}
            </span>
          </div>
          {rewriteSkipLabel ? (
            <div className="workspace-meta-row">
              <span className="workspace-meta-label">
                {rewriteNotAppliedLabel}
              </span>
              <span className="workspace-meta-value">{rewriteSkipLabel}</span>
            </div>
          ) : null}
          <div className="workspace-meta-row">
            <span className="workspace-meta-label">
              {t('trace.copy.latestResult')}
            </span>
            <span className="workspace-meta-value">{candidateLabel}</span>
          </div>
          <div className="workspace-meta-row">
            <span className="workspace-meta-label">
              {locale === 'zh' ? '路由决策' : 'Route decision'}
            </span>
            {routeDecision ? (
              <span className="workspace-meta-value">
                <Badge color="indigo" radius="sm" variant="light">
                  {routeShortcutLabels[routeDecision.routeType] ??
                    routeDecision.routeType}
                </Badge>
                <span className="ml-2">
                  {locale === 'zh' ? '原因' : 'Reason'}:{' '}
                  {routeDecision.routeReason}
                </span>
              </span>
            ) : (
              <span className="workspace-meta-value">
                {locale === 'zh' ? '暫無路由信息' : 'No route metadata'}
              </span>
            )}
          </div>
          {executionSteps && executionSteps.length > 0 ? (
            <div className="workspace-meta-row">
              <span className="workspace-meta-label">
                {locale === 'zh' ? '执行步骤' : 'Execution steps'}
              </span>
              <Group className="workspace-meta-value" gap="xs" wrap="wrap">
                <Badge
                  color={executionMode === 'workflow' ? 'blue' : 'gray'}
                  radius="sm"
                  variant="light"
                >
                  {executionMode ?? 'manual'}
                </Badge>
                <Text span>{executionSteps.length}</Text>
              </Group>
            </div>
          ) : null}
          {routeDecision?.routeType === 'external_source' ? (
            <div className="workspace-meta-row">
              <span className="workspace-meta-label">
                {locale === 'zh' ? '外部来源' : 'External sources'}
              </span>
              <span className="workspace-meta-value">
                {traceSummary.retrievedChunkCount}{' '}
                {locale === 'zh' ? '个来源块' : 'source chunks'}
              </span>
            </div>
          ) : null}
          {bottleneck && bottleneck.value >= 0 ? (
            <div className="workspace-meta-row">
              <span className="workspace-meta-label">
                {locale === 'zh' ? '最慢阶段' : 'Slowest stage'}
              </span>
              <span className="workspace-meta-value">
                {bottleneck.label} 路 {bottleneck.value} ms
              </span>
            </div>
          ) : null}
        </div>

        <Stack gap="xs">
          <Anchor
            c="var(--app-text)"
            component={Link}
            fw={600}
            size="sm"
            to={`/traces/${latestTrace.id}`}
          >
            {t('trace.copy.viewTraceDetails')}
          </Anchor>
          <Anchor c="var(--app-text-muted)" component={Link} size="sm" to="/">
            {t('trace.copy.backToChat')}
          </Anchor>
        </Stack>
      </Stack>
    </Paper>
  );
}

export function TraceListPage() {
  const { t, locale } = useI18n();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const requestedPage = Number(searchParams.get('page') ?? '1');
  const routeTypeFilter = searchParams.get('routeType');
  const routeReasonFilter = searchParams.get('routeReason');
  const safeRequestedPage =
    Number.isFinite(requestedPage) && requestedPage > 0
      ? Math.floor(requestedPage)
      : 1;
  const conversationsQuery = usePagedConversations({
    page: safeRequestedPage,
    limit: TRACE_PAGE_SIZE
  });
  const deferredConversations = useDeferredValue(
    conversationsQuery.data?.items ?? []
  );
  const conversationCount = conversationsQuery.data?.total ?? 0;
  const totalPages = conversationsQuery.data?.totalPages ?? 1;
  const resolvedPage = Math.min(safeRequestedPage, totalPages);
  const pageStart = (resolvedPage - 1) * TRACE_PAGE_SIZE;
  const pagedConversations = useMemo(
    () => deferredConversations,
    [deferredConversations]
  );
  const conversationIds = useMemo(
    () => pagedConversations.map((conversation) => conversation.id),
    [pagedConversations]
  );
  const latestTracesQuery = useLatestConversationTraces(
    conversationIds,
    conversationsQuery.isSuccess
  );
  const traceErrorMessage =
    latestTracesQuery.error instanceof Error
      ? latestTracesQuery.error.message
      : t('trace.copy.loadTracesError');
  const traceCards =
    pagedConversations.flatMap((conversation) => {
      const latestTrace =
        latestTracesQuery.latestTraceByConversationId[conversation.id] ?? null;
      return latestTrace ? [{ conversation, latestTrace }] : [];
    }) ?? [];
  const filteredTraceCards = traceCards.filter(({ latestTrace }) => {
    return matchesTraceRouteFilter(
      latestTrace,
      routeTypeFilter,
      routeReasonFilter
    );
  });
  const visibleStart = conversationCount === 0 ? 0 : pageStart + 1;
  const visibleEnd = Math.min(
    pageStart + pagedConversations.length,
    conversationCount
  );
  const paginationSummary =
    locale === 'zh'
      ? `显示第 ${visibleStart}-${visibleEnd} 条，共 ${conversationCount} 个会话`
      : `Showing ${visibleStart}-${visibleEnd} of ${conversationCount} conversations`;

  const buildSearchHref = (nextSearchParams: URLSearchParams) => {
    const search = nextSearchParams.toString();
    return search.length === 0 ? '/traces' : `/traces?${search}`;
  };

  const buildPageHref = (page: number) => {
    const nextSearchParams = new URLSearchParams(location.search);
    if (page <= 1) {
      nextSearchParams.delete('page');
    } else {
      nextSearchParams.set('page', String(page));
    }

    return buildSearchHref(nextSearchParams);
  };

  return (
    <Stack data-testid="traces-page" gap="md">
      <Paper className="workspace-hero" p="lg" radius="xl">
        <div className="workspace-hero-split">
          <div className="workspace-hero-copy">
            <Text
              className="workspace-link"
              component={Link}
              size="sm"
              to="/workbench"
            >
              {t('common.actions.backToWorkbench')}
            </Text>
            <Text className="workspace-hero-kicker">Workbench</Text>
            <Title
              order={3}
              c="var(--app-text)"
              style={{
                fontFamily: 'var(--app-font-display)',
                letterSpacing: '-0.03em'
              }}
            >
              {t('trace.copy.traceHeading')}
            </Title>
            <Text c="var(--app-text-muted)" mt={4} size="sm">
              {t('trace.copy.traceDescription')}
            </Text>
            <TraceRouteFilterPanel
              routeReasonFilter={routeReasonFilter}
              routeTypeFilter={routeTypeFilter}
            />
          </div>
          <Stack align="flex-end" gap={10}>
            <Badge color="indigo" radius="sm" variant="light">
              {conversationCount}
            </Badge>
            <Text className="workspace-hero-sidecopy" ta="right">
              {t('trace.copy.traceSidecopy')}
            </Text>
          </Stack>
        </div>
      </Paper>

      {conversationsQuery.isLoading ? (
        <div
          aria-live="polite"
          className="workspace-loading-grid"
          role="status"
        >
          {Array.from({ length: 4 }).map((_, index) => (
            <Paper
              className="workspace-panel-hover workspace-skeleton-panel"
              key={index}
              p="lg"
              radius="xl"
            >
              <Stack gap="md">
                <div className="workspace-skeleton-line medium" />
                <div className="workspace-skeleton-line short" />
                <div className="workspace-skeleton-line long" />
                <div className="workspace-skeleton-line medium" />
              </Stack>
            </Paper>
          ))}
          <span className="sr-only">
            {t('trace.copy.loadingConversations')}
          </span>
        </div>
      ) : conversationsQuery.isError ? (
        <StatePanel
          description={
            conversationsQuery.error instanceof Error
              ? conversationsQuery.error.message
              : undefined
          }
          title={t('trace.copy.conversationsError')}
          tone="error"
        />
      ) : conversationCount > 0 ? (
        <div className="workspace-trace-list">
          {latestTracesQuery.isLoading ? (
            <Paper className="workspace-panel-muted" mb="md" p="lg" radius="xl">
              <GroupLoader />
            </Paper>
          ) : null}
          {latestTracesQuery.isError ? (
            <Alert color="red" mb="md" radius="lg" variant="light">
              {t('trace.copy.partialLoadError', {
                count: latestTracesQuery.failedConversationCount,
                error: traceErrorMessage
              })}
            </Alert>
          ) : null}
          <div
            className={
              pagedConversations.length === 1
                ? 'workspace-list-shell-compact'
                : undefined
            }
          >
            <SimpleGrid
              cols={{ base: 1, lg: pagedConversations.length > 1 ? 2 : 1 }}
              spacing="md"
            >
              {filteredTraceCards.map(({ conversation, latestTrace }) => (
                <TraceConversationCard
                  conversationTitle={conversation.title}
                  latestTrace={latestTrace}
                  key={conversation.id}
                />
              ))}
            </SimpleGrid>
          </div>
          {totalPages > 1 ? (
            <Paper className="workspace-panel-muted" mt="md" p="lg" radius="xl">
              <Stack gap="sm">
                <Group align="center" justify="space-between" wrap="wrap">
                  <Text c="var(--app-text-muted)" size="sm">
                    {paginationSummary}
                  </Text>
                  <Group gap="xs" wrap="wrap">
                    <Button
                      className="workspace-button"
                      color="gray"
                      component={Link}
                      disabled={resolvedPage <= 1}
                      to={buildPageHref(resolvedPage - 1)}
                      radius="xl"
                      size="xs"
                      variant="light"
                    >
                      {locale === 'zh' ? '上一页' : 'Previous'}
                    </Button>
                    <Button
                      className="workspace-button"
                      color="gray"
                      component={Link}
                      disabled={resolvedPage >= totalPages}
                      to={buildPageHref(resolvedPage + 1)}
                      radius="xl"
                      size="xs"
                      variant="light"
                    >
                      {locale === 'zh' ? '下一页' : 'Next'}
                    </Button>
                  </Group>
                </Group>
                <Group gap="xs" wrap="wrap">
                  {Array.from({ length: totalPages }, (_, index) => {
                    const page = index + 1;
                    return (
                      <Button
                        className="workspace-button"
                        color={page === resolvedPage ? 'indigo' : 'gray'}
                        component={Link}
                        key={page}
                        radius="xl"
                        size="xs"
                        to={buildPageHref(page)}
                        variant={page === resolvedPage ? 'filled' : 'light'}
                      >
                        {page}
                      </Button>
                    );
                  })}
                </Group>
              </Stack>
            </Paper>
          ) : null}
        </div>
      ) : (
        <StatePanel
          description={t('trace.copy.noConversationsDescription')}
          title={t('trace.copy.noConversationsTitle')}
        />
      )}

      <Button
        className="workspace-button"
        color="indigo"
        component={Link}
        radius="xl"
        to="/workbench"
        variant="light"
        w="fit-content"
      >
        {t('common.actions.backToWorkbench')}
      </Button>
    </Stack>
  );
}
