import { mkdirSync, readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";

import { parseJsonc } from "./jsonc.mjs";
import { appendQueueItems, readQueue, writeQueue } from "./queue.mjs";

const DEFAULT_BACKLOG_PATH = ".opencode/loop/execution-backlog.jsonc";
const DEFAULT_QUEUE_PATH = ".opencode/loop/queue.json";
const TEMPLATE_PLACEHOLDER_PATTERN = /<[^<>\n]+>/;

export function materializeBacklogWave({
  repoRoot,
  waveId,
  outputPath,
  backlogPath = DEFAULT_BACKLOG_PATH
}) {
  if (!waveId || typeof waveId !== "string") {
    throw new Error("materializeBacklogWave requires a waveId.");
  }

  const absoluteBacklogPath = resolve(repoRoot, backlogPath);
  const backlog = parseJsonc(readFileSync(absoluteBacklogPath, "utf8"));
  const wave = backlog?.queueMaterializationPlan?.nextQueueFamilies?.find(family => family?.id === waveId);

  if (!wave) {
    throw new Error(`Backlog wave not found: ${waveId}`);
  }

  const items = Array.isArray(backlog?.items) ? backlog.items : [];
  const steps = items.flatMap(item =>
    Array.isArray(item?.decompositionPlan)
      ? item.decompositionPlan.map(step => ({ parent: item, step }))
      : []
  );

  const queueItems = (Array.isArray(wave.queueContracts) ? wave.queueContracts : []).map((contract, index) => {
    const matched = steps.find(entry => entry.step?.id === contract?.taskId);
    if (!matched) {
      throw new Error(`Backlog task not found for contract: ${contract?.taskId ?? "unknown"}`);
    }

    const previousTaskIds = (Array.isArray(wave.candidateTasks) ? wave.candidateTasks : []).slice(0, index);
    const dependsOn = previousTaskIds.filter(taskId => taskId !== contract.taskId);

    const verification = contract.verifier ?? { mode: "assistant_only" };
    assertNoUnresolvedVerificationPlaceholders({ taskId: contract.taskId, verification });

    return {
      id: contract.taskId,
      version: 2,
      kind: contract.kind ?? "build_increment",
      title: matched.step.title,
      goal: matched.step.goal,
      agent: "rag-build",
      status: "pending",
      promptText: buildPromptText({
        wave,
        parent: matched.parent,
        step: matched.step,
        contract,
        dependsOn
      }),
      acceptance: {
        checklist: matched.step.acceptance ?? matched.parent.acceptance ?? []
      },
      verification,
      retryPolicy: contract.retryPolicy ?? { maxAttempts: 1, onVerificationFail: "needs_replan" },
      attempt: 0,
      riskLevel: contract.riskLevel ?? matched.parent.riskLevel ?? "medium",
      dependsOn,
      suspendWhen: contract.suspendWhen ?? matched.parent.suspendWhen ?? [],
      backlogWaveId: wave.id,
      backlogParentId: matched.parent.id,
      plannerFamily: matched.parent.phase?.toLowerCase() ?? "backlog",
      plannerSource: "backlog-materializer"
    };
  });

  const now = new Date().toISOString();
  const queue = {
    version: 1,
    cursor: queueItems.length > 0 ? 0 : 0,
    createdAt: now,
    updatedAt: now,
    materializedFrom: relative(repoRoot, absoluteBacklogPath).replace(/\\/g, "/"),
    materializedWaveId: wave.id,
    items: queueItems
  };

  const absoluteOutputPath = resolve(repoRoot, outputPath ?? defaultOutputPathForWave(wave.id));
  mkdirSync(dirname(absoluteOutputPath), { recursive: true });
  writeQueue(absoluteOutputPath, queue);

  return {
    queue,
    wave,
    itemCount: queueItems.length,
    outputPath: relative(repoRoot, absoluteOutputPath).replace(/\\/g, "/")
  };
}

export function appendMaterializedWaveToQueue({
  repoRoot,
  waveId,
  queuePath = DEFAULT_QUEUE_PATH,
  backlogPath = DEFAULT_BACKLOG_PATH
}) {
  const { queue: materializedQueue, wave } = materializeBacklogWave({
    repoRoot,
    waveId,
    backlogPath,
    outputPath: defaultOutputPathForWave(waveId)
  });

  const absoluteQueuePath = resolve(repoRoot, queuePath);
  const baseQueue = readQueue(absoluteQueuePath);
  const existingIds = new Set((Array.isArray(baseQueue?.items) ? baseQueue.items : []).map(item => item?.id).filter(Boolean));
  const newItems = materializedQueue.items.filter(item => !existingIds.has(item.id));
  const mergedQueue = appendQueueItems(baseQueue, newItems, new Date().toISOString());
  writeQueue(absoluteQueuePath, mergedQueue);

  return {
    wave,
    appendedCount: newItems.length,
    skippedCount: materializedQueue.items.length - newItems.length,
    queuePath: relative(repoRoot, absoluteQueuePath).replace(/\\/g, "/")
  };
}

function defaultOutputPathForWave(waveId) {
  return `.opencode/loop/materialized/${waveId}.queue.json`;
}

function assertNoUnresolvedVerificationPlaceholders({ taskId, verification }) {
  const commands = Array.isArray(verification?.commands) ? verification.commands : [];
  const artifacts = Array.isArray(verification?.artifacts) ? verification.artifacts : [];

  for (const command of commands) {
    const match = typeof command === "string" ? command.match(TEMPLATE_PLACEHOLDER_PATTERN) : null;
    if (match) {
      throw new Error(`Backlog verifier for ${taskId} still contains unresolved placeholder ${match[0]} in command: ${command}`);
    }
  }

  for (const artifactPath of artifacts) {
    const match = typeof artifactPath === "string" ? artifactPath.match(TEMPLATE_PLACEHOLDER_PATTERN) : null;
    if (match) {
      throw new Error(
        `Backlog verifier for ${taskId} still contains unresolved placeholder ${match[0]} in artifact path: ${artifactPath}`
      );
    }
  }
}

function buildPromptText({ wave, parent, step, contract, dependsOn }) {
  const lines = [
    `Inspect the current ${parent.phase} codepath and docs for \`${parent.title}\` first.`,
    `Then make the smallest concrete change to complete \`${step.title}\` without broadening scope.`,
    `Wave goal: ${wave.waveGoal ?? parent.goal}`,
    `Task goal: ${step.goal}`
  ];

  if (Array.isArray(parent.scope) && parent.scope.length > 0) {
    lines.push(`Relevant scope: ${parent.scope.join(", ")}`);
  }

  if (dependsOn.length > 0) {
    lines.push(`Assume these earlier queue items are completed first: ${dependsOn.join(", ")}.`);
  }

  if (Array.isArray(step.acceptance) && step.acceptance.length > 0) {
    lines.push("Acceptance:");
    for (const rule of step.acceptance) {
      lines.push(`- ${rule}`);
    }
  }

  if (Array.isArray(parent.notDoing) && parent.notDoing.length > 0) {
    lines.push("Do not:");
    for (const rule of parent.notDoing) {
      lines.push(`- ${rule}`);
    }
  }

  const commands = Array.isArray(contract?.verifier?.commands) ? contract.verifier.commands : [];
  if (commands.length === 1) {
    lines.push(`Run exactly one focused validation command: \`${commands[0]}\`.`);
  } else if (commands.length > 1) {
    lines.push(`Run the declared focused validation commands: ${commands.map(command => `\`${command}\``).join(", ")}.`);
  }

  lines.push("Report the exact changed files and exact validation result.");
  return `${lines.join("\n")}\n`;
}
