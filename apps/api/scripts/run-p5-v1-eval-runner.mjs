#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../../..");
const DEFAULT_BASE_URL = process.env.RAG_EVAL_BASE_URL ?? "http://127.0.0.1:3000";
const DEFAULT_OUTPUT_DIR = path.join(REPO_ROOT, "storage/evals/p5-v1");

function readOptionValue(argv, index, optionName) {
  const next = argv[index + 1];
  if (!next || next.startsWith("-")) {
    throw new Error(`Missing value for ${optionName}.`);
  }
  return next;
}

function parseArgs(argv) {
  const options = {
    baseUrl: DEFAULT_BASE_URL,
    outputPath: null,
    qualityGateMode: "warn",
    userId: null,
    help: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg.startsWith("--base-url=")) {
      options.baseUrl = arg.slice("--base-url=".length);
      continue;
    }

    if (arg.startsWith("--output=")) {
      options.outputPath = arg.slice("--output=".length);
      continue;
    }

    if (arg.startsWith("--quality-gate-mode=")) {
      const mode = arg.slice("--quality-gate-mode=".length);
      if (mode !== "warn" && mode !== "fail") {
        throw new Error(`Invalid --quality-gate-mode: ${mode}. Expected warn|fail.`);
      }
      options.qualityGateMode = mode;
      continue;
    }

    if (arg.startsWith("--user-id=")) {
      options.userId = arg.slice("--user-id=".length);
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }

    if (arg === "--base-url") {
      options.baseUrl = readOptionValue(argv, i, "--base-url");
      i += 1;
      continue;
    }

    if (arg === "--output") {
      options.outputPath = readOptionValue(argv, i, "--output");
      i += 1;
      continue;
    }

    if (arg === "--quality-gate-mode") {
      const next = readOptionValue(argv, i, "--quality-gate-mode");
      if (next === "warn" || next === "fail") {
        options.qualityGateMode = next;
      } else {
        throw new Error(`Invalid --quality-gate-mode: ${next}. Expected warn|fail.`);
      }
      i += 1;
      continue;
    }

    if (arg === "--user-id") {
      options.userId = readOptionValue(argv, i, "--user-id");
      i += 1;
      continue;
    }

    throw new Error(`Unknown option: ${arg}. Run with --help for usage.`);
  }

  return options;
}

function usage() {
  return [
    "P5 v1 retrieval regression runner",
    "",
    "Usage:",
    "  pnpm --filter @rag-system/api eval:runner:p5-v1 [--base-url <url>] [--output <file>] [--quality-gate-mode warn|fail] [--user-id <id>]",
    "  pnpm --filter @rag-system/api eval:runner:p5-v1 --base-url=http://127.0.0.1:3000 --quality-gate-mode=fail",
    "",
    "Defaults:",
    `  --base-url ${DEFAULT_BASE_URL}`,
    "  --quality-gate-mode warn",
    "  --output <repo>/storage/evals/p5-v1/<timestamp>",
    "",
    "Output files:",
    "  <output>.json",
    "  <output>.md",
    "  <output>.html",
    "",
    "Notes:",
    "  - unknown flags and missing option values fail fast",
    "  - output directory is anchored to <repo>/storage/evals/p5-v1 by default"
  ].join("\n");
}

function toCookieHeader(response) {
  const header = response.headers;
  const setCookies = typeof header.getSetCookie === "function"
    ? header.getSetCookie()
    : [header.get("set-cookie")].filter(Boolean);
  const cookiePairs = setCookies
    .map(cookie => cookie.split(";")[0]?.trim())
    .filter(Boolean);

  if (cookiePairs.length === 0) {
    throw new Error("Missing session cookie from POST /auth/login response.");
  }

  return cookiePairs.join("; ");
}

async function parseJson(response) {
  const bodyText = await response.text();
  if (!bodyText) {
    return null;
  }

  try {
    return JSON.parse(bodyText);
  } catch {
    throw new Error(`Expected JSON response from ${response.url}, got: ${bodyText.slice(0, 300)}`);
  }
}

async function login(baseUrl, userId) {
  const payload = userId ? { userId } : {};
  const response = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const body = await parseJson(response).catch(() => null);
    throw new Error(`Login failed (${response.status}): ${JSON.stringify(body ?? {})}`);
  }

  return toCookieHeader(response);
}

async function runReplay(baseUrl, cookieHeader, qualityGateMode) {
  const response = await fetch(`${baseUrl}/eval/question-sets/demo-replays/p5-v1/run`, {
    method: "POST",
    headers: {
      cookie: cookieHeader,
      "content-type": "application/json"
    },
    body: JSON.stringify({ qualityGateMode })
  });
  const payload = await parseJson(response);

  if (response.ok) {
    return payload;
  }

  if (response.status === 409 && payload?.code === "EVAL_QUALITY_GATE_FAILED" && payload?.runResult) {
    return payload.runResult;
  }

  throw new Error(`Replay run failed (${response.status}): ${JSON.stringify(payload ?? {})}`);
}

async function fetchTrace(baseUrl, cookieHeader, traceId) {
  const response = await fetch(`${baseUrl}/traces/${traceId}`, {
    headers: {
      cookie: cookieHeader
    }
  });

  if (!response.ok) {
    const payload = await parseJson(response).catch(() => null);
    throw new Error(`Trace lookup failed for ${traceId} (${response.status}): ${JSON.stringify(payload ?? {})}`);
  }

  return parseJson(response);
}

function assertRunResultContract(runResult) {
  if (!runResult || typeof runResult !== "object") {
    throw new Error("Replay response contract edge: expected run result object.");
  }

  if (!Array.isArray(runResult.items)) {
    throw new Error("Replay response contract edge: expected runResult.items to be an array.");
  }
}

function buildOutputPath(explicitPath) {
  if (explicitPath && explicitPath.trim()) {
    const resolved = path.resolve(process.cwd(), explicitPath.trim());
    const extension = path.extname(resolved).toLowerCase();
    if (extension === ".json" || extension === ".md" || extension === ".html") {
      return resolved.slice(0, -extension.length);
    }
    return resolved;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return path.join(DEFAULT_OUTPUT_DIR, `p5-v1-retrieval-regression-${timestamp}`);
}

function roundMetric(value) {
  return Math.round(value * 1000) / 1000;
}

function toRate(count, total) {
  if (total <= 0) {
    return 0;
  }
  return roundMetric(count / total);
}

function detectNoHitSignal(item, traceSummary) {
  return (
    traceSummary?.primaryIssue === "no_retrieval_hits" ||
    traceSummary?.insufficientContextReason === "no_retrieval_hits" ||
    traceSummary?.retrievedChunkCount === 0 ||
    item?.qualityPrimaryIssue === "no_retrieval_hits"
  );
}

function detectFallbackSignal(item, traceSummary) {
  return Boolean(
    item?.usedFallback === true ||
      traceSummary?.usedFallback === true ||
      traceSummary?.strategySummary?.usedFallback === true ||
      traceSummary?.primaryIssue === "fallback_generation"
  );
}

function detectLowScoreSignal(item, traceSummary) {
  return item?.qualityPrimaryIssue === "low_retrieval_score" || traceSummary?.primaryIssue === "low_retrieval_score";
}

function detectCitationLimitSignal(traceSummary) {
  return traceSummary?.citationLimitHit === true;
}

function classifySourceFamilyFromText(text) {
  const normalized = (text ?? "").toLowerCase();
  if (!normalized) {
    return null;
  }

  if (normalized.includes("sitemap")) {
    return "sitemap";
  }
  if (normalized.includes("feed") || normalized.includes("rss") || normalized.includes("atom")) {
    return "feed";
  }
  if (
    normalized.includes("web page") ||
    normalized.includes("html") ||
    normalized.includes("content-type") ||
    normalized.includes("redirect")
  ) {
    return "web";
  }
  if (
    normalized.includes("upload") ||
    normalized.includes("pdf") ||
    normalized.includes("docx") ||
    normalized.includes("markdown") ||
    normalized.includes("txt")
  ) {
    return "upload";
  }
  if (normalized.includes("source") || normalized.includes("fetch") || normalized.includes("external")) {
    return "other";
  }

  return null;
}

function detectSourceFamilyFailure(trace, traceSummary) {
  const traceStatus = typeof trace?.status === "string" ? trace.status : null;
  const diagnosticsText = [traceSummary?.failureMessage, trace?.errorMessage, trace?.failureMessage]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const detectedFamily = classifySourceFamilyFromText(diagnosticsText);
  const isSourceFailure =
    traceStatus === "failed" &&
    detectedFamily != null &&
    ["source", "fetch", "web page", "feed", "sitemap", "content-type", "redirect", "external"].some(keyword =>
      diagnosticsText.includes(keyword)
    );

  return {
    isSourceFailure,
    family: isSourceFailure ? detectedFamily : null,
    reason: isSourceFailure ? (traceSummary?.failureMessage ?? trace?.errorMessage ?? trace?.failureMessage ?? null) : null
  };
}

function buildSignalSummary(itemDetails) {
  const total = itemDetails.length;
  const noHitCount = itemDetails.filter(item => item.signalFlags.noHit).length;
  const fallbackCount = itemDetails.filter(item => item.signalFlags.fallback).length;
  const lowScoreCount = itemDetails.filter(item => item.signalFlags.lowScore).length;
  const citationLimitCount = itemDetails.filter(item => item.signalFlags.citationLimit).length;
  const sourceFamilyFailureCount = itemDetails.filter(item => item.signalFlags.sourceFamilyFailure).length;

  const sourceFamilyCounts = new Map();
  for (const item of itemDetails) {
    const family = item.sourceFamilyFailureFamily;
    if (!family) {
      continue;
    }
    sourceFamilyCounts.set(family, (sourceFamilyCounts.get(family) ?? 0) + 1);
  }

  const sourceFamilyBreakdown = Array.from(sourceFamilyCounts.entries())
    .map(([family, count]) => ({
      family,
      count,
      rate: toRate(count, total)
    }))
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }
      return left.family.localeCompare(right.family);
    });

  return {
    totalItems: total,
    noHit: {
      count: noHitCount,
      rate: toRate(noHitCount, total)
    },
    fallback: {
      count: fallbackCount,
      rate: toRate(fallbackCount, total)
    },
    lowScore: {
      count: lowScoreCount,
      rate: toRate(lowScoreCount, total)
    },
    citationLimit: {
      count: citationLimitCount,
      rate: toRate(citationLimitCount, total)
    },
    sourceFamilyFailure: {
      count: sourceFamilyFailureCount,
      rate: toRate(sourceFamilyFailureCount, total),
      byFamily: sourceFamilyBreakdown
    }
  };
}

function escapeMarkdownCell(value) {
  return String(value ?? "").replace(/\|/g, "\\|").replace(/\n/g, "<br/>");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderMarkdownReport(payload) {
  const lines = [
    "# P5 v1 retrieval quality regression report",
    "",
    "## Metadata",
    `- schemaVersion: ${payload.schemaVersion}`,
    `- generatedAt: ${payload.generatedAt}`,
    `- baseUrl: ${payload.runner.baseUrl}`,
    `- qualityGateMode: ${payload.runner.qualityGateMode}`,
    `- replayId: ${payload.runner.replayId}`,
    `- questionSetId: ${payload.run.questionSetId}`,
    `- baselineSnapshotId: ${payload.run.baselineSnapshotId}`,
    `- assistantId: ${payload.run.assistantId}`,
    `- startedAt: ${payload.run.startedAt}`,
    `- finishedAt: ${payload.run.finishedAt}`,
    "",
    "## Retrieval signal summary",
    "",
    "| signal | count | rate |",
    "| --- | --- | --- |",
    `| no-hit | ${payload.signalSummary.noHit.count} | ${payload.signalSummary.noHit.rate} |`,
    `| fallback | ${payload.signalSummary.fallback.count} | ${payload.signalSummary.fallback.rate} |`,
    `| low-score | ${payload.signalSummary.lowScore.count} | ${payload.signalSummary.lowScore.rate} |`,
    `| citation-limit-hit | ${payload.signalSummary.citationLimit.count} | ${payload.signalSummary.citationLimit.rate} |`,
    `| source-family-failure | ${payload.signalSummary.sourceFamilyFailure.count} | ${payload.signalSummary.sourceFamilyFailure.rate} |`,
    "",
    "## Source-family failure breakdown",
    "",
    "| source family | count | rate |",
    "| --- | --- | --- |",
    ...(payload.signalSummary.sourceFamilyFailure.byFamily.length > 0
      ? payload.signalSummary.sourceFamilyFailure.byFamily.map(
          item => `| ${item.family} | ${item.count} | ${item.rate} |`
        )
      : ["| none | 0 | 0 |"]),
    "",
    "## Baseline diff summary",
    `- comparisonMeaningful: ${payload.baselineComparison.comparisonMeaningful}`,
    `- headline: ${payload.baselineComparison.diffSummary?.headline ?? "not_available"}`,
    "",
    "## Per-question signals",
    "",
    "| # | status | question | answerStatus | primaryIssue | no-hit | fallback | low-score | citation-limit-hit | source-family-failure | source-family | rankingTopKHit | traceId |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...payload.items.map(item => {
      const row = [
        item.index,
        item.status,
        item.question,
        item.answerStatus ?? "-",
        item.qualityPrimaryIssue ?? item.tracePrimaryIssue ?? "-",
        item.signalFlags.noHit ? "yes" : "no",
        item.signalFlags.fallback ? "yes" : "no",
        item.signalFlags.lowScore ? "yes" : "no",
        item.signalFlags.citationLimit ? "yes" : "no",
        item.signalFlags.sourceFamilyFailure ? "yes" : "no",
        item.sourceFamilyFailureFamily ?? "-",
        item.rankingTopKHit == null ? "-" : item.rankingTopKHit ? "yes" : "no",
        item.traceId ?? "-"
      ];
      return `| ${row.map(escapeMarkdownCell).join(" | ")} |`;
    })
  ];

  return lines.join("\n");
}

function renderHtmlReport(payload) {
  const sourceFamilyRows =
    payload.signalSummary.sourceFamilyFailure.byFamily.length > 0
      ? payload.signalSummary.sourceFamilyFailure.byFamily
          .map(
            item =>
              `<tr><td>${escapeHtml(item.family)}</td><td>${item.count}</td><td>${item.rate}</td></tr>`
          )
          .join("\n")
      : `<tr><td>none</td><td>0</td><td>0</td></tr>`;

  const questionRows = payload.items
    .map(item => {
      const cells = [
        item.index,
        item.status,
        item.question,
        item.answerStatus ?? "-",
        item.qualityPrimaryIssue ?? item.tracePrimaryIssue ?? "-",
        item.signalFlags.noHit ? "yes" : "no",
        item.signalFlags.fallback ? "yes" : "no",
        item.signalFlags.lowScore ? "yes" : "no",
        item.signalFlags.citationLimit ? "yes" : "no",
        item.signalFlags.sourceFamilyFailure ? "yes" : "no",
        item.sourceFamilyFailureFamily ?? "-",
        item.rankingTopKHit == null ? "-" : item.rankingTopKHit ? "yes" : "no",
        item.traceId ?? "-"
      ];
      return `<tr>${cells.map(value => `<td>${escapeHtml(value)}</td>`).join("")}</tr>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>P5 v1 retrieval quality regression report</title>
    <style>
      body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; margin: 24px; color: #111827; }
      h1, h2 { margin-bottom: 8px; }
      table { width: 100%; border-collapse: collapse; margin-top: 12px; }
      th, td { border: 1px solid #d1d5db; text-align: left; padding: 8px; vertical-align: top; font-size: 13px; }
      th { background: #f3f4f6; }
      code { background: #f3f4f6; padding: 1px 4px; border-radius: 4px; }
    </style>
  </head>
  <body>
    <h1>P5 v1 retrieval quality regression report</h1>

    <h2>Metadata</h2>
    <ul>
      <li>schemaVersion: <code>${escapeHtml(payload.schemaVersion)}</code></li>
      <li>generatedAt: <code>${escapeHtml(payload.generatedAt)}</code></li>
      <li>baseUrl: <code>${escapeHtml(payload.runner.baseUrl)}</code></li>
      <li>qualityGateMode: <code>${escapeHtml(payload.runner.qualityGateMode)}</code></li>
      <li>replayId: <code>${escapeHtml(payload.runner.replayId)}</code></li>
      <li>questionSetId: <code>${escapeHtml(payload.run.questionSetId)}</code></li>
      <li>baselineSnapshotId: <code>${escapeHtml(payload.run.baselineSnapshotId)}</code></li>
      <li>assistantId: <code>${escapeHtml(payload.run.assistantId)}</code></li>
      <li>startedAt: <code>${escapeHtml(payload.run.startedAt)}</code></li>
      <li>finishedAt: <code>${escapeHtml(payload.run.finishedAt)}</code></li>
    </ul>

    <h2>Retrieval signal summary</h2>
    <table>
      <thead>
        <tr><th>signal</th><th>count</th><th>rate</th></tr>
      </thead>
      <tbody>
        <tr><td>no-hit</td><td>${payload.signalSummary.noHit.count}</td><td>${payload.signalSummary.noHit.rate}</td></tr>
        <tr><td>fallback</td><td>${payload.signalSummary.fallback.count}</td><td>${payload.signalSummary.fallback.rate}</td></tr>
        <tr><td>low-score</td><td>${payload.signalSummary.lowScore.count}</td><td>${payload.signalSummary.lowScore.rate}</td></tr>
        <tr><td>citation-limit-hit</td><td>${payload.signalSummary.citationLimit.count}</td><td>${payload.signalSummary.citationLimit.rate}</td></tr>
        <tr><td>source-family-failure</td><td>${payload.signalSummary.sourceFamilyFailure.count}</td><td>${payload.signalSummary.sourceFamilyFailure.rate}</td></tr>
      </tbody>
    </table>

    <h2>Source-family failure breakdown</h2>
    <table>
      <thead>
        <tr><th>source family</th><th>count</th><th>rate</th></tr>
      </thead>
      <tbody>
        ${sourceFamilyRows}
      </tbody>
    </table>

    <h2>Baseline diff summary</h2>
    <ul>
      <li>comparisonMeaningful: <code>${payload.baselineComparison.comparisonMeaningful}</code></li>
      <li>headline: <code>${escapeHtml(payload.baselineComparison.diffSummary?.headline ?? "not_available")}</code></li>
    </ul>

    <h2>Per-question signals</h2>
    <table>
      <thead>
        <tr>
          <th>#</th><th>status</th><th>question</th><th>answerStatus</th><th>primaryIssue</th><th>no-hit</th><th>fallback</th><th>low-score</th><th>citation-limit-hit</th><th>source-family-failure</th><th>source-family</th><th>rankingTopKHit</th><th>traceId</th>
        </tr>
      </thead>
      <tbody>
        ${questionRows}
      </tbody>
    </table>
  </body>
</html>`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }

  const cookieHeader = await login(options.baseUrl, options.userId);
  const runResult = await runReplay(options.baseUrl, cookieHeader, options.qualityGateMode);
  assertRunResultContract(runResult);

  const itemDetails = await Promise.all(
    (runResult.items ?? []).map(async item => {
      if (!item.traceId) {
        const noHitSignal = item.qualityPrimaryIssue === "no_retrieval_hits";
        const fallbackSignal = item.usedFallback === true;
        const lowScoreSignal = item.qualityPrimaryIssue === "low_retrieval_score";
        return {
          ...item,
          topK: null,
          rankingTopKHit: null,
          citationLimitHit: null,
          noHitSignal,
          fallbackSignal,
          lowScoreSignal,
          sourceFamilyFailureSignal: false,
          sourceFamilyFailureFamily: null,
          sourceFamilyFailureReason: null,
          tracePrimaryIssue: null,
          signalFlags: {
            noHit: noHitSignal,
            fallback: fallbackSignal,
            lowScore: lowScoreSignal,
            citationLimit: false,
            sourceFamilyFailure: false
          }
        };
      }

      let trace = null;
      let traceFetchError = null;
      try {
        trace = await fetchTrace(options.baseUrl, cookieHeader, item.traceId);
      } catch (error) {
        traceFetchError = error instanceof Error ? error.message : String(error);
      }

      const traceSummary = trace?.traceSummary ?? null;
      const tracePrimaryIssue = traceSummary?.primaryIssue ?? null;
      const noHitSignal = detectNoHitSignal(item, traceSummary);
      const fallbackSignal = detectFallbackSignal(item, traceSummary);
      const lowScoreSignal = detectLowScoreSignal(item, traceSummary);
      const citationLimitSignal = detectCitationLimitSignal(traceSummary);
      const sourceFamilyFailure = detectSourceFamilyFailure(trace, traceSummary);

      return {
        ...item,
        topK: traceSummary?.candidateLimit ?? null,
        rankingTopKHit: traceSummary?.rankingTopKHit ?? null,
        citationLimitHit: traceSummary?.citationLimitHit ?? null,
        noHitSignal,
        fallbackSignal,
        lowScoreSignal,
        sourceFamilyFailureSignal: sourceFamilyFailure.isSourceFailure,
        sourceFamilyFailureFamily: sourceFamilyFailure.family,
        sourceFamilyFailureReason: sourceFamilyFailure.reason,
        traceFetchError,
        tracePrimaryIssue,
        signalFlags: {
          noHit: noHitSignal,
          fallback: fallbackSignal,
          lowScore: lowScoreSignal,
          citationLimit: citationLimitSignal,
          sourceFamilyFailure: sourceFamilyFailure.isSourceFailure
        }
      };
    })
  );

  const signalSummary = buildSignalSummary(itemDetails);
  const topKObserved = itemDetails.filter(item => item.topK != null).length;
  const topKHitCount = itemDetails.filter(item => item.rankingTopKHit === true).length;

  const output = {
    schemaVersion: "p5-v1-retrieval-regression.v1",
    generatedAt: new Date().toISOString(),
    runner: {
      baseUrl: options.baseUrl,
      qualityGateMode: options.qualityGateMode,
      replayId: runResult.replayEntry?.id ?? "p5-v1"
    },
    run: {
      questionSetId: runResult.questionSetId,
      baselineSnapshotId: runResult.baselineSnapshotId,
      assistantId: runResult.assistantId,
      startedAt: runResult.startedAt,
      finishedAt: runResult.finishedAt,
      totals: runResult.totals,
      summary: runResult.summary,
      qualityGate: runResult.qualityGate
    },
    baselineComparison: {
      comparisonMeaningful: runResult.baselineComparison?.comparisonMeaningful ?? false,
      questionSetDrift: runResult.baselineComparison?.questionSetDrift ?? null,
      diffSummary: runResult.baselineComparison?.diffSummary ?? null
    },
    signalSummary: {
      ...signalSummary,
      topKObserved,
      topKHitCount
    },
    items: itemDetails.map(item => ({
      index: item.index,
      question: item.question,
      status: item.status,
      answerStatus: item.answerStatus,
      qualityOverall: item.qualityOverall,
      qualityPrimaryIssue: item.qualityPrimaryIssue,
      topK: item.topK,
      rankingTopKHit: item.rankingTopKHit,
      citationLimitHit: item.citationLimitHit,
      usedFallback: item.usedFallback,
      noHitSignal: item.noHitSignal,
      fallbackSignal: item.fallbackSignal,
      lowScoreSignal: item.lowScoreSignal,
      sourceFamilyFailureSignal: item.sourceFamilyFailureSignal,
      sourceFamilyFailureFamily: item.sourceFamilyFailureFamily,
      sourceFamilyFailureReason: item.sourceFamilyFailureReason,
      traceFetchError: item.traceFetchError ?? null,
      signalFlags: item.signalFlags,
      tracePrimaryIssue: item.tracePrimaryIssue,
      citationCount: item.citationCount,
      traceId: item.traceId,
      conversationId: item.conversationId,
      error: item.error ?? null
    }))
  };

  const outputPrefix = buildOutputPath(options.outputPath);
  const jsonPath = `${outputPrefix}.json`;
  const markdownPath = `${outputPrefix}.md`;
  const htmlPath = `${outputPrefix}.html`;

  await mkdir(path.dirname(outputPrefix), { recursive: true });
  await writeFile(jsonPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  await writeFile(markdownPath, `${renderMarkdownReport(output)}\n`, "utf8");
  await writeFile(htmlPath, `${renderHtmlReport(output)}\n`, "utf8");

  process.stdout.write(
    [
      "P5 v1 retrieval regression reports written:",
      `- ${jsonPath}`,
      `- ${markdownPath}`,
      `- ${htmlPath}`
    ].join("\n") + "\n"
  );
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
