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
import { useDeferredValue, useMemo } from "react";
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
        Loading latest diagnostic trace...
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
  const { formatDateTime, t } = useI18n();

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
                {latestTrace.modelName ?? t("trace.copy.modelUnknown")}
              </Badge>
            </Group>
          </Stack>
          <Text c="var(--app-text-muted)" size="xs">
            {formatDateTime(latestTrace.createdAt)}
          </Text>
        </Group>

        <div className="workspace-meta-list">
          <div className="workspace-meta-row">
            <span className="workspace-meta-label">{t("trace.copy.latestResult")}</span>
            <span className="workspace-meta-value">
              {latestTrace.status === "success"
                ? t("trace.copy.latestResultSuccess")
                : t("trace.copy.latestResultNeedsInspection")}
            </span>
          </div>
          <div className="workspace-meta-row">
            <span className="workspace-meta-label">{t("trace.copy.traceId")}</span>
            <span className="workspace-meta-value">{latestTrace.id}</span>
          </div>
        </div>

        <Stack gap="xs">
          <Anchor c="var(--app-text)" component={Link} fw={600} size="sm" to={`/traces/${latestTrace.id}`}>
            {t("trace.copy.viewTraceDetails")}
          </Anchor>
          <Anchor c="var(--app-text-muted)" component={Link} size="sm" to="/">
            {t("trace.copy.backToChat")}
          </Anchor>
        </Stack>
      </Stack>
    </Paper>
  );
}

export function TraceListPage() {
  const conversationsQuery = useConversations();
  const { t } = useI18n();
  const deferredConversations = useDeferredValue(conversationsQuery.data ?? []);
  const conversationCount = deferredConversations.length;
  const conversationIds = useMemo(() => deferredConversations.map(conversation => conversation.id), [deferredConversations]);
  const latestTracesQuery = useLatestConversationTraces(conversationIds, conversationsQuery.isSuccess);
  const traceErrorMessage =
    latestTracesQuery.error instanceof Error
      ? latestTracesQuery.error.message
      : t("trace.copy.loadTracesError");
  const traceCards =
    deferredConversations.flatMap(conversation => {
      const latestTrace = latestTracesQuery.latestTraceByConversationId[conversation.id] ?? null;
      return latestTrace ? [{ conversation, latestTrace }] : [];
    }) ?? [];

  return (
    <Stack data-testid="traces-page" gap="md">
      <Paper className="workspace-hero" p="lg" radius="xl">
        <div className="workspace-hero-split">
          <div className="workspace-hero-copy">
            <Text className="workspace-link" component={Link} size="sm" to="/workbench">
              {t("common.actions.backToWorkbench")}
            </Text>
            <Text className="workspace-hero-kicker">Workbench</Text>
            <Title
              order={3}
              c="var(--app-text)"
              style={{ fontFamily: "var(--app-font-display)", letterSpacing: "-0.03em" }}
            >
              {t("trace.copy.traceHeading")}
            </Title>
            <Text c="var(--app-text-muted)" mt={4} size="sm">
              {t("trace.copy.traceDescription")}
            </Text>
          </div>
          <Stack align="flex-end" gap={10}>
            <Badge color="indigo" radius="sm" variant="light">
              {conversationCount}
            </Badge>
            <Text className="workspace-hero-sidecopy" ta="right">
              {t("trace.copy.traceSidecopy")}
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
          <span className="sr-only">{t("trace.copy.loadingConversations")}</span>
        </div>
      ) : conversationsQuery.isError ? (
        <StatePanel
          description={conversationsQuery.error instanceof Error ? conversationsQuery.error.message : undefined}
          title={t("trace.copy.conversationsError")}
          tone="error"
        />
      ) : deferredConversations.length ? (
        <div className="workspace-trace-list">
          {latestTracesQuery.isLoading ? (
            <Paper className="workspace-panel-muted" mb="md" p="lg" radius="xl">
              <GroupLoader />
            </Paper>
          ) : null}
          {latestTracesQuery.isError ? (
            <Alert color="red" mb="md" radius="lg" variant="light">
              {t("trace.copy.partialLoadError", {
                count: latestTracesQuery.failedConversationCount,
                error: traceErrorMessage
              })}
            </Alert>
          ) : null}
          <div className={deferredConversations.length === 1 ? "workspace-list-shell-compact" : undefined}>
            <SimpleGrid cols={{ base: 1, lg: deferredConversations.length > 1 ? 2 : 1 }} spacing="md">
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
          description={t("trace.copy.noConversationsDescription")}
          title={t("trace.copy.noConversationsTitle")}
        />
      )}

      <Button
        className="workspace-button"
        color="indigo"
        component={Link}
        radius="xl"
        to="/workbench"
        variant="light"
        w="fit-content"
      >
        {t("common.actions.backToWorkbench")}
      </Button>
    </Stack>
  );
}
