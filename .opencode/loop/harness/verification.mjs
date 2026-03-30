import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { relative, resolve } from "node:path";

import { appendQueueItems } from "./queue.mjs";
import { buildResumeGuidanceForSuspendedItem } from "./review.mjs";
import { QUEUE_STATUS, VERIFICATION_VERDICT, isKnownVerificationVerdict } from "./state-machine.mjs";

const VERIFICATION_ROUTING_RULES = Object.freeze({
  verification_command: {
    policyKey: "onCommandFailure",
    defaultVerdict: VERIFICATION_VERDICT.failed,
    inferredMatchers: [
      {
        name: "external_dependency_or_credentials",
        verdict: VERIFICATION_VERDICT.blockedExternal,
        reason: "inferred_external_dependency_or_credentials",
        match: inferExternalVerificationBlocker
      }
    ]
  },
  verification_artifact: {
    policyKey: "onArtifactFailure",
    defaultVerdict: VERIFICATION_VERDICT.failed,
    inferredMatchers: [
      {
        name: "manual_review_artifact",
        verdict: VERIFICATION_VERDICT.needsReview,
        reason: "inferred_manual_review_artifact",
        match: inferManualReviewArtifact
      }
    ]
  },
  verification_constraint: {
    policyKey: "onConstraintFailure",
    fallbackPolicyKey: "onVerificationFail",
    defaultVerdict: VERIFICATION_VERDICT.needsReplan,
    inferredMatchers: []
  },
  verification_acceptance: {
    policyKey: "onAcceptanceFailure",
    fallbackPolicyKey: "onVerificationFail",
    defaultVerdict: VERIFICATION_VERDICT.needsReplan,
    inferredMatchers: []
  },
  acceptance_check_failed: {
    policyKey: "onAcceptanceFailure",
    fallbackPolicyKey: "onVerificationFail",
    defaultVerdict: VERIFICATION_VERDICT.needsReplan,
    inferredMatchers: []
  }
});

export function verifyQueueItem({ repoRoot, handoffsDir, item, assistantText, executionHandoffPath }) {
  const verification = item?.verification ?? { mode: "assistant_only" };
  const mode = verification.mode ?? "assistant_only";
  const commandResults = runVerificationCommands({
    repoRoot,
    commands: verification.commands,
    commandTimeoutMs: verification.commandTimeoutMs
  });
  const artifacts = readVerificationArtifacts({
    repoRoot,
    artifactPaths: verification.artifacts,
    executionHandoffPath,
    handoffsDir
  });
  const acceptanceVerdict = computeAcceptanceVerdict({
    item,
    artifacts,
    assistantText
  });

  if (mode !== "assistant_only") {
    const failingCommand = commandResults.find(result => result.exitCode !== 0);
    if (failingCommand) {
      const failureCategory = "verification_command";
      const failureCode = failingCommand.timedOut ? "command_timeout" : "command_exit_nonzero";
      const routing = resolveVerificationFailureRouting({
        item,
        failureCategory,
        failureCode,
        fallback: VERIFICATION_VERDICT.failed,
        commandResults,
        failureDetail: {
          command: failingCommand.command,
          exitCode: failingCommand.exitCode,
          signal: failingCommand.signal,
          timedOut: failingCommand.timedOut === true
        }
      });
      return enrichSuspendedVerificationResult({
        item,
        verificationResult: {
          verdict: routing.verdict,
          summary: `Verification command failed: ${failingCommand.command}`,
          failureCategory,
          failureCode,
          routingReason: routing.routingReason,
          failureDetail: {
            command: failingCommand.command,
            exitCode: failingCommand.exitCode,
            signal: failingCommand.signal,
            timedOut: failingCommand.timedOut === true
          },
          mode,
          commands: commandResults,
          artifacts,
          acceptance: acceptanceVerdict
        }
      });
    }
  }

  if (mode === "command+artifact") {
    const missingArtifact = artifacts.find(artifact => artifact.exists !== true);
    if (missingArtifact) {
      const failureCategory = "verification_artifact";
      const failureCode = "artifact_missing";
      const routing = resolveVerificationFailureRouting({
        item,
        failureCategory,
        failureCode,
        fallback: VERIFICATION_VERDICT.failed,
        commandResults,
        artifacts,
        failureDetail: {
          path: missingArtifact.path
        }
      });
      return enrichSuspendedVerificationResult({
        item,
        verificationResult: {
          verdict: routing.verdict,
          summary: `Verification artifact missing: ${missingArtifact.path}`,
          failureCategory,
          failureCode,
          routingReason: routing.routingReason,
          failureDetail: {
            path: missingArtifact.path
          },
          mode,
          commands: commandResults,
          artifacts,
          acceptance: acceptanceVerdict
        }
      });
    }
  }

  if (!acceptanceVerdict.ok) {
    const primaryFailure = acceptanceVerdict.failures?.[0] ?? null;
    const failureCategory = primaryFailure?.category ?? "verification_acceptance";
    const failureCode = primaryFailure?.code ?? "acceptance_check_failed";
    const routing = resolveVerificationFailureRouting({
      item,
      failureCategory,
      failureCode,
      fallback: VERIFICATION_VERDICT.needsReplan,
      commandResults,
      artifacts,
      failureDetail: primaryFailure?.detail ?? null
    });
    return enrichSuspendedVerificationResult({
      item,
      verificationResult: {
        verdict: routing.verdict,
        summary: acceptanceVerdict.reasons.join("; ") || "Verification acceptance did not pass.",
        failureCategory,
        failureCode,
        routingReason: routing.routingReason,
        failureDetail: primaryFailure?.detail ?? null,
        mode,
        commands: commandResults,
        artifacts,
        acceptance: acceptanceVerdict
      }
    });
  }

  return {
    verdict: VERIFICATION_VERDICT.succeeded,
    summary: buildVerificationSuccessSummary({ mode, commandResults, artifacts, acceptanceVerdict }),
    mode,
    commands: commandResults,
    artifacts,
    acceptance: acceptanceVerdict
  };
}

export function maybeAppendVerificationFollowup({ queue, index, item, promptText, verificationResult }) {
  if (verificationResult?.verdict !== VERIFICATION_VERDICT.needsReplan) {
    return { queue, verificationResult };
  }

  const retryPolicy = item?.retryPolicy ?? {};
  const maxAttempts = Number.isInteger(retryPolicy.maxAttempts) ? retryPolicy.maxAttempts : 1;
  const attempt = Number.isInteger(item?.attempt) ? item.attempt : 0;

  if (attempt >= maxAttempts) {
    return {
      queue,
      verificationResult: {
        ...verificationResult,
        verdict: VERIFICATION_VERDICT.failed,
        failureCategory: "replan_budget",
        failureCode: "max_attempts_exhausted",
        summary: `${verificationResult.summary} RetryPolicy maxAttempts exhausted after ${attempt}/${maxAttempts} attempts.`
      }
    };
  }

  const generatedAt = new Date().toISOString();
  const followupItem = buildReplanFollowupItem({
    queue,
    item,
    promptText,
    verificationResult,
    generatedAt
  });
  const nextQueue = appendQueueItems(queue, [followupItem], generatedAt);
  return {
    queue: nextQueue,
    verificationResult: {
      ...verificationResult,
      followupItemId: followupItem.id
    }
  };
}

export function writeVerificationArtifact({ repoRoot, handoffsDir, itemId, completedAt, verificationResult }) {
  const artifactPath = resolve(
    handoffsDir,
    `${toTimestampSlug(new Date(completedAt))}-${sanitizeFileToken(itemId)}.verification.json`
  );
  writeFileSync(
    artifactPath,
    `${JSON.stringify(
      {
        itemId,
        verifiedAt: completedAt,
        ...verificationResult
      },
      null,
      2
    )}\n`,
    "utf8"
  );
  return relative(repoRoot, artifactPath).replace(/\\/g, "/");
}

function enrichSuspendedVerificationResult({ item, verificationResult }) {
  if (
    !verificationResult ||
    ![VERIFICATION_VERDICT.needsReview, VERIFICATION_VERDICT.blockedExternal].includes(verificationResult.verdict)
  ) {
    return verificationResult;
  }

  return {
    ...verificationResult,
    ...buildResumeGuidanceForSuspendedItem({
      item,
      reviewStatus: verificationResult.verdict,
      reviewReason: verificationResult.failureCode ?? verificationResult.failureCategory ?? verificationResult.routingReason
    })
  };
}

function resolveVerificationFailureRouting({ item, failureCategory, failureCode, fallback, commandResults, artifacts, failureDetail }) {
  const retryPolicy = item?.retryPolicy;
  const routingRule = resolveVerificationRoutingRule({ failureCategory, failureCode });
  const defaultVerdict = sanitizeVerificationFailureVerdict(
    fallback,
    routingRule?.defaultVerdict ?? VERIFICATION_VERDICT.failed
  );

  if (retryPolicy && typeof retryPolicy === "object") {
    const explicitVerdict = resolveExplicitVerificationFailureVerdict({
      retryPolicy,
      routingRule,
      defaultVerdict
    });
    if (explicitVerdict) {
      return {
        verdict: explicitVerdict,
        routingReason: "explicit_retry_policy"
      };
    }
  }

  const inferredVerdict = inferVerificationFailureVerdict({
    routingRule,
    failureDetail,
    commandResults,
    artifacts
  });
  if (inferredVerdict) {
    return inferredVerdict;
  }

  return {
    verdict: defaultVerdict,
    routingReason: "default_fallback"
  };
}

function resolveExplicitVerificationFailureVerdict({ retryPolicy, routingRule, defaultVerdict }) {
  if (!routingRule) {
    return undefined;
  }

  const directValue = typeof routingRule.policyKey === "string" ? retryPolicy[routingRule.policyKey] : undefined;
  if (typeof directValue === "string") {
    return maybeSanitizeVerificationFailureVerdict(directValue, defaultVerdict);
  }

  const fallbackValue =
    typeof routingRule.fallbackPolicyKey === "string" ? retryPolicy[routingRule.fallbackPolicyKey] : undefined;
  if (typeof fallbackValue === "string") {
    return maybeSanitizeVerificationFailureVerdict(fallbackValue, defaultVerdict);
  }

  return undefined;
}

function maybeSanitizeVerificationFailureVerdict(value, defaultVerdict) {
  if (typeof value !== "string") {
    return undefined;
  }
  return sanitizeVerificationFailureVerdict(value, defaultVerdict);
}

function sanitizeVerificationFailureVerdict(value, fallback) {
  return typeof value === "string" && isKnownVerificationVerdict(value) ? value : fallback;
}

function inferVerificationFailureVerdict({ routingRule, failureDetail, commandResults, artifacts }) {
  const matchers = Array.isArray(routingRule?.inferredMatchers) ? routingRule.inferredMatchers : [];
  for (const matcher of matchers) {
    if (typeof matcher?.match !== "function") {
      continue;
    }

    const matched = matcher.match({ failureDetail, commandResults, artifacts });
    if (!matched) {
      continue;
    }

    return {
      verdict: matcher.verdict,
      routingReason: typeof matched === "string" ? matched : matcher.reason
    };
  }

  return null;
}

function resolveVerificationRoutingRule({ failureCategory, failureCode }) {
  if (typeof failureCategory === "string" && VERIFICATION_ROUTING_RULES[failureCategory]) {
    return VERIFICATION_ROUTING_RULES[failureCategory];
  }

  if (typeof failureCode === "string" && VERIFICATION_ROUTING_RULES[failureCode]) {
    return VERIFICATION_ROUTING_RULES[failureCode];
  }

  return null;
}

function inferExternalVerificationBlocker({ failureDetail, commandResults }) {
  const commandText = typeof failureDetail?.command === "string" ? failureDetail.command : "";
  const outputText = (Array.isArray(commandResults) ? commandResults : [])
    .flatMap(result => [result?.stdout, result?.stderr, result?.command])
    .filter(value => typeof value === "string" && value.trim())
    .join("\n")
    .toLowerCase();
  const combined = `${commandText}\n${outputText}`.toLowerCase();

  const explicitExternalPatterns = [
    "credential",
    "credentials",
    "api key",
    "token",
    "oauth",
    "auth required",
    "authentication",
    "unauthorized",
    "forbidden",
    "permission denied",
    "access denied",
    "network",
    "dns",
    "timed out",
    "timeout",
    "connection refused",
    "econnrefused",
    "econnreset",
    "enotfound",
    "service unavailable",
    "temporary failure"
  ];

  if (explicitExternalPatterns.some(pattern => combined.includes(pattern))) {
    return "inferred_external_dependency_or_credentials";
  }

  return null;
}

function inferManualReviewArtifact({ failureDetail, artifacts }) {
  const candidates = [failureDetail?.path, ...(Array.isArray(artifacts) ? artifacts.map(artifact => artifact?.path) : [])]
    .filter(value => typeof value === "string" && value.trim())
    .map(value => value.toLowerCase());
  return candidates.some(value => value.includes("manual-review") || value.includes("approval"))
    ? "inferred_manual_review_artifact"
    : null;
}

function buildReplanFollowupItem({ queue, item, promptText, verificationResult, generatedAt }) {
  const sourceId = item?.id ?? "item";
  return {
    ...item,
    id: allocateReplanItemId(queue, sourceId),
    title: buildReplanTitle(item),
    promptText: buildReplanPromptText({ item, promptText, verificationResult }),
    status: QUEUE_STATUS.pending,
    attempt: Number.isInteger(item?.attempt) ? item.attempt : 0,
    parentId: sourceId,
    originVerdict: verificationResult?.verdict ?? VERIFICATION_VERDICT.needsReplan,
    generatedAt,
    sessionId: undefined,
    messageId: undefined,
    messageReceivedAt: undefined,
    startedAt: undefined,
    resumedAt: undefined,
    handoffPath: undefined,
    verificationArtifactPath: undefined,
    verificationVerdict: undefined,
    verificationSummary: undefined,
    verificationResult: undefined,
    verificationStartedAt: undefined,
    verifiedAt: undefined,
    runId: undefined,
    resumeWhen: undefined,
    resumeHint: undefined,
    lastSuspendedStatus: undefined,
    resumeApprovedAt: undefined,
    resumeNote: undefined
  };
}

function allocateReplanItemId(queue, sourceId) {
  const baseId = `${sourceId}--replan`;
  const existingIds = new Set((Array.isArray(queue?.items) ? queue.items : []).map(item => item?.id).filter(Boolean));

  for (let sequence = 1; sequence < 1000; sequence += 1) {
    const candidate = `${baseId}-${String(sequence).padStart(3, "0")}`;
    if (!existingIds.has(candidate)) {
      return candidate;
    }
  }

  throw new Error(`Could not allocate replan follow-up id for ${sourceId}.`);
}

function buildReplanTitle(item) {
  const baseTitle = typeof item?.title === "string" && item.title.trim() ? item.title.trim() : item?.id ?? "Queued item";
  return `${baseTitle} (replan)`;
}

function buildReplanPromptText({ item, promptText, verificationResult }) {
  const sections = [
    "Retry the same task with a narrower fix based on the failed verification evidence.",
    `Original item: ${item?.id ?? "unknown"}`,
    `Previous verification verdict: ${verificationResult?.verdict ?? "needs_replan"}`,
    verificationResult?.summary ? `Verification summary: ${verificationResult.summary}` : null,
    buildReplanGuidance(verificationResult),
    "Original task prompt:",
    promptText
  ].filter(Boolean);

  return sections.join("\n\n");
}

function buildReplanGuidance(verificationResult) {
  const failure = verificationResult?.acceptance?.failures?.[0] ?? null;
  if (!failure) {
    return "Only change the narrow code path needed to satisfy the same verifier; keep scope and verification contract unchanged.";
  }

  if (failure.category === "verification_acceptance") {
    return buildMetricTargetedReplanGuidance({
      intro: "Acceptance guidance: Focus on the implementation gap that prevented acceptance from passing.",
      detail: failure.detail,
      fallback: "Only fix the behavior needed to satisfy the missed acceptance target; do not broaden scope."
    });
  }

  if (failure.category === "verification_constraint") {
    return buildMetricTargetedReplanGuidance({
      intro: "Constraint guidance: Focus on the regression that violated the declared bound.",
      detail: failure.detail,
      fallback: "Only fix the regression against the declared constraint; keep all other behavior unchanged."
    });
  }

  return "Only change the smallest code or artifact path needed to satisfy the verifier on the next run.";
}

function buildMetricTargetedReplanGuidance({ intro, detail, fallback }) {
  const metricName = detail?.metricName;
  const rule = detail?.rule;
  const actualValue = detail?.actualValue;
  if (!metricName || !rule) {
    return fallback;
  }

  return `${intro} Target metric \`${metricName}\` expected \`${rule}\` but got \`${actualValue ?? "missing"}\`; change only the code or artifact path that influences this metric, then rerun the same verifier evidence path.`;
}

function runVerificationCommands({ repoRoot, commands, commandTimeoutMs }) {
  const normalizedCommands = Array.isArray(commands)
    ? commands.filter(command => typeof command === "string" && command.trim()).map(command => command.trim())
    : [];

  const results = [];
  for (const command of normalizedCommands) {
    const resolvedCommand = rewriteShellCommandForTooling({ repoRoot, command });
    const commandResult = spawnSync(resolvedCommand, {
      cwd: repoRoot,
      shell: true,
      encoding: "utf8",
      timeout: Number.isInteger(commandTimeoutMs) && commandTimeoutMs > 0 ? commandTimeoutMs : 300000,
      env: buildVerificationCommandEnv()
    });
    results.push({
      command: resolvedCommand,
      exitCode: typeof commandResult.status === "number" ? commandResult.status : 1,
      signal: commandResult.signal ?? null,
      stdout: truncateForArtifact(commandResult.stdout),
      stderr: truncateForArtifact(commandResult.stderr),
      timedOut: commandResult.error?.code === "ETIMEDOUT"
    });

    if ((typeof commandResult.status === "number" ? commandResult.status : 1) !== 0) {
      break;
    }
  }

  return results;
}

function rewriteShellCommandForTooling({ repoRoot, command }) {
  if (typeof command !== "string" || !command.trim()) {
    return command;
  }

  const directApiTestCommand = normalizeApiTestFileCommand({ repoRoot, command });
  if (directApiTestCommand) {
    return directApiTestCommand;
  }

  const pnpmLauncher = resolvePnpmLauncherForShell();
  if (!pnpmLauncher) {
    return command;
  }

  return command.replace(/(^|[;&|(]\s*)pnpm(?=\s|$)/g, `$1${pnpmLauncher}`);
}

function normalizeApiTestFileCommand({ repoRoot, command }) {
  const match =
    command.match(/^pnpm\s+--filter\s+@rag-system\/api\s+test:file\s+--\s+(.+)$/u) ??
    command.match(/^pnpm\s+test:api:file\s+--\s+(.+)$/u);
  if (!match) {
    return null;
  }

  const testArgs = match[1].trim();
  if (!testArgs) {
    return null;
  }

  const runTestFileScript = resolve(repoRoot, "apps/api/scripts/run-test-file.mjs");
  return `${shellQuote(process.execPath)} ${shellQuote(runTestFileScript)} -- ${testArgs}`;
}

function buildVerificationCommandEnv() {
  const env = { ...process.env };
  const home = env.HOME;
  const pathEntries = [];

  const appendIfPresent = candidate => {
    if (!candidate || !existsSync(candidate)) {
      return;
    }
    pathEntries.push(candidate);
  };

  if (home) {
    appendIfPresent(join(home, ".volta", "bin"));
    appendIfPresent(join(home, ".local", "share", "pnpm"));
    appendIfPresent(join(home, ".local", "bin"));
  }

  appendIfPresent(dirname(resolveDirectPnpmBinary() ?? ""));
  appendIfPresent(dirname(resolveCorepackBinary() ?? ""));
  appendIfPresent(dirname(process.execPath));

  env.PATH = [...pathEntries, ...(env.PATH ?? "").split(":").filter(Boolean)].join(":");
  if (home && !env.VOLTA_HOME) {
    env.VOLTA_HOME = join(home, ".volta");
  }
  const directPnpm = resolveDirectPnpmBinary();
  if (directPnpm) {
    env.PNPM_HOME = dirname(directPnpm);
  }
  return env;
}

function resolvePnpmLauncherForShell() {
  const directPnpm = resolveDirectPnpmBinary();
  if (directPnpm) {
    return shellQuote(directPnpm);
  }

  const corepack = resolveCorepackBinary();
  if (corepack) {
    return `${shellQuote(corepack)} pnpm`;
  }

  return null;
}

function resolveDirectPnpmBinary() {
  const home = process.env.HOME;
  const candidates = [
    home ? join(home, ".volta", "bin", "pnpm") : null,
    home ? join(home, ".local", "share", "pnpm", "pnpm") : null,
    home ? join(home, ".local", "bin", "pnpm") : null
  ];

  for (const candidate of candidates) {
    if (candidate && existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

function resolveCorepackBinary() {
  const home = process.env.HOME;
  const candidates = [join(dirname(process.execPath), "corepack")];

  if (home) {
    candidates.push(join(home, ".volta", "bin", "corepack"));
    candidates.push(...resolveNvmCorepackCandidates(home));
  }

  candidates.push("/usr/bin/corepack", "/usr/local/bin/corepack");

  for (const candidate of candidates) {
    if (candidate && existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

function resolveNvmCorepackCandidates(home) {
  const versionsDir = join(home, ".nvm", "versions", "node");
  if (!existsSync(versionsDir)) {
    return [];
  }

  try {
    return readdirSync(versionsDir)
      .map(version => join(versionsDir, version, "bin", "corepack"))
      .filter(candidate => existsSync(candidate));
  } catch {
    return [];
  }
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function readVerificationArtifacts({ repoRoot, artifactPaths, executionHandoffPath, handoffsDir }) {
  const normalizedPaths = Array.isArray(artifactPaths)
    ? artifactPaths.filter(path => typeof path === "string" && path.trim()).map(path => path.trim())
    : [];
  const builtInArtifacts = executionHandoffPath ? [executionHandoffPath] : [];
  const allPaths = [...new Set([...normalizedPaths, ...builtInArtifacts])];

  return allPaths.map(path => {
    const absolutePath = resolve(repoRoot, path);
    const exists = existsSync(absolutePath);
    const artifact = {
      path,
      exists
    };

    if (!exists) {
      return artifact;
    }

    if (absolutePath.startsWith(handoffsDir)) {
      artifact.kind = "handoff";
    }

    try {
      const raw = readFileSync(absolutePath, "utf8");
      artifact.preview = truncateForArtifact(raw);
      if (absolutePath.endsWith(".json")) {
        artifact.json = JSON.parse(raw);
      }
    } catch (error) {
      artifact.readError = error instanceof Error ? error.message : String(error);
    }

    return artifact;
  });
}

function computeAcceptanceVerdict({ item, artifacts }) {
  const reasons = [];
  const failures = [];
  const acceptance = item?.acceptance;
  const constraints = item?.constraints;
  const jsonMetrics = collectJsonMetrics(artifacts);

  if (acceptance?.metrics && typeof acceptance.metrics === "object") {
    for (const [metricName, rule] of Object.entries(acceptance.metrics)) {
      const actualValue = jsonMetrics[metricName];
      if (!evaluateMetricRule(actualValue, rule)) {
        reasons.push(`acceptance metric ${metricName} expected ${rule}, got ${actualValue ?? "missing"}`);
        failures.push({
          category: "verification_acceptance",
          code: "acceptance_metric_failed",
          detail: {
            metricName,
            rule,
            actualValue: actualValue ?? null
          }
        });
      }
    }
  }

  if (constraints && typeof constraints === "object") {
    for (const [metricName, rule] of Object.entries(constraints)) {
      const actualValue = jsonMetrics[metricName];
      if (!evaluateMetricRule(actualValue, rule)) {
        reasons.push(`constraint ${metricName} expected ${rule}, got ${actualValue ?? "missing"}`);
        failures.push({
          category: "verification_constraint",
          code: "constraint_metric_failed",
          detail: {
            metricName,
            rule,
            actualValue: actualValue ?? null
          }
        });
      }
    }
  }

  return {
    ok: reasons.length === 0,
    reasons,
    failures,
    metrics: Object.keys(jsonMetrics).length > 0 ? jsonMetrics : undefined
  };
}

function collectJsonMetrics(artifacts) {
  const metrics = {};
  for (const artifact of Array.isArray(artifacts) ? artifacts : []) {
    if (!artifact?.json || typeof artifact.json !== "object" || Array.isArray(artifact.json)) {
      continue;
    }

    Object.assign(metrics, flattenNumericObject(artifact.json));
  }
  return metrics;
}

function flattenNumericObject(value, prefix = "") {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const flattened = {};
  for (const [key, nestedValue] of Object.entries(value)) {
    const nextKey = prefix ? `${prefix}.${key}` : key;
    if (typeof nestedValue === "number") {
      flattened[nextKey] = nestedValue;
      flattened[key] ??= nestedValue;
      continue;
    }

    if (nestedValue && typeof nestedValue === "object" && !Array.isArray(nestedValue)) {
      Object.assign(flattened, flattenNumericObject(nestedValue, nextKey));
    }
  }

  return flattened;
}

function evaluateMetricRule(actualValue, rule) {
  if (typeof rule === "number") {
    return actualValue === rule;
  }

  if (typeof actualValue !== "number" || typeof rule !== "string") {
    return false;
  }

  const match = rule.trim().match(/^(>=|<=|>|<|==?)\s*(-?\d+(?:\.\d+)?)$/);
  if (!match) {
    return false;
  }

  const operator = match[1];
  const expectedValue = Number.parseFloat(match[2]);
  switch (operator) {
    case ">=":
      return actualValue >= expectedValue;
    case "<=":
      return actualValue <= expectedValue;
    case ">":
      return actualValue > expectedValue;
    case "<":
      return actualValue < expectedValue;
    case "=":
    case "==":
      return actualValue === expectedValue;
    default:
      return false;
  }
}

function buildVerificationSuccessSummary({ mode, commandResults, artifacts, acceptanceVerdict }) {
  const summaryParts = [`mode=${mode}`];
  if (commandResults.length > 0) {
    summaryParts.push(`commands=${commandResults.length}`);
  }
  if (artifacts.length > 0) {
    summaryParts.push(`artifacts=${artifacts.filter(artifact => artifact.exists).length}/${artifacts.length}`);
  }
  if (acceptanceVerdict?.metrics) {
    summaryParts.push(`metrics=${Object.keys(acceptanceVerdict.metrics).length}`);
  }
  return summaryParts.join("; ");
}

function truncateForArtifact(value) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  return trimmed.length > 2000 ? `${trimmed.slice(0, 2000)}...` : trimmed;
}

function sanitizeFileToken(value) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-");
}

function toTimestampSlug(date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}
