import { Badge, Button, Select, Table, Text } from '@mantine/core';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { StatePanel } from '../../components/StatePanel';
import { useI18n } from '../../i18n/I18nProvider';
import { ReportRouteViewShortcuts } from './ReportRouteViewShortcuts';
import type { EvalQuestionSetRunItem } from '../../types/api';

type ReviewConclusion = 'retrieval' | 'citation' | 'answer' | 'skip';

type SortConfig = {
  key: string;
  direction: 'ascending' | 'descending';
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
  locale: 'zh' | 'en';
  sortedAndFilteredItems: EvalQuestionSetRunItem[];
  statusOptions: string[];
  qualityOptions: string[];
  filterStatus: string;
  filterQuality: string;
  filterReviewState: 'pending' | 'reviewed' | '';
  filterConclusion: ReviewConclusion | '';
  setFilterStatus: (value: string) => void;
  setFilterQuality: (value: string) => void;
  setFilterReviewState: (value: 'pending' | 'reviewed' | '') => void;
  setFilterConclusion: (value: ReviewConclusion | '') => void;
  hasRunItems: boolean;
  hasRunError: boolean;
  sortConfig: SortConfig;
  requestSort: (key: string) => void;
  getEvalItemKey: (index: number, question: string) => string;
  reviewedItemKeySet: Set<string>;
  reviewConclusions: Record<string, ReviewConclusion | undefined>;
  getReviewConclusionPresentation: (
    conclusion: ReviewConclusion,
    locale: 'zh' | 'en'
  ) => ReviewConclusionPresentation;
  getAnswerStatusReviewLabel: (
    status: string | null,
    locale: 'zh' | 'en'
  ) => string;
  getQualitySignalColor: (value: string | null) => string;
  getReviewSignal: (
    item: EvalQuestionSetRunItem,
    locale: 'zh' | 'en'
  ) => ReviewSignal;
  focusedItemKey: string | null;
  itemRowRefs: React.MutableRefObject<
    Record<string, HTMLTableRowElement | null>
  >;
  toggleReviewedItem: (index: number, question: string) => void;
  updateReviewConclusion: (
    index: number,
    question: string,
    conclusion: ReviewConclusion | null
  ) => void;
  buildTraceReviewLink: (args: {
    traceId: string;
    question: string;
    handlingTitle: string;
    priorityLabel: string;
  }) => string;
};

const REPORT_RESULTS_PAGE_SIZE = 25;

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
  const { t } = useI18n();
  const [page, setPage] = useState(1);
  const totalPages = Math.max(
    1,
    Math.ceil(sortedAndFilteredItems.length / REPORT_RESULTS_PAGE_SIZE)
  );
  const resolvedPage = Math.min(page, totalPages);
  const pageStart = (resolvedPage - 1) * REPORT_RESULTS_PAGE_SIZE;
  const pagedItems = useMemo(
    () =>
      sortedAndFilteredItems.slice(
        pageStart,
        pageStart + REPORT_RESULTS_PAGE_SIZE
      ),
    [pageStart, sortedAndFilteredItems]
  );
  const visibleStart = sortedAndFilteredItems.length === 0 ? 0 : pageStart + 1;
  const visibleEnd = Math.min(
    pageStart + pagedItems.length,
    sortedAndFilteredItems.length
  );
  const paginationSummary = t('reportResultsTable.paginationSummary')
    .replace('{visibleStart}', String(visibleStart))
    .replace('{visibleEnd}', String(visibleEnd))
    .replace('{total}', String(sortedAndFilteredItems.length));

  useEffect(() => {
    setPage(1);
  }, [
    filterStatus,
    filterQuality,
    filterReviewState,
    filterConclusion,
    sortConfig
  ]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  if (!hasRunItems) {
    return (
      <StatePanel
        description={t('reportResultsTable.emptyDescription')}
        title={t('reportResultsTable.emptyTitle')}
        tone="empty"
      />
    );
  }

  return (
    <div className="workspace-table-shell overflow-x-auto">
      <div className="workspace-table-toolbar border-b border-[var(--app-border)] px-4 py-3 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-start gap-4 w-full sm:w-auto">
          <div className="flex min-w-0 flex-col gap-1">
            <Text className="workspace-table-hint flex-shrink-0">
              {t('reportResultsTable.tableHint')}
            </Text>
            <Text className="workspace-table-hint" size="xs">
              {locale === 'zh'
                ? '如果你要看 route，先去摘要区或 trace 列表页。'
                : 'Use the route-view shortcuts in the summary block or trace list when you need routing details.'}
            </Text>
          </div>
          <div className="flex flex-wrap items-center gap-3 flex-grow sm:flex-grow-0">
            <Select
              data={statusOptions.map((option) => ({
                value: option,
                label: option
              }))}
              label={t('reportResultsTable.statusFilter')}
              onChange={(value) => setFilterStatus(value ?? '')}
              placeholder={t('reportResultsTable.allStatuses')}
              size="xs"
              value={filterStatus || null}
            />
            <Select
              data={qualityOptions.map((option) => ({
                value: option,
                label: option
              }))}
              label={t('reportResultsTable.qualityFilter')}
              onChange={(value) => setFilterQuality(value ?? '')}
              placeholder={t('reportResultsTable.allQuality')}
              size="xs"
              value={filterQuality || null}
            />
            <Select
              data={[
                {
                  value: 'pending',
                  label: t('reportResultsTable.pendingReview')
                },
                {
                  value: 'reviewed',
                  label: t('reportResultsTable.reviewed')
                }
              ]}
              label={t('reportResultsTable.reviewState')}
              onChange={(value) =>
                setFilterReviewState(
                  (value as 'pending' | 'reviewed' | null) ?? ''
                )
              }
              placeholder={t('reportResultsTable.allReviewStates')}
              size="xs"
              value={filterReviewState || null}
            />
            <Select
              data={[
                {
                  value: 'retrieval',
                  label: t('reportResultsTable.retrievalIssue')
                },
                {
                  value: 'citation',
                  label: t('reportResultsTable.citationIssue')
                },
                {
                  value: 'answer',
                  label: t('reportResultsTable.answerIssue')
                },
                {
                  value: 'skip',
                  label: t('reportResultsTable.skipForNow')
                }
              ]}
              label={t('reportResultsTable.conclusion')}
              onChange={(value) =>
                setFilterConclusion((value as ReviewConclusion | null) ?? '')
              }
              placeholder={t('reportResultsTable.allConclusions')}
              size="xs"
              value={filterConclusion || null}
            />
          </div>
          <ReportRouteViewShortcuts />
        </div>
        <Badge
          color={hasRunError ? 'red' : 'indigo'}
          radius="sm"
          variant="light"
        >
          {t('reportResultsTable.resultsCount').replace(
            '{count}',
            String(sortedAndFilteredItems.length)
          )}
        </Badge>
      </div>
      {sortedAndFilteredItems.length > REPORT_RESULTS_PAGE_SIZE ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--app-border)] px-4 py-3">
          <Text className="workspace-table-hint">{paginationSummary}</Text>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              className="workspace-button"
              color="gray"
              disabled={resolvedPage <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              radius="xl"
              size="xs"
              variant="light"
            >
              {t('reportResultsTable.previous')}
            </Button>
            <Badge color="indigo" radius="sm" variant="light">
              {t('reportResultsTable.page')
                .replace('{current}', String(resolvedPage))
                .replace('{total}', String(totalPages))}
            </Badge>
            <Button
              className="workspace-button"
              color="gray"
              disabled={resolvedPage >= totalPages}
              onClick={() =>
                setPage((current) => Math.min(totalPages, current + 1))
              }
              radius="xl"
              size="xs"
              variant="light"
            >
              {t('reportResultsTable.next')}
            </Button>
          </div>
        </div>
      ) : null}

      <Table.ScrollContainer minWidth={1040}>
        <Table
          className="workspace-table"
          highlightOnHover
          striped="odd"
          styles={{
            table: {
              color: 'var(--app-text)'
            },
            thead: {
              background: 'rgba(255,255,255,0.03)'
            },
            tr: {
              borderColor: 'var(--app-border)'
            },
            th: {
              color: 'var(--app-text-secondary)',
              fontWeight: 700,
              textTransform: 'uppercase',
              fontSize: 12,
              letterSpacing: '0.04em',
              cursor: 'pointer'
            },
            td: {
              color: 'var(--app-text)'
            }
          }}
        >
          <Table.Thead>
            <Table.Tr>
              <Table.Th onClick={() => requestSort('index')}>
                #{' '}
                {sortConfig?.key === 'index' &&
                  (sortConfig.direction === 'ascending' ? '↑' : '↓')}
              </Table.Th>
              <Table.Th onClick={() => requestSort('status')}>
                {t('reportResultsTable.status')}{' '}
                {sortConfig?.key === 'status' &&
                  (sortConfig.direction === 'ascending' ? '↑' : '↓')}
              </Table.Th>
              <Table.Th onClick={() => requestSort('question')}>
                {t('reportResultsTable.question')}{' '}
                {sortConfig?.key === 'question' &&
                  (sortConfig.direction === 'ascending' ? '↑' : '↓')}
              </Table.Th>
              <Table.Th onClick={() => requestSort('answerStatus')}>
                {t('reportResultsTable.answerStatus')}{' '}
                {sortConfig?.key === 'answerStatus' &&
                  (sortConfig.direction === 'ascending' ? '↑' : '↓')}
              </Table.Th>
              <Table.Th onClick={() => requestSort('qualityOverall')}>
                {t('reportResultsTable.quality')}{' '}
                {sortConfig?.key === 'qualityOverall' &&
                  (sortConfig.direction === 'ascending' ? '↑' : '↓')}
              </Table.Th>
              <Table.Th onClick={() => requestSort('qualityPrimaryIssue')}>
                {t('reportResultsTable.primaryIssue')}{' '}
                {sortConfig?.key === 'qualityPrimaryIssue' &&
                  (sortConfig.direction === 'ascending' ? '↑' : '↓')}
              </Table.Th>
              <Table.Th onClick={() => requestSort('citationCount')}>
                {t('reportResultsTable.citations')}{' '}
                {sortConfig?.key === 'citationCount' &&
                  (sortConfig.direction === 'ascending' ? '↑' : '↓')}
              </Table.Th>
              <Table.Th onClick={() => requestSort('usedFallback')}>
                {t('reportResultsTable.fallback')}{' '}
                {sortConfig?.key === 'usedFallback' &&
                  (sortConfig.direction === 'ascending' ? '↑' : '↓')}
              </Table.Th>
              <Table.Th>{t('reportResultsTable.diagnosticsIssue')}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {pagedItems.map((item) => {
              const itemKey = getEvalItemKey(item.index, item.question);
              const isReviewed = reviewedItemKeySet.has(itemKey);
              const reviewConclusion = reviewConclusions[itemKey] ?? null;
              const reviewConclusionPresentation = reviewConclusion
                ? getReviewConclusionPresentation(reviewConclusion, locale)
                : null;
              const reviewSignal = getReviewSignal(item, locale);

              return (
                <Table.Tr
                  key={itemKey}
                  ref={(node) => {
                    itemRowRefs.current[itemKey] = node;
                  }}
                  style={
                    focusedItemKey === itemKey
                      ? {
                          background: 'rgba(99, 102, 241, 0.14)',
                          boxShadow: 'inset 0 0 0 1px rgba(129, 140, 248, 0.4)'
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
                      <Badge
                        color={item.status === 'succeeded' ? 'indigo' : 'red'}
                        radius="sm"
                        variant="light"
                      >
                        {item.status}
                      </Badge>
                      {item.error?.code ? (
                        <Text className="workspace-table-cell-meta">
                          {item.error.code}
                        </Text>
                      ) : null}
                    </div>
                  </Table.Td>
                  <Table.Td>
                    <Text
                      className="workspace-table-cell-title-main"
                      lineClamp={3}
                      size="sm"
                    >
                      {item.question}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <div className="workspace-table-badge-stack">
                      <Badge
                        color={
                          item.answerStatus === 'grounded'
                            ? 'teal'
                            : item.answerStatus === 'insufficient_context'
                              ? 'yellow'
                              : 'gray'
                        }
                        radius="sm"
                        variant="light"
                      >
                        {getAnswerStatusReviewLabel(item.answerStatus, locale)}
                      </Badge>
                    </div>
                  </Table.Td>
                  <Table.Td>
                    <div className="workspace-table-badge-stack">
                      <Badge
                        color={getQualitySignalColor(item.qualityOverall)}
                        radius="sm"
                        variant="light"
                      >
                        {item.qualityOverall ?? '-'}
                      </Badge>
                    </div>
                  </Table.Td>
                  <Table.Td>
                    <div className="flex flex-col gap-1">
                      <Badge
                        color={reviewSignal.color}
                        radius="sm"
                        variant="light"
                        w="fit-content"
                      >
                        {reviewSignal.title}
                      </Badge>
                      <Text className="workspace-table-cell-copy" lineClamp={2}>
                        {reviewSignal.detail}
                      </Text>
                    </div>
                  </Table.Td>
                  <Table.Td>
                    <div className="flex flex-col gap-1">
                      <Text
                        className="workspace-table-number"
                        fw={600}
                        size="sm"
                      >
                        {item.citationCount}
                      </Text>
                      <Text className="workspace-table-cell-meta">
                        {item.citationCount === 0
                          ? locale === 'zh'
                            ? '无引用'
                            : 'none'
                          : item.citationCount === 1
                            ? locale === 'zh'
                              ? '单条引用'
                              : 'single'
                            : locale === 'zh'
                              ? '多条引用'
                              : 'multiple'}
                      </Text>
                    </div>
                  </Table.Td>
                  <Table.Td>
                    <Badge
                      color={
                        item.usedFallback == null
                          ? 'gray'
                          : item.usedFallback
                            ? 'orange'
                            : 'teal'
                      }
                      radius="sm"
                      variant="light"
                    >
                      {item.usedFallback == null
                        ? '-'
                        : item.usedFallback
                          ? locale === 'zh'
                            ? '已触发'
                            : 'triggered'
                          : locale === 'zh'
                            ? '未触发'
                            : 'not used'}
                    </Badge>
                  </Table.Td>
                  <Table.Td className="workspace-table-action">
                    <div className="flex flex-col gap-1">
                      {focusedItemKey === itemKey ? (
                        <Badge color="indigo" radius="sm" variant="light">
                          {locale === 'zh'
                            ? '当前复盘焦点'
                            : 'Current review focus'}
                        </Badge>
                      ) : null}
                      <Badge
                        color={isReviewed ? 'teal' : 'gray'}
                        radius="sm"
                        variant="light"
                      >
                        {isReviewed
                          ? locale === 'zh'
                            ? '已复盘'
                            : 'Reviewed'
                          : locale === 'zh'
                            ? '待复盘'
                            : 'Pending review'}
                      </Badge>
                      {reviewConclusionPresentation ? (
                        <Badge
                          color={reviewConclusionPresentation.color}
                          radius="sm"
                          variant="light"
                        >
                          {reviewConclusionPresentation.label}
                        </Badge>
                      ) : null}
                      <Button
                        className="workspace-button"
                        color={isReviewed ? 'gray' : 'teal'}
                        onClick={() =>
                          toggleReviewedItem(item.index, item.question)
                        }
                        radius="xl"
                        size="xs"
                        variant={isReviewed ? 'subtle' : 'light'}
                      >
                        {isReviewed
                          ? locale === 'zh'
                            ? '取消已复盘'
                            : 'Mark as pending'
                          : locale === 'zh'
                            ? '标记已复盘'
                            : 'Mark reviewed'}
                      </Button>
                      <Select
                        allowDeselect
                        data={[
                          {
                            value: 'retrieval',
                            label: t('reportResultsTable.retrievalIssue')
                          },
                          {
                            value: 'citation',
                            label: t('reportResultsTable.citationIssue')
                          },
                          {
                            value: 'answer',
                            label: t('reportResultsTable.answerIssue')
                          },
                          {
                            value: 'skip',
                            label: t('reportResultsTable.skipForNow')
                          }
                        ]}
                        onChange={(value) =>
                          updateReviewConclusion(
                            item.index,
                            item.question,
                            (value as ReviewConclusion | null) ?? null
                          )
                        }
                        placeholder={t(
                          'reportResultsTable.conclusionPlaceholder'
                        )}
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
                            priorityLabel:
                              locale === 'zh'
                                ? `结果行 #${item.index}`
                                : `Result row #${item.index}`
                          })}
                          variant="light"
                        >
                          {t('reportResultsTable.openDiagnostics')}
                        </Button>
                      ) : (
                        <Text c="var(--app-text-muted)" size="xs">
                          -
                        </Text>
                      )}
                      {item.traceId ? (
                        <Text className="workspace-table-cell-meta">
                          {item.traceId}
                        </Text>
                      ) : null}
                      {item.error?.message ? (
                        <Text
                          className="workspace-table-cell-copy"
                          lineClamp={3}
                          size="xs"
                        >
                          {item.error.message}
                        </Text>
                      ) : null}
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
