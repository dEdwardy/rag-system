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
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { Link } from "react-router-dom";
import { StatePanel } from "../../components/StatePanel";
import {
  useDocuments,
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
  const reindexMutation = useReindexDocument();
  const hasProcessingDocuments = documentsQuery.data?.some(
    document => document.status === "pending" || document.status === "processing"
  );
  const { t, locale } = useI18n();
  const isDocumentsLoading = documentsQuery.isLoading && !documentsQuery.isError;

  return (
    <Stack gap="md">
      <Paper className="workspace-hero" p="lg" radius="xl">
        <div className="workspace-hero-split">
          <Group gap="md" wrap="nowrap">
            <Box className="workspace-hero-icon">DOC</Box>
            <div className="workspace-hero-copy">
              <Text className="workspace-hero-kicker">
                {locale === "zh" ? "文档工作区" : "Knowledge documents"}
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
                  {activeKnowledgeBase?.name ?? (locale === "zh" ? "默认 KB" : "Default KB")}
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
                ? "继续保留上传、状态检查、详情打开和重建索引四个核心动作，只收紧 B 主题层级和密度。"
                : "Keep upload, status inspection, detail navigation, and reindex in one dense workspace surface."}
            </Text>
            <FileButton
              onChange={async file => {
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
              }}
            >
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
      {hasProcessingDocuments ? (
        <Alert color="yellow" radius="xl" variant="light">
          {t("documents.processingBanner")}
        </Alert>
      ) : null}

      <Paper className="workspace-panel-hover workspace-panel-strong" p="lg" radius="xl">
        <Stack gap="md">
          <Group justify="space-between" wrap="nowrap">
            <div>
              <Text className="workspace-section-heading">
                {locale === "zh" ? "文档主列表" : "Document workspace"}
              </Text>
              <Text className="workspace-section-copy">
                {locale === "zh"
                  ? "保留现有列表逻辑，只继续收紧头部、表格层级、按钮密度和空态视觉。"
                  : "Keep the existing list logic and tighten hierarchy, spacing, and state density only."}
              </Text>
            </div>
            {documentsQuery.data?.length ? (
              <Badge color="indigo" radius="sm" variant="light">
                {documentsQuery.data.length}
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
          ) : documentsQuery.data?.length ? (
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
                      <Table.Th>{t("common.fields.storage")}</Table.Th>
                      <Table.Th>{t("common.fields.details")}</Table.Th>
                      <Table.Th />
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {documentsQuery.data.map(document => (
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
                          <Text c="var(--app-text-muted)" lineClamp={1} size="sm">
                            {document.storageKey}
                          </Text>
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
                              try {
                                await reindexMutation.mutateAsync({
                                  documentId: document.id,
                                  knowledgeBaseId: document.kbId
                                });
                                notifications.show({
                                  color: "indigo",
                                  message: t("documents.reindexRequested", { title: document.title })
                                });
                              } catch (error) {
                                notifications.show({
                                  color: "red",
                                  message: error instanceof Error ? error.message : t("documents.reindexError")
                                });
                              }
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
