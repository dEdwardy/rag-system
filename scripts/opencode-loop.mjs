import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { runSelfTest } from "./opencode-loop/self-test.mjs";
import { runLoop } from "./opencode-loop/runtime.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..");

if (process.argv.includes("--self-test")) {
  await runSelfTest();
  process.exit(0);
}

try {
  const result = await runLoop({
    repoRoot,
    baseUrl: process.env.OPENCODE_BASE_URL ?? "http://127.0.0.1:4096",
    username: process.env.OPENCODE_SERVER_USERNAME,
    password: process.env.OPENCODE_SERVER_PASSWORD,
    messageWaitMs: Number(process.env.OPENCODE_LOOP_MESSAGE_WAIT_MS ?? 180000),
    pollIntervalMs: Number(process.env.OPENCODE_LOOP_POLL_MS ?? 2000)
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
