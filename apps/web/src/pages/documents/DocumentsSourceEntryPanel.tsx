import { Alert, Badge, Button, Group, Paper, Stack, Text, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { StatePanel } from "../../components/StatePanel";
import {
  useCreateFeedDocument,
  useCreateSitemapDocument,
  useCreateWebPageDocument
} from "../../features/api/hooks";
import { useI18n } from "../../i18n/I18nProvider";
import { validateSourceEntryUrl as validateSourceEntryUrlHelper } from "./documents-page-helpers";

type SourceEntryKind = "webPage" | "feed" | "sitemap";

type DocumentsSourceEntryPanelProps = {
  activeKnowledgeBaseId: string | null;
  activeKnowledgeBaseName: string | null;
};

export function DocumentsSourceEntryPanel({ activeKnowledgeBaseId, activeKnowledgeBaseName }: DocumentsSourceEntryPanelProps) {
  const { locale, t } = useI18n();
  const [webPageUrl, setWebPageUrl] = useState("");
  const [feedUrl, setFeedUrl] = useState("");
  const [sitemapUrl, setSitemapUrl] = useState("");
  const [webPageInlineError, setWebPageInlineError] = useState<string | null>(null);
  const [feedInlineError, setFeedInlineError] = useState<string | null>(null);
  const [sitemapInlineError, setSitemapInlineError] = useState<string | null>(null);
  const [lastSubmittedSourceUrl, setLastSubmittedSourceUrl] = useState<Record<SourceEntryKind, string | null>>({
    webPage: null,
    feed: null,
    sitemap: null
  });
  const createWebPageMutation = useCreateWebPageDocument(activeKnowledgeBaseId ?? "");
  const createFeedMutation = useCreateFeedDocument(activeKnowledgeBaseId ?? "");
  const createSitemapMutation = useCreateSitemapDocument(activeKnowledgeBaseId ?? "");
  const hasActiveKnowledgeBase = activeKnowledgeBaseId != null;
  const isAnySourceSubmissionPending =
    createWebPageMutation.isPending || createFeedMutation.isPending || createSitemapMutation.isPending;

  const resolveSourceEntryStatus = useCallback(
    (sourceKind: SourceEntryKind, urlValue: string, inlineError: string | null) => {
      if (!hasActiveKnowledgeBase) {
        return {
          message: t("documents.sourceEntryStatusNoActiveKnowledgeBase"),
          tone: "dimmed"
        } as const;
      }

      if (inlineError) {
        return {
          message: inlineError,
          tone: "red"
        } as const;
      }

      if (isAnySourceSubmissionPending) {
        return {
          message: t("documents.sourceEntryStatusSubmitting"),
          tone: "indigo"
        } as const;
      }

      const lastSubmittedUrl = lastSubmittedSourceUrl[sourceKind];
      if (lastSubmittedUrl && urlValue.trim().length === 0) {
        return {
          message: t("documents.sourceEntryStatusSuccess", { url: lastSubmittedUrl }),
          tone: "teal"
        } as const;
      }

      if (urlValue.trim().length === 0) {
        return {
          message: t("documents.sourceEntryStatusEmpty"),
          tone: "dimmed"
        } as const;
      }

      return {
        message: t("documents.sourceEntryStatusReady"),
        tone: "dimmed"
      } as const;
    },
    [hasActiveKnowledgeBase, isAnySourceSubmissionPending, lastSubmittedSourceUrl, t]
  );

  const validateSourceEntryUrl = useCallback((rawValue: string) => validateSourceEntryUrlHelper(rawValue, t), [t]);

  const submitSourceEntry = useCallback(
    async (
      sourceKind: SourceEntryKind,
      urlValue: string,
      setUrlValue: (nextValue: string) => void,
      setInlineError: (nextValue: string | null) => void,
      mutateAsync: (payload: { url: string }) => Promise<unknown>,
      submitMessages: {
        error: string;
        success: (url: string) => string;
      }
    ) => {
      if (!activeKnowledgeBaseId) {
        return;
      }

      const { normalizedUrl, error } = validateSourceEntryUrl(urlValue);
      if (error) {
        setInlineError(error);
        return;
      }

      setInlineError(null);
      try {
        await mutateAsync({ url: normalizedUrl });
        setUrlValue("");
        setLastSubmittedSourceUrl(current => ({ ...current, [sourceKind]: normalizedUrl }));
        notifications.show({
          color: "indigo",
          message: submitMessages.success(normalizedUrl)
        });
      } catch (error) {
        setInlineError(error instanceof Error ? error.message : submitMessages.error);
        notifications.show({
          color: "red",
          message: error instanceof Error ? error.message : submitMessages.error
        });
      }
    },
    [activeKnowledgeBaseId, validateSourceEntryUrl]
  );

  const handleCreateWebPage = useCallback(async () => {
    await submitSourceEntry("webPage", webPageUrl, setWebPageUrl, setWebPageInlineError, createWebPageMutation.mutateAsync, {
      error: t("documents.webPage.submitError"),
      success: url => t("documents.webPage.submitSuccess", { url })
    });
  }, [createWebPageMutation.mutateAsync, submitSourceEntry, t, webPageUrl]);

  const handleCreateFeed = useCallback(async () => {
    await submitSourceEntry("feed", feedUrl, setFeedUrl, setFeedInlineError, createFeedMutation.mutateAsync, {
      error: t("documents.feed.submitError"),
      success: url => t("documents.feed.submitSuccess", { url })
    });
  }, [createFeedMutation.mutateAsync, feedUrl, submitSourceEntry, t]);

  const handleCreateSitemap = useCallback(async () => {
    await submitSourceEntry("sitemap", sitemapUrl, setSitemapUrl, setSitemapInlineError, createSitemapMutation.mutateAsync, {
      error: t("documents.sitemap.submitError"),
      success: url => t("documents.sitemap.submitSuccess", { url })
    });
  }, [createSitemapMutation.mutateAsync, sitemapUrl, submitSourceEntry, t]);

  const sourceEntrySections = useMemo(
    () => [
      {
        key: "webPage" as const,
        description: t("documents.webPage.sectionDescription"),
        inlineError: webPageInlineError,
        inputPlaceholder: t("documents.webPage.inputPlaceholder"),
        isSubmitting: createWebPageMutation.isPending,
        onChange: (nextValue: string) => {
          setWebPageUrl(nextValue);
          setLastSubmittedSourceUrl(current => ({ ...current, webPage: null }));
          if (webPageInlineError) {
            setWebPageInlineError(null);
          }
        },
        onSubmit: handleCreateWebPage,
        status: resolveSourceEntryStatus("webPage", webPageUrl, webPageInlineError),
        submitAction: t("documents.webPage.submitAction"),
        title: t("documents.webPage.sectionTitle"),
        value: webPageUrl
      },
      {
        key: "feed" as const,
        description: t("documents.feed.sectionDescription"),
        inlineError: feedInlineError,
        inputPlaceholder: t("documents.feed.inputPlaceholder"),
        isSubmitting: createFeedMutation.isPending,
        onChange: (nextValue: string) => {
          setFeedUrl(nextValue);
          setLastSubmittedSourceUrl(current => ({ ...current, feed: null }));
          if (feedInlineError) {
            setFeedInlineError(null);
          }
        },
        onSubmit: handleCreateFeed,
        status: resolveSourceEntryStatus("feed", feedUrl, feedInlineError),
        submitAction: t("documents.feed.submitAction"),
        title: t("documents.feed.sectionTitle"),
        value: feedUrl
      },
      {
        key: "sitemap" as const,
        description: t("documents.sitemap.sectionDescription"),
        inlineError: sitemapInlineError,
        inputPlaceholder: t("documents.sitemap.inputPlaceholder"),
        isSubmitting: createSitemapMutation.isPending,
        onChange: (nextValue: string) => {
          setSitemapUrl(nextValue);
          setLastSubmittedSourceUrl(current => ({ ...current, sitemap: null }));
          if (sitemapInlineError) {
            setSitemapInlineError(null);
          }
        },
        onSubmit: handleCreateSitemap,
        status: resolveSourceEntryStatus("sitemap", sitemapUrl, sitemapInlineError),
        submitAction: t("documents.sitemap.submitAction"),
        title: t("documents.sitemap.sectionTitle"),
        value: sitemapUrl
      }
    ],
    [
      createFeedMutation.isPending,
      createSitemapMutation.isPending,
      createWebPageMutation.isPending,
      feedInlineError,
      feedUrl,
      handleCreateFeed,
      handleCreateSitemap,
      handleCreateWebPage,
      resolveSourceEntryStatus,
      sitemapInlineError,
      sitemapUrl,
      t,
      webPageInlineError,
      webPageUrl
    ]
  );

  return (
    <Paper className="workspace-panel-hover workspace-panel-muted" p="lg" radius="xl">
      <Stack gap="md">
        <Group justify="space-between" wrap="wrap">
          <div>
            <Text className="workspace-section-heading">{t("documents.sourceEntryHeading")}</Text>
            <Text className="workspace-section-copy">{t("documents.sourceEntryScanPath")}</Text>
          </div>
          <Badge color="gray" radius="sm" variant="light">
            {activeKnowledgeBaseName ?? (locale === "zh" ? "尚无活动资料空间" : "No active library")}
          </Badge>
        </Group>

        {isAnySourceSubmissionPending ? (
          <Alert color="indigo" radius="xl" variant="light">
            {t("documents.sourceEntrySubmittingHint")}
          </Alert>
        ) : null}

        {hasActiveKnowledgeBase ? (
          <div className="grid gap-4 xl:grid-cols-3">
            {sourceEntrySections.map(section => (
              <Paper className="workspace-subpanel" key={section.key} p="md" radius="lg">
                <Stack gap="xs">
                  <Text c="var(--app-text-secondary)" fw={600} size="sm">
                    {section.title}
                  </Text>
                  <Text c="var(--app-text-muted)" size="sm">
                    {section.description}
                  </Text>
                  <TextInput
                    disabled={isAnySourceSubmissionPending}
                    error={section.inlineError != null}
                    onChange={event => {
                      section.onChange(event.currentTarget.value);
                    }}
                    placeholder={section.inputPlaceholder}
                    radius="xl"
                    type="url"
                    value={section.value}
                  />
                  <Text aria-live="polite" c={section.status.tone} size="xs">
                    {section.status.message}
                  </Text>
                  <Button
                    className="workspace-button"
                    color="indigo"
                    disabled={!hasActiveKnowledgeBase || section.value.trim().length === 0 || isAnySourceSubmissionPending}
                    loading={section.isSubmitting}
                    onClick={section.onSubmit}
                    radius="xl"
                    variant="light"
                  >
                    {section.submitAction}
                  </Button>
                </Stack>
              </Paper>
            ))}
          </div>
        ) : (
          <StatePanel
            action={
              <Button className="workspace-button" color="indigo" component={Link} radius="xl" to="/knowledge-base" variant="light">
                {t("documents.noActiveKnowledgeBaseAction")}
              </Button>
            }
            description={t("documents.sourceEntryNoActiveKnowledgeBaseDescription")}
            title={t("documents.sourceEntryNoActiveKnowledgeBaseTitle")}
          />
        )}
      </Stack>
    </Paper>
  );
}
