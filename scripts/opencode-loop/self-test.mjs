import { createServer } from "node:http";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  DEFAULT_QUEUE_ITEM,
  LOOP_SCHEMA_VERSION,
  readQueue,
  resolveQueueCursor
} from "./queue.mjs";
import { DEFAULT_PROMPT_FILE_NAME, DEFAULT_PROMPT_PATH, runLoop } from "./runtime.mjs";

export async function runSelfTest() {
  const root = mkdtempSync(join(tmpdir(), "opencode-loop-"));
  let resumeRoot = null;
  let refillRoot = null;
  const sessions = [];
  const transientPostFailureBySessionId = new Set();
  const messagesBySessionId = new Map();
  const pendingAssistantBySessionId = new Map();
  let nextMessageNumber = 1;
  let plannerResponsesRemaining = 1;

  const server = createServer(async (request, response) => {
    if (!request.url) {
      response.statusCode = 400;
      response.end("missing URL");
      return;
    }

    if (request.method === "POST" && request.url === "/session") {
      const id = `ses_${sessions.length + 1}`;
      const raw = await readIncomingBody(request);
      const payload = JSON.parse(raw || "{}");
      sessions.push({ id, title: payload.title ?? null });
      messagesBySessionId.set(id, []);
      if (id === "ses_2") {
        transientPostFailureBySessionId.add(id);
      }
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ id, title: "mock" }));
      return;
    }

    if (request.method === "POST" && /^\/session\/[^/]+\/message$/.test(request.url)) {
      const raw = await readIncomingBody(request);
      const payload = JSON.parse(raw || "{}");
      const sessionId = request.url.split("/")[2];
      const promptText = payload.parts?.[0]?.text ?? "";
      const assistantText =
        promptText.includes("Planner mode:") && plannerResponsesRemaining > 0
          ? JSON.stringify(
              [
                {
                  title: "Generated follow-up task",
                  family: "trace",
                  prompt:
                    "Inspect the latest trace-summary closeout gap, make the smallest implementation change needed, run one focused validation command, and report exact files plus commands.",
                  agent: "rag-build"
                }
              ],
              null,
              2
            )
          : `Mock assistant response for: ${promptText}`;
      if (promptText.includes("Planner mode:") && plannerResponsesRemaining > 0) {
        plannerResponsesRemaining -= 1;
      }

      if (transientPostFailureBySessionId.has(sessionId)) {
        transientPostFailureBySessionId.delete(sessionId);
        pendingAssistantBySessionId.set(sessionId, assistantText);
        request.socket.destroy(new Error("simulated fetch failed"));
        return;
      }

      const sessionMessages = messagesBySessionId.get(sessionId) ?? [];
      sessionMessages.push({
        info: { id: `msg_user_${nextMessageNumber++}`, role: "user" },
        parts: [
          {
            type: "text",
            text: payload.parts?.[0]?.text ?? ""
          }
        ]
      });
      messagesBySessionId.set(sessionId, sessionMessages);
      pendingAssistantBySessionId.set(sessionId, assistantText);
      response.setHeader("content-type", "application/json");
      response.end(
        JSON.stringify({
          info: { id: "msg_user_ack", role: "user" },
          parts: [
            {
              type: "text",
              text: payload.parts?.[0]?.text ?? ""
            }
          ]
        })
      );
      return;
    }

    if (request.method === "GET" && /^\/session\/[^/]+\/message/.test(request.url)) {
      const sessionId = request.url.split("/")[2]?.split("?")[0];
      const sessionMessages = messagesBySessionId.get(sessionId) ?? [];
      const assistantText = pendingAssistantBySessionId.get(sessionId);

      if (assistantText) {
        sessionMessages.push({
          info: { id: `msg_assistant_${nextMessageNumber++}`, role: "assistant" },
          parts: [{ type: "text", text: assistantText }]
        });
        messagesBySessionId.set(sessionId, sessionMessages);
        pendingAssistantBySessionId.delete(sessionId);
      }

      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify(sessionMessages));
      return;
    }

    response.statusCode = 404;
    response.end("not found");
  });

  await new Promise((resolvePromise, rejectPromise) => {
    server.listen(0, "127.0.0.1", error => {
      if (error) {
        rejectPromise(error);
        return;
      }

      resolvePromise();
    });
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Could not determine self-test server address.");
  }

  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const outOfRangeCursor = resolveQueueCursor({
      cursor: 99,
      items: [{ status: "pending" }, { status: "completed" }]
    });

    if (
      !outOfRangeCursor.recovered ||
      outOfRangeCursor.reason !== "out_of_range" ||
      outOfRangeCursor.cursor !== 0
    ) {
      throw new Error(
        `Self-test cursor guardrail failed for out-of-range cursor: ${JSON.stringify(outOfRangeCursor)}`
      );
    }

    const pastPendingCursor = resolveQueueCursor({
      cursor: 2,
      items: [{ status: "pending" }, { status: "completed" }]
    });

    if (
      !pastPendingCursor.recovered ||
      pastPendingCursor.reason !== "past_pending" ||
      pastPendingCursor.cursor !== 0
    ) {
      throw new Error(
        `Self-test cursor guardrail failed for past-pending cursor: ${JSON.stringify(pastPendingCursor)}`
      );
    }

    mkdirSync(resolve(root, ".opencode", "loop", "prompts"), { recursive: true });
    mkdirSync(resolve(root, ".opencode", "loop", "handoffs"), { recursive: true });

    writeFileSync(
      resolve(root, ".opencode", "loop", "prompts", DEFAULT_PROMPT_FILE_NAME),
      [
        "Process queued work without human intervention.",
        "Keep the run narrow and continue until the queue is empty."
      ].join("\n") + "\n",
      "utf8"
    );

    writeFileSync(
      resolve(root, ".opencode", "loop", "queue.json"),
      `${JSON.stringify(
        {
          version: LOOP_SCHEMA_VERSION,
          cursor: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          items: [
            {
              ...DEFAULT_QUEUE_ITEM,
              id: "build-001"
            },
            {
              ...DEFAULT_QUEUE_ITEM,
              id: "build-002",
              title: "Run the next unattended step"
            }
          ]
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    const result = await runLoop({
      repoRoot: root,
      baseUrl,
      username: undefined,
      password: undefined,
      autoRefillMaxCycles: 0
    });

    const queue = readQueue(resolve(root, ".opencode", "loop", "queue.json"));

    if (sessions.length !== 2) {
      throw new Error(`Self-test expected two fresh sessions, got ${sessions.length}.`);
    }

    if (!sessions[0]?.title?.startsWith("loop #1 build-001") || !sessions[1]?.title?.startsWith("loop #2 build-002")) {
      throw new Error(`Self-test session titles were not made clearer: ${JSON.stringify(sessions)}`);
    }

    if (result.processedCount !== 2) {
      throw new Error(`Self-test expected two processed items, got ${result.processedCount}.`);
    }

    if (!queue.items.every(item => item.status === "completed")) {
      throw new Error("Self-test queue items did not move to completed.");
    }

    if (!queue.items.every(item => item.handoffPath && item.sessionId && item.messageId)) {
      throw new Error("Self-test queue items are missing completion metadata.");
    }

    if (!queue.items.every(item => item.startedAtDisplay && item.messageReceivedAtDisplay && item.completedAtDisplay)) {
      throw new Error("Self-test queue items are missing formatted display timestamps.");
    }

    const handoffAbsolute = resolve(root, queue.items[0].handoffPath);
    const handoff = readFileSync(handoffAbsolute, "utf8");

    if (!handoff.includes("# build-001")) {
      throw new Error("Self-test handoff file was not generated correctly.");
    }

    if (!handoff.includes("- 开始:") || !handoff.includes("- 收到:") || !handoff.includes("- 完成:")) {
      throw new Error("Self-test handoff timestamps were not rendered correctly.");
    }

    resumeRoot = mkdtempSync(join(tmpdir(), "opencode-loop-resume-"));
    mkdirSync(resolve(resumeRoot, ".opencode", "loop", "prompts"), { recursive: true });
    mkdirSync(resolve(resumeRoot, ".opencode", "loop", "handoffs"), { recursive: true });

    writeFileSync(
      resolve(resumeRoot, ".opencode", "loop", "prompts", DEFAULT_PROMPT_FILE_NAME),
      [
        "Resume an interrupted run without creating a new session.",
        "Use the existing session if a message already exists."
      ].join("\n") + "\n",
      "utf8"
    );

     writeFileSync(
       resolve(resumeRoot, ".opencode", "loop", "queue.json"),
       `${JSON.stringify(
        {
          version: LOOP_SCHEMA_VERSION,
          cursor: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          items: [
            {
              id: "resume-001",
              title: "Resume interrupted run",
              agent: "rag-build",
              promptFile: DEFAULT_PROMPT_PATH,
              status: "in_progress",
              startedAt: new Date().toISOString(),
              sessionId: "ses_resume_1"
            }
          ]
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    messagesBySessionId.set("ses_resume_1", [
      {
        info: { id: "msg_old_assistant", role: "assistant" },
        parts: [{ type: "text", text: "Old assistant reply that should not complete the resumed item." }]
      }
    ]);

    const sessionsBeforeResume = sessions.length;
    const resumedResult = await runLoop({
      repoRoot: resumeRoot,
      baseUrl,
      username: undefined,
      password: undefined,
      autoRefillMaxCycles: 0
    });

    const resumeQueue = readQueue(resolve(resumeRoot, ".opencode", "loop", "queue.json"));
    const resumed = resumeQueue.items[0];

    if (sessions.length !== sessionsBeforeResume) {
      throw new Error("Self-test resume path created an unexpected new session.");
    }

    if (resumed?.status !== "completed" || resumed.sessionId !== "ses_resume_1") {
      throw new Error("Self-test resume path did not preserve the existing session.");
    }

    if (resumedResult.item.sessionId !== "ses_resume_1") {
      throw new Error("Self-test resume return value did not use the existing session.");
    }

    if (resumed.messageId === "msg_old_assistant") {
      throw new Error("Self-test resume path incorrectly reused the stale assistant message.");
    }

    const resumedHandoff = readFileSync(resolve(resumeRoot, resumed.handoffPath), "utf8");
    if (resumedHandoff.includes("Old assistant reply that should not complete the resumed item.")) {
      throw new Error("Self-test resume handoff still captured the stale assistant reply.");
    }

    refillRoot = mkdtempSync(join(tmpdir(), "opencode-loop-refill-"));
    mkdirSync(resolve(refillRoot, ".opencode", "loop", "prompts"), { recursive: true });
    mkdirSync(resolve(refillRoot, ".opencode", "loop", "handoffs"), { recursive: true });

    writeFileSync(
      resolve(refillRoot, ".opencode", "loop", "prompts", DEFAULT_PROMPT_FILE_NAME),
      [
        "Run a generated refill task.",
        "Keep the run narrow and exit when no further refill items are generated."
      ].join("\n") + "\n",
      "utf8"
    );

    writeFileSync(
      resolve(refillRoot, ".opencode", "loop", "queue.json"),
      `${JSON.stringify(
        {
          version: LOOP_SCHEMA_VERSION,
          cursor: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          items: []
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    const refillResult = await runLoop({
      repoRoot: refillRoot,
      baseUrl,
      username: undefined,
      password: undefined,
      autoRefillMaxCycles: 1,
      autoRefillMaxItems: 1
    });

    const refillQueue = readQueue(resolve(refillRoot, ".opencode", "loop", "queue.json"));
    const generated = refillQueue.items[0];

    if (refillResult.processedCount !== 1) {
      throw new Error(`Self-test refill path expected one processed item, got ${refillResult.processedCount}.`);
    }

    if (!generated || generated.id !== "trace-auto-001" || generated.status !== "completed") {
      throw new Error(`Self-test refill path did not append and finish the generated item: ${JSON.stringify(generated)}`);
    }

    if (typeof generated.promptFile !== "string" || !generated.promptFile.startsWith("prompts/generated/")) {
      throw new Error("Self-test refill path did not materialize a generated prompt file.");
    }

    const plannerHandoffs = readdirSync(resolve(refillRoot, ".opencode", "loop", "handoffs")).filter(name =>
      name.includes("planner-auto-refill")
    );
    if (plannerHandoffs.length !== 1) {
      throw new Error(`Self-test expected exactly one planner handoff, got ${plannerHandoffs.length}.`);
    }

    const plannerHandoff = readFileSync(
      resolve(refillRoot, ".opencode", "loop", "handoffs", plannerHandoffs[0]),
      "utf8"
    );
    if (!plannerHandoff.includes("Generated follow-up task")) {
      throw new Error("Self-test planner handoff did not record the generated follow-up task.");
    }

    console.log("Self-test passed.");
  } finally {
    await new Promise(resolvePromise => {
      server.close(() => resolvePromise());
    });
    rmSync(root, { recursive: true, force: true });
    if (resumeRoot) {
      rmSync(resumeRoot, { recursive: true, force: true });
    }
    if (refillRoot) {
      rmSync(refillRoot, { recursive: true, force: true });
    }
  }
}

function readIncomingBody(request) {
  return new Promise((resolvePromise, rejectPromise) => {
    const chunks = [];
    request.on("data", chunk => chunks.push(Buffer.from(chunk)));
    request.on("error", rejectPromise);
    request.on("end", () => resolvePromise(Buffer.concat(chunks).toString("utf8")));
  });
}
