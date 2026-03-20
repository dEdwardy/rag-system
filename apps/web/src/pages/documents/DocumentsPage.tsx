import {
  Alert,
  Badge,
  Button,
  Card,
  FileButton,
  Group,
  Stack,
  Table,
  Text,
  Title
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { Link } from "react-router-dom";
import { StatePanel } from "../../components/StatePanel";
import {
  useDocuments,
  useKnowledgeBases,
  useReindexDocument,
  useUploadDocument
} from "../../features/api/hooks";
import { useI18n } from "../../i18n/I18nProvider";

export function DocumentsPage() {
  const knowledgeBasesQuery = useKnowledgeBases();
  const activeKnowledgeBase = knowledgeBasesQuery.data?.[0] ?? null;
  const documentsQuery = useDocuments(activeKnowledgeBase?.id ?? "default-kb");
  const uploadMutation = useUploadDocument(activeKnowledgeBase?.id ?? "default-kb");
  const reindexMutation = useReindexDocument();
  const hasProcessingDocuments = documentsQuery.data?.some(
    document => document.status === "pending" || document.status === "processing"
  );
  const { t } = useI18n();

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <div>
          <Title order={2}>{t("documents.title")}</Title>
          <Text c="dimmed">
            {t("documents.subtitle")}
          </Text>
        </div>
        <FileButton
          onChange={async file => {
            if (!file || !activeKnowledgeBase) {
              return;
            }

            try {
              await uploadMutation.mutateAsync(file);
              notifications.show({
                color: "teal",
                message: t("documents.uploadSuccess", { fileName: file.name })
              });
            } catch (error) {
              notifications.show({
                color: "red",
                message: error instanceof Error ? error.message : t("documents.uploadError")
              });
            }
          }}
        >
          {props => (
            <Button {...props} loading={uploadMutation.isPending}>
              {t("common.actions.uploadDocument")}
            </Button>
          )}
        </FileButton>
      </Group>
      {knowledgeBasesQuery.isError ? (
        <StatePanel
          description={knowledgeBasesQuery.error instanceof Error ? knowledgeBasesQuery.error.message : undefined}
          title={t("documents.loadKbError")}
          tone="error"
        />
      ) : null}
      {documentsQuery.isError ? (
        <StatePanel
          description={documentsQuery.error instanceof Error ? documentsQuery.error.message : undefined}
          title={t("documents.loadDocumentsError")}
          tone="error"
        />
      ) : null}
      {uploadMutation.isError ? (
        <Alert color="red" variant="light">
          {uploadMutation.error instanceof Error ? uploadMutation.error.message : t("documents.uploadError")}
        </Alert>
      ) : null}
      {hasProcessingDocuments ? (
        <Alert color="yellow" variant="light">
          {t("documents.processingBanner")}
        </Alert>
      ) : null}

      <Card withBorder padding="md" radius="lg">
        {documentsQuery.isLoading ? (
          <StatePanel
            description={t("documents.loadingDescription")}
            title={t("documents.loadingTitle")}
            tone="loading"
          />
        ) : documentsQuery.data?.length ? (
          <Table.ScrollContainer minWidth={760}>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t("common.fields.title")}</Table.Th>
                  <Table.Th>{t("common.fields.status")}</Table.Th>
                  <Table.Th>{t("common.fields.stage")}</Table.Th>
                  <Table.Th>{t("common.fields.chunks")}</Table.Th>
                  <Table.Th>{t("common.fields.storage")}</Table.Th>
                  <Table.Th>{t("common.fields.details")}</Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {documentsQuery.data.map(document => (
                  <Table.Tr key={document.id}>
                    <Table.Td>{document.title}</Table.Td>
                    <Table.Td>
                      <Badge color={document.status === "ready" ? "teal" : document.status === "failed" ? "red" : "yellow"} variant="light">
                        {t(`common.status.${document.status}`)}
                      </Badge>
                    </Table.Td>
                    <Table.Td>{t(`common.processingStage.${document.processingStage}`)}</Table.Td>
                    <Table.Td>{document.chunkCount}</Table.Td>
                    <Table.Td>
                      <Text c="dimmed" size="sm">
                        {document.storageKey}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Button component={Link} size="xs" to={`/documents/${document.id}`} variant="light">
                        {t("common.actions.viewDetails")}
                      </Button>
                    </Table.Td>
                    <Table.Td>
                      <Button
                        loading={reindexMutation.isPending}
                        onClick={async () => {
                          try {
                            await reindexMutation.mutateAsync({
                              documentId: document.id,
                              knowledgeBaseId: document.kbId
                            });
                            notifications.show({
                              color: "teal",
                              message: t("documents.reindexRequested", { title: document.title })
                            });
                          } catch (error) {
                            notifications.show({
                              color: "red",
                              message: error instanceof Error ? error.message : t("documents.reindexError")
                            });
                          }
                        }}
                        size="xs"
                        variant="light"
                      >
                        {t("common.actions.reindex")}
                      </Button>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        ) : (
          <StatePanel
            description={t("documents.emptyDescription")}
            title={t("documents.emptyTitle")}
          />
        )}
      </Card>
    </Stack>
  );
}
