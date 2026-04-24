import { Button, Text } from '@mantine/core';
import { Link } from 'react-router-dom';
import { useI18n } from '../../i18n/I18nProvider';
import {
  buildAllTracesLink,
  buildTraceRouteListLink,
  routeShortcutCompactLabels,
  routeShortcutLabels
} from './route-view-helpers';

export function ReportRouteViewShortcuts() {
  const { locale } = useI18n();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Text className="workspace-table-hint flex-shrink-0" size="xs">
        {locale === 'zh' ? '路由视角' : 'Route view'}
      </Text>
      <Button
        className="workspace-button"
        color="gray"
        component={Link}
        radius="xl"
        size="xs"
        to={buildAllTracesLink()}
        variant="subtle"
      >
        {locale === 'zh' ? '全部 trace' : 'All traces'}
      </Button>
      <Button
        className="workspace-button"
        color="indigo"
        component={Link}
        radius="xl"
        size="xs"
        to={buildTraceRouteListLink('knowledge_base')}
        variant="light"
      >
        {locale === 'zh' ? '知识库' : routeShortcutCompactLabels.knowledge_base}
      </Button>
      <Button
        className="workspace-button"
        color="indigo"
        component={Link}
        radius="xl"
        size="xs"
        to={buildTraceRouteListLink('policy_reply')}
        variant="light"
      >
        {locale === 'zh' ? '策略' : routeShortcutCompactLabels.policy_reply}
      </Button>
      <Button
        className="workspace-button"
        color="indigo"
        component={Link}
        radius="xl"
        size="xs"
        to={buildTraceRouteListLink('external_source')}
        variant="light"
      >
        {locale === 'zh' ? '外部' : routeShortcutCompactLabels.external_source}
      </Button>
    </div>
  );
}
