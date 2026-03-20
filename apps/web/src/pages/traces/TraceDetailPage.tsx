import {
  Alert,
  Anchor,
  Badge,
  Card,
  Code,
  Grid,
  Group,
  Loader,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Title
} from "@mantine/core";
import { Link, useParams } from "react-router-dom";
import { useTrace } from "../../features/api/hooks";
import { useI18n } from "../../i18n/I18nProvider";
import type { Citation, JsonValue } from "../../types/api";

type RetrievalScoreRecord = {
  chunkId: string;
  documentId: string | null;
  documentTitle: string | null;
  chunkIndex: number | null;
  contentPreview: string | null;
  isPrimary: boolean | null;
  pageNo: number | null;
  sectionTitle: string | null;
  score: number;
  vectorScore: number | null;
  lexicalScore: number | null;
  hybridScore: number | null;
  rerankScore: number | null;
};

function formatJson(value: JsonValue | unknown) {
  if (value == null) {
    return "null";
  }

  return JSON.stringify(value, null, 2);
}

function normalizeChunkIds(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function normalizeScores(value: unknown): RetrievalScoreRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(item => {
      if (
        typeof item !== "object" ||
        item === null ||
        !("chunkId" in item) ||
        !("score" in item) ||
        typeof item.chunkId !== "string" ||
        typeof item.score !== "number"
      ) {
        return null;
      }

      return {
        chunkId: item.chunkId,
        documentId: typeof item.documentId === "string" ? item.documentId : null,
        documentTitle: typeof item.documentTitle === "string" ? item.documentTitle : null,
        chunkIndex: typeof item.chunkIndex === "number" ? item.chunkIndex : null,
        contentPreview: typeof item.contentPreview === "string" ? item.contentPreview : null,
        isPrimary: typeof item.isPrimary === "boolean" ? item.isPrimary : null,
        pageNo: typeof item.pageNo === "number" ? item.pageNo : null,
        sectionTitle: typeof item.sectionTitle === "string" ? item.sectionTitle : null,
        score: item.score,
        vectorScore: typeof item.vectorScore === "number" ? item.vectorScore : null,
        lexicalScore: typeof item.lexicalScore === "number" ? item.lexicalScore : null,
        hybridScore: typeof item.hybridScore === "number" ? item.hybridScore : null,
        rerankScore: typeof item.rerankScore === "number" ? item.rerankScore : null
      };
    })
    .filter((item): item is RetrievalScoreRecord => item !== null);
}

function normalizeCitations(value: unknown): Citation[] {
  return Array.isArray(value) ? (value as Citation[]) : [];
}

function buildDocumentChunkLink(
  documentId: string,
  chunkId: string,
  context?: {
    traceId?: string;
    rank?: number;
    isPrimary?: boolean | null;
    isCited?: boolean;
    score?: number | null;
  }
) {
  const searchParams = new URLSearchParams({
    chunkId
  });

  if (context?.traceId) {
    searchParams.set("fromTrace", context.traceId);
  }
  if (context?.rank != null) {
    searchParams.set("rank", String(context.rank));
  }
  if (context?.isPrimary != null) {
    searchParams.set("isPrimary", context.isPrimary ? "1" : "0");
  }
  if (context?.isCited) {
    searchParams.set("isCited", "1");
  }
  if (context?.score != null) {
    searchParams.set("score", context.score.toFixed(4));
  }

  return `/documents/${documentId}?${searchParams.toString()}`;
}

function formatScore(value: number | null) {
  return value == null ? "-" : value.toFixed(4);
}

export function TraceDetailPage() {
  const { traceId = null } = useParams();
  const traceQuery = useTrace(traceId);
  const trace = traceQuery.data;
  const retrievedChunkIds = normalizeChunkIds(trace?.retrievedChunkIdsJson);
  const scores = normalizeScores(trace?.retrievalScoresJson);
  const citations = normalizeCitations(trace?.citationsJson);
  const { formatDateTime, t } = useI18n();
  const citationsByChunkId = new Map(citations.map(citation => [citation.chunkId, citation]));
  const scoreChunkIds = new Set(scores.map(item => item.chunkId));
  const rankedEntries = [
    ...scores
      .slice()
      .sort((left, right) => right.score - left.score || left.chunkId.localeCompare(right.chunkId)),
    ...retrievedChunkIds
      .filter(chunkId => !scoreChunkIds.has(chunkId))
      .map(chunkId => ({
        chunkId,
        documentId: null,
        documentTitle: null,
        chunkIndex: null,
        contentPreview: null,
        isPrimary: null,
        pageNo: null,
        sectionTitle: null,
        score: 0,
        vectorScore: null,
        lexicalScore: null,
        hybridScore: null,
        rerankScore: null
      }))
  ];
  const hasRewrite = Boolean(trace?.rewrittenQuery);

  return (
    <Stack gap="lg">
      <div>
        <Text c="dimmed" component={Link} size="sm" to="/">
          {t("common.actions.backToChat")}
        </Text>
        <Title order={2} mt={4}>
          {t("trace.title")}
        </Title>
        <Text c="dimmed">{t("trace.subtitle")}</Text>
      </div>

      {traceQuery.isLoading ? <Loader size="sm" /> : null}
      {traceQuery.isError ? (
        <Alert color="red" variant="light">
          {traceQuery.error instanceof Error ? traceQuery.error.message : t("trace.loadError")}
        </Alert>
      ) : null}

      {trace ? (
        <Grid gutter="lg">
          <Grid.Col span={{ base: 12, md: 4 }}>
            <Stack gap="lg">
              <Card padding="lg" radius="lg" withBorder>
                <Stack gap="sm">
                  <Group justify="space-between">
                    <Title order={4}>{trace.id}</Title>
                    <Badge color={trace.status === "success" ? "teal" : "red"} variant="light">
                      {t(`common.status.${trace.status}`)}
                    </Badge>
                  </Group>
                  <Text size="sm">{t("common.fields.created")}: {formatDateTime(trace.createdAt)}</Text>
                  <Text size="sm">{t("common.fields.conversation")}: {trace.conversationId}</Text>
                  <Text size="sm">{t("common.fields.assistant")}: {trace.assistantId}</Text>
                  <Text size="sm">{t("common.fields.latency")}: {trace.latencyMs ?? "-"} ms</Text>
                  <Text size="sm">{t("common.fields.model")}: {trace.modelName ?? "-"}</Text>
                  {trace.errorMessage ? (
                    <Alert color="red" variant="light">
                      {trace.errorMessage}
                    </Alert>
                  ) : null}
                </Stack>
              </Card>

              <Card padding="lg" radius="lg" withBorder>
                <Stack gap="sm">
                  <Group justify="space-between">
                    <Title order={4}>{t("trace.queryComparison")}</Title>
                    <Badge color={hasRewrite ? "blue" : "gray"} variant="light">
                      {hasRewrite ? t("trace.rewriteApplied") : t("trace.rewriteNotApplied")}
                    </Badge>
                  </Group>
                  <Text c="dimmed" size="sm">
                    {t("trace.queryComparisonDescription")}
                  </Text>
                  <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                    <Paper p="sm" radius="md" withBorder>
                      <Stack gap="xs">
                        <Text c="dimmed" size="sm">
                          {t("common.fields.userQuery")}
                        </Text>
                        <Text style={{ whiteSpace: "pre-wrap" }}>{trace.userQuery}</Text>
                      </Stack>
                    </Paper>
                    <Paper p="sm" radius="md" withBorder>
                      <Stack gap="xs">
                        <Text c="dimmed" size="sm">
                          {t("common.fields.rewrittenQuery")}
                        </Text>
                        <Text style={{ whiteSpace: "pre-wrap" }}>
                          {trace.rewrittenQuery ?? t("trace.rewriteSameAsOriginal")}
                        </Text>
                      </Stack>
                    </Paper>
                  </SimpleGrid>
                </Stack>
              </Card>
            </Stack>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 8 }}>
            <Stack gap="lg">
              <Card padding="lg" radius="lg" withBorder>
                <Stack gap="md">
                  <Group justify="space-between">
                    <Title order={4}>{t("trace.retrievedChunks")}</Title>
                    <Badge variant="light">{retrievedChunkIds.length}</Badge>
                  </Group>
                  {rankedEntries.length > 0 ? (
                    <Stack gap="sm">
                      <Text c="dimmed" size="sm">
                      {scores.length > 0 ? t("trace.sortedByScore") : t("trace.sortedByTraceOrder")}
                      </Text>
                      {rankedEntries.map((item, index) => {
                        const linkedCitation = citationsByChunkId.get(item.chunkId);
                        const linkDocumentId = item.documentId ?? linkedCitation?.documentId ?? null;
                        const canLink = linkDocumentId != null;
                        const titleText = item.documentTitle ?? linkedCitation?.documentTitle ?? item.chunkId;
                        const sectionText = item.sectionTitle ?? linkedCitation?.sectionTitle ?? null;
                        const pageNo = item.pageNo ?? linkedCitation?.pageNo ?? null;
                        const isCited = linkedCitation != null;

                        return (
                          <Paper key={item.chunkId} p="sm" radius="md" withBorder>
                            <Stack gap="sm">
                              <Group justify="space-between" align="flex-start">
                                <Stack gap={4}>
                                  <Group gap="xs">
                                    <Badge variant="light">{t("trace.rankLabel", { rank: index + 1 })}</Badge>
                                    {item.isPrimary === true ? (
                                      <Badge color="teal" variant="light">
                                        {t("trace.primaryChunk")}
                                      </Badge>
                                    ) : item.isPrimary === false ? (
                                      <Badge color="gray" variant="light">
                                        {t("trace.neighborChunk")}
                                      </Badge>
                                    ) : null}
                                    {isCited ? (
                                      <Badge color="blue" variant="light">
                                        {t("trace.citedChunk")}
                                      </Badge>
                                    ) : null}
                                  </Group>
                                  {canLink ? (
                                    <Anchor
                                      component={Link}
                                      to={buildDocumentChunkLink(linkDocumentId, item.chunkId, {
                                        traceId: trace.id,
                                        rank: index + 1,
                                        isPrimary: item.isPrimary,
                                        isCited,
                                        score: item.score
                                      })}
                                    >
                                      {titleText}
                                    </Anchor>
                                  ) : (
                                    <Text fw={600}>{titleText}</Text>
                                  )}
                                  <Group gap="xs">
                                    <Code>{item.chunkId}</Code>
                                    {item.chunkIndex != null ? <Badge variant="light">#{item.chunkIndex}</Badge> : null}
                                  </Group>
                                  {sectionText || pageNo != null ? (
                                    <Text c="dimmed" size="sm">
                                      {sectionText ?? t("common.misc.noSection")}
                                      {pageNo != null ? ` · ${t("common.misc.pageLong", { pageNo })}` : ""}
                                    </Text>
                                  ) : null}
                                </Stack>
                                <Badge color="blue" size="lg" variant="light">
                                  {t("trace.finalScoreLabel", { score: formatScore(item.score) })}
                                </Badge>
                              </Group>
                              <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="xs">
                                <Badge color="gray" variant="light">
                                  {t("trace.vectorScoreLabel", { score: formatScore(item.vectorScore) })}
                                </Badge>
                                <Badge color="gray" variant="light">
                                  {t("trace.lexicalScoreLabel", { score: formatScore(item.lexicalScore) })}
                                </Badge>
                                <Badge color="gray" variant="light">
                                  {t("trace.hybridScoreLabel", { score: formatScore(item.hybridScore) })}
                                </Badge>
                                <Badge color="gray" variant="light">
                                  {t("trace.rerankScoreLabel", { score: formatScore(item.rerankScore) })}
                                </Badge>
                              </SimpleGrid>
                              {item.contentPreview || linkedCitation ? (
                                <Paper bg="gray.0" p="sm" radius="md" withBorder>
                                  <Stack gap={6}>
                                    <Text c="dimmed" size="xs">
                                      {t("trace.chunkPreview")}
                                    </Text>
                                    <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
                                      {isCited ? linkedCitation.snippet : item.contentPreview}
                                    </Text>
                                  </Stack>
                                </Paper>
                              ) : null}
                            </Stack>
                          </Paper>
                        );
                      })}
                    </Stack>
                  ) : (
                    <Alert color="gray" variant="light">
                      {t("trace.noRetrievedChunks")}
                    </Alert>
                  )}
                </Stack>
              </Card>

              <Card padding="lg" radius="lg" withBorder>
                <Stack gap="md">
                  <Group justify="space-between">
                    <Title order={4}>{t("trace.citations")}</Title>
                    <Badge variant="light">{citations.length}</Badge>
                  </Group>
                  {citations.map(citation => (
                    <Paper key={citation.chunkId} p="md" radius="md" withBorder>
                      <Stack gap="xs">
                        <Group justify="space-between" align="flex-start">
                          <Anchor
                            component={Link}
                            fw={600}
                            to={buildDocumentChunkLink(citation.documentId, citation.chunkId, {
                              traceId: trace.id,
                              isCited: true
                            })}
                          >
                            {citation.documentTitle}
                          </Anchor>
                          <Code>{citation.chunkId}</Code>
                        </Group>
                        <Text c="dimmed" size="sm">
                          {citation.sectionTitle ?? t("common.misc.noSection")}
                          {citation.pageNo != null ? ` · ${t("common.misc.pageLong", { pageNo: citation.pageNo })}` : ""}
                        </Text>
                        <Text style={{ whiteSpace: "pre-wrap" }}>{citation.snippet}</Text>
                      </Stack>
                    </Paper>
                  ))}
                  {citations.length === 0 ? (
                    <Alert color="gray" variant="light">
                      {t("trace.noCitations")}
                    </Alert>
                  ) : null}
                </Stack>
              </Card>

              <Card padding="lg" radius="lg" withBorder>
                <Stack gap="sm">
                  <Title order={4}>{t("common.fields.rawPayload")}</Title>
                  <Code block>{formatJson({
                    retrievedChunkIdsJson: trace.retrievedChunkIdsJson,
                    retrievalScoresJson: trace.retrievalScoresJson,
                    citationsJson: trace.citationsJson
                  })}</Code>
                </Stack>
              </Card>
            </Stack>
          </Grid.Col>
        </Grid>
      ) : null}
    </Stack>
  );
}
