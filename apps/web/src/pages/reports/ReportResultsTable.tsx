import { Badge, Button, Select, Table, Text } from "@mantine/core";
import { Link } from "react-router-dom";
import { StatePanel } from "../../components/StatePanel";
import type { EvalQuestionSetRunItem } from "../../types/api";

type ReviewConclusion = "retrieval" | "citation" | "answer" | "skip";

type SortConfig = {
  key: string;
  direction: "ascending" | "descending";
} | null;

type ReviewConclusionPresentation = {
  color: string;
  label: string;
};

type ReviewSignal = {
  color: string;
  detail: string;
  title: string;
};

type ReportResultsTableProps = {
  locale: "zh" | "en";
  sortedAndFilteredItems: EvalQuestionSetRunItem[];
  statusOptions: string[];
  qualityOptions: string[];
  filterStatus: string;
  filterQuality: string;
  filterReviewState: "pending" | "reviewed" | "";
  filterConclusion: ReviewConclusion | "";
  setFilterStatus: (value: string) => void;
  setFilterQuality: (value: string) => void;
  setFilterReviewState: (value: "pending" | "reviewed" | "") => void;
  setFilterConclusion: (value: ReviewConclusion | "") => void;
  hasRunItems: boolean;
  hasRunError: boolean;
  sortConfig: SortConfig;
  requestSort: (key: string) => void;
  getEvalItemKey: (index: number, question: string) => string;
  reviewedItemKeySet: Set<string>;
  reviewConclusions: Record<string, ReviewConclusion | undefined>;
  getReviewConclusionPresentation: (conclusion: ReviewConclusion, locale: "zh" | "en") => ReviewConclusionPresentation;
  getAnswerStatusReviewLabel: (status: string | null, locale: "zh" | "en") => string;
  getQualitySignalColor: (value: string | null) => string;
  getReviewSignal: (item: EvalQuestionSetRunItem, locale: "zh" | "en") => ReviewSignal;
  focusedItemKey: string | null;
  itemRowRefs: React.MutableRefObject<Record<string, HTMLTableRowElement | null>>;
  toggleReviewedItem: (index: number, question: string) => void;
  updateReviewConclusion: (index: number, question: string, conclusion: ReviewConclusion | null) => void;
  buildTraceReviewLink: (args: { traceId: string; question: string; handlingTitle: string; priorityLabel: string }) => string;
};

export function ReportResultsTable(props: ReportResultsTableProps) {
  const {
    locale,
    sortedAndFilteredItems,
    statusOptions,
    qualityOptions,
    filterStatus,
    filterQuality,
    filterReviewState,
    filterConclusion,
    setFilterStatus,
    setFilterQuality,
    setFilterReviewState,
    setFilterConclusion,
    hasRunItems,
    hasRunError,
    sortConfig,
    requestSort,
    getEvalItemKey,
    reviewedItemKeySet,
    reviewConclusions,
    getReviewConclusionPresentation,
    getAnswerStatusReviewLabel,
    getQualitySignalColor,
    getReviewSignal,
    focusedItemKey,
    itemRowRefs,
    toggleReviewedItem,
    updateReviewConclusion,
    buildTraceReviewLink
  } = props;

  if (!hasRunItems) {
    return (
      <StatePanel
        description={
          locale === "zh"
            ? "这次质量检查没有返回可展示题目。请先检查 question-set 输入，再执行一次检查。"
            : "This quality check did not return any displayable items. Verify the question-set input and run it again."
        }
        title={locale === "zh" ? "这次检查还没有题目结果" : "This check has no item results yet"}
        tone="empty"
      />
    );
  }

  return (
    <div className="workspace-table-shell overflow-x-auto">
      <div className="workspace-table-toolbar border-b border-[var(--app-border)] px-4 py-3 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4 w-full sm:w-auto">
          <Text className="workspace-table-hint flex-shrink-0">
            {locale === "zh"
              ? "按题逐行查看状态、质量和主问题；Trace 列保留直接跳转。"
              : "Review each row by status, quality, and primary issue; the trace column keeps a direct jump."}
          </Text>
          <div className="flex flex-wrap items-center gap-3 flex-grow sm:flex-grow-0">
            <Select
              data={statusOptions.map(option => ({ value: option, label: option }))}
              label={locale === "zh" ? "状态筛选" : "Status filter"}
              onChange={value => setFilterStatus(value ?? "")}
              placeholder={locale === "zh" ? "全部状态" : "All statuses"}
              size="xs"
              value={filterStatus || null}
            />
            <Select
              data={qualityOptions.map(option => ({ value: option, label: option }))}
              label={locale === "zh" ? "质量筛选" : "Quality filter"}
              onChange={value => setFilterQuality(value ?? "")}
              placeholder={locale === "zh" ? "全部质量" : "All quality"}
              size="xs"
              value={filterQuality || null}
            />
            <Select
              data={[
                { value: "pending", label: locale === "zh" ? "待复盘" : "Pending review" },
                { value: "reviewed", label: locale === "zh" ? "已复盘" : "Reviewed" }
              ]}
              label={locale === "zh" ? "复盘状态" : "Review state"}
              onChange={value => setFilterReviewState((value as "pending" | "reviewed" | null) ?? "")}
              placeholder={locale === "zh" ? "全部复盘状态" : "All review states"}
              size="xs"
              value={filterReviewState || null}
            />
            <Select
              data={[
                { value: "retrieval", label: locale === "zh" ? "检索问题" : "Retrieval issue" },
                { value: "citation", label: locale === "zh" ? "引用问题" : "Citation issue" },
                { value: "answer", label: locale === "zh" ? "回答问题" : "Answer issue" },
                { value: "skip", label: locale === "zh" ? "暂不处理" : "Skip for now" }
              ]}
              label={locale === "zh" ? "处理结论" : "Conclusion"}
              onChange={value => setFilterConclusion((value as ReviewConclusion | null) ?? "")}
              placeholder={locale === "zh" ? "全部结论" : "All conclusions"}
              size="xs"
              value={filterConclusion || null}
            />
          </div>
        </div>
        <Badge color={hasRunError ? "red" : "indigo"} radius="sm" variant="light">
          {locale === "zh" ? `${sortedAndFilteredItems.length} 条结果` : `${sortedAndFilteredItems.length} results`}
        </Badge>
      </div>

      <Table.ScrollContainer minWidth={1040}>
        <Table
          className="workspace-table"
          highlightOnHover
          striped="odd"
          styles={{
            table: {
              color: "var(--app-text)"
            },
            thead: {
              background: "rgba(255,255,255,0.03)"
            },
            tr: {
              borderColor: "var(--app-border)"
            },
            th: {
              color: "var(--app-text-secondary)",
              fontWeight: 700,
              textTransform: "uppercase",
              fontSize: 12,
              letterSpacing: "0.04em",
              cursor: "pointer"
            },
            td: {
              color: "var(--app-text)"
            }
          }}
        >
          <Table.Thead>
            <Table.Tr>
              <Table.Th onClick={() => requestSort("index")}># {sortConfig?.key === "index" && (sortConfig.direction === "ascending" ? "↑" : "↓")}</Table.Th>
              <Table.Th onClick={() => requestSort("status")}>{locale === "zh" ? "状态" : "Status"} {sortConfig?.key === "status" && (sortConfig.direction === "ascending" ? "↑" : "↓")}</Table.Th>
              <Table.Th onClick={() => requestSort("question")}>{locale === "zh" ? "问题" : "Question"} {sortConfig?.key === "question" && (sortConfig.direction === "ascending" ? "↑" : "↓")}</Table.Th>
              <Table.Th onClick={() => requestSort("answerStatus")}>{locale === "zh" ? "答案状态" : "Answer status"} {sortConfig?.key === "answerStatus" && (sortConfig.direction === "ascending" ? "↑" : "↓")}</Table.Th>
              <Table.Th onClick={() => requestSort("qualityOverall")}>{locale === "zh" ? "质量" : "Quality"} {sortConfig?.key === "qualityOverall" && (sortConfig.direction === "ascending" ? "↑" : "↓")}</Table.Th>
              <Table.Th onClick={() => requestSort("qualityPrimaryIssue")}>{locale === "zh" ? "主问题" : "Primary issue"} {sortConfig?.key === "qualityPrimaryIssue" && (sortConfig.direction === "ascending" ? "↑" : "↓")}</Table.Th>
              <Table.Th onClick={() => requestSort("citationCount")}>{locale === "zh" ? "引用数" : "Citations"} {sortConfig?.key === "citationCount" && (sortConfig.direction === "ascending" ? "↑" : "↓")}</Table.Th>
              <Table.Th onClick={() => requestSort("usedFallback")}>{locale === "zh" ? "Fallback" : "Fallback"} {sortConfig?.key === "usedFallback" && (sortConfig.direction === "ascending" ? "↑" : "↓")}</Table.Th>
              <Table.Th>{locale === "zh" ? "诊断 / 问题" : "Diagnostics / issue"}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {sortedAndFilteredItems.map(item => {
              const itemKey = getEvalItemKey(item.index, item.question);
              const isReviewed = reviewedItemKeySet.has(itemKey);
              const reviewConclusion = reviewConclusions[itemKey] ?? null;
              const reviewConclusionPresentation = reviewConclusion ? getReviewConclusionPresentation(reviewConclusion, locale) : null;
              const reviewSignal = getReviewSignal(item, locale);

              return (
                <Table.Tr
                  key={itemKey}
                  ref={node => {
                    itemRowRefs.current[itemKey] = node;
                  }}
                  style={
                    focusedItemKey === itemKey
                      ? {
                          background: "rgba(99, 102, 241, 0.14)",
                          boxShadow: "inset 0 0 0 1px rgba(129, 140, 248, 0.4)"
                        }
                      : undefined
                  }
                >
                  <Table.Td>
                    <Text className="workspace-table-number" fw={600} size="sm">
                      {item.index}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <div className="workspace-table-badge-stack">
                      <Badge color={item.status === "succeeded" ? "indigo" : "red"} radius="sm" variant="light">
                        {item.status}
                      </Badge>
                      {item.error?.code ? <Text className="workspace-table-cell-meta">{item.error.code}</Text> : null}
                    </div>
                  </Table.Td>
                  <Table.Td>
                    <Text className="workspace-table-cell-title-main" lineClamp={3} size="sm">
                      {item.question}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <div className="workspace-table-badge-stack">
                      <Badge color={item.answerStatus === "grounded" ? "teal" : item.answerStatus === "insufficient_context" ? "yellow" : "gray"} radius="sm" variant="light">
                        {getAnswerStatusReviewLabel(item.answerStatus, locale)}
                      </Badge>
                    </div>
                  </Table.Td>
                  <Table.Td>
                    <div className="workspace-table-badge-stack">
                      <Badge color={getQualitySignalColor(item.qualityOverall)} radius="sm" variant="light">
                        {item.qualityOverall ?? "-"}
                      </Badge>
                    </div>
                  </Table.Td>
                  <Table.Td>
                    <div className="flex flex-col gap-1">
                      <Badge color={reviewSignal.color} radius="sm" variant="light" w="fit-content">
                        {reviewSignal.title}
                      </Badge>
                      <Text className="workspace-table-cell-copy" lineClamp={2}>{reviewSignal.detail}</Text>
                    </div>
                  </Table.Td>
                  <Table.Td>
                    <div className="flex flex-col gap-1">
                      <Text className="workspace-table-number" fw={600} size="sm">{item.citationCount}</Text>
                      <Text className="workspace-table-cell-meta">
                        {item.citationCount === 0
                          ? locale === "zh"
                            ? "无引用"
                            : "none"
                          : item.citationCount === 1
                            ? locale === "zh"
                              ? "单条引用"
                              : "single"
                            : locale === "zh"
                              ? "多条引用"
                              : "multiple"}
                      </Text>
                    </div>
                  </Table.Td>
                  <Table.Td>
                    <Badge color={item.usedFallback == null ? "gray" : item.usedFallback ? "orange" : "teal"} radius="sm" variant="light">
                      {item.usedFallback == null ? "-" : item.usedFallback ? (locale === "zh" ? "已触发" : "triggered") : locale === "zh" ? "未触发" : "not used"}
                    </Badge>
                  </Table.Td>
                  <Table.Td className="workspace-table-action">
                    <div className="flex flex-col gap-1">
                      {focusedItemKey === itemKey ? <Badge color="indigo" radius="sm" variant="light">{locale === "zh" ? "当前复盘焦点" : "Current review focus"}</Badge> : null}
                      <Badge color={isReviewed ? "teal" : "gray"} radius="sm" variant="light">
                        {isReviewed ? (locale === "zh" ? "已复盘" : "Reviewed") : locale === "zh" ? "待复盘" : "Pending review"}
                      </Badge>
                      {reviewConclusionPresentation ? <Badge color={reviewConclusionPresentation.color} radius="sm" variant="light">{reviewConclusionPresentation.label}</Badge> : null}
                      <Button className="workspace-button" color={isReviewed ? "gray" : "teal"} onClick={() => toggleReviewedItem(item.index, item.question)} radius="xl" size="xs" variant={isReviewed ? "subtle" : "light"}>
                        {isReviewed ? (locale === "zh" ? "取消已复盘" : "Mark as pending") : locale === "zh" ? "标记已复盘" : "Mark reviewed"}
                      </Button>
                      <Select
                        allowDeselect
                        data={[
                          { value: "retrieval", label: locale === "zh" ? "检索问题" : "Retrieval issue" },
                          { value: "citation", label: locale === "zh" ? "引用问题" : "Citation issue" },
                          { value: "answer", label: locale === "zh" ? "回答问题" : "Answer issue" },
                          { value: "skip", label: locale === "zh" ? "暂不处理" : "Skip for now" }
                        ]}
                        onChange={value => updateReviewConclusion(item.index, item.question, (value as ReviewConclusion | null) ?? null)}
                        placeholder={locale === "zh" ? "写处理结论" : "Set conclusion"}
                        radius="xl"
                        size="xs"
                        value={reviewConclusion}
                      />
                      {item.traceId ? (
                        <Button
                          className="workspace-button"
                          color="indigo"
                          component={Link}
                          radius="xl"
                          size="xs"
                          to={buildTraceReviewLink({
                            traceId: item.traceId,
                            question: item.question,
                            handlingTitle: reviewSignal.title,
                            priorityLabel: locale === "zh" ? `结果行 #${item.index}` : `Result row #${item.index}`
                          })}
                          variant="light"
                        >
                          {locale === "zh" ? "打开诊断" : "Open diagnostics"}
                        </Button>
                      ) : <Text c="var(--app-text-muted)" size="xs">-</Text>}
                      {item.traceId ? <Text className="workspace-table-cell-meta">{item.traceId}</Text> : null}
                      {item.error?.message ? <Text className="workspace-table-cell-copy" lineClamp={3} size="xs">{item.error.message}</Text> : null}
                    </div>
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </div>
  );
}
