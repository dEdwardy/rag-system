import {
  Alert,
  Badge,
  Button,
  Card,
  Divider,
  Grid,
  Group,
  NumberInput,
  Stack,
  Switch,
  Text,
  TextInput,
  Textarea,
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

  const form = useForm({
    initialValues: {
      name: assistant?.name ?? "",
      description: assistant?.description ?? "",
      systemPrompt: assistant?.systemPrompt ?? "",
      status: assistant?.status ?? "active",
      topK: retrievalProfile?.topK ?? 3,
      chunkWindow: retrievalProfile?.chunkWindow ?? 0,
      enableHybrid: retrievalProfile?.enableHybrid ?? false,
      enableRerank: retrievalProfile?.enableRerank ?? false,
      scoreThreshold: retrievalProfile?.scoreThreshold ?? 0
    },
    mode: "controlled"
  });

  useEffect(() => {
    form.setValues({
      name: assistant?.name ?? "",
      description: assistant?.description ?? "",
      systemPrompt: assistant?.systemPrompt ?? "",
      status: assistant?.status ?? "active",
      topK: retrievalProfile?.topK ?? 3,
      chunkWindow: retrievalProfile?.chunkWindow ?? 0,
      enableHybrid: retrievalProfile?.enableHybrid ?? false,
      enableRerank: retrievalProfile?.enableRerank ?? false,
      scoreThreshold: retrievalProfile?.scoreThreshold ?? 0
    });
  }, [
    assistant?.description,
    assistant?.name,
    assistant?.status,
    assistant?.systemPrompt,
    retrievalProfile?.chunkWindow,
    retrievalProfile?.enableHybrid,
    retrievalProfile?.enableRerank,
    retrievalProfile?.scoreThreshold,
    retrievalProfile?.topK
  ]);

  return (
    <Stack gap="lg">
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
              await updateAssistantMutation.mutateAsync({
                name: values.name,
                description: values.description.trim() ? values.description : null,
                status: values.status,
                systemPrompt: values.systemPrompt
              });

              await updateRetrievalProfileMutation.mutateAsync({
                chunkWindow: values.chunkWindow,
                enableHybrid: values.enableHybrid,
                enableRerank: values.enableRerank,
                topK: values.topK,
                scoreThreshold: values.scoreThreshold
              });

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
              <Text c="dimmed" size="sm">
                {t("common.fields.retrievalProfile")}: {retrievalProfile.name}
              </Text>
            </Group>

            <Grid gutter="md">
              <Grid.Col span={{ base: 12, md: 8 }}>
                <TextInput
                  label={t("assistant.assistantName")}
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

            <Text c="dimmed" size="sm">
              {t("common.fields.assistantId")}: {assistant.id}
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
