import { Badge, Button, Group, Paper, Stack, Text } from '@mantine/core';
import { Link } from 'react-router-dom';
import { useI18n } from '../../i18n/I18nProvider';
import { ReportRouteViewShortcuts } from './ReportRouteViewShortcuts';

type AgentSurfaceEntryProps = {
  primaryHref: string;
  primaryLabel?: string;
  showRouteShortcuts?: boolean;
  tone?: 'inline' | 'panel';
};

export function buildAgentSurfaceLabels(locale: 'zh' | 'en') {
  return locale === 'zh'
    ? {
        title: 'Agent 检视入口',
        description:
          '保持当前产品主路径不变；需要检视 agent 化读数时，直接复用 trace / report / chat 上已有入口查看路由、执行模式和工具名。',
        route: '路由',
        mode: '模式',
        tools: '工具',
        routeExamples: '知识库 / 策略回复 / 外部来源',
        modeExamples: 'manual / workflow',
        toolExamples: '知识库搜索 / 外部来源抓取 / 策略回复',
        defaultPrimaryLabel: '打开 trace'
      }
    : {
        title: 'Agent inspection',
        description:
          'Keep the current product flow intact; reuse the existing trace, report, and chat entry points when you need to inspect route choice, execution mode, and tool names.',
        route: 'Route',
        mode: 'Mode',
        tools: 'Tools',
        routeExamples: 'knowledge base / policy reply / external source',
        modeExamples: 'manual / workflow',
        toolExamples:
          'knowledge base search / external source fetch / policy reply',
        defaultPrimaryLabel: 'Open trace'
      };
}

export function AgentSurfaceEntry({
  primaryHref,
  primaryLabel,
  showRouteShortcuts = false,
  tone = 'panel'
}: AgentSurfaceEntryProps) {
  const { locale } = useI18n();
  const copy = buildAgentSurfaceLabels(locale);
  const resolvedPrimaryLabel = primaryLabel ?? copy.defaultPrimaryLabel;

  if (tone === 'inline') {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Text className="workspace-table-hint flex-shrink-0" size="xs">
          {copy.title}
        </Text>
        <Badge color="indigo" radius="sm" variant="light">
          {copy.route}
        </Badge>
        <Text className="workspace-table-hint" size="xs">
          {copy.routeExamples}
        </Text>
        <Badge color="gray" radius="sm" variant="light">
          {copy.mode}
        </Badge>
        <Text className="workspace-table-hint" size="xs">
          {copy.modeExamples}
        </Text>
        <Badge color="cyan" radius="sm" variant="light">
          {copy.tools}
        </Badge>
        <Text className="workspace-table-hint" size="xs">
          {copy.toolExamples}
        </Text>
        <Button
          className="workspace-button"
          color="gray"
          component={Link}
          radius="xl"
          size="xs"
          to={primaryHref}
          variant="subtle"
        >
          {resolvedPrimaryLabel}
        </Button>
      </div>
    );
  }

  return (
    <Paper className="workspace-subpanel" p="md" radius="xl">
      <Stack gap="xs">
        <div className="workspace-section-heading">{copy.title}</div>
        <Text c="var(--app-text-muted)" size="sm">
          {copy.description}
        </Text>
        <Group gap="xs" wrap="wrap">
          <Badge color="indigo" radius="sm" variant="light">
            {copy.route}
          </Badge>
          <Text c="var(--app-text-muted)" size="xs">
            {copy.routeExamples}
          </Text>
          <Badge color="gray" radius="sm" variant="light">
            {copy.mode}
          </Badge>
          <Text c="var(--app-text-muted)" size="xs">
            {copy.modeExamples}
          </Text>
          <Badge color="cyan" radius="sm" variant="light">
            {copy.tools}
          </Badge>
          <Text c="var(--app-text-muted)" size="xs">
            {copy.toolExamples}
          </Text>
        </Group>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            className="workspace-button"
            color="indigo"
            component={Link}
            radius="xl"
            size="xs"
            to={primaryHref}
            variant="light"
          >
            {resolvedPrimaryLabel}
          </Button>
          {showRouteShortcuts ? (
            <ReportRouteViewShortcuts showLabel={false} />
          ) : null}
        </div>
      </Stack>
    </Paper>
  );
}
