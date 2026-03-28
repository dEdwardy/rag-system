import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { relative, resolve } from "node:path";

import { appendQueueItems, formatDisplayTime, writeQueue } from "./queue.mjs";

export const DEFAULT_PLANNER_PROMPT_PATH = "prompts/plan-next.md";
export const DEFAULT_PLANNER_PROMPT_FILE_NAME = "plan-next.md";
export const DEFAULT_AUTO_REFILL_MAX_CYCLES = 1;
export const DEFAULT_AUTO_REFILL_MAX_ITEMS = 2;

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
    title: `loop planner #${autoRefillState.cycles + 1} ${formatDisplayTime(plannedAt)}`
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
      title,
      agent: proposal.agent ?? commandConfig.build?.agent ?? "rag-build",
      model: proposal.model ?? commandConfig.build?.model,
      promptFile: relativePromptPath,
      status: "pending",
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
    logStatus("refill:skip", {
      plannerSessionId: session.id,
      plannerMessageId: message.info?.id ?? "unknown",
      handoffPath: relative(repoRoot, plannerHandoffPath).replace(/\\/g, "/")
    });
    return {
      queue,
      generatedItems,
      plannerSessionId: session.id,
      plannerMessageId: message.info?.id ?? null,
      handoffPath: relative(repoRoot, plannerHandoffPath).replace(/\\/g, "/")
    };
  }

  const updatedQueue = appendQueueItems(queue, generatedItems, generatedAt);
  writeQueue(queuePath, updatedQueue);
  autoRefillState.cycles += 1;

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

function composePlannerPrompt({ plannerPromptTemplate, queue, repoRoot, handoffsDir, maxItems }) {
  const recentItems = extractRecentCompletedItems(queue, repoRoot, handoffsDir);
  const queueSummary = buildQueueSummary(queue);
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
    "Current queue summary:",
    queueSummary,
    "Recent completed queue items:",
    recentSummary
  ].join("\n\n");
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

  for (const item of items) {
    if (item?.status === "pending") {
      pending += 1;
    } else if (item?.status === "completed") {
      completed += 1;
    } else if (item?.status === "in_progress") {
      inProgress += 1;
    }
  }

  return JSON.stringify(
    {
      total: items.length,
      pending,
      completed,
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
      prompt,
      family: sanitizeFamily(proposal?.family),
      agent: typeof proposal?.agent === "string" ? proposal.agent.trim() : undefined,
      model: typeof proposal?.model === "string" ? proposal.model.trim() : undefined
    });
  }

  return normalized;
}

function sanitizeFamily(value) {
  const family = typeof value === "string" ? value.trim().toLowerCase() : "build";
  const normalized = family.replace(/[^a-z0-9._-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return normalized || "build";
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
      ? generatedItems.map(item => `- ${item.id}: ${item.title}`)
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
