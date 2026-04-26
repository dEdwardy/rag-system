import {
  Alert,
  Badge,
  Box,
  Button,
  Divider,
  Group,
  Modal,
  Paper,
  Stack,
  Text,
  Title
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { lazy, Suspense, useMemo, useState } from 'react';
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams
} from 'react-router-dom';
import { DocumentRunList } from '../../components/document-runs/DocumentRunList';
import { buildRunSummaryText } from '../../components/document-runs/document-run-observability';
import { StatePanel } from '../../components/StatePanel';
import {
  useDeleteDocument,
  useDocument,
  useDocumentRuns,
  useReindexDocument
} from '../../features/api/hooks';
import { useI18n } from '../../i18n/I18nProvider';
import type { DocumentRunRecord } from '../../types/api';

const DocumentDetailChunksPanel = lazy(async () => {
  const module = await import('./DocumentDetailChunksPanel');
  return { default: module.DocumentDetailChunksPanel };
});

function DocumentDetailChunksFallback({ locale }: { locale: 'zh' | 'en' }) {
  return (
    <StatePanel
      description={
        locale === 'zh'
          ? '正在准备资料切片检查区。'
          : 'Preparing the document chunk review panel.'
      }
      title={locale === 'zh' ? '加载资料切片' : 'Loading document chunks'}
      tone="loading"
    />
  );
}

function getLatestRun(runs: DocumentRunRecord[]) {
  return runs.reduce<DocumentRunRecord | null>((latest, run) => {
    if (!latest) {
      return run;
    }

    return new Date(run.startedAt).getTime() >
      new Date(latest.startedAt).getTime()
      ? run
      : latest;
  }, null);
}

function getDocumentStatusTone(status: string) {
  if (status === 'ready') {
    return 'indigo';
  }

  if (status === 'failed') {
    return 'red';
  }

  return 'yellow';
}

export function DocumentDetailPage() {
  const { documentId = null } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const focusedChunkId = searchParams.get('chunkId');
  const sourceTraceId = searchParams.get('fromTrace');
  const focusedRank = searchParams.get('rank');
  const focusedScore = searchParams.get('score');
  const focusedIsPrimary = searchParams.get('isPrimary');
  const focusedIsCited = searchParams.get('isCited') === '1';
  const documentQuery = useDocument(documentId);
  const runsQuery = useDocumentRuns(documentId);
  const reindexMutation = useReindexDocument();
  const deleteMutation = useDeleteDocument();
  const document = documentQuery.data;
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const { formatDateTime, locale, t } = useI18n();
  const traceReturnHref = sourceTraceId
    ? `/traces/${sourceTraceId}#trace-detail-retrieved-chunks`
    : null;
  const latestRun = useMemo(
    () => getLatestRun(runsQuery.data ?? []),
    [runsQuery.data]
  );
  const latestRunSummary = useMemo(() => {
    if (runsQuery.isLoading) {
      return t('documents.detail.primaryStatusRunSummaryLoading');
    }

    if (!latestRun) {
      return t('documents.detail.primaryStatusRunSummaryMissing');
    }

    return buildRunSummaryText(latestRun, locale);
  }, [latestRun, locale, runsQuery.isLoading, t]);
  const primaryStatusSummary = useMemo(() => {
    if (!document) {
      return null;
    }

    if (document.status === 'failed') {
      return t('documents.detail.primaryStatusSummaryFailed', {
        runSummary: latestRunSummary
      });
    }

    if (document.status === 'pending' || document.status === 'processing') {
      return t('documents.detail.primaryStatusSummaryProcessing', {
        runSummary: latestRunSummary
      });
    }

    return t('documents.detail.primaryStatusSummaryReady', {
      runSummary: latestRunSummary
    });
  }, [document, latestRunSummary, t]);
  const primaryStatusNextAction = useMemo(() => {
    if (!document) {
      return null;
    }

    if (document.status === 'failed') {
      return t('documents.detail.primaryStatusNextActionFailed');
    }

    if (document.status === 'pending' || document.status === 'processing') {
      return t('documents.detail.primaryStatusNextActionProcessing');
    }

    return t('documents.detail.primaryStatusNextActionReady');
  }, [document, t]);

  return (
    <Stack gap="md">
      <Modal
        centered
        closeOnClickOutside={!deleteMutation.isPending}
        closeOnEscape={!deleteMutation.isPending}
        data-testid="document-delete-confirmation"
        onClose={() => {
          if (!deleteMutation.isPending) {
            setIsDeleteConfirmOpen(false);
          }
        }}
        opened={isDeleteConfirmOpen}
        title={t('documents.detail.deleteDialogTitle')}
      >
        <Stack gap="md">
          <Text c="var(--app-text-secondary)" size="sm">
            {document
              ? t('documents.detail.deleteDialogDescriptionWithTitle', {
                  title: document.title
                })
              : t('documents.detail.deleteDialogDescriptionFallback')}
          </Text>

          <Group justify="flex-end">
            <Button
              data-testid="document-delete-cancel"
              disabled={deleteMutation.isPending}
              onClick={() => setIsDeleteConfirmOpen(false)}
              radius="xl"
              type="button"
              variant="default"
            >
              {t('documents.detail.deleteCancel')}
            </Button>
            <Button
              color="red"
              data-testid="document-delete-confirm"
              loading={deleteMutation.isPending}
              onClick={async () => {
                if (!document) {
                  return;
                }

                try {
                  await deleteMutation.mutateAsync({
                    documentId: document.id
                  });
                  setIsDeleteConfirmOpen(false);
                  notifications.show({
                    color: 'indigo',
                    message: t('documents.detail.deleteSuccess', {
                      title: document.title
                    })
                  });
                  navigate('/documents');
                } catch (error) {
                  notifications.show({
                    color: 'red',
                    message:
                      error instanceof Error
                        ? error.message
                        : t('documents.detail.deleteError')
                  });
                }
              }}
              radius="xl"
              type="button"
            >
              {t('common.actions.delete')}
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Paper className="workspace-hero" p="lg" radius="xl">
        <Stack gap={10}>
          {traceReturnHref ? (
            <Text
              c="var(--app-text-muted)"
              className="workspace-link"
              component={Link}
              size="sm"
              to={traceReturnHref}
            >
              {t('documents.detail.backToTrace')}
            </Text>
          ) : null}
          <Text
            c="var(--app-text-muted)"
            className="workspace-link"
            component={Link}
            size="sm"
            to="/documents"
          >
            {t('common.actions.backToDocuments')}
          </Text>
          <div className="workspace-hero-split">
            <Group gap="md" wrap="nowrap">
              <Box className="workspace-hero-icon">DOC</Box>
              <div className="workspace-hero-copy">
                <Text className="workspace-hero-kicker">
                  {t('documents.detail.kicker')}
                </Text>
                <Title
                  order={3}
                  c="var(--app-text)"
                  style={{
                    fontFamily: 'var(--app-font-display)',
                    letterSpacing: '0'
                  }}
                >
                  {document?.title ?? t('documents.detail.title')}
                </Title>
                <Text c="var(--app-text-muted)" mt={4} size="sm">
                  {document?.sourceName ?? t('documents.detail.subtitle')}
                </Text>
              </div>
            </Group>

            {document ? (
              <Stack align="flex-end" gap={10}>
                <Group gap="xs">
                  <Badge
                    color={getDocumentStatusTone(document.status)}
                    variant="light"
                  >
                    {t(`common.status.${document.status}`)}
                  </Badge>
                  <Badge color="gray" variant="light">
                    {document.chunkCount} chunks
                  </Badge>
                </Group>
                <Text className="workspace-hero-sidecopy" ta="right">
                  {t('documents.detail.detailHeroCopy')}
                </Text>
              </Stack>
            ) : null}
          </div>
        </Stack>
      </Paper>

      {documentQuery.isLoading ? (
        <StatePanel
          description={t('documents.detail.subtitle')}
          title={t('documents.detail.title')}
          tone="loading"
        />
      ) : null}
      {documentQuery.isError ? (
        <Alert color="red" radius="xl" variant="light">
          {documentQuery.error instanceof Error
            ? documentQuery.error.message
            : t('documents.detail.loadError')}
        </Alert>
      ) : null}

      {document ? (
        <div className="workspace-page-grid">
          <div className="workspace-page-side-stack">
            <div className="workspace-sticky-panel">
              <Stack gap="md">
                <Paper
                  className="workspace-panel-hover workspace-panel-strong"
                  p="lg"
                  radius="xl"
                >
                  <Stack gap="md">
                    <Group justify="space-between" wrap="nowrap">
                      <Text className="workspace-section-heading">
                        {t('documents.detail.primaryStatus')}
                      </Text>
                      <Badge
                        color={getDocumentStatusTone(document.status)}
                        variant="light"
                      >
                        {t(`common.status.${document.status}`)}
                      </Badge>
                    </Group>

                    <Group gap="sm">
                      <Button
                        className="workspace-button"
                        color="indigo"
                        loading={reindexMutation.isPending}
                        onClick={async () => {
                          try {
                            await reindexMutation.mutateAsync({
                              documentId: document.id,
                              knowledgeBaseId: document.kbId
                            });
                            notifications.show({
                              color: 'indigo',
                              message: t('documents.reindexRequested', {
                                title: document.title
                              })
                            });
                          } catch (error) {
                            notifications.show({
                              color: 'red',
                              message:
                                error instanceof Error
                                  ? error.message
                                  : t('documents.reindexError')
                            });
                          }
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
                        data-testid="document-delete-trigger"
                        loading={deleteMutation.isPending}
                        onClick={() => setIsDeleteConfirmOpen(true)}
                        radius="xl"
                        size="xs"
                        variant="light"
                      >
                        {t('common.actions.delete')}
                      </Button>
                    </Group>

                    <Divider color="var(--app-border)" />

                    <Text c="var(--app-text-secondary)" size="sm">
                      {primaryStatusSummary}
                    </Text>

                    <div className="workspace-meta-list">
                      <div className="workspace-meta-row">
                        <span className="workspace-meta-label">
                          {t('documents.detail.nextAction')}
                        </span>
                        <span className="workspace-meta-value">
                          {primaryStatusNextAction}
                        </span>
                      </div>
                      <div className="workspace-meta-row">
                        <span className="workspace-meta-label">
                          {t('common.fields.stage')}
                        </span>
                        <span className="workspace-meta-value">
                          {t(
                            `common.processingStage.${document.processingStage}`
                          )}
                        </span>
                      </div>
                      <div className="workspace-meta-row">
                        <span className="workspace-meta-label">
                          {t('common.fields.chunks')}
                        </span>
                        <span className="workspace-meta-value">
                          {document.chunkCount}
                        </span>
                      </div>
                      <div className="workspace-meta-row">
                        <span className="workspace-meta-label">
                          {t('common.fields.version')}
                        </span>
                        <span className="workspace-meta-value">
                          {document.version}
                        </span>
                      </div>
                      <div className="workspace-meta-row">
                        <span className="workspace-meta-label">
                          {t('common.fields.mime')}
                        </span>
                        <span className="workspace-meta-value">
                          {document.mimeType}
                        </span>
                      </div>
                      <div className="workspace-meta-row">
                        <span className="workspace-meta-label">
                          {t('common.fields.created')}
                        </span>
                        <span className="workspace-meta-value">
                          {formatDateTime(document.createdAt)}
                        </span>
                      </div>
                      <div className="workspace-meta-row">
                        <span className="workspace-meta-label">
                          {t('common.fields.updated')}
                        </span>
                        <span className="workspace-meta-value">
                          {formatDateTime(document.updatedAt)}
                        </span>
                      </div>
                    </div>
                  </Stack>
                </Paper>

                <Paper
                  className="workspace-panel-hover workspace-panel-muted"
                  p="lg"
                  radius="xl"
                >
                  <Stack gap="sm">
                    <Text className="workspace-section-heading">
                      {t('documents.detail.storageAndDiagnostics')}
                    </Text>
                    <Text className="workspace-section-copy">
                      {t('documents.detail.storageAndDiagnosticsCopy')}
                    </Text>
                    <pre className="workspace-code-block workspace-code-block-scroll">
                      {document.storageKey}
                    </pre>
                    {document.errorMessage ? (
                      <Alert color="red" mt="sm" radius="xl" variant="light">
                        {document.errorMessage}
                      </Alert>
                    ) : null}
                  </Stack>
                </Paper>

                {runsQuery.isError ? (
                  <Alert color="red" radius="xl" variant="light">
                    {runsQuery.error instanceof Error
                      ? runsQuery.error.message
                      : t('documents.detail.runsLoadError')}
                  </Alert>
                ) : (
                  <DocumentRunList
                    title={t('documents.detail.runsTitle')}
                    description={t('documents.detail.runsDescription')}
                    runs={runsQuery.data ?? []}
                    emptyTitle={t('documents.detail.runsEmptyTitle')}
                    emptyDescription={t(
                      'documents.detail.runsEmptyDescription'
                    )}
                  />
                )}
              </Stack>
            </div>
          </div>

          <div className="workspace-page-main-stack">
            <Suspense
              fallback={<DocumentDetailChunksFallback locale={locale} />}
            >
              <DocumentDetailChunksPanel
                documentId={document.id}
                focusedChunkId={focusedChunkId}
                focusedIsCited={focusedIsCited}
                focusedIsPrimary={focusedIsPrimary}
                focusedRank={focusedRank}
                focusedScore={focusedScore}
                sourceTraceId={sourceTraceId}
                traceReturnHref={traceReturnHref}
              />
            </Suspense>
          </div>
        </div>
      ) : null}
    </Stack>
  );
}
