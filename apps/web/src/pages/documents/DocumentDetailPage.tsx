import {
  Alert,
  Badge,
  Box,
  Button,
  Divider,
  Group,
  Paper,
  Stack,
  Text,
  Title
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useEffect, useRef } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { StatePanel } from "../../components/StatePanel";
import { useDeleteDocument, useDocument, useDocumentChunks, useReindexDocument } from "../../features/api/hooks";
import { useI18n } from "../../i18n/I18nProvider";
import type { JsonValue } from "../../types/api";

function formatJson(value: JsonValue | unknown) {
  if (value == null) {
    return "null";
  }

  return JSON.stringify(value, null, 2);
}

export function DocumentDetailPage() {
  const { documentId = null } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const focusedChunkId = searchParams.get("chunkId");
  const sourceTraceId = searchParams.get("fromTrace");
  const focusedRank = searchParams.get("rank");
  const focusedScore = searchParams.get("score");
  const focusedIsPrimary = searchParams.get("isPrimary");
  const focusedIsCited = searchParams.get("isCited") === "1";
  const documentQuery = useDocument(documentId);
  const chunksQuery = useDocumentChunks(documentId);
  const reindexMutation = useReindexDocument();
  const deleteMutation = useDeleteDocument();
  const document = documentQuery.data;
  const chunkRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const { formatDateTime, t, locale } = useI18n();

  useEffect(() => {
    if (!focusedChunkId || !chunksQuery.data) {
      return;
    }

    const hasTargetChunk = chunksQuery.data.some(chunk => chunk.id === focusedChunkId);
    if (!hasTargetChunk) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      chunkRefs.current[focusedChunkId]?.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });
    }, 50);

    return () => window.clearTimeout(timeoutId);
  }, [focusedChunkId, chunksQuery.data]);

  return (
    <Stack gap="md">
      <Paper className="workspace-hero" p="lg" radius="xl">
        <Stack gap={10}>
          <Text c="var(--app-text-muted)" className="workspace-link" component={Link} size="sm" to="/documents">
            {t("common.actions.backToDocuments")}
          </Text>
          <div className="workspace-hero-split">
            <Group gap="md" wrap="nowrap">
              <Box className="workspace-hero-icon">DOC</Box>
              <div className="workspace-hero-copy">
                <Text className="workspace-hero-kicker">
                  {locale === "zh" ? "文档详情" : "Document detail"}
                </Text>
                <Title
                  order={3}
                  c="var(--app-text)"
                  style={{ fontFamily: "var(--app-font-display)", letterSpacing: "-0.03em" }}
                >
                  {document?.title ?? t("documents.detail.title")}
                </Title>
                <Text c="var(--app-text-muted)" mt={4} size="sm">
                  {document?.sourceName ?? t("documents.detail.subtitle")}
                </Text>
              </div>
            </Group>

            {document ? (
              <Stack align="flex-end" gap={10}>
                <Group gap="xs">
                  <Badge
                    color={document.status === "ready" ? "indigo" : document.status === "failed" ? "red" : "yellow"}
                    variant="light"
                  >
                    {t(`common.status.${document.status}`)}
                  </Badge>
                  <Badge color="gray" variant="light">
                    {document.chunkCount} chunks
                  </Badge>
                </Group>
                <Text className="workspace-hero-sidecopy" ta="right">
                  {locale === "zh"
                    ? "保留现有 trace 深链和 chunk 聚焦能力，只继续收紧信息层级、状态分区和阅读密度。"
                    : "Keep the same trace deep-link flow and tighten hierarchy, focus states, and reading density only."}
                </Text>
              </Stack>
            ) : null}
          </div>
        </Stack>
      </Paper>

      {documentQuery.isLoading ? (
        <StatePanel
          description={t("documents.detail.subtitle")}
          title={t("documents.detail.title")}
          tone="loading"
        />
      ) : null}
      {documentQuery.isError ? (
        <Alert color="red" radius="xl" variant="light">
          {documentQuery.error instanceof Error ? documentQuery.error.message : t("documents.detail.loadError")}
        </Alert>
      ) : null}

      {document ? (
        <div className="workspace-page-grid">
          <div className="workspace-page-side-stack">
            <div className="workspace-sticky-panel">
              <Stack gap="md">
                <Paper className="workspace-panel-hover workspace-panel-strong" p="lg" radius="xl">
                  <Stack gap="md">
                    <Group justify="space-between" wrap="nowrap">
                      <Text className="workspace-section-heading">
                        {locale === "zh" ? "文档状态" : "Document status"}
                      </Text>
                      <Badge
                        color={document.status === "ready" ? "indigo" : document.status === "failed" ? "red" : "yellow"}
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
                      <Button
                        className="workspace-button"
                        color="red"
                        loading={deleteMutation.isPending}
                        onClick={async () => {
                          try {
                            await deleteMutation.mutateAsync({
                              documentId: document.id
                            });
                            notifications.show({
                              color: "indigo",
                              message: t("documents.detail.deleteSuccess", { title: document.title })
                            });
                            navigate("/documents");
                          } catch (error) {
                            notifications.show({
                              color: "red",
                              message: error instanceof Error ? error.message : t("documents.detail.deleteError")
                            });
                          }
                        }}
                        radius="xl"
                        size="xs"
                        variant="light"
                      >
                        {t("common.actions.delete")}
                      </Button>
                    </Group>

                    <Divider color="var(--app-border)" />

                    {document.status === "pending" || document.status === "processing" ? (
                      <Alert color="yellow" radius="xl" variant="light">
                        {t("documents.detail.processingAlert")}
                      </Alert>
                    ) : null}
                    {document.status === "failed" ? (
                      <Alert color="red" radius="xl" variant="light">
                        {t("documents.detail.failedAlert")}
                      </Alert>
                    ) : null}

                    <div className="workspace-meta-list">
                      <div className="workspace-meta-row">
                        <span className="workspace-meta-label">{t("common.fields.stage")}</span>
                        <span className="workspace-meta-value">
                          {t(`common.processingStage.${document.processingStage}`)}
                        </span>
                      </div>
                      <div className="workspace-meta-row">
                        <span className="workspace-meta-label">{t("common.fields.chunks")}</span>
                        <span className="workspace-meta-value">{document.chunkCount}</span>
                      </div>
                      <div className="workspace-meta-row">
                        <span className="workspace-meta-label">{t("common.fields.version")}</span>
                        <span className="workspace-meta-value">{document.version}</span>
                      </div>
                      <div className="workspace-meta-row">
                        <span className="workspace-meta-label">{t("common.fields.mime")}</span>
                        <span className="workspace-meta-value">{document.mimeType}</span>
                      </div>
                      <div className="workspace-meta-row">
                        <span className="workspace-meta-label">{t("common.fields.created")}</span>
                        <span className="workspace-meta-value">{formatDateTime(document.createdAt)}</span>
                      </div>
                      <div className="workspace-meta-row">
                        <span className="workspace-meta-label">{t("common.fields.updated")}</span>
                        <span className="workspace-meta-value">{formatDateTime(document.updatedAt)}</span>
                      </div>
                    </div>
                  </Stack>
                </Paper>

                <Paper className="workspace-panel-hover workspace-panel-muted" p="lg" radius="xl">
                  <Stack gap="sm">
                    <Text className="workspace-section-heading">
                      {locale === "zh" ? "存储与诊断" : "Storage and diagnostics"}
                    </Text>
                    <Text className="workspace-section-copy">
                      {locale === "zh"
                        ? "保留底层存储标识和错误信息，但降为次级信息区。"
                        : "Keep the storage key and error details available, but treat them as secondary diagnostics."}
                    </Text>
                    <pre className="workspace-code-block workspace-code-block-scroll">{document.storageKey}</pre>
                    {document.errorMessage ? (
                      <Alert color="red" mt="sm" radius="xl" variant="light">
                        {document.errorMessage}
                      </Alert>
                    ) : null}
                  </Stack>
                </Paper>
              </Stack>
            </div>
          </div>

          <div className="workspace-page-main-stack">
            <Paper className="workspace-panel-hover workspace-panel-strong" p="lg" radius="xl">
              <Stack gap="md">
                <Group justify="space-between" wrap="nowrap">
                  <div>
                    <Text className="workspace-section-heading">{t("documents.detail.chunksTitle")}</Text>
                    <Text className="workspace-section-copy">
                      {locale === "zh"
                        ? "Chunk 列表逻辑不变，只继续压缩间距、聚焦态和来自 trace 的定位信息。"
                        : "The chunk list keeps its logic unchanged and only tightens hierarchy, focus state, and density."}
                    </Text>
                  </div>
                  <Badge color="indigo" variant="light">
                    {chunksQuery.data?.length ?? 0}
                  </Badge>
                </Group>

                {chunksQuery.isLoading ? (
                  <StatePanel
                    description={t("documents.detail.subtitle")}
                    title={t("documents.detail.chunksTitle")}
                    tone="loading"
                  />
                ) : null}
                {chunksQuery.isError ? (
                  <Alert color="red" radius="xl" variant="light">
                    {chunksQuery.error instanceof Error ? chunksQuery.error.message : t("documents.detail.chunksLoadError")}
                  </Alert>
                ) : null}

                {focusedChunkId && sourceTraceId ? (
                  <Paper className="workspace-focus-banner" p="md" radius="xl">
                    <Stack gap={6}>
                      <Text c="var(--app-text)" fw={700} size="sm">
                        {t("documents.detail.traceFocusTitle")}
                      </Text>
                      <Text c="var(--app-text-secondary)" size="sm">
                        {t("documents.detail.traceFocusDescription", { traceId: sourceTraceId })}
                      </Text>
                      <Group gap="xs">
                        {focusedRank ? (
                          <Badge variant="light">{t("documents.detail.traceRankLabel", { rank: focusedRank })}</Badge>
                        ) : null}
                        {focusedScore ? (
                          <Badge color="blue" variant="light">
                            {t("documents.detail.traceScoreLabel", { score: focusedScore })}
                          </Badge>
                        ) : null}
                        {focusedIsPrimary === "1" ? (
                          <Badge color="indigo" variant="light">
                            {t("documents.detail.tracePrimary")}
                          </Badge>
                        ) : focusedIsPrimary === "0" ? (
                          <Badge color="gray" variant="light">
                            {t("documents.detail.traceNeighbor")}
                          </Badge>
                        ) : null}
                        {focusedIsCited ? (
                          <Badge color="blue" variant="light">
                            {t("documents.detail.traceCited")}
                          </Badge>
                        ) : null}
                      </Group>
                    </Stack>
                  </Paper>
                ) : null}

                <div className="workspace-collection-grid">
                  {chunksQuery.data?.map(chunk => (
                    <Paper
                      className="workspace-panel-hover"
                      key={chunk.id}
                      p="md"
                      radius="lg"
                      ref={node => {
                        chunkRefs.current[chunk.id] = node;
                      }}
                      style={{
                        background:
                          focusedChunkId === chunk.id
                            ? "linear-gradient(180deg, rgba(99, 102, 241, 0.16) 0%, rgba(99, 102, 241, 0.08) 100%)"
                            : "linear-gradient(180deg, rgba(30, 30, 38, 0.96) 0%, rgba(24, 24, 31, 0.98) 100%)",
                        border:
                          focusedChunkId === chunk.id
                            ? "1px solid rgba(99, 102, 241, 0.32)"
                            : "1px solid rgba(255,255,255,0.06)",
                        boxShadow:
                          focusedChunkId === chunk.id
                            ? "0 18px 36px rgba(99, 102, 241, 0.16)"
                            : "0 12px 24px rgba(0, 0, 0, 0.14), inset 0 1px 0 rgba(255,255,255,0.02)"
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
                                  {t("common.misc.focused")}
                                </Badge>
                              ) : null}
                              {focusedChunkId === chunk.id && focusedIsPrimary === "1" ? (
                                <Badge color="indigo" variant="light">
                                  {t("documents.detail.tracePrimary")}
                                </Badge>
                              ) : null}
                              {focusedChunkId === chunk.id && focusedIsPrimary === "0" ? (
                                <Badge color="gray" variant="light">
                                  {t("documents.detail.traceNeighbor")}
                                </Badge>
                              ) : null}
                              {focusedChunkId === chunk.id && focusedIsCited ? (
                                <Badge color="blue" variant="light">
                                  {t("documents.detail.traceCited")}
                                </Badge>
                              ) : null}
                              {focusedChunkId === chunk.id && focusedRank ? (
                                <Badge variant="light">
                                  {t("documents.detail.traceRankLabel", { rank: focusedRank })}
                                </Badge>
                              ) : null}
                              {chunk.pageNo != null ? (
                                <Badge color="blue" variant="light">
                                  {t("common.misc.pageShort", { pageNo: chunk.pageNo })}
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
                              {t("common.misc.tokenCount")}: {chunk.tokenCount}
                            </Text>
                            <Text c="var(--app-text-secondary)" size="sm" style={{ whiteSpace: "pre-wrap" }}>
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

                {chunksQuery.data?.length === 0 ? (
                  <StatePanel
                    description={t("documents.detail.noChunks")}
                    title={t("documents.detail.chunksTitle")}
                  />
                ) : null}
                {focusedChunkId && chunksQuery.data && !chunksQuery.data.some(chunk => chunk.id === focusedChunkId) ? (
                  <Alert color="yellow" radius="xl" variant="light">
                    {t("documents.detail.linkedChunkMissing")}
                  </Alert>
                ) : null}
                {sourceTraceId ? (
                  <Text c="var(--app-text-muted)" size="sm">
                    <Text className="workspace-link" component={Link} inherit to={`/traces/${sourceTraceId}`}>
                      {t("documents.detail.backToTrace")}
                    </Text>
                  </Text>
                ) : null}
              </Stack>
            </Paper>
          </div>
        </div>
      ) : null}
    </Stack>
  );
}
