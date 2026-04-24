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

function buildAgentSurfaceLabels(locale: 'zh' | 'en') {
  return locale === 'zh'
    ? {
        title: 'Agent 视角',
        description:
          '保持当前产品主路径不变；需要排查 agent 化执行时，直接去 trace 看路由、执行模式和工具名。',
        route: '路由',
        mode: '模式',
        tools: '工具',
        defaultPrimaryLabel: '打开 trace'
      }
    : {
        title: 'Agent view',
        description:
          'Keep the current product flow intact; use traces when you need to inspect route, execution mode, and tool names.',
        route: 'Route',
        mode: 'Mode',
        tools: 'Tools',
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
        <Badge color="gray" radius="sm" variant="light">
          {copy.mode}
        </Badge>
        <Badge color="cyan" radius="sm" variant="light">
          {copy.tools}
        </Badge>
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
          <Badge color="gray" radius="sm" variant="light">
            {copy.mode}
          </Badge>
          <Badge color="cyan" radius="sm" variant="light">
            {copy.tools}
          </Badge>
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
