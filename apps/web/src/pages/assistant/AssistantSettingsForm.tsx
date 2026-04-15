import {
  Alert,
  Button,
  Grid,
  Group,
  NativeSelect,
  NumberInput,
  Paper,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useState } from 'react';
import type {
  Assistant,
  KnowledgeBase,
  RetrievalProfile
} from '../../types/api';
import {
  type AssistantConfigFormValues,
  buildAssistantUpdatePayload,
  buildRetrievalProfileUpdatePayload,
  createAssistantConfigFormValues
} from './assistant-config-form';

function hasAdvancedTuningOverrides(retrievalProfile: RetrievalProfile) {
  return Boolean(
    retrievalProfile.enableHybrid ||
    retrievalProfile.enableRerank ||
    retrievalProfile.strategyJson?.candidateSelection ||
    retrievalProfile.strategyJson?.hybrid ||
    retrievalProfile.strategyJson?.rerank
  );
}

function hasFilterOverrides(retrievalProfile: RetrievalProfile) {
  return Boolean(
    retrievalProfile.filtersJson &&
    Object.keys(retrievalProfile.filtersJson).length > 0
  );
}

type AssistantSettingsFormProps = {
  assistant: Assistant;
  knowledgeBase: KnowledgeBase;
  retrievalProfile: RetrievalProfile;
  documentCount: number;
  locale: 'zh' | 'en';
  t: (key: string, values?: Record<string, string | number>) => string;
  isSaving: boolean;
  saveSettings: (values: AssistantConfigFormValues) => Promise<void>;
};

export function AssistantSettingsForm({
  assistant,
  knowledgeBase,
  retrievalProfile,
  documentCount,
  locale,
  t,
  isSaving,
  saveSettings
}: AssistantSettingsFormProps) {
  const form = useForm<AssistantConfigFormValues>({
    initialValues: createAssistantConfigFormValues(assistant, retrievalProfile),
    mode: 'controlled'
  });
  const [isBasicsExpanded, setIsBasicsExpanded] = useState(true);
  const [isAdvancedTuningExpanded, setIsAdvancedTuningExpanded] = useState(() =>
    hasAdvancedTuningOverrides(retrievalProfile)
  );
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(() =>
    hasFilterOverrides(retrievalProfile)
  );

  const handleSubmit = form.onSubmit(async (values) => {
    try {
      await saveSettings(values);

      notifications.show({
        color: 'teal',
        message: t('assistant.updated')
      });
    } catch (error) {
      notifications.show({
        color: 'red',
        message:
          error instanceof Error ? error.message : t('assistant.updateError')
      });
    }
  });

  return (
    <form onSubmit={handleSubmit}>
      <div className="workspace-page-grid workspace-page-grid-main-first">
        <div className="workspace-page-main-stack">
          <Stack gap="md">
            <Paper
              className="workspace-panel-hover workspace-panel-strong"
              p="lg"
              radius="xl"
            >
              <Stack gap="md">
                <Group align="flex-start" justify="space-between" wrap="wrap">
                  <div>
                    <Text className="workspace-section-heading">
                      {t('assistant.copy.assistantIdentity')}
                    </Text>
                    <Text c="var(--app-text-muted)" size="sm">
                      {t('assistant.copy.assistantIdentityCopy')}
                    </Text>
                  </div>
                  <Button
                    className="workspace-button"
                    color="gray"
                    data-testid="assistant-basics-toggle"
                    onClick={() => setIsBasicsExpanded((current) => !current)}
                    radius="xl"
                    size="xs"
                    variant="light"
                    disabled={isSaving}
                  >
                    {isBasicsExpanded
                      ? t('assistant.hideAssistantBasics')
                      : t('assistant.showAssistantBasics')}
                  </Button>
                </Group>

                {isBasicsExpanded ? (
                  <>
                    <Grid gutter="md">
                      <Grid.Col span={{ base: 12, md: 8 }}>
                        <TextInput
                          classNames={{ input: 'workspace-input' }}
                          data-testid="assistant-name-value"
                          label={t('assistant.assistantName')}
                          {...form.getInputProps('name')}
                        />
                      </Grid.Col>
                      <Grid.Col span={{ base: 12, md: 4 }}>
                        <TextInput
                          classNames={{ input: 'workspace-input' }}
                          label={t('assistant.status')}
                          readOnly
                          value={t(`common.status.${form.values.status}`)}
                        />
                      </Grid.Col>
                    </Grid>

                    <Switch
                      checked={form.values.status === 'active'}
                      label={
                        form.values.status === 'active'
                          ? t('assistant.assistantIsActive')
                          : t('assistant.assistantIsInactive')
                      }
                      onChange={(event) =>
                        form.setFieldValue(
                          'status',
                          event.currentTarget.checked ? 'active' : 'inactive'
                        )
                      }
                    />

                    <TextInput
                      classNames={{ input: 'workspace-input' }}
                      label={t('common.fields.description')}
                      {...form.getInputProps('description')}
                    />

                    <Alert color="gray" radius="xl" variant="light">
                      {t('assistant.copy.systemPromptHint')}
                    </Alert>

                    <Textarea
                      autosize
                      classNames={{ input: 'workspace-input' }}
                      label={t('common.fields.systemPrompt')}
                      minRows={6}
                      {...form.getInputProps('systemPrompt')}
                    />
                  </>
                ) : (
                  <Alert color="gray" radius="xl" variant="light">
                    {t('assistant.assistantBasicsSummary', {
                      name: form.values.name,
                      status: t(`common.status.${form.values.status}`)
                    })}
                  </Alert>
                )}
              </Stack>
            </Paper>

            <Paper
              className="workspace-panel-hover workspace-panel-muted"
              id="assistant-answer-policy-section"
              p="lg"
              radius="xl"
              style={{ scrollMarginTop: '96px' }}
            >
              <Stack gap="md">
                <div>
                  <Text className="workspace-section-heading">
                    {t('assistant.answerPolicySection')}
                  </Text>
                  <Text c="var(--app-text-muted)" size="sm">
                    {t('assistant.copy.recommendedDefaultsCopy')}
                  </Text>
                </div>

                <Alert color="indigo" radius="xl" variant="light">
                  {t('assistant.answerPolicyRecommendedHint')}
                </Alert>

                <Grid gutter="md">
                  <Grid.Col span={{ base: 12, md: 4 }}>
                    <NativeSelect
                      classNames={{ input: 'workspace-input' }}
                      data={[
                        {
                          value: 'concise',
                          label: t('assistant.responseStyleConcise')
                        },
                        {
                          value: 'balanced',
                          label: t('assistant.responseStyleBalanced')
                        },
                        {
                          value: 'detailed',
                          label: t('assistant.responseStyleDetailed')
                        }
                      ]}
                      label={t('assistant.responseStyle')}
                      {...form.getInputProps('responseStyle')}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, md: 4 }}>
                    <NativeSelect
                      classNames={{ input: 'workspace-input' }}
                      data={[
                        { value: 'neutral', label: t('assistant.toneNeutral') },
                        {
                          value: 'friendly',
                          label: t('assistant.toneFriendly')
                        },
                        { value: 'direct', label: t('assistant.toneDirect') }
                      ]}
                      label={t('assistant.tone')}
                      {...form.getInputProps('tone')}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, md: 4 }}>
                    <NativeSelect
                      classNames={{ input: 'workspace-input' }}
                      data={[
                        {
                          value: 'paragraph',
                          label: t('assistant.outputFormatParagraph')
                        },
                        {
                          value: 'bullets',
                          label: t('assistant.outputFormatBullets')
                        },
                        {
                          value: 'markdown',
                          label: t('assistant.outputFormatMarkdown')
                        }
                      ]}
                      label={t('assistant.outputFormat')}
                      {...form.getInputProps('outputFormat')}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, md: 4 }}>
                    <NativeSelect
                      classNames={{ input: 'workspace-input' }}
                      data={[
                        { value: 'auto', label: t('assistant.languageAuto') },
                        {
                          value: 'same_as_question',
                          label: t('assistant.languageSameAsQuestion')
                        },
                        { value: 'zh', label: t('assistant.languageZh') },
                        { value: 'en', label: t('assistant.languageEn') }
                      ]}
                      label={t('assistant.language')}
                      {...form.getInputProps('language')}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, md: 4 }}>
                    <NativeSelect
                      classNames={{ input: 'workspace-input' }}
                      data={[
                        {
                          value: 'required',
                          label: t('assistant.citationModeRequired')
                        },
                        {
                          value: 'optional',
                          label: t('assistant.citationModeOptional')
                        }
                      ]}
                      label={t('assistant.citationMode')}
                      {...form.getInputProps('citationMode')}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, md: 4 }}>
                    <NativeSelect
                      classNames={{ input: 'workspace-input' }}
                      data={[
                        {
                          value: 'say_insufficient_context',
                          label: t(
                            'assistant.noAnswerBehaviorInsufficientContext'
                          )
                        },
                        {
                          value: 'best_effort',
                          label: t('assistant.noAnswerBehaviorBestEffort')
                        }
                      ]}
                      label={t('assistant.noAnswerBehavior')}
                      {...form.getInputProps('noAnswerBehavior')}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, md: 4 }}>
                    <NumberInput
                      classNames={{ input: 'workspace-input' }}
                      label={t('assistant.maxCitations')}
                      max={8}
                      min={1}
                      {...form.getInputProps('maxCitations')}
                    />
                  </Grid.Col>
                </Grid>

                <Switch
                  checked={form.values.queryRewriteEnabled}
                  label={t('assistant.queryRewriteEnabled')}
                  onChange={(event) =>
                    form.setFieldValue(
                      'queryRewriteEnabled',
                      event.currentTarget.checked
                    )
                  }
                />
                <Switch
                  checked={form.values.includeMissingInformation}
                  label={t('assistant.includeMissingInformation')}
                  onChange={(event) =>
                    form.setFieldValue(
                      'includeMissingInformation',
                      event.currentTarget.checked
                    )
                  }
                />
              </Stack>
            </Paper>

            <Paper
              className="workspace-panel-hover workspace-panel-muted"
              id="assistant-retrieval-section"
              p="lg"
              radius="xl"
              style={{ scrollMarginTop: '96px' }}
            >
              <Stack gap="md">
                <div>
                  <Text className="workspace-section-heading">
                    {t('assistant.retrievalSection')}
                  </Text>
                  <Text c="var(--app-text-muted)" size="sm">
                    {t('assistant.copy.retrievalCopy')}
                  </Text>
                </div>

                <Alert color="indigo" radius="xl" variant="light">
                  {t('assistant.retrievalRecommendedHint')}
                </Alert>

                <Grid gutter="md">
                  <Grid.Col span={{ base: 12, md: 4 }}>
                    <NumberInput
                      classNames={{ input: 'workspace-input' }}
                      label={t('common.fields.topK')}
                      max={20}
                      min={1}
                      {...form.getInputProps('topK')}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, md: 4 }}>
                    <NumberInput
                      classNames={{ input: 'workspace-input' }}
                      label={t('common.fields.chunkWindow')}
                      max={5}
                      min={0}
                      {...form.getInputProps('chunkWindow')}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, md: 4 }}>
                    <NumberInput
                      classNames={{ input: 'workspace-input' }}
                      decimalScale={0}
                      label={t('common.fields.scoreThreshold')}
                      max={100}
                      min={0}
                      {...form.getInputProps('scoreThreshold')}
                    />
                  </Grid.Col>
                </Grid>

                <Alert color="gray" radius="xl" variant="light">
                  {t('assistant.advancedRetrievalHint')}
                </Alert>

                <Group gap="xs">
                  <Switch
                    checked={form.values.enableHybrid}
                    label={t('assistant.hybridLabel')}
                    onChange={(event) =>
                      form.setFieldValue(
                        'enableHybrid',
                        event.currentTarget.checked
                      )
                    }
                  />
                  <Switch
                    checked={form.values.enableRerank}
                    label={t('assistant.rerankLabel')}
                    onChange={(event) =>
                      form.setFieldValue(
                        'enableRerank',
                        event.currentTarget.checked
                      )
                    }
                  />
                </Group>

                <Group justify="space-between" wrap="wrap">
                  <div>
                    <Text className="workspace-section-heading">
                      {t('assistant.advancedTuning')}
                    </Text>
                    <Text c="var(--app-text-muted)" size="sm">
                      {t('assistant.copy.advancedTuningCopy')}
                    </Text>
                  </div>
                  <Button
                    className="workspace-button"
                    color="gray"
                    onClick={() =>
                      setIsAdvancedTuningExpanded((current) => !current)
                    }
                    radius="xl"
                    size="xs"
                    variant="light"
                    disabled={isSaving}
                  >
                    {isAdvancedTuningExpanded
                      ? t('assistant.hideAdvancedTuning')
                      : t('assistant.showAdvancedTuning')}
                  </Button>
                </Group>

                {isAdvancedTuningExpanded ? (
                  <Stack gap="md">
                    <Switch
                      checked={form.values.strategyOverrideEnabled}
                      label={t('assistant.strategyOverrideEnabled')}
                      onChange={(event) =>
                        form.setFieldValue(
                          'strategyOverrideEnabled',
                          event.currentTarget.checked
                        )
                      }
                    />

                    <Alert color="gray" radius="xl" variant="light">
                      {t('assistant.retrievalStrategyHelp')}
                    </Alert>

                    {form.values.strategyOverrideEnabled ? (
                      <Grid gutter="md">
                        <Grid.Col span={{ base: 12, md: 4 }}>
                          <NativeSelect
                            classNames={{ input: 'workspace-input' }}
                            data-testid="assistant-strategy-mode"
                            data={[
                              {
                                value: 'vector',
                                label: t('assistant.retrievalModeVector')
                              },
                              {
                                value: 'hybrid',
                                label: t('assistant.retrievalModeHybrid')
                              },
                              {
                                value: 'lexical',
                                label: t('assistant.retrievalModeLexical')
                              }
                            ]}
                            label={t('assistant.candidateSelectionMode')}
                            {...form.getInputProps('candidateSelectionMode')}
                          />
                        </Grid.Col>
                        <Grid.Col span={{ base: 12, md: 4 }}>
                          <NumberInput
                            classNames={{ input: 'workspace-input' }}
                            label={t('assistant.candidateMultiplier')}
                            max={20}
                            min={1}
                            {...form.getInputProps('candidateMultiplier')}
                          />
                        </Grid.Col>
                        <Grid.Col span={{ base: 12, md: 4 }}>
                          <NumberInput
                            classNames={{ input: 'workspace-input' }}
                            label={t('assistant.minCandidates')}
                            max={50}
                            min={1}
                            {...form.getInputProps('minCandidates')}
                          />
                        </Grid.Col>
                        <Grid.Col span={{ base: 12, md: 6 }}>
                          <NumberInput
                            classNames={{ input: 'workspace-input' }}
                            decimalScale={2}
                            label={t('assistant.hybridVectorWeight')}
                            max={1}
                            min={0}
                            step={0.05}
                            {...form.getInputProps('hybridVectorWeight')}
                          />
                        </Grid.Col>
                        <Grid.Col span={{ base: 12, md: 6 }}>
                          <NumberInput
                            classNames={{ input: 'workspace-input' }}
                            decimalScale={2}
                            label={t('assistant.hybridLexicalWeight')}
                            max={1}
                            min={0}
                            step={0.05}
                            {...form.getInputProps('hybridLexicalWeight')}
                          />
                        </Grid.Col>
                        <Grid.Col span={{ base: 12, md: 6 }}>
                          <Switch
                            checked={form.values.rerankStrategyEnabled}
                            label={t('assistant.rerankStrategyEnabled')}
                            onChange={(event) =>
                              form.setFieldValue(
                                'rerankStrategyEnabled',
                                event.currentTarget.checked
                              )
                            }
                          />
                        </Grid.Col>
                      </Grid>
                    ) : (
                      <Alert color="gray" radius="xl" variant="light">
                        {t('assistant.retrievalStrategyDefaultNote')}
                      </Alert>
                    )}
                  </Stack>
                ) : (
                  <Alert color="gray" radius="xl" variant="light">
                    {hasAdvancedTuningOverrides(retrievalProfile)
                      ? t('assistant.advancedTuningCustomSummary')
                      : t('assistant.advancedTuningDefaultSummary')}
                  </Alert>
                )}
              </Stack>
            </Paper>

            <Paper
              className="workspace-panel-hover workspace-panel-muted"
              id="assistant-filters-section"
              p="lg"
              radius="xl"
              style={{ scrollMarginTop: '96px' }}
            >
              <Stack gap="md">
                <Group justify="space-between" wrap="wrap">
                  <div>
                    <Text className="workspace-section-heading">
                      {t('assistant.retrievalFiltersSection')}
                    </Text>
                    <Text c="var(--app-text-muted)" size="sm">
                      {t('assistant.filterHelp')}
                    </Text>
                  </div>
                  <Button
                    className="workspace-button"
                    color="gray"
                    onClick={() => setIsFiltersExpanded((current) => !current)}
                    radius="xl"
                    size="xs"
                    variant="light"
                    disabled={isSaving}
                  >
                    {isFiltersExpanded
                      ? t('assistant.hideFilters')
                      : t('assistant.showFilters')}
                  </Button>
                </Group>

                {isFiltersExpanded ? (
                  <Grid gutter="md">
                    <Grid.Col span={{ base: 12, md: 6 }}>
                      <Textarea
                        autosize
                        classNames={{ input: 'workspace-input' }}
                        description={t('assistant.listFieldHint')}
                        label={t('assistant.documentIdsInclude')}
                        minRows={2}
                        {...form.getInputProps('documentIdsInclude')}
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 6 }}>
                      <Textarea
                        autosize
                        classNames={{ input: 'workspace-input' }}
                        description={t('assistant.listFieldHint')}
                        label={t('assistant.documentIdsExclude')}
                        minRows={2}
                        {...form.getInputProps('documentIdsExclude')}
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 6 }}>
                      <Textarea
                        autosize
                        classNames={{ input: 'workspace-input' }}
                        description={t('assistant.listFieldHint')}
                        label={t('assistant.sectionTitlesInclude')}
                        minRows={2}
                        {...form.getInputProps('sectionTitlesInclude')}
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 6 }}>
                      <Textarea
                        autosize
                        classNames={{ input: 'workspace-input' }}
                        description={t('assistant.listFieldHint')}
                        label={t('assistant.sectionTitlesExclude')}
                        minRows={2}
                        {...form.getInputProps('sectionTitlesExclude')}
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 6 }}>
                      <Textarea
                        autosize
                        classNames={{ input: 'workspace-input' }}
                        description={t('assistant.listFieldHint')}
                        label={t('assistant.sectionTitlesContains')}
                        minRows={2}
                        {...form.getInputProps('sectionTitlesContains')}
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 6 }}>
                      <Textarea
                        autosize
                        classNames={{ input: 'workspace-input' }}
                        description={t('assistant.listFieldHint')}
                        label={t('assistant.pageNumbersInclude')}
                        minRows={2}
                        {...form.getInputProps('pageNumbersInclude')}
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 6 }}>
                      <Textarea
                        autosize
                        classNames={{ input: 'workspace-input' }}
                        description={t('assistant.listFieldHint')}
                        label={t('assistant.pageNumbersExclude')}
                        minRows={2}
                        {...form.getInputProps('pageNumbersExclude')}
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 3 }}>
                      <NumberInput
                        classNames={{ input: 'workspace-input' }}
                        label={t('assistant.pageNumbersMin')}
                        min={0}
                        {...form.getInputProps('pageNumbersMin')}
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 3 }}>
                      <NumberInput
                        classNames={{ input: 'workspace-input' }}
                        label={t('assistant.pageNumbersMax')}
                        min={0}
                        {...form.getInputProps('pageNumbersMax')}
                      />
                    </Grid.Col>
                  </Grid>
                ) : (
                  <Alert color="gray" radius="xl" variant="light">
                    {hasFilterOverrides(retrievalProfile)
                      ? t('assistant.filtersCustomSummary')
                      : t('assistant.filtersDefaultSummary')}
                  </Alert>
                )}
              </Stack>
            </Paper>
          </Stack>
        </div>

        <div className="workspace-page-side-stack">
          <Stack gap="md">
            <Paper
              className="workspace-panel-hover workspace-panel-strong"
              p="lg"
              radius="xl"
            >
              <Stack gap="sm">
                <Text className="workspace-section-heading">
                  {t('assistant.copy.workspaceStatus')}
                </Text>
                <Text c="var(--app-text-muted)" size="sm">
                  {t('assistant.copy.saveCheckpointCopy')}
                </Text>
                <div className="workspace-meta-row">
                  <span className="workspace-meta-label">
                    {t('assistant.copy.currentLibraryLabel')}
                  </span>
                  <span
                    className="workspace-meta-value"
                    data-testid="assistant-current-library-name"
                  >
                    {knowledgeBase.name}
                  </span>
                </div>
                <div className="workspace-meta-row">
                  <span className="workspace-meta-label">
                    {t('assistant.copy.currentAssistantBindingLabel')}
                  </span>
                  <span
                    className="workspace-meta-value"
                    data-testid="assistant-current-binding-status"
                  >
                    {t('assistant.copy.currentAssistantBindingValue')}
                  </span>
                </div>
                <Text c="var(--app-text-secondary)" size="sm">
                  {documentCount > 0
                    ? locale === 'zh'
                      ? `${documentCount} 份资料会继续沿用当前设置。`
                      : `${documentCount} library items will use these settings.`
                    : t('assistant.copy.heroSubtitle')}
                </Text>
                {isSaving ? (
                  <Text c="var(--app-text-muted)" size="xs">
                    {locale === 'zh' ? '正在保存设置...' : 'Saving settings...'}
                  </Text>
                ) : null}
                <Button
                  className="workspace-button"
                  color="indigo"
                  loading={isSaving}
                  radius="xl"
                  type="submit"
                >
                  {isSaving
                    ? locale === 'zh'
                      ? '保存中'
                      : 'Saving'
                    : t('common.actions.saveChanges')}
                </Button>
              </Stack>
            </Paper>
          </Stack>
        </div>
      </div>
    </form>
  );
}

export function buildAssistantSettingsSaveHandler(args: {
  updateAssistant: (
    payload: ReturnType<typeof buildAssistantUpdatePayload>
  ) => Promise<unknown>;
  updateRetrievalProfile: (
    payload: ReturnType<typeof buildRetrievalProfileUpdatePayload>
  ) => Promise<unknown>;
}) {
  return async (values: AssistantConfigFormValues) => {
    await args.updateAssistant(buildAssistantUpdatePayload(values));
    await args.updateRetrievalProfile(
      buildRetrievalProfileUpdatePayload(values)
    );
  };
}
