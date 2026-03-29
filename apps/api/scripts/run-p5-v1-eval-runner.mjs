#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_BASE_URL = process.env.RAG_EVAL_BASE_URL ?? "http://127.0.0.1:3000";
const DEFAULT_OUTPUT_DIR = path.resolve(process.cwd(), "../../storage/evals/p5-v1");

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
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }

    if (arg === "--base-url") {
      options.baseUrl = argv[i + 1] ?? options.baseUrl;
      i += 1;
      continue;
    }

    if (arg === "--output") {
      options.outputPath = argv[i + 1] ?? options.outputPath;
      i += 1;
      continue;
    }

    if (arg === "--quality-gate-mode") {
      const next = argv[i + 1];
      if (next === "warn" || next === "fail") {
        options.qualityGateMode = next;
      }
      i += 1;
      continue;
    }

    if (arg === "--user-id") {
      options.userId = argv[i + 1] ?? options.userId;
      i += 1;
    }
  }

  return options;
}

function usage() {
  return [
    "P5 v1 minimal eval runner",
    "",
    "Usage:",
    "  pnpm --filter @rag-system/api eval:runner:p5-v1 [--base-url <url>] [--output <file>] [--quality-gate-mode warn|fail] [--user-id <id>]",
    "",
    "Defaults:",
    `  --base-url ${DEFAULT_BASE_URL}`,
    "  --quality-gate-mode warn",
    "  --output <repo>/storage/evals/p5-v1/<timestamp>.json"
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

function buildOutputPath(explicitPath) {
  if (explicitPath) {
    return path.resolve(process.cwd(), explicitPath);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return path.join(DEFAULT_OUTPUT_DIR, `p5-v1-eval-${timestamp}.json`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }

  const cookieHeader = await login(options.baseUrl, options.userId);
  const runResult = await runReplay(options.baseUrl, cookieHeader, options.qualityGateMode);

  const itemDetails = await Promise.all(
    (runResult.items ?? []).map(async item => {
      if (!item.traceId) {
        return {
          ...item,
          topK: null,
          rankingTopKHit: null,
          noHitSignal: item.qualityPrimaryIssue === "no_retrieval_hits",
          tracePrimaryIssue: null
        };
      }

      const trace = await fetchTrace(options.baseUrl, cookieHeader, item.traceId);
      const traceSummary = trace?.traceSummary ?? null;
      const tracePrimaryIssue = traceSummary?.primaryIssue ?? null;

      return {
        ...item,
        topK: traceSummary?.candidateLimit ?? null,
        rankingTopKHit: traceSummary?.rankingTopKHit ?? null,
        noHitSignal:
          tracePrimaryIssue === "no_retrieval_hits" || item.qualityPrimaryIssue === "no_retrieval_hits",
        tracePrimaryIssue
      };
    })
  );

  const succeeded = itemDetails.filter(item => item.status === "succeeded").length;
  const withFallback = itemDetails.filter(item => item.usedFallback === true).length;
  const withNoHitSignal = itemDetails.filter(item => item.noHitSignal).length;
  const topKObserved = itemDetails.filter(item => item.topK != null).length;
  const topKHitCount = itemDetails.filter(item => item.rankingTopKHit === true).length;

  const output = {
    schemaVersion: "p5-v1-eval-runner.v1",
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
    signalSummary: {
      itemCount: itemDetails.length,
      succeeded,
      fallbackCount: withFallback,
      noHitCount: withNoHitSignal,
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
      usedFallback: item.usedFallback,
      noHitSignal: item.noHitSignal,
      tracePrimaryIssue: item.tracePrimaryIssue,
      citationCount: item.citationCount,
      traceId: item.traceId,
      conversationId: item.conversationId,
      error: item.error ?? null
    }))
  };

  const outputPath = buildOutputPath(options.outputPath);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");

  process.stdout.write(`P5 v1 eval runner output written: ${outputPath}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
