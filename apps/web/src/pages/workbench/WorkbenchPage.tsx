import { Badge, Button, Paper, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { Link } from "react-router-dom";
import { StatePanel } from "../../components/StatePanel";
import { useConversations, useDocuments, useKnowledgeBases } from "../../features/api/hooks";
import { getPrimaryKnowledgeBase } from "../../features/api/workspace-selection";
import { useI18n } from "../../i18n/I18nProvider";

type EntryCard = {
  key: string;
  title: string;
  description: string;
  hint: string;
  badge: string;
  to: string;
  action: string;
};

export function WorkbenchPage() {
  const { locale } = useI18n();
  const knowledgeBasesQuery = useKnowledgeBases();
  const activeKnowledgeBase = getPrimaryKnowledgeBase(knowledgeBasesQuery.data);
  const documentsQuery = useDocuments(activeKnowledgeBase?.id ?? "", activeKnowledgeBase != null);
  const conversationsQuery = useConversations();
  const documents = documentsQuery.data ?? [];
  const processingItems = documents.filter(document => document.status === "pending" || document.status === "processing").length;
  const failedItems = documents.filter(document => document.status === "failed").length;
  const conversationCount = conversationsQuery.data?.length ?? 0;
  const readyItems = documents.filter(document => document.status === "ready").length;
  const hasActiveKnowledgeBase = activeKnowledgeBase != null;
  const hasError = knowledgeBasesQuery.isError || documentsQuery.isError || conversationsQuery.isError;
  const errorMessage =
    (knowledgeBasesQuery.error instanceof Error && knowledgeBasesQuery.error.message)
    || (documentsQuery.error instanceof Error && documentsQuery.error.message)
    || (conversationsQuery.error instanceof Error && conversationsQuery.error.message)
    || (locale === "zh" ? "加载工作台入口时发生未知错误。" : "An unknown error occurred while loading the workbench.");

  const entryCards: EntryCard[] = [
    {
      key: "usage",
      title: locale === "zh" ? "运行概览" : "Operations overview",
      description:
        locale === "zh"
          ? "集中查看资料状态、更新趋势和运行健康信号。"
          : "Review item state, update trends, and operational health signals in one place.",
      hint:
        locale === "zh"
          ? "当你想确认资料是否稳定、是否还有更新或异常时进入这里。"
          : "Open this when you need to confirm whether the library is stable, still updating, or showing issues.",
      badge:
        locale === "zh"
          ? `处理中 ${processingItems} / 异常 ${failedItems}`
          : `${processingItems} processing / ${failedItems} issues`,
      to: "/usage",
      action: locale === "zh" ? "打开运行概览" : "Open operations overview"
    },
    {
      key: "reports",
      title: locale === "zh" ? "质量报告" : "Quality reports",
      description:
        locale === "zh"
          ? "进入质量检查、回归差异和结果导出视图。"
          : "Open quality checks, regression diffs, and report export tools.",
      hint:
        locale === "zh"
          ? "当你要核对回答质量、回看回归，或导出结果时进入这里。"
          : "Open this when you want to review answer quality, inspect regressions, or export results.",
      badge:
        locale === "zh"
          ? (hasActiveKnowledgeBase ? `已就绪资料 ${readyItems}` : "等待资料空间")
          : (hasActiveKnowledgeBase ? `${readyItems} ready items` : "waiting for library"),
      to: "/reports",
      action: locale === "zh" ? "打开质量报告" : "Open quality reports"
    },
    {
      key: "traces",
      title: locale === "zh" ? "诊断" : "Diagnostics",
      description:
        locale === "zh"
          ? "按会话回看最新来源、引用和诊断记录。"
          : "Inspect latest sources, citations, and diagnostics by conversation.",
      hint:
        locale === "zh"
          ? "当某次回答看起来不对，想顺着来源和记录排查时进入这里。"
          : "Open this when an answer looks wrong and you want to trace it through sources and diagnostics.",
      badge:
        locale === "zh"
          ? `会话 ${conversationCount}`
          : `${conversationCount} conversations`,
      to: "/traces",
      action: locale === "zh" ? "打开诊断" : "Open diagnostics"
    }
  ];

  return (
    <Stack gap="md">
      <Paper className="workspace-hero" p="lg" radius="xl">
        <div className="workspace-hero-split">
          <div className="workspace-hero-copy">
            <Text className="workspace-hero-kicker">{locale === "zh" ? "管理工作台" : "Workbench"}</Text>
            <Title
              c="var(--app-text)"
              order={3}
              style={{ fontFamily: "var(--app-font-display)", letterSpacing: "-0.03em" }}
            >
              {locale === "zh" ? "工作台概览" : "Workbench overview"}
            </Title>
            <Text c="var(--app-text-muted)" mt={4} size="sm">
              {locale === "zh"
                ? "把运行观察、质量检查和诊断入口收在一起，避免它们继续挤进普通用户主路径。"
                : "Keep operations, quality checks, and diagnostics together so they stay separate from the primary user path."}
            </Text>
          </div>

          <Stack align="flex-end" gap={10}>
            <Badge color={hasActiveKnowledgeBase ? "indigo" : "gray"} radius="sm" variant="light">
              {hasActiveKnowledgeBase
                ? activeKnowledgeBase.name
                : locale === "zh"
                  ? "未选择资料空间"
                  : "No active library"}
            </Badge>
            <Text className="workspace-hero-sidecopy" ta="right">
              {locale === "zh"
                ? "先看哪块要处理，再进入对应页面，不必先记住每个管理页的具体位置。"
                : "Start from the area you need, then enter the matching page without memorizing each admin route first."}
            </Text>
          </Stack>
        </div>
      </Paper>

      {hasError ? (
        <StatePanel
          description={errorMessage}
          title={locale === "zh" ? "工作台入口加载失败" : "Failed to load workbench overview"}
          tone="error"
        />
      ) : null}

      {!hasError ? (
        <>
          <SimpleGrid cols={{ base: 1, lg: 3 }} spacing="md">
            {entryCards.map(card => (
              <Paper className="workspace-panel-hover workspace-panel-strong" key={card.key} p="lg" radius="xl">
                <Stack gap="md" h="100%" justify="space-between">
                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <Text className="workspace-section-heading">{card.title}</Text>
                      <Badge color="indigo" radius="sm" variant="light">
                        {card.badge}
                      </Badge>
                    </div>
                    <Text c="var(--app-text-muted)" mt={10} size="sm">
                      {card.description}
                    </Text>
                    <Text c="var(--app-text-secondary)" mt={8} size="xs">
                      {card.hint}
                    </Text>
                  </div>

                  <Button className="workspace-button" color="indigo" component={Link} radius="xl" to={card.to} variant="light">
                    {card.action}
                  </Button>
                </Stack>
              </Paper>
            ))}
          </SimpleGrid>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.7fr)]">
            <Paper className="workspace-panel-hover workspace-panel-muted" p="lg" radius="xl">
              <Stack gap="md">
                <div>
                  <Text className="workspace-section-heading">{locale === "zh" ? "当前工作台状态" : "Current workbench status"}</Text>
                  <Text c="var(--app-text-muted)" mt={10} size="sm">
                    {locale === "zh"
                      ? "先用这些短摘要判断是否需要进入管理页深看。"
                      : "Use these short summaries first to decide whether a deeper workbench page is necessary."}
                  </Text>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <Paper className="workspace-subpanel" p="md" radius="xl">
                    <Text className="workspace-section-heading">{locale === "zh" ? "资料空间" : "Library"}</Text>
                    <Text c="var(--app-text)" fw={700} mt={6} size="lg">
                      {hasActiveKnowledgeBase ? activeKnowledgeBase.name : locale === "zh" ? "未设置" : "Not set"}
                    </Text>
                  </Paper>
                  <Paper className="workspace-subpanel" p="md" radius="xl">
                    <Text className="workspace-section-heading">{locale === "zh" ? "更新中资料" : "Updating items"}</Text>
                    <Text c="var(--app-text)" fw={700} mt={6} size="lg">
                      {processingItems}
                    </Text>
                  </Paper>
                  <Paper className="workspace-subpanel" p="md" radius="xl">
                    <Text className="workspace-section-heading">{locale === "zh" ? "可诊断会话" : "Conversations to inspect"}</Text>
                    <Text c="var(--app-text)" fw={700} mt={6} size="lg">
                      {conversationCount}
                    </Text>
                  </Paper>
                </div>
              </Stack>
            </Paper>

            <Paper className="workspace-panel-hover workspace-panel-muted" p="lg" radius="xl">
              <Stack gap="md">
                <div>
                  <Text className="workspace-section-heading">{locale === "zh" ? "主路径快捷返回" : "Back to primary flow"}</Text>
                  <Text c="var(--app-text-muted)" mt={10} size="sm">
                    {locale === "zh"
                      ? "看完管理侧信息后，可以直接回到资料准备和回答设置。"
                      : "Jump back to library preparation and answer settings after reviewing admin signals."}
                  </Text>
                </div>

                <Button className="workspace-button w-full" color="indigo" component={Link} radius="xl" to="/documents" variant="light">
                  {locale === "zh" ? "打开资料库" : "Open library"}
                </Button>
                <Button className="workspace-button w-full" color="indigo" component={Link} radius="xl" to="/knowledge-base" variant="light">
                  {locale === "zh" ? "打开工作区设置" : "Open workspace settings"}
                </Button>
                <Button className="workspace-button w-full" color="indigo" component={Link} radius="xl" to="/assistant" variant="light">
                  {locale === "zh" ? "打开回答设置" : "Open answer settings"}
                </Button>
              </Stack>
            </Paper>
          </div>
        </>
      ) : null}
    </Stack>
  );
}
