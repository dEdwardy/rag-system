import { Badge, Button, Paper, Select, Stack, Text, Textarea } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { lazy, Suspense, type FormEvent, useDeferredValue, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { StatePanel } from "../../components/StatePanel";
import {
  useAssistants,
  useChooseEvalQuestionSetBaseline,
  useCreateEvalQuestionSet,
  useEvalQuestionSetBaselineSnapshots,
  useEvalQuestionSets,
  useRunEvalQuestionSet,
  useSnapshotEvalQuestionSetBaseline
} from "../../features/api/hooks";
import { useI18n } from "../../i18n/I18nProvider";
import { writeStorageItem } from "../../lib/browser-storage";
import {
  buildEvalRunCarryThroughPreview,
  mergeSearchParamsWithEvalRunParams,
  normalizeEvalRunParams,
  readEvalRunParamsFromSearchParams,
  formatBaselineMetadataValue,
  getRegressionReasonLabel,
  getReportCenterResultNextAction
} from "./report-center-page-helpers";



const ReportResultsTable = lazy(async () => {
  const module = await import("./ReportResultsTable");

  return { default: module.ReportResultsTable };
});

const ReportAnalysisPanels = lazy(async () => {
  const module = await import("./ReportAnalysisPanels");

  return { default: module.ReportAnalysisPanels };
});

// 图表颜色配置
const COLORS = ["#8884d8", "#82ca9d", "#ffc658", "#ff8042", "#0088fe", "#00C49F"];

function buildTraceReviewLink(args: {
  traceId: string;
  question: string;
  handlingTitle: string;
  priorityLabel: string;
}) {
  const searchParams = new URLSearchParams({
    from: "report",
    question: args.question,
    handling: args.handlingTitle,
    priority: args.priorityLabel
  });

  return `/traces/${args.traceId}?${searchParams.toString()}`;
}

function buildAssistantReviewLink(args: {
  baseHref: string;
  focusTitle: string;
  returnTo: string;
}) {
  const [pathnameWithQuery, hash = ""] = args.baseHref.split("#");
  const [pathname, currentQuery = ""] = pathnameWithQuery.split("?");
  const searchParams = new URLSearchParams(currentQuery);
  searchParams.set("from", "report");
  searchParams.set("focus", args.focusTitle);
  searchParams.set("returnTo", args.returnTo);

  return `${pathname}?${searchParams.toString()}${hash ? `#${hash}` : ""}`;
}

function buildReviewStateStorageKey(args: {
  questionSetId: string;
  assistantId: string;
  startedAt: string;
}) {
  return `report-review-state:${args.questionSetId}:${args.assistantId}:${args.startedAt}`;
}

type ReviewConclusion = "retrieval" | "citation" | "answer" | "skip";

function getReviewConclusionPresentation(conclusion: ReviewConclusion, locale: "zh" | "en") {
  if (conclusion === "retrieval") {
    return {
      label: locale === "zh" ? "检索问题" : "Retrieval issue",
      color: "orange"
    };
  }
  if (conclusion === "citation") {
    return {
      label: locale === "zh" ? "引用问题" : "Citation issue",
      color: "yellow"
    };
  }
  if (conclusion === "answer") {
    return {
      label: locale === "zh" ? "回答问题" : "Answer issue",
      color: "indigo"
    };
  }

  return {
    label: locale === "zh" ? "暂不处理" : "Skip for now",
    color: "gray"
  };
}

function getConclusionGuidance(args: {
  conclusionSummary: Array<{ conclusion: ReviewConclusion; count: number }>;
  locale: "zh" | "en";
}) {
  const actionable = args.conclusionSummary.filter(item => item.conclusion !== "skip");
  if (actionable.length === 0) {
    return null;
  }

  const dominant = actionable.slice().sort((left, right) => right.count - left.count)[0];
  if (!dominant) {
    return null;
  }

  if (dominant.conclusion === "retrieval") {
    return {
      conclusion: dominant.conclusion,
      title: args.locale === "zh" ? "这一轮问题主要偏向检索命中" : "This round is leaning toward retrieval issues",
      detail:
        args.locale === "zh"
          ? "优先回看命中 chunk、检索分数和资料覆盖情况，先确认是否真的拿到了足够可用的上下文。"
          : "Prioritize retrieved chunks, retrieval scores, and library coverage to confirm whether enough usable context was actually found.",
      color: "orange"
    };
  }

  if (dominant.conclusion === "citation") {
    return {
      conclusion: dominant.conclusion,
      title: args.locale === "zh" ? "这一轮问题主要偏向引用支撑不足" : "This round is leaning toward citation support issues",
      detail:
        args.locale === "zh"
          ? "优先核对薄引用、漏引用和引用是否真的支撑回答，再决定是否继续调整检索。"
          : "Review thin citations, missing citations, and whether the cited evidence truly supports the answer before changing retrieval further.",
      color: "yellow"
    };
  }

  return {
    conclusion: dominant.conclusion,
    title: args.locale === "zh" ? "这一轮问题主要偏向回答质量" : "This round is leaning toward answer-quality issues",
    detail:
      args.locale === "zh"
        ? "优先回看回答措辞、主问题信号和 fallback 痕迹，再判断是否需要继续调回答策略。"
        : "Review answer phrasing, primary-issue signals, and fallback traces first, then decide whether answer behavior should be adjusted.",
    color: "indigo"
  };
}

function getConclusionPathGuidance(conclusion: ReviewConclusion, locale: "zh" | "en") {
  if (conclusion === "retrieval") {
    return {
      steps:
        locale === "zh"
          ? ["先看命中 Chunk", "再看检索分数与排序", "最后确认资料覆盖"]
          : ["Start with retrieved chunks", "Then inspect retrieval scores and ranking", "Finish by checking library coverage"],
      traceLabel: locale === "zh" ? "打开诊断并直看检索线索" : "Open diagnostics for retrieval signals"
    };
  }

  if (conclusion === "citation") {
    return {
      steps:
        locale === "zh"
          ? ["先看引用是否足够", "再跳文档详情核对证据", "最后决定是否还要回看检索"]
          : ["Start with citation sufficiency", "Then open document detail to verify evidence", "Finish by deciding whether retrieval needs another look"],
      traceLabel: locale === "zh" ? "打开诊断并直看引用线索" : "Open diagnostics for citation signals"
    };
  }

  return {
    steps:
      locale === "zh"
        ? ["先看回答正文与主问题信号", "再看 fallback 或错误痕迹", "最后确认检索和引用是否基本正常"]
        : ["Start with the answer body and primary issue signal", "Then inspect fallback or failure traces", "Finish by confirming retrieval and citations are mostly healthy"],
    traceLabel: locale === "zh" ? "打开诊断并直看回答线索" : "Open diagnostics for answer signals"
  };
}

function getOptimizationSuggestion(args: {
  conclusion: ReviewConclusion;
  topBreachedMetric:
    | {
        metric: "successRate" | "groundedRate" | "strongRate" | "fallbackRate" | "averageCitationCount";
        limitType: "min" | "max";
      }
    | null;
  locale: "zh" | "en";
}) {
  const metricHint = args.topBreachedMetric
    ? getQualityGateMetricLabel(args.topBreachedMetric.metric, args.locale)
    : args.locale === "zh"
      ? "当前复盘分布"
      : "the current review distribution";

  if (args.conclusion === "retrieval") {
    return {
      title: args.locale === "zh" ? "优先改善检索覆盖与命中质量" : "Prioritize retrieval coverage and hit quality",
      detail:
        args.locale === "zh"
          ? `这一轮更像是上下文拿得不够好。先围绕 ${metricHint} 回看资料覆盖、chunk 命中和排序，再决定是否需要动回答策略。`
          : `This round looks more like a context-retrieval problem. Review library coverage, chunk hits, and ranking around ${metricHint} before changing answer behavior.`,
      checklist:
        args.locale === "zh"
          ? ["先看是否经常没有命中可用 chunk", "再看命中的 chunk 是否排在靠前位置"]
          : ["Check whether usable chunks are often missing", "Then confirm whether the right chunks are ranking near the top"],
      color: "orange",
      settingsHref: "/assistant#assistant-retrieval-section",
      settingsLabel: args.locale === "zh" ? "去检查搜索行为" : "Review search behavior"
    };
  }

  if (args.conclusion === "citation") {
    return {
      title: args.locale === "zh" ? "优先改善引用支撑密度" : "Prioritize citation support density",
      detail:
        args.locale === "zh"
          ? `这一轮更像是证据引用不够稳。先围绕 ${metricHint} 回看薄引用、漏引用和证据对应关系，再决定是否继续调检索。`
          : `This round looks more like an evidence-support problem. Review thin citations, missing citations, and evidence alignment around ${metricHint} before changing retrieval further.`,
      checklist:
        args.locale === "zh"
          ? ["先看回答是否只靠 0-1 条引用支撑", "再看引用内容是否真的覆盖了回答结论"]
          : ["Check whether answers are relying on 0-1 citations", "Then confirm whether the cited evidence truly covers the answer claim"],
      color: "yellow",
      settingsHref: "/assistant#assistant-filters-section",
      settingsLabel: args.locale === "zh" ? "去检查范围限制" : "Review scope limits"
    };
  }

  return {
    title: args.locale === "zh" ? "优先收紧回答行为" : "Prioritize tightening answer behavior",
    detail:
      args.locale === "zh"
        ? `这一轮更像是回答生成本身不够稳。先围绕 ${metricHint} 回看 fallback、主问题信号和回答措辞，再决定是否要改 prompt 或回答策略。`
        : `This round looks more like answer generation is drifting. Review fallback usage, primary-issue signals, and answer phrasing around ${metricHint} before changing prompt or answer strategy.`,
    checklist:
      args.locale === "zh"
        ? ["先看回答是否出现 fallback 或明显保守/漂移", "再看回答质量下降是否发生在检索和引用基本正常时"]
        : ["Check whether fallback or obvious answer drift is appearing", "Then confirm whether quality drops happen even when retrieval and citations are otherwise healthy"],
    color: "indigo",
    settingsHref: "/assistant#assistant-answer-policy-section",
    settingsLabel: args.locale === "zh" ? "去检查回答设置" : "Review answer settings"
  };
}

function getRecheckSuggestion(args: {
  conclusion: ReviewConclusion;
  topBreachedMetric:
    | {
        metric: "successRate" | "groundedRate" | "strongRate" | "fallbackRate" | "averageCitationCount";
        limitType: "min" | "max";
      }
    | null;
  locale: "zh" | "en";
}) {
  const metricLabel = args.topBreachedMetric
    ? getQualityGateMetricLabel(args.topBreachedMetric.metric, args.locale)
    : args.locale === "zh"
      ? "本轮核心指标"
      : "the core quality metrics";

  if (args.conclusion === "retrieval") {
    return {
      title: args.locale === "zh" ? "改完后优先复查 grounded 与成功率" : "Recheck grounded rate and success rate first",
      color: "orange",
      checks:
        args.locale === "zh"
          ? [
              `先看 ${metricLabel} 是否开始回升，确认检索命中不再明显缺上下文。`,
              "再看最弱项里是否还频繁出现上下文不足或无命中迹象。"
            ]
          : [
              `Start by checking whether ${metricLabel} is improving, confirming retrieval is no longer missing usable context.`,
              "Then verify whether weakest items still show repeated insufficient-context or no-hit patterns."
            ]
    };
  }

  if (args.conclusion === "citation") {
    return {
      title: args.locale === "zh" ? "改完后优先复查引用数与 grounded 表现" : "Recheck citation density and grounded behavior first",
      color: "yellow",
      checks:
        args.locale === "zh"
          ? [
              `先看 ${metricLabel} 和平均引用数是否回到更稳的区间。`,
              "再看薄引用、漏引用的问题是否从待复盘队列里明显减少。"
            ]
          : [
              `Start by checking whether ${metricLabel} and average citations have moved back into a healthier range.`,
              "Then verify whether thin-citation and missing-citation items are becoming less common in the pending queue."
            ]
    };
  }

  return {
    title: args.locale === "zh" ? "改完后优先复查 strong 与 fallback 变化" : "Recheck strong rate and fallback behavior first",
    color: "indigo",
    checks:
      args.locale === "zh"
        ? [
            `先看 ${metricLabel}、strong 比例和 fallback 比例是否向好的方向变化。`,
            "再看回答质量下降的题是否减少，并确认问题没有重新转移到检索或引用侧。"
          ]
        : [
            `Start by checking whether ${metricLabel}, strong rate, and fallback rate are moving in the right direction.`,
            "Then verify whether answer-quality regressions are decreasing without simply shifting the problem back into retrieval or citations."
          ]
  };
}

function buildLocalReviewSummary(args: {
  locale: "zh" | "en";
  questionSetId: string;
  assistantId: string;
  reviewedRunItemCount: number;
  totalRunItemCount: number;
  reviewConclusionSummary: Array<{ conclusion: ReviewConclusion; count: number }>;
  conclusionGuidance: ReturnType<typeof getConclusionGuidance> | null;
  optimizationSuggestion: ReturnType<typeof getOptimizationSuggestion> | null;
  recheckSuggestion: ReturnType<typeof getRecheckSuggestion> | null;
  reviewNote: string;
  reviewUpdatedAt: string | null;
  formatDateTime: (value: string) => string;
}) {
  const lines: string[] = [];
  const summaryHeading = args.locale === "zh" ? "# 本地复盘摘要" : "# Local review summary";
  const reviewHeading = args.locale === "zh" ? "## 复盘进度" : "## Review progress";
  const conclusionHeading = args.locale === "zh" ? "## 结论分布" : "## Conclusion summary";
  const focusHeading = args.locale === "zh" ? "## 本轮改进重点" : "## Current improvement focus";
  const optimizeHeading = args.locale === "zh" ? "## 建议优先优化方向" : "## Suggested optimization direction";
  const recheckHeading = args.locale === "zh" ? "## 改后优先复查" : "## Suggested recheck after changes";
  const noteHeading = args.locale === "zh" ? "## 本地复盘记录" : "## Local review note";

  lines.push(summaryHeading);
  lines.push("");
  lines.push(args.locale === "zh" ? `- Question set: ${args.questionSetId}` : `- Question set: ${args.questionSetId}`);
  lines.push(args.locale === "zh" ? `- Assistant: ${args.assistantId}` : `- Assistant: ${args.assistantId}`);
  if (args.reviewUpdatedAt) {
    lines.push(
      args.locale === "zh"
        ? `- 最近更新: ${args.formatDateTime(args.reviewUpdatedAt)}`
        : `- Last updated: ${args.formatDateTime(args.reviewUpdatedAt)}`
    );
  }
  lines.push("");
  lines.push(reviewHeading);
  lines.push("");
  lines.push(
    args.locale === "zh"
      ? `- 已复盘: ${args.reviewedRunItemCount}/${args.totalRunItemCount}`
      : `- Reviewed: ${args.reviewedRunItemCount}/${args.totalRunItemCount}`
  );
  lines.push("");

  if (args.reviewConclusionSummary.length > 0) {
    lines.push(conclusionHeading);
    lines.push("");
    for (const item of args.reviewConclusionSummary) {
      const presentation = getReviewConclusionPresentation(item.conclusion, args.locale);
      lines.push(`- ${presentation.label}: ${item.count}`);
    }
    lines.push("");
  }

  if (args.conclusionGuidance) {
    lines.push(focusHeading);
    lines.push("");
    lines.push(`- ${args.conclusionGuidance.title}`);
    lines.push(`- ${args.conclusionGuidance.detail}`);
    lines.push("");
  }

  if (args.optimizationSuggestion) {
    lines.push(optimizeHeading);
    lines.push("");
    lines.push(`- ${args.optimizationSuggestion.title}`);
    lines.push(`- ${args.optimizationSuggestion.detail}`);
    for (const item of args.optimizationSuggestion.checklist) {
      lines.push(`- ${item}`);
    }
    lines.push("");
  }

  if (args.recheckSuggestion) {
    lines.push(recheckHeading);
    lines.push("");
    lines.push(`- ${args.recheckSuggestion.title}`);
    for (const item of args.recheckSuggestion.checks) {
      lines.push(`- ${item}`);
    }
    lines.push("");
  }

  if (args.reviewNote.trim().length > 0) {
    lines.push(noteHeading);
    lines.push("");
    lines.push(args.reviewNote.trim());
    lines.push("");
  }

  return lines.join("\n").trim();
}

function getEvalItemKey(index: number, question: string) {
  return `${index}-${question}`;
}

function getAnswerStatusReviewLabel(answerStatus: string | null, locale: "zh" | "en") {
  if (!answerStatus) {
    return locale === "zh" ? "未标注" : "Unlabeled";
  }
  if (answerStatus === "grounded") {
    return locale === "zh" ? "有依据" : "Grounded";
  }
  if (answerStatus === "insufficient_context") {
    return locale === "zh" ? "上下文不足" : "Insufficient context";
  }

  return answerStatus;
}

function getQualitySignalColor(qualityOverall: string | null) {
  if (!qualityOverall) {
    return "gray";
  }
  const normalized = qualityOverall.toLowerCase();
  if (normalized === "strong") {
    return "teal";
  }
  if (normalized === "acceptable" || normalized === "grounded") {
    return "indigo";
  }
  if (normalized === "weak") {
    return "yellow";
  }
  if (normalized === "failed") {
    return "red";
  }

  return "gray";
}

function getRegressionSeverityColor(severity: "critical" | "high" | "medium") {
  if (severity === "critical") {
    return "red";
  }
  if (severity === "high") {
    return "orange";
  }

  return "yellow";
}

function getReviewSignal(item: {
  status: "succeeded" | "failed";
  qualityPrimaryIssue: string | null;
  usedFallback: boolean | null;
  citationCount: number;
  error: { message: string; code: string | null } | null;
}, locale: "zh" | "en") {
  if (item.status === "failed") {
    return {
      title: locale === "zh" ? "先看失败原因" : "Check failure first",
      detail: item.error?.code ?? (locale === "zh" ? "本题执行失败，优先进入诊断。" : "This item failed. Start from diagnostics."),
      color: "red"
    };
  }

  if (item.qualityPrimaryIssue) {
    return {
      title: locale === "zh" ? "先看主问题" : "Check primary issue",
      detail: item.qualityPrimaryIssue,
      color: "yellow"
    };
  }

  if (item.usedFallback) {
    return {
      title: locale === "zh" ? "回答走了 fallback" : "Fallback answer used",
      detail: locale === "zh" ? "优先核对检索命中和回答依据。" : "Review retrieval hits and answer grounding first.",
      color: "orange"
    };
  }

  if (item.citationCount === 0) {
    return {
      title: locale === "zh" ? "没有引用" : "No citations",
      detail: locale === "zh" ? "优先确认是否真的命中了可用资料。" : "Confirm whether retrieval actually found usable source material.",
      color: "red"
    };
  }

  if (item.citationCount === 1) {
    return {
      title: locale === "zh" ? "引用偏薄" : "Thin citations",
      detail: locale === "zh" ? "建议顺手核对该唯一引用是否足够支撑回答。" : "Check whether the single citation is enough to support the answer.",
      color: "yellow"
    };
  }

  return {
    title: locale === "zh" ? "先看诊断即可" : "Diagnostics are optional",
    detail: locale === "zh" ? "本题没有明显警报，可只在需要时进入诊断。" : "No immediate warning signal here; open diagnostics only if needed.",
    color: "teal"
  };
}

function getHandlingStrategy(args: {
  reasonCodes: Array<"became_failed" | "became_insufficient_context" | "quality_degraded" | "fallback_introduced" | "citations_decreased">;
  current: {
    status: "succeeded" | "failed";
    qualityPrimaryIssue: string | null;
    citationCount: number;
    usedFallback: boolean | null;
    error: { message: string; code: string | null } | null;
  };
  locale: "zh" | "en";
}) {
  const { reasonCodes, current, locale } = args;

  if (current.status === "failed" || reasonCodes.includes("became_failed")) {
    return {
      title: locale === "zh" ? "按失败问题处理" : "Treat this as a failure issue",
      detail:
        locale === "zh"
          ? "先打开诊断，确认是执行失败、超时，还是外部来源异常，再决定是否重跑。"
          : "Open diagnostics first and confirm whether this is an execution failure, timeout, or external-source issue before rerunning.",
      color: "red"
    };
  }

  if (reasonCodes.includes("became_insufficient_context") || current.citationCount === 0) {
    return {
      title: locale === "zh" ? "按检索命中问题处理" : "Treat this as a retrieval issue",
      detail:
        locale === "zh"
          ? "先看诊断里的命中 chunk 和引用，确认是否真的检索到了足够可用的资料。"
          : "Start from diagnostics and check retrieved chunks and citations to confirm whether retrieval found enough usable source material.",
      color: "orange"
    };
  }

  if (reasonCodes.includes("citations_decreased") || current.citationCount === 1) {
    return {
      title: locale === "zh" ? "按引用支撑问题处理" : "Treat this as a citation issue",
      detail:
        locale === "zh"
          ? "优先核对当前引用是否足够支撑回答，再决定是否需要继续看文档详情。"
          : "Check whether the current citations are enough to support the answer before drilling further into document detail.",
      color: "yellow"
    };
  }

  return {
    title: locale === "zh" ? "按回答质量问题处理" : "Treat this as an answer-quality issue",
    detail:
      locale === "zh"
        ? "先看回答本身与主问题信号，再回到诊断确认检索和引用是否已经基本正常。"
        : "Start from the answer itself and the primary issue signal, then confirm in diagnostics that retrieval and citations are otherwise mostly healthy.",
    color: current.usedFallback || reasonCodes.includes("fallback_introduced") ? "orange" : "indigo"
  };
}

function getQualityGateStatusPresentation(status: "passed" | "warning" | "failed", locale: "zh" | "en") {
  if (status === "passed") {
    return {
      color: "teal",
      label: locale === "zh" ? "可放行" : "Ready to ship",
      detail:
        locale === "zh"
          ? "当前质量门槛已通过，可以把后续注意力放到持续改进而不是阻断问题上。"
          : "The current quality gate passed, so focus can shift to incremental improvement rather than release-blocking issues."
    };
  }

  if (status === "warning") {
    return {
      color: "yellow",
      label: locale === "zh" ? "需关注后再放行" : "Ship with caution",
      detail:
        locale === "zh"
          ? "当前没有完全阻断发布，但已有指标越线，建议先处理最关键的问题。"
          : "The run is not fully blocked, but some metrics crossed the line and should be reviewed before shipping."
    };
  }

  return {
    color: "red",
    label: locale === "zh" ? "当前不建议放行" : "Do not ship yet",
    detail:
      locale === "zh"
        ? "当前质量门槛失败，建议先修复 breached metrics 对应的问题后再继续。"
        : "The quality gate failed. Fix the issues behind the breached metrics before moving forward."
  };
}

function getQualityGateMetricLabel(
  metric: "successRate" | "groundedRate" | "strongRate" | "fallbackRate" | "averageCitationCount",
  locale: "zh" | "en"
) {
  if (metric === "successRate") return locale === "zh" ? "成功率" : "Success rate";
  if (metric === "groundedRate") return locale === "zh" ? "Grounded 比例" : "Grounded rate";
  if (metric === "strongRate") return locale === "zh" ? "Strong 比例" : "Strong rate";
  if (metric === "fallbackRate") return locale === "zh" ? "Fallback 比例" : "Fallback rate";
  return locale === "zh" ? "平均引用数" : "Average citations";
}

function getQualityGateMetricStrategy(args: {
  metric: "successRate" | "groundedRate" | "strongRate" | "fallbackRate" | "averageCitationCount";
  limitType: "min" | "max";
  locale: "zh" | "en";
}) {
  const { metric, limitType, locale } = args;

  if (metric === "successRate") {
    return locale === "zh"
      ? "先看失败题和超时/异常路径。"
      : "Start from failed items and timeout/error paths.";
  }
  if (metric === "groundedRate") {
    return locale === "zh"
      ? "先看检索命中和引用是否真的支撑回答。"
      : "Check whether retrieval hits and citations truly support the answer.";
  }
  if (metric === "strongRate") {
    return locale === "zh"
      ? "先看回答质量下降的题，再确认是否需要调整回答策略。"
      : "Review quality-degraded items first, then decide whether answer behavior needs adjustment.";
  }
  if (metric === "fallbackRate") {
    return locale === "zh"
      ? "先看为什么进入 fallback，再确认检索是否已经不足。"
      : "Check why fallback was triggered, then confirm whether retrieval had already become insufficient.";
  }

  return locale === "zh"
    ? limitType === "min"
      ? "先看引用偏薄和无引用的题。"
      : "先看引用过高是否来自噪音命中。"
    : limitType === "min"
      ? "Review thin-citation and no-citation items first."
      : "Check whether overly high citations are coming from noisy hits.";
}

function formatQuestionSetOptionLabel(args: {
  questionSet: {
    name: string;
    questionCount: number;
    status: "draft" | "locked" | "archived";
  };
  locale: "zh" | "en";
}) {
  const countLabel =
    args.locale === "zh"
      ? `${args.questionSet.questionCount} 道题`
      : `${args.questionSet.questionCount} questions`;
  const statusLabel =
    args.locale === "zh"
      ? args.questionSet.status === "locked"
        ? "已锁定"
        : args.questionSet.status === "archived"
          ? "已归档"
          : "草稿"
      : args.questionSet.status === "locked"
        ? "locked"
        : args.questionSet.status === "archived"
          ? "archived"
          : "draft";

  return `${args.questionSet.name} (${countLabel} · ${statusLabel})`;
}

function formatBaselineSnapshotOptionLabel(args: {
  snapshot: {
    version: number;
    name: string;
    questionCount: number;
    createdAt: string;
  };
  formatDateTime: (value: string) => string;
  locale: "zh" | "en";
}) {
  const countLabel =
    args.locale === "zh"
      ? `${args.snapshot.questionCount} 道题`
      : `${args.snapshot.questionCount} questions`;

  return `v${args.snapshot.version} · ${args.snapshot.name} (${countLabel} · ${args.formatDateTime(args.snapshot.createdAt)})`;
}

export function ReportCenterPage() {
  const questionSetsQuery = useEvalQuestionSets();
  const assistantsQuery = useAssistants();
  const createQuestionSetMutation = useCreateEvalQuestionSet();
  const snapshotBaselineMutation = useSnapshotEvalQuestionSetBaseline();
  const chooseBaselineMutation = useChooseEvalQuestionSetBaseline();
  const runEvalMutation = useRunEvalQuestionSet();
  const { locale, formatDateTime } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isRunPending, startRunTransition] = useTransition();
  const [questionSetId, setQuestionSetId] = useState(() => searchParams.get("questionSetId") ?? "");
  const [assistantId, setAssistantId] = useState(() => searchParams.get("assistantId") ?? "");
  const [baselineSnapshotId, setBaselineSnapshotId] = useState(() => searchParams.get("baselineSnapshotId") ?? "");
  const [draftQuestionSetName, setDraftQuestionSetName] = useState("");
  const [draftQuestionSetDescription, setDraftQuestionSetDescription] = useState("");
  const [draftQuestionLines, setDraftQuestionLines] = useState("");
  const baselineSnapshotsQuery = useEvalQuestionSetBaselineSnapshots(questionSetId || null);

  // 表格排序和筛选状态
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'ascending' | 'descending' } | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterQuality, setFilterQuality] = useState<string>("");
  const [filterReviewState, setFilterReviewState] = useState<"" | "pending" | "reviewed">("");
  const [filterConclusion, setFilterConclusion] = useState<"" | ReviewConclusion>("");
  const [showPriorityOnly, setShowPriorityOnly] = useState(false);
  const [focusedItemKey, setFocusedItemKey] = useState<string | null>(null);
  const [reviewedItemKeys, setReviewedItemKeys] = useState<string[]>([]);
  const [reviewConclusions, setReviewConclusions] = useState<Record<string, ReviewConclusion>>({});
  const [reviewNote, setReviewNote] = useState("");
  const [reviewUpdatedAt, setReviewUpdatedAt] = useState<string | null>(null);
  const itemRowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
  const deferredRunItems = useDeferredValue(runEvalMutation.data?.items ?? []);
  const deferredReviewedItemKeys = useDeferredValue(reviewedItemKeys);
  const deferredReviewConclusions = useDeferredValue(reviewConclusions);

  const assistantOptions = useMemo(
    () =>
      (assistantsQuery.data ?? []).map(assistant => ({
        value: assistant.id,
        label: `${assistant.name} (${assistant.id})`
      })),
    [assistantsQuery.data]
  );
  const questionSetOptions = useMemo(
    () =>
      (questionSetsQuery.data ?? []).map(questionSet => ({
        value: questionSet.id,
        label: formatQuestionSetOptionLabel({
          questionSet,
          locale
        })
      })),
    [locale, questionSetsQuery.data]
  );
  const baselineSnapshotOptions = useMemo(
    () =>
      (baselineSnapshotsQuery.data ?? []).map(snapshot => ({
        value: snapshot.id,
        label: formatBaselineSnapshotOptionLabel({
          snapshot,
          formatDateTime,
          locale
        })
      })),
    [baselineSnapshotsQuery.data, formatDateTime, locale]
  );
  const selectedQuestionSet = useMemo(
    () => (questionSetsQuery.data ?? []).find(questionSet => questionSet.id === questionSetId) ?? null,
    [questionSetId, questionSetsQuery.data]
  );
  const selectedBaselineSnapshot = useMemo(
    () => (baselineSnapshotsQuery.data ?? []).find(snapshot => snapshot.id === baselineSnapshotId) ?? null,
    [baselineSnapshotId, baselineSnapshotsQuery.data]
  );
  const hasSelectedBaseline = baselineSnapshotId.trim().length > 0;
  const draftQuestionItems = useMemo(
    () =>
      draftQuestionLines
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean),
    [draftQuestionLines]
  );

  useEffect(() => {
    if (!assistantId && assistantOptions.length > 0) {
      setAssistantId(assistantOptions[0].value);
    }
  }, [assistantId, assistantOptions]);

  useEffect(() => {
    if (!questionSetId && questionSetOptions.length > 0) {
      setQuestionSetId(questionSetOptions[0].value);
    }
  }, [questionSetId, questionSetOptions]);

  useEffect(() => {
    const paramsFromUrl = readEvalRunParamsFromSearchParams(searchParams);

    setQuestionSetId(current => (current === paramsFromUrl.questionSetId ? current : paramsFromUrl.questionSetId));
    setAssistantId(current => (current === paramsFromUrl.assistantId ? current : paramsFromUrl.assistantId));
    setBaselineSnapshotId(current =>
      current === paramsFromUrl.baselineSnapshotId ? current : paramsFromUrl.baselineSnapshotId
    );
  }, [searchParams]);

  useEffect(() => {
    const normalizedParams = normalizeEvalRunParams({
      questionSetId,
      assistantId,
      baselineSnapshotId
    });
    const currentQuery = searchParams.toString();

    const nextSearchParams = mergeSearchParamsWithEvalRunParams(searchParams, normalizedParams);
    if (nextSearchParams.toString() !== currentQuery) {
      setSearchParams(nextSearchParams, { replace: true });
    }
  }, [assistantId, baselineSnapshotId, questionSetId, searchParams, setSearchParams]);

  useEffect(() => {
    if (!questionSetId) {
      if (baselineSnapshotId) {
        setBaselineSnapshotId("");
      }
      return;
    }

    if (baselineSnapshotsQuery.isLoading || baselineSnapshotsQuery.isFetching) {
      return;
    }

    const snapshots = baselineSnapshotsQuery.data ?? [];
    if (snapshots.length === 0) {
      if (baselineSnapshotId) {
        setBaselineSnapshotId("");
      }
      return;
    }

    if (snapshots.some(snapshot => snapshot.id === baselineSnapshotId)) {
      return;
    }

    const preferredSnapshotId = selectedQuestionSet?.baselineSnapshotId ?? snapshots[0]?.id ?? "";
    if (preferredSnapshotId && preferredSnapshotId !== baselineSnapshotId) {
      setBaselineSnapshotId(preferredSnapshotId);
    }
  }, [
    baselineSnapshotId,
    baselineSnapshotsQuery.data,
    baselineSnapshotsQuery.isFetching,
    baselineSnapshotsQuery.isLoading,
    questionSetId,
    selectedQuestionSet?.baselineSnapshotId
  ]);

  const evalRunStatus = runEvalMutation.isPending || isRunPending
    ? "running"
    : runEvalMutation.isError
      ? "failed"
      : runEvalMutation.data
        ? "completed"
        : "idle";

  const evalRunStatusColor =
    evalRunStatus === "running"
      ? "yellow"
      : evalRunStatus === "failed"
        ? "red"
        : evalRunStatus === "completed"
          ? "indigo"
          : "gray";

  const evalRunStatusLabel =
    locale === "zh"
      ? evalRunStatus === "running"
        ? "运行中"
        : evalRunStatus === "failed"
          ? "运行失败"
          : evalRunStatus === "completed"
            ? "运行完成"
            : "未运行"
      : evalRunStatus === "running"
        ? "Running"
        : evalRunStatus === "failed"
          ? "Run failed"
          : evalRunStatus === "completed"
          ? "Run completed"
          : "Idle";
  const reportWorkflowSteps = [
    {
      key: "prepare",
      title: locale === "zh" ? "准备题集" : "Prepare set",
      detail:
        selectedQuestionSet != null
          ? locale === "zh"
            ? hasSelectedBaseline
              ? "题集和 baseline 已就绪"
              : "题集已选中，下一步生成 baseline"
            : "Question set selected"
          : locale === "zh"
            ? "先准备题集和 baseline"
            : "Create a set and baseline first",
      state: selectedQuestionSet != null && hasSelectedBaseline ? "completed" : "current"
    },
    {
      key: "run",
      title: locale === "zh" ? "运行检查" : "Run check",
      detail:
        runEvalMutation.data != null
          ? locale === "zh"
            ? "本轮检查已完成"
            : "Current run completed"
          : evalRunStatus === "running"
            ? locale === "zh"
              ? "质量检查正在运行"
              : "Quality check in progress"
            : selectedQuestionSet != null && hasSelectedBaseline
              ? locale === "zh"
                ? "选择 assistant 后即可运行"
                : "Select an assistant to run"
              : locale === "zh"
                ? "准备完成后再运行"
                : "Run after preparation",
      state:
        runEvalMutation.data != null
          ? "completed"
          : evalRunStatus === "running"
            ? "current"
            : selectedQuestionSet != null && hasSelectedBaseline
              ? "current"
              : "upcoming"
    },
    {
      key: "review",
      title: locale === "zh" ? "复盘结果" : "Review result",
      detail:
        runEvalMutation.data != null
          ? locale === "zh"
            ? "查看摘要、弱项和下一步动作"
            : "Review summary, weakest items, and next actions"
          : locale === "zh"
            ? "运行完成后进入复盘"
            : "Review after the run finishes",
      state: runEvalMutation.data != null ? "current" : "upcoming"
    }
  ] as const;

  const qualitySummaryRows = useMemo(() => {
    if (deferredRunItems.length === 0) {
      return [];
    }

    const counts = new Map<string, number>();
    for (const item of deferredRunItems) {
      const quality = item.qualityOverall ?? (locale === "zh" ? "未标注" : "unlabeled");
      counts.set(quality, (counts.get(quality) ?? 0) + 1);
    }

    return Array.from(counts.entries())
      .map(([quality, count]) => ({ quality, count }))
      .sort((a, b) => b.count - a.count);
  }, [deferredRunItems, locale]);

  const regressionDrilldownItems = useMemo(() => runEvalMutation.data?.baselineComparison?.failureDrilldown?.weakestItems ?? [], [runEvalMutation.data]);
  const firstRegressionDrilldownItem = regressionDrilldownItems[0];
  const runDiffSummary = runEvalMutation.data?.baselineComparison?.diffSummary;
  const showPreRunGuidance = !runEvalMutation.data && !runEvalMutation.isError && !runEvalMutation.isPending;
  const hasRunItems = (runEvalMutation.data?.items.length ?? 0) > 0;
  const resultNextAction = getReportCenterResultNextAction({
    locale,
    hasRunDiffSummary: runDiffSummary != null,
    hasWeakestItems: regressionDrilldownItems.length > 0,
    hasRunItems
  });
  const runItemsByKey = useMemo(
    () => new Map(deferredRunItems.map(item => [getEvalItemKey(item.index, item.question), item])),
    [deferredRunItems]
  );
  const priorityReplayItem = firstRegressionDrilldownItem
    ? runItemsByKey.get(getEvalItemKey(firstRegressionDrilldownItem.index, firstRegressionDrilldownItem.question)) ?? null
    : null;
  const topPriorityReviewItems = useMemo(
    () =>
      regressionDrilldownItems.slice(0, 3).map(item => ({
        item,
        runItem: runItemsByKey.get(getEvalItemKey(item.index, item.question)) ?? null
      })),
    [regressionDrilldownItems, runItemsByKey]
  );
  const reviewStateStorageKey = runEvalMutation.data
    ? buildReviewStateStorageKey({
        questionSetId: runEvalMutation.data.questionSetId,
        assistantId: runEvalMutation.data.assistantId,
        startedAt: runEvalMutation.data.startedAt
      })
    : null;
  const reviewedItemKeySet = useMemo(() => new Set(deferredReviewedItemKeys), [deferredReviewedItemKeys]);
  const topPriorityReviewedCount = topPriorityReviewItems.filter(({ item }) => reviewedItemKeySet.has(getEvalItemKey(item.index, item.question))).length;
  const reviewedRunItemCount = deferredRunItems.filter(item => reviewedItemKeySet.has(getEvalItemKey(item.index, item.question))).length;
  const prioritizedItemKeySet = useMemo(
    () => new Set(topPriorityReviewItems.map(({ item }) => getEvalItemKey(item.index, item.question))),
    [topPriorityReviewItems]
  );
  const reviewConclusionCount = Object.keys(reviewConclusions).length;
  const reviewConclusionSummary = useMemo(() => {
    const counts = new Map<ReviewConclusion, number>();
    for (const conclusion of Object.values(reviewConclusions)) {
      counts.set(conclusion, (counts.get(conclusion) ?? 0) + 1);
    }
    return Array.from(counts.entries()).map(([conclusion, count]) => ({ conclusion, count }));
  }, [reviewConclusions]);
  const conclusionGuidance = useMemo(
    () => getConclusionGuidance({ conclusionSummary: reviewConclusionSummary, locale }),
    [locale, reviewConclusionSummary]
  );
  const conclusionPathGuidance = useMemo(
    () => (conclusionGuidance ? getConclusionPathGuidance(conclusionGuidance.conclusion, locale) : null),
    [conclusionGuidance, locale]
  );
  const pendingReviewCount = deferredRunItems.filter(item => !reviewedItemKeySet.has(getEvalItemKey(item.index, item.question))).length;
  const firstPendingImprovementItem = useMemo(() => {
    if (!conclusionGuidance || deferredRunItems.length === 0) {
      return null;
    }

    return deferredRunItems.find(item => {
      const itemKey = getEvalItemKey(item.index, item.question);
      return !reviewedItemKeySet.has(itemKey) && deferredReviewConclusions[itemKey] === conclusionGuidance.conclusion;
    }) ?? null;
  }, [conclusionGuidance, deferredRunItems, deferredReviewConclusions, reviewedItemKeySet]);

  const applyImprovementFocusQueue = () => {
    if (!conclusionGuidance) {
      return;
    }

    setFilterReviewState("pending");
    setFilterConclusion(conclusionGuidance.conclusion);
  };

  useEffect(() => {
    if (!reviewStateStorageKey || typeof window === "undefined") {
      setReviewedItemKeys([]);
      return;
    }

    try {
      const raw = window.localStorage.getItem(reviewStateStorageKey);
        if (!raw) {
          setReviewedItemKeys([]);
          setReviewConclusions({});
          setReviewNote("");
          setReviewUpdatedAt(null);
          return;
        }

      const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setReviewedItemKeys(parsed.filter((item): item is string => typeof item === "string"));
          setReviewConclusions({});
          setReviewNote("");
          setReviewUpdatedAt(null);
          return;
        }

      const nextReviewedItemKeys = Array.isArray(parsed?.reviewedItemKeys)
        ? parsed.reviewedItemKeys.filter((item: unknown): item is string => typeof item === "string")
        : [];
      const nextReviewConclusions =
        typeof parsed?.reviewConclusions === "object" && parsed.reviewConclusions !== null
          ? Object.fromEntries(
              Object.entries(parsed.reviewConclusions).filter(
                (entry): entry is [string, ReviewConclusion] =>
                  typeof entry[0] === "string" &&
                  (entry[1] === "retrieval" || entry[1] === "citation" || entry[1] === "answer" || entry[1] === "skip")
              )
            )
          : {};
      const nextReviewNote = typeof parsed?.reviewNote === "string" ? parsed.reviewNote : "";
      const nextReviewUpdatedAt = typeof parsed?.reviewUpdatedAt === "string" ? parsed.reviewUpdatedAt : null;

      setReviewedItemKeys(nextReviewedItemKeys);
      setReviewConclusions(nextReviewConclusions);
      setReviewNote(nextReviewNote);
      setReviewUpdatedAt(nextReviewUpdatedAt);
    } catch {
      setReviewedItemKeys([]);
      setReviewConclusions({});
      setReviewNote("");
      setReviewUpdatedAt(null);
    }
  }, [reviewStateStorageKey]);

  useEffect(() => {
    setShowPriorityOnly(topPriorityReviewItems.length > 0);
  }, [runEvalMutation.data?.startedAt, topPriorityReviewItems.length]);

  useEffect(() => {
    if (!reviewStateStorageKey || typeof window === "undefined") {
      return;
    }

    writeStorageItem(
      window.localStorage,
      reviewStateStorageKey,
      JSON.stringify({
        reviewedItemKeys,
        reviewConclusions,
        reviewNote,
        reviewUpdatedAt
      })
    );
  }, [reviewConclusions, reviewNote, reviewStateStorageKey, reviewUpdatedAt, reviewedItemKeys]);

  // 质量分布图表数据
  const qualityDistributionData = useMemo(() => {
    if (!runEvalMutation.data) {
      return [];
    }
    return qualitySummaryRows.map((row, index) => ({
      name: row.quality,
      value: row.count,
      color: COLORS[index % COLORS.length]
    }));
  }, [qualitySummaryRows, runEvalMutation.data]);

  // 雷达图数据
  const radarData = useMemo(() => {
    if (!runEvalMutation.data?.summary) {
      return [];
    }
    const summary = runEvalMutation.data.summary;
    return [
      {
        subject: locale === "zh" ? "成功率" : "Success Rate",
        A: summary.successRate * 100,
        fullMark: 100
      },
      {
        subject: locale === "zh" ? "Grounded" : "Grounded",
        A: summary.groundedRate * 100,
        fullMark: 100
      },
      {
        subject: locale === "zh" ? "Strong" : "Strong",
        A: summary.strongRate * 100,
        fullMark: 100
      },
      {
        subject: locale === "zh" ? "Fallback" : "Fallback",
        A: summary.fallbackRate * 100,
        fullMark: 100
      },
      {
        subject: locale === "zh" ? "平均引用" : "Avg Citations",
        A: summary.averageCitationCount * 20, // 归一化到 0-100
        fullMark: 100
      }
    ];
  }, [locale, runEvalMutation.data?.summary]);

  // 答案状态分布
  const answerStatusDistribution = useMemo(() => {
    if (!runEvalMutation.data?.items) {
      return [];
    }
    const counts = new Map<string, number>();
    for (const item of runEvalMutation.data.items) {
      const status = item.answerStatus ?? (locale === "zh" ? "未标注" : "unlabeled");
      counts.set(status, (counts.get(status) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count);
  }, [locale, runEvalMutation.data?.items]);

  // 错误类型分布
  const errorTypeDistribution = useMemo(() => {
    if (!runEvalMutation.data?.items) {
      return [];
    }
    const counts = new Map<string, number>();
    for (const item of runEvalMutation.data.items) {
      if (item.error?.code) {
        counts.set(item.error.code, (counts.get(item.error.code) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => b.count - a.count);
  }, [runEvalMutation.data?.items]);

  // 质量门控信息
  const qualityGate = runEvalMutation.data?.qualityGate;
  const qualityGatePresentation = qualityGate ? getQualityGateStatusPresentation(qualityGate.status, locale) : null;
  const topBreachedMetric = qualityGate?.breachedMetrics?.[0] ?? null;
  const optimizationSuggestion = useMemo(
    () =>
      conclusionGuidance
        ? getOptimizationSuggestion({
            conclusion: conclusionGuidance.conclusion,
            topBreachedMetric: topBreachedMetric
              ? { metric: topBreachedMetric.metric, limitType: topBreachedMetric.limitType }
              : null,
            locale
          })
        : null,
    [conclusionGuidance, locale, topBreachedMetric]
  );
  const recheckSuggestion = useMemo(
    () =>
      conclusionGuidance
        ? getRecheckSuggestion({
            conclusion: conclusionGuidance.conclusion,
            topBreachedMetric: topBreachedMetric
              ? { metric: topBreachedMetric.metric, limitType: topBreachedMetric.limitType }
              : null,
            locale
          })
        : null,
    [conclusionGuidance, locale, topBreachedMetric]
  );
  const localReviewSummary = useMemo(
    () =>
      runEvalMutation.data
        ? buildLocalReviewSummary({
            locale,
            questionSetId: runEvalMutation.data.questionSetId,
            assistantId: runEvalMutation.data.assistantId,
            reviewedRunItemCount,
            totalRunItemCount: runEvalMutation.data.items.length,
            reviewConclusionSummary,
            conclusionGuidance,
            optimizationSuggestion,
            recheckSuggestion,
            reviewNote,
            reviewUpdatedAt,
            formatDateTime
          })
        : "",
    [
      conclusionGuidance,
      formatDateTime,
      locale,
      optimizationSuggestion,
      recheckSuggestion,
      reviewConclusionSummary,
      reviewNote,
      reviewUpdatedAt,
      reviewedRunItemCount,
      runEvalMutation.data
    ]
  );
  const preRunContextPreview = buildEvalRunCarryThroughPreview({
    questionSetId,
    assistantId,
    baselineSnapshotId
  });
  const reportReturnHref = useMemo(() => {
    const query = searchParams.toString();
    return query ? `/reports?${query}` : "/reports";
  }, [searchParams]);
  const normalizedPreRunParams = preRunContextPreview.normalizedParams;
  const selectedAssistantLabel =
    assistantOptions.find(option => option.value === assistantId)?.label ??
    (assistantId.trim().length > 0 ? assistantId.trim() : locale === "zh" ? "尚未选择" : "Not selected");
  const selectedQuestionSetLabel =
    selectedQuestionSet != null
      ? `${selectedQuestionSet.name} (${selectedQuestionSet.id})`
      : normalizedPreRunParams?.questionSetId ??
        (locale === "zh" ? "尚未选择题集" : "Question set not selected");
  const selectedBaselineSnapshotLabel =
    selectedBaselineSnapshot != null
      ? `v${selectedBaselineSnapshot.version} - ${selectedBaselineSnapshot.name} (${selectedBaselineSnapshot.id})`
      : normalizedPreRunParams?.baselineSnapshotId
        ? normalizedPreRunParams.baselineSnapshotId
        : locale === "zh"
          ? "尚未生成基线快照"
          : "Baseline not ready yet";
  const selectedQuestionSetSummaryRows = selectedQuestionSet
    ? [
        {
          key: "questions",
          label: locale === "zh" ? "题目数" : "Questions",
          value: locale === "zh" ? `${selectedQuestionSet.questionCount} 道` : `${selectedQuestionSet.questionCount}`
        },
        {
          key: "baseline-version",
          label: locale === "zh" ? "Baseline 版本" : "Baseline version",
          value:
            selectedQuestionSet.baselineVersion != null
              ? `v${selectedQuestionSet.baselineVersion}`
              : locale === "zh"
                ? "尚未绑定"
                : "Not selected"
        },
        {
          key: "last-run",
          label: locale === "zh" ? "最近运行" : "Last run",
          value:
            selectedQuestionSet.latestEvalRanAt != null
              ? formatDateTime(selectedQuestionSet.latestEvalRanAt)
              : locale === "zh"
                ? "还没有运行记录"
                : "No runs yet"
        }
      ]
    : [];
  const preRunContextRows = [
    {
      key: "question-set",
      label: locale === "zh" ? "题集" : "Question set",
      value: selectedQuestionSetLabel,
      legacyValue:
        normalizedPreRunParams?.questionSetId ??
        (locale === "zh" ? "尚未填写（运行前会去除前后空格）" : "Not set (trimmed before run)")
    },
    {
      key: "assistant",
      label: locale === "zh" ? "助手" : "Assistant",
      value: selectedAssistantLabel
    },
    {
      key: "baseline",
      label: locale === "zh" ? "基线快照" : "Baseline snapshot",
      value: selectedBaselineSnapshotLabel,
      legacyValue:
        normalizedPreRunParams?.baselineSnapshotId
          ? normalizedPreRunParams.baselineSnapshotId
          : locale === "zh"
            ? "尚未生成"
            : "Not ready yet"
    },
    {
      key: "carry-through",
      label: locale === "zh" ? "URL 预填参数" : "URL carry-through",
      value:
        preRunContextPreview.searchParams?.toString() ??
        (locale === "zh"
          ? "待补齐 question set 与 assistant 后写入 URL"
          : "Fill question set and assistant to carry through in URL")
    }
  ];
  const preRunGuideSteps = [
    {
      key: "question-set",
      title: locale === "zh" ? "准备题集" : "Prepare question set",
      detail:
        selectedQuestionSet != null
          ? locale === "zh"
            ? "题集已选中，可以直接复用。"
            : "A question set is selected and ready to reuse."
          : locale === "zh"
            ? "先选择已有题集，或者在右侧新建一组。"
            : "Select an existing set or create one on the right first.",
      done: selectedQuestionSet != null
    },
    {
      key: "baseline",
      title: locale === "zh" ? "生成 baseline" : "Generate baseline",
      detail:
        hasSelectedBaseline
          ? locale === "zh"
            ? "当前题集已经绑定 baseline。"
            : "This question set already has a baseline selected."
          : locale === "zh"
            ? "新题集第一次运行前，要先生成 baseline。"
            : "For a new set, generate a baseline before the first run.",
      done: hasSelectedBaseline
    },
    {
      key: "assistant",
      title: locale === "zh" ? "选择 assistant" : "Choose assistant",
      detail:
        assistantId.trim().length > 0
          ? locale === "zh"
            ? "Assistant 已选好，可以执行检查。"
            : "An assistant is selected and ready to run."
          : locale === "zh"
            ? "最后再选 assistant，然后执行质量检查。"
            : "Choose the assistant last, then run the quality check.",
      done: assistantId.trim().length > 0
    }
  ] as const;
  const preRunPrimaryTip =
    selectedQuestionSet == null
      ? locale === "zh"
        ? "先完成第 1 步：从“已有题集”里选一组，或者在右侧直接新建题集。"
        : "Start with step 1: select an existing question set or create one on the right."
      : !hasSelectedBaseline
        ? locale === "zh"
          ? "当前最关键的是先生成 baseline；没有 baseline 时，这页不会允许执行 quality check。"
          : "The next required action is to generate a baseline. Without it, this page will not let you run the quality check."
        : assistantId.trim().length === 0
          ? locale === "zh"
            ? "题集和 baseline 都已经准备好了，现在只需要选择 assistant 就能运行。"
            : "The question set and baseline are ready. Choose the assistant and you can run immediately."
          : locale === "zh"
            ? "准备已经完成，可以直接点击“Run quality check”。"
            : "Preparation is complete. You can click Run quality check now.";
  const canRunQualityCheck =
    questionSetId.trim().length > 0 && assistantId.trim().length > 0 && hasSelectedBaseline;







  async function onRunEvalSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const evalRunParams = normalizeEvalRunParams({
      questionSetId,
      assistantId,
      baselineSnapshotId
    });
    if (!evalRunParams) {
      return;
    }

    const nextSearchParams = mergeSearchParamsWithEvalRunParams(searchParams, evalRunParams);
    setSearchParams(nextSearchParams, { replace: true });
    startRunTransition(() => {
      void runEvalMutation.mutateAsync(evalRunParams);
    });
  }

  const [exporting, setExporting] = useState<string | null>(null);

  async function downloadReport(format: "markdown" | "json" | "html") {
    const report = runEvalMutation.data?.reportExports?.[format];
    if (!report) {
      return;
    }

    try {
      setExporting(format);
      const blob = new Blob([report.content], {
        type: report.mimeType
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = report.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading report:", error);
    } finally {
      setExporting(null);
    }
  }

  async function copyLocalReviewSummary() {
    if (!localReviewSummary || typeof navigator === "undefined" || !navigator.clipboard) {
      return;
    }

    try {
      await navigator.clipboard.writeText(localReviewSummary);
      notifications.show({
        color: "teal",
        message: locale === "zh" ? "本地复盘摘要已复制" : "Local review summary copied"
      });
    } catch (error) {
      notifications.show({
        color: "red",
        message: error instanceof Error ? error.message : locale === "zh" ? "复制失败" : "Copy failed"
      });
    }
  }

  async function downloadLocalReviewSummary() {
    if (!localReviewSummary || !runEvalMutation.data) {
      return;
    }

    try {
      const blob = new Blob([localReviewSummary], {
        type: "text/markdown;charset=utf-8"
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `review-summary-${runEvalMutation.data.questionSetId}-${runEvalMutation.data.startedAt}.md`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      notifications.show({
        color: "red",
        message: error instanceof Error ? error.message : locale === "zh" ? "导出失败" : "Export failed"
      });
    }
  }

  // 表格排序处理函数
  function requestSort(key: string) {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  }

  function focusRunItem(index: number, question: string) {
    const nextKey = getEvalItemKey(index, question);
    setShowPriorityOnly(false);
    setFilterStatus("");
    setFilterQuality("");
    setFilterReviewState("");
    setFilterConclusion("");
    setFocusedItemKey(nextKey);

    requestAnimationFrame(() => {
      itemRowRefs.current[nextKey]?.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });
    });
  }

  async function onCreateQuestionSetSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = draftQuestionSetName.trim();
    const trimmedDescription = draftQuestionSetDescription.trim();
    const questions = draftQuestionItems;

    if (!trimmedName || questions.length === 0) {
      notifications.show({
        color: "red",
        message:
          locale === "zh"
            ? "请至少填写题集名称，并提供一条以上问题。"
            : "Please add a question set name and at least one question.",
        title: locale === "zh" ? "还不能创建题集" : "Question set is not ready"
      });
      return;
    }

    try {
      const created = await createQuestionSetMutation.mutateAsync({
        name: trimmedName,
        ...(trimmedDescription ? { description: trimmedDescription } : {}),
        questions
      });

      setQuestionSetId(created.id);
      setBaselineSnapshotId(created.baselineSnapshotId ?? "");
      setDraftQuestionSetName("");
      setDraftQuestionSetDescription("");
      setDraftQuestionLines("");

      notifications.show({
        color: "teal",
        message:
          locale === "zh"
            ? "题集已创建并自动选中，接下来可以直接生成 baseline。"
            : "Question set created and selected. You can generate a baseline next.",
        title: locale === "zh" ? "题集创建成功" : "Question set created"
      });
    } catch (error) {
      notifications.show({
        color: "red",
        message: error instanceof Error ? error.message : locale === "zh" ? "创建题集失败。" : "Failed to create question set.",
        title: locale === "zh" ? "创建失败" : "Creation failed"
      });
    }
  }

  async function onCreateBaselineClick() {
    if (!questionSetId) {
      return;
    }

    try {
      const snapshot = await snapshotBaselineMutation.mutateAsync(questionSetId);
      await chooseBaselineMutation.mutateAsync({
        questionSetId,
        snapshotId: snapshot.id
      });
      setBaselineSnapshotId(snapshot.id);

      notifications.show({
        color: "teal",
        message:
          locale === "zh"
            ? "已为当前题集生成并选中 baseline。"
            : "Created and selected a baseline for the current question set.",
        title: locale === "zh" ? "Baseline 已就绪" : "Baseline ready"
      });
    } catch (error) {
      notifications.show({
        color: "red",
        message:
          error instanceof Error
            ? error.message
            : locale === "zh"
              ? "生成 baseline 失败。"
              : "Failed to generate a baseline.",
        title: locale === "zh" ? "Baseline 生成失败" : "Baseline creation failed"
      });
    }
  }

  function toggleReviewedItem(index: number, question: string) {
    const nextKey = getEvalItemKey(index, question);
    setReviewedItemKeys(current =>
      current.includes(nextKey) ? current.filter(item => item !== nextKey) : [...current, nextKey]
    );
  }

  function updateReviewNote(value: string) {
    setReviewNote(value);
    setReviewUpdatedAt(new Date().toISOString());
  }

  function updateReviewConclusion(index: number, question: string, conclusion: ReviewConclusion | null) {
    const nextKey = getEvalItemKey(index, question);

    setReviewConclusions(current => {
      if (!conclusion) {
        const next = { ...current };
        delete next[nextKey];
        return next;
      }

      return {
        ...current,
        [nextKey]: conclusion
      };
    });

    if (conclusion) {
      setReviewedItemKeys(current => (current.includes(nextKey) ? current : [...current, nextKey]));
    }
  }

  // 排序后的表格数据
  const sortedAndFilteredItems = useMemo(() => {
    if (!runEvalMutation.data?.items) {
      return [];
    }

    const filteredItems = runEvalMutation.data.items.filter(item => {
      const matchesStatus = !filterStatus || item.status === filterStatus;
      const matchesQuality = !filterQuality || item.qualityOverall === filterQuality;
      const itemKey = getEvalItemKey(item.index, item.question);
      const isReviewed = reviewedItemKeySet.has(itemKey);
      const itemConclusion = reviewConclusions[itemKey] ?? null;
      const matchesReviewState =
        !filterReviewState || (filterReviewState === "reviewed" ? isReviewed : !isReviewed);
      const matchesConclusion = !filterConclusion || itemConclusion === filterConclusion;
      return matchesStatus && matchesQuality && matchesReviewState && matchesConclusion;
    });

    if (sortConfig) {
      filteredItems.sort((a, b) => {
        const aValue = a[sortConfig.key as keyof typeof a];
        const bValue = b[sortConfig.key as keyof typeof b];

        // 处理空值情况
        if (aValue === null || aValue === undefined) return 1;
        if (bValue === null || bValue === undefined) return -1;

        if (aValue < bValue) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }

    return filteredItems;
  }, [runEvalMutation.data?.items, sortConfig, filterStatus, filterQuality, filterReviewState, filterConclusion, reviewedItemKeySet, reviewConclusions]);
  const displayedResults = useMemo(
    () => (showPriorityOnly ? sortedAndFilteredItems.filter(item => prioritizedItemKeySet.has(getEvalItemKey(item.index, item.question))) : sortedAndFilteredItems),
    [showPriorityOnly, sortedAndFilteredItems, prioritizedItemKeySet]
  );

  // 获取唯一的状态和质量值用于筛选
  const statusOptions = useMemo(() => {
    if (!runEvalMutation.data?.items) {
      return [];
    }
    return Array.from(new Set(runEvalMutation.data.items.map(item => item.status)));
  }, [runEvalMutation.data?.items]);

  const qualityOptions = useMemo(() => {
    if (!runEvalMutation.data?.items) {
      return [];
    }
    return Array.from(new Set(runEvalMutation.data.items.map(item => item.qualityOverall).filter((item): item is string => item !== undefined && item !== null)));
  }, [runEvalMutation.data?.items]);

  return (
    <div className="flex flex-col gap-6" data-testid="report-center-page">
      <Paper className="workspace-hero" p="lg" radius="xl">
        <div className="workspace-hero-split">
          <div className="workspace-hero-copy">
            <Link className="workspace-link text-sm" to="/workbench">
              {locale === "zh" ? "返回工作台概览" : "Back to workbench overview"}
            </Link>
            <div className="workspace-hero-kicker">{locale === "zh" ? "管理工作台" : "Workbench"}</div>
            <h1 className="mt-1 font-['Space_Grotesk'] text-3xl font-semibold tracking-[-0.03em] text-[var(--app-text)]">
              {locale === "zh" ? "质量报告" : "Quality reports"}
            </h1>
            <p className="mt-2 text-sm text-[var(--app-text-muted)]">
              {locale === "zh"
                ? "这是从工作台概览进入的质量页，把质量检查、回归差异和导出能力收在一起。"
                : "This quality page is entered from the workbench overview so checks, regression diffs, and exports stay in one place."}
            </p>
          </div>
          <Badge color={evalRunStatusColor} radius="sm" variant="light" size="lg">
            {evalRunStatusLabel}
          </Badge>
        </div>
      </Paper>

      <Paper className="workspace-panel-hover workspace-panel-strong" p="lg" radius="xl">
        <Stack gap="md">
          <Paper className="workspace-subpanel" p="md" radius="xl">
            <div className="grid gap-3 md:grid-cols-3">
              {reportWorkflowSteps.map((step, index) => {
                const isCompleted = step.state === "completed";
                const isCurrent = step.state === "current";

                return (
                  <div
                    className={
                      "rounded-2xl border p-4 " +
                      (isCompleted
                        ? "border-emerald-500/40 bg-emerald-500/10"
                        : isCurrent
                          ? "border-indigo-500/40 bg-indigo-500/10"
                          : "border-white/10 bg-white/5")
                    }
                    key={step.key}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={
                          "flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold " +
                          (isCompleted
                            ? "bg-emerald-500 text-white"
                            : isCurrent
                              ? "bg-indigo-500 text-white"
                              : "bg-white/10 text-[var(--app-text-muted)]")
                        }
                      >
                        {index + 1}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-[var(--app-text)]">{step.title}</div>
                        <div className="text-xs text-[var(--app-text-muted)]">{step.detail}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Paper>

            <div>
              <div className="workspace-section-heading">{locale === "zh" ? "运行质量检查" : "Run quality check"}</div>
              <p className="mt-2 text-sm text-[var(--app-text-muted)]">
                {locale === "zh"
                  ? "用一组固定输入触发一次质量检查，便于后续对比结果、回归差异和弱项。"
                  : "Run one check with fixed inputs so the page can compare summary results, regressions, and weakest items consistently."}
              </p>
            </div>

          <Paper className="workspace-subpanel" p="md" radius="xl">
            <Stack gap="md">
              <div>
                <Text className="workspace-section-heading">
                  {locale === "zh" ? "第一步：准备题集和 baseline" : "Step 1: prepare a question set and baseline"}
                </Text>
                <Text c="var(--app-text-muted)" size="sm">
                  {locale === "zh"
                    ? "第一次使用时，先准备一组稳定问题，再为这组问题生成 baseline。后面的质量检查和回归对比都会基于它。"
                    : "For a first run, prepare a stable question set and generate its baseline first. The later quality checks and regression diffs will build on it."}
                </Text>
              </div>

              <form className="grid gap-3 md:grid-cols-2" onSubmit={onCreateQuestionSetSubmit}>
                <Paper className="workspace-subpanel" p="md" radius="lg">
                  <Stack gap="sm">
                    <div className="flex items-center justify-between gap-2">
                      <Text c="var(--app-text)" fw={700} size="sm">
                        {locale === "zh" ? "复用已有题集" : "Reuse an existing set"}
                      </Text>
                      <Badge color="gray" variant="light">
                        {questionSetOptions.length > 0
                          ? locale === "zh"
                            ? `${questionSetOptions.length} 组可用`
                            : `${questionSetOptions.length} available`
                          : locale === "zh"
                            ? "还没有题集"
                            : "No sets yet"}
                      </Badge>
                    </div>
                    <Select
                      data={questionSetOptions}
                      description={
                        locale === "zh"
                          ? "已有题集时，直接从这里切换。"
                          : "Switch here when you already have question sets."
                      }
                      label={locale === "zh" ? "已有题集" : "Existing question sets"}
                      nothingFoundMessage={
                        questionSetsQuery.isLoading
                          ? locale === "zh"
                            ? "正在加载题集..."
                            : "Loading question sets..."
                          : locale === "zh"
                            ? "还没有题集，先在右侧创建一组"
                            : "No question sets yet. Create one on the right."
                      }
                      onChange={value => {
                        setQuestionSetId(value ?? "");
                        setBaselineSnapshotId("");
                      }}
                      placeholder={locale === "zh" ? "从现有题集中选择" : "Select an existing question set"}
                      searchable
                      value={questionSetId || null}
                    />
                    <Paper className="workspace-subpanel" p="sm" radius="lg">
                      <Stack gap={6}>
                        <Text c="var(--app-text-muted)" size="xs">
                          {locale === "zh" ? "当前已选题集" : "Selected question set"}
                        </Text>
                        <Text fw={600} size="sm">
                          {selectedQuestionSetLabel}
                        </Text>
                        <div className="grid gap-2 md:grid-cols-3">
                          {selectedQuestionSetSummaryRows.length > 0 ? (
                            selectedQuestionSetSummaryRows.map(row => (
                              <div className="workspace-meta-row" key={row.key}>
                                <span className="workspace-meta-label">{row.label}</span>
                                <span className="workspace-meta-value">{row.value}</span>
                              </div>
                            ))
                          ) : (
                            <div className="workspace-meta-row">
                              <span className="workspace-meta-label">{locale === "zh" ? "状态" : "Status"}</span>
                              <span className="workspace-meta-value">
                                {locale === "zh" ? "还没有选中题集" : "No question set selected yet"}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="workspace-meta-row">
                          <span className="workspace-meta-label">{locale === "zh" ? "当前基线快照" : "Current baseline"}</span>
                          <span className="workspace-meta-value">{selectedBaselineSnapshotLabel}</span>
                        </div>
                      </Stack>
                    </Paper>
                  </Stack>
                </Paper>
                <Paper className="workspace-subpanel" p="md" radius="lg">
                  <Stack gap="sm">
                    <div className="flex items-center justify-between gap-2">
                      <Text c="var(--app-text)" fw={700} size="sm">
                        {locale === "zh" ? "新建题集" : "Create a new set"}
                      </Text>
                      <Badge color="indigo" variant="light">
                        {locale === "zh" ? "一行一题" : "One question per line"}
                      </Badge>
                    </div>
                    <Textarea
                      autosize
                      description={
                        locale === "zh"
                          ? "建议用能看出真实问答质量的一组稳定问题，一行一题。"
                          : "Use a stable set of questions that reflects real answer quality, one question per line."
                      }
                      label={locale === "zh" ? "新题集问题" : "Questions for a new set"}
                      minRows={4}
                      maxRows={8}
                      onChange={event => setDraftQuestionLines(event.currentTarget.value)}
                      placeholder={locale === "zh" ? "问题 1\n问题 2\n问题 3" : "Question 1\nQuestion 2\nQuestion 3"}
                      value={draftQuestionLines}
                    />
                    <Stack gap="sm">
                  <Textarea
                    autosize
                    description={
                      locale === "zh"
                        ? "起一个容易识别的名字，方便以后直接选中。"
                        : "Choose a clear name so this set is easy to identify later."
                    }
                    label={locale === "zh" ? "题集名称" : "Question set name"}
                    minRows={1}
                    onChange={event => setDraftQuestionSetName(event.currentTarget.value)}
                    placeholder={locale === "zh" ? "例如：回归 smoke 集" : "Example: Regression smoke set"}
                    value={draftQuestionSetName}
                  />
                  <Textarea
                    autosize
                    description={
                      locale === "zh"
                        ? "补一句用途说明，后续更容易区分不同题集。"
                        : "Add a short description so different question sets stay easy to distinguish."
                    }
                    label={locale === "zh" ? "题集说明" : "Question set description"}
                    minRows={2}
                    onChange={event => setDraftQuestionSetDescription(event.currentTarget.value)}
                    placeholder={
                      locale === "zh"
                        ? "用于 assistant 配置改动后的日常回归检查"
                        : "Used for day-to-day regression checks after assistant changes"
                    }
                    value={draftQuestionSetDescription}
                  />
                  <Text c="var(--app-text-muted)" size="xs">
                    {locale === "zh"
                      ? `当前已整理 ${draftQuestionItems.length} 道题，创建后会自动选中这组题集。`
                      : `${draftQuestionItems.length} questions prepared. The new question set will be selected automatically.`}
                  </Text>
                  <Button
                    className="workspace-button"
                    color="teal"
                    loading={createQuestionSetMutation.isPending}
                    radius="xl"
                    type="submit"
                    variant="light"
                  >
                    {locale === "zh" ? "创建题集并自动选中" : "Create and select question set"}
                  </Button>
                  <Button
                    className="workspace-button"
                    color={hasSelectedBaseline ? "teal" : "indigo"}
                    disabled={!questionSetId}
                    loading={snapshotBaselineMutation.isPending || chooseBaselineMutation.isPending}
                    onClick={onCreateBaselineClick}
                    radius="xl"
                    type="button"
                    variant={hasSelectedBaseline ? "subtle" : "filled"}
                  >
                    {hasSelectedBaseline
                      ? locale === "zh"
                        ? "重新生成基线快照"
                        : "Regenerate baseline"
                      : locale === "zh"
                        ? "先生成基线快照"
                        : "Generate baseline first"}
                  </Button>
                  <Text c="var(--app-text-muted)" size="xs">
                    {hasSelectedBaseline
                      ? locale === "zh"
                        ? "基线快照已经就绪，下面再选助手并开始这轮质量检查。"
                        : "The baseline is ready. Continue below to choose the assistant and start the quality check."
                      : locale === "zh"
                        ? "这里是当前最重要的一步。先生成基线快照，下面的正式运行才会开放。"
                        : "This is the current blocking step. Generate the baseline first to unlock the formal run below."}
                  </Text>
                    </Stack>
                  </Stack>
                </Paper>
              </form>
            </Stack>
          </Paper>

          <div>
            <div className="workspace-section-heading">{locale === "zh" ? "第二步：运行质量检查" : "Step 2: run the quality check"}</div>
            <p className="mt-2 text-sm text-[var(--app-text-muted)]">
              {locale === "zh"
                ? "题集和 baseline 就绪后，再选择本次要验证的 assistant，触发一轮正式检查。"
                : "Once the question set and baseline are ready, choose the assistant you want to validate and trigger a formal check."}
            </p>
          </div>

          <Paper className="workspace-subpanel" p="md" radius="xl">
            <Stack gap="sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge color={selectedQuestionSet ? "teal" : "gray"} variant="light">
                  {selectedQuestionSet ? (locale === "zh" ? "题集已就绪" : "Question set ready") : locale === "zh" ? "还没选题集" : "Question set missing"}
                </Badge>
                <Badge color={hasSelectedBaseline ? "teal" : "gray"} variant="light">
                  {hasSelectedBaseline ? (locale === "zh" ? "基线快照已就绪" : "Baseline ready") : locale === "zh" ? "还没生成 baseline" : "Baseline missing"}
                </Badge>
                <Badge color={assistantId ? "teal" : "gray"} variant="light">
                  {assistantId ? (locale === "zh" ? "助手已选好" : "Assistant ready") : locale === "zh" ? "还没选助手" : "Assistant missing"}
                </Badge>
              </div>
              <Text c="var(--app-text-muted)" size="sm">
                {selectedQuestionSet && hasSelectedBaseline && assistantId
                  ? locale === "zh"
                    ? "现在已经可以直接开始这轮质量检查。"
                    : "Everything is ready. You can start this quality check now."
                  : locale === "zh"
                    ? "先把这三项补齐，再执行正式检查。"
                    : "Complete these three items first, then run the formal quality check."}
              </Text>
            </Stack>
          </Paper>

          <form className="grid gap-4 md:grid-cols-3" onSubmit={onRunEvalSubmit}>
            <Select
              label={locale === "zh" ? "题集" : "Question set"}
              description={
                locale === "zh"
                  ? "先选一组题集，系统会基于这组固定问题来跑质量检查。"
                  : "Pick a question set first. The report runs against that fixed set of questions."
              }
              disabled={questionSetsQuery.isLoading}
              nothingFoundMessage={
                questionSetsQuery.isLoading
                  ? locale === "zh"
                    ? "正在加载题集..."
                    : "Loading question sets..."
                  : locale === "zh"
                    ? "当前还没有可用题集"
                    : "No question sets yet"
              }
              onChange={value => {
                setQuestionSetId(value ?? "");
                setBaselineSnapshotId("");
              }}
              data={questionSetOptions}
              placeholder={locale === "zh" ? "例如：set-1" : "e.g. set-1"}
              required
              searchable
              value={questionSetId || null}
              size="md"
            />
            <Select
              data={assistantOptions}
              description={
                locale === "zh"
                  ? "选择这次要验证的 assistant 配置。"
                  : "Choose the assistant configuration you want to validate."
              }
              label={locale === "zh" ? "助手" : "Assistant"}
              onChange={value => setAssistantId(value ?? "")}
              placeholder={locale === "zh" ? "选择 assistant" : "Select assistant"}
              searchable
              value={assistantId || null}
              size="md"
            />
            <Select
              label={
                locale === "zh"
                  ? "基线快照（首次运行前请先生成）"
                  : "Baseline snapshot (generate one before the first run)"
              }
              clearable
              data={baselineSnapshotOptions}
              description={
                locale === "zh"
                  ? "用来做回归对比的 baseline。通常会自动带出该题集当前选中的 baseline。"
                  : "Used for regression comparison. For a new question set, generate one first; it will then be auto-filled when available."
              }
              disabled={!questionSetId || baselineSnapshotsQuery.isLoading}
              nothingFoundMessage={
                !questionSetId
                  ? locale === "zh"
                    ? "请先选择题集"
                    : "Select a question set first"
                  : baselineSnapshotsQuery.isLoading
                    ? locale === "zh"
                      ? "正在加载 baseline..."
                      : "Loading baselines..."
                    : locale === "zh"
                      ? "这个题集还没有 baseline 快照"
                      : "No baseline snapshots for this question set"
              }
              onChange={value => setBaselineSnapshotId(value ?? "")}
              placeholder={locale === "zh" ? "例如：snapshot-1" : "e.g. snapshot-1"}
              searchable
              value={baselineSnapshotId || null}
              size="md"
            />

            <div className="md:col-span-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <Text c="var(--app-text-muted)" size="xs">
                  {hasSelectedBaseline
                    ? locale === "zh"
                      ? "准备完成后，这里就是本页的主操作。"
                      : "Once preparation is complete, this becomes the main action on the page."
                    : locale === "zh"
                      ? "这一步会在基线快照准备好之后自动成为主操作。"
                      : "This becomes the main action automatically once the baseline is ready."}
                </Text>
                <Badge color={hasSelectedBaseline ? "indigo" : "gray"} variant="light">
                  {hasSelectedBaseline
                    ? locale === "zh"
                      ? "已解锁正式运行"
                      : "Formal run unlocked"
                    : locale === "zh"
                      ? "等待基线快照"
                      : "Waiting for baseline"}
                </Badge>
              </div>
              <Button
                className="workspace-button w-full"
                color={canRunQualityCheck ? "indigo" : "gray"}
                disabled={!canRunQualityCheck}
                loading={runEvalMutation.isPending || isRunPending}
                radius="xl"
                type="submit"
                variant={canRunQualityCheck ? "filled" : "light"}
                size="md"
              >
                {locale === "zh" ? "开始质量检查" : "Run quality check"}
              </Button>
              {!canRunQualityCheck ? (
                <Text c="var(--app-text-muted)" mt={8} size="xs">
                  {!questionSetId
                    ? locale === "zh"
                      ? "先在上面的第 1 步选择或创建题集。"
                      : "Choose or create a question set in Step 1 first."
                    : !hasSelectedBaseline
                      ? locale === "zh"
                        ? "先在上面的第 1 步为当前题集生成 baseline，再运行质量检查。"
                        : "Generate a baseline for the current question set in Step 1 before running the quality check."
                      : locale === "zh"
                        ? "还需要先选择助手，然后才能开始质量检查。"
                        : "Choose an assistant before starting the quality check."}
                </Text>
              ) : null}
            </div>
          </form>

          {runEvalMutation.isError ? (
            <StatePanel
              description={
                runEvalMutation.error instanceof Error
                  ? runEvalMutation.error.message
                  : locale === "zh"
                    ? "质量检查执行失败。"
                    : "Quality check failed."
               }
              title={locale === "zh" ? "质量检查失败" : "Quality check failed"}
              tone="error"
            />
          ) : null}

          {showPreRunGuidance ? (
            <Stack gap={6}>
              <div>
                <div className="workspace-section-heading">{locale === "zh" ? "第三步：看结果并继续复盘" : "Step 3: review the result and continue"}</div>
                <p className="mt-2 text-sm text-[var(--app-text-muted)]">
                  {locale === "zh"
                    ? "跑完以后先看摘要，再看 weakest items 和下一步动作。需要深入时再跳到 Trace 或 Assistant。"
                    : "After the run, start from the summary, then review weakest items and next actions. Open Trace or Assistant only when you need to go deeper."}
                </p>
              </div>
              <StatePanel
                description={
                  locale === "zh"
                    ? "先执行一次质量检查，再从质量摘要、差异摘要和弱项列表开始查看。"
                    : questionSetsQuery.data?.length
                    ? "Choose a question set and assistant, then run one check. A baseline is auto-filled when available, and then you can review the summary, diff summary, and weakest items."
                    : "There are no question sets yet, so this page cannot run a report yet. Usually you need to create a question set first and then generate a baseline snapshot."}
                title={locale === "zh" ? "先跑一次质量检查" : "Start with one quality check"}
                tone="empty"
              />
              <Paper className="workspace-subpanel" p="md" radius="xl">
                <Stack gap="sm">
                  <Text className="workspace-section-heading">
                    {locale === "zh" ? "第一次使用，先按这个顺序" : "First-time path"}
                  </Text>
                  <div className="grid gap-3 md:grid-cols-3">
                    {preRunGuideSteps.map((step, index) => (
                      <Paper className="workspace-subpanel" key={step.key} p="sm" radius="lg">
                        <Stack gap={6}>
                          <div className="flex items-center justify-between gap-2">
                            <Text c="var(--app-text)" fw={600} size="sm">
                              {locale === "zh" ? `步骤 ${index + 1}` : `Step ${index + 1}`}
                            </Text>
                            <Badge color={step.done ? "teal" : "gray"} variant="light">
                              {step.done ? (locale === "zh" ? "已就绪" : "Ready") : locale === "zh" ? "下一步" : "Next"}
                            </Badge>
                          </div>
                          <Text c="var(--app-text)" fw={600} size="sm">
                            {step.title}
                          </Text>
                          <Text c="var(--app-text-muted)" size="xs">
                            {step.detail}
                          </Text>
                        </Stack>
                      </Paper>
                    ))}
                  </div>
                  <div className="workspace-meta-row">
                    <span className="workspace-meta-label">{locale === "zh" ? "现在最该做的" : "Do this now"}</span>
                    <span className="workspace-meta-value">{preRunPrimaryTip}</span>
                  </div>
                </Stack>
              </Paper>
              <Text c="var(--app-text-muted)" data-testid="report-center-pre-run-path" size="xs">
                {locale === "zh"
                  ? "建议路径：先跑一次质量检查 → 再看摘要、差异和弱项"
                  : questionSetsQuery.data?.length
                    ? "Suggested path: select question set -> select assistant -> confirm baseline -> run first quality check -> review summary / diff / weakest items"
                    : "Setup path: create a question set -> generate a baseline snapshot -> come back here to run the quality check"}
              </Text>
              <Paper className="workspace-subpanel" p="md" radius="xl">
                <Stack gap="xs">
                  <Text className="workspace-section-heading">
                    {locale === "zh" ? "当前准备情况" : "Current check context"}
                  </Text>
                  <div className="grid gap-2 md:grid-cols-3">
                    {preRunContextRows.map(row => (
                      <div className="workspace-meta-row" key={row.key}>
                        <span className="workspace-meta-label">{row.label}</span>
                        <span className="workspace-meta-value">{row.value}</span>
                      </div>
                    ))}
                  </div>
                </Stack>
              </Paper>
            </Stack>
          ) : null}
        </Stack>
      </Paper>

      {runEvalMutation.isPending ? (
        <Paper className="workspace-panel-hover workspace-panel-strong" p="lg" radius="xl">
          <Stack gap="md" align="center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            <Text c="var(--app-text)" size="lg">
                {locale === "zh" ? "正在执行质量检查，请稍候..." : "Running quality check, please wait..."}
              </Text>
              <Text c="var(--app-text-muted)" size="sm">
                {locale === "zh" ? "系统正在处理这次质量检查，这可能需要一些时间。" : "The system is processing this quality check, which may take some time."}
              </Text>
            </Stack>
          </Paper>
      ) : runEvalMutation.data ? (
        <Stack gap="md">
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
            <Paper className="workspace-subpanel" p="md" radius="xl">
              <Text className="workspace-section-heading">{locale === "zh" ? "总题数" : "Total"}</Text>
              <Text c="var(--app-text)" fw={700} mt={6} size="xl">
                {runEvalMutation.data.summary?.total ?? runEvalMutation.data.totals.total}
              </Text>
            </Paper>
            <Paper className="workspace-subpanel" p="md" radius="xl">
              <Text className="workspace-section-heading">{locale === "zh" ? "成功率" : "Success rate"}</Text>
              <Text c="var(--app-text)" fw={700} mt={6} size="xl">
                {runEvalMutation.data.summary ? `${(runEvalMutation.data.summary.successRate * 100).toFixed(1)}%` : "-"}
              </Text>
            </Paper>
            <Paper className="workspace-subpanel" p="md" radius="xl">
              <Text className="workspace-section-heading">{locale === "zh" ? "Grounded" : "Grounded"}</Text>
              <Text c="var(--app-text)" fw={700} mt={6} size="xl">
                {runEvalMutation.data.summary ? `${(runEvalMutation.data.summary.groundedRate * 100).toFixed(1)}%` : "-"}
              </Text>
            </Paper>
            <Paper className="workspace-subpanel" p="md" radius="xl">
              <Text className="workspace-section-heading">{locale === "zh" ? "Strong" : "Strong"}</Text>
              <Text c="var(--app-text)" fw={700} mt={6} size="xl">
                {runEvalMutation.data.summary ? `${(runEvalMutation.data.summary.strongRate * 100).toFixed(1)}%` : "-"}
              </Text>
            </Paper>
            <Paper className="workspace-subpanel" p="md" radius="xl">
              <Text className="workspace-section-heading">{locale === "zh" ? "Fallback" : "Fallback"}</Text>
              <Text c="var(--app-text)" fw={700} mt={6} size="xl">
                {runEvalMutation.data.summary ? `${(runEvalMutation.data.summary.fallbackRate * 100).toFixed(1)}%` : "-"}
              </Text>
            </Paper>
            <Paper className="workspace-subpanel" p="md" radius="xl">
              <Text className="workspace-section-heading">{locale === "zh" ? "平均引用" : "Avg citations"}</Text>
              <Text c="var(--app-text)" fw={700} mt={6} size="xl">
                {runEvalMutation.data.summary ? runEvalMutation.data.summary.averageCitationCount.toFixed(2) : "-"}
              </Text>
            </Paper>
          </div>

          <Paper className="workspace-panel-hover workspace-panel-muted" p="lg" radius="xl">
            <Stack gap="sm">
              <div className="workspace-section-heading">{locale === "zh" ? "结果查看顺序" : "Result review path"}</div>
              <Text c="var(--app-text-muted)" size="sm">
                {locale === "zh"
                  ? "按 当前输入 -> 结果摘要 -> 差异 -> 弱项 -> 下一步 的顺序快速查看。"
                  : "Review in one pass: current inputs -> summary -> diff -> weakest items -> next action."}
              </Text>
              <div className="grid gap-2 md:grid-cols-2">
                <div className="workspace-meta-row">
                  <span className="workspace-meta-label">{locale === "zh" ? "本次输入" : "Current inputs"}</span>
                  <span className="workspace-meta-value">
                    {runEvalMutation.data.questionSetId} · {runEvalMutation.data.assistantId}
                  </span>
                </div>
                <div className="workspace-meta-row">
                  <span className="workspace-meta-label">{locale === "zh" ? "结果摘要" : "Summary"}</span>
                  <span className="workspace-meta-value">
                    {(runEvalMutation.data.summary?.total ?? runEvalMutation.data.totals.total).toString()} · {locale === "zh" ? "成功率" : "success"}{" "}
                    {runEvalMutation.data.summary ? `${(runEvalMutation.data.summary.successRate * 100).toFixed(1)}%` : "-"}
                  </span>
                </div>
                <div className="workspace-meta-row">
                  <span className="workspace-meta-label">{locale === "zh" ? "回归差异" : "Regression diff"}</span>
                  <span className="workspace-meta-value">
                    {runDiffSummary
                      ? `${runDiffSummary.regressedMetricCount} regressed · ${runDiffSummary.improvedMetricCount} improved`
                      : locale === "zh"
                          ? "baseline 差异暂不可读"
                          : "baseline diff unavailable"}
                  </span>
                </div>
                <div className="workspace-meta-row">
                  <span className="workspace-meta-label">{locale === "zh" ? "弱项聚焦" : "Weakest-item focus"}</span>
                  <span className="workspace-meta-value">
                    {firstRegressionDrilldownItem
                      ? `#${firstRegressionDrilldownItem.index} · ${firstRegressionDrilldownItem.severity} · ${firstRegressionDrilldownItem.reasonCodes
                          .slice(0, 2)
                          .map(code => getRegressionReasonLabel(code, locale))
                          .join("; ")}`
                      : locale === "zh"
                        ? "当前 run 未检测到题目级回归"
                        : "No per-question regressions detected"}
                  </span>
                </div>
              </div>
              <div className="workspace-meta-row">
                <span className="workspace-meta-label">{locale === "zh" ? "下一步动作" : "Next action"}</span>
                <span className="workspace-meta-value">{resultNextAction}</span>
              </div>
            </Stack>
          </Paper>

          {runEvalMutation.data?.items.length ? (
            <Paper className="workspace-panel-hover workspace-panel-muted" p="lg" radius="xl">
              <Stack gap="sm">
                <div className="workspace-section-heading">{locale === "zh" ? "复盘进度" : "Review progress"}</div>
                <Text c="var(--app-text-muted)" size="sm">
                  {locale === "zh"
                    ? "把已经看过的问题先标成“已复盘”，下次回来时可以直接接着往下处理。"
                    : "Mark items as reviewed as you go so you can continue from the same place when you come back."}
                </Text>
                <div className="grid gap-2 md:grid-cols-2">
                  <div className="workspace-meta-row">
                    <span className="workspace-meta-label">{locale === "zh" ? "Top 3 进度" : "Top 3 progress"}</span>
                    <span className="workspace-meta-value">
                      {topPriorityReviewedCount}/{topPriorityReviewItems.length || 0}
                    </span>
                  </div>
                  <div className="workspace-meta-row">
                    <span className="workspace-meta-label">{locale === "zh" ? "全表进度" : "All items progress"}</span>
                    <span className="workspace-meta-value">
                      {reviewedRunItemCount}/{runEvalMutation.data.items.length}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge
                    color={filterReviewState === "pending" ? "red" : "gray"}
                    data-testid="report-filter-pending"
                    onClick={() => setFilterReviewState(current => (current === "pending" ? "" : "pending"))}
                    style={{ cursor: "pointer" }}
                    variant={filterReviewState === "pending" ? "filled" : "light"}
                  >
                    {locale === "zh" ? `待复盘 · ${pendingReviewCount}` : `Pending review · ${pendingReviewCount}`}
                  </Badge>
                  <Badge
                    color={filterReviewState === "reviewed" ? "teal" : "gray"}
                    data-testid="report-filter-reviewed"
                    onClick={() => setFilterReviewState(current => (current === "reviewed" ? "" : "reviewed"))}
                    style={{ cursor: "pointer" }}
                    variant={filterReviewState === "reviewed" ? "filled" : "light"}
                  >
                    {locale === "zh" ? `已复盘 · ${reviewedRunItemCount}` : `Reviewed · ${reviewedRunItemCount}`}
                  </Badge>
                  {reviewConclusionSummary.length > 0
                    ? reviewConclusionSummary.map(({ conclusion, count }) => {
                        const presentation = getReviewConclusionPresentation(conclusion, locale);
                        return (
                          <Badge
                            color={presentation.color}
                            data-testid={`report-filter-conclusion-${conclusion}`}
                            key={conclusion}
                            onClick={() => setFilterConclusion(current => (current === conclusion ? "" : conclusion))}
                            style={{ cursor: "pointer" }}
                            variant={filterConclusion === conclusion ? "filled" : "light"}
                          >
                            {presentation.label} · {count}
                          </Badge>
                        );
                      })
                    : null}
                </div>
                <div className="workspace-meta-row">
                  <span className="workspace-meta-label">{locale === "zh" ? "已写结论" : "Conclusions recorded"}</span>
                  <span className="workspace-meta-value">{reviewConclusionCount}</span>
                </div>
                <Paper className="workspace-subpanel" p="md" radius="xl">
                  <Stack gap="xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Text className="workspace-section-heading">
                        {locale === "zh" ? "本地复盘记录" : "Local review note"}
                      </Text>
                      <Badge color="gray" variant="light">
                        {reviewUpdatedAt
                          ? locale === "zh"
                            ? `最近更新 ${formatDateTime(reviewUpdatedAt)}`
                            : `Updated ${formatDateTime(reviewUpdatedAt)}`
                          : locale === "zh"
                            ? "尚未记录"
                            : "Not recorded yet"}
                      </Badge>
                    </div>
                    <Text c="var(--app-text-muted)" size="sm">
                      {locale === "zh"
                        ? "把这次 run 的主要结论、准备调整的方向、以及改完后要回看的点记在这里。它会跟着当前 run 保存在本地。"
                        : "Capture the main conclusions for this run, what you plan to adjust next, and what should be rechecked afterward. This note stays locally attached to the current run."}
                    </Text>
                    <Textarea
                      autosize
                      classNames={{ input: "workspace-input" }}
                      minRows={4}
                      onChange={event => updateReviewNote(event.currentTarget.value)}
                      placeholder={
                        locale === "zh"
                          ? "例如：这轮主要是检索命中问题；先检查资料覆盖和 topK，再回质量报告复查 grounded 与 citations。"
                          : "For example: This run is mostly showing retrieval issues; review library coverage and topK first, then return to quality reports to recheck grounded rate and citations."
                      }
                      value={reviewNote}
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        className="workspace-button"
                        color="gray"
                        onClick={copyLocalReviewSummary}
                        radius="xl"
                        size="xs"
                        variant="light"
                      >
                        {locale === "zh" ? "复制复盘摘要" : "Copy review summary"}
                      </Button>
                      <Button
                        className="workspace-button"
                        color="gray"
                        onClick={downloadLocalReviewSummary}
                        radius="xl"
                        size="xs"
                        variant="light"
                      >
                        {locale === "zh" ? "导出复盘摘要" : "Export review summary"}
                      </Button>
                    </div>
                    {recheckSuggestion ? (
                      <Paper className="workspace-subpanel" p="md" radius="xl">
                        <Stack gap="xs">
                          <div className="flex flex-wrap items-center gap-2">
                            <Text className="workspace-section-heading">
                              {locale === "zh" ? "改完后建议优先复查" : "Suggested recheck after changes"}
                            </Text>
                            <Badge color={recheckSuggestion.color} variant="light">
                              {recheckSuggestion.title}
                            </Badge>
                          </div>
                          <div className="workspace-meta-list">
                            {recheckSuggestion.checks.map((item, index) => (
                              <div className="workspace-meta-row" key={`recheck-${index}`}>
                                <span className="workspace-meta-label">{locale === "zh" ? `复查 ${index + 1}` : `Recheck ${index + 1}`}</span>
                                <span className="workspace-meta-value">{item}</span>
                              </div>
                            ))}
                          </div>
                        </Stack>
                      </Paper>
                    ) : null}
                  </Stack>
                </Paper>
                {conclusionGuidance ? (
                  <Paper className="workspace-subpanel" p="md" radius="xl">
                    <Stack gap="xs">
                      <div className="flex flex-wrap items-center gap-2">
                        <Text className="workspace-section-heading">
                          {locale === "zh" ? "本轮改进重点" : "Current improvement focus"}
                        </Text>
                        <Badge color={conclusionGuidance.color} variant="light">
                          {conclusionGuidance.title}
                        </Badge>
                      </div>
                      <Text c="var(--app-text-muted)" size="sm">
                        {conclusionGuidance.detail}
                      </Text>
                      {conclusionPathGuidance ? (
                        <div className="workspace-meta-list">
                          {conclusionPathGuidance.steps.map((step, index) => (
                            <div className="workspace-meta-row" key={`${conclusionGuidance.conclusion}-${index}`}>
                              <span className="workspace-meta-label">{locale === "zh" ? `步骤 ${index + 1}` : `Step ${index + 1}`}</span>
                              <span className="workspace-meta-value">{step}</span>
                            </div>
                          ))}
                        </div>
                      ) : null}
                      {optimizationSuggestion ? (
                        <Paper className="workspace-subpanel" p="md" radius="xl">
                          <Stack gap="xs">
                            <div className="flex flex-wrap items-center gap-2">
                              <Text className="workspace-section-heading">
                                {locale === "zh" ? "建议优先优化方向" : "Suggested optimization direction"}
                              </Text>
                              <Badge color={optimizationSuggestion.color} variant="light">
                                {optimizationSuggestion.title}
                              </Badge>
                            </div>
                            <Text c="var(--app-text-muted)" size="sm">
                              {optimizationSuggestion.detail}
                            </Text>
                            <div className="workspace-meta-list">
                              {optimizationSuggestion.checklist.map((item, index) => (
                                <div className="workspace-meta-row" key={`${conclusionGuidance.conclusion}-optimization-${index}`}>
                                  <span className="workspace-meta-label">{locale === "zh" ? `检查 ${index + 1}` : `Check ${index + 1}`}</span>
                                  <span className="workspace-meta-value">{item}</span>
                                </div>
                              ))}
                            </div>
                          </Stack>
                        </Paper>
                      ) : null}
                      <div className="flex flex-wrap gap-2">
                        {optimizationSuggestion ? (
                            <Button
                              className="workspace-button"
                              color={optimizationSuggestion.color}
                              component={Link}
                              radius="xl"
                              size="xs"
                              to={buildAssistantReviewLink({
                                baseHref: optimizationSuggestion.settingsHref,
                                focusTitle: conclusionGuidance.title,
                                returnTo: reportReturnHref
                              })}
                              variant="subtle"
                            >
                              {optimizationSuggestion.settingsLabel}
                          </Button>
                        ) : null}
                        <Button
                          className="workspace-button"
                          color={conclusionGuidance.color}
                          onClick={applyImprovementFocusQueue}
                          radius="xl"
                          size="xs"
                          variant="light"
                        >
                          {locale === "zh" ? "只看这类待复盘项" : "Show pending items for this focus"}
                        </Button>
                        {firstPendingImprovementItem?.traceId && conclusionPathGuidance ? (
                          <Button
                            className="workspace-button"
                            color={conclusionGuidance.color}
                            component={Link}
                            radius="xl"
                            size="xs"
                            to={buildTraceReviewLink({
                              traceId: firstPendingImprovementItem.traceId,
                              question: firstPendingImprovementItem.question,
                              handlingTitle: conclusionGuidance.title,
                              priorityLabel: locale === "zh" ? "本轮改进重点" : "Current improvement focus"
                            })}
                            variant="subtle"
                          >
                            {conclusionPathGuidance.traceLabel}
                          </Button>
                        ) : null}
                      </div>
                    </Stack>
                  </Paper>
                ) : null}
              </Stack>
            </Paper>
          ) : null}

          {firstRegressionDrilldownItem ? (
            <Paper className="workspace-panel-hover workspace-panel-strong" p="lg" radius="xl">
              <Stack gap="sm">
                <div className="workspace-section-heading">{locale === "zh" ? "优先复盘题目" : "Priority replay item"}</div>
                <Text c="var(--app-text-muted)" size="sm">
                  {locale === "zh"
                    ? "先处理当前最严重的回归项，再继续看其余弱项。"
                    : "Start with the most severe regressed item before moving through the rest of the weakest items."}
                </Text>
                <div className="workspace-meta-row">
                  <span className="workspace-meta-label">{locale === "zh" ? "题目" : "Question"}</span>
                  <span className="workspace-meta-value">#{firstRegressionDrilldownItem.index} · {firstRegressionDrilldownItem.question}</span>
                </div>
                <div className="workspace-meta-row">
                  <span className="workspace-meta-label">{locale === "zh" ? "回归原因" : "Regression reasons"}</span>
                  <span className="workspace-meta-value">
                    {firstRegressionDrilldownItem.reasonCodes.map(code => getRegressionReasonLabel(code, locale)).join("; ")}
                  </span>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  <div className="workspace-meta-row">
                    <span className="workspace-meta-label">{locale === "zh" ? "Baseline" : "Baseline"}</span>
                    <span className="workspace-meta-value">
                      {firstRegressionDrilldownItem.baseline.status} · {firstRegressionDrilldownItem.baseline.qualityOverall ?? "-"} · {firstRegressionDrilldownItem.baseline.answerStatus ?? "-"}
                    </span>
                  </div>
                  <div className="workspace-meta-row">
                    <span className="workspace-meta-label">{locale === "zh" ? "Current" : "Current"}</span>
                    <span className="workspace-meta-value">
                      {firstRegressionDrilldownItem.current.status} · {firstRegressionDrilldownItem.current.qualityOverall ?? "-"} · {firstRegressionDrilldownItem.current.answerStatus ?? "-"}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    className="workspace-button"
                    color="indigo"
                    onClick={() => focusRunItem(firstRegressionDrilldownItem.index, firstRegressionDrilldownItem.question)}
                    radius="xl"
                    size="xs"
                    variant="light"
                  >
                    {locale === "zh" ? "定位到结果行" : "Focus result row"}
                  </Button>
                  {priorityReplayItem?.traceId ? (
                    <Button
                      className="workspace-button"
                      color="indigo"
                      component={Link}
                      radius="xl"
                      size="xs"
                      to={buildTraceReviewLink({
                        traceId: priorityReplayItem.traceId,
                        question: firstRegressionDrilldownItem.question,
                        handlingTitle: locale === "zh" ? "优先复盘题目" : "Priority replay item",
                        priorityLabel: locale === "zh" ? "最高优先级" : "Highest priority"
                      })}
                      variant="subtle"
                    >
                      {locale === "zh" ? "打开诊断" : "Open diagnostics"}
                    </Button>
                  ) : null}
                </div>
              </Stack>
            </Paper>
          ) : null}

          {topPriorityReviewItems.length > 0 ? (
            <Paper className="workspace-panel-hover workspace-panel-strong" p="lg" radius="xl">
              <Stack gap="sm">
              <div className="workspace-section-heading">{locale === "zh" ? "本次优先处理的 3 个问题" : "Top 3 issues to handle first"}</div>
                <Text c="var(--app-text-muted)" size="sm">
                  {locale === "zh"
                    ? "先按这个顺序看，避免在完整结果表里来回找重点。"
                    : "Review in this order first so you do not have to search the full result table for the highest-value issues."}
                </Text>
                <div className="grid gap-3 lg:grid-cols-3">
                  {topPriorityReviewItems.map(({ item, runItem }, position) => {
                    const itemKey = getEvalItemKey(item.index, item.question);
                    const isReviewed = reviewedItemKeySet.has(itemKey);
                    const reviewConclusion = reviewConclusions[itemKey] ?? null;
                    const reviewConclusionPresentation = reviewConclusion
                      ? getReviewConclusionPresentation(reviewConclusion, locale)
                      : null;
                    const reviewSignal = runItem
                      ? getReviewSignal(
                          {
                            status: runItem.status,
                            qualityPrimaryIssue: runItem.qualityPrimaryIssue,
                            usedFallback: runItem.usedFallback,
                            citationCount: runItem.citationCount,
                            error: runItem.error
                          },
                          locale
                        )
                      : null;
                    const handlingStrategy = getHandlingStrategy({
                      reasonCodes: item.reasonCodes,
                      current: item.current,
                      locale
                    });

                    return (
                      <Paper className="workspace-subpanel" key={`${item.index}-${item.question}`} p="md" radius="xl">
                        <Stack gap="sm">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <Text c="var(--app-text)" fw={700} size="sm">
                                {locale === "zh" ? `优先级 ${position + 1}` : `Priority ${position + 1}`}
                              </Text>
                              <Text c="var(--app-text-muted)" mt={4} size="xs">
                                #{item.index}
                              </Text>
                            </div>
                            <Badge color={getRegressionSeverityColor(item.severity)} variant="light">
                              {item.severity}
                            </Badge>
                          </div>

                          <Badge color={isReviewed ? "teal" : "gray"} variant="light" w="fit-content">
                            {isReviewed
                              ? locale === "zh"
                                ? "已复盘"
                                : "Reviewed"
                              : locale === "zh"
                                ? "待复盘"
                                : "Pending review"}
                          </Badge>

                          {reviewConclusionPresentation ? (
                            <Badge color={reviewConclusionPresentation.color} variant="light" w="fit-content">
                              {reviewConclusionPresentation.label}
                            </Badge>
                          ) : null}

                          <Text c="var(--app-text)" fw={600} size="sm">
                            {item.question}
                          </Text>

                          <div className="workspace-meta-list">
                            <div className="workspace-meta-row">
                              <span className="workspace-meta-label">{locale === "zh" ? "回归原因" : "Regression reasons"}</span>
                              <span className="workspace-meta-value text-right">
                                {item.reasonCodes.slice(0, 2).map(code => getRegressionReasonLabel(code, locale)).join("; ")}
                              </span>
                            </div>
                            <div className="workspace-meta-row">
                              <span className="workspace-meta-label">{locale === "zh" ? "当前信号" : "Current signal"}</span>
                              <span className="workspace-meta-value text-right">{reviewSignal?.title ?? (locale === "zh" ? "先看结果行" : "Inspect the result row")}</span>
                            </div>
                            <div className="workspace-meta-row">
                              <span className="workspace-meta-label">{locale === "zh" ? "处理建议" : "Handling strategy"}</span>
                              <span className="workspace-meta-value text-right">{handlingStrategy.title}</span>
                            </div>
                            <div className="workspace-meta-row">
                              <span className="workspace-meta-label">{locale === "zh" ? "Baseline -> Current" : "Baseline -> Current"}</span>
                              <span className="workspace-meta-value text-right">
                                {(item.baseline.qualityOverall ?? item.baseline.status) + " -> " + (item.current.qualityOverall ?? item.current.status)}
                              </span>
                            </div>
                          </div>

                          <Badge color={handlingStrategy.color} variant="light" w="fit-content">
                            {handlingStrategy.title}
                          </Badge>

                          <Text c="var(--app-text-muted)" size="xs">
                            {handlingStrategy.detail}
                          </Text>

                          <div className="flex flex-wrap gap-2">
                            <Button
                              className="workspace-button"
                              color="indigo"
                              onClick={() => focusRunItem(item.index, item.question)}
                              radius="xl"
                              size="xs"
                              variant="light"
                            >
                              {locale === "zh" ? "定位结果行" : "Focus row"}
                            </Button>
                            <Button
                              className="workspace-button"
                              color={isReviewed ? "gray" : "teal"}
                              onClick={() => toggleReviewedItem(item.index, item.question)}
                              radius="xl"
                              size="xs"
                              variant={isReviewed ? "subtle" : "light"}
                            >
                              {isReviewed
                                ? locale === "zh"
                                  ? "取消已复盘"
                                  : "Mark as pending"
                                : locale === "zh"
                                  ? "标记已复盘"
                                  : "Mark reviewed"}
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
                              w={160}
                            />
                            {runItem?.traceId ? (
                              <Button
                                className="workspace-button"
                                color="indigo"
                                component={Link}
                                radius="xl"
                                size="xs"
                                to={buildTraceReviewLink({
                                  traceId: runItem.traceId,
                                  question: item.question,
                                  handlingTitle: handlingStrategy.title,
                                  priorityLabel: locale === "zh" ? `优先级 ${position + 1}` : `Priority ${position + 1}`
                                })}
                                variant="subtle"
                              >
                                {locale === "zh" ? "打开诊断" : "Open diagnostics"}
                              </Button>
                            ) : null}
                          </div>
                        </Stack>
                      </Paper>
                    );
                  })}
                </div>
              </Stack>
            </Paper>
          ) : null}

          <div>
            <div className="workspace-section-heading">{locale === "zh" ? "先看摘要和结论" : "Start with the takeaways"}</div>
            <p className="mt-2 text-sm text-[var(--app-text-muted)]">
              {locale === "zh"
                ? "这里先给你当前 run 的摘要、主要回归差异和建议的下一步动作。先读这一块，再决定要不要继续下钻。"
                : "This section gives the run summary, the main regression signals, and the next recommended action. Read this first before drilling into details."}
            </p>
          </div>

          <Suspense fallback={<ReportAnalysisPanelsFallback locale={locale} />}>
            <ReportAnalysisPanels
              answerStatusDistribution={answerStatusDistribution}
              buildTraceReviewLink={buildTraceReviewLink}
              downloadReport={downloadReport}
              errorTypeDistribution={errorTypeDistribution}
              exporting={exporting}
              focusRunItem={focusRunItem}
              formatBaselineMetadataValue={formatBaselineMetadataValue}
              formatDateTime={formatDateTime}
              getEvalItemKey={getEvalItemKey}
              getQualityGateMetricLabel={getQualityGateMetricLabel}
              getQualityGateMetricStrategy={getQualityGateMetricStrategy}
              getRegressionReasonLabel={getRegressionReasonLabel}
              locale={locale}
              qualityDistributionData={qualityDistributionData}
              qualityGate={qualityGate}
              qualityGatePresentation={qualityGatePresentation}
              qualitySummaryRows={qualitySummaryRows}
              radarData={radarData}
              regressionDrilldownItems={regressionDrilldownItems}
              runDiffSummary={runDiffSummary}
              runEvalData={runEvalMutation.data}
              runItemsByKey={runItemsByKey}
              topBreachedMetric={topBreachedMetric}
            />
          </Suspense>

          <div>
            <div className="workspace-section-heading">{locale === "zh" ? "再看问题分布和详细分析" : "Then inspect the detailed analysis"}</div>
            <p className="mt-2 text-sm text-[var(--app-text-muted)]">
              {locale === "zh"
                ? "需要判断问题更像 retrieval、citation 还是 answer 时，再看这部分的图表和分布。"
                : "Use these charts and distributions when you need to decide whether the issue is more about retrieval, citations, or answer behavior."}
            </p>
          </div>

          <Paper className="workspace-subpanel" p="md" radius="xl">
            <Stack gap="xs">
              <div className="workspace-section-heading">{locale === "zh" ? "最后再看完整结果表" : "Open the full results last"}</div>
              <Text c="var(--app-text-muted)" size="sm">
                {locale === "zh"
                  ? "只有在你已经看过摘要、优先题和下一步动作之后，再来这里逐题细看。第一次使用时，不需要一上来就读完整表格。"
                  : "Come here after you review the summary, the priority items, and the suggested next action. On a first pass, you do not need to start with the full table."}
              </Text>
              <div className="flex flex-wrap gap-2">
                <Badge color="indigo" radius="sm" variant="light">
                  {locale === "zh" ? `${topPriorityReviewItems.length} 条优先题` : `${topPriorityReviewItems.length} priority items`}
                </Badge>
                <Badge color="teal" radius="sm" variant="light">
                  {locale === "zh" ? `${reviewedRunItemCount} / ${deferredRunItems.length} 已复盘` : `${reviewedRunItemCount} / ${deferredRunItems.length} reviewed`}
                </Badge>
                <Badge color="gray" radius="sm" variant="light">
                  {locale === "zh" ? "支持按状态 / 质量 / 结论筛选" : "Filter by status / quality / conclusion"}
                </Badge>
              </div>
              {topPriorityReviewItems.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    className="workspace-button"
                    color={showPriorityOnly ? "indigo" : "gray"}
                    onClick={() => setShowPriorityOnly(true)}
                    radius="xl"
                    size="xs"
                    variant={showPriorityOnly ? "light" : "subtle"}
                  >
                    {locale === "zh" ? "默认只看优先题" : "Focus priority items"}
                  </Button>
                  <Button
                    className="workspace-button"
                    color={!showPriorityOnly ? "teal" : "gray"}
                    onClick={() => setShowPriorityOnly(false)}
                    radius="xl"
                    size="xs"
                    variant={!showPriorityOnly ? "light" : "subtle"}
                  >
                    {locale === "zh" ? "查看全部结果" : "Show all results"}
                  </Button>
                </div>
              ) : null}
            </Stack>
          </Paper>

          <Suspense fallback={<ReportResultsTableFallback locale={locale} />}>
            <ReportResultsTable
              buildTraceReviewLink={buildTraceReviewLink}
              filterConclusion={filterConclusion}
              filterQuality={filterQuality}
              filterReviewState={filterReviewState}
              filterStatus={filterStatus}
              focusedItemKey={focusedItemKey}
              getAnswerStatusReviewLabel={getAnswerStatusReviewLabel}
              getEvalItemKey={getEvalItemKey}
              getQualitySignalColor={getQualitySignalColor}
              getReviewConclusionPresentation={getReviewConclusionPresentation}
              getReviewSignal={getReviewSignal}
              hasRunError={runEvalMutation.isError}
              hasRunItems={hasRunItems}
              itemRowRefs={itemRowRefs}
              locale={locale}
              qualityOptions={qualityOptions}
              requestSort={requestSort}
              reviewConclusions={reviewConclusions}
              reviewedItemKeySet={reviewedItemKeySet}
              setFilterConclusion={setFilterConclusion}
              setFilterQuality={setFilterQuality}
              setFilterReviewState={setFilterReviewState}
              setFilterStatus={setFilterStatus}
              sortConfig={sortConfig}
              sortedAndFilteredItems={displayedResults}
              statusOptions={statusOptions}
              toggleReviewedItem={toggleReviewedItem}
              updateReviewConclusion={updateReviewConclusion}
            />
          </Suspense>
        </Stack>
      ) : null}
    </div>
  );
}

function ReportResultsTableFallback({ locale }: { locale: "zh" | "en" }) {
  return (
    <StatePanel
      description={
        locale === "zh"
          ? "正在准备结果表、筛选器和复盘交互。"
          : "Preparing the results table, filters, and review interactions."
      }
      title={locale === "zh" ? "加载结果表" : "Loading results table"}
      tone="loading"
    />
  );
}

function ReportAnalysisPanelsFallback({ locale }: { locale: "zh" | "en" }) {
  return (
    <StatePanel
      description={
        locale === "zh"
          ? "正在准备分布、门槛、差异和导出分析面板。"
          : "Preparing distributions, gate summaries, diffs, and export panels."
      }
      title={locale === "zh" ? "加载分析面板" : "Loading analysis panels"}
      tone="loading"
    />
  );
}
