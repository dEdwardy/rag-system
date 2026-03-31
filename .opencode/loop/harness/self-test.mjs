import { createServer } from "node:http";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  DEFAULT_QUEUE_ITEM,
  LOOP_SCHEMA_VERSION,
  deferQueueItem,
  pickNextItem,
  normalizeQueueForExecution,
  readQueue,
  resumeQueueItem,
  resolveQueueCursor
} from "./queue.mjs";
import { materializeBacklogWave } from "./materialize.mjs";
import { DEFAULT_PLANNER_PROMPT_FILE_NAME } from "./planner.mjs";
import { DEFAULT_PROMPT_FILE_NAME, DEFAULT_PROMPT_PATH, runLoop } from "./runtime.mjs";
import { QUEUE_STATUS, VERIFICATION_VERDICT, assertQueueStatusTransition, normalizeVerificationVerdictStatus } from "./state-machine.mjs";

export async function runSelfTest() {
  assertQueueStatusTransition({ from: QUEUE_STATUS.pending, to: QUEUE_STATUS.inProgress, context: "self-test-valid" });
  if (normalizeVerificationVerdictStatus(VERIFICATION_VERDICT.succeeded) !== QUEUE_STATUS.completed) {
    throw new Error("Self-test state machine verdict normalization failed.");
  }
  let invalidTransitionCaught = false;
  try {
    assertQueueStatusTransition({ from: QUEUE_STATUS.completed, to: QUEUE_STATUS.verifying, context: "self-test-invalid" });
  } catch {
    invalidTransitionCaught = true;
  }
  if (!invalidTransitionCaught) {
    throw new Error("Self-test state machine accepted an invalid completed -> verifying transition.");
  }

  const root = mkdtempSync(join(tmpdir(), "opencode-loop-"));
  let resumeRoot = null;
  let refillRoot = null;
  let refillAffinityRoot = null;
  let deferredRoot = null;
  let failureDeferRoot = null;
  let timeoutRetryRoot = null;
  let timeoutExhaustedRoot = null;
  let post500RetryRoot = null;
  let plannerDedupeRoot = null;
  let refillPersistRoot = null;
  let reviewPromotionRoot = null;
  let failureReviewRoot = null;
  let materializeRoot = null;
  let verifierSuccessRoot = null;
  let verifierReplanRoot = null;
  let verifierExhaustedRoot = null;
  let verifierCommandFailureRoot = null;
  let verifierCommandDefaultBlockedRoot = null;
  let verifierCommandBlockedRoot = null;
  let verifierArtifactDefaultReviewRoot = null;
  let verifierArtifactReviewRoot = null;
  let manualResumeRoot = null;
  let resumeWindowRoot = null;
  let staleLockRoot = null;
  const sessions = [];
  const transientPostFailureBySessionId = new Set();
  const timeoutOnceSessionIds = new Set();
  const timeoutAlwaysSessionIds = new Set();
  const messagesBySessionId = new Map();
  const pendingAssistantBySessionId = new Map();
  const lastPostPayloadBySessionId = new Map();
  let nextMessageNumber = 1;
  let plannerResponsesRemaining = 1;
  let plannerPersistentSequence = 0;
  let failureDeferOnceTriggered = false;
  let failureDeferTargetSessionId = null;
  let failureReviewOnceTriggered = false;
  let failureReviewTargetSessionId = null;
  const transientSessionCreateFailureTitles = new Set(["network-create-retry-001"]);
  const sessionCreateFailuresTriggered = new Set();
  const transientPost500BySessionId = new Set();

  const server = createServer(async (request, response) => {
    if (!request.url) {
      response.statusCode = 400;
      response.end("missing URL");
      return;
    }

    if (request.method === "POST" && request.url === "/session") {
      const raw = await readIncomingBody(request);
      const payload = JSON.parse(raw || "{}");
      const title = payload.title ?? null;
      if (transientSessionCreateFailureTitles.has(title) && !sessionCreateFailuresTriggered.has(title)) {
        sessionCreateFailuresTriggered.add(title);
        response.statusCode = 503;
        response.setHeader("content-type", "text/plain");
        response.end("simulated create session outage");
        return;
      }

      const id = `ses_${sessions.length + 1}`;
      sessions.push({ id, title: payload.title ?? null });
      messagesBySessionId.set(id, []);
      if ((payload.title ?? "").includes("timeout-retry-001") && timeoutOnceSessionIds.size === 0) {
        timeoutOnceSessionIds.add(id);
      }
      if ((payload.title ?? "").includes("timeout-exhaust-001")) {
        timeoutAlwaysSessionIds.add(id);
      }
      if ((payload.title ?? "").includes("failure-defer-002") && !failureDeferTargetSessionId) {
        failureDeferTargetSessionId = id;
      }
      if ((payload.title ?? "").includes("failure-review-001") && !failureReviewTargetSessionId) {
        failureReviewTargetSessionId = id;
      }
      if (id === "ses_2") {
        transientPostFailureBySessionId.add(id);
      }
      if ((payload.title ?? "").includes("network-post-500-retry-001")) {
        transientPost500BySessionId.add(id);
      }
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ id, title: "mock" }));
      return;
    }

    if (request.method === "POST" && /^\/session\/[^/]+\/message$/.test(request.url)) {
      const raw = await readIncomingBody(request);
      const payload = JSON.parse(raw || "{}");
      const sessionId = request.url.split("/")[2];
      lastPostPayloadBySessionId.set(sessionId, payload);
      const promptText = payload.parts?.[0]?.text ?? "";
      const assistantText = promptText.includes("planner persistent budget self-test")
        ? JSON.stringify(
            [
              {
                title: `Persistent follow-up task ${plannerPersistentSequence + 1}`,
                family: "trace",
                prompt: `Run persistent refill follow-up ${++plannerPersistentSequence}.`,
                agent: "rag-build"
              }
            ],
            null,
            2
          )
        : promptText.includes("planner affinity self-test")
        ? JSON.stringify(
            [
              {
                title: "Generated affinity follow-up task 1",
                family: "trace",
                prompt: "Run generated affinity follow-up 1.",
                agent: "rag-build"
              },
              {
                title: "Generated affinity follow-up task 2",
                family: "trace",
                prompt: "Run generated affinity follow-up 2.",
                agent: "rag-build"
              }
            ],
            null,
            2
          )
        : promptText.includes("planner dedupe self-test")
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
        : promptText.includes("Planner mode:") && plannerResponsesRemaining > 0
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

      if (transientPost500BySessionId.has(sessionId)) {
        transientPost500BySessionId.delete(sessionId);
        pendingAssistantBySessionId.set(sessionId, assistantText);
        response.statusCode = 503;
        response.setHeader("content-type", "text/plain");
        response.end("simulated transient post outage");
        return;
      }

      if (sessionId === failureDeferTargetSessionId && !failureDeferOnceTriggered) {
        failureDeferOnceTriggered = true;
        response.statusCode = 400;
        response.setHeader("content-type", "text/plain");
        response.end("simulated defer failure");
        return;
      }

      if (sessionId === failureReviewTargetSessionId && !failureReviewOnceTriggered) {
        failureReviewOnceTriggered = true;
        response.statusCode = 400;
        response.setHeader("content-type", "text/plain");
        response.end("simulated review failure");
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
      const requestUrl = new URL(request.url, baseUrl);
      const limitRaw = Number.parseInt(requestUrl.searchParams.get("limit") ?? "", 10);
      const limit = Number.isInteger(limitRaw) && limitRaw > 0 ? limitRaw : null;
      const sessionMessages = messagesBySessionId.get(sessionId) ?? [];
      const assistantText = pendingAssistantBySessionId.get(sessionId);

      if (assistantText && !timeoutOnceSessionIds.has(sessionId) && !timeoutAlwaysSessionIds.has(sessionId)) {
        sessionMessages.push({
          info: { id: `msg_assistant_${nextMessageNumber++}`, role: "assistant" },
          parts: [{ type: "text", text: assistantText }]
        });
        messagesBySessionId.set(sessionId, sessionMessages);
        pendingAssistantBySessionId.delete(sessionId);
      }

      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify(limit ? sessionMessages.slice(-limit) : sessionMessages));
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

    const filteredPick = pickNextItem(
      {
        cursor: 0,
        items: [
          { id: "filtered-001", status: "pending", wave: "p1" },
          { id: "filtered-002", status: "pending", wave: "p2" }
        ]
      },
      item => item.wave === "p2"
    );

    if (filteredPick?.index !== 1 || filteredPick?.item?.id !== "filtered-002") {
      throw new Error(`Self-test predicate pick failed: ${JSON.stringify(filteredPick)}`);
    }

    const deferredQueue = deferQueueItem({
      queue: {
        cursor: 0,
        items: [
          { id: "defer-001", status: "in_progress", sessionId: "ses_defer" },
          { id: "defer-002", status: "pending" }
        ]
      },
      index: 0
    });

    if (deferredQueue.items[0]?.status !== "deferred" || deferredQueue.cursor !== 1) {
      throw new Error(`Self-test deferred queue helper failed: ${JSON.stringify(deferredQueue)}`);
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

    if (
      !sessions[0]?.title?.startsWith("loop #1 · 2 left · build-001") ||
      !sessions[1]?.title?.startsWith("loop #2 · 1 left · build-002")
    ) {
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

    if (!queue.items.every(item => item.verificationVerdict === "succeeded" && item.verificationArtifactPath)) {
      throw new Error("Self-test queue items are missing verification metadata.");
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

    const affinityRoot = mkdtempSync(join(tmpdir(), "opencode-loop-affinity-"));
    mkdirSync(resolve(affinityRoot, ".opencode", "loop", "prompts"), { recursive: true });
    mkdirSync(resolve(affinityRoot, ".opencode", "loop", "handoffs"), { recursive: true });

    writeFileSync(
      resolve(affinityRoot, ".opencode", "loop", "prompts", DEFAULT_PROMPT_FILE_NAME),
      [
        "Process two adjacent related tasks in the same codepath.",
        "Reuse the same session when the queue items declare the same session affinity."
      ].join("\n") + "\n",
      "utf8"
    );

    writeFileSync(
      resolve(affinityRoot, ".opencode", "loop", "queue.json"),
      `${JSON.stringify(
        {
          version: LOOP_SCHEMA_VERSION,
          cursor: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          items: [
            {
              ...DEFAULT_QUEUE_ITEM,
              id: "affinity-001",
              title: "First related trace closeout item",
              goal: "Finish the first trace closeout step.",
              taskSummary: "Trace closeout wave for the same narrow codepath.",
              sessionAffinityKey: "trace-closeout"
            },
            {
              ...DEFAULT_QUEUE_ITEM,
              id: "affinity-002",
              title: "Second related trace closeout item",
              goal: "Finish the second trace closeout step.",
              taskSummary: "Trace closeout wave for the same narrow codepath.",
              sessionAffinityKey: "trace-closeout"
            }
          ]
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    const sessionsBeforeAffinity = sessions.length;
    const affinityResult = await runLoop({
      repoRoot: affinityRoot,
      baseUrl,
      username: undefined,
      password: undefined,
      autoRefillMaxCycles: 0
    });

    const affinityQueue = readQueue(resolve(affinityRoot, ".opencode", "loop", "queue.json"));
    const affinitySessionsCreated = sessions.length - sessionsBeforeAffinity;

    if (affinityResult.processedCount !== 2 || affinitySessionsCreated !== 1) {
      throw new Error(
        `Self-test session-affinity path expected two processed items on one shared session, got processed=${affinityResult.processedCount}, newSessions=${affinitySessionsCreated}.`
      );
    }

    if (affinityQueue.items[0]?.sessionId !== affinityQueue.items[1]?.sessionId) {
      throw new Error(`Self-test session-affinity path did not reuse the same session: ${JSON.stringify(affinityQueue.items)}`);
    }

    if (affinityQueue.items[1]?.sessionReuseKind !== "affinity" || affinityQueue.items[1]?.sessionReuseSourceItemId !== "affinity-001") {
      throw new Error(
        `Self-test session-affinity metadata was not recorded correctly: ${JSON.stringify(affinityQueue.items[1])}`
      );
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

    resumeWindowRoot = mkdtempSync(join(tmpdir(), "opencode-loop-resume-window-"));
    mkdirSync(resolve(resumeWindowRoot, ".opencode", "loop", "prompts"), { recursive: true });
    mkdirSync(resolve(resumeWindowRoot, ".opencode", "loop", "handoffs"), { recursive: true });

    writeFileSync(
      resolve(resumeWindowRoot, ".opencode", "loop", "prompts", DEFAULT_PROMPT_FILE_NAME),
      [
        "Resume a long session without losing the new assistant reply.",
        "Use the afterMessageId baseline when continuing an existing session."
      ].join("\n") + "\n",
      "utf8"
    );

    writeFileSync(
      resolve(resumeWindowRoot, ".opencode", "loop", "queue.json"),
      `${JSON.stringify(
        {
          version: LOOP_SCHEMA_VERSION,
          cursor: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          items: [
            {
              id: "resume-window-001",
              title: "Resume long session near message window limit",
              agent: "rag-build",
              promptFile: DEFAULT_PROMPT_PATH,
              status: "in_progress",
              startedAt: new Date().toISOString(),
              sessionId: "ses_resume_window_1"
            }
          ]
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    const resumeWindowMessages = [
      {
        info: { id: "msg_resume_window_baseline", role: "assistant" },
        parts: [{ type: "text", text: "Baseline assistant reply near the edge of the message window." }]
      }
    ];
    for (let index = 0; index < 199; index += 1) {
      resumeWindowMessages.push({
        info: { id: `msg_resume_window_user_${index + 1}`, role: "user" },
        parts: [{ type: "text", text: `Historical user message ${index + 1}` }]
      });
    }
    messagesBySessionId.set("ses_resume_window_1", resumeWindowMessages);

    const resumeWindowResult = await runLoop({
      repoRoot: resumeWindowRoot,
      baseUrl,
      username: undefined,
      password: undefined,
      autoRefillMaxCycles: 0
    });

    const resumeWindowQueue = readQueue(resolve(resumeWindowRoot, ".opencode", "loop", "queue.json"));
    const resumeWindowItem = resumeWindowQueue.items[0];
    const resumeWindowPostPayload = lastPostPayloadBySessionId.get("ses_resume_window_1");

    if (resumeWindowItem?.status !== "completed" || resumeWindowItem.sessionId !== "ses_resume_window_1") {
      throw new Error("Self-test resume-window path did not finish on the existing session.");
    }

    if (resumeWindowResult.item.sessionId !== "ses_resume_window_1") {
      throw new Error("Self-test resume-window result did not preserve the existing session.");
    }

    if (resumeWindowItem.messageId === "msg_resume_window_baseline") {
      throw new Error("Self-test resume-window path incorrectly reused the baseline assistant message.");
    }

    if (resumeWindowPostPayload?.afterMessageId !== "msg_resume_window_baseline") {
      throw new Error(
        `Self-test resume-window path did not send afterMessageId in the POST body: ${JSON.stringify(resumeWindowPostPayload)}`
      );
    }

    refillRoot = mkdtempSync(join(tmpdir(), "opencode-loop-refill-"));
    mkdirSync(resolve(refillRoot, ".opencode", "loop", "prompts"), { recursive: true });
    mkdirSync(resolve(refillRoot, ".opencode", "loop", "handoffs"), { recursive: true });
    mkdirSync(resolve(refillRoot, "docs"), { recursive: true });

    writeFileSync(
      resolve(refillRoot, "AGENTS.md"),
      [
        "Prefer small, targeted, reversible changes.",
        "Prefer the smallest change that closes the next meaningful gap.",
        "Run the smallest relevant validation for the change."
      ].join("\n") + "\n",
      "utf8"
    );

    writeFileSync(
      resolve(refillRoot, "docs", "next_steps_rag_project_plan.md"),
      [
        "Current recommended mainline: P3 external knowledge source follow-up.",
        "Prefer one narrow mainline increment at a time.",
        "Do not open a new architecture track or broad UI pass.",
        "",
        "### P3: external knowledge source follow-up",
        "#### P3 queue-ready tasks",
        "1. source diagnostics consistency",
        "   - 目标：继续收口 source retry / timeout / diagnostics 一致性。",
        "   - 对应 queue title：`source diagnostics consistency`",
        "   - 交付物：focused backend consistency increment + tests",
        "",
        "### P5: RAG 质量证明",
        "#### P5 queue-ready tasks",
        "1. 建立 eval baseline 题集",
        "   - 目标：先挑出一批真实问题。",
        "   - 需要人工：挑题、去重、按主题覆盖。"
      ].join("\n") + "\n",
      "utf8"
    );

    writeFileSync(
      resolve(refillRoot, "docs", "current-progress.md"),
      [
        "补充进展（2026-03-30）：",
        "- queue wave closeout completed and waiting for the next safe wave.",
        "- planner auto-refill closeout remained conservative."
      ].join("\n") + "\n",
      "utf8"
    );

    writeFileSync(
      resolve(refillRoot, "docs", "current-dev-setup.md"),
      [
        "Optional harness: .opencode/loop/README.md.",
        "Focused validation: node .opencode/loop/cli.mjs --self-test"
      ].join("\n") + "\n",
      "utf8"
    );

    writeFileSync(
      resolve(refillRoot, "README.md"),
      [
        "This repo uses an optional repo-local loop harness under .opencode/loop/.",
        "Prefer additive behavior-preserving increments."
      ].join("\n") + "\n",
      "utf8"
    );

    writeFileSync(
      resolve(refillRoot, ".opencode", "loop", "README.md"),
      [
        "Planner-generated items materialize generated prompts under .opencode/loop/prompts/generated/.",
        "Queue items may provide verification and retryPolicy metadata."
      ].join("\n") + "\n",
      "utf8"
    );

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

    if (!plannerHandoff.includes("Doc-derived planning snapshot:")) {
      throw new Error("Self-test planner handoff did not capture the doc-derived planning snapshot.");
    }

    if (!plannerHandoff.includes('"docIngestionScope"') || !plannerHandoff.includes("AGENTS.md")) {
      throw new Error("Self-test planner prompt did not include the canonical doc ingestion scope.");
    }

    if (!plannerHandoff.includes("Current recommended mainline: P3 external knowledge source follow-up.")) {
      throw new Error("Self-test planner prompt did not include extracted current-priority signals.");
    }

    if (!plannerHandoff.includes('"plannerMode": "derive_next_safe_executable_queue_wave"')) {
      throw new Error("Self-test planner prompt did not include the task decomposition contract.");
    }

    if (!plannerHandoff.includes('"candidateTasks"') || !plannerHandoff.includes('"blockedHumanLate"')) {
      throw new Error("Self-test planner prompt did not include structured candidate task extraction.");
    }

    const refillGeneratedSession = sessions.find(session =>
      typeof session?.title === "string" && session.title.includes("trace-auto-001")
    );
    if (!refillGeneratedSession?.title?.startsWith("loop #1 · refill 1 left · trace-auto-001")) {
      throw new Error(
        `Self-test refill session title did not clarify auto-refill scope: ${JSON.stringify(refillGeneratedSession)}`
      );
    }

    refillAffinityRoot = mkdtempSync(join(tmpdir(), "opencode-loop-refill-affinity-"));
    mkdirSync(resolve(refillAffinityRoot, ".opencode", "loop", "prompts"), { recursive: true });
    mkdirSync(resolve(refillAffinityRoot, ".opencode", "loop", "handoffs"), { recursive: true });
    mkdirSync(resolve(refillAffinityRoot, "docs"), { recursive: true });

    writeFileSync(resolve(refillAffinityRoot, "AGENTS.md"), "Keep queue work narrow.\n", "utf8");
    writeFileSync(resolve(refillAffinityRoot, "docs", "next_steps_rag_project_plan.md"), "Current recommended mainline: Planner affinity self-test.\n", "utf8");
    writeFileSync(resolve(refillAffinityRoot, "docs", "current-progress.md"), "补充进展（2026-03-31）：\n- planner affinity self-test\n", "utf8");
    writeFileSync(resolve(refillAffinityRoot, "docs", "current-dev-setup.md"), "Focused validation: node .opencode/loop/cli.mjs --self-test\n", "utf8");
    writeFileSync(resolve(refillAffinityRoot, "README.md"), "Optional loop harness repo.\n", "utf8");
    writeFileSync(resolve(refillAffinityRoot, ".opencode", "loop", "README.md"), "Planner-generated items may share session affinity when emitted as adjacent related tasks.\n", "utf8");
    writeFileSync(resolve(refillAffinityRoot, ".opencode", "loop", "prompts", DEFAULT_PLANNER_PROMPT_FILE_NAME), "planner affinity self-test\n", "utf8");
    writeFileSync(resolve(refillAffinityRoot, ".opencode", "loop", "prompts", DEFAULT_PROMPT_FILE_NAME), "Execute generated affinity task.\n", "utf8");
    writeFileSync(
      resolve(refillAffinityRoot, ".opencode", "loop", "queue.json"),
      `${JSON.stringify({ version: LOOP_SCHEMA_VERSION, cursor: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), items: [] }, null, 2)}\n`,
      "utf8"
    );

    const refillAffinityResult = await runLoop({
      repoRoot: refillAffinityRoot,
      baseUrl,
      username: undefined,
      password: undefined,
      autoRefillMaxCycles: 1,
      autoRefillMaxItems: 2
    });
    const refillAffinityQueue = readQueue(resolve(refillAffinityRoot, ".opencode", "loop", "queue.json"));
    const refillAffinityItems = refillAffinityQueue.items;

    if (refillAffinityResult.processedCount !== 2) {
      throw new Error(`Self-test planner-affinity path expected two processed items, got ${refillAffinityResult.processedCount}.`);
    }

    if (
      refillAffinityItems.length !== 2 ||
      typeof refillAffinityItems[0]?.sessionAffinityKey !== "string" ||
      refillAffinityItems[0].sessionAffinityKey !== refillAffinityItems[1]?.sessionAffinityKey
    ) {
      throw new Error(
        `Self-test planner-affinity path did not persist a shared sessionAffinityKey for adjacent generated siblings: ${JSON.stringify(refillAffinityItems)}`
      );
    }

    materializeRoot = mkdtempSync(join(tmpdir(), "opencode-loop-materialize-"));
    mkdirSync(resolve(materializeRoot, ".opencode", "loop"), { recursive: true });
    writeFileSync(
      resolve(materializeRoot, ".opencode", "loop", "execution-backlog.jsonc"),
      `${JSON.stringify(
        {
          items: [
            {
              id: "parent-001",
              title: "Materialized parent",
              goal: "Finish the same codepath through two closeout steps.",
              phase: "Trace",
              scope: ["apps/api"],
              decompositionPlan: [
                { id: "mat-001", title: "Materialized step one", goal: "Complete the first step.", acceptance: ["step one accepted"] },
                { id: "mat-002", title: "Materialized step two", goal: "Complete the second step.", acceptance: ["step two accepted"] }
              ]
            }
          ],
          queueMaterializationPlan: {
            nextQueueFamilies: [
              {
                id: "wave-001",
                waveGoal: "Close out one parent in order.",
                candidateTasks: ["mat-001", "mat-002"],
                queueContracts: [
                  { taskId: "mat-001", verifier: { mode: "assistant_only" } },
                  { taskId: "mat-002", verifier: { mode: "assistant_only" } }
                ]
              }
            ]
          }
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    const materializedWave = materializeBacklogWave({ repoRoot: materializeRoot, waveId: "wave-001" });
    if (
      materializedWave.queue.items.length !== 2 ||
      materializedWave.queue.items[0]?.sessionAffinityKey !== materializedWave.queue.items[1]?.sessionAffinityKey ||
      materializedWave.queue.items[0]?.sessionAffinityKey !== "backlog-wave:wave-001:parent-001"
    ) {
      throw new Error(
        `Self-test backlog materializer did not assign a shared sessionAffinityKey to sibling items: ${JSON.stringify(materializedWave.queue.items)}`
      );
    }

    refillPersistRoot = mkdtempSync(join(tmpdir(), "opencode-loop-refill-persist-"));
    mkdirSync(resolve(refillPersistRoot, ".opencode", "loop", "prompts"), { recursive: true });
    mkdirSync(resolve(refillPersistRoot, ".opencode", "loop", "handoffs"), { recursive: true });

    writeFileSync(
      resolve(refillPersistRoot, ".opencode", "loop", "prompts", DEFAULT_PROMPT_FILE_NAME),
      ["Run a generated refill task.", "Keep the run narrow and finish the generated item."].join("\n") + "\n",
      "utf8"
    );

    writeFileSync(
      resolve(refillPersistRoot, ".opencode", "loop", "prompts", DEFAULT_PLANNER_PROMPT_FILE_NAME),
      "planner persistent budget self-test\n",
      "utf8"
    );

    writeFileSync(
      resolve(refillPersistRoot, ".opencode", "loop", "queue.json"),
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

    const refillPersistFirstResult = await runLoop({
      repoRoot: refillPersistRoot,
      baseUrl,
      username: undefined,
      password: undefined,
      autoRefillMaxCycles: 1,
      autoRefillMaxItems: 1
    });

    if (refillPersistFirstResult.processedCount !== 1) {
      throw new Error(
        `Self-test refill persistence path expected one processed item on first run, got ${refillPersistFirstResult.processedCount}.`
      );
    }

    const refillPersistSecondResult = await runLoop({
      repoRoot: refillPersistRoot,
      baseUrl,
      username: undefined,
      password: undefined,
      autoRefillMaxCycles: 1,
      autoRefillMaxItems: 1
    });

    const refillPersistQueue = readQueue(resolve(refillPersistRoot, ".opencode", "loop", "queue.json"));

    if (refillPersistSecondResult.processedCount !== 0) {
      throw new Error(
        `Self-test refill persistence path expected zero processed items on second run, got ${refillPersistSecondResult.processedCount}.`
      );
    }

    if (refillPersistQueue.items.length !== 1 || refillPersistQueue.autoRefill?.cycles !== 1) {
      throw new Error(
        `Self-test refill persistence path failed to preserve refill budget: ${JSON.stringify(refillPersistQueue)}`
      );
    }

    deferredRoot = mkdtempSync(join(tmpdir(), "opencode-loop-deferred-"));
    mkdirSync(resolve(deferredRoot, ".opencode", "loop", "prompts"), { recursive: true });
    mkdirSync(resolve(deferredRoot, ".opencode", "loop", "handoffs"), { recursive: true });

    writeFileSync(
      resolve(deferredRoot, ".opencode", "loop", "prompts", DEFAULT_PROMPT_FILE_NAME),
      [
        "Recover deferred queue items before continuing.",
        "Keep the run narrow and finish the recovered item."
      ].join("\n") + "\n",
      "utf8"
    );

    writeFileSync(
      resolve(deferredRoot, ".opencode", "loop", "queue.json"),
      `${JSON.stringify(
        {
          version: LOOP_SCHEMA_VERSION,
          cursor: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          items: [
            {
              id: "deferred-001",
              title: "Recover deferred item",
              agent: "rag-build",
              promptFile: DEFAULT_PROMPT_PATH,
              status: "deferred",
              startedAt: "2026-03-28T00:00:00.000Z",
              sessionId: "ses_stale_deferred",
              messageId: "msg_stale_deferred",
              runId: "run_stale_deferred"
            }
          ]
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    const normalizedDeferredQueue = normalizeQueueForExecution(
      readQueue(resolve(deferredRoot, ".opencode", "loop", "queue.json"))
    );

    if (
      normalizedDeferredQueue.normalizedCount !== 1 ||
      normalizedDeferredQueue.queue.items[0].status !== "pending" ||
      normalizedDeferredQueue.queue.items[0].sessionId ||
      normalizedDeferredQueue.queue.items[0].messageId ||
      normalizedDeferredQueue.queue.items[0].runId ||
      normalizedDeferredQueue.queue.items[0].startedAt
    ) {
      throw new Error(
        `Self-test deferred normalization failed: ${JSON.stringify(normalizedDeferredQueue.queue.items[0])}`
      );
    }

    writeFileSync(
      resolve(deferredRoot, ".opencode", "loop", "queue.json"),
      `${JSON.stringify(normalizedDeferredQueue.queue, null, 2)}\n`,
      "utf8"
    );

    const deferredResult = await runLoop({
      repoRoot: deferredRoot,
      baseUrl,
      username: undefined,
      password: undefined,
      autoRefillMaxCycles: 0
    });

    const recoveredDeferredQueue = readQueue(resolve(deferredRoot, ".opencode", "loop", "queue.json"));

    if (deferredResult.processedCount !== 1) {
      throw new Error(`Self-test deferred path expected one processed item, got ${deferredResult.processedCount}.`);
    }

    if (recoveredDeferredQueue.items[0]?.status !== "completed") {
      throw new Error("Self-test deferred path did not complete the recovered item.");
    }

    if (recoveredDeferredQueue.items[0]?.sessionId === "ses_stale_deferred") {
      throw new Error("Self-test deferred path incorrectly reused the stale session.");
    }

    failureDeferRoot = mkdtempSync(join(tmpdir(), "opencode-loop-failure-defer-"));
    mkdirSync(resolve(failureDeferRoot, ".opencode", "loop", "prompts"), { recursive: true });
    mkdirSync(resolve(failureDeferRoot, ".opencode", "loop", "handoffs"), { recursive: true });

    writeFileSync(
      resolve(failureDeferRoot, ".opencode", "loop", "prompts", DEFAULT_PROMPT_FILE_NAME),
      [
        "Use inline promptText queue items.",
        "Continue past a soft-failed item that requests defer handling."
      ].join("\n") + "\n",
      "utf8"
    );

    writeFileSync(
      resolve(failureDeferRoot, ".opencode", "loop", "queue.json"),
      `${JSON.stringify(
        {
          version: LOOP_SCHEMA_VERSION,
          cursor: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          items: [
            {
              id: "failure-defer-001",
              title: "First inline prompt item",
              agent: "rag-build",
              promptText: "Process the first inline prompt item.",
              status: "pending",
              failureMode: "block"
            },
            {
              id: "failure-defer-002",
              title: "Soft-failed inline item",
              agent: "rag-build",
              promptText: "Trigger the transient failure path and defer this item.",
              status: "pending",
              failureMode: "defer"
            },
            {
              id: "failure-defer-003",
              title: "Item after deferred failure",
              agent: "rag-build",
              promptText: "Process the item after the deferred failure.",
              status: "pending",
              failureMode: "block"
            }
          ]
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    const failureDeferResult = await runLoop({
      repoRoot: failureDeferRoot,
      baseUrl,
      username: undefined,
      password: undefined,
      autoRefillMaxCycles: 0
    });

    const failureDeferQueue = readQueue(resolve(failureDeferRoot, ".opencode", "loop", "queue.json"));

    if (failureDeferResult.processedCount !== 2) {
      throw new Error(`Self-test failure-defer path expected two processed items, got ${failureDeferResult.processedCount}.`);
    }

    if (
      failureDeferQueue.items[0]?.status !== "completed" ||
      failureDeferQueue.items[1]?.status !== "deferred" ||
      failureDeferQueue.items[2]?.status !== "completed"
    ) {
      throw new Error(`Self-test failure-defer path did not leave the deferred item in place: ${JSON.stringify(failureDeferQueue.items)}`);
    }

    reviewPromotionRoot = mkdtempSync(join(tmpdir(), "opencode-loop-review-promotion-"));
    mkdirSync(resolve(reviewPromotionRoot, ".opencode", "loop", "prompts"), { recursive: true });
    mkdirSync(resolve(reviewPromotionRoot, ".opencode", "loop", "handoffs"), { recursive: true });

    writeFileSync(
      resolve(reviewPromotionRoot, ".opencode", "loop", "prompts", DEFAULT_PROMPT_FILE_NAME),
      [
        "Skip pre-labeled review items and continue safe autonomous work.",
        "Finish the runnable item without touching the queued review exception."
      ].join("\n") + "\n",
      "utf8"
    );

    writeFileSync(
      resolve(reviewPromotionRoot, ".opencode", "loop", "queue.json"),
      `${JSON.stringify(
        {
          version: LOOP_SCHEMA_VERSION,
          cursor: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          items: [
            {
              id: "review-promotion-001",
              title: "Pre-labeled manual review item",
              agent: "rag-build",
              promptText: "This item should be held for later manual review.",
              status: "pending",
              riskLevel: "high",
              reviewRequired: true
            },
            {
              id: "review-promotion-002",
              title: "Runnable item after review gate",
              agent: "rag-build",
              promptText: "Process the runnable item after a queued manual review exception.",
              status: "pending"
            }
          ]
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    const reviewPromotionResult = await runLoop({
      repoRoot: reviewPromotionRoot,
      baseUrl,
      username: undefined,
      password: undefined,
      autoRefillMaxCycles: 1,
      autoRefillMaxItems: 1
    });

    const reviewPromotionQueue = readQueue(resolve(reviewPromotionRoot, ".opencode", "loop", "queue.json"));

    if (reviewPromotionResult.processedCount !== 1) {
      throw new Error(
        `Self-test review-promotion path expected one processed item, got ${reviewPromotionResult.processedCount}.`
      );
    }

    if (
      reviewPromotionQueue.items[0]?.status !== "needs_review" ||
      reviewPromotionQueue.items[0]?.reviewReason !== "pre_run_review_required" ||
      reviewPromotionQueue.items[1]?.status !== "completed"
    ) {
      throw new Error(
        `Self-test review-promotion path did not preserve the review exception correctly: ${JSON.stringify(reviewPromotionQueue.items)}`
      );
    }

    failureReviewRoot = mkdtempSync(join(tmpdir(), "opencode-loop-failure-review-"));
    mkdirSync(resolve(failureReviewRoot, ".opencode", "loop", "prompts"), { recursive: true });
    mkdirSync(resolve(failureReviewRoot, ".opencode", "loop", "handoffs"), { recursive: true });

    writeFileSync(
      resolve(failureReviewRoot, ".opencode", "loop", "prompts", DEFAULT_PROMPT_FILE_NAME),
      [
        "Escalate failed autonomous items into a manual review state.",
        "Do not abort the whole loop when the item requests review escalation."
      ].join("\n") + "\n",
      "utf8"
    );

    writeFileSync(
      resolve(failureReviewRoot, ".opencode", "loop", "queue.json"),
      `${JSON.stringify(
        {
          version: LOOP_SCHEMA_VERSION,
          cursor: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          items: [
            {
              id: "failure-review-001",
              title: "Escalate failed item for manual review",
              agent: "rag-build",
              promptText: "Trigger the review escalation failure path.",
              status: "pending",
              failureMode: "review",
              riskLevel: "medium"
            }
          ]
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    const failureReviewResult = await runLoop({
      repoRoot: failureReviewRoot,
      baseUrl,
      username: undefined,
      password: undefined,
      autoRefillMaxCycles: 0
    });

    const failureReviewQueue = readQueue(resolve(failureReviewRoot, ".opencode", "loop", "queue.json"));

    if (failureReviewResult.processedCount !== 0) {
      throw new Error(`Self-test failure-review path expected zero completed items, got ${failureReviewResult.processedCount}.`);
    }

    if (
      failureReviewQueue.items[0]?.status !== "needs_review" ||
      failureReviewQueue.items[0]?.reviewReason !== "execution_failed_requires_review" ||
      !String(failureReviewQueue.items[0]?.reviewSummary ?? "").includes("simulated review failure")
    ) {
      throw new Error(
        `Self-test failure-review path did not escalate into needs_review correctly: ${JSON.stringify(failureReviewQueue.items[0])}`
      );
    }

    verifierSuccessRoot = mkdtempSync(join(tmpdir(), "opencode-loop-verifier-success-"));
    mkdirSync(resolve(verifierSuccessRoot, ".opencode", "loop", "prompts"), { recursive: true });
    mkdirSync(resolve(verifierSuccessRoot, ".opencode", "loop", "handoffs"), { recursive: true });

    writeFileSync(
      resolve(verifierSuccessRoot, ".opencode", "loop", "prompts", DEFAULT_PROMPT_FILE_NAME),
      [
        "Run a task that requires command-plus-artifact verification.",
        "The verifier should approve the task only after the artifact metrics pass."
      ].join("\n") + "\n",
      "utf8"
    );

    writeFileSync(
      resolve(verifierSuccessRoot, ".opencode", "loop", "queue.json"),
      `${JSON.stringify(
        {
          version: LOOP_SCHEMA_VERSION,
          cursor: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          items: [
            {
              id: "verifier-success-001",
              title: "Artifact-backed verifier success",
              kind: "loop_verification",
              goal: "Produce a passing verification artifact.",
              agent: "rag-build",
              promptText: "Create the passing verifier artifact.",
              status: "pending",
              verification: {
                mode: "command+artifact",
                commands: [
                  "node -e \"const fs=require('fs'); fs.mkdirSync('reports',{recursive:true}); fs.writeFileSync('reports/verifier-success.json', JSON.stringify({score:0.91, latency:120}));\""
                ],
                artifacts: ["reports/verifier-success.json"]
              },
              acceptance: {
                metrics: {
                  score: ">=0.9"
                }
              },
              constraints: {
                latency: "<=150"
              },
              retryPolicy: {
                maxAttempts: 2,
                onVerificationFail: "needs_replan"
              }
            }
          ]
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    const verifierSuccessResult = await runLoop({
      repoRoot: verifierSuccessRoot,
      baseUrl,
      username: undefined,
      password: undefined,
      autoRefillMaxCycles: 0
    });

    const verifierSuccessQueue = readQueue(resolve(verifierSuccessRoot, ".opencode", "loop", "queue.json"));

    if (verifierSuccessResult.processedCount !== 1 || verifierSuccessQueue.items[0]?.status !== "completed") {
      throw new Error("Self-test verifier-success path did not complete the verified item.");
    }

    if (
      verifierSuccessQueue.items[0]?.verificationVerdict !== "succeeded" ||
      !verifierSuccessQueue.items[0]?.verificationArtifactPath
    ) {
      throw new Error(
        `Self-test verifier-success path did not persist verification evidence: ${JSON.stringify(verifierSuccessQueue.items[0])}`
      );
    }

    verifierReplanRoot = mkdtempSync(join(tmpdir(), "opencode-loop-verifier-replan-"));
    mkdirSync(resolve(verifierReplanRoot, ".opencode", "loop", "prompts"), { recursive: true });
    mkdirSync(resolve(verifierReplanRoot, ".opencode", "loop", "handoffs"), { recursive: true });

    writeFileSync(
      resolve(verifierReplanRoot, ".opencode", "loop", "prompts", DEFAULT_PROMPT_FILE_NAME),
        [
          "Run a task whose verification artifact fails once, then succeeds after an automatically generated replan follow-up.",
          "The verifier should append a follow-up queue item and continue autonomously until the acceptance threshold passes."
        ].join("\n") + "\n",
        "utf8"
      );

    writeFileSync(
      resolve(verifierReplanRoot, ".opencode", "loop", "queue.json"),
      `${JSON.stringify(
        {
          version: LOOP_SCHEMA_VERSION,
          cursor: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          items: [
            {
              id: "verifier-replan-001",
              title: "Artifact-backed verifier replan",
              kind: "loop_verification",
              goal: "Recover from a failed verification by generating one autonomous replan follow-up.",
              agent: "rag-build",
              promptText: "Create the verifier artifact and let the harness replan if needed.",
              status: "pending",
              verification: {
                mode: "command+artifact",
                commands: [
                  "node -e \"const fs=require('fs'); fs.mkdirSync('reports',{recursive:true}); const statePath='reports/verifier-replan-state.json'; let attempt=0; try { attempt = JSON.parse(fs.readFileSync(statePath,'utf8')).attempt || 0; } catch {} attempt += 1; fs.writeFileSync(statePath, JSON.stringify({attempt})); const score = attempt >= 2 ? 0.93 : 0.42; fs.writeFileSync('reports/verifier-replan.json', JSON.stringify({score, latency:120}));\""
                ],
                artifacts: ["reports/verifier-replan.json"]
              },
              acceptance: {
                metrics: {
                  score: ">=0.9"
                }
              },
              retryPolicy: {
                maxAttempts: 2,
                onVerificationFail: "needs_replan"
              }
            }
          ]
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    const verifierReplanResult = await runLoop({
      repoRoot: verifierReplanRoot,
      baseUrl,
      username: undefined,
      password: undefined,
      autoRefillMaxCycles: 0
    });

    const verifierReplanQueue = readQueue(resolve(verifierReplanRoot, ".opencode", "loop", "queue.json"));

    if (verifierReplanResult.processedCount !== 2 || verifierReplanQueue.items.length !== 2) {
      throw new Error(
        `Self-test verifier-replan path did not execute the generated follow-up: ${JSON.stringify(verifierReplanQueue.items)}`
      );
    }

    if (
      verifierReplanQueue.items[0]?.status !== "needs_replan" ||
      verifierReplanQueue.items[0]?.verificationVerdict !== "needs_replan" ||
      verifierReplanQueue.items[0]?.verificationResult?.failureCategory !== "verification_acceptance" ||
      verifierReplanQueue.items[0]?.verificationResult?.failureCode !== "acceptance_metric_failed" ||
      !String(verifierReplanQueue.items[0]?.verificationSummary ?? "").includes("acceptance metric score") ||
      !verifierReplanQueue.items[0]?.verificationResult?.followupItemId
    ) {
      throw new Error(
        `Self-test verifier-replan path did not preserve the failed verification evidence: ${JSON.stringify(verifierReplanQueue.items[0])}`
      );
    }

    if (
      verifierReplanQueue.items[1]?.status !== "completed" ||
      verifierReplanQueue.items[1]?.parentId !== "verifier-replan-001" ||
      verifierReplanQueue.items[1]?.attempt !== 2 ||
      verifierReplanQueue.items[1]?.verificationVerdict !== "succeeded"
    ) {
      throw new Error(
        `Self-test verifier-replan path did not complete the appended follow-up correctly: ${JSON.stringify(verifierReplanQueue.items[1])}`
      );
    }

    if (
      !String(verifierReplanQueue.items[1]?.promptText ?? "").includes("Focus on the implementation gap that prevented acceptance from passing.") ||
      !String(verifierReplanQueue.items[1]?.promptText ?? "").includes("Target metric `score` expected `>=0.9` but got `0.42`") ||
      !String(verifierReplanQueue.items[1]?.promptText ?? "").includes("Task summary: Recover from a failed verification by generating one autonomous replan follow-up.") ||
      String(verifierReplanQueue.items[1]?.promptText ?? "").includes("Original task prompt:") ||
      String(verifierReplanQueue.items[1]?.promptText ?? "").includes("Create the verifier artifact and let the harness replan if needed.")
    ) {
      throw new Error(
        `Self-test verifier-replan follow-up prompt did not include taxonomy-aware acceptance guidance: ${verifierReplanQueue.items[1]?.promptText}`
      );
    }

    const verifierReplanHandoff = readFileSync(resolve(verifierReplanRoot, verifierReplanQueue.items[0].handoffPath), "utf8");
    if (
      !verifierReplanHandoff.includes("## 接管摘要") ||
      !verifierReplanHandoff.includes("自动 follow-up 已追加到 queue") ||
      !verifierReplanHandoff.includes("Failure Category: verification_acceptance")
    ) {
      throw new Error("Self-test verifier-replan handoff did not include the operator summary.");
    }

    verifierExhaustedRoot = mkdtempSync(join(tmpdir(), "opencode-loop-verifier-exhausted-"));
    mkdirSync(resolve(verifierExhaustedRoot, ".opencode", "loop", "prompts"), { recursive: true });
    mkdirSync(resolve(verifierExhaustedRoot, ".opencode", "loop", "handoffs"), { recursive: true });

    writeFileSync(
      resolve(verifierExhaustedRoot, ".opencode", "loop", "prompts", DEFAULT_PROMPT_FILE_NAME),
      [
        "Run a task whose verification keeps failing after the max replan budget is exhausted.",
        "The harness should stop spawning follow-ups and mark the item failed."
      ].join("\n") + "\n",
      "utf8"
    );

    writeFileSync(
      resolve(verifierExhaustedRoot, ".opencode", "loop", "queue.json"),
      `${JSON.stringify(
        {
          version: LOOP_SCHEMA_VERSION,
          cursor: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          items: [
            {
              id: "verifier-exhausted-001",
              title: "Artifact-backed verifier exhaustion",
              kind: "loop_verification",
              goal: "Stop autonomous replanning once the max attempt budget is exhausted.",
              agent: "rag-build",
              promptText: "Keep producing a failing verifier artifact.",
              status: "pending",
              verification: {
                mode: "command+artifact",
                commands: [
                  "node -e \"const fs=require('fs'); fs.mkdirSync('reports',{recursive:true}); fs.writeFileSync('reports/verifier-exhausted.json', JSON.stringify({score:0.2, latency:120}));\""
                ],
                artifacts: ["reports/verifier-exhausted.json"]
              },
              acceptance: {
                metrics: {
                  score: ">=0.9"
                }
              },
              retryPolicy: {
                maxAttempts: 1,
                onVerificationFail: "needs_replan"
              }
            }
          ]
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    const verifierExhaustedResult = await runLoop({
      repoRoot: verifierExhaustedRoot,
      baseUrl,
      username: undefined,
      password: undefined,
      autoRefillMaxCycles: 0
    });

    const verifierExhaustedQueue = readQueue(resolve(verifierExhaustedRoot, ".opencode", "loop", "queue.json"));

    if (verifierExhaustedResult.processedCount !== 1 || verifierExhaustedQueue.items.length !== 1) {
      throw new Error(
        `Self-test verifier-exhausted path did not stop after the first failed verification attempt: ${JSON.stringify(verifierExhaustedQueue.items)}`
      );
    }

    if (
      verifierExhaustedQueue.items[0]?.status !== "failed" ||
      verifierExhaustedQueue.items[0]?.verificationVerdict !== "failed" ||
      verifierExhaustedQueue.items[0]?.verificationResult?.failureCategory !== "replan_budget" ||
      verifierExhaustedQueue.items[0]?.verificationResult?.failureCode !== "max_attempts_exhausted" ||
      verifierExhaustedQueue.items[0]?.verificationResult?.routingReason !== "explicit_retry_policy" ||
      !String(verifierExhaustedQueue.items[0]?.verificationSummary ?? "").includes("maxAttempts exhausted")
    ) {
      throw new Error(
        `Self-test verifier-exhausted path did not convert exhausted replans into failed: ${JSON.stringify(verifierExhaustedQueue.items[0])}`
      );
    }

    const verifierExhaustedHandoff = readFileSync(
      resolve(verifierExhaustedRoot, verifierExhaustedQueue.items[0].handoffPath),
      "utf8"
    );
    if (
      !verifierExhaustedHandoff.includes("## 接管摘要") ||
      !verifierExhaustedHandoff.includes("该任务已停止自动重试") ||
      !verifierExhaustedHandoff.includes("Failure Code: max_attempts_exhausted")
    ) {
      throw new Error("Self-test verifier-exhausted handoff did not include the failed operator summary.");
    }

    verifierCommandFailureRoot = mkdtempSync(join(tmpdir(), "opencode-loop-verifier-command-failure-"));
    mkdirSync(resolve(verifierCommandFailureRoot, ".opencode", "loop", "prompts"), { recursive: true });
    mkdirSync(resolve(verifierCommandFailureRoot, ".opencode", "loop", "handoffs"), { recursive: true });

    writeFileSync(
      resolve(verifierCommandFailureRoot, ".opencode", "loop", "prompts", DEFAULT_PROMPT_FILE_NAME),
      [
        "Run a task whose verification command exits non-zero.",
        "The harness should record structured command-failure taxonomy."
      ].join("\n") + "\n",
      "utf8"
    );

    writeFileSync(
      resolve(verifierCommandFailureRoot, ".opencode", "loop", "queue.json"),
      `${JSON.stringify(
        {
          version: LOOP_SCHEMA_VERSION,
          cursor: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          items: [
            {
              id: "verifier-command-failure-001",
              title: "Artifact-backed verifier command failure",
              kind: "loop_verification",
              goal: "Classify verification command failures with a stable taxonomy.",
              agent: "rag-build",
              promptText: "Trigger a verification command failure.",
              status: "pending",
              verification: {
                mode: "command_only",
                commands: ["node -e \"process.exit(3)\""]
              },
              retryPolicy: {
                maxAttempts: 1,
                onVerificationFail: "failed"
              }
            }
          ]
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    const verifierCommandFailureResult = await runLoop({
      repoRoot: verifierCommandFailureRoot,
      baseUrl,
      username: undefined,
      password: undefined,
      autoRefillMaxCycles: 0
    });

    const verifierCommandFailureQueue = readQueue(
      resolve(verifierCommandFailureRoot, ".opencode", "loop", "queue.json")
    );

    if (verifierCommandFailureResult.processedCount !== 1 || verifierCommandFailureQueue.items[0]?.status !== "failed") {
      throw new Error(
        `Self-test verifier-command-failure path did not fail the item as expected: ${JSON.stringify(verifierCommandFailureQueue.items[0])}`
      );
    }

    if (
      verifierCommandFailureQueue.items[0]?.verificationResult?.failureCategory !== "verification_command" ||
      verifierCommandFailureQueue.items[0]?.verificationResult?.failureCode !== "command_exit_nonzero" ||
      verifierCommandFailureQueue.items[0]?.verificationResult?.routingReason !== "default_fallback"
    ) {
      throw new Error(
        `Self-test verifier-command-failure path did not persist command failure taxonomy: ${JSON.stringify(verifierCommandFailureQueue.items[0])}`
      );
    }

    verifierCommandDefaultBlockedRoot = mkdtempSync(join(tmpdir(), "opencode-loop-verifier-command-default-blocked-"));
    mkdirSync(resolve(verifierCommandDefaultBlockedRoot, ".opencode", "loop", "prompts"), { recursive: true });
    mkdirSync(resolve(verifierCommandDefaultBlockedRoot, ".opencode", "loop", "handoffs"), { recursive: true });

    writeFileSync(
      resolve(verifierCommandDefaultBlockedRoot, ".opencode", "loop", "prompts", DEFAULT_PROMPT_FILE_NAME),
      [
        "Run a task whose verifier command clearly fails because credentials are missing.",
        "The harness should infer blocked_external without needing an explicit retryPolicy override."
      ].join("\n") + "\n",
      "utf8"
    );

    writeFileSync(
      resolve(verifierCommandDefaultBlockedRoot, ".opencode", "loop", "queue.json"),
      `${JSON.stringify(
        {
          version: LOOP_SCHEMA_VERSION,
          cursor: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          items: [
            {
              id: "verifier-command-default-blocked-001",
              title: "Credential-style command failure infers blocked external",
              kind: "loop_verification",
              goal: "Infer blocked_external for obvious credential or external dependency verifier failures.",
              agent: "rag-build",
              promptText: "Trigger a credential-style verifier command failure.",
              status: "pending",
              verification: {
                mode: "command_only",
                commands: [
                  "node -e \"console.error('authentication failed: missing credentials for remote service'); process.exit(2)\""
                ]
              },
              retryPolicy: {
                maxAttempts: 1
              }
            }
          ]
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    const verifierCommandDefaultBlockedResult = await runLoop({
      repoRoot: verifierCommandDefaultBlockedRoot,
      baseUrl,
      username: undefined,
      password: undefined,
      autoRefillMaxCycles: 0
    });

    const verifierCommandDefaultBlockedQueue = readQueue(
      resolve(verifierCommandDefaultBlockedRoot, ".opencode", "loop", "queue.json")
    );

    if (
      verifierCommandDefaultBlockedResult.processedCount !== 1 ||
      verifierCommandDefaultBlockedQueue.items[0]?.status !== "blocked_external" ||
      verifierCommandDefaultBlockedQueue.items[0]?.verificationVerdict !== "blocked_external" ||
      verifierCommandDefaultBlockedQueue.items[0]?.verificationResult?.routingReason !== "inferred_external_dependency_or_credentials" ||
      !String(verifierCommandDefaultBlockedQueue.items[0]?.resumeHint ?? "").includes("node .opencode/loop/cli.mjs --resume-item")
    ) {
      throw new Error(
        `Self-test verifier-command-default-blocked path did not infer blocked_external: ${JSON.stringify(verifierCommandDefaultBlockedQueue.items[0])}`
      );
    }

    verifierCommandBlockedRoot = mkdtempSync(join(tmpdir(), "opencode-loop-verifier-command-blocked-"));
    mkdirSync(resolve(verifierCommandBlockedRoot, ".opencode", "loop", "prompts"), { recursive: true });
    mkdirSync(resolve(verifierCommandBlockedRoot, ".opencode", "loop", "handoffs"), { recursive: true });

    writeFileSync(
      resolve(verifierCommandBlockedRoot, ".opencode", "loop", "prompts", DEFAULT_PROMPT_FILE_NAME),
      [
        "Run a task whose verification command failure should suspend into blocked_external.",
        "The harness should preserve command taxonomy while routing the item out of the normal autonomous lane."
      ].join("\n") + "\n",
      "utf8"
    );

    writeFileSync(
      resolve(verifierCommandBlockedRoot, ".opencode", "loop", "queue.json"),
      `${JSON.stringify(
        {
          version: LOOP_SCHEMA_VERSION,
          cursor: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          items: [
            {
              id: "verifier-command-blocked-001",
              title: "Command failure routes to blocked external",
              kind: "loop_verification",
              goal: "Suspend verifier command failures into blocked_external when the queue contract requests it.",
              agent: "rag-build",
              promptText: "Trigger a verification command failure that should wait on external unblock.",
              status: "pending",
              verification: {
                mode: "command_only",
                commands: ["node -e \"process.exit(4)\""]
              },
              retryPolicy: {
                maxAttempts: 1,
                onCommandFailure: "blocked_external"
              }
            }
          ]
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    const verifierCommandBlockedResult = await runLoop({
      repoRoot: verifierCommandBlockedRoot,
      baseUrl,
      username: undefined,
      password: undefined,
      autoRefillMaxCycles: 0
    });

    const verifierCommandBlockedQueue = readQueue(
      resolve(verifierCommandBlockedRoot, ".opencode", "loop", "queue.json")
    );

    if (
      verifierCommandBlockedResult.processedCount !== 1 ||
      verifierCommandBlockedQueue.items[0]?.status !== "blocked_external" ||
      verifierCommandBlockedQueue.items[0]?.verificationVerdict !== "blocked_external"
    ) {
      throw new Error(
        `Self-test verifier-command-blocked path did not suspend into blocked_external: ${JSON.stringify(verifierCommandBlockedQueue.items[0])}`
      );
    }

    if (
      verifierCommandBlockedQueue.items[0]?.verificationResult?.failureCategory !== "verification_command" ||
      verifierCommandBlockedQueue.items[0]?.verificationResult?.failureCode !== "command_exit_nonzero"
    ) {
      throw new Error(
        `Self-test verifier-command-blocked path did not preserve command failure taxonomy: ${JSON.stringify(verifierCommandBlockedQueue.items[0])}`
      );
    }

    const verifierCommandBlockedHandoff = readFileSync(
      resolve(verifierCommandBlockedRoot, verifierCommandBlockedQueue.items[0].handoffPath),
      "utf8"
    );
    if (
      !verifierCommandBlockedHandoff.includes("## 接管摘要") ||
      !verifierCommandBlockedHandoff.includes("blocked_external") ||
      !verifierCommandBlockedHandoff.includes("Failure Category: verification_command")
    ) {
      throw new Error("Self-test verifier-command-blocked handoff did not include the blocked operator summary.");
    }

    verifierArtifactReviewRoot = mkdtempSync(join(tmpdir(), "opencode-loop-verifier-artifact-review-"));
    mkdirSync(resolve(verifierArtifactReviewRoot, ".opencode", "loop", "prompts"), { recursive: true });
    mkdirSync(resolve(verifierArtifactReviewRoot, ".opencode", "loop", "handoffs"), { recursive: true });

    writeFileSync(
      resolve(verifierArtifactReviewRoot, ".opencode", "loop", "prompts", DEFAULT_PROMPT_FILE_NAME),
      [
        "Run a task whose missing verification artifact should route into needs_review.",
        "The harness should preserve artifact taxonomy while pausing for manual judgment."
      ].join("\n") + "\n",
      "utf8"
    );

    writeFileSync(
      resolve(verifierArtifactReviewRoot, ".opencode", "loop", "queue.json"),
      `${JSON.stringify(
        {
          version: LOOP_SCHEMA_VERSION,
          cursor: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          items: [
            {
              id: "verifier-artifact-review-001",
              title: "Missing artifact routes to review",
              kind: "loop_verification",
              goal: "Suspend missing verification artifact evidence into needs_review when the queue contract requests it.",
              agent: "rag-build",
              promptText: "Produce no artifact so the verifier must route this item into review.",
              status: "pending",
              verification: {
                mode: "command+artifact",
                commands: ["node -e \"const fs=require('fs'); fs.mkdirSync('reports',{recursive:true});\""],
                artifacts: ["reports/missing-artifact-review.json"]
              },
              retryPolicy: {
                maxAttempts: 1,
                onArtifactFailure: "needs_review"
              }
            }
          ]
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    const verifierArtifactReviewResult = await runLoop({
      repoRoot: verifierArtifactReviewRoot,
      baseUrl,
      username: undefined,
      password: undefined,
      autoRefillMaxCycles: 0
    });

    const verifierArtifactReviewQueue = readQueue(
      resolve(verifierArtifactReviewRoot, ".opencode", "loop", "queue.json")
    );

    if (
      verifierArtifactReviewResult.processedCount !== 1 ||
      verifierArtifactReviewQueue.items[0]?.status !== "needs_review" ||
      verifierArtifactReviewQueue.items[0]?.verificationVerdict !== "needs_review" ||
      !String(verifierArtifactReviewQueue.items[0]?.resumeWhen ?? "").includes("human has reviewed")
    ) {
      throw new Error(
        `Self-test verifier-artifact-review path did not suspend into needs_review: ${JSON.stringify(verifierArtifactReviewQueue.items[0])}`
      );
    }

    if (
      verifierArtifactReviewQueue.items[0]?.verificationResult?.failureCategory !== "verification_artifact" ||
      verifierArtifactReviewQueue.items[0]?.verificationResult?.failureCode !== "artifact_missing"
    ) {
      throw new Error(
        `Self-test verifier-artifact-review path did not preserve artifact failure taxonomy: ${JSON.stringify(verifierArtifactReviewQueue.items[0])}`
      );
    }

    verifierArtifactDefaultReviewRoot = mkdtempSync(join(tmpdir(), "opencode-loop-verifier-artifact-default-review-"));
    mkdirSync(resolve(verifierArtifactDefaultReviewRoot, ".opencode", "loop", "prompts"), { recursive: true });
    mkdirSync(resolve(verifierArtifactDefaultReviewRoot, ".opencode", "loop", "handoffs"), { recursive: true });

    writeFileSync(
      resolve(verifierArtifactDefaultReviewRoot, ".opencode", "loop", "prompts", DEFAULT_PROMPT_FILE_NAME),
      [
        "Run a task whose missing artifact path obviously indicates manual review.",
        "The harness should infer needs_review without needing an explicit retryPolicy override."
      ].join("\n") + "\n",
      "utf8"
    );

    writeFileSync(
      resolve(verifierArtifactDefaultReviewRoot, ".opencode", "loop", "queue.json"),
      `${JSON.stringify(
        {
          version: LOOP_SCHEMA_VERSION,
          cursor: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          items: [
            {
              id: "verifier-artifact-default-review-001",
              title: "Manual-review artifact infers review",
              kind: "loop_verification",
              goal: "Infer needs_review when the missing verification artifact itself is clearly a manual approval artifact.",
              agent: "rag-build",
              promptText: "Leave the manual-review artifact missing so the verifier must infer a review pause.",
              status: "pending",
              verification: {
                mode: "command+artifact",
                commands: ["node -e \"const fs=require('fs'); fs.mkdirSync('reports',{recursive:true});\""],
                artifacts: ["reports/manual-review-approval.json"]
              },
              retryPolicy: {
                maxAttempts: 1
              }
            }
          ]
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    const verifierArtifactDefaultReviewResult = await runLoop({
      repoRoot: verifierArtifactDefaultReviewRoot,
      baseUrl,
      username: undefined,
      password: undefined,
      autoRefillMaxCycles: 0
    });

    const verifierArtifactDefaultReviewQueue = readQueue(
      resolve(verifierArtifactDefaultReviewRoot, ".opencode", "loop", "queue.json")
    );

    if (
      verifierArtifactDefaultReviewResult.processedCount !== 1 ||
      verifierArtifactDefaultReviewQueue.items[0]?.status !== "needs_review" ||
      verifierArtifactDefaultReviewQueue.items[0]?.verificationVerdict !== "needs_review" ||
      verifierArtifactDefaultReviewQueue.items[0]?.verificationResult?.routingReason !== "inferred_manual_review_artifact"
    ) {
      throw new Error(
        `Self-test verifier-artifact-default-review path did not infer needs_review: ${JSON.stringify(verifierArtifactDefaultReviewQueue.items[0])}`
      );
    }

    const verifierArtifactReviewHandoff = readFileSync(
      resolve(verifierArtifactReviewRoot, verifierArtifactReviewQueue.items[0].handoffPath),
      "utf8"
    );
    if (
      !verifierArtifactReviewHandoff.includes("## 接管摘要") ||
      !verifierArtifactReviewHandoff.includes("needs_review") ||
      !verifierArtifactReviewHandoff.includes("Failure Category: verification_artifact")
    ) {
      throw new Error("Self-test verifier-artifact-review handoff did not include the review operator summary.");
    }

    manualResumeRoot = mkdtempSync(join(tmpdir(), "opencode-loop-manual-resume-"));
    mkdirSync(resolve(manualResumeRoot, ".opencode", "loop", "prompts"), { recursive: true });
    mkdirSync(resolve(manualResumeRoot, ".opencode", "loop", "handoffs"), { recursive: true });

    writeFileSync(
      resolve(manualResumeRoot, ".opencode", "loop", "prompts", DEFAULT_PROMPT_FILE_NAME),
      [
        "Resume manually approved exception items.",
        "Use the provided resume context and continue the same narrow task."
      ].join("\n") + "\n",
      "utf8"
    );

    writeFileSync(
      resolve(manualResumeRoot, ".opencode", "loop", "queue.json"),
      `${JSON.stringify(
        {
          version: LOOP_SCHEMA_VERSION,
          cursor: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          items: [
            {
              id: "manual-resume-review-001",
              title: "Resume a reviewed item",
              agent: "rag-build",
              promptFile: DEFAULT_PROMPT_PATH,
              status: "needs_review",
              reviewRequired: true,
              reviewReason: "pre_run_review_required",
              resumeWhen: "Resume after a human reviewer approves unattended execution.",
              resumeHint: "Use node .opencode/loop/cli.mjs --resume-item manual-resume-review-001 after approval."
            },
            {
              id: "manual-resume-blocked-002",
              title: "Resume an externally blocked item",
              agent: "rag-build",
              promptFile: DEFAULT_PROMPT_PATH,
              status: "blocked_external",
              reviewReason: "external_dependency_blocked",
              resumeWhen: "Resume after credentials have been restored.",
              resumeHint: "Use node .opencode/loop/cli.mjs --resume-item manual-resume-blocked-002 after the fix."
            }
          ]
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    let manualResumeQueue = readQueue(resolve(manualResumeRoot, ".opencode", "loop", "queue.json"));
    manualResumeQueue = resumeQueueItem({
      queue: manualResumeQueue,
      index: 0,
      resumeNote: "approved for unattended execution"
    });
    manualResumeQueue = resumeQueueItem({
      queue: manualResumeQueue,
      index: 1,
      resumeNote: "credentials restored"
    });
    writeFileSync(resolve(manualResumeRoot, ".opencode", "loop", "queue.json"), `${JSON.stringify(manualResumeQueue, null, 2)}\n`, "utf8");

    if (
      manualResumeQueue.items[0]?.status !== "pending" ||
      manualResumeQueue.items[0]?.reviewRequired !== false ||
      !manualResumeQueue.items[0]?.resumeApprovedAt ||
      manualResumeQueue.items[1]?.status !== "pending"
    ) {
      throw new Error(`Self-test manual-resume helper did not reopen suspended items correctly: ${JSON.stringify(manualResumeQueue.items)}`);
    }

    const manualResumeResult = await runLoop({
      repoRoot: manualResumeRoot,
      baseUrl,
      username: undefined,
      password: undefined,
      autoRefillMaxCycles: 0
    });

    const manualResumeCompletedQueue = readQueue(resolve(manualResumeRoot, ".opencode", "loop", "queue.json"));

    if (manualResumeResult.processedCount !== 2 || !manualResumeCompletedQueue.items.every(item => item.status === "completed")) {
      throw new Error(`Self-test manual-resume path did not finish resumed exception items: ${JSON.stringify(manualResumeCompletedQueue.items)}`);
    }

    const manualResumeHandoff = readFileSync(resolve(manualResumeRoot, manualResumeCompletedQueue.items[1].handoffPath), "utf8");
    if (
      !manualResumeHandoff.includes("Resume context:") ||
      !manualResumeHandoff.includes("Previous suspended status: blocked_external") ||
      !manualResumeHandoff.includes("Manual resume note: credentials restored")
    ) {
      throw new Error("Self-test manual-resume path did not pass the resume context into the execution prompt/handoff.");
    }

    timeoutRetryRoot = mkdtempSync(join(tmpdir(), "opencode-loop-timeout-retry-"));
    mkdirSync(resolve(timeoutRetryRoot, ".opencode", "loop", "prompts"), { recursive: true });
    mkdirSync(resolve(timeoutRetryRoot, ".opencode", "loop", "handoffs"), { recursive: true });

    writeFileSync(
      resolve(timeoutRetryRoot, ".opencode", "loop", "prompts", DEFAULT_PROMPT_FILE_NAME),
      [
        "Recover from assistant message timeouts by retrying once with a fresh session.",
        "Complete the item after the retry succeeds."
      ].join("\n") + "\n",
      "utf8"
    );

    writeFileSync(
      resolve(timeoutRetryRoot, ".opencode", "loop", "queue.json"),
      `${JSON.stringify(
        {
          version: LOOP_SCHEMA_VERSION,
          cursor: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          items: [
            {
              id: "timeout-retry-001",
              title: "Retry timed-out assistant wait",
              agent: "rag-build",
              promptFile: DEFAULT_PROMPT_PATH,
              status: "pending"
            }
          ]
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    const sessionsBeforeTimeoutRetry = sessions.length;
    const timeoutRetryResult = await runLoop({
      repoRoot: timeoutRetryRoot,
      baseUrl,
      username: undefined,
      password: undefined,
      messageWaitMs: 50,
      pollIntervalMs: 5,
      autoRefillMaxCycles: 0
    });

    const timeoutRetryQueue = readQueue(resolve(timeoutRetryRoot, ".opencode", "loop", "queue.json"));
    const timeoutRetryItem = timeoutRetryQueue.items[0];
    const timeoutRetrySessions = sessions.slice(sessionsBeforeTimeoutRetry);

    if (timeoutRetryResult.processedCount !== 1) {
      throw new Error(`Self-test timeout-retry path expected one processed item, got ${timeoutRetryResult.processedCount}.`);
    }

    if (timeoutRetrySessions.length !== 2) {
      throw new Error(`Self-test timeout-retry path expected two sessions, got ${timeoutRetrySessions.length}.`);
    }

    if (timeoutRetryItem?.status !== "completed") {
      throw new Error("Self-test timeout-retry path did not complete the retried item.");
    }

    if (timeoutRetryItem?.sessionId !== timeoutRetrySessions[1]?.id) {
      throw new Error("Self-test timeout-retry path did not switch to the fresh retry session.");
    }

    if (timeoutRetryItem?.sessionId === timeoutRetrySessions[0]?.id) {
      throw new Error("Self-test timeout-retry path incorrectly preserved the timed-out session.");
    }

    timeoutExhaustedRoot = mkdtempSync(join(tmpdir(), "opencode-loop-timeout-exhausted-"));
    mkdirSync(resolve(timeoutExhaustedRoot, ".opencode", "loop", "prompts"), { recursive: true });
    mkdirSync(resolve(timeoutExhaustedRoot, ".opencode", "loop", "handoffs"), { recursive: true });

    writeFileSync(
      resolve(timeoutExhaustedRoot, ".opencode", "loop", "prompts", DEFAULT_PROMPT_FILE_NAME),
      [
        "Keep retrying until timeout retries are exhausted.",
        "Do not produce an assistant reply for this self-test item."
      ].join("\n") + "\n",
      "utf8"
    );

    writeFileSync(
      resolve(timeoutExhaustedRoot, ".opencode", "loop", "queue.json"),
      `${JSON.stringify(
        {
          version: LOOP_SCHEMA_VERSION,
          cursor: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          items: [
            {
              id: "timeout-exhaust-001",
              title: "Reset state after final timeout",
              agent: "rag-build",
              promptFile: DEFAULT_PROMPT_PATH,
              status: "pending"
            }
          ]
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    let timeoutExhaustedError = null;
    try {
      await runLoop({
        repoRoot: timeoutExhaustedRoot,
        baseUrl,
        username: undefined,
        password: undefined,
        messageWaitMs: 20,
        pollIntervalMs: 5,
        autoRefillMaxCycles: 0
      });
    } catch (error) {
      timeoutExhaustedError = error;
    }

    if (!timeoutExhaustedError || !String(timeoutExhaustedError.message).includes("没有为 session")) {
      throw new Error("Self-test timeout-exhausted path expected a final assistant timeout error.");
    }

    const timeoutExhaustedQueue = readQueue(resolve(timeoutExhaustedRoot, ".opencode", "loop", "queue.json"));
    const timeoutExhaustedItem = timeoutExhaustedQueue.items[0];

    if (timeoutExhaustedItem?.status !== "pending") {
      throw new Error("Self-test timeout-exhausted path did not reset the item back to pending.");
    }

    if (
      timeoutExhaustedItem?.sessionId ||
      timeoutExhaustedItem?.messageId ||
      timeoutExhaustedItem?.messageReceivedAt ||
      timeoutExhaustedItem?.resumedAt
    ) {
      throw new Error("Self-test timeout-exhausted path left stale session metadata behind.");
    }

    post500RetryRoot = mkdtempSync(join(tmpdir(), "opencode-loop-post500-retry-"));
    mkdirSync(resolve(post500RetryRoot, ".opencode", "loop", "prompts"), { recursive: true });
    mkdirSync(resolve(post500RetryRoot, ".opencode", "loop", "handoffs"), { recursive: true });

    writeFileSync(
      resolve(post500RetryRoot, ".opencode", "loop", "prompts", DEFAULT_PROMPT_FILE_NAME),
      [
        "Recover from transient network or 5xx errors during session create and message send.",
        "Complete the item after retries succeed."
      ].join("\n") + "\n",
      "utf8"
    );

    writeFileSync(
      resolve(post500RetryRoot, ".opencode", "loop", "queue.json"),
      `${JSON.stringify(
        {
          version: LOOP_SCHEMA_VERSION,
          cursor: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          items: [
            {
              id: "network-post-500-retry-001",
              title: "Retry transient create and post 5xx errors",
              agent: "rag-build",
              promptFile: DEFAULT_PROMPT_PATH,
              status: "pending"
            }
          ]
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    const sessionsBeforePost500Retry = sessions.length;
    const post500RetryResult = await runLoop({
      repoRoot: post500RetryRoot,
      baseUrl,
      username: undefined,
      password: undefined,
      messageWaitMs: 50,
      pollIntervalMs: 5,
      autoRefillMaxCycles: 0
    });

    const post500RetryQueue = readQueue(resolve(post500RetryRoot, ".opencode", "loop", "queue.json"));
    const post500RetryItem = post500RetryQueue.items[0];
    const post500RetrySessions = sessions.slice(sessionsBeforePost500Retry);

    if (post500RetryResult.processedCount !== 1) {
      throw new Error(`Self-test post-500-retry path expected one processed item, got ${post500RetryResult.processedCount}.`);
    }

    if (post500RetrySessions.length !== 1) {
      throw new Error(`Self-test post-500-retry path expected one surviving session, got ${post500RetrySessions.length}.`);
    }

    if (post500RetryItem?.status !== "completed") {
      throw new Error("Self-test post-500-retry path did not complete the retried item.");
    }

    plannerDedupeRoot = mkdtempSync(join(tmpdir(), "opencode-loop-planner-dedupe-"));
    mkdirSync(resolve(plannerDedupeRoot, ".opencode", "loop", "prompts", "generated"), { recursive: true });
    mkdirSync(resolve(plannerDedupeRoot, ".opencode", "loop", "handoffs"), { recursive: true });

    const dedupePromptText =
      "Inspect the latest trace-summary closeout gap, make the smallest implementation change needed, run one focused validation command, and report exact files plus commands.";

    writeFileSync(
      resolve(plannerDedupeRoot, ".opencode", "loop", "prompts", DEFAULT_PLANNER_PROMPT_FILE_NAME),
      [
        "planner dedupe self-test",
        "Return the same generated task that already exists in the queue."
      ].join("\n") + "\n",
      "utf8"
    );

    writeFileSync(
      resolve(plannerDedupeRoot, ".opencode", "loop", "prompts", "generated", "trace-auto-001.md"),
      `${dedupePromptText}\n`,
      "utf8"
    );

    writeFileSync(
      resolve(plannerDedupeRoot, ".opencode", "loop", "queue.json"),
      `${JSON.stringify(
        {
          version: LOOP_SCHEMA_VERSION,
          cursor: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          items: [
            {
              id: "trace-auto-001",
              title: "Generated follow-up task",
              agent: "rag-build",
              promptFile: "prompts/generated/trace-auto-001.md",
              status: "completed",
              handoffPath: ".opencode/loop/handoffs/existing-trace-auto-001.md"
            }
          ]
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    const plannerDedupeResult = await runLoop({
      repoRoot: plannerDedupeRoot,
      baseUrl,
      username: undefined,
      password: undefined,
      autoRefillMaxCycles: 1,
      autoRefillMaxItems: 1
    });

    const plannerDedupeQueue = readQueue(resolve(plannerDedupeRoot, ".opencode", "loop", "queue.json"));

    if (plannerDedupeResult.processedCount !== 0) {
      throw new Error(`Self-test planner dedupe path expected zero processed items, got ${plannerDedupeResult.processedCount}.`);
    }

    if (plannerDedupeQueue.items.length !== 1) {
      throw new Error(`Self-test planner dedupe path incorrectly appended duplicate items: ${JSON.stringify(plannerDedupeQueue.items)}`);
    }

    staleLockRoot = mkdtempSync(join(tmpdir(), "opencode-loop-stale-lock-"));
    mkdirSync(resolve(staleLockRoot, ".opencode", "loop", "prompts"), { recursive: true });
    mkdirSync(resolve(staleLockRoot, ".opencode", "loop", "handoffs"), { recursive: true });
    mkdirSync(resolve(staleLockRoot, ".opencode", "loop.lock"), { recursive: true });

    writeFileSync(
      resolve(staleLockRoot, ".opencode", "loop", "prompts", DEFAULT_PROMPT_FILE_NAME),
      [
        "Ignore a stale lock record whose pid has been reused by another process.",
        "Process the pending item normally once the stale lock is cleared."
      ].join("\n") + "\n",
      "utf8"
    );

    writeFileSync(
      resolve(staleLockRoot, ".opencode", "loop", "queue.json"),
      `${JSON.stringify(
        {
          version: LOOP_SCHEMA_VERSION,
          cursor: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          items: [
            {
              id: "stale-lock-001",
              title: "Recover from stale lock info",
              agent: "rag-build",
              promptFile: DEFAULT_PROMPT_PATH,
              status: "pending"
            }
          ]
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    writeFileSync(
      resolve(staleLockRoot, ".opencode", "loop.lock", "lock.json"),
      `${JSON.stringify(
        {
          pid: process.pid,
          createdAt: new Date().toISOString(),
          processStartTicks: "definitely-stale-start-ticks",
          processCmdline: "definitely-not-the-current-process"
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    const staleLockResult = await runLoop({
      repoRoot: staleLockRoot,
      baseUrl,
      username: undefined,
      password: undefined,
      autoRefillMaxCycles: 0
    });

    const staleLockQueue = readQueue(resolve(staleLockRoot, ".opencode", "loop", "queue.json"));

    if (staleLockResult.processedCount !== 1 || staleLockQueue.items[0]?.status !== "completed") {
      throw new Error("Self-test stale-lock path did not recover and finish the pending item.");
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
    if (refillAffinityRoot) {
      rmSync(refillAffinityRoot, { recursive: true, force: true });
    }
    if (deferredRoot) {
      rmSync(deferredRoot, { recursive: true, force: true });
    }
    if (failureDeferRoot) {
      rmSync(failureDeferRoot, { recursive: true, force: true });
    }
    if (timeoutRetryRoot) {
      rmSync(timeoutRetryRoot, { recursive: true, force: true });
    }
    if (timeoutExhaustedRoot) {
      rmSync(timeoutExhaustedRoot, { recursive: true, force: true });
    }
    if (post500RetryRoot) {
      rmSync(post500RetryRoot, { recursive: true, force: true });
    }
    if (plannerDedupeRoot) {
      rmSync(plannerDedupeRoot, { recursive: true, force: true });
    }
    if (refillPersistRoot) {
      rmSync(refillPersistRoot, { recursive: true, force: true });
    }
    if (reviewPromotionRoot) {
      rmSync(reviewPromotionRoot, { recursive: true, force: true });
    }
    if (failureReviewRoot) {
      rmSync(failureReviewRoot, { recursive: true, force: true });
    }
    if (materializeRoot) {
      rmSync(materializeRoot, { recursive: true, force: true });
    }
    if (verifierSuccessRoot) {
      rmSync(verifierSuccessRoot, { recursive: true, force: true });
    }
    if (verifierReplanRoot) {
      rmSync(verifierReplanRoot, { recursive: true, force: true });
    }
    if (verifierExhaustedRoot) {
      rmSync(verifierExhaustedRoot, { recursive: true, force: true });
    }
    if (verifierCommandFailureRoot) {
      rmSync(verifierCommandFailureRoot, { recursive: true, force: true });
    }
    if (verifierCommandDefaultBlockedRoot) {
      rmSync(verifierCommandDefaultBlockedRoot, { recursive: true, force: true });
    }
    if (verifierCommandBlockedRoot) {
      rmSync(verifierCommandBlockedRoot, { recursive: true, force: true });
    }
    if (verifierArtifactDefaultReviewRoot) {
      rmSync(verifierArtifactDefaultReviewRoot, { recursive: true, force: true });
    }
    if (verifierArtifactReviewRoot) {
      rmSync(verifierArtifactReviewRoot, { recursive: true, force: true });
    }
    if (manualResumeRoot) {
      rmSync(manualResumeRoot, { recursive: true, force: true });
    }
    if (resumeWindowRoot) {
      rmSync(resumeWindowRoot, { recursive: true, force: true });
    }
    if (staleLockRoot) {
      rmSync(staleLockRoot, { recursive: true, force: true });
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
