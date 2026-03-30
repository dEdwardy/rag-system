import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { relative, resolve } from "node:path";

import { appendQueueItems, formatDisplayTime, formatSessionTitleTime, writeQueue } from "./queue.mjs";

export const DEFAULT_PLANNER_PROMPT_PATH = "prompts/plan-next.md";
export const DEFAULT_PLANNER_PROMPT_FILE_NAME = "plan-next.md";
export const DEFAULT_AUTO_REFILL_MAX_CYCLES = 1;
export const DEFAULT_AUTO_REFILL_MAX_ITEMS = 2;

const DOC_INGESTION_SCOPE = [
  "AGENTS.md",
  "docs/next_steps_rag_project_plan.md",
  "docs/current-progress.md",
  "docs/current-dev-setup.md",
  "README.md",
  ".opencode/loop/README.md"
];

const TASK_DECOMPOSITION_RULES = {
  plannerMode: "derive_next_safe_executable_queue_wave",
  decompositionBias: [
    "continue the current documented mainline before opening a new track",
    "prefer one small executable increment per queue item",
    "keep each item scoped to one codepath or one docs sync",
    "prefer exact files, one focused validation command, and explicit closeout boundaries",
    "delay human intervention by classifying blocked items separately and continuing executable items first"
  ],
  doNotPlan: [
    "broad refactors or architecture reshaping",
    "parallel feature waves when docs recommend a single mainline",
    "cleanup-only churn without a documented gap",
    "tasks that require multiple unrelated validations or speculative abstractions"
  ],
  queueGenerationContract: [
    "derive tasks from the repo docs and current queue state, not from generic backlog ideas",
    "emit only items that are safe for unattended queue execution",
    "include verification and retry metadata when the docs or codepath imply them",
    "use reviewRequired only for genuine pre-execution human gates",
    "classify candidate tasks as executable, deferred, or blocked_human_late before materializing queue items"
  ]
};

const PLAN_EXTRACTION_SCHEMA = {
  objective: "current objective or wave goal derived from docs",
  constraints: "documented do-not-do boundaries and execution guardrails",
  currentState: "what is already completed, what remains, and current queue posture",
  candidateTasks: {
    executable: "safe unattended tasks that can be materialized now",
    deferred: "valid later tasks that should not enter the current wave yet",
    blockedHumanLate: "tasks that still need human choice/input but should be postponed behind executable work"
  },
  queueItemMinimumFields: [
    "title",
    "goal",
    "prompt",
    "verification",
    "retryPolicy",
    "riskLevel"
  ]
};

export function initializeAutoRefillState(queue, options = {}) {
  const maxCycles = normalizeNonNegativeInteger(options.maxCycles, DEFAULT_AUTO_REFILL_MAX_CYCLES);
  const maxItems = normalizePositiveInteger(options.maxItems, DEFAULT_AUTO_REFILL_MAX_ITEMS);
  const scopeKey = buildAutoRefillScopeKey(queue);
  const persisted = normalizePersistedAutoRefill(queue?.autoRefill, scopeKey);

  return {
    cycles: persisted.cycles,
    maxCycles,
    maxItems,
    scopeKey
  };
}

export async function maybeAutoRefillQueue({
  api,
  repoRoot,
  loopRoot,
  queuePath,
  handoffsDir,
  queue,
  commandConfig,
  autoRefillState,
  logStatus,
  extractAssistantText
}) {
  syncAutoRefillScope(queue, autoRefillState);

  if ((autoRefillState?.maxCycles ?? 0) <= 0) {
    return { queue, generatedItems: [], plannerSessionId: null, plannerMessageId: null, handoffPath: null };
  }

  if ((autoRefillState?.cycles ?? 0) >= autoRefillState.maxCycles) {
    return { queue, generatedItems: [], plannerSessionId: null, plannerMessageId: null, handoffPath: null };
  }

  const queuePromptPath = resolve(loopRoot, DEFAULT_PLANNER_PROMPT_PATH);
  const plannerPromptText = composePlannerPrompt({
    plannerPromptTemplate: readFileSync(queuePromptPath, "utf8").trim(),
    queue,
    repoRoot,
    handoffsDir,
    maxItems: autoRefillState.maxItems
  });

  const plannerCommand = commandConfig.plan ?? commandConfig.build ?? null;
  const plannerAgent = plannerCommand?.agent ?? commandConfig.build?.agent ?? "rag-plan";
  const plannerModel = plannerCommand?.model ?? commandConfig.build?.model;

  logStatus("plan", {
    agent: plannerAgent,
    model: plannerModel ?? "server-default",
    maxAutoRefillCycles: autoRefillState.maxCycles,
    autoRefillCycle: autoRefillState.cycles + 1,
    autoRefillMaxItems: autoRefillState.maxItems
  });

  const plannedAt = new Date().toISOString();
  const session = await api.createSession({
    title: `loop planner #${autoRefillState.cycles + 1} · ${formatSessionTitleTime(plannedAt)}`
  });
  const message = await api.sendMessage({
    sessionId: session.id,
    agent: plannerAgent,
    model: plannerModel,
    promptText: plannerPromptText
  });

  const assistantText = extractAssistantText(message.parts).trim();
  const proposals = normalizePlannerProposals(parsePlannerResponse(assistantText), autoRefillState.maxItems);
  const generatedAt = new Date().toISOString();
  const generatedPromptsDir = resolve(loopRoot, "prompts", "generated");
  mkdirSync(generatedPromptsDir, { recursive: true });

  const existingFingerprints = buildExistingFingerprintSet(queue, loopRoot);
  const generatedItems = [];

  for (const proposal of proposals) {
    const id = allocateGeneratedItemId({ queue, generatedItems, family: proposal.family });
    const title = proposal.title;
    const prompt = proposal.prompt;
    const fingerprint = fingerprintQueueItem(title, prompt);
    if (existingFingerprints.has(fingerprint)) {
      continue;
    }

    const relativePromptPath = `prompts/generated/${id}.md`;
    writeFileSync(resolve(loopRoot, relativePromptPath), `${prompt.trim()}\n`, "utf8");

    generatedItems.push({
      id,
      version: 2,
      title,
      kind: proposal.kind,
      goal: proposal.goal,
      agent: proposal.agent ?? commandConfig.build?.agent ?? "rag-build",
      model: proposal.model ?? commandConfig.build?.model,
      promptFile: relativePromptPath,
      status: "pending",
      ...(proposal.acceptance ? { acceptance: proposal.acceptance } : {}),
      ...(proposal.constraints ? { constraints: proposal.constraints } : {}),
      ...(proposal.verification ? { verification: proposal.verification } : {}),
      ...(proposal.retryPolicy ? { retryPolicy: proposal.retryPolicy } : {}),
      attempt: 0,
      ...(proposal.riskLevel ? { riskLevel: proposal.riskLevel } : {}),
      ...(proposal.reviewRequired === true ? { reviewRequired: true } : {}),
      ...(proposal.escalationPolicy ? { escalationPolicy: proposal.escalationPolicy } : {}),
      generatedAt,
      plannerSessionId: session.id,
      plannerMessageId: message.info?.id ?? null,
      plannerFamily: proposal.family,
      plannerSource: "auto-refill"
    });
    existingFingerprints.add(fingerprint);
  }

  const plannerHandoffPath = resolve(
    handoffsDir,
    `${generatedAt.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")}-planner-auto-refill.md`
  );
  writeFileSync(
    plannerHandoffPath,
    renderPlannerHandoff({
      sessionId: session.id,
      messageId: message.info?.id ?? "unknown",
      plannedAt: generatedAt,
      promptText: plannerPromptText,
      assistantText,
      generatedItems
    }),
    "utf8"
  );

  if (generatedItems.length === 0) {
    autoRefillState.cycles += 1;
    const persistedQueue = withPersistedAutoRefillState(queue, autoRefillState, generatedAt);
    writeQueue(queuePath, persistedQueue);
    logStatus("refill:skip", {
      plannerSessionId: session.id,
      plannerMessageId: message.info?.id ?? "unknown",
      handoffPath: relative(repoRoot, plannerHandoffPath).replace(/\\/g, "/")
    });
    return {
      queue: persistedQueue,
      generatedItems,
      plannerSessionId: session.id,
      plannerMessageId: message.info?.id ?? null,
      handoffPath: relative(repoRoot, plannerHandoffPath).replace(/\\/g, "/")
    };
  }

  const appendedQueue = appendQueueItems(queue, generatedItems, generatedAt);
  autoRefillState.cycles += 1;
  const updatedQueue = withPersistedAutoRefillState(appendedQueue, autoRefillState, generatedAt);
  writeQueue(queuePath, updatedQueue);

  logStatus("refill", {
    plannerSessionId: session.id,
    plannerMessageId: message.info?.id ?? "unknown",
    generatedCount: generatedItems.length,
    generatedItemIds: generatedItems.map(item => item.id),
    handoffPath: relative(repoRoot, plannerHandoffPath).replace(/\\/g, "/")
  });

  return {
    queue: updatedQueue,
    generatedItems,
    plannerSessionId: session.id,
    plannerMessageId: message.info?.id ?? null,
    handoffPath: relative(repoRoot, plannerHandoffPath).replace(/\\/g, "/")
  };
}

export function buildAutoRefillScopeKey(queue) {
  const manualItems = Array.isArray(queue?.items)
    ? queue.items.filter(item => item && item.plannerSource !== "auto-refill")
    : [];

  return JSON.stringify(
    manualItems.map(item => ({
      id: item.id ?? null,
      title: item.title ?? null,
      promptFile: item.promptFile ?? null,
      promptText: item.promptText ?? null,
      agent: item.agent ?? null,
      model: item.model ?? null
    }))
  );
}

function normalizePersistedAutoRefill(autoRefill, scopeKey) {
  if (!autoRefill || typeof autoRefill !== "object" || Array.isArray(autoRefill)) {
    return { cycles: 0 };
  }

  if (autoRefill.scopeKey !== scopeKey) {
    return { cycles: 0 };
  }

  return {
    cycles: normalizeNonNegativeInteger(autoRefill.cycles, 0)
  };
}

function syncAutoRefillScope(queue, autoRefillState) {
  const scopeKey = buildAutoRefillScopeKey(queue);
  if (autoRefillState.scopeKey === scopeKey) {
    return;
  }

  autoRefillState.scopeKey = scopeKey;
  autoRefillState.cycles = 0;
}

function withPersistedAutoRefillState(queue, autoRefillState, updatedAt) {
  return {
    ...queue,
    autoRefill: {
      scopeKey: autoRefillState.scopeKey,
      cycles: normalizeNonNegativeInteger(autoRefillState.cycles, 0)
    },
    updatedAt
  };
}

function normalizeNonNegativeInteger(value, fallback) {
  return Number.isInteger(value) && value >= 0 ? value : fallback;
}

function normalizePositiveInteger(value, fallback) {
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function composePlannerPrompt({ plannerPromptTemplate, queue, repoRoot, handoffsDir, maxItems }) {
  const recentItems = extractRecentCompletedItems(queue, repoRoot, handoffsDir);
  const queueSummary = buildQueueSummary(queue);
  const docPlanningSnapshot = buildDocPlanningSnapshot(repoRoot, queue);
  const recentSummary =
    recentItems.length > 0
      ? recentItems
          .map(item => {
            const lines = [`- ${item.id}: ${item.title}`];
            if (item.resultSummary) {
              lines.push(`  result: ${item.resultSummary}`);
            }
            return lines.join("\n");
          })
          .join("\n")
      : "- no recent completed items";

  return [
    "Planner mode: propose the next narrow queue refill only.",
    plannerPromptTemplate,
    `Return at most ${maxItems} items.`,
    "Doc-derived planning snapshot:",
    JSON.stringify(docPlanningSnapshot, null, 2),
    "Task decomposition contract:",
    JSON.stringify(TASK_DECOMPOSITION_RULES, null, 2),
    "Current queue summary:",
    queueSummary,
    "Recent completed queue items:",
    recentSummary
  ].join("\n\n");
}

function buildDocPlanningSnapshot(repoRoot, queue) {
  const docs = DOC_INGESTION_SCOPE.map(path => readScopedDoc(repoRoot, path));

  return {
    docIngestionScope: docs.map(doc => ({
      path: doc.path,
      status: doc.status,
      purpose: doc.purpose
    })),
    missingDocs: docs.filter(doc => doc.status === "missing").map(doc => doc.path),
    repoDirection: docs.flatMap(doc => doc.repoDirection ?? []).slice(0, 8),
    currentPrioritySignals: docs.flatMap(doc => doc.currentPrioritySignals ?? []).slice(0, 8),
    currentProgressSignals: docs.flatMap(doc => doc.currentProgressSignals ?? []).slice(0, 8),
    executionConstraints: docs.flatMap(doc => doc.executionConstraints ?? []).slice(0, 8),
    validationBaseline: docs.flatMap(doc => doc.validationBaseline ?? []).slice(0, 6),
    harnessContractSignals: docs.flatMap(doc => doc.harnessContractSignals ?? []).slice(0, 8),
    planExtractionSchema: PLAN_EXTRACTION_SCHEMA,
    extractedPlan: buildStructuredPlanExtraction(docs, queue),
    queueState: buildPlannerQueueState(queue)
  };
}

function buildStructuredPlanExtraction(docs, queue) {
  const nextStepsDoc = docs.find(doc => doc.path === "docs/next_steps_rag_project_plan.md");
  const progressDoc = docs.find(doc => doc.path === "docs/current-progress.md");

  const nextStepsText = typeof nextStepsDoc?.text === "string" ? nextStepsDoc.text : "";
  const progressText = typeof progressDoc?.text === "string" ? progressDoc.text : "";
  const phases = parsePlanPhases(nextStepsText);
  const queueTasks = extractQueueReadyTasks(nextStepsText, phases);
  const groupedTasks = classifyQueueReadyTasks(queueTasks);
  const currentMainline = extractCurrentMainline(nextStepsText, phases);
  const recommendedOrder = extractRecommendedPhaseOrder(nextStepsText);

  return {
    objective: extractCurrentObjective(nextStepsText),
    currentMainline,
    recommendedPhaseOrder: recommendedOrder,
    currentState: {
      completedPhases: phases.filter(phase => phase.status === "completed").map(phase => phase.phase),
      activePhases: phases.filter(phase => phase.status !== "completed").map(phase => phase.phase),
      queueStatus: summarizeQueueStateForPlanner(queue),
      recentProgressNotes: extractLatestProgressNotes(progressText, 4)
    },
    constraints: extractPlanConstraints(nextStepsText),
    candidateTasks: groupedTasks
  };
}

function readScopedDoc(repoRoot, relativePath) {
  const absolutePath = resolve(repoRoot, relativePath);
  const purpose = describeDocPurpose(relativePath);

  try {
    const text = readFileSync(absolutePath, "utf8");
    return {
      path: relativePath,
      status: "loaded",
      purpose,
      text,
      repoDirection: extractDocSignals(text, buildSignalPatterns(relativePath, "repoDirection"), 3),
      currentPrioritySignals: extractDocSignals(text, buildSignalPatterns(relativePath, "currentPrioritySignals"), 4),
      currentProgressSignals: extractDocSignals(text, buildSignalPatterns(relativePath, "currentProgressSignals"), 4),
      executionConstraints: extractDocSignals(text, buildSignalPatterns(relativePath, "executionConstraints"), 4),
      validationBaseline: extractDocSignals(text, buildSignalPatterns(relativePath, "validationBaseline"), 3),
      harnessContractSignals: extractDocSignals(text, buildSignalPatterns(relativePath, "harnessContractSignals"), 4)
    };
  } catch {
    return {
      path: relativePath,
      status: "missing",
      purpose,
      text: "",
      repoDirection: [],
      currentPrioritySignals: [],
      currentProgressSignals: [],
      executionConstraints: [],
      validationBaseline: [],
      harnessContractSignals: []
    };
  }
}

function describeDocPurpose(relativePath) {
  if (relativePath === "AGENTS.md") {
    return "repository execution rules";
  }
  if (relativePath === "docs/next_steps_rag_project_plan.md") {
    return "current priority and boundary plan";
  }
  if (relativePath === "docs/current-progress.md") {
    return "landed increments and active status";
  }
  if (relativePath === "docs/current-dev-setup.md") {
    return "developer workflow and validation context";
  }
  if (relativePath === "README.md") {
    return "repo overview and product framing";
  }
  if (relativePath === ".opencode/loop/README.md") {
    return "loop harness runtime contract";
  }
  return "repo doc";
}

function buildSignalPatterns(relativePath, field) {
  const defaults = {
    repoDirection: [/(small|narrow|increment|additive|reversible|stability|single mainline|single-line|backend\/API-first)/i],
    currentPrioritySignals: [/(current recommended|recommended mainline|priority|P[0-9]+|follow-up|next safe|next wave|remaining safe gap)/i],
    currentProgressSignals: [/(已完成|closeout|current queue|auto-refill|planner|queue wave|waiting|等待|progress|completed)/i],
    executionConstraints: [/(do not|avoid|prefer|keep scope|no bundled refactors|no new architecture|guarded|safe)/i],
    validationBaseline: [/(focused validation|pnpm |node \.opencode\/loop\/cli\.mjs --self-test|git diff --check|typecheck|lint|build)/i],
    harnessContractSignals: [/(\.opencode\/loop|queue\.json|plan-next|planner|generated prompt|auto-refill|verification|handoff)/i]
  };

  if (relativePath === "docs/current-progress.md" && field === "currentProgressSignals") {
    return [/(补充进展|已完成|closeout|queue wave|waiting|等待人工批准|auto-refill|planner)/i];
  }
  if (relativePath === "docs/next_steps_rag_project_plan.md" && field === "currentPrioritySignals") {
    return [/(current recommended|recommended mainline|P[0-9]+|follow-up|remaining safe gap|mainline)/i];
  }
  if (relativePath === ".opencode/loop/README.md" && field === "harnessContractSignals") {
    return [/(planner|queue item|verification|auto-refill|generated refill|reviewRequired|retryPolicy)/i];
  }

  return defaults[field] ?? [];
}

function parsePlanPhases(text) {
  const phases = [];
  const regex = /^###\s+(P\d+)[：:]\s*(.+)$/gm;

  for (const match of text.matchAll(regex)) {
    const phase = match[1];
    const rawTitle = squashWhitespace(match[2]);
    const status = /已收口|已完成/.test(rawTitle) ? "completed" : "active";
    phases.push({
      phase,
      title: rawTitle.replace(/（[^）]*）/g, "").trim(),
      status
    });
  }

  return phases;
}

function extractCurrentObjective(text) {
  const explicit = matchFirstLine(text, [/Given repo docs and current progress/i, /^\*\*`(.+?)`\*\*$/m]);
  if (explicit) {
    return explicit;
  }

  const currentPhaseConclusion = matchFirstLine(text, [/^\*\*`P\d+.*$/m, /^\*\*.+\*\*$/m]);
  if (currentPhaseConclusion) {
    return currentPhaseConclusion;
  }

  const oneLine = matchFirstLine(text, [/当前更合适的下一最小增量是.+/]);
  return oneLine ?? "derive the next safe executable queue wave from current docs";
}

function extractCurrentMainline(text, phases) {
  const line = matchFirstLine(text, [/Current recommended mainline[:：].+/i, /当前更合适的下一最小增量是.+/, /当前默认视.+作为下一主线/]);
  if (line) {
    return line;
  }

  const recommendedOrder = extractRecommendedPhaseOrder(text);
  if (recommendedOrder.length > 0) {
    return recommendedOrder[0];
  }

  const firstActive = phases.find(phase => phase.status !== "completed");
  return firstActive ? `${firstActive.phase} ${firstActive.title}` : null;
}

function extractRecommendedPhaseOrder(text) {
  const block = extractSectionBlock(text, /^####\s+当前阶段推荐大类顺序/m, [/^####\s+/m, /^###\s+/m]);
  if (!block) {
    return [];
  }

  return Array.from(block.matchAll(/^\d+\.\s+`?([^`\n]+?)`?$/gm)).map(match => squashWhitespace(match[1]));
}

function extractPlanConstraints(text) {
  const lines = [];
  const section = extractSectionBlock(text, /^###\s+P0[：:].+$/m, [/^###\s+/m]);
  const source = `${text}\n${section ?? ""}`;
  for (const pattern of [/这一轮明确不做：([\s\S]*?)(?=\n\n|\n###|$)/g, /当前明确不做：([\s\S]*?)(?=\n\n|\n###|$)/g]) {
    for (const match of source.matchAll(pattern)) {
      for (const line of String(match[1]).split(/\r?\n/)) {
        const normalized = squashWhitespace(line.replace(/^[-*]\s*/, ""));
        if (normalized) {
          lines.push(normalized);
        }
      }
    }
  }

  return dedupeStrings(lines).slice(0, 10);
}

function extractQueueReadyTasks(text, phases) {
  const phaseMap = new Map(phases.map(phase => [phase.phase, phase]));
  const sections = [];
  const sectionRegex = /^####\s+(P\d+)\s+queue-ready tasks([\s\S]*?)(?=^####\s+|^###\s+|\Z)/gm;

  for (const match of text.matchAll(sectionRegex)) {
    sections.push({
      phase: match[1],
      body: match[2],
      phaseStatus: phaseMap.get(match[1])?.status ?? "active"
    });
  }

  const tasks = [];
  for (const section of sections) {
    const entries = splitNumberedEntries(section.body);
    for (const entry of entries) {
      tasks.push({
        phase: section.phase,
        phaseStatus: section.phaseStatus,
        title: entry.title,
        body: entry.body,
        queueTitle: extractInlineQueueTitle(entry.body) ?? entry.title,
        validationHints: extractValidationHints(entry.body)
      });
    }
  }

  return tasks;
}

function classifyQueueReadyTasks(tasks) {
  const executable = [];
  const deferred = [];
  const blockedHumanLate = [];

  for (const task of tasks) {
    if (task.phaseStatus === "completed") {
      continue;
    }

    const automation = classifyTaskAutomation(task);
    const candidate = {
      phase: task.phase,
      title: task.title,
      queueTitle: task.queueTitle,
      summary: summarizeTaskBody(task.body),
      validationHints: task.validationHints
    };

    if (automation === "blocked_human_late") {
      blockedHumanLate.push(candidate);
      continue;
    }

    if (automation === "deferred") {
      deferred.push(candidate);
      continue;
    }

    executable.push(candidate);
  }

  return {
    executable: executable.slice(0, 12),
    deferred: deferred.slice(0, 8),
    blockedHumanLate: blockedHumanLate.slice(0, 8)
  };
}

function classifyTaskAutomation(task) {
  const body = `${task.title}\n${task.body}`.toLowerCase();

  if (/需要人工|人工判断|人工选择|人工标注|人工.*验收|demo case 取舍|baseline 文档集版本/.test(body)) {
    return "blocked_human_late";
  }

  if (/后置|留在自动 loop 外|不进入自动 queue|条件触发/.test(body)) {
    return "deferred";
  }

  return "executable";
}

function splitNumberedEntries(sectionText) {
  const lines = String(sectionText ?? "").split(/\r?\n/);
  const entries = [];
  let current = null;

  for (const rawLine of lines) {
    const numbered = rawLine.match(/^(\d+)\.\s+(.+)$/);
    if (numbered) {
      if (current) {
        entries.push(current);
      }
      current = {
        title: squashWhitespace(numbered[2]),
        body: ""
      };
      continue;
    }

    if (!current) {
      continue;
    }

    current.body += `${rawLine}\n`;
  }

  if (current) {
    entries.push(current);
  }

  return entries;
}

function extractInlineQueueTitle(body) {
  const match = String(body ?? "").match(/对应 queue title[：:]\s*`([^`]+)`/);
  if (match?.[1]) {
    return squashWhitespace(match[1]);
  }

  return null;
}

function extractValidationHints(body) {
  const hints = [];
  for (const line of String(body ?? "").split(/\r?\n/)) {
    const normalized = squashWhitespace(line.replace(/^[-*]\s*/, ""));
    if (/^`.+`$/.test(normalized) || /(focused validation|validation|测试|命令)/i.test(normalized)) {
      hints.push(normalized.replace(/^`|`$/g, ""));
    }
  }
  return dedupeStrings(hints).slice(0, 3);
}

function summarizeTaskBody(body) {
  const lines = String(body ?? "")
    .split(/\r?\n/)
    .map(line => squashWhitespace(line.replace(/^[-*]\s*/, "")))
    .filter(Boolean)
    .filter(line => !/^交付物：/.test(line));

  return lines.slice(0, 3).join(" ");
}

function summarizeQueueStateForPlanner(queue) {
  const unresolved = buildPlannerQueueState(queue);
  return {
    totalItems: unresolved.totalItems,
    statusCounts: unresolved.statusCounts,
    unresolvedCount: unresolved.unresolvedItems.length
  };
}

function extractLatestProgressNotes(text, limit) {
  const lines = [];
  for (const rawLine of String(text ?? "").split(/\r?\n/)) {
    if (!/^\s*-\s+/.test(rawLine)) {
      continue;
    }
    const normalized = squashWhitespace(rawLine.replace(/^\s*-\s+/, ""));
    if (!normalized) {
      continue;
    }
    lines.push(normalized);
    if (lines.length >= limit) {
      break;
    }
  }

  return lines;
}

function extractSectionBlock(text, headingPattern, stopPatterns) {
  const lines = String(text ?? "").split(/\r?\n/);
  const startIndex = lines.findIndex(line => headingPattern.test(line));
  if (startIndex === -1) {
    return null;
  }

  const collected = [];
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (stopPatterns.some(pattern => pattern.test(line))) {
      break;
    }
    collected.push(line);
  }

  return collected.join("\n");
}

function matchFirstLine(text, patterns) {
  for (const pattern of patterns) {
    const match = String(text ?? "").match(pattern);
    if (!match) {
      continue;
    }
    const candidate = squashWhitespace(match[1] ?? match[0]);
    if (candidate) {
      return candidate;
    }
  }

  return null;
}

function dedupeStrings(values) {
  return [...new Set((Array.isArray(values) ? values : []).filter(Boolean))];
}

function extractDocSignals(text, patterns, limit) {
  const signals = [];
  const seen = new Set();

  for (const rawLine of String(text ?? "").split(/\r?\n/)) {
    const line = squashWhitespace(rawLine.replace(/^[-*]\s*/, "").replace(/^>\s*/, ""));
    if (!line || line.length < 12) {
      continue;
    }
    if (/^#{1,6}\s/.test(rawLine)) {
      continue;
    }
    if (!patterns.some(pattern => pattern.test(line))) {
      continue;
    }
    const normalized = line.toLowerCase();
    if (seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    signals.push(line);
    if (signals.length >= limit) {
      break;
    }
  }

  return signals;
}

function buildPlannerQueueState(queue) {
  const items = Array.isArray(queue?.items) ? queue.items : [];
  const statusCounts = new Map();
  const unresolvedItems = [];

  for (const item of items) {
    const status = typeof item?.status === "string" ? item.status : "unknown";
    statusCounts.set(status, (statusCounts.get(status) ?? 0) + 1);

    if (["needs_review", "blocked_external", "needs_replan", "failed", "pending", "in_progress", "verifying"].includes(status)) {
      unresolvedItems.push({
        id: item?.id ?? null,
        title: item?.title ?? item?.id ?? null,
        status,
        riskLevel: item?.riskLevel ?? null,
        plannerSource: item?.plannerSource ?? null
      });
    }
  }

  return {
    totalItems: items.length,
    statusCounts: Object.fromEntries(statusCounts),
    unresolvedItems: unresolvedItems.slice(0, 6),
    cursor: Number.isInteger(queue?.cursor) ? queue.cursor : null
  };
}

function extractRecentCompletedItems(queue, repoRoot, handoffsDir) {
  const items = Array.isArray(queue?.items) ? [...queue.items] : [];
  const completed = items.filter(item => item?.status === "completed").slice(-3).reverse();

  return completed.map(item => ({
    id: item.id,
    title: item.title ?? item.id,
    resultSummary: extractHandoffResultSummary(resolve(repoRoot, item.handoffPath ?? ""), handoffsDir)
  }));
}

function extractHandoffResultSummary(handoffPath, handoffsDir) {
  try {
    if (!handoffPath || !handoffPath.startsWith(handoffsDir)) {
      return null;
    }

    const raw = readFileSync(handoffPath, "utf8");
    const match = raw.match(/## 结果\n([\s\S]*?)\n## /);
    const resultBlock = match ? match[1] : raw;
    return squashWhitespace(resultBlock).slice(0, 400);
  } catch {
    return null;
  }
}

function buildQueueSummary(queue) {
  const items = Array.isArray(queue?.items) ? queue.items : [];
  let pending = 0;
  let completed = 0;
  let inProgress = 0;
  let deferred = 0;
  let verifying = 0;
  let needsReview = 0;
  let blockedExternal = 0;
  let needsReplan = 0;
  let failed = 0;

  for (const item of items) {
    if (item?.status === "pending") {
      pending += 1;
    } else if (item?.status === "completed") {
      completed += 1;
    } else if (item?.status === "in_progress") {
      inProgress += 1;
    } else if (item?.status === "deferred") {
      deferred += 1;
    } else if (item?.status === "verifying") {
      verifying += 1;
    } else if (item?.status === "needs_review") {
      needsReview += 1;
    } else if (item?.status === "blocked_external") {
      blockedExternal += 1;
    } else if (item?.status === "needs_replan") {
      needsReplan += 1;
    } else if (item?.status === "failed") {
      failed += 1;
    }
  }

  return JSON.stringify(
    {
      total: items.length,
      pending,
      completed,
      deferred,
      verifying,
      needsReview,
      blockedExternal,
      needsReplan,
      failed,
      inProgress,
      cursor: Number.isInteger(queue?.cursor) ? queue.cursor : null
    },
    null,
    2
  );
}

function parsePlannerResponse(text) {
  const fencedMatch = text.match(/```json\s*([\s\S]*?)```/i);
  const jsonText = fencedMatch?.[1] ?? findFirstJsonArray(text);

  if (!jsonText) {
    return [];
  }

  try {
    const parsed = JSON.parse(jsonText);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function findFirstJsonArray(text) {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  return text.slice(start, end + 1);
}

function normalizePlannerProposals(proposals, maxItems) {
  const normalized = [];

  for (const proposal of Array.isArray(proposals) ? proposals : []) {
    if (normalized.length >= maxItems) {
      break;
    }

    const title = typeof proposal?.title === "string" ? squashWhitespace(proposal.title) : "";
    const prompt = typeof proposal?.prompt === "string" ? proposal.prompt.trim() : "";
    if (!title || !prompt) {
      continue;
    }

    normalized.push({
      title,
      kind: sanitizeKind(proposal?.kind),
      goal: typeof proposal?.goal === "string" && proposal.goal.trim() ? proposal.goal.trim() : title,
      prompt,
      family: sanitizeFamily(proposal?.family),
      agent: typeof proposal?.agent === "string" ? proposal.agent.trim() : undefined,
      model: typeof proposal?.model === "string" ? proposal.model.trim() : undefined,
      acceptance: normalizeStructuredField(proposal?.acceptance),
      constraints: normalizeStructuredField(proposal?.constraints),
      verification: normalizeVerification(proposal?.verification),
      retryPolicy: normalizeRetryPolicy(proposal?.retryPolicy),
      riskLevel: normalizeRiskLevel(proposal?.riskLevel),
      reviewRequired: proposal?.reviewRequired === true,
      escalationPolicy: normalizeEscalationPolicy(proposal?.escalationPolicy)
    });
  }

  return normalized;
}

function sanitizeFamily(value) {
  const family = typeof value === "string" ? value.trim().toLowerCase() : "build";
  const normalized = family.replace(/[^a-z0-9._-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return normalized || "build";
}

function sanitizeKind(value) {
  const kind = typeof value === "string" ? value.trim().toLowerCase() : "build_increment";
  const normalized = kind.replace(/[^a-z0-9._-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return normalized || "build_increment";
}

function normalizeRiskLevel(value) {
  const riskLevel = typeof value === "string" ? value.trim().toLowerCase() : "";
  return ["low", "medium", "high", "critical"].includes(riskLevel) ? riskLevel : undefined;
}

function normalizeEscalationPolicy(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const onFailure =
    typeof value.onFailure === "string" && ["defer", "needs_review", "blocked_external", "throw"].includes(value.onFailure)
      ? value.onFailure
      : undefined;

  return onFailure ? { onFailure } : undefined;
}

function normalizeStructuredField(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  return value;
}

function normalizeVerification(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const mode =
    typeof value.mode === "string" && ["assistant_only", "command_only", "command+artifact"].includes(value.mode)
      ? value.mode
      : undefined;
  const commands = Array.isArray(value.commands)
    ? value.commands.filter(command => typeof command === "string" && command.trim()).map(command => command.trim())
    : undefined;
  const artifacts = Array.isArray(value.artifacts)
    ? value.artifacts.filter(path => typeof path === "string" && path.trim()).map(path => path.trim())
    : undefined;
  const commandTimeoutMs = Number.isInteger(value.commandTimeoutMs) && value.commandTimeoutMs > 0 ? value.commandTimeoutMs : undefined;

  if (!mode && !commands?.length && !artifacts?.length && !commandTimeoutMs) {
    return undefined;
  }

  return {
    ...(mode ? { mode } : {}),
    ...(commands?.length ? { commands } : {}),
    ...(artifacts?.length ? { artifacts } : {}),
    ...(commandTimeoutMs ? { commandTimeoutMs } : {})
  };
}

function normalizeRetryPolicy(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const maxAttempts = Number.isInteger(value.maxAttempts) && value.maxAttempts > 0 ? value.maxAttempts : undefined;
  const onVerificationFail =
    typeof value.onVerificationFail === "string" &&
    ["needs_replan", "failed", "needs_review", "blocked_external"].includes(value.onVerificationFail)
      ? value.onVerificationFail
      : undefined;
  const onAcceptanceFailure =
    typeof value.onAcceptanceFailure === "string" &&
    ["needs_replan", "failed", "needs_review", "blocked_external"].includes(value.onAcceptanceFailure)
      ? value.onAcceptanceFailure
      : undefined;
  const onConstraintFailure =
    typeof value.onConstraintFailure === "string" &&
    ["needs_replan", "failed", "needs_review", "blocked_external"].includes(value.onConstraintFailure)
      ? value.onConstraintFailure
      : undefined;
  const onCommandFailure =
    typeof value.onCommandFailure === "string" &&
    ["needs_replan", "failed", "needs_review", "blocked_external"].includes(value.onCommandFailure)
      ? value.onCommandFailure
      : undefined;
  const onArtifactFailure =
    typeof value.onArtifactFailure === "string" &&
    ["needs_replan", "failed", "needs_review", "blocked_external"].includes(value.onArtifactFailure)
      ? value.onArtifactFailure
      : undefined;

  if (!maxAttempts && !onVerificationFail && !onAcceptanceFailure && !onConstraintFailure && !onCommandFailure && !onArtifactFailure) {
    return undefined;
  }

  return {
    ...(maxAttempts ? { maxAttempts } : {}),
    ...(onVerificationFail ? { onVerificationFail } : {}),
    ...(onAcceptanceFailure ? { onAcceptanceFailure } : {}),
    ...(onConstraintFailure ? { onConstraintFailure } : {}),
    ...(onCommandFailure ? { onCommandFailure } : {}),
    ...(onArtifactFailure ? { onArtifactFailure } : {})
  };
}

function buildExistingFingerprintSet(queue, loopRoot) {
  const items = Array.isArray(queue?.items) ? queue.items : [];
  const fingerprints = new Set();

  for (const item of items) {
    const title = typeof item?.title === "string" ? item.title : item?.id ?? "";
    const prompt = readQueueItemPromptFingerprintSource(item, loopRoot);
    fingerprints.add(fingerprintQueueItem(title, prompt));
  }

  return fingerprints;
}

function readQueueItemPromptFingerprintSource(item, loopRoot) {
  const promptFile = typeof item?.promptFile === "string" ? item.promptFile.trim() : "";
  if (!promptFile) {
    return "";
  }

  if (loopRoot) {
    try {
      return readFileSync(resolve(loopRoot, promptFile), "utf8").trim();
    } catch {
      // Fall back to the path string when the prompt file is unavailable.
    }
  }

  return promptFile;
}

function fingerprintQueueItem(title, prompt) {
  return `${squashWhitespace(title).toLowerCase()}::${squashWhitespace(prompt).toLowerCase()}`;
}

function allocateGeneratedItemId({ queue, generatedItems, family }) {
  const prefix = `${family}-auto-`;
  const ids = new Set([
    ...(Array.isArray(queue?.items) ? queue.items.map(item => item?.id).filter(Boolean) : []),
    ...generatedItems.map(item => item.id)
  ]);

  let index = 1;
  for (;;) {
    const candidate = `${prefix}${String(index).padStart(3, "0")}`;
    if (!ids.has(candidate)) {
      return candidate;
    }
    index += 1;
  }
}

function renderPlannerHandoff({ sessionId, messageId, plannedAt, promptText, assistantText, generatedItems }) {
  const lines = [
    "# planner-auto-refill",
    "",
    `- 会话: ${sessionId}`,
    `- 消息: ${messageId}`,
    `- 完成: ${formatDisplayTime(plannedAt)}`,
    `- 生成任务数: ${generatedItems.length}`,
    "",
    "## 生成任务",
    ...(generatedItems.length > 0
      ? generatedItems.map(item => {
          const metadata = [];
          if (item.riskLevel) {
            metadata.push(`risk=${item.riskLevel}`);
          }
          if (item.reviewRequired) {
            metadata.push("reviewRequired");
          }
          if (item.goal) {
            metadata.push(`goal=${JSON.stringify(item.goal)}`);
          }

          return `- ${item.id}: ${item.title}${metadata.length > 0 ? ` [${metadata.join(", ")}]` : ""}`;
        })
      : ["- no tasks generated"]),
    "",
    "## 规划结果",
    assistantText || "(empty)",
    "",
    "## 规划提示词",
    "```text",
    promptText,
    "```",
    ""
  ];

  return `${lines.join("\n")}\n`;
}

function squashWhitespace(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}
