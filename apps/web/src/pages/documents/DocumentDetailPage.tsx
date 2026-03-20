import {
  Alert,
  Badge,
  Button,
  Card,
  Code,
  Divider,
  Grid,
  Group,
  Loader,
  Paper,
  Stack,
  Text,
  Title
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useEffect, useRef } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
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
  const { formatDateTime, t } = useI18n();

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
    <Stack gap="lg">
      <div>
        <Text c="dimmed" component={Link} size="sm" to="/documents">
          {t("common.actions.backToDocuments")}
        </Text>
        <Title order={2} mt={4}>
          {t("documents.detail.title")}
        </Title>
        <Text c="dimmed">{t("documents.detail.subtitle")}</Text>
      </div>

      {documentQuery.isLoading ? <Loader size="sm" /> : null}
      {documentQuery.isError ? (
        <Alert color="red" variant="light">
          {documentQuery.error instanceof Error ? documentQuery.error.message : t("documents.detail.loadError")}
        </Alert>
      ) : null}

      {document ? (
        <Grid gutter="lg">
          <Grid.Col span={{ base: 12, md: 4 }}>
            <Stack gap="lg">
              <Card padding="lg" radius="lg" withBorder>
                <Stack gap="sm">
                  <Group justify="space-between">
                    <Title order={4}>{document.title}</Title>
                    <Badge
                      color={document.status === "ready" ? "teal" : document.status === "failed" ? "red" : "yellow"}
                      variant="light"
                    >
                      {t(`common.status.${document.status}`)}
                    </Badge>
                  </Group>
                  <Text c="dimmed" size="sm">
                    {document.sourceName}
                  </Text>
                  <Group>
                    <Button
                      loading={reindexMutation.isPending}
                      onClick={async () => {
                        try {
                          await reindexMutation.mutateAsync({
                            documentId: document.id,
                            knowledgeBaseId: document.kbId
                          });
                          notifications.show({
                            color: "teal",
                            message: t("documents.reindexRequested", { title: document.title })
                          });
                        } catch (error) {
                          notifications.show({
                            color: "red",
                            message: error instanceof Error ? error.message : t("documents.reindexError")
                          });
                        }
                      }}
                      size="xs"
                      variant="light"
                    >
                      {t("common.actions.reindex")}
                    </Button>
                    <Button
                      color="red"
                      loading={deleteMutation.isPending}
                      onClick={async () => {
                        try {
                          await deleteMutation.mutateAsync({
                            documentId: document.id
                          });
                          notifications.show({
                            color: "teal",
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
                      size="xs"
                      variant="light"
                    >
                      {t("common.actions.delete")}
                    </Button>
                  </Group>
                  <Divider />
                  {(document.status === "pending" || document.status === "processing") ? (
                    <Alert color="yellow" variant="light">
                      {t("documents.detail.processingAlert")}
                    </Alert>
                  ) : null}
                  {document.status === "failed" ? (
                    <Alert color="red" variant="light">
                      {t("documents.detail.failedAlert")}
                    </Alert>
                  ) : null}
                  <Text size="sm">{t("common.fields.stage")}: {t(`common.processingStage.${document.processingStage}`)}</Text>
                  <Text size="sm">{t("common.fields.chunks")}: {document.chunkCount}</Text>
                  <Text size="sm">{t("common.fields.version")}: {document.version}</Text>
                  <Text size="sm">{t("common.fields.mime")}: {document.mimeType}</Text>
                  <Text size="sm">{t("common.fields.created")}: {formatDateTime(document.createdAt)}</Text>
                  <Text size="sm">{t("common.fields.updated")}: {formatDateTime(document.updatedAt)}</Text>
                </Stack>
              </Card>

              <Card padding="lg" radius="lg" withBorder>
                <Stack gap="xs">
                  <Text c="dimmed" size="sm">
                    {t("common.fields.storageKey")}
                  </Text>
                  <Code block>{document.storageKey}</Code>
                  {document.errorMessage ? (
                    <Alert color="red" mt="sm" variant="light">
                      {document.errorMessage}
                    </Alert>
                  ) : null}
                </Stack>
              </Card>
            </Stack>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 8 }}>
            <Card padding="lg" radius="lg" withBorder>
              <Stack gap="md">
                <Group justify="space-between">
                  <Title order={4}>{t("documents.detail.chunksTitle")}</Title>
                  <Badge variant="light">{chunksQuery.data?.length ?? 0}</Badge>
                </Group>

                {chunksQuery.isLoading ? <Loader size="sm" /> : null}
                {chunksQuery.isError ? (
                  <Alert color="red" variant="light">
                    {chunksQuery.error instanceof Error ? chunksQuery.error.message : t("documents.detail.chunksLoadError")}
                  </Alert>
                ) : null}

                {focusedChunkId && sourceTraceId ? (
                  <Alert color="blue" variant="light">
                    <Stack gap={6}>
                      <Text fw={600}>{t("documents.detail.traceFocusTitle")}</Text>
                      <Text size="sm">
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
                          <Badge color="teal" variant="light">
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
                  </Alert>
                ) : null}

                {chunksQuery.data?.map(chunk => (
                  <Paper
                    key={chunk.id}
                    bg={focusedChunkId === chunk.id ? "teal.0" : undefined}
                    p="md"
                    radius="md"
                    ref={node => {
                      chunkRefs.current[chunk.id] = node;
                    }}
                    style={
                      focusedChunkId === chunk.id
                        ? {
                            borderColor: "var(--mantine-color-teal-4)",
                            boxShadow: "0 0 0 1px var(--mantine-color-teal-4)"
                          }
                        : undefined
                    }
                    withBorder
                  >
                    <Stack gap="xs">
                      <Group justify="space-between" align="flex-start">
                        <Group gap="xs">
                          <Badge variant="light">#{chunk.chunkIndex}</Badge>
                          {focusedChunkId === chunk.id ? (
                            <Badge color="teal" variant="filled">
                              {t("common.misc.focused")}
                            </Badge>
                          ) : null}
                          {focusedChunkId === chunk.id && focusedIsPrimary === "1" ? (
                            <Badge color="teal" variant="light">
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
                          {chunk.pageNo != null ? <Badge color="blue" variant="light">{t("common.misc.pageShort", { pageNo: chunk.pageNo })}</Badge> : null}
                        </Group>
                        <Text c="dimmed" size="xs">
                          {chunk.id}
                        </Text>
                      </Group>
                      {chunk.sectionTitle ? <Text fw={600}>{chunk.sectionTitle}</Text> : null}
                      <Text c="dimmed" size="xs">
                        {t("common.misc.tokenCount")}: {chunk.tokenCount}
                      </Text>
                      <Text style={{ whiteSpace: "pre-wrap" }}>{chunk.content}</Text>
                      {chunk.metadataJson ? (
                        <Code block>{formatJson(chunk.metadataJson)}</Code>
                      ) : null}
                    </Stack>
                  </Paper>
                ))}

                {chunksQuery.data?.length === 0 ? (
                  <Alert color="gray" variant="light">
                    {t("documents.detail.noChunks")}
                  </Alert>
                ) : null}
                {focusedChunkId && chunksQuery.data && !chunksQuery.data.some(chunk => chunk.id === focusedChunkId) ? (
                  <Alert color="yellow" variant="light">
                    {t("documents.detail.linkedChunkMissing")}
                  </Alert>
                ) : null}
                {sourceTraceId ? (
                  <Text c="dimmed" size="sm">
                    <Text component={Link} inherit to={`/traces/${sourceTraceId}`}>
                      {t("documents.detail.backToTrace")}
                    </Text>
                  </Text>
                ) : null}
              </Stack>
            </Card>
          </Grid.Col>
        </Grid>
      ) : null}
    </Stack>
  );
}
