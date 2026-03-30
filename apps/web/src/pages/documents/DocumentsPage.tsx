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
import {
  useDocuments,
  useCreateWebPageDocument,
  useKnowledgeBases,
  useReindexDocument,
  useUploadDocument
} from "../../features/api/hooks";
import { useI18n } from "../../i18n/I18nProvider";

export function DocumentsPage() {
  const knowledgeBasesQuery = useKnowledgeBases();
  const activeKnowledgeBase = knowledgeBasesQuery.data?.[0] ?? null;
  const documentsQuery = useDocuments(activeKnowledgeBase?.id ?? "default-kb");
  const uploadMutation = useUploadDocument(activeKnowledgeBase?.id ?? "default-kb");
  const createWebPageMutation = useCreateWebPageDocument(activeKnowledgeBase?.id ?? "default-kb");
  const reindexMutation = useReindexDocument();
  const { t, locale, formatDateTime } = useI18n();
  const [webPageUrl, setWebPageUrl] = useState("");

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

  const metricCards = useMemo(
    () => [
      {
        key: "total",
        label: locale === "zh" ? "文档总数" : "Total documents",
        value: documentCount,
        subtle:
          locale === "zh"
            ? "当前知识库下全部文档"
            : "All documents in the active knowledge base"
      },
      {
        key: "ready",
        label: locale === "zh" ? "可检索" : "Ready",
        value: readyCount,
        subtle:
          locale === "zh"
            ? "已完成切分与索引"
            : "Indexed and available for retrieval"
      },
      {
        key: "processing",
        label: locale === "zh" ? "处理中" : "Processing",
        value: processingCount,
        subtle:
          locale === "zh"
            ? "等待上传或重建完成"
            : "Waiting for upload or reindex to finish"
      },
      {
        key: "failed",
        label: locale === "zh" ? "需要关注" : "Needs attention",
        value: failedCount,
        subtle:
          locale === "zh"
            ? "失败文档建议重试或删除"
            : "Failed documents should be retried or removed"
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

  const handleCreateWebPage = useCallback(async () => {
    if (!activeKnowledgeBase) {
      return;
    }

    const normalizedUrl = webPageUrl.trim();
    if (!normalizedUrl) {
      return;
    }

    try {
      await createWebPageMutation.mutateAsync({ url: normalizedUrl });
      setWebPageUrl("");
      notifications.show({
        color: "indigo",
        message: t("documents.webPage.submitSuccess", { url: normalizedUrl })
      });
    } catch (error) {
      notifications.show({
        color: "red",
        message: error instanceof Error ? error.message : t("documents.webPage.submitError")
      });
    }
  }, [activeKnowledgeBase, createWebPageMutation, t, webPageUrl]);

  return (
    <Stack gap="md">
      <Paper className="workspace-hero" p="lg" radius="xl">
        <div className="workspace-hero-split">
          <Group gap="md" wrap="nowrap">
            <Box className="workspace-hero-icon">DOC</Box>
            <div className="workspace-hero-copy">
              <Text className="workspace-hero-kicker">
                {locale === "zh" ? "文档工作台" : "Knowledge documents"}
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
                  {activeKnowledgeBase?.name ?? (locale === "zh" ? "默认知识库" : "Default KB")}
                </Badge>
                <Badge color={hasProcessingDocuments ? "yellow" : "indigo"} radius="sm" variant="light">
                  {hasProcessingDocuments
                    ? locale === "zh"
                      ? "处理队列进行中"
                      : "Processing in progress"
                    : locale === "zh"
                      ? "工作台已就绪"
                      : "Workspace ready"}
                </Badge>
              </Group>
            </div>
          </Group>

            <Stack align="flex-end" gap={10}>
              <Text className="workspace-hero-sidecopy" ta="right">
                {locale === "zh"
                  ? "上传、状态查看、详情跳转和重建索引仍然保留在同一工作台，只把首屏层级和密度收紧。"
                  : "Keep upload, status review, detail navigation, and reindex in one tighter workspace surface."}
              </Text>
              <FileButton onChange={handleUploadFile}>
                {props => (
                  <Button
                    {...props}
                    className="workspace-button"
                    color="indigo"
                    loading={uploadMutation.isPending}
                    radius="xl"
                  >
                    {t("common.actions.uploadDocument")}
                  </Button>
                )}
              </FileButton>
              <Stack className="w-full" gap={6} maw={360}>
                <Text c="var(--app-text-secondary)" fw={600} size="xs">
                  {t("documents.webPage.sectionTitle")}
                </Text>
                <Text c="var(--app-text-muted)" size="xs">
                  {t("documents.webPage.sectionDescription")}
                </Text>
                <TextInput
                  onChange={event => {
                    setWebPageUrl(event.currentTarget.value);
                  }}
                  placeholder={t("documents.webPage.inputPlaceholder")}
                  radius="xl"
                  type="url"
                  value={webPageUrl}
                />
                <Button
                  className="workspace-button"
                  color="indigo"
                  disabled={!activeKnowledgeBase || webPageUrl.trim().length === 0}
                  loading={createWebPageMutation.isPending}
                  onClick={handleCreateWebPage}
                  radius="xl"
                  variant="light"
                >
                  {t("documents.webPage.submitAction")}
                </Button>
              </Stack>
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
      {createWebPageMutation.isError ? (
        <Alert color="red" radius="xl" variant="light">
          {createWebPageMutation.error instanceof Error
            ? createWebPageMutation.error.message
            : t("documents.webPage.submitError")}
        </Alert>
      ) : null}
      {hasProcessingDocuments ? (
        <Alert color="yellow" radius="xl" variant="light">
          {t("documents.processingBanner")}
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
                {locale === "zh" ? "当前工作提示" : "Workspace readout"}
              </Text>
              <Text className="workspace-section-copy">
                {locale === "zh"
                  ? "这一页只承担文档资产管理，不在首屏堆叠过多解释。优先看状态、数量和待处理队列。"
                  : "This page stays focused on document operations. Use the top summary to scan readiness, volume, and queue pressure first."}
              </Text>
            </div>
            <div className="workspace-meta-list">
              <div className="workspace-meta-row">
                <span className="workspace-meta-label">{locale === "zh" ? "当前知识库" : "Current KB"}</span>
                <span className="workspace-meta-value">
                  {activeKnowledgeBase?.name ?? (locale === "zh" ? "默认知识库" : "Default KB")}
                </span>
              </div>
              <div className="workspace-meta-row">
                <span className="workspace-meta-label">{locale === "zh" ? "下一步" : "Next action"}</span>
                <span className="workspace-meta-value">
                  {hasProcessingDocuments
                    ? locale === "zh"
                      ? "等待队列完成后复查失败项"
                      : "Review failed items after the queue settles"
                    : locale === "zh"
                      ? "优先补充新文档或复查低质量来源"
                      : "Upload new material or review weaker sources"}
                </span>
              </div>
            </div>
          </Stack>
        </Paper>
      </div>

      <Paper className="workspace-panel-hover workspace-panel-strong" p="lg" radius="xl">
        <Stack gap="md">
          <Group justify="space-between" wrap="nowrap">
            <div>
              <Text className="workspace-section-heading">
                {locale === "zh" ? "文档列表" : "Document workspace"}
              </Text>
              <Text className="workspace-section-copy">
                {locale === "zh"
                  ? "保留现有列表逻辑，只继续收紧头部、表格层级、按钮密度和空态表达。"
                  : "Keep the existing list logic and tighten hierarchy, spacing, and state density only."}
              </Text>
            </div>
            {documentCount ? (
              <Badge color="indigo" radius="sm" variant="light">
                {documentCount}
              </Badge>
            ) : null}
          </Group>

          {isDocumentsLoading ? (
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
              <Table.ScrollContainer minWidth={760}>
                <Table
                  className="workspace-table"
                  highlightOnHover
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
                          <Stack gap={2}>
                            <Text fw={600} size="sm">
                              {document.title}
                            </Text>
                            <Text c="var(--app-text-muted)" size="xs">
                              {document.sourceName}
                            </Text>
                          </Stack>
                        </Table.Td>
                        <Table.Td>
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
                        </Table.Td>
                        <Table.Td>
                          <Text c="var(--app-text-secondary)" size="sm">
                            {t(`common.processingStage.${document.processingStage}`)}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text fw={600} size="sm">
                            {document.chunkCount}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Stack gap={2}>
                            <Text c="var(--app-text-secondary)" size="sm">
                              {formatDateTime(document.updatedAt)}
                            </Text>
                            <Text c="var(--app-text-muted)" lineClamp={1} size="xs">
                              {locale === "zh" ? "来源" : "Source"}: {document.sourceName}
                            </Text>
                          </Stack>
                        </Table.Td>
                        <Table.Td>
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
                        <Table.Td>
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
