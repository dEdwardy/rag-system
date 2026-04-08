import { Badge, Button, Paper, Select, Stack, Text, TextInput, Textarea } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { lazy, Suspense, type FormEvent, useDeferredValue, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { StatePanel } from "../../components/StatePanel";
import { useAssistants, useRunEvalQuestionSet } from "../../features/api/hooks";
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

export function ReportCenterPage() {
  const assistantsQuery = useAssistants();
  const runEvalMutation = useRunEvalQuestionSet();
  const { locale, formatDateTime } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isRunPending, startRunTransition] = useTransition();
  const [questionSetId, setQuestionSetId] = useState(() => searchParams.get("questionSetId") ?? "");
  const [assistantId, setAssistantId] = useState(() => searchParams.get("assistantId") ?? "");
  const [baselineSnapshotId, setBaselineSnapshotId] = useState(() => searchParams.get("baselineSnapshotId") ?? "");

  // 表格排序和筛选状态
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'ascending' | 'descending' } | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterQuality, setFilterQuality] = useState<string>("");
  const [filterReviewState, setFilterReviewState] = useState<"" | "pending" | "reviewed">("");
  const [filterConclusion, setFilterConclusion] = useState<"" | ReviewConclusion>("");
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

  useEffect(() => {
    if (!assistantId && assistantOptions.length > 0) {
      setAssistantId(assistantOptions[0].value);
    }
  }, [assistantId, assistantOptions]);

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
  const preRunContextRows = [
    {
      key: "question-set",
      label: locale === "zh" ? "Question set" : "Question set",
      value:
        normalizedPreRunParams?.questionSetId ??
        (locale === "zh" ? "尚未填写（运行前会去除前后空格）" : "Not set (trimmed before run)")
    },
    {
      key: "assistant",
      label: locale === "zh" ? "Assistant" : "Assistant",
      value: selectedAssistantLabel
    },
    {
      key: "baseline",
      label: locale === "zh" ? "Baseline snapshot" : "Baseline snapshot",
      value:
        normalizedPreRunParams?.baselineSnapshotId
          ? normalizedPreRunParams.baselineSnapshotId
          : locale === "zh"
            ? "本次 run 不绑定"
            : "Not linked for this run"
    },
    {
      key: "carry-through",
      label: locale === "zh" ? "URL carry-through" : "URL carry-through",
      value:
        preRunContextPreview.searchParams?.toString() ??
        (locale === "zh"
          ? "待补齐 question set 与 assistant 后写入 URL"
          : "Fill question set and assistant to carry through in URL")
    }
  ];







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
            <div>
              <div className="workspace-section-heading">{locale === "zh" ? "运行质量检查" : "Run quality check"}</div>
              <p className="mt-2 text-sm text-[var(--app-text-muted)]">
                {locale === "zh"
                  ? "用一组固定输入触发一次质量检查，便于后续对比结果、回归差异和弱项。"
                  : "Run one check with fixed inputs so the page can compare summary results, regressions, and weakest items consistently."}
              </p>
            </div>

          <form className="grid gap-4 md:grid-cols-3" onSubmit={onRunEvalSubmit}>
            <TextInput
              label={locale === "zh" ? "Question set ID" : "Question set id"}
              onChange={event => setQuestionSetId(event.currentTarget.value)}
              placeholder={locale === "zh" ? "例如：set-1" : "e.g. set-1"}
              required
              value={questionSetId}
              size="md"
            />
            <Select
              data={assistantOptions}
              label={locale === "zh" ? "Assistant" : "Assistant"}
              onChange={value => setAssistantId(value ?? "")}
              placeholder={locale === "zh" ? "选择 assistant" : "Select assistant"}
              searchable
              value={assistantId || null}
              size="md"
            />
            <TextInput
              label={locale === "zh" ? "Baseline snapshot（可选）" : "Baseline snapshot (optional)"}
              onChange={event => setBaselineSnapshotId(event.currentTarget.value)}
              placeholder={locale === "zh" ? "例如：snapshot-1" : "e.g. snapshot-1"}
              value={baselineSnapshotId}
              size="md"
            />

            <div className="md:col-span-3">
              <Button className="workspace-button w-full" color="indigo" loading={runEvalMutation.isPending || isRunPending} radius="xl" type="submit" variant="light" size="md">
                {locale === "zh" ? "开始质量检查" : "Run quality check"}
              </Button>
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
              <StatePanel
                description={
                  locale === "zh"
                    ? "先执行一次质量检查，再从质量摘要、差异摘要和弱项列表开始查看。"
                    : "Run one quality check first, then review the quality summary, diff summary, and weakest items."}
                title={locale === "zh" ? "先跑一次质量检查" : "Start with one quality check"}
                tone="empty"
              />
              <Text c="var(--app-text-muted)" data-testid="report-center-pre-run-path" size="xs">
                {locale === "zh"
                  ? "建议路径：质量检查（触发首轮）→ 质量报告（查看摘要/差异/弱项）"
                  : "Suggested path: quality check (trigger first run) -> quality reports (review summary/diff/weakest items)"}
              </Text>
              <Paper className="workspace-subpanel" p="md" radius="xl">
                <Stack gap="xs">
                  <Text className="workspace-section-heading">
                    {locale === "zh" ? "当前检查上下文" : "Current check context"}
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
              <div className="workspace-section-heading">{locale === "zh" ? "结果速读路径" : "Result review path"}</div>
              <Text c="var(--app-text-muted)" size="sm">
                {locale === "zh"
                  ? "按 当前输入 -> 结果摘要 -> 差异 -> 弱项 -> 下一步 的顺序快速查看。"
                  : "Review in one pass: current inputs -> summary -> diff -> weakest items -> next action."}
              </Text>
              <div className="grid gap-2 md:grid-cols-2">
                <div className="workspace-meta-row">
                  <span className="workspace-meta-label">{locale === "zh" ? "当前输入" : "Current inputs"}</span>
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
                    ? "先按这个顺序复盘，避免在完整结果表里来回找重点。"
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
              sortedAndFilteredItems={sortedAndFilteredItems}
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
