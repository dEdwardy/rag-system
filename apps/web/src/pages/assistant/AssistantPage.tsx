import {
  Alert,
  Badge,
  Box,
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
  TextInput,
  Title
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { useEffect } from "react";
import { StatePanel } from "../../components/StatePanel";
import {
  useAssistants,
  useRetrievalProfiles,
  useUpdateAssistant,
  useUpdateRetrievalProfile
} from "../../features/api/hooks";
import { useI18n } from "../../i18n/I18nProvider";
import {
  AssistantConfigFormValues,
  buildAssistantUpdatePayload,
  buildRetrievalProfileUpdatePayload,
  createAssistantConfigFormValues
} from "./assistant-config-form";

export function AssistantPage() {
  const assistantsQuery = useAssistants();
  const retrievalProfilesQuery = useRetrievalProfiles();
  const assistant = assistantsQuery.data?.[0] ?? null;
  const retrievalProfile =
    retrievalProfilesQuery.data?.find(profile => profile.id === assistant?.retrievalProfileId) ?? null;
  const updateAssistantMutation = useUpdateAssistant(assistant?.id ?? "default-assistant");
  const updateRetrievalProfileMutation = useUpdateRetrievalProfile(
    retrievalProfile?.id ?? "default-retrieval-profile"
  );
  const { t, locale } = useI18n();

  const form = useForm<AssistantConfigFormValues>({
    initialValues: createAssistantConfigFormValues(assistant, retrievalProfile),
    mode: "controlled"
  });

  useEffect(() => {
    form.setValues(createAssistantConfigFormValues(assistant, retrievalProfile));
  }, [assistant, retrievalProfile]);

  return (
    <Stack data-testid="assistant-page" gap="md">
      <Paper className="workspace-hero" p="lg" radius="xl">
        <div className="workspace-hero-split">
          <Group gap="md" wrap="nowrap">
            <Box className="workspace-hero-icon">CFG</Box>
            <div className="workspace-hero-copy">
              <Text className="workspace-hero-kicker">
                {locale === "zh" ? "助手工作台" : "Assistant workspace"}
              </Text>
              <Title
                c="var(--app-text)"
                order={3}
                style={{ fontFamily: "var(--app-font-display)", letterSpacing: "-0.03em" }}
              >
                {t("assistant.title")}
              </Title>
              <Text c="var(--app-text-muted)" mt={4} size="sm">
                {t("assistant.subtitle")}
              </Text>
            </div>
          </Group>

          {assistant ? (
            <Stack align="flex-end" gap={10}>
              <Group gap="xs">
                <Badge color={assistant.status === "active" ? "indigo" : "gray"} radius="sm" variant="light">
                  {t(`common.status.${assistant.status}`)}
                </Badge>
                {retrievalProfile ? (
                  <Badge color="gray" radius="sm" variant="light">
                    {retrievalProfile.name}
                  </Badge>
                ) : null}
              </Group>
              <Text className="workspace-hero-sidecopy" ta="right">
                {locale === "zh"
                  ? "把回答策略、检索参数和过滤条件收进同一套配置工作台中，不改变现有提交语义。"
                  : "Keep policy, retrieval tuning, and filters in one workspace without changing the current payload semantics."}
              </Text>
            </Stack>
          ) : null}
        </div>
      </Paper>

      {assistantsQuery.isLoading || retrievalProfilesQuery.isLoading ? (
        <StatePanel
          description={t("assistant.loadingDescription")}
          title={t("assistant.loadingTitle")}
          tone="loading"
        />
      ) : null}

      {assistantsQuery.isError ? (
        <StatePanel
          description={assistantsQuery.error instanceof Error ? assistantsQuery.error.message : undefined}
          title={t("assistant.assistantLoadError")}
          tone="error"
        />
      ) : null}

      {retrievalProfilesQuery.isError ? (
        <StatePanel
          description={
            retrievalProfilesQuery.error instanceof Error ? retrievalProfilesQuery.error.message : undefined
          }
          title={t("assistant.retrievalProfileLoadError")}
          tone="error"
        />
      ) : null}

      {assistant && retrievalProfile ? (
        <Box
          component="form"
          onSubmit={form.onSubmit(async values => {
            try {
              await updateAssistantMutation.mutateAsync(buildAssistantUpdatePayload(values));
              await updateRetrievalProfileMutation.mutateAsync(buildRetrievalProfileUpdatePayload(values));

              notifications.show({
                color: "teal",
                message: t("assistant.updated")
              });
            } catch (error) {
              notifications.show({
                color: "red",
                message: error instanceof Error ? error.message : t("assistant.updateError")
              });
            }
          })}
        >
          <div className="workspace-page-grid workspace-page-grid-main-first">
            <div className="workspace-page-main-stack">
              <Stack gap="md">
                <Paper className="workspace-panel-hover workspace-panel-strong" p="lg" radius="xl">
                  <Stack gap="md">
                    <div>
                      <Text className="workspace-section-heading">
                        {locale === "zh" ? "助手身份" : "Assistant identity"}
                      </Text>
                      <Text c="var(--app-text-muted)" size="sm">
                        {locale === "zh"
                          ? "名称、状态、描述和 system prompt 保持在同一块主控制面板中。"
                          : "Name, status, description, and system prompt stay in one control surface."}
                      </Text>
                    </div>

                    <Grid gutter="md">
                      <Grid.Col span={{ base: 12, md: 8 }}>
                        <TextInput
                          classNames={{ input: "workspace-input" }}
                          data-testid="assistant-name-value"
                          label={t("assistant.assistantName")}
                          {...form.getInputProps("name")}
                        />
                      </Grid.Col>
                      <Grid.Col span={{ base: 12, md: 4 }}>
                        <TextInput
                          classNames={{ input: "workspace-input" }}
                          label={t("assistant.status")}
                          readOnly
                          value={t(`common.status.${form.values.status}`)}
                        />
                      </Grid.Col>
                    </Grid>

                    <Switch
                      checked={form.values.status === "active"}
                      label={
                        form.values.status === "active"
                          ? t("assistant.assistantIsActive")
                          : t("assistant.assistantIsInactive")
                      }
                      onChange={event =>
                        form.setFieldValue("status", event.currentTarget.checked ? "active" : "inactive")
                      }
                    />

                    <TextInput
                      classNames={{ input: "workspace-input" }}
                      label={t("common.fields.description")}
                      {...form.getInputProps("description")}
                    />

                    <Textarea
                      autosize
                      classNames={{ input: "workspace-input" }}
                      label={t("common.fields.systemPrompt")}
                      minRows={6}
                      {...form.getInputProps("systemPrompt")}
                    />
                  </Stack>
                </Paper>

                <Paper className="workspace-panel-hover workspace-panel-muted" p="lg" radius="xl">
                  <Stack gap="md">
                    <div>
                      <Text className="workspace-section-heading">{t("assistant.answerPolicySection")}</Text>
                      <Text c="var(--app-text-muted)" size="sm">
                        {locale === "zh"
                          ? "只收紧输入层级、分组和可读性，不改变 answer policy 的字段含义。"
                          : "Control tone, structure, citation policy, and fallback behavior without changing backend semantics."}
                      </Text>
                    </div>

                    <Grid gutter="md">
                      <Grid.Col span={{ base: 12, md: 4 }}>
                        <NativeSelect
                          classNames={{ input: "workspace-input" }}
                          data={[
                            { value: "concise", label: t("assistant.responseStyleConcise") },
                            { value: "balanced", label: t("assistant.responseStyleBalanced") },
                            { value: "detailed", label: t("assistant.responseStyleDetailed") }
                          ]}
                          label={t("assistant.responseStyle")}
                          {...form.getInputProps("responseStyle")}
                        />
                      </Grid.Col>
                      <Grid.Col span={{ base: 12, md: 4 }}>
                        <NativeSelect
                          classNames={{ input: "workspace-input" }}
                          data={[
                            { value: "neutral", label: t("assistant.toneNeutral") },
                            { value: "friendly", label: t("assistant.toneFriendly") },
                            { value: "direct", label: t("assistant.toneDirect") }
                          ]}
                          label={t("assistant.tone")}
                          {...form.getInputProps("tone")}
                        />
                      </Grid.Col>
                      <Grid.Col span={{ base: 12, md: 4 }}>
                        <NativeSelect
                          classNames={{ input: "workspace-input" }}
                          data={[
                            { value: "paragraph", label: t("assistant.outputFormatParagraph") },
                            { value: "bullets", label: t("assistant.outputFormatBullets") },
                            { value: "markdown", label: t("assistant.outputFormatMarkdown") }
                          ]}
                          label={t("assistant.outputFormat")}
                          {...form.getInputProps("outputFormat")}
                        />
                      </Grid.Col>
                      <Grid.Col span={{ base: 12, md: 4 }}>
                        <NativeSelect
                          classNames={{ input: "workspace-input" }}
                          data={[
                            { value: "auto", label: t("assistant.languageAuto") },
                            { value: "same_as_question", label: t("assistant.languageSameAsQuestion") },
                            { value: "zh", label: t("assistant.languageZh") },
                            { value: "en", label: t("assistant.languageEn") }
                          ]}
                          label={t("assistant.language")}
                          {...form.getInputProps("language")}
                        />
                      </Grid.Col>
                      <Grid.Col span={{ base: 12, md: 4 }}>
                        <NativeSelect
                          classNames={{ input: "workspace-input" }}
                          data={[
                            { value: "required", label: t("assistant.citationModeRequired") },
                            { value: "optional", label: t("assistant.citationModeOptional") }
                          ]}
                          label={t("assistant.citationMode")}
                          {...form.getInputProps("citationMode")}
                        />
                      </Grid.Col>
                      <Grid.Col span={{ base: 12, md: 4 }}>
                        <NativeSelect
                          classNames={{ input: "workspace-input" }}
                          data={[
                            {
                              value: "say_insufficient_context",
                              label: t("assistant.noAnswerBehaviorInsufficientContext")
                            },
                            {
                              value: "best_effort",
                              label: t("assistant.noAnswerBehaviorBestEffort")
                            }
                          ]}
                          label={t("assistant.noAnswerBehavior")}
                          {...form.getInputProps("noAnswerBehavior")}
                        />
                      </Grid.Col>
                      <Grid.Col span={{ base: 12, md: 4 }}>
                        <NumberInput
                          classNames={{ input: "workspace-input" }}
                          label={t("assistant.maxCitations")}
                          max={8}
                          min={1}
                          {...form.getInputProps("maxCitations")}
                        />
                      </Grid.Col>
                    </Grid>

                    <Switch
                      checked={form.values.includeMissingInformation}
                      label={t("assistant.includeMissingInformation")}
                      onChange={event =>
                        form.setFieldValue("includeMissingInformation", event.currentTarget.checked)
                      }
                    />
                  </Stack>
                </Paper>

                <Paper className="workspace-panel-hover workspace-panel-muted" p="lg" radius="xl">
                  <Stack gap="md">
                    <div>
                      <Text className="workspace-section-heading">{t("assistant.retrievalSection")}</Text>
                      <Text c="var(--app-text-muted)" size="sm">
                        {locale === "zh"
                          ? "保留现有 retrieval tuning 字段和提交逻辑，只优化配置层级与可扫读性。"
                          : "Tune retrieval depth and rerank behavior while keeping the same payload contract."}
                      </Text>
                    </div>

                    <Grid gutter="md">
                      <Grid.Col span={{ base: 12, md: 4 }}>
                        <NumberInput
                          classNames={{ input: "workspace-input" }}
                          label={t("common.fields.topK")}
                          max={20}
                          min={1}
                          {...form.getInputProps("topK")}
                        />
                      </Grid.Col>
                      <Grid.Col span={{ base: 12, md: 4 }}>
                        <NumberInput
                          classNames={{ input: "workspace-input" }}
                          label={t("common.fields.chunkWindow")}
                          max={5}
                          min={0}
                          {...form.getInputProps("chunkWindow")}
                        />
                      </Grid.Col>
                      <Grid.Col span={{ base: 12, md: 4 }}>
                        <NumberInput
                          classNames={{ input: "workspace-input" }}
                          decimalScale={0}
                          label={t("common.fields.scoreThreshold")}
                          max={100}
                          min={0}
                          {...form.getInputProps("scoreThreshold")}
                        />
                      </Grid.Col>
                    </Grid>

                    <Switch
                      checked={form.values.enableHybrid}
                      label={t("assistant.hybridLabel")}
                      onChange={event => form.setFieldValue("enableHybrid", event.currentTarget.checked)}
                    />

                    <Switch
                      checked={form.values.enableRerank}
                      label={t("assistant.rerankLabel")}
                      onChange={event => form.setFieldValue("enableRerank", event.currentTarget.checked)}
                    />

                    <Alert color="blue" radius="xl" variant="light">
                      {t("assistant.note")}
                    </Alert>
                  </Stack>
                </Paper>

                <Paper
                  className="workspace-panel-hover workspace-panel-muted"
                  data-testid="assistant-retrieval-strategy-section"
                  p="lg"
                  radius="xl"
                >
                  <Stack gap="md">
                    <div>
                      <Text className="workspace-section-heading">{t("assistant.retrievalStrategySection")}</Text>
                      <Text c="var(--app-text-muted)" size="sm">
                        {t("assistant.retrievalStrategyHelp")}
                      </Text>
                    </div>

                    <Switch
                      checked={form.values.strategyOverrideEnabled}
                      data-testid="assistant-strategy-override-toggle"
                      label={t("assistant.strategyOverrideEnabled")}
                      onChange={event =>
                        form.setFieldValue("strategyOverrideEnabled", event.currentTarget.checked)
                      }
                    />

                    {form.values.strategyOverrideEnabled ? (
                      <Grid gutter="md">
                        <Grid.Col span={{ base: 12, md: 4 }}>
                          <NativeSelect
                            classNames={{ input: "workspace-input" }}
                            data-testid="assistant-strategy-mode"
                            data={[
                              { value: "vector", label: t("assistant.retrievalModeVector") },
                              { value: "hybrid", label: t("assistant.retrievalModeHybrid") },
                              { value: "lexical", label: t("assistant.retrievalModeLexical") }
                            ]}
                            label={t("assistant.candidateSelectionMode")}
                            {...form.getInputProps("candidateSelectionMode")}
                          />
                        </Grid.Col>
                        <Grid.Col span={{ base: 12, md: 4 }}>
                          <NumberInput
                            classNames={{ input: "workspace-input" }}
                            label={t("assistant.candidateMultiplier")}
                            max={10}
                            min={1}
                            {...form.getInputProps("candidateMultiplier")}
                          />
                        </Grid.Col>
                        <Grid.Col span={{ base: 12, md: 4 }}>
                          <NumberInput
                            classNames={{ input: "workspace-input" }}
                            label={t("assistant.minCandidates")}
                            max={100}
                            min={1}
                            {...form.getInputProps("minCandidates")}
                          />
                        </Grid.Col>
                        <Grid.Col span={{ base: 12, md: 6 }}>
                          <NumberInput
                            classNames={{ input: "workspace-input" }}
                            decimalScale={2}
                            label={t("assistant.hybridVectorWeight")}
                            max={1}
                            min={0}
                            step={0.1}
                            {...form.getInputProps("hybridVectorWeight")}
                          />
                        </Grid.Col>
                        <Grid.Col span={{ base: 12, md: 6 }}>
                          <NumberInput
                            classNames={{ input: "workspace-input" }}
                            decimalScale={2}
                            label={t("assistant.hybridLexicalWeight")}
                            max={1}
                            min={0}
                            step={0.1}
                            {...form.getInputProps("hybridLexicalWeight")}
                          />
                        </Grid.Col>
                        <Grid.Col span={{ base: 12, md: 6 }}>
                          <Switch
                            checked={form.values.queryRewriteEnabled}
                            label={t("assistant.queryRewriteEnabled")}
                            onChange={event =>
                              form.setFieldValue("queryRewriteEnabled", event.currentTarget.checked)
                            }
                          />
                        </Grid.Col>
                        <Grid.Col span={{ base: 12, md: 6 }}>
                          <Switch
                            checked={form.values.rerankStrategyEnabled}
                            label={t("assistant.rerankStrategyEnabled")}
                            onChange={event =>
                              form.setFieldValue("rerankStrategyEnabled", event.currentTarget.checked)
                            }
                          />
                        </Grid.Col>
                      </Grid>
                    ) : (
                      <Alert color="gray" radius="xl" variant="light">
                        {t("assistant.retrievalStrategyDefaultNote")}
                      </Alert>
                    )}
                  </Stack>
                </Paper>

                <Paper className="workspace-panel-hover workspace-panel-muted" p="lg" radius="xl">
                  <Stack gap="md">
                    <div>
                      <Text className="workspace-section-heading">{t("assistant.retrievalFiltersSection")}</Text>
                      <Text c="var(--app-text-muted)" size="sm">
                        {t("assistant.filterHelp")}
                      </Text>
                    </div>

                    <Grid gutter="md">
                      <Grid.Col span={{ base: 12, md: 6 }}>
                        <Textarea
                          autosize
                          classNames={{ input: "workspace-input" }}
                          description={t("assistant.listFieldHint")}
                          label={t("assistant.documentIdsInclude")}
                          minRows={2}
                          {...form.getInputProps("documentIdsInclude")}
                        />
                      </Grid.Col>
                      <Grid.Col span={{ base: 12, md: 6 }}>
                        <Textarea
                          autosize
                          classNames={{ input: "workspace-input" }}
                          description={t("assistant.listFieldHint")}
                          label={t("assistant.documentIdsExclude")}
                          minRows={2}
                          {...form.getInputProps("documentIdsExclude")}
                        />
                      </Grid.Col>
                      <Grid.Col span={{ base: 12, md: 4 }}>
                        <Textarea
                          autosize
                          classNames={{ input: "workspace-input" }}
                          description={t("assistant.listFieldHint")}
                          label={t("assistant.sectionTitlesInclude")}
                          minRows={2}
                          {...form.getInputProps("sectionTitlesInclude")}
                        />
                      </Grid.Col>
                      <Grid.Col span={{ base: 12, md: 4 }}>
                        <Textarea
                          autosize
                          classNames={{ input: "workspace-input" }}
                          description={t("assistant.listFieldHint")}
                          label={t("assistant.sectionTitlesExclude")}
                          minRows={2}
                          {...form.getInputProps("sectionTitlesExclude")}
                        />
                      </Grid.Col>
                      <Grid.Col span={{ base: 12, md: 4 }}>
                        <Textarea
                          autosize
                          classNames={{ input: "workspace-input" }}
                          description={t("assistant.listFieldHint")}
                          label={t("assistant.sectionTitlesContains")}
                          minRows={2}
                          {...form.getInputProps("sectionTitlesContains")}
                        />
                      </Grid.Col>
                      <Grid.Col span={{ base: 12, md: 4 }}>
                        <Textarea
                          autosize
                          classNames={{ input: "workspace-input" }}
                          description={t("assistant.listFieldHint")}
                          label={t("assistant.pageNumbersInclude")}
                          minRows={2}
                          {...form.getInputProps("pageNumbersInclude")}
                        />
                      </Grid.Col>
                      <Grid.Col span={{ base: 12, md: 4 }}>
                        <Textarea
                          autosize
                          classNames={{ input: "workspace-input" }}
                          description={t("assistant.listFieldHint")}
                          label={t("assistant.pageNumbersExclude")}
                          minRows={2}
                          {...form.getInputProps("pageNumbersExclude")}
                        />
                      </Grid.Col>
                      <Grid.Col span={{ base: 12, md: 2 }}>
                        <NumberInput
                          classNames={{ input: "workspace-input" }}
                          label={t("assistant.pageNumbersMin")}
                          min={0}
                          {...form.getInputProps("pageNumbersMin")}
                        />
                      </Grid.Col>
                      <Grid.Col span={{ base: 12, md: 2 }}>
                        <NumberInput
                          classNames={{ input: "workspace-input" }}
                          label={t("assistant.pageNumbersMax")}
                          min={0}
                          {...form.getInputProps("pageNumbersMax")}
                        />
                      </Grid.Col>
                    </Grid>
                  </Stack>
                </Paper>
              </Stack>
            </div>

            <div className="workspace-page-side-stack">
              <div className="workspace-sticky-panel">
                <Stack gap="md">
                  <Paper className="workspace-panel-hover workspace-panel-muted" p="lg" radius="xl">
                    <Stack gap="sm">
                      <Text className="workspace-section-heading">
                        {locale === "zh" ? "工作台状态" : "Workspace status"}
                      </Text>
                      <Text c="var(--app-text)" data-testid="assistant-retrieval-profile-name" fw={600} size="sm">
                        {t("common.fields.retrievalProfile")}: {retrievalProfile.name}
                      </Text>
                      <Text c="var(--app-text-muted)" size="sm">
                        {t("common.fields.assistantId")}: <span data-testid="assistant-id">{assistant.id}</span>
                      </Text>
                      <Text c="var(--app-text-muted)" data-testid="assistant-name-text" size="sm">
                        {assistant.name}
                      </Text>
                      <Text c="var(--app-text-muted)" size="sm">
                        {t("common.fields.profileId")}: {retrievalProfile.id}
                      </Text>
                    </Stack>
                  </Paper>

                  <Paper className="workspace-panel-hover workspace-panel-strong" p="lg" radius="xl">
                    <Stack gap="sm">
                      <Text className="workspace-section-heading">
                        {locale === "zh" ? "保存检查点" : "Save checkpoint"}
                      </Text>
                      <Text c="var(--app-text-muted)" size="sm">
                        {locale === "zh"
                          ? "一次提交同时持久化 assistant policy 和 retrieval profile。"
                          : "Submit once to persist both assistant policy and retrieval profile changes together."}
                      </Text>
                      <Button
                        className="workspace-button"
                        color="indigo"
                        loading={updateAssistantMutation.isPending || updateRetrievalProfileMutation.isPending}
                        radius="xl"
                        type="submit"
                      >
                        {t("common.actions.saveChanges")}
                      </Button>
                    </Stack>
                  </Paper>
                </Stack>
              </div>
            </div>
          </div>
        </Box>
      ) : null}

      {!assistantsQuery.isLoading && !retrievalProfilesQuery.isLoading && !assistant ? (
        <StatePanel
          description={t("assistant.noAssistantDescription")}
          title={t("assistant.noAssistantTitle")}
        />
      ) : null}

      {!assistantsQuery.isLoading && !retrievalProfilesQuery.isLoading && assistant && !retrievalProfile ? (
        <StatePanel
          description={t("assistant.missingProfileDescription")}
          title={t("assistant.missingProfileTitle")}
          tone="error"
        />
      ) : null}
    </Stack>
  );
}
