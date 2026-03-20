import { Card, Grid, Loader, Stack, Text, Title } from "@mantine/core";
import { useDocuments, useKnowledgeBases } from "../../features/api/hooks";
import { useI18n } from "../../i18n/I18nProvider";

export function KnowledgeBasePage() {
  const knowledgeBasesQuery = useKnowledgeBases();
  const knowledgeBase = knowledgeBasesQuery.data?.[0] ?? null;
  const documentsQuery = useDocuments(knowledgeBase?.id ?? "default-kb");
  const chunkCount = documentsQuery.data?.reduce((sum, document) => sum + document.chunkCount, 0) ?? 0;
  const { t } = useI18n();

  return (
    <Stack gap="lg">
      <div>
        <Title order={2}>{t("knowledgeBase.title")}</Title>
        <Text c="dimmed">{t("knowledgeBase.subtitle")}</Text>
      </div>

      {knowledgeBasesQuery.isLoading ? <Loader size="sm" /> : null}

      {knowledgeBase ? (
        <Grid gutter="lg">
          <Grid.Col span={{ base: 12, md: 6 }}>
            <Card withBorder padding="lg" radius="lg">
              <Stack gap="xs">
                <Text c="dimmed" size="sm">
                  {t("common.fields.name")}
                </Text>
                <Text fw={700}>{knowledgeBase.name}</Text>
                <Text c="dimmed" size="sm">
                  {t("common.fields.description")}
                </Text>
                <Text>{knowledgeBase.description ?? t("common.noDescription")}</Text>
              </Stack>
            </Card>
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 3 }}>
            <Card withBorder padding="lg" radius="lg">
              <Text c="dimmed" size="sm">
                {t("common.fields.documents")}
              </Text>
              <Title order={3}>{documentsQuery.data?.length ?? 0}</Title>
            </Card>
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 3 }}>
            <Card withBorder padding="lg" radius="lg">
              <Text c="dimmed" size="sm">
                {t("common.fields.chunks")}
              </Text>
              <Title order={3}>{chunkCount}</Title>
            </Card>
          </Grid.Col>
        </Grid>
      ) : null}
    </Stack>
  );
}
