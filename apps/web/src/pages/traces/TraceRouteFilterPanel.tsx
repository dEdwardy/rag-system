import { Badge, Button, Stack, Text } from '@mantine/core';
import { Link } from 'react-router-dom';
import { useI18n } from '../../i18n/I18nProvider';
import { ReportRouteViewShortcuts } from '../reports/ReportRouteViewShortcuts';
import {
  routeShortcutLabels,
  type RouteShortcutTarget
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
      <ReportRouteViewShortcuts />
      {routeTypeFilter || routeReasonFilter ? (
        <div className="flex flex-wrap gap-2">
          {routeTypeFilter ? (
            <Badge color="indigo" radius="sm" variant="light">
              {locale === 'zh' ? '路由类型' : 'Route type'}:{' '}
              {isRouteShortcutTarget(routeTypeFilter)
                ? routeShortcutLabels[routeTypeFilter]
                : routeTypeFilter}
            </Badge>
          ) : null}
          {routeReasonFilter ? (
            <Badge color="gray" radius="sm" variant="light">
              {locale === 'zh' ? '路由原因' : 'Route reason'}:{' '}
              {routeReasonFilter}
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
