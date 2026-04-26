import { Badge, Button, Stack, Text } from '@mantine/core';
import { Link } from 'react-router-dom';
import { useI18n } from '../../i18n/I18nProvider';
import { AgentSurfaceEntry } from '../reports/AgentSurfaceEntry';
import { ReportRouteViewShortcuts } from '../reports/ReportRouteViewShortcuts';
import {
  buildRouteDecisionLabel,
  buildRouteReasonLabel,
  routeShortcutLabels
} from '../reports/route-view-helpers';
import {
  formatActiveTraceRouteFilter,
  isRouteShortcutTarget
} from './trace-route-helpers';

type TraceRouteFilterPanelProps = {
  routeTypeFilter: string | null;
  routeReasonFilter: string | null;
};

export function TraceRouteFilterPanel({
  routeTypeFilter,
  routeReasonFilter
}: TraceRouteFilterPanelProps) {
  const { locale } = useI18n();

  return (
    <Stack gap={6}>
      <AgentSurfaceEntry
        primaryHref="/traces"
        primaryLabel={locale === 'zh' ? '进入 trace 详情' : 'Inspect traces'}
        tone="inline"
      />
      <ReportRouteViewShortcuts />
      {routeTypeFilter || routeReasonFilter ? (
        <div className="flex flex-wrap gap-2">
          {routeTypeFilter && routeReasonFilter ? (
            <Badge color="indigo" radius="sm" variant="light">
              {locale === 'zh' ? '当前路由' : 'Current route'}:{' '}
              {buildRouteDecisionLabel(routeTypeFilter, routeReasonFilter)}
            </Badge>
          ) : null}
          {routeTypeFilter && !routeReasonFilter ? (
            <Badge color="indigo" radius="sm" variant="light">
              {locale === 'zh' ? '路由类型' : 'Route type'}:{' '}
              {isRouteShortcutTarget(routeTypeFilter)
                ? routeShortcutLabels[routeTypeFilter]
                : routeTypeFilter}
            </Badge>
          ) : null}
          {routeReasonFilter && !routeTypeFilter ? (
            <Badge color="gray" radius="sm" variant="light">
              {locale === 'zh' ? '路由原因' : 'Route reason'}:{' '}
              {buildRouteReasonLabel(routeReasonFilter)}
            </Badge>
          ) : null}
        </div>
      ) : null}
      <Text c="var(--app-text-muted)" size="xs">
        {routeTypeFilter || routeReasonFilter
          ? formatActiveTraceRouteFilter(
              locale,
              routeTypeFilter,
              routeReasonFilter
            )
          : locale === 'zh'
            ? '可通过 URL 查询参数 routeType / routeReason 过滤当前 trace。'
            : 'Use routeType / routeReason query parameters to filter this page.'}
      </Text>
      {routeTypeFilter || routeReasonFilter ? (
        <Button
          className="workspace-button"
          color="gray"
          component={Link}
          radius="xl"
          size="xs"
          to="/traces"
          variant="subtle"
          w="fit-content"
        >
          {locale === 'zh' ? '清空筛选' : 'Clear filters'}
        </Button>
      ) : null}
    </Stack>
  );
}
