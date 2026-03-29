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
} from "@mantine/core";
import { Link } from "react-router-dom";
import { StatePanel } from "../../components/StatePanel";
import { useConversations, useLatestConversationTraces } from "../../features/api/hooks";
import { useI18n } from "../../i18n/I18nProvider";
import type { TraceRecord } from "../../types/api";

function GroupLoader() {
  return (
    <Stack aria-live="polite" gap={6} role="status">
      <Loader color="indigo" size="sm" />
      <Text c="var(--app-text-muted)" size="xs">
        Loading latest trace...
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
  const { formatDateTime, locale } = useI18n();

  return (
    <Paper className="workspace-citation-card workspace-panel-muted" p="lg" radius="xl">
      <Stack gap="md">
        <Group align="flex-start" justify="space-between" wrap="nowrap">
          <Stack gap={8}>
            <div>
              <Text c="var(--app-text)" fw={700} size="sm">
                {conversationTitle}
              </Text>
              <Text c="var(--app-text-secondary)" lineClamp={2} mt={6} size="sm">
                {latestTrace.userQuery}
              </Text>
            </div>
            <Group gap="xs">
              <Badge color={latestTrace.status === "success" ? "teal" : "red"} radius="sm" variant="light">
                {latestTrace.status}
              </Badge>
              <Badge color="gray" radius="sm" variant="light">
                {latestTrace.modelName ?? (locale === "zh" ? "未记录模型" : "No model")}
              </Badge>
            </Group>
          </Stack>
          <Text c="var(--app-text-muted)" size="xs">
            {formatDateTime(latestTrace.createdAt)}
          </Text>
        </Group>

        <div className="workspace-meta-list">
          <div className="workspace-meta-row">
            <span className="workspace-meta-label">{locale === "zh" ? "最新结果" : "Latest result"}</span>
            <span className="workspace-meta-value">
              {latestTrace.status === "success"
                ? locale === "zh"
                  ? "回答链路已完成"
                  : "Answer pipeline completed"
                : locale === "zh"
                  ? "本轮需要排查"
                  : "Needs inspection"}
            </span>
          </div>
          <div className="workspace-meta-row">
            <span className="workspace-meta-label">{locale === "zh" ? "追踪编号" : "Trace id"}</span>
            <span className="workspace-meta-value">{latestTrace.id}</span>
          </div>
        </div>

        <Stack gap="xs">
          <Anchor c="var(--app-text)" component={Link} fw={600} size="sm" to={`/traces/${latestTrace.id}`}>
            {locale === "zh" ? "查看 Trace 详情" : "View trace details"}
          </Anchor>
          <Anchor c="var(--app-text-muted)" component={Link} size="sm" to="/">
            {locale === "zh" ? "回到对话" : "Back to chat"}
          </Anchor>
        </Stack>
      </Stack>
    </Paper>
  );
}

export function TraceListPage() {
  const conversationsQuery = useConversations();
  const { locale } = useI18n();
  const conversationCount = conversationsQuery.data?.length ?? 0;
  const conversationIds = conversationsQuery.data?.map(conversation => conversation.id) ?? [];
  const latestTracesQuery = useLatestConversationTraces(conversationIds, conversationsQuery.isSuccess);
  const traceErrorMessage =
    latestTracesQuery.error instanceof Error
      ? latestTracesQuery.error.message
      : locale === "zh"
        ? "Trace 加载失败"
        : "Failed to load traces";
  const traceCards =
    conversationsQuery.data?.flatMap(conversation => {
      const latestTrace = latestTracesQuery.latestTraceByConversationId[conversation.id] ?? null;
      return latestTrace ? [{ conversation, latestTrace }] : [];
    }) ?? [];

  return (
    <Stack gap="md">
      <Paper className="workspace-hero" p="lg" radius="xl">
        <div className="workspace-hero-split">
          <div className="workspace-hero-copy">
            <Text className="workspace-hero-kicker">RAG System / Trace</Text>
            <Title
              order={3}
              c="var(--app-text)"
              style={{ fontFamily: "var(--app-font-display)", letterSpacing: "-0.03em" }}
            >
              {locale === "zh" ? "Trace 工作台" : "Trace log"}
            </Title>
            <Text c="var(--app-text-muted)" mt={4} size="sm">
              {locale === "zh"
                ? "保留 conversation -> latest trace -> detail 的原有路径，只把列表改得更像产品页面而不是诊断台账。"
                : "Keep the same list-to-detail flow, but present the latest trace for each conversation with clearer product-facing hierarchy."}
            </Text>
          </div>
          <Stack align="flex-end" gap={10}>
            <Badge color="indigo" radius="sm" variant="light">
              {conversationCount}
            </Badge>
            <Text className="workspace-hero-sidecopy" ta="right">
              {locale === "zh"
                ? "先看问题本身、结果状态和时间，再决定是否进入 Trace 详情。"
                : "Scan the user question, outcome, and timing first, then open the detailed trace only when needed."}
            </Text>
          </Stack>
        </div>
      </Paper>

      {conversationsQuery.isLoading ? (
        <div aria-live="polite" className="workspace-loading-grid" role="status">
          {Array.from({ length: 4 }).map((_, index) => (
            <Paper className="workspace-panel-hover workspace-skeleton-panel" key={index} p="lg" radius="xl">
              <Stack gap="md">
                <div className="workspace-skeleton-line medium" />
                <div className="workspace-skeleton-line short" />
                <div className="workspace-skeleton-line long" />
                <div className="workspace-skeleton-line medium" />
              </Stack>
            </Paper>
          ))}
          <span className="sr-only">{locale === "zh" ? "加载会话中" : "Loading conversations"}</span>
        </div>
      ) : conversationsQuery.isError ? (
        <StatePanel
          description={conversationsQuery.error instanceof Error ? conversationsQuery.error.message : undefined}
          title={locale === "zh" ? "会话加载失败" : "Failed to load conversations"}
          tone="error"
        />
      ) : conversationsQuery.data?.length ? (
        <div className="workspace-trace-list">
          {latestTracesQuery.isLoading ? (
            <Paper className="workspace-panel-muted" mb="md" p="lg" radius="xl">
              <GroupLoader />
            </Paper>
          ) : null}
          {latestTracesQuery.isError ? (
            <Alert color="red" mb="md" radius="lg" variant="light">
              {locale === "zh"
                ? `部分 Trace 加载失败（${latestTracesQuery.failedConversationCount} 个会话）。${traceErrorMessage}`
                : `Failed to load traces for ${latestTracesQuery.failedConversationCount} conversation(s). ${traceErrorMessage}`}
            </Alert>
          ) : null}
          <div className={conversationsQuery.data.length === 1 ? "workspace-list-shell-compact" : undefined}>
            <SimpleGrid cols={{ base: 1, lg: conversationsQuery.data.length > 1 ? 2 : 1 }} spacing="md">
              {traceCards.map(({ conversation, latestTrace }) => (
                <TraceConversationCard
                  conversationTitle={conversation.title}
                  latestTrace={latestTrace}
                  key={conversation.id}
                />
              ))}
            </SimpleGrid>
          </div>
        </div>
      ) : (
        <StatePanel
          description={locale === "zh" ? "还没有可检查 trace 的会话。" : "There are no conversations to inspect yet."}
          title={locale === "zh" ? "暂无会话" : "No conversations"}
        />
      )}

      <Button
        className="workspace-button"
        color="indigo"
        component={Link}
        radius="xl"
        to="/"
        variant="light"
        w="fit-content"
      >
        {locale === "zh" ? "回到对话" : "Back to chat"}
      </Button>
    </Stack>
  );
}
