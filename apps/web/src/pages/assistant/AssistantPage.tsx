import {
  Alert,
  Badge,
  Button,
  Card,
  Divider,
  Grid,
  Group,
  NativeSelect,
  NumberInput,
  Stack,
  Textarea,
  Switch,
  Text,
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
  const { t } = useI18n();

  const form = useForm<AssistantConfigFormValues>({
    initialValues: createAssistantConfigFormValues(assistant, retrievalProfile),
    mode: "controlled"
  });

  useEffect(() => {
    form.setValues(createAssistantConfigFormValues(assistant, retrievalProfile));
  }, [
    assistant,
    retrievalProfile
  ]);

  return (
    <Stack data-testid="assistant-page" gap="lg">
      <div>
        <Title order={2}>{t("assistant.title")}</Title>
        <Text c="dimmed">
          {t("assistant.subtitle")}
        </Text>
      </div>

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
        <Card
          component="form"
          onSubmit={form.onSubmit(async values => {
            try {
              await updateAssistantMutation.mutateAsync(buildAssistantUpdatePayload(values));

              await updateRetrievalProfileMutation.mutateAsync(
                buildRetrievalProfileUpdatePayload(values)
              );

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
          withBorder
          padding="lg"
          radius="lg"
        >
          <Stack gap="md">
            <Group justify="space-between" align="center">
              <Badge color={assistant.status === "active" ? "teal" : "gray"} variant="light" w="fit-content">
                {t(`common.status.${assistant.status}`)}
              </Badge>
              <Text c="dimmed" data-testid="assistant-retrieval-profile-name" size="sm">
                {t("common.fields.retrievalProfile")}: {retrievalProfile.name}
              </Text>
            </Group>

            <Grid gutter="md">
              <Grid.Col span={{ base: 12, md: 8 }}>
                <TextInput
                  label={t("assistant.assistantName")}
                  data-testid="assistant-name-value"
                  {...form.getInputProps("name")}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, md: 4 }}>
                <TextInput
                  label={t("assistant.status")}
                  readOnly
                  value={t(`common.status.${form.values.status}`)}
                />
              </Grid.Col>
            </Grid>

            <Switch
              checked={form.values.status === "active"}
              label={form.values.status === "active" ? t("assistant.assistantIsActive") : t("assistant.assistantIsInactive")}
              onChange={event => form.setFieldValue("status", event.currentTarget.checked ? "active" : "inactive")}
            />

            <TextInput
              label={t("common.fields.description")}
              {...form.getInputProps("description")}
            />

            <Textarea
              autosize
              label={t("common.fields.systemPrompt")}
              minRows={6}
              {...form.getInputProps("systemPrompt")}
            />

            <Divider label={t("assistant.answerPolicySection")} labelPosition="center" />

            <Grid gutter="md">
              <Grid.Col span={{ base: 12, md: 4 }}>
                <NativeSelect
                  label={t("assistant.responseStyle")}
                  data={[
                    { value: "concise", label: t("assistant.responseStyleConcise") },
                    { value: "balanced", label: t("assistant.responseStyleBalanced") },
                    { value: "detailed", label: t("assistant.responseStyleDetailed") }
                  ]}
                  {...form.getInputProps("responseStyle")}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, md: 4 }}>
                <NativeSelect
                  label={t("assistant.tone")}
                  data={[
                    { value: "neutral", label: t("assistant.toneNeutral") },
                    { value: "friendly", label: t("assistant.toneFriendly") },
                    { value: "direct", label: t("assistant.toneDirect") }
                  ]}
                  {...form.getInputProps("tone")}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, md: 4 }}>
                <NativeSelect
                  label={t("assistant.outputFormat")}
                  data={[
                    { value: "paragraph", label: t("assistant.outputFormatParagraph") },
                    { value: "bullets", label: t("assistant.outputFormatBullets") },
                    { value: "markdown", label: t("assistant.outputFormatMarkdown") }
                  ]}
                  {...form.getInputProps("outputFormat")}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, md: 4 }}>
                <NativeSelect
                  label={t("assistant.language")}
                  data={[
                    { value: "auto", label: t("assistant.languageAuto") },
                    { value: "same_as_question", label: t("assistant.languageSameAsQuestion") },
                    { value: "zh", label: t("assistant.languageZh") },
                    { value: "en", label: t("assistant.languageEn") }
                  ]}
                  {...form.getInputProps("language")}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, md: 4 }}>
                <NativeSelect
                  label={t("assistant.citationMode")}
                  data={[
                    { value: "required", label: t("assistant.citationModeRequired") },
                    { value: "optional", label: t("assistant.citationModeOptional") }
                  ]}
                  {...form.getInputProps("citationMode")}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, md: 4 }}>
                <NativeSelect
                  label={t("assistant.noAnswerBehavior")}
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
                  {...form.getInputProps("noAnswerBehavior")}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, md: 4 }}>
                <NumberInput
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

            <Divider label={t("assistant.retrievalSection")} labelPosition="center" />

            <Grid gutter="md">
              <Grid.Col span={{ base: 12, md: 4 }}>
                <NumberInput
                  label={t("common.fields.topK")}
                  max={20}
                  min={1}
                  {...form.getInputProps("topK")}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, md: 4 }}>
                <NumberInput
                  label={t("common.fields.chunkWindow")}
                  max={5}
                  min={0}
                  {...form.getInputProps("chunkWindow")}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, md: 4 }}>
                <NumberInput
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

            <Alert color="blue" variant="light">
              {t("assistant.note")}
            </Alert>

            <Divider label={t("assistant.retrievalFiltersSection")} labelPosition="center" />

            <Text c="dimmed" size="sm">
              {t("assistant.filterHelp")}
            </Text>

            <Grid gutter="md">
              <Grid.Col span={{ base: 12, md: 6 }}>
                <Textarea
                  autosize
                  description={t("assistant.listFieldHint")}
                  label={t("assistant.documentIdsInclude")}
                  minRows={2}
                  {...form.getInputProps("documentIdsInclude")}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, md: 6 }}>
                <Textarea
                  autosize
                  description={t("assistant.listFieldHint")}
                  label={t("assistant.documentIdsExclude")}
                  minRows={2}
                  {...form.getInputProps("documentIdsExclude")}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, md: 4 }}>
                <Textarea
                  autosize
                  description={t("assistant.listFieldHint")}
                  label={t("assistant.sectionTitlesInclude")}
                  minRows={2}
                  {...form.getInputProps("sectionTitlesInclude")}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, md: 4 }}>
                <Textarea
                  autosize
                  description={t("assistant.listFieldHint")}
                  label={t("assistant.sectionTitlesExclude")}
                  minRows={2}
                  {...form.getInputProps("sectionTitlesExclude")}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, md: 4 }}>
                <Textarea
                  autosize
                  description={t("assistant.listFieldHint")}
                  label={t("assistant.sectionTitlesContains")}
                  minRows={2}
                  {...form.getInputProps("sectionTitlesContains")}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, md: 4 }}>
                <Textarea
                  autosize
                  description={t("assistant.listFieldHint")}
                  label={t("assistant.pageNumbersInclude")}
                  minRows={2}
                  {...form.getInputProps("pageNumbersInclude")}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, md: 4 }}>
                <Textarea
                  autosize
                  description={t("assistant.listFieldHint")}
                  label={t("assistant.pageNumbersExclude")}
                  minRows={2}
                  {...form.getInputProps("pageNumbersExclude")}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, md: 2 }}>
                <NumberInput
                  label={t("assistant.pageNumbersMin")}
                  min={0}
                  {...form.getInputProps("pageNumbersMin")}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, md: 2 }}>
                <NumberInput
                  label={t("assistant.pageNumbersMax")}
                  min={0}
                  {...form.getInputProps("pageNumbersMax")}
                />
              </Grid.Col>
            </Grid>

            <Text c="dimmed" size="sm">
              {t("common.fields.assistantId")}: <span data-testid="assistant-id">{assistant.id}</span>
            </Text>
            <Text c="dimmed" data-testid="assistant-name-text" size="sm">
              {assistant.name}
            </Text>
            <Text c="dimmed" size="sm">
              {t("common.fields.profileId")}: {retrievalProfile.id}
            </Text>

            <Button
              loading={updateAssistantMutation.isPending || updateRetrievalProfileMutation.isPending}
              type="submit"
            >
              {t("common.actions.saveChanges")}
            </Button>
          </Stack>
        </Card>
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
