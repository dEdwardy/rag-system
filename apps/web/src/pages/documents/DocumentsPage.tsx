import {
  Alert,
  Badge,
  Box,
  Button,
  FileButton,
  Group,
  Paper,
  Stack,
  Table,
  Text,
  Title
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { StatePanel } from '../../components/StatePanel';
import {
  useDeleteDocument,
  useKnowledgeBaseDocumentSummary,
  useKnowledgeBases,
  usePagedDocuments,
  useReindexDocument,
  useUploadDocument,
  useUploadDocuments
} from '../../features/api/hooks';
import { getPrimaryKnowledgeBase } from '../../features/api/workspace-selection';
import { useI18n } from '../../i18n/I18nProvider';
import {
  buildChatStarterQuestionHref,
  buildStarterQuestions
} from '../chat/chat-page-helpers';

const DOCUMENTS_PAGE_SIZE = 20;

export function DocumentsPage() {
  const knowledgeBasesQuery = useKnowledgeBases();
  const activeKnowledgeBase = getPrimaryKnowledgeBase(knowledgeBasesQuery.data);
  const hasActiveKnowledgeBase = activeKnowledgeBase != null;
  const [page, setPage] = useState(1);
  const documentsQuery = usePagedDocuments(
    activeKnowledgeBase?.id ?? '',
    { page, limit: DOCUMENTS_PAGE_SIZE },
    hasActiveKnowledgeBase
  );
  const documentsSummaryQuery = useKnowledgeBaseDocumentSummary(
    activeKnowledgeBase?.id ?? '',
    hasActiveKnowledgeBase
  );
  const uploadMutation = useUploadDocument(activeKnowledgeBase?.id ?? '');
  const uploadBatchMutation = useUploadDocuments(activeKnowledgeBase?.id ?? '');
  const reindexMutation = useReindexDocument();
  const deleteMutation = useDeleteDocument();
  const [isDragging, setIsDragging] = useState(false);
  const { t, locale, formatDateTime } = useI18n();

  const pagedDocuments = documentsQuery.data;
  const documents = useMemo(
    () => pagedDocuments?.items ?? [],
    [pagedDocuments]
  );
  const isDocumentsLoading =
    documentsQuery.isLoading && !documentsQuery.isError;
  const summary = documentsSummaryQuery.data ?? {
    totalDocuments: 0,
    readyDocuments: 0,
    processingDocuments: 0,
    failedDocuments: 0,
    totalChunks: 0
  };
  const documentCount = summary.totalDocuments;
  const readyCount = summary.readyDocuments;
  const processingCount = summary.processingDocuments;
  const failedCount = summary.failedDocuments;
  const hasProcessingDocuments = processingCount > 0;
  const totalPages = pagedDocuments?.totalPages ?? 1;
  const visibleStart =
    documentCount === 0 ? 0 : (page - 1) * DOCUMENTS_PAGE_SIZE + 1;
  const visibleEnd =
    documentCount === 0
      ? 0
      : Math.min(page * DOCUMENTS_PAGE_SIZE, documentCount);
  const firstFailedDocument = useMemo(
    () => documents.find((document) => document.status === 'failed') ?? null,
    [documents]
  );
  const firstProcessingDocument = useMemo(
    () =>
      documents.find(
        (document) =>
          document.status === 'pending' || document.status === 'processing'
      ) ?? null,
    [documents]
  );

  useEffect(() => {
    setPage(1);
  }, [activeKnowledgeBase?.id]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const workspaceSurfaceState = useMemo(() => {
    if (!hasActiveKnowledgeBase) {
      return {
        badgeColor: 'gray',
        badgeLabel: t('documents.workspaceStatusNoActiveKnowledgeBase'),
        nextAction: t('documents.workspaceNextActionNoActiveKnowledgeBase'),
        nextActionHref: '/knowledge-base',
        nextActionLabel: t(
          'documents.workspaceNextActionLinkNoActiveKnowledgeBase'
        )
      } as const;
    }

    if (failedCount > 0 && readyCount === 0) {
      return {
        badgeColor: 'red',
        badgeLabel: t('documents.workspaceStatusNeedsAttention'),
        nextAction: t('documents.workspaceNextActionNeedsAttention'),
        nextActionHref: firstFailedDocument
          ? `/documents/${firstFailedDocument.id}`
          : '/documents',
        nextActionLabel: t('documents.workspaceNextActionLinkNeedsAttention')
      } as const;
    }

    if (failedCount > 0) {
      return {
        badgeColor: 'yellow',
        badgeLabel: t('documents.workspaceStatusReadyWithIssues'),
        nextAction: t('documents.workspaceNextActionReadyWithIssues'),
        nextActionHref: '/',
        nextActionLabel: t('documents.workspaceNextActionLinkReady')
      } as const;
    }

    if (hasProcessingDocuments) {
      if (readyCount > 0) {
        return {
          badgeColor: 'yellow',
          badgeLabel: t('documents.workspaceStatusProcessing'),
          nextAction: t('documents.workspaceNextActionProcessingWithReady'),
          nextActionHref: '/',
          nextActionLabel: t('documents.workspaceNextActionLinkReady')
        } as const;
      }

      return {
        badgeColor: 'yellow',
        badgeLabel: t('documents.workspaceStatusProcessing'),
        nextAction: t('documents.workspaceNextActionProcessing'),
        nextActionHref: firstProcessingDocument
          ? `/documents/${firstProcessingDocument.id}`
          : '/documents',
        nextActionLabel: t('documents.workspaceNextActionLinkProcessing')
      } as const;
    }

    return {
      badgeColor: 'indigo',
      badgeLabel: t('documents.workspaceStatusReady'),
      nextAction: t('documents.workspaceNextActionReady'),
      nextActionHref: '/',
      nextActionLabel: t('documents.workspaceNextActionLinkReady')
    } as const;
  }, [
    failedCount,
    firstFailedDocument,
    firstProcessingDocument,
    hasActiveKnowledgeBase,
    hasProcessingDocuments,
    readyCount,
    t
  ]);

  const noActiveKnowledgeBaseStatePanel = (
    <StatePanel
      action={
        <Button
          className="workspace-button"
          color="indigo"
          component={Link}
          radius="xl"
          to="/knowledge-base"
          variant="light"
        >
          {t('documents.noActiveKnowledgeBaseAction')}
        </Button>
      }
      description={t('documents.noActiveKnowledgeBaseDescription')}
      title={t('documents.noActiveKnowledgeBaseTitle')}
    />
  );

  const metricCards = useMemo(
    () => [
      {
        key: 'total',
        label: locale === 'zh' ? '资料总数' : 'Total items',
        value: documentCount,
        subtle:
          locale === 'zh'
            ? '当前资料库中的全部资料项'
            : 'All library items in the current workspace library'
      },
      {
        key: 'ready',
        label: locale === 'zh' ? '可检索' : 'Ready',
        value: readyCount,
        subtle: locale === 'zh' ? '已经可以用于对话' : 'Ready to use in chat'
      },
      {
        key: 'processing',
        label: locale === 'zh' ? '处理中' : 'Processing',
        value: processingCount,
        subtle:
          locale === 'zh' ? '正在导入或更新中' : 'Being added or refreshed'
      },
      {
        key: 'failed',
        label: locale === 'zh' ? '需要关注' : 'Needs attention',
        value: failedCount,
        subtle:
          locale === 'zh'
            ? '有资料项需要重试或清理'
            : 'Some items need retry or cleanup'
      }
    ],
    [documentCount, failedCount, locale, processingCount, readyCount]
  );
  const starterQuestions = useMemo(
    () => buildStarterQuestions(locale, 'documents'),
    [locale]
  );

  const handleUploadFiles = useCallback(
    (files: File[] | FileList | null) => {
      if (
        !files ||
        (Array.isArray(files) ? files.length === 0 : files.length === 0) ||
        !activeKnowledgeBase
      ) {
        return;
      }

      const fileArray = Array.isArray(files) ? files : Array.from(files);
      notifications.show({
        color: 'blue',
        message: t('documents.uploadBatchStart', { count: fileArray.length })
      });

      uploadBatchMutation.mutate(fileArray, {
        onSuccess: () => {
          notifications.show({
            color: 'indigo',
            message: t('documents.uploadBatchSuccess', {
              count: fileArray.length
            })
          });
          setPage(1);
        },
        onError: (error) => {
          notifications.show({
            color: 'red',
            message:
              error instanceof Error
                ? error.message
                : t('documents.uploadBatchError')
          });
        }
      });
    },
    [activeKnowledgeBase, t, uploadBatchMutation]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleUploadFiles(e.dataTransfer.files);
    },
    [handleUploadFiles]
  );

  const handleReindexDocument = useCallback(
    async (documentId: string, knowledgeBaseId: string, title: string) => {
      try {
        await reindexMutation.mutateAsync({
          documentId,
          knowledgeBaseId
        });
        notifications.show({
          color: 'indigo',
          message: t('documents.reindexRequested', { title })
        });
      } catch (error) {
        notifications.show({
          color: 'red',
          message:
            error instanceof Error ? error.message : t('documents.reindexError')
        });
      }
    },
    [reindexMutation, t]
  );

  const handleDeleteDocument = useCallback(
    async (documentId: string, title: string) => {
      const confirmed = window.confirm(
        locale === 'zh'
          ? `确认删除资料“${title}”吗？`
          : `Delete document "${title}"?`
      );

      if (!confirmed) {
        return;
      }

      try {
        await deleteMutation.mutateAsync({ documentId });
        notifications.show({
          color: 'indigo',
          message:
            locale === 'zh'
              ? `已删除资料：${title}`
              : `Deleted document: ${title}`
        });
      } catch (error) {
        notifications.show({
          color: 'red',
          message:
            error instanceof Error
              ? error.message
              : locale === 'zh'
                ? '删除资料失败'
                : 'Failed to delete document'
        });
      }
    },
    [deleteMutation, locale]
  );

  return (
    <Stack data-testid="documents-page" gap="md">
      <Paper className="workspace-hero" p="lg" radius="xl">
        <div className="workspace-hero-split">
          <Group gap="md" wrap="nowrap">
            <Box className="workspace-hero-icon">DOC</Box>
            <div className="workspace-hero-copy">
              <Text className="workspace-hero-kicker">
                {locale === 'zh' ? '资料库' : 'Library'}
              </Text>
              <Title
                order={3}
                c="var(--app-text)"
                style={{
                  fontFamily: 'var(--app-font-display)',
                  letterSpacing: '0'
                }}
              >
                {t('documents.title')}
              </Title>
              <Text c="var(--app-text-muted)" mt={4} size="sm">
                {t('documents.subtitle')}
              </Text>
              <Group gap="xs" mt="sm">
                <Badge color="gray" radius="sm" variant="light">
                  {activeKnowledgeBase?.name ??
                    (locale === 'zh' ? '尚无活动资料库' : 'No active library')}
                </Badge>
                <Badge
                  color={workspaceSurfaceState.badgeColor}
                  radius="sm"
                  variant="light"
                >
                  {workspaceSurfaceState.badgeLabel}
                </Badge>
              </Group>
            </div>
          </Group>

          <Stack align="flex-end" gap={10}>
            <Text className="workspace-hero-sidecopy" ta="right">
              {activeKnowledgeBase
                ? t('documents.currentKnowledgeBaseHintHasKb')
                : t('documents.currentKnowledgeBaseHintNoKb')}
            </Text>
            <Badge color="gray" radius="sm" variant="light">
              {`${t('documents.currentKnowledgeBaseLabel')}: ${activeKnowledgeBase?.name ?? (locale === 'zh' ? '尚无活动资料库' : 'No active library')}`}
            </Badge>
            <Box
              style={{
                position: 'relative',
                width: '100%',
                maxWidth: 300
              }}
            >
              <Paper
                p="lg"
                radius="xl"
                style={{
                  border: isDragging
                    ? '2px dashed var(--mantine-color-indigo-5)'
                    : '2px dashed var(--app-border)',
                  backgroundColor: isDragging
                    ? 'rgba(99, 102, 241, 0.1)'
                    : 'transparent',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.2s ease'
                }}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              >
                <FileButton multiple onChange={handleUploadFiles}>
                  {(props) => (
                    <Button
                      {...props}
                      className="workspace-button"
                      color="indigo"
                      disabled={!hasActiveKnowledgeBase}
                      fullWidth
                      loading={
                        uploadMutation.isPending ||
                        uploadBatchMutation.isPending
                      }
                      radius="xl"
                      variant="light"
                    >
                      {locale === 'zh'
                        ? '选择或拖拽文件'
                        : 'Select or drag files'}
                    </Button>
                  )}
                </FileButton>
                <Text size="sm" c="var(--app-text-muted)" mt="sm">
                  {locale === 'zh'
                    ? '支持多文件上传'
                    : 'Supports multiple files'}
                </Text>
              </Paper>
            </Box>
          </Stack>
        </div>
      </Paper>

      {knowledgeBasesQuery.isError ? (
        <StatePanel
          description={
            knowledgeBasesQuery.error instanceof Error
              ? knowledgeBasesQuery.error.message
              : undefined
          }
          title={t('documents.loadKbError')}
          tone="error"
        />
      ) : null}
      {documentsQuery.isError ? (
        <StatePanel
          description={
            documentsQuery.error instanceof Error
              ? documentsQuery.error.message
              : undefined
          }
          title={t('documents.loadDocumentsError')}
          tone="error"
        />
      ) : null}
      {documentsSummaryQuery.isError ? (
        <StatePanel
          description={
            documentsSummaryQuery.error instanceof Error
              ? documentsSummaryQuery.error.message
              : undefined
          }
          title={t('documents.loadDocumentsError')}
          tone="error"
        />
      ) : null}
      {uploadMutation.isError ? (
        <Alert color="red" radius="xl" variant="light">
          {uploadMutation.error instanceof Error
            ? uploadMutation.error.message
            : t('documents.uploadError')}
        </Alert>
      ) : null}
      {uploadBatchMutation.isError ? (
        <Alert color="red" radius="xl" variant="light">
          {uploadBatchMutation.error instanceof Error
            ? uploadBatchMutation.error.message
            : t('documents.uploadBatchError')}
        </Alert>
      ) : null}
      {hasProcessingDocuments ? (
        <Alert color="yellow" radius="xl" variant="light">
          <Stack gap="xs">
            <Text size="sm">
              {readyCount > 0
                ? t('documents.processingBannerWithReady')
                : t('documents.processingBanner')}
            </Text>
            {readyCount > 0 ? (
              <Group>
                <Button
                  className="workspace-button"
                  color="yellow"
                  component={Link}
                  radius="xl"
                  size="xs"
                  to="/"
                  variant="white"
                >
                  {t('documents.workspaceNextActionLinkReady')}
                </Button>
              </Group>
            ) : null}
          </Stack>
        </Alert>
      ) : null}
      {hasActiveKnowledgeBase &&
      readyCount > 0 &&
      !hasProcessingDocuments &&
      failedCount === 0 ? (
        <Paper
          className="workspace-feedback-banner workspace-feedback-banner-teal"
          p="md"
          radius="xl"
        >
          <div className="workspace-feedback-alert__content">
            <div className="workspace-feedback-alert__copy">
              <Text c="var(--app-text)" fw={700} size="sm">
                {t('documents.readyBannerTitle')}
              </Text>
              <Text c="var(--app-text-muted)" mt={4} size="sm">
                {t('documents.readyBannerDescription', { count: readyCount })}
              </Text>
              <Group gap="xs" mt="sm">
                {starterQuestions.map((question) => (
                  <Badge
                    color="teal"
                    component={Link}
                    key={question}
                    radius="sm"
                    to={buildChatStarterQuestionHref(question, {
                      autoAsk: true
                    })}
                    variant="light"
                  >
                    {question}
                  </Badge>
                ))}
              </Group>
              <Text c="var(--app-text-muted)" mt={6} size="xs">
                {t('documents.readyBannerStarterHint')}
              </Text>
            </div>
            <div className="workspace-feedback-alert__action">
              <Button
                className="workspace-button"
                color="teal"
                component={Link}
                radius="xl"
                size="xs"
                to="/"
                variant="light"
              >
                {t('documents.workspaceNextActionLinkReady')}
              </Button>
            </div>
          </div>
        </Paper>
      ) : null}

      <div className="workspace-split-summary">
        <div className="workspace-metric-grid">
          {metricCards.map((metric) => (
            <Paper
              className="workspace-metric-card workspace-metric-card-compact"
              key={metric.key}
              p="lg"
              radius="xl"
            >
              <Text className="workspace-metric-label">{metric.label}</Text>
              <Text className="workspace-metric-value">{metric.value}</Text>
              <Text className="workspace-metric-subtle">{metric.subtle}</Text>
            </Paper>
          ))}
        </div>

        <Paper className="workspace-subpanel" p="lg" radius="xl">
          <Stack gap="md">
            <div>
              <Text className="workspace-section-heading">
                {locale === 'zh' ? '当前资料概览' : 'Library snapshot'}
              </Text>
              <Text className="workspace-section-copy">
                {locale === 'zh'
                  ? '这一页主要用于管理资料。统计区看全库，列表区只加载当前分页，避免文档变多后仍然全量刷新。'
                  : 'This page stays focused on library management. Summary cards cover the whole library while the list only loads the current page.'}
              </Text>
            </div>
            <div className="workspace-meta-list">
              <div className="workspace-meta-row">
                <span className="workspace-meta-label">
                  {locale === 'zh' ? '当前资料库' : 'Current library'}
                </span>
                <span className="workspace-meta-value">
                  {activeKnowledgeBase?.name ??
                    (locale === 'zh' ? '尚无活动资料库' : 'No active library')}
                </span>
              </div>
              <div className="workspace-meta-row">
                <span className="workspace-meta-label">
                  {locale === 'zh' ? '资料分块' : 'Chunks'}
                </span>
                <span className="workspace-meta-value">
                  {summary.totalChunks}
                </span>
              </div>
              <div className="workspace-meta-row">
                <span className="workspace-meta-label">
                  {locale === 'zh' ? '下一步' : 'Next action'}
                </span>
                <span className="workspace-meta-value">
                  {workspaceSurfaceState.nextAction}
                </span>
              </div>
            </div>
            <Button
              className="workspace-button"
              color="indigo"
              component={Link}
              radius="xl"
              size="xs"
              to={workspaceSurfaceState.nextActionHref}
              variant="light"
            >
              {workspaceSurfaceState.nextActionLabel}
            </Button>
          </Stack>
        </Paper>
      </div>

      <Paper
        className="workspace-panel-hover workspace-panel-strong"
        p="lg"
        radius="xl"
      >
        <Stack gap="md">
          <Group justify="space-between" wrap="nowrap">
            <div>
              <Text className="workspace-section-heading">
                {locale === 'zh' ? '资料列表' : 'Library items'}
              </Text>
              <Text className="workspace-section-copy">
                {locale === 'zh'
                  ? '当前列表按页加载，先看状态、分块数和更新时间；如果某份资料异常，再进入详情继续排查。'
                  : 'The list now loads one page at a time. Scan status, chunk count, and update time first, then open details only when something looks off.'}
              </Text>
            </div>
            {documentCount ? (
              <Badge color="indigo" radius="sm" variant="light">
                {documentCount}
              </Badge>
            ) : null}
          </Group>

          {!hasActiveKnowledgeBase ? (
            noActiveKnowledgeBaseStatePanel
          ) : isDocumentsLoading ? (
            <div
              aria-live="polite"
              className="workspace-loading-grid"
              role="status"
            >
              {Array.from({ length: 3 }).map((_, index) => (
                <Paper
                  className="workspace-panel-hover workspace-skeleton-panel"
                  key={index}
                  p="lg"
                  radius="xl"
                >
                  <Stack gap="md">
                    <div className="workspace-skeleton-line short" />
                    <div className="workspace-skeleton-line long" />
                    <div className="workspace-skeleton-line medium" />
                    <div className="workspace-skeleton-line long" />
                  </Stack>
                </Paper>
              ))}
              <span className="sr-only">{t('documents.loadingTitle')}</span>
            </div>
          ) : documents.length ? (
            <div className="workspace-table-shell">
              <div className="workspace-table-toolbar border-b border-[var(--app-border)] px-4 py-3">
                <Group align="center" justify="space-between" wrap="wrap">
                  <Text className="workspace-table-hint">
                    {locale === 'zh'
                      ? `当前显示第 ${visibleStart}-${visibleEnd} 条，共 ${documentCount} 条。`
                      : `Showing ${visibleStart}-${visibleEnd} of ${documentCount} items.`}
                  </Text>
                  <Badge
                    color={
                      failedCount > 0
                        ? 'red'
                        : hasProcessingDocuments
                          ? 'yellow'
                          : 'indigo'
                    }
                    radius="sm"
                    variant="light"
                  >
                    {failedCount > 0
                      ? locale === 'zh'
                        ? `${failedCount} 个待处理`
                        : `${failedCount} need review`
                      : hasProcessingDocuments
                        ? locale === 'zh'
                          ? `${processingCount} 个处理中`
                          : `${processingCount} processing`
                        : locale === 'zh'
                          ? '列表已就绪'
                          : 'List ready'}
                  </Badge>
                </Group>
              </div>
              <Table.ScrollContainer minWidth={760}>
                <Table
                  className="workspace-table"
                  highlightOnHover
                  striped="odd"
                  styles={{
                    table: {
                      color: 'var(--app-text)'
                    },
                    thead: {
                      background: 'rgba(255,255,255,0.03)'
                    },
                    tr: {
                      borderColor: 'var(--app-border)'
                    },
                    th: {
                      color: 'var(--app-text-secondary)',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      fontSize: 12,
                      letterSpacing: '0.04em'
                    },
                    td: {
                      color: 'var(--app-text)'
                    }
                  }}
                >
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>{t('common.fields.title')}</Table.Th>
                      <Table.Th>{t('common.fields.status')}</Table.Th>
                      <Table.Th>{t('common.fields.stage')}</Table.Th>
                      <Table.Th>{t('common.fields.chunks')}</Table.Th>
                      <Table.Th>{t('common.fields.updated')}</Table.Th>
                      <Table.Th>{t('common.fields.details')}</Table.Th>
                      <Table.Th />
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {documents.map((document) => (
                      <Table.Tr key={document.id}>
                        <Table.Td>
                          <Stack className="workspace-table-cell-title" gap={2}>
                            <Text
                              className="workspace-table-cell-title-main"
                              lineClamp={2}
                            >
                              {document.title}
                            </Text>
                            <Text
                              className="workspace-table-cell-meta"
                              lineClamp={1}
                            >
                              {document.sourceType} · {document.sourceName}
                            </Text>
                            {document.errorMessage ? (
                              <Text
                                className="workspace-table-cell-copy"
                                lineClamp={2}
                              >
                                {document.errorMessage}
                              </Text>
                            ) : null}
                          </Stack>
                        </Table.Td>
                        <Table.Td>
                          <div className="workspace-table-badge-stack">
                            <Badge
                              color={
                                document.status === 'ready'
                                  ? 'indigo'
                                  : document.status === 'failed'
                                    ? 'red'
                                    : 'yellow'
                              }
                              variant="light"
                            >
                              {t(`common.status.${document.status}`)}
                            </Badge>
                            <Text className="workspace-table-cell-meta">
                              v{document.version}
                            </Text>
                          </div>
                        </Table.Td>
                        <Table.Td>
                          <Text className="workspace-table-cell-copy">
                            {t(
                              `common.processingStage.${document.processingStage}`
                            )}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text
                            className="workspace-table-number"
                            fw={600}
                            size="sm"
                          >
                            {document.chunkCount}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Stack gap={2}>
                            <Text className="workspace-table-cell-copy workspace-table-number">
                              {formatDateTime(document.updatedAt)}
                            </Text>
                            <Text
                              className="workspace-table-cell-meta"
                              lineClamp={1}
                            >
                              ID: {document.id}
                            </Text>
                          </Stack>
                        </Table.Td>
                        <Table.Td className="workspace-table-action">
                          <Button
                            className="workspace-button"
                            component={Link}
                            color="indigo"
                            radius="xl"
                            size="xs"
                            to={`/documents/${document.id}`}
                            variant="light"
                          >
                            {t('common.actions.viewDetails')}
                          </Button>
                        </Table.Td>
                        <Table.Td className="workspace-table-action">
                          <Group gap="xs" justify="flex-end" wrap="nowrap">
                            <Button
                              className="workspace-button"
                              color="indigo"
                              loading={reindexMutation.isPending}
                              onClick={async () => {
                                await handleReindexDocument(
                                  document.id,
                                  document.kbId,
                                  document.title
                                );
                              }}
                              radius="xl"
                              size="xs"
                              variant="light"
                            >
                              {t('common.actions.reindex')}
                            </Button>
                            <Button
                              className="workspace-button"
                              color="red"
                              loading={deleteMutation.isPending}
                              onClick={async () => {
                                await handleDeleteDocument(
                                  document.id,
                                  document.title
                                );
                              }}
                              radius="xl"
                              size="xs"
                              variant="light"
                            >
                              {t('common.actions.delete')}
                            </Button>
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
              {totalPages > 1 ? (
                <Paper
                  className="workspace-panel-muted"
                  mt="md"
                  p="lg"
                  radius="xl"
                >
                  <Stack gap="sm">
                    <Group align="center" justify="space-between" wrap="wrap">
                      <Text c="var(--app-text-muted)" size="sm">
                        {locale === 'zh'
                          ? `第 ${page} / ${totalPages} 页`
                          : `Page ${page} of ${totalPages}`}
                      </Text>
                      <Group gap="xs" wrap="wrap">
                        <Button
                          className="workspace-button"
                          color="gray"
                          disabled={page <= 1}
                          onClick={() =>
                            setPage((current) => Math.max(1, current - 1))
                          }
                          radius="xl"
                          size="xs"
                          variant="light"
                        >
                          {locale === 'zh' ? '上一页' : 'Previous'}
                        </Button>
                        <Button
                          className="workspace-button"
                          color="gray"
                          disabled={page >= totalPages}
                          onClick={() =>
                            setPage((current) =>
                              Math.min(totalPages, current + 1)
                            )
                          }
                          radius="xl"
                          size="xs"
                          variant="light"
                        >
                          {locale === 'zh' ? '下一页' : 'Next'}
                        </Button>
                      </Group>
                    </Group>
                  </Stack>
                </Paper>
              ) : null}
            </div>
          ) : (
            <StatePanel
              description={t('documents.emptyDescription')}
              title={t('documents.emptyTitle')}
            />
          )}
        </Stack>
      </Paper>
    </Stack>
  );
}
