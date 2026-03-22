import {
  Alert,
  Anchor,
  Badge,
  Button,
  Divider,
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
import { useConversationTraces, useConversations } from "../../features/api/hooks";
import { useI18n } from "../../i18n/I18nProvider";

function GroupLoader() {
  return (
    <Stack gap={6}>
      <Loader color="indigo" size="sm" />
      <Text c="var(--app-text-muted)" size="xs">
        Loading latest trace...
      </Text>
    </Stack>
  );
}

function TraceConversationCard({
  conversationId,
  conversationTitle
}: {
  conversationId: string;
  conversationTitle: string;
}) {
  const tracesQuery = useConversationTraces(conversationId);
  const { formatDateTime, locale } = useI18n();
  const latestTrace = tracesQuery.data?.[0] ?? null;

  if (tracesQuery.isLoading) {
    return (
      <Paper className="workspace-panel-hover workspace-panel-muted" p="lg" radius="xl">
        <Stack gap="xs">
          <Text c="var(--app-text)" fw={600} size="sm">
            {conversationTitle}
          </Text>
          <GroupLoader />
        </Stack>
      </Paper>
    );
  }

  if (tracesQuery.isError) {
    return (
      <Paper className="workspace-panel-hover workspace-panel-muted" p="lg" radius="xl">
        <Stack gap="xs">
          <Text c="var(--app-text)" fw={600} size="sm">
            {conversationTitle}
          </Text>
          <Alert color="red" radius="lg" variant="light">
            {tracesQuery.error instanceof Error
              ? tracesQuery.error.message
              : locale === "zh"
                ? "Trace 加载失败"
                : "Failed to load traces"}
          </Alert>
        </Stack>
      </Paper>
    );
  }

  if (!latestTrace) {
    return null;
  }

  return (
    <Paper className="workspace-citation-card workspace-panel-muted" p="lg" radius="xl">
      <Stack gap="md">
        <Stack gap={8}>
          <div>
            <Text c="var(--app-text)" fw={700} size="sm">
              {conversationTitle}
            </Text>
            <Text c="var(--app-text-muted)" size="xs">
              {locale === "zh" ? "会话 ID" : "Conversation ID"}: {conversationId}
            </Text>
          </div>
          <Group gap="xs">
            <Badge color={latestTrace.status === "success" ? "teal" : "red"} radius="sm" variant="light">
              {latestTrace.status}
            </Badge>
            <Badge color="gray" radius="sm" variant="light">
              {latestTrace.modelName ?? "-"}
            </Badge>
          </Group>
        </Stack>

        <Divider color="var(--app-border)" />

        <div className="workspace-meta-list">
          <div className="workspace-meta-row">
            <span className="workspace-meta-label">{locale === "zh" ? "最新 Trace" : "Latest trace"}</span>
            <span className="workspace-meta-value">{latestTrace.id}</span>
          </div>
          <div className="workspace-meta-row">
            <span className="workspace-meta-label">{locale === "zh" ? "创建时间" : "Created"}</span>
            <span className="workspace-meta-value">{formatDateTime(latestTrace.createdAt)}</span>
          </div>
        </div>

        <div className="workspace-content-block">
          <Stack gap={6}>
            <Text c="var(--app-text-muted)" size="xs">
              {locale === "zh" ? "用户问题" : "User query"}
            </Text>
            <Text c="var(--app-text-secondary)" lineClamp={3} size="sm">
              {latestTrace.userQuery}
            </Text>
          </Stack>
        </div>

        <Stack gap="xs">
          <Anchor c="var(--app-text)" component={Link} fw={600} size="sm" to={`/traces/${latestTrace.id}`}>
            {locale === "zh" ? "查看 Trace 详情" : "View trace details"}
          </Anchor>
          <Anchor c="var(--app-text-muted)" component={Link} size="sm" to="/">
            {locale === "zh" ? "返回对话" : "Back to chat"}
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
              {locale === "zh" ? "Trace 日志" : "Trace log"}
            </Title>
            <Text c="var(--app-text-muted)" mt={4} size="sm">
              {locale === "zh"
                ? "继续保持 conversation -> latest trace -> detail 的现有流转，只压紧工作台密度和卡片层级。"
                : "Browse the latest trace for each conversation and open details without changing the list-to-detail flow."}
            </Text>
          </div>
          <Stack align="flex-end" gap={10}>
            <Badge color="indigo" radius="sm" variant="light">
              {conversationCount}
            </Badge>
            <Text className="workspace-hero-sidecopy" ta="right">
              {locale === "zh"
                ? "这轮只继续收列表骨架、panel 间距、hover 强度和 loading/empty 状态。"
                : "This pass only tightens list density, panel spacing, hover strength, and empty/loading treatment."}
            </Text>
          </Stack>
        </div>
      </Paper>

      {conversationsQuery.isLoading ? (
        <StatePanel
          description={locale === "zh" ? "正在拉取会话列表与最新 trace。" : "Loading conversations and latest traces."}
          title={locale === "zh" ? "加载会话中" : "Loading conversations"}
          tone="loading"
        />
      ) : conversationsQuery.isError ? (
        <StatePanel
          description={conversationsQuery.error instanceof Error ? conversationsQuery.error.message : undefined}
          title={locale === "zh" ? "会话加载失败" : "Failed to load conversations"}
          tone="error"
        />
      ) : conversationsQuery.data?.length ? (
        <div className={conversationsQuery.data.length === 1 ? "workspace-list-shell-compact" : undefined}>
          <SimpleGrid cols={{ base: 1, lg: conversationsQuery.data.length > 1 ? 2 : 1 }} spacing="md">
            {conversationsQuery.data.map(conversation => (
              <TraceConversationCard
                conversationId={conversation.id}
                conversationTitle={conversation.title}
                key={conversation.id}
              />
            ))}
          </SimpleGrid>
        </div>
      ) : (
        <StatePanel
          description={locale === "zh" ? "还没有可检查 trace 的会话。" : "There are no conversations to inspect yet."}
          title={locale === "zh" ? "暂无会话" : "No conversations"}
        />
      )}

      <Button className="workspace-button" color="indigo" component={Link} radius="xl" to="/" variant="light" w="fit-content">
        {locale === "zh" ? "返回对话" : "Back to chat"}
      </Button>
    </Stack>
  );
}
