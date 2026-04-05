import { Anchor, Badge, Group, Paper, Stack, Text, Alert } from "@mantine/core";
import { Link } from "react-router-dom";
import { StatePanel } from "../../components/StatePanel";
import type { SupportedLocale } from "../../i18n/messages";
import type { Citation, TraceRecord } from "../../types/api";
import { buildDocumentChunkLink, buildRawPayload } from "./trace-detail-page-helpers";

type TraceDetailSectionIds = {
  retrievedChunks: string;
  citations: string;
  rawPayload: string;
  requestResponse: string;
};

type TranslationFn = (key: string, values?: Record<string, string | number>) => string;

type TraceDetailSidebarPanelsProps = {
  formatDateTime: (value: string) => string;
  hasRewrite: boolean;
  locale: SupportedLocale;
  sectionIds: TraceDetailSectionIds;
  t: TranslationFn;
  trace: TraceRecord;
};

type TraceDetailSecondaryPanelsProps = {
  citations: Citation[];
  locale: SupportedLocale;
  sectionIds: TraceDetailSectionIds;
  t: TranslationFn;
  trace: TraceRecord;
};

function formatJson(value: unknown) {
  if (value == null) {
    return "null";
  }

  return JSON.stringify(value, null, 2);
}

export function TraceDetailSidebarPanels({ formatDateTime, hasRewrite, locale, sectionIds, t, trace }: TraceDetailSidebarPanelsProps) {
  return (
    <div className="workspace-page-side-stack">
      <div className="workspace-sticky-panel">
        <Stack gap="md">
          <Paper className="workspace-panel-hover workspace-panel-strong" p="lg" radius="xl">
            <Stack gap="md">
              <Text className="workspace-section-heading">{locale === "zh" ? "诊断元数据" : "Diagnostic metadata"}</Text>
              <div className="workspace-metadata-grid">
                <div className="workspace-metadata-item">
                  <div className="workspace-metadata-label">{t("common.fields.created")}</div>
                  <div className="workspace-metadata-value">{formatDateTime(trace.createdAt)}</div>
                </div>
                <div className="workspace-metadata-item">
                  <div className="workspace-metadata-label">{t("common.fields.conversation")}</div>
                  <div className="workspace-metadata-value workspace-metadata-value-code">{trace.conversationId}</div>
                </div>
                <div className="workspace-metadata-item">
                  <div className="workspace-metadata-label">{t("common.fields.assistant")}</div>
                  <div className="workspace-metadata-value workspace-metadata-value-code">{trace.assistantId}</div>
                </div>
                <div className="workspace-metadata-item">
                  <div className="workspace-metadata-label">{t("common.fields.latency")}</div>
                  <div className="workspace-metadata-value">{trace.latencyMs ?? "-"} ms</div>
                </div>
                <div className="workspace-metadata-item">
                  <div className="workspace-metadata-label">{t("common.fields.model")}</div>
                  <div className="workspace-metadata-value">{trace.modelName ?? "-"}</div>
                </div>
              </div>
              {trace.errorMessage ? (
                <Alert color="red" radius="xl" variant="light">
                  <Text size="sm" c="var(--app-text-danger)">
                    {locale === "zh" ? "错误信息" : "Error message"}
                  </Text>
                  <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
                    {trace.errorMessage}
                  </Text>
                </Alert>
              ) : null}
            </Stack>
          </Paper>

          <Paper className="workspace-panel-hover workspace-panel-muted" p="lg" radius="xl">
            <Stack gap="sm">
              <Text className="workspace-section-heading">{locale === "zh" ? "页内快速跳转" : "In-page quick jumps"}</Text>
              <Text className="workspace-section-copy">
                {locale === "zh"
                  ? "优先跳到 chunk、引用或原始载荷区，不必反复滚动。"
                  : "Jump directly to chunks, citations, or raw payload without rescanning the whole diagnostics page."}
              </Text>
              <Stack gap={6}>
                <Anchor href={`#${sectionIds.retrievedChunks}`} size="sm">
                  {locale === "zh" ? "查看命中 Chunk" : "Go to retrieved chunks"}
                </Anchor>
                <Anchor href={`#${sectionIds.requestResponse}`} size="sm">
                  {locale === "zh" ? "查看请求与响应" : "Go to request and response"}
                </Anchor>
                <Anchor href={`#${sectionIds.citations}`} size="sm">
                  {locale === "zh" ? "查看引用" : "Go to citations"}
                </Anchor>
                <Anchor href={`#${sectionIds.rawPayload}`} size="sm">
                  {locale === "zh" ? "查看原始载荷" : "Go to raw payload"}
                </Anchor>
              </Stack>
            </Stack>
          </Paper>

          <Paper className="workspace-panel-hover workspace-panel-muted" p="lg" radius="xl">
            <Stack gap="md">
              <Group justify="space-between">
                <Text className="workspace-section-heading">{t("trace.queryComparison")}</Text>
                <Badge color={hasRewrite ? "blue" : "gray"} variant="light">
                  {hasRewrite ? t("trace.rewriteApplied") : t("trace.rewriteNotApplied")}
                </Badge>
              </Group>
              <Text className="workspace-section-copy">{t("trace.queryComparisonDescription")}</Text>
              <Stack gap="sm">
                <div className="workspace-content-block">
                  <Stack gap={6}>
                    <Text c="var(--app-text-muted)" size="xs">
                      {t("common.fields.userQuery")}
                    </Text>
                    <Text c="var(--app-text)" size="sm" style={{ whiteSpace: "pre-wrap" }}>
                      {trace.userQuery}
                    </Text>
                  </Stack>
                </div>
                <div className="workspace-content-block">
                  <Stack gap={6}>
                    <Text c="var(--app-text-muted)" size="xs">
                      {t("common.fields.rewrittenQuery")}
                    </Text>
                    <Text c="var(--app-text)" size="sm" style={{ whiteSpace: "pre-wrap" }}>
                      {trace.rewrittenQuery ?? t("trace.rewriteSameAsOriginal")}
                    </Text>
                  </Stack>
                </div>
              </Stack>
            </Stack>
          </Paper>
        </Stack>
      </div>
    </div>
  );
}

export function TraceDetailSecondaryPanels({ citations, locale, sectionIds, t, trace }: TraceDetailSecondaryPanelsProps) {
  return (
    <div className="workspace-detail-secondary-grid">
      <Paper
        className="workspace-panel-hover workspace-panel-muted"
        id={sectionIds.citations}
        p="lg"
        radius="xl"
        style={{ scrollMarginTop: "96px" }}
      >
        <Stack gap="md">
          <Group justify="space-between">
            <Text className="workspace-section-heading">{t("trace.citations")}</Text>
            <Badge variant="light">{citations.length}</Badge>
          </Group>

          {citations.length > 0 ? (
            <div className="workspace-collection-grid">
              {citations.map(citation => (
                <Paper
                  className="workspace-citation-card"
                  key={citation.chunkId}
                  p="md"
                  radius="lg"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                >
                  <Stack gap="xs">
                    <Group justify="space-between" align="flex-start">
                      <Anchor
                        component={Link}
                        fw={600}
                        to={buildDocumentChunkLink(citation.documentId, citation.chunkId, {
                          traceId: trace.id,
                          isCited: true
                        })}
                      >
                        <Text c="var(--app-text)" fw={600} span>
                          {citation.documentTitle}
                        </Text>
                      </Anchor>
                      <span className="workspace-inline-chip">{citation.chunkId}</span>
                    </Group>
                    <Text c="var(--app-text-muted)" size="sm">
                      {citation.sectionTitle ?? t("common.misc.noSection")}
                      {citation.pageNo != null ? ` / ${t("common.misc.pageLong", { pageNo: citation.pageNo })}` : ""}
                    </Text>
                    <div className="workspace-content-block">
                      <Text c="var(--app-text-secondary)" size="sm" style={{ whiteSpace: "pre-wrap" }}>
                        {citation.snippet}
                      </Text>
                    </div>
                  </Stack>
                </Paper>
              ))}
            </div>
          ) : (
            <StatePanel description={t("trace.noCitations")} title={t("trace.citations")} />
          )}
        </Stack>
      </Paper>

      <Paper className="workspace-panel-hover workspace-panel-muted" p="lg" radius="xl">
        <details id={sectionIds.rawPayload} style={{ scrollMarginTop: "96px" }} open={false}>
          <summary className="workspace-collapsible-summary">
            <span>{t("common.fields.rawPayload")}</span>
            <span className="workspace-inline-chip workspace-inline-chip-secondary">
              {locale === "zh" ? "仅开发调试使用" : "For development only"}
            </span>
          </summary>
          <Text c="var(--app-text-muted)" mt="sm" size="sm">
            {locale === "zh" ? "原始 trace 数据，仅在需要深度调试时查看。" : "Raw trace payload, only for deep debugging purposes."}
          </Text>
          <pre className="workspace-code-block workspace-code-block-scroll" style={{ marginTop: "0.9rem" }}>
            {formatJson(buildRawPayload(trace))}
          </pre>
        </details>
      </Paper>
    </div>
  );
}
