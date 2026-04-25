import { useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Badge,
  Box,
  Button,
  Group,
  Paper,
  Stack,
  Text,
  Title
} from '@mantine/core';
import { lazy, Suspense } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { OauthWorkspaceWelcome } from '../../components/auth/OauthWorkspaceWelcome';
import { StatePanel } from '../../components/StatePanel';
import {
  useAssistants,
  useConversations,
  useKnowledgeBaseDocumentSummary,
  useKnowledgeBases,
  useRetrievalProfiles,
  useUpdateAssistant,
  useUpdateRetrievalProfile
} from '../../features/api/hooks';
import {
  getPrimaryAssistantForKnowledgeBase,
  getPrimaryKnowledgeBase
} from '../../features/api/workspace-selection';
import { useI18n } from '../../i18n/I18nProvider';
import {
  buildAssistantUpdatePayload,
  buildRetrievalProfileUpdatePayload
} from './assistant-config-form';

const AssistantSettingsForm = lazy(async () => {
  const module = await import('./AssistantSettingsForm');

  return { default: module.AssistantSettingsForm };
});

export function AssistantPage() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const assistantsQuery = useAssistants();
  const knowledgeBasesQuery = useKnowledgeBases();
  const knowledgeBase = getPrimaryKnowledgeBase(knowledgeBasesQuery.data);
  const documentsSummaryQuery = useKnowledgeBaseDocumentSummary(
    knowledgeBase?.id ?? '',
    knowledgeBase != null
  );
  const conversationsQuery = useConversations();
  const retrievalProfilesQuery = useRetrievalProfiles();
  const assistant = getPrimaryAssistantForKnowledgeBase(
    assistantsQuery.data,
    knowledgeBase?.id ?? null
  );
  const retrievalProfile =
    retrievalProfilesQuery.data?.find(
      (profile) => profile.id === assistant?.retrievalProfileId
    ) ?? null;
  const updateAssistantMutation = useUpdateAssistant(assistant?.id ?? '');
  const updateRetrievalProfileMutation = useUpdateRetrievalProfile(
    retrievalProfile?.id ?? 'default-retrieval-profile'
  );
  const { locale, t } = useI18n();
  const documentCount = documentsSummaryQuery.data?.totalDocuments ?? 0;
  const reportSource = searchParams.get('from') === 'report';
  const reportFocus = searchParams.get('focus');
  const reportReturnTo = searchParams.get('returnTo') ?? '/reports';

  const isLoading =
    assistantsQuery.isLoading || retrievalProfilesQuery.isLoading;
  const assistantErrorMessage =
    assistantsQuery.error instanceof Error
      ? assistantsQuery.error.message
      : undefined;
  const retrievalProfileErrorMessage =
    retrievalProfilesQuery.error instanceof Error
      ? retrievalProfilesQuery.error.message
      : undefined;
  const hasAssistantBinding = assistant != null;
  const canRenderForm =
    knowledgeBase != null && hasAssistantBinding && retrievalProfile != null;

  const refreshDefaultAssistantPath = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['knowledge-bases'] }),
      queryClient.invalidateQueries({ queryKey: ['assistants'] }),
      queryClient.invalidateQueries({ queryKey: ['retrieval-profiles'] })
    ]);
  };

  return (
    <Stack data-testid="assistant-page" gap="md">
      <Paper className="workspace-hero" p="lg" radius="xl">
        <div className="workspace-hero-split gap-4 md:items-center">
          <Group gap="md" wrap="nowrap">
            <Box className="workspace-hero-icon">CFG</Box>
            <div className="workspace-hero-copy">
              <Text className="workspace-hero-kicker">
                {t('assistant.copy.heroTitle')}
              </Text>
              <Title
                c="var(--app-text)"
                order={3}
                style={{
                  fontFamily: 'var(--app-font-display)',
                  letterSpacing: '-0.03em'
                }}
              >
                {t('assistant.title')}
              </Title>
              {hasAssistantBinding ? (
                <Text
                  c="var(--app-text-muted)"
                  data-testid="assistant-id"
                  size="sm"
                >
                  {assistant.id}
                </Text>
              ) : null}
              {hasAssistantBinding ? (
                <Text
                  c="var(--app-text)"
                  data-testid="assistant-name-text"
                  size="sm"
                >
                  {assistant.name}
                </Text>
              ) : null}
              {hasAssistantBinding && retrievalProfile ? (
                <Text
                  c="var(--app-text-muted)"
                  data-testid="assistant-retrieval-profile-name"
                  size="sm"
                >
                  {retrievalProfile.name}
                </Text>
              ) : null}
              <Text c="var(--app-text-muted)" mt={4} size="sm">
                {t('assistant.subtitle')}
              </Text>
              <Text c="var(--app-text-secondary)" mt="sm" size="sm">
                {hasAssistantBinding
                  ? locale === 'zh'
                    ? '默认助手已经就绪。先确认回答策略，只有在默认路径表现不对时再继续调优。'
                    : 'Start with the assistant identity and answer policy, then move into retrieval tuning only when needed.'
                  : locale === 'zh'
                    ? documentCount > 0
                      ? '当前资料库的默认助手仍在补建或修复中；它出现后再继续做必要的设置调整。'
                      : '当前资料库的默认助手仍在补建或修复中；先添加第一批资料，再等它自动出现。'
                    : documentCount > 0
                      ? 'The default assistant for the active library is still being prepared or repaired. Tune settings after it appears.'
                      : 'The default assistant for the active library is still being prepared or repaired. Add the first library items, then wait for it to appear automatically.'}
              </Text>
            </div>
          </Group>

          {hasAssistantBinding ? (
            <Stack align="flex-end" gap={8}>
              <Group gap="xs">
                <Badge
                  color={assistant.status === 'active' ? 'indigo' : 'gray'}
                  radius="sm"
                  variant="light"
                >
                  {t(`common.status.${assistant.status}`)}
                </Badge>
                {retrievalProfile ? (
                  <Badge color="gray" radius="sm" variant="light">
                    {retrievalProfile.name}
                  </Badge>
                ) : null}
              </Group>
              <Text
                className="workspace-hero-sidecopy"
                maw={320}
                size="sm"
                ta="right"
              >
                {documentCount > 0
                  ? locale === 'zh'
                    ? `${documentCount} 份资料已可用于当前助手配置。`
                    : `${documentCount} library items are available for this assistant configuration.`
                  : t('assistant.copy.heroSubtitle')}
              </Text>
            </Stack>
          ) : null}
        </div>
      </Paper>

      <OauthWorkspaceWelcome
        assistantCount={hasAssistantBinding ? 1 : 0}
        context="assistant"
        conversationCount={conversationsQuery.data?.length ?? 0}
        documentCount={documentCount}
      />

      {reportSource && reportFocus ? (
        <Alert color="indigo" radius="xl" variant="light">
          <Stack gap="xs">
            <Text fw={600} size="sm">
              {locale === 'zh'
                ? '来自质量报告的设置复查'
                : 'Settings review from quality reports'}
            </Text>
            <Text c="var(--app-text-muted)" size="sm">
              {locale === 'zh'
                ? `当前是按“${reportFocus}”这个改进重点跳到这里。先检查对应设置块，改完后回质量报告继续复查。`
                : `You arrived here from quality reports for the focus "${reportFocus}". Review the matching settings section here, then return to quality reports to verify the result.`}
            </Text>
            <Group gap="xs">
              <Button
                className="workspace-button"
                color="indigo"
                component={Link}
                radius="xl"
                size="xs"
                to={reportReturnTo}
                variant="subtle"
              >
                {locale === 'zh'
                  ? '返回质量报告复查'
                  : 'Return to quality reports'}
              </Button>
            </Group>
          </Stack>
        </Alert>
      ) : null}

      {isLoading ? (
        <StatePanel
          description={t('assistant.loadingDescription')}
          title={t('assistant.loadingTitle')}
          tone="loading"
        />
      ) : null}

      {assistantsQuery.isError ? (
        <StatePanel
          description={assistantErrorMessage}
          title={t('assistant.assistantLoadError')}
          tone="error"
        />
      ) : null}

      {retrievalProfilesQuery.isError ? (
        <StatePanel
          description={retrievalProfileErrorMessage}
          title={t('assistant.retrievalProfileLoadError')}
          tone="error"
        />
      ) : null}

      {!isLoading &&
      !assistantsQuery.isError &&
      !retrievalProfilesQuery.isError &&
      knowledgeBase == null ? (
        <StatePanel
          action={
            <Button
              className="workspace-button"
              color="indigo"
              component={Link}
              radius="xl"
              to="/knowledge-base"
              variant="light"
            >
              {t('assistant.noKnowledgeBaseAction')}
            </Button>
          }
          description={t('assistant.noKnowledgeBaseDescription')}
          title={t('assistant.noKnowledgeBaseTitle')}
        />
      ) : null}

      {!isLoading &&
      !assistantsQuery.isError &&
      !retrievalProfilesQuery.isError &&
      knowledgeBase != null &&
      !hasAssistantBinding ? (
        <StatePanel
          action={
            <Group gap="xs">
              <Button
                className="workspace-button"
                color="indigo"
                onClick={() => {
                  void refreshDefaultAssistantPath();
                }}
                radius="xl"
                variant="filled"
              >
                {t('assistant.noAssistantForKnowledgeBaseRefreshAction')}
              </Button>
              <Button
                className="workspace-button"
                color="gray"
                component={Link}
                radius="xl"
                to="/documents"
                variant="light"
              >
                {documentCount > 0
                  ? t('assistant.noAssistantDocumentsSecondaryAction')
                  : t('assistant.noAssistantDocumentsPrimaryAction')}
              </Button>
            </Group>
          }
          description={t('assistant.noAssistantForKnowledgeBaseDescription', {
            knowledgeBaseName: knowledgeBase.name
          })}
          title={t('assistant.noAssistantForKnowledgeBaseTitle')}
        />
      ) : null}

      {canRenderForm ? (
        <Suspense fallback={<AssistantSettingsFallback locale={locale} />}>
          <AssistantSettingsForm
            assistant={assistant}
            documentCount={documentCount}
            isSaving={
              updateAssistantMutation.isPending ||
              updateRetrievalProfileMutation.isPending
            }
            key={`${assistant.id}:${retrievalProfile.id}`}
            knowledgeBase={knowledgeBase}
            locale={locale}
            retrievalProfile={retrievalProfile}
            saveSettings={async (values) => {
              await updateAssistantMutation.mutateAsync(
                buildAssistantUpdatePayload(values)
              );
              await updateRetrievalProfileMutation.mutateAsync(
                buildRetrievalProfileUpdatePayload(values)
              );
            }}
            t={t}
          />
        </Suspense>
      ) : null}

      {!isLoading && hasAssistantBinding && assistant && !retrievalProfile ? (
        <StatePanel
          description={t('assistant.missingProfileDescription')}
          title={t('assistant.missingProfileTitle')}
          tone="error"
        />
      ) : null}
    </Stack>
  );
}

function AssistantSettingsFallback({ locale }: { locale: 'zh' | 'en' }) {
  return (
    <Paper
      className="workspace-panel-hover workspace-panel-muted"
      p="lg"
      radius="xl"
    >
      <Stack gap="sm">
        <Text className="workspace-section-heading">
          {locale === 'zh' ? '正在加载回答设置' : 'Loading answer settings'}
        </Text>
        <Text c="var(--app-text-muted)" size="sm">
          {locale === 'zh'
            ? '正在准备表单与高级设置...'
            : 'Preparing the form and advanced controls...'}
        </Text>
      </Stack>
    </Paper>
  );
}
