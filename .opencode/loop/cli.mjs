import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { appendMaterializedWaveToQueue, materializeBacklogWave } from "./harness/materialize.mjs";
import { readQueue, resumeQueueItem, writeQueue } from "./harness/queue.mjs";
import { runSelfTest } from "./harness/self-test.mjs";
import { runLoop } from "./harness/runtime.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..", "..");

const materializeWaveId = readCliOption("--materialize-wave");
const materializeOutputPath = readCliOption("--materialize-output");
const materializeAppendWaveId = readCliOption("--materialize-append-wave");
const resumeItemId = readCliOption("--resume-item");
const resumeNote = readCliOption("--resume-note");

if (process.argv.includes("--self-test")) {
  await runSelfTest();
  process.exit(0);
}

if (materializeWaveId) {
  const result = materializeBacklogWave({
    repoRoot,
    waveId: materializeWaveId,
    outputPath: materializeOutputPath
  });
  console.log(`Materialized ${result.itemCount} queue item(s).`);
  console.log(`Wave: ${result.wave.id}`);
  console.log(`Output: ${result.outputPath}`);
  process.exit(0);
}

if (materializeAppendWaveId) {
  const result = appendMaterializedWaveToQueue({
    repoRoot,
    waveId: materializeAppendWaveId
  });
  console.log(`Appended ${result.appendedCount} queue item(s).`);
  console.log(`Skipped ${result.skippedCount} existing item(s).`);
  console.log(`Wave: ${result.wave.id}`);
  console.log(`Queue: ${result.queuePath}`);
  process.exit(0);
}

if (resumeItemId) {
  resumeSuspendedQueueItem({ repoRoot, itemId: resumeItemId, resumeNote });
  process.exit(0);
}

try {
  const result = await runLoop({
    repoRoot,
    baseUrl: process.env.OPENCODE_BASE_URL ?? "http://127.0.0.1:4096",
    username: process.env.OPENCODE_SERVER_USERNAME,
    password: process.env.OPENCODE_SERVER_PASSWORD,
    messageWaitMs: Number(process.env.OPENCODE_LOOP_MESSAGE_WAIT_MS ?? 180000),
    pollIntervalMs: Number(process.env.OPENCODE_LOOP_POLL_MS ?? 2000),
    autoRefillMaxCycles: Number(process.env.OPENCODE_LOOP_AUTO_REFILL_MAX_CYCLES ?? 0),
    autoRefillMaxItems: Number(process.env.OPENCODE_LOOP_AUTO_REFILL_MAX_ITEMS ?? 2)
  });

  if (!result.processedCount) {
    console.log("No queue items found.");
  } else {
    console.log(`Processed ${result.processedCount} queue item(s).`);
    console.log(`Last item: ${result.item.id}`);
    console.log(`Session ID: ${result.session.id}`);
    console.log(`Handoff: ${result.handoffPath}`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

function resumeSuspendedQueueItem({ repoRoot, itemId, resumeNote }) {
  const queuePath = resolve(repoRoot, ".opencode", "loop", "queue.json");
  const queue = readQueue(queuePath);
  const index = queue.items.findIndex(item => item?.id === itemId);

  if (index === -1) {
    throw new Error(`Queue item not found: ${itemId}`);
  }

  const currentItem = queue.items[index];
  if (!["needs_review", "blocked_external"].includes(currentItem?.status)) {
    throw new Error(`Queue item ${itemId} is not suspended in needs_review/blocked_external (current status: ${currentItem?.status ?? "unknown"}).`);
  }

  const nextQueue = resumeQueueItem({
    queue,
    index,
    resumeNote
  });
  writeQueue(queuePath, nextQueue);

  const resumedItem = nextQueue.items[index];
  console.log(`Resumed ${resumedItem.id} -> pending`);
  if (resumedItem.resumeWhen) {
    console.log(`Resume condition: ${resumedItem.resumeWhen}`);
  }
  if (resumedItem.resumeNote) {
    console.log(`Resume note: ${resumedItem.resumeNote}`);
  }
}

function readCliOption(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1) {
    return undefined;
  }

  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value.`);
  }

  return value;
}
