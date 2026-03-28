import {
  Anchor,
  Badge,
  Button,
  Group,
  Loader,
  Paper,
  Stack,
  Text,
  TextInput,
  Title
} from "@mantine/core";
import { useState } from "react";
import { Link } from "react-router-dom";
import { StatePanel } from "../../components/StatePanel";
import { useTraces } from "../../features/api/hooks";
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

function TraceCard({ trace }: { trace: TraceRecord }) {
  const { formatDateTime, locale } = useI18n();

  return (
    <Paper className="workspace-citation-card workspace-panel-muted" p="lg" radius="xl">
      <Stack gap="md">
        <Group align="flex-start" justify="space-between" wrap="nowrap">
          <Stack gap={8}>
            <div>
              <Text c="var(--app-text)" fw={700} size="sm">
                {locale === "zh" ? "用户问题" : "User question"}
              </Text>
              <Text c="var(--app-text-secondary)" lineClamp={2} mt={6} size="sm">
                {trace.userQuery}
              </Text>
            </div>
            <Group gap="xs">
              <Badge color={trace.status === "success" ? "teal" : "red"} radius="sm" variant="light">
                {trace.status}
              </Badge>
              <Badge color="gray" radius="sm" variant="light">
                {trace.modelName ?? (locale === "zh" ? "未记录模型" : "No model")}
              </Badge>
            </Group>
          </Stack>
          <Text c="var(--app-text-muted)" size="xs">
            {formatDateTime(trace.createdAt)}
          </Text>
        </Group>

        <div className="workspace-meta-list">
          <div className="workspace-meta-row">
            <span className="workspace-meta-label">{locale === "zh" ? "最新结果" : "Latest result"}</span>
            <span className="workspace-meta-value">
              {trace.status === "success"
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
            <span className="workspace-meta-value">{trace.id}</span>
          </div>
          <div className="workspace-meta-row">
            <span className="workspace-meta-label">{locale === "zh" ? "会话编号" : "Conversation id"}</span>
            <span className="workspace-meta-value">{trace.conversationId}</span>
          </div>
        </div>

        <Stack gap="xs">
          <Anchor c="var(--app-text)" component={Link} fw={600} size="sm" to={`/traces/${trace.id}`}>
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
  const [queryText, setQueryText] = useState("");
  const { locale } = useI18n();
  const normalizedQuery = queryText.trim();
  const tracesQuery = useTraces({
    query: normalizedQuery.length > 0 ? normalizedQuery : undefined,
    limit: 40
  });
  const traceCount = tracesQuery.data?.length ?? 0;

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
                ? "按关键词快速检索 trace，然后进入详情排查。"
                : "Search traces by keyword and open details only when deeper inspection is needed."}
            </Text>
          </div>
          <Stack align="flex-end" gap={10}>
            <Badge color="indigo" radius="sm" variant="light">
              {traceCount}
            </Badge>
            <Text className="workspace-hero-sidecopy" ta="right">
              {locale === "zh"
                ? "支持按 trace id、用户问题、rewritten query 检索。"
                : "Search by trace id, user query, or rewritten query."}
            </Text>
          </Stack>
        </div>
      </Paper>

      <Paper className="workspace-panel-muted" p="lg" radius="xl">
        <TextInput
          aria-label={locale === "zh" ? "Trace 搜索" : "Trace search"}
          onChange={event => setQueryText(event.currentTarget.value)}
          placeholder={
            locale === "zh"
              ? "输入关键词（trace id / 用户问题 / rewritten query）"
              : "Search by trace id, user query, or rewritten query"
          }
          radius="lg"
          size="md"
          value={queryText}
        />
      </Paper>

      {tracesQuery.isLoading ? (
        <GroupLoader />
      ) : tracesQuery.isError ? (
        <StatePanel
          description={tracesQuery.error instanceof Error ? tracesQuery.error.message : undefined}
          title={locale === "zh" ? "Trace 加载失败" : "Failed to load traces"}
          tone="error"
        />
      ) : tracesQuery.data?.length ? (
        <Stack gap="md">
          {tracesQuery.data.map(trace => (
            <TraceCard key={trace.id} trace={trace} />
          ))}
        </Stack>
      ) : (
        <StatePanel
          description={
            normalizedQuery.length > 0
              ? locale === "zh"
                ? "当前关键词没有命中 trace，请尝试更短或更通用的词。"
                : "No traces match this keyword yet. Try a shorter or broader query."
              : locale === "zh"
                ? "还没有可检查的 trace。"
                : "There are no traces to inspect yet."
          }
          title={locale === "zh" ? "暂无 Trace" : "No traces"}
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
