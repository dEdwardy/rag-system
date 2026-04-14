import { Alert, Badge, Button, Group, Paper, Stack, Text } from '@mantine/core';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { StatePanel } from '../../components/StatePanel';
import { useDocumentChunks } from '../../features/api/hooks';
import { useI18n } from '../../i18n/I18nProvider';
import type { JsonValue } from '../../types/api';

type DocumentDetailChunksPanelProps = {
  documentId: string;
  focusedChunkId: string | null;
  focusedIsCited: boolean;
  focusedIsPrimary: string | null;
  focusedRank: string | null;
  focusedScore: string | null;
  sourceTraceId: string | null;
  traceReturnHref: string | null;
};

function formatJson(value: JsonValue | unknown) {
  if (value == null) {
    return 'null';
  }

  return JSON.stringify(value, null, 2);
}

const CHUNK_PAGE_SIZE = 20;

export function DocumentDetailChunksPanel({
  documentId,
  focusedChunkId,
  focusedIsCited,
  focusedIsPrimary,
  focusedRank,
  focusedScore,
  sourceTraceId,
  traceReturnHref
}: DocumentDetailChunksPanelProps) {
  const chunksQuery = useDocumentChunks(documentId);
  const chunkRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const { locale, t } = useI18n();
  const [page, setPage] = useState(1);
  const chunks = chunksQuery.data ?? [];
  const totalPages = Math.max(1, Math.ceil(chunks.length / CHUNK_PAGE_SIZE));
  const resolvedPage = Math.min(page, totalPages);
  const pageStart = (resolvedPage - 1) * CHUNK_PAGE_SIZE;
  const pagedChunks = useMemo(
    () => chunks.slice(pageStart, pageStart + CHUNK_PAGE_SIZE),
    [chunks, pageStart]
  );
  const visibleStart = chunks.length === 0 ? 0 : pageStart + 1;
  const visibleEnd = Math.min(pageStart + pagedChunks.length, chunks.length);
  const paginationSummary =
    locale === 'zh'
      ? `显示第 ${visibleStart}-${visibleEnd} 个切片，共 ${chunks.length} 个`
      : `Showing ${visibleStart}-${visibleEnd} of ${chunks.length} chunks`;

  useEffect(() => {
    if (!focusedChunkId || chunks.length === 0) {
      return;
    }

    const targetIndex = chunks.findIndex(
      (chunk) => chunk.id === focusedChunkId
    );
    if (targetIndex === -1) {
      return;
    }

    const targetPage = Math.floor(targetIndex / CHUNK_PAGE_SIZE) + 1;
    if (targetPage !== resolvedPage) {
      setPage(targetPage);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      chunkRefs.current[focusedChunkId]?.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }, 50);

    return () => window.clearTimeout(timeoutId);
  }, [chunks, focusedChunkId, resolvedPage]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  return (
    <Paper
      className="workspace-panel-hover workspace-panel-strong"
      p="lg"
      radius="xl"
    >
      <Stack gap="md">
        <Group justify="space-between" wrap="nowrap">
          <div>
            <Text className="workspace-section-heading">
              {t('documents.detail.chunksTitle')}
            </Text>
            <Text className="workspace-section-copy">
              {t('documents.detail.chunkListCopy')}
            </Text>
          </div>
          <Badge color="indigo" variant="light">
            {chunks.length}
          </Badge>
        </Group>

        {chunksQuery.isLoading ? (
          <StatePanel
            description={t('documents.detail.subtitle')}
            title={t('documents.detail.chunksTitle')}
            tone="loading"
          />
        ) : null}
        {chunksQuery.isError ? (
          <Alert color="red" radius="xl" variant="light">
            {chunksQuery.error instanceof Error
              ? chunksQuery.error.message
              : t('documents.detail.chunksLoadError')}
          </Alert>
        ) : null}

        {focusedChunkId && sourceTraceId ? (
          <Paper className="workspace-focus-banner" p="md" radius="xl">
            <Stack gap={6}>
              <Text c="var(--app-text)" fw={700} size="sm">
                {t('documents.detail.traceFocusTitle')}
              </Text>
              <Text c="var(--app-text-secondary)" size="sm">
                {t('documents.detail.traceFocusDescription', {
                  traceId: sourceTraceId
                })}
              </Text>
              <Group gap="xs">
                {focusedRank ? (
                  <Badge variant="light">
                    {t('documents.detail.traceRankLabel', {
                      rank: focusedRank
                    })}
                  </Badge>
                ) : null}
                {focusedScore ? (
                  <Badge color="blue" variant="light">
                    {t('documents.detail.traceScoreLabel', {
                      score: focusedScore
                    })}
                  </Badge>
                ) : null}
                {focusedIsPrimary === '1' ? (
                  <Badge color="indigo" variant="light">
                    {t('documents.detail.tracePrimary')}
                  </Badge>
                ) : focusedIsPrimary === '0' ? (
                  <Badge color="gray" variant="light">
                    {t('documents.detail.traceNeighbor')}
                  </Badge>
                ) : null}
                {focusedIsCited ? (
                  <Badge color="blue" variant="light">
                    {t('documents.detail.traceCited')}
                  </Badge>
                ) : null}
              </Group>
              <Text c="var(--app-text-muted)" size="sm">
                {t('documents.detail.traceFocusNextStep')}
              </Text>
              <div className="workspace-meta-list">
                <div className="workspace-meta-row">
                  <span className="workspace-meta-label">
                    {t('documents.detail.traceFocusReviewHeading')}
                  </span>
                  <span className="workspace-meta-value">
                    {t('documents.detail.traceFocusReviewChunk')}
                  </span>
                </div>
                <div className="workspace-meta-row">
                  <span className="workspace-meta-label">2</span>
                  <span className="workspace-meta-value">
                    {t('documents.detail.traceFocusReviewSelection')}
                  </span>
                </div>
                <div className="workspace-meta-row">
                  <span className="workspace-meta-label">3</span>
                  <span className="workspace-meta-value">
                    {t('documents.detail.traceFocusReviewReturn')}
                  </span>
                </div>
              </div>
              <Group gap="xs">
                {traceReturnHref ? (
                  <Button
                    className="workspace-button"
                    color="indigo"
                    component={Link}
                    radius="xl"
                    size="xs"
                    to={traceReturnHref}
                    variant="light"
                  >
                    {t('documents.detail.backToTrace')}
                  </Button>
                ) : null}
                <Button
                  className="workspace-button"
                  color="gray"
                  component={Link}
                  radius="xl"
                  size="xs"
                  to="/documents"
                  variant="light"
                >
                  {locale === 'zh' ? '回到资料库' : 'Back to library'}
                </Button>
              </Group>
            </Stack>
          </Paper>
        ) : null}

        {chunks.length > CHUNK_PAGE_SIZE ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-[var(--app-border)] bg-[var(--app-bg)] px-4 py-3">
            <Text className="workspace-section-copy">{paginationSummary}</Text>
            <Group gap="xs">
              <Button
                className="workspace-button"
                color="gray"
                disabled={resolvedPage <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                radius="xl"
                size="xs"
                variant="light"
              >
                {locale === 'zh' ? '上一页' : 'Previous'}
              </Button>
              <Badge color="indigo" variant="light">
                {locale === 'zh'
                  ? `第 ${resolvedPage}/${totalPages} 页`
                  : `Page ${resolvedPage}/${totalPages}`}
              </Badge>
              <Button
                className="workspace-button"
                color="gray"
                disabled={resolvedPage >= totalPages}
                onClick={() =>
                  setPage((current) => Math.min(totalPages, current + 1))
                }
                radius="xl"
                size="xs"
                variant="light"
              >
                {locale === 'zh' ? '下一页' : 'Next'}
              </Button>
            </Group>
          </div>
        ) : null}

        <div className="workspace-collection-grid">
          {pagedChunks.map((chunk) => (
            <Paper
              className="workspace-panel-hover"
              key={chunk.id}
              p="md"
              radius="lg"
              ref={(node) => {
                chunkRefs.current[chunk.id] = node;
              }}
              style={{
                background:
                  focusedChunkId === chunk.id
                    ? 'linear-gradient(180deg, rgba(99, 102, 241, 0.16) 0%, rgba(99, 102, 241, 0.08) 100%)'
                    : 'linear-gradient(180deg, rgba(30, 30, 38, 0.96) 0%, rgba(24, 24, 31, 0.98) 100%)',
                border:
                  focusedChunkId === chunk.id
                    ? '1px solid rgba(99, 102, 241, 0.32)'
                    : '1px solid rgba(255,255,255,0.06)',
                boxShadow:
                  focusedChunkId === chunk.id
                    ? '0 18px 36px rgba(99, 102, 241, 0.16)'
                    : '0 12px 24px rgba(0, 0, 0, 0.14), inset 0 1px 0 rgba(255,255,255,0.02)'
              }}
            >
              <Stack gap="sm">
                <Group align="flex-start" justify="space-between" wrap="nowrap">
                  <Stack gap={8}>
                    <Group gap="xs">
                      <Badge color="indigo" variant="light">
                        #{chunk.chunkIndex}
                      </Badge>
                      {focusedChunkId === chunk.id ? (
                        <Badge color="indigo" variant="filled">
                          {t('common.misc.focused')}
                        </Badge>
                      ) : null}
                      {focusedChunkId === chunk.id &&
                      focusedIsPrimary === '1' ? (
                        <Badge color="indigo" variant="light">
                          {t('documents.detail.tracePrimary')}
                        </Badge>
                      ) : null}
                      {focusedChunkId === chunk.id &&
                      focusedIsPrimary === '0' ? (
                        <Badge color="gray" variant="light">
                          {t('documents.detail.traceNeighbor')}
                        </Badge>
                      ) : null}
                      {focusedChunkId === chunk.id && focusedIsCited ? (
                        <Badge color="blue" variant="light">
                          {t('documents.detail.traceCited')}
                        </Badge>
                      ) : null}
                      {focusedChunkId === chunk.id && focusedRank ? (
                        <Badge variant="light">
                          {t('documents.detail.traceRankLabel', {
                            rank: focusedRank
                          })}
                        </Badge>
                      ) : null}
                      {chunk.pageNo != null ? (
                        <Badge color="blue" variant="light">
                          {t('common.misc.pageShort', { pageNo: chunk.pageNo })}
                        </Badge>
                      ) : null}
                    </Group>

                    {chunk.sectionTitle ? (
                      <Text c="var(--app-text)" fw={600}>
                        {chunk.sectionTitle}
                      </Text>
                    ) : null}
                  </Stack>

                  <Text c="var(--app-text-muted)" size="xs">
                    {chunk.id}
                  </Text>
                </Group>

                <div className="workspace-content-block">
                  <Stack gap={8}>
                    <Text c="var(--app-text-muted)" size="xs">
                      {t('common.misc.tokenCount')}: {chunk.tokenCount}
                    </Text>
                    <Text
                      c="var(--app-text-secondary)"
                      size="sm"
                      style={{ whiteSpace: 'pre-wrap' }}
                    >
                      {chunk.content}
                    </Text>
                  </Stack>
                </div>

                {chunk.metadataJson ? (
                  <pre className="workspace-code-block workspace-code-block-scroll">
                    {formatJson(chunk.metadataJson)}
                  </pre>
                ) : null}
              </Stack>
            </Paper>
          ))}
        </div>

        {chunks.length === 0 ? (
          <StatePanel
            description={t('documents.detail.noChunks')}
            title={t('documents.detail.chunksTitle')}
          />
        ) : null}
        {focusedChunkId &&
        chunks.length > 0 &&
        !chunks.some((chunk) => chunk.id === focusedChunkId) ? (
          <Alert color="yellow" radius="xl" variant="light">
            {t('documents.detail.linkedChunkMissing')}
          </Alert>
        ) : null}
        {sourceTraceId ? (
          <Text c="var(--app-text-muted)" size="sm">
            <Text
              className="workspace-link"
              component={Link}
              inherit
              to={traceReturnHref ?? `/traces/${sourceTraceId}`}
            >
              {t('documents.detail.backToTrace')}
            </Text>
          </Text>
        ) : null}
      </Stack>
    </Paper>
  );
}
