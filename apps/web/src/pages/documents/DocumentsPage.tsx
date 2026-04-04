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
  TextInput,
  Text,
  Title
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { StatePanel } from "../../components/StatePanel";
import { validateSourceEntryUrl as validateSourceEntryUrlHelper } from "./documents-page-helpers";
import {
  useCreateFeedDocument,
  useCreateSitemapDocument,
  useDocuments,
  useCreateWebPageDocument,
  useKnowledgeBases,
  useReindexDocument,
  useUploadDocument
} from "../../features/api/hooks";
import { getPrimaryKnowledgeBase } from "../../features/api/workspace-selection";
import { useI18n } from "../../i18n/I18nProvider";

type SourceEntryKind = "webPage" | "feed" | "sitemap";

export function DocumentsPage() {
  const knowledgeBasesQuery = useKnowledgeBases();
  const activeKnowledgeBase = getPrimaryKnowledgeBase(knowledgeBasesQuery.data);
  const hasActiveKnowledgeBase = activeKnowledgeBase != null;
  const documentsQuery = useDocuments(activeKnowledgeBase?.id ?? "", hasActiveKnowledgeBase);
  const uploadMutation = useUploadDocument(activeKnowledgeBase?.id ?? "");
  const createWebPageMutation = useCreateWebPageDocument(activeKnowledgeBase?.id ?? "");
  const createFeedMutation = useCreateFeedDocument(activeKnowledgeBase?.id ?? "");
  const createSitemapMutation = useCreateSitemapDocument(activeKnowledgeBase?.id ?? "");
  const reindexMutation = useReindexDocument();
  const { t, locale, formatDateTime } = useI18n();
  const [webPageUrl, setWebPageUrl] = useState("");
  const [feedUrl, setFeedUrl] = useState("");
  const [sitemapUrl, setSitemapUrl] = useState("");
  const [webPageInlineError, setWebPageInlineError] = useState<string | null>(null);
  const [feedInlineError, setFeedInlineError] = useState<string | null>(null);
  const [sitemapInlineError, setSitemapInlineError] = useState<string | null>(null);
  const [lastSubmittedSourceUrl, setLastSubmittedSourceUrl] = useState<Record<SourceEntryKind, string | null>>({
    webPage: null,
    feed: null,
    sitemap: null
  });
  const isAnySourceSubmissionPending =
    createWebPageMutation.isPending || createFeedMutation.isPending || createSitemapMutation.isPending;

  const resolveSourceEntryStatus = useCallback(
    (sourceKind: SourceEntryKind, urlValue: string, inlineError: string | null) => {
      if (!hasActiveKnowledgeBase) {
        return {
          message: t("documents.sourceEntryStatusNoActiveKnowledgeBase"),
          tone: "dimmed"
        } as const;
      }

      if (inlineError) {
        return {
          message: inlineError,
          tone: "red"
        } as const;
      }

      if (isAnySourceSubmissionPending) {
        return {
          message: t("documents.sourceEntryStatusSubmitting"),
          tone: "indigo"
        } as const;
      }

      const lastSubmittedUrl = lastSubmittedSourceUrl[sourceKind];
      if (lastSubmittedUrl && urlValue.trim().length === 0) {
        return {
          message: t("documents.sourceEntryStatusSuccess", { url: lastSubmittedUrl }),
          tone: "teal"
        } as const;
      }

      if (urlValue.trim().length === 0) {
        return {
          message: t("documents.sourceEntryStatusEmpty"),
          tone: "dimmed"
        } as const;
      }

      return {
        message: t("documents.sourceEntryStatusReady"),
        tone: "dimmed"
      } as const;
    },
    [hasActiveKnowledgeBase, isAnySourceSubmissionPending, lastSubmittedSourceUrl, t]
  );

  const webPageSourceEntryStatus = resolveSourceEntryStatus("webPage", webPageUrl, webPageInlineError);
  const feedSourceEntryStatus = resolveSourceEntryStatus("feed", feedUrl, feedInlineError);
  const sitemapSourceEntryStatus = resolveSourceEntryStatus("sitemap", sitemapUrl, sitemapInlineError);

  const validateSourceEntryUrl = useCallback(
    (rawValue: string) => validateSourceEntryUrlHelper(rawValue, t),
    [t]
  );

  const documents = documentsQuery.data ?? [];
  const isDocumentsLoading = documentsQuery.isLoading && !documentsQuery.isError;
  const { documentCount, readyCount, processingCount, failedCount } = useMemo(
    () =>
      documents.reduce(
        (acc, document) => {
          acc.documentCount += 1;
          if (document.status === "ready") {
            acc.readyCount += 1;
          } else if (document.status === "pending" || document.status === "processing") {
            acc.processingCount += 1;
          } else if (document.status === "failed") {
            acc.failedCount += 1;
          }
          return acc;
        },
        {
          documentCount: 0,
          readyCount: 0,
          processingCount: 0,
          failedCount: 0
        }
      ),
    [documents]
  );
  const hasProcessingDocuments = processingCount > 0;
  const firstFailedDocument = useMemo(
    () => documents.find(document => document.status === "failed") ?? null,
    [documents]
  );
  const firstProcessingDocument = useMemo(
    () => documents.find(document => document.status === "pending" || document.status === "processing") ?? null,
    [documents]
  );
  const workspaceSurfaceState = useMemo(() => {
    if (!hasActiveKnowledgeBase) {
      return {
        badgeColor: "gray",
        badgeLabel: t("documents.workspaceStatusNoActiveKnowledgeBase"),
        nextAction: t("documents.workspaceNextActionNoActiveKnowledgeBase"),
        nextActionHref: "/knowledge-base",
        nextActionLabel: t("documents.workspaceNextActionLinkNoActiveKnowledgeBase")
      } as const;
    }

    if (failedCount > 0) {
      return {
        badgeColor: "red",
        badgeLabel: t("documents.workspaceStatusNeedsAttention"),
        nextAction: t("documents.workspaceNextActionNeedsAttention"),
        nextActionHref: firstFailedDocument ? `/documents/${firstFailedDocument.id}` : "/documents",
        nextActionLabel: t("documents.workspaceNextActionLinkNeedsAttention")
      } as const;
    }

    if (hasProcessingDocuments) {
      return {
        badgeColor: "yellow",
        badgeLabel: t("documents.workspaceStatusProcessing"),
        nextAction: t("documents.workspaceNextActionProcessing"),
        nextActionHref: firstProcessingDocument ? `/documents/${firstProcessingDocument.id}` : "/documents",
        nextActionLabel: t("documents.workspaceNextActionLinkProcessing")
      } as const;
    }

    return {
      badgeColor: "indigo",
      badgeLabel: t("documents.workspaceStatusReady"),
      nextAction: t("documents.workspaceNextActionReady"),
      nextActionHref: "/",
      nextActionLabel: t("documents.workspaceNextActionLinkReady")
    } as const;
  }, [failedCount, firstFailedDocument, firstProcessingDocument, hasActiveKnowledgeBase, hasProcessingDocuments, t]);

  const noActiveKnowledgeBaseStatePanel = (
    <StatePanel
      action={
        <Button className="workspace-button" color="indigo" component={Link} radius="xl" to="/knowledge-base" variant="light">
          {t("documents.noActiveKnowledgeBaseAction")}
        </Button>
      }
      description={t("documents.noActiveKnowledgeBaseDescription")}
      title={t("documents.noActiveKnowledgeBaseTitle")}
    />
  );

  const metricCards = useMemo(
    () => [
      {
        key: "total",
        label: locale === "zh" ? "资料总数" : "Total items",
        value: documentCount,
        subtle:
          locale === "zh"
            ? "当前资料库中的全部资料"
            : "All library items in the current workspace library"
      },
      {
        key: "ready",
        label: locale === "zh" ? "可检索" : "Ready",
        value: readyCount,
        subtle:
          locale === "zh"
            ? "已经可以用于提问"
            : "Ready to use in chat"
      },
      {
        key: "processing",
        label: locale === "zh" ? "处理中" : "Processing",
        value: processingCount,
        subtle:
          locale === "zh"
            ? "正在导入或更新中"
            : "Being added or refreshed"
      },
      {
        key: "failed",
        label: locale === "zh" ? "需要关注" : "Needs attention",
        value: failedCount,
        subtle:
          locale === "zh"
            ? "有资料需要重试或清理"
            : "Some items need retry or cleanup"
      }
    ],
    [documentCount, failedCount, locale, processingCount, readyCount]
  );

  const handleUploadFile = useCallback(
    async (file: File | null) => {
      if (!file || !activeKnowledgeBase) {
        return;
      }

      try {
        await uploadMutation.mutateAsync(file);
        notifications.show({
          color: "indigo",
          message: t("documents.uploadSuccess", { fileName: file.name })
        });
      } catch (error) {
        notifications.show({
          color: "red",
          message: error instanceof Error ? error.message : t("documents.uploadError")
        });
      }
    },
    [activeKnowledgeBase, t, uploadMutation]
  );

  const handleReindexDocument = useCallback(
    async (documentId: string, knowledgeBaseId: string, title: string) => {
      try {
        await reindexMutation.mutateAsync({
          documentId,
          knowledgeBaseId
        });
        notifications.show({
          color: "indigo",
          message: t("documents.reindexRequested", { title })
        });
      } catch (error) {
        notifications.show({
          color: "red",
          message: error instanceof Error ? error.message : t("documents.reindexError")
        });
      }
    },
    [reindexMutation, t]
  );

  const submitSourceEntry = useCallback(
    async (
      sourceKind: SourceEntryKind,
      urlValue: string,
      setUrlValue: (nextValue: string) => void,
      setInlineError: (nextValue: string | null) => void,
      mutateAsync: (payload: { url: string }) => Promise<unknown>,
      submitMessages: {
        error: string;
        success: (url: string) => string;
      }
    ) => {
      if (!activeKnowledgeBase) {
        return;
      }

      const { normalizedUrl, error } = validateSourceEntryUrl(urlValue);
      if (error) {
        setInlineError(error);
        return;
      }

      setInlineError(null);
      try {
        await mutateAsync({ url: normalizedUrl });
        setUrlValue("");
        setLastSubmittedSourceUrl(current => ({ ...current, [sourceKind]: normalizedUrl }));
        notifications.show({
          color: "indigo",
          message: submitMessages.success(normalizedUrl)
        });
      } catch (error) {
        setInlineError(error instanceof Error ? error.message : submitMessages.error);
        notifications.show({
          color: "red",
          message: error instanceof Error ? error.message : submitMessages.error
        });
      }
    },
    [activeKnowledgeBase, validateSourceEntryUrl]
  );

  const handleCreateWebPage = useCallback(async () => {
    await submitSourceEntry("webPage", webPageUrl, setWebPageUrl, setWebPageInlineError, createWebPageMutation.mutateAsync, {
      error: t("documents.webPage.submitError"),
      success: url => t("documents.webPage.submitSuccess", { url })
    });
  }, [createWebPageMutation.mutateAsync, submitSourceEntry, t, webPageUrl]);

  const handleCreateFeed = useCallback(async () => {
    await submitSourceEntry("feed", feedUrl, setFeedUrl, setFeedInlineError, createFeedMutation.mutateAsync, {
      error: t("documents.feed.submitError"),
      success: url => t("documents.feed.submitSuccess", { url })
    });
  }, [createFeedMutation.mutateAsync, feedUrl, submitSourceEntry, t]);

  const handleCreateSitemap = useCallback(async () => {
    await submitSourceEntry("sitemap", sitemapUrl, setSitemapUrl, setSitemapInlineError, createSitemapMutation.mutateAsync, {
      error: t("documents.sitemap.submitError"),
      success: url => t("documents.sitemap.submitSuccess", { url })
    });
  }, [createSitemapMutation.mutateAsync, sitemapUrl, submitSourceEntry, t]);

  const sourceEntrySections = useMemo(
    () => [
      {
        key: "webPage" as const,
        description: t("documents.webPage.sectionDescription"),
        inlineError: webPageInlineError,
        inputPlaceholder: t("documents.webPage.inputPlaceholder"),
        isSubmitting: createWebPageMutation.isPending,
        onChange: (nextValue: string) => {
          setWebPageUrl(nextValue);
          setLastSubmittedSourceUrl(current => ({ ...current, webPage: null }));
          if (webPageInlineError) {
            setWebPageInlineError(null);
          }
        },
        onSubmit: handleCreateWebPage,
        status: webPageSourceEntryStatus,
        submitAction: t("documents.webPage.submitAction"),
        title: t("documents.webPage.sectionTitle"),
        value: webPageUrl
      },
      {
        key: "feed" as const,
        description: t("documents.feed.sectionDescription"),
        inlineError: feedInlineError,
        inputPlaceholder: t("documents.feed.inputPlaceholder"),
        isSubmitting: createFeedMutation.isPending,
        onChange: (nextValue: string) => {
          setFeedUrl(nextValue);
          setLastSubmittedSourceUrl(current => ({ ...current, feed: null }));
          if (feedInlineError) {
            setFeedInlineError(null);
          }
        },
        onSubmit: handleCreateFeed,
        status: feedSourceEntryStatus,
        submitAction: t("documents.feed.submitAction"),
        title: t("documents.feed.sectionTitle"),
        value: feedUrl
      },
      {
        key: "sitemap" as const,
        description: t("documents.sitemap.sectionDescription"),
        inlineError: sitemapInlineError,
        inputPlaceholder: t("documents.sitemap.inputPlaceholder"),
        isSubmitting: createSitemapMutation.isPending,
        onChange: (nextValue: string) => {
          setSitemapUrl(nextValue);
          setLastSubmittedSourceUrl(current => ({ ...current, sitemap: null }));
          if (sitemapInlineError) {
            setSitemapInlineError(null);
          }
        },
        onSubmit: handleCreateSitemap,
        status: sitemapSourceEntryStatus,
        submitAction: t("documents.sitemap.submitAction"),
        title: t("documents.sitemap.sectionTitle"),
        value: sitemapUrl
      }
    ],
    [
      createFeedMutation.isPending,
      createSitemapMutation.isPending,
      createWebPageMutation.isPending,
      feedInlineError,
      feedSourceEntryStatus,
      feedUrl,
      handleCreateFeed,
      handleCreateSitemap,
      handleCreateWebPage,
      sitemapInlineError,
      sitemapSourceEntryStatus,
      sitemapUrl,
      t,
      webPageInlineError,
      webPageSourceEntryStatus,
      webPageUrl
    ]
  );

  return (
    <Stack gap="md">
      <Paper className="workspace-hero" p="lg" radius="xl">
        <div className="workspace-hero-split">
          <Group gap="md" wrap="nowrap">
            <Box className="workspace-hero-icon">DOC</Box>
            <div className="workspace-hero-copy">
              <Text className="workspace-hero-kicker">
                {locale === "zh" ? "资料库" : "Library"}
              </Text>
              <Title
                order={3}
                c="var(--app-text)"
                style={{ fontFamily: "var(--app-font-display)", letterSpacing: "-0.03em" }}
              >
                {t("documents.title")}
              </Title>
              <Text c="var(--app-text-muted)" mt={4} size="sm">
                {t("documents.subtitle")}
              </Text>
              <Group gap="xs" mt="sm">
                <Badge color="gray" radius="sm" variant="light">
                  {activeKnowledgeBase?.name ?? (locale === "zh" ? "尚无活动资料空间" : "No active library")}
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
                    ? t("documents.currentKnowledgeBaseHintHasKb")
                    : t("documents.currentKnowledgeBaseHintNoKb")}
                </Text>
                <Badge color="gray" radius="sm" variant="light">
                  {`${t("documents.currentKnowledgeBaseLabel")}: ${activeKnowledgeBase?.name ?? (locale === "zh" ? "尚无活动资料空间" : "No active library")}`}
                </Badge>
                <FileButton onChange={handleUploadFile}>
                  {props => (
                    <Button
                    {...props}
                    className="workspace-button"
                    color="indigo"
                    disabled={!hasActiveKnowledgeBase}
                    loading={uploadMutation.isPending}
                    radius="xl"
                  >
                    {t("common.actions.uploadDocument")}
                  </Button>
                )}
              </FileButton>
              <Stack className="w-full" gap={6} maw={360}>
                <Text c="var(--app-text-secondary)" fw={600} size="xs">
                  {t("documents.sourceEntryHeading")}
                </Text>
                <Text c="var(--app-text-muted)" size="xs">
                  {t("documents.sourceEntryScanPath")}
                </Text>
              </Stack>
              {hasActiveKnowledgeBase ? (
                <>
                  {sourceEntrySections.map(section => (
                    <Stack className="w-full" gap={6} key={section.key} maw={360}>
                      <Text c="var(--app-text-secondary)" fw={600} size="xs">
                        {section.title}
                      </Text>
                      <Text c="var(--app-text-muted)" size="xs">
                        {section.description}
                      </Text>
                      <TextInput
                        disabled={isAnySourceSubmissionPending}
                        error={section.inlineError != null}
                        onChange={event => {
                          section.onChange(event.currentTarget.value);
                        }}
                        placeholder={section.inputPlaceholder}
                        radius="xl"
                        type="url"
                        value={section.value}
                      />
                      <Text aria-live="polite" c={section.status.tone} size="xs">
                        {section.status.message}
                      </Text>
                      <Button
                        className="workspace-button"
                        color="indigo"
                        disabled={!activeKnowledgeBase || section.value.trim().length === 0 || isAnySourceSubmissionPending}
                        loading={section.isSubmitting}
                        onClick={section.onSubmit}
                        radius="xl"
                        variant="light"
                      >
                        {section.submitAction}
                      </Button>
                    </Stack>
                  ))}
                </>
              ) : (
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
                      {t("documents.noActiveKnowledgeBaseAction")}
                    </Button>
                  }
                  description={t("documents.sourceEntryNoActiveKnowledgeBaseDescription")}
                  title={t("documents.sourceEntryNoActiveKnowledgeBaseTitle")}
                />
              )}
            </Stack>
          </div>
      </Paper>

      {knowledgeBasesQuery.isError ? (
        <StatePanel
          description={knowledgeBasesQuery.error instanceof Error ? knowledgeBasesQuery.error.message : undefined}
          title={t("documents.loadKbError")}
          tone="error"
        />
      ) : null}
      {documentsQuery.isError ? (
        <StatePanel
          description={documentsQuery.error instanceof Error ? documentsQuery.error.message : undefined}
          title={t("documents.loadDocumentsError")}
          tone="error"
        />
      ) : null}
      {uploadMutation.isError ? (
        <Alert color="red" radius="xl" variant="light">
          {uploadMutation.error instanceof Error ? uploadMutation.error.message : t("documents.uploadError")}
        </Alert>
      ) : null}
      {isAnySourceSubmissionPending ? (
        <Alert color="indigo" radius="xl" variant="light">
          {t("documents.sourceEntrySubmittingHint")}
        </Alert>
      ) : null}
      {hasProcessingDocuments ? (
        <Alert color="yellow" radius="xl" variant="light">
          {t("documents.processingBanner")}
        </Alert>
      ) : null}
      {hasActiveKnowledgeBase && readyCount > 0 && !hasProcessingDocuments && failedCount === 0 ? (
        <Alert color="teal" radius="xl" variant="light">
          <Group align="flex-start" justify="space-between" wrap="wrap">
            <div>
              <Text c="var(--app-text)" fw={700} size="sm">
                {t("documents.readyBannerTitle")}
              </Text>
              <Text c="var(--app-text-muted)" mt={4} size="sm">
                {t("documents.readyBannerDescription", { count: readyCount })}
              </Text>
            </div>
            <Button className="workspace-button" color="teal" component={Link} radius="xl" size="xs" to="/" variant="light">
              {t("documents.workspaceNextActionLinkReady")}
            </Button>
          </Group>
        </Alert>
      ) : null}

      <div className="workspace-split-summary">
        <div className="workspace-metric-grid">
          {metricCards.map(metric => (
            <Paper className="workspace-metric-card workspace-metric-card-compact" key={metric.key} p="lg" radius="xl">
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
                {locale === "zh" ? "当前资料概览" : "Library snapshot"}
              </Text>
              <Text className="workspace-section-copy">
                {locale === "zh"
                  ? "这一页主要用来管理资料。先看可用数量、处理中项目和需要处理的失败项。"
                  : "This page stays focused on library management. Start with readiness, items in progress, and anything that needs attention."}
              </Text>
            </div>
            <div className="workspace-meta-list">
              <div className="workspace-meta-row">
                <span className="workspace-meta-label">{locale === "zh" ? "当前资料空间" : "Current library"}</span>
                <span className="workspace-meta-value">
                  {activeKnowledgeBase?.name ?? (locale === "zh" ? "尚无活动资料空间" : "No active library")}
                </span>
              </div>
              <div className="workspace-meta-row">
                <span className="workspace-meta-label">{locale === "zh" ? "下一步" : "Next action"}</span>
                <span className="workspace-meta-value">{workspaceSurfaceState.nextAction}</span>
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

      <Paper className="workspace-panel-hover workspace-panel-strong" p="lg" radius="xl">
        <Stack gap="md">
          <Group justify="space-between" wrap="nowrap">
            <div>
              <Text className="workspace-section-heading">
                {locale === "zh" ? "资料列表" : "Library items"}
              </Text>
              <Text className="workspace-section-copy">
                {locale === "zh"
                  ? "在这里查看每份资料的当前状态、更新时间，以及是否已经可以用于问答。"
                  : "Review each item here to see whether it is ready, still updating, or needs attention."}
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
            <div aria-live="polite" className="workspace-loading-grid" role="status">
              {Array.from({ length: 3 }).map((_, index) => (
                <Paper className="workspace-panel-hover workspace-skeleton-panel" key={index} p="lg" radius="xl">
                  <Stack gap="md">
                    <div className="workspace-skeleton-line short" />
                    <div className="workspace-skeleton-line long" />
                    <div className="workspace-skeleton-line medium" />
                    <div className="workspace-skeleton-line long" />
                  </Stack>
                </Paper>
              ))}
              <span className="sr-only">{t("documents.loadingTitle")}</span>
            </div>
          ) : documents.length ? (
            <div className="workspace-table-shell">
              <div className="workspace-table-toolbar border-b border-[var(--app-border)] px-4 py-3">
                <Text className="workspace-table-hint">
                  {locale === "zh"
                    ? "先看状态、片段数和更新时间；如果某份资料异常，再进入详情继续排查。"
                    : "Scan status, chunk count, and update time first, then open item details only when something looks off."}
                </Text>
                <Badge color={failedCount > 0 ? "red" : hasProcessingDocuments ? "yellow" : "indigo"} radius="sm" variant="light">
                  {failedCount > 0
                    ? locale === "zh"
                      ? `${failedCount} 个待处理`
                      : `${failedCount} need review`
                    : hasProcessingDocuments
                      ? locale === "zh"
                        ? `${processingCount} 个处理中`
                        : `${processingCount} processing`
                      : locale === "zh"
                        ? "列表已就绪"
                        : "List ready"}
                </Badge>
              </div>
              <Table.ScrollContainer minWidth={760}>
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
                      letterSpacing: "0.04em"
                    },
                    td: {
                      color: "var(--app-text)"
                    }
                  }}
                >
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>{t("common.fields.title")}</Table.Th>
                      <Table.Th>{t("common.fields.status")}</Table.Th>
                      <Table.Th>{t("common.fields.stage")}</Table.Th>
                      <Table.Th>{t("common.fields.chunks")}</Table.Th>
                      <Table.Th>{t("common.fields.updated")}</Table.Th>
                      <Table.Th>{t("common.fields.details")}</Table.Th>
                      <Table.Th />
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {documents.map(document => (
                      <Table.Tr key={document.id}>
                        <Table.Td>
                          <Stack className="workspace-table-cell-title" gap={2}>
                            <Text className="workspace-table-cell-title-main" lineClamp={2}>
                              {document.title}
                            </Text>
                            <Text className="workspace-table-cell-meta" lineClamp={1}>
                              {document.sourceType} · {document.sourceName}
                            </Text>
                            {document.errorMessage ? (
                              <Text className="workspace-table-cell-copy" lineClamp={2}>
                                {document.errorMessage}
                              </Text>
                            ) : null}
                          </Stack>
                        </Table.Td>
                        <Table.Td>
                          <div className="workspace-table-badge-stack">
                            <Badge
                              color={
                                document.status === "ready"
                                  ? "indigo"
                                  : document.status === "failed"
                                    ? "red"
                                    : "yellow"
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
                            {t(`common.processingStage.${document.processingStage}`)}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text className="workspace-table-number" fw={600} size="sm">
                            {document.chunkCount}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Stack gap={2}>
                            <Text className="workspace-table-cell-copy workspace-table-number">
                              {formatDateTime(document.updatedAt)}
                            </Text>
                            <Text className="workspace-table-cell-meta" lineClamp={1}>
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
                            {t("common.actions.viewDetails")}
                          </Button>
                        </Table.Td>
                        <Table.Td className="workspace-table-action">
                          <Button
                            className="workspace-button"
                            color="indigo"
                            loading={reindexMutation.isPending}
                            onClick={async () => {
                              await handleReindexDocument(document.id, document.kbId, document.title);
                            }}
                            radius="xl"
                            size="xs"
                            variant="light"
                          >
                            {t("common.actions.reindex")}
                          </Button>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            </div>
          ) : (
            <StatePanel
              description={t("documents.emptyDescription")}
              title={t("documents.emptyTitle")}
            />
          )}
        </Stack>
      </Paper>
    </Stack>
  );
}
