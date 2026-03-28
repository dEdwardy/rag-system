const assert = require("node:assert/strict");
const { test } = require("node:test");

const { EvalQuestionSetsController } = require("../src/modules/eval-question-sets/eval-question-sets.controller.ts");
const { EvalQuestionSetsService } = require("../src/modules/eval-question-sets/eval-question-sets.service.ts");

function buildRequest() {
  return {
    authContext: {
      identity: {
        userId: "user-auth",
        tenantId: "tenant-auth",
        sessionId: "session-1",
        authSource: "session"
      },
      currentIdentity: {
        userId: "user-auth",
        tenantId: "tenant-auth",
        sessionId: "session-1",
        authSource: "session"
      }
    }
  };
}

function buildService(prisma, askAssistantService = { askAssistant: async () => ({}) }) {
  return new EvalQuestionSetsService(prisma, askAssistantService);
}

test("EvalQuestionSetsController forwards request identity for create/update/lock/archive/baseline/run/demo-replay", async () => {
  const calls = [];
  const controller = new EvalQuestionSetsController({
    createQuestionSet: async (input, identity) => {
      calls.push({ type: "create", input, identity });
      return { id: "set-1" };
    },
    updateQuestionSet: async (id, input, identity) => {
      calls.push({ type: "update", id, input, identity });
      return { id };
    },
    lockQuestionSet: async (id, identity) => {
      calls.push({ type: "lock", id, identity });
      return { id };
    },
    archiveQuestionSet: async (id, identity) => {
      calls.push({ type: "archive", id, identity });
      return { id };
    },
    snapshotBaseline: async (id, identity) => {
      calls.push({ type: "snapshot-baseline", id, identity });
      return { id: "snapshot-1" };
    },
    chooseBaselineSnapshot: async (id, input, identity) => {
      calls.push({ type: "choose-baseline", id, input, identity });
      return { id };
    },
    compareWithBaseline: async (id, identity) => {
      calls.push({ type: "compare-baseline", id, identity });
      return { hasBaseline: true };
    },
    runQuestionSet: async (id, input, identity) => {
      calls.push({ type: "run", id, input, identity });
      return { id: "run-1" };
    },
    runP5V1DemoReplay: async identity => {
      calls.push({ type: "run-demo-replay", identity });
      return { id: "demo-run-1" };
    }
  });

  const request = buildRequest();
  await controller.createQuestionSet({ name: "P5 set", questions: ["Q1"] }, request);
  await controller.updateQuestionSet("set-1", { name: "Updated" }, request);
  await controller.lockQuestionSet("set-1", request);
  await controller.archiveQuestionSet("set-1", request);
  await controller.snapshotBaseline("set-1", request);
  await controller.chooseBaseline("set-1", { snapshotId: "snapshot-1" }, request);
  await controller.compareWithBaseline("set-1", request);
  await controller.runQuestionSet("set-1", { assistantId: "assistant-1" }, request);
  await controller.runP5V1DemoReplay(request);

  assert.deepEqual(calls, [
    {
      type: "create",
      input: {
        name: "P5 set",
        questions: ["Q1"]
      },
      identity: request.authContext.currentIdentity
    },
    {
      type: "update",
      id: "set-1",
      input: {
        name: "Updated"
      },
      identity: request.authContext.currentIdentity
    },
    {
      type: "lock",
      id: "set-1",
      identity: request.authContext.currentIdentity
    },
    {
      type: "archive",
      id: "set-1",
      identity: request.authContext.currentIdentity
    },
    {
      type: "snapshot-baseline",
      id: "set-1",
      identity: request.authContext.currentIdentity
    },
    {
      type: "choose-baseline",
      id: "set-1",
      input: {
        snapshotId: "snapshot-1"
      },
      identity: request.authContext.currentIdentity
    },
    {
      type: "compare-baseline",
      id: "set-1",
      identity: request.authContext.currentIdentity
    },
    {
      type: "run",
      id: "set-1",
      input: {
        assistantId: "assistant-1"
      },
      identity: request.authContext.currentIdentity
    },
    {
      type: "run-demo-replay",
      identity: request.authContext.currentIdentity
    }
  ]);
});

test("EvalQuestionSetsService writes question-set ownership from auth identity", async () => {
  const calls = {
    ensureTenant: [],
    ensureOwner: [],
    create: []
  };

  const service = buildService({
    tenant: {
      findUnique: async ({ where }) => {
        calls.ensureTenant.push(where);
        return { id: where.id };
      }
    },
    user: {
      findUnique: async ({ where }) => {
        calls.ensureOwner.push(where);
        return { id: where.id };
      }
    },
    evalQuestionSet: {
      create: async args => {
        calls.create.push(args);
        return { id: "set-1", ...args.data };
      }
    }
  });

  await service.createQuestionSet(
    {
      name: "set",
      description: "desc",
      questions: ["Q1", "Q2"]
    },
    {
      tenantId: "tenant-auth",
      userId: "user-auth"
    }
  );

  assert.deepEqual(calls.ensureTenant, [{ id: "tenant-auth" }]);
  assert.deepEqual(calls.ensureOwner, [{ id: "user-auth" }]);
  assert.deepEqual(calls.create, [
    {
      data: {
        tenantId: "tenant-auth",
        ownerId: "user-auth",
        name: "set",
        description: "desc",
        questionsJson: ["Q1", "Q2"]
      }
    }
  ]);
});

test("EvalQuestionSetsService blocks editing locked sets", async () => {
  const service = buildService({
    evalQuestionSet: {
      findFirst: async () => ({
        id: "set-locked",
        tenantId: "tenant-auth",
        ownerId: "user-auth",
        status: "locked"
      })
    }
  });

  await assert.rejects(
    service.updateQuestionSet(
      "set-locked",
      {
        name: "cannot-edit"
      },
      {
        tenantId: "tenant-auth",
        userId: "user-auth"
      }
    ),
    /locked and cannot be edited/
  );
});

test("EvalQuestionSetsService lock operation sets locked status and timestamp", async () => {
  const calls = [];
  const service = buildService({
    evalQuestionSet: {
      findFirst: async () => ({
        id: "set-1",
        tenantId: "tenant-auth",
        ownerId: "user-auth",
        status: "draft"
      }),
      update: async args => {
        calls.push(args);
        return { id: "set-1", ...args.data };
      }
    }
  });

  const result = await service.lockQuestionSet("set-1", {
    tenantId: "tenant-auth",
    userId: "user-auth"
  });

  assert.equal(result.status, "locked");
  assert.ok(result.lockedAt instanceof Date);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].where.id, "set-1");
  assert.equal(calls[0].data.status, "locked");
  assert.ok(calls[0].data.lockedAt instanceof Date);
});

test("EvalQuestionSetsService archive operation sets archived status and timestamp", async () => {
  const calls = [];
  const service = buildService({
    evalQuestionSet: {
      findFirst: async () => ({
        id: "set-1",
        tenantId: "tenant-auth",
        ownerId: "user-auth",
        status: "locked"
      }),
      update: async args => {
        calls.push(args);
        return { id: "set-1", ...args.data };
      }
    }
  });

  const result = await service.archiveQuestionSet("set-1", {
    tenantId: "tenant-auth",
    userId: "user-auth"
  });

  assert.equal(result.status, "archived");
  assert.ok(result.archivedAt instanceof Date);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].where.id, "set-1");
  assert.equal(calls[0].data.status, "archived");
  assert.ok(calls[0].data.archivedAt instanceof Date);
});

test("EvalQuestionSetsService increments current version when updating editable fields", async () => {
  const calls = [];
  const service = buildService({
    evalQuestionSet: {
      findFirst: async () => ({
        id: "set-1",
        tenantId: "tenant-auth",
        ownerId: "user-auth",
        status: "draft"
      }),
      update: async args => {
        calls.push(args);
        return { id: "set-1", ...args.data };
      }
    }
  });

  await service.updateQuestionSet(
    "set-1",
    {
      questions: ["Q1 updated"]
    },
    {
      tenantId: "tenant-auth",
      userId: "user-auth"
    }
  );

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].data.currentVersion, { increment: 1 });
  assert.deepEqual(calls[0].data.questionsJson, ["Q1 updated"]);
});

test("EvalQuestionSetsService snapshot baseline creates immutable snapshot for current version", async () => {
  const calls = {
    create: []
  };
  const service = buildService({
    evalQuestionSet: {
      findFirst: async () => ({
        id: "set-1",
        tenantId: "tenant-auth",
        ownerId: "user-auth",
        status: "draft",
        currentVersion: 3,
        name: "P5 set",
        description: "desc",
        questionsJson: ["Q1", "Q2"]
      })
    },
    evalQuestionSetBaselineSnapshot: {
      findFirst: async () => null,
      create: async args => {
        calls.create.push(args);
        return { id: "snapshot-1", ...args.data };
      }
    }
  });

  const result = await service.snapshotBaseline("set-1", {
    tenantId: "tenant-auth",
    userId: "user-auth"
  });

  assert.equal(result.id, "snapshot-1");
  assert.equal(calls.create.length, 1);
  assert.deepEqual(calls.create[0].data, {
    tenantId: "tenant-auth",
    ownerId: "user-auth",
    questionSetId: "set-1",
    version: 3,
    name: "P5 set",
    description: "desc",
    questionsJson: ["Q1", "Q2"]
  });
});

test("EvalQuestionSetsService choose baseline assigns selected snapshot", async () => {
  const calls = [];
  const service = buildService({
    evalQuestionSet: {
      findFirst: async ({ where }) => {
        if (where.id === "set-1") {
          return {
            id: "set-1",
            tenantId: "tenant-auth",
            ownerId: "user-auth",
            status: "draft"
          };
        }

        return null;
      },
      update: async args => {
        calls.push(args);
        return { id: "set-1", ...args.data };
      }
    },
    evalQuestionSetBaselineSnapshot: {
      findFirst: async () => ({
        id: "snapshot-1",
        questionSetId: "set-1"
      })
    }
  });

  const result = await service.chooseBaselineSnapshot(
    "set-1",
    {
      snapshotId: "snapshot-1"
    },
    {
      tenantId: "tenant-auth",
      userId: "user-auth"
    }
  );

  assert.equal(result.baselineSnapshotId, "snapshot-1");
  assert.ok(result.baselineChosenAt instanceof Date);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].where.id, "set-1");
});

test("EvalQuestionSetsService compare baseline returns diff summary", async () => {
  const service = buildService({
    evalQuestionSet: {
      findFirst: async ({ where }) => {
        if (where.id === "set-1") {
          return {
            id: "set-1",
            tenantId: "tenant-auth",
            ownerId: "user-auth",
            currentVersion: 4,
            baselineSnapshotId: "snapshot-1",
            name: "set-current",
            description: "desc-current",
            questionsJson: ["Q1", "Q3"]
          };
        }

        return null;
      }
    },
    evalQuestionSetBaselineSnapshot: {
      findFirst: async () => ({
        id: "snapshot-1",
        questionSetId: "set-1",
        version: 2,
        name: "set-baseline",
        description: "desc-baseline",
        questionsJson: ["Q1", "Q2"]
      })
    }
  });

  const result = await service.compareWithBaseline("set-1", {
    tenantId: "tenant-auth",
    userId: "user-auth"
  });

  assert.deepEqual(result, {
    hasBaseline: true,
    baselineSnapshotId: "snapshot-1",
    baselineVersion: 2,
    currentVersion: 4,
    hasChanges: true,
    changedFields: {
      name: true,
      description: true,
      questions: true
    },
    questionDiff: {
      added: 1,
      removed: 1,
      unchanged: 1
    },
    evalResultComparison: {
      hasLatestEvalResult: false,
      hasPinnedBaselineEvalResult: false,
      latestEvalRanAt: null,
      pinnedBaselineCapturedAt: null
    }
  });
});

test("EvalQuestionSetsService runQuestionSet uses selected baseline snapshot questions", async () => {
  const askCalls = [];
  const service = buildService(
    {
      evalQuestionSet: {
        findFirst: async ({ where }) => {
          if (where.id === "set-1") {
            return {
              id: "set-1",
              tenantId: "tenant-auth",
              ownerId: "user-auth",
              baselineSnapshotId: "snapshot-selected",
              questionsJson: ["Q1", "Q2"],
              pinnedBaselineResultJson: null,
              pinnedBaselineCapturedAt: null
            };
          }

          return null;
        },
        update: async () => ({ id: "set-1" })
      },
      evalQuestionSetBaselineSnapshot: {
        findFirst: async ({ where }) => ({
          id: where.id,
          version: 2,
          questionsJson: ["Q1", "Q2"]
        })
      }
    },
    {
      askAssistant: async input => {
        askCalls.push(input);
        return {
          traceId: `trace-${askCalls.length}`,
          conversationId: `conv-${askCalls.length}`,
          answerStatus: "grounded",
          citations: [{ id: `citation-${askCalls.length}` }],
          qualityEvaluation: {
            overall: "strong",
            primaryIssue: "none"
          },
          answeringMetadata: {
            usedFallback: false
          }
        };
      }
    }
  );

  const result = await service.runQuestionSet(
    "set-1",
    {
      assistantId: "assistant-1"
    },
    {
      tenantId: "tenant-auth",
      userId: "user-auth",
      sessionId: "session-1",
      authSource: "session"
    }
  );

  assert.equal(result.baselineSnapshotId, "snapshot-selected");
  assert.deepEqual(result.totals, {
    total: 2,
    succeeded: 2,
    failed: 0
  });
  assert.equal(result.items[0].status, "succeeded");
  assert.equal(result.items[0].qualityOverall, "strong");
  assert.equal(result.items[0].citationCount, 1);
  assert.deepEqual(result.summary, {
    total: 2,
    succeeded: 2,
    failed: 0,
    successRate: 1,
    groundedRate: 1,
    strongRate: 1,
    fallbackRate: 0,
    averageCitationCount: 1
  });
  assert.deepEqual(result.qualityGate, {
    mode: "warn",
    status: "passed",
    limitVersion: "p5_v1_core_quality_gate_v1",
    breachedMetricCount: 0,
    breachedMetrics: [],
    message: "All core quality metrics are within P5 v1 limits."
  });
  assert.deepEqual(result.baselineComparison, {
    hasPinnedBaselineEvalResult: false,
    baselineCapturedAt: null,
    baselineInitialized: true,
    comparisonMeaningful: true,
    questionSetDrift: {
      hasDrift: false,
      currentQuestionCount: 2,
      baselineQuestionCount: 2,
      addedQuestionCount: 0,
      removedQuestionCount: 0,
      unchangedQuestionCount: 2
    }
  });
  assert.equal(result.reportExports.markdown.format, "markdown");
  assert.equal(result.reportExports.json.format, "json");
  assert.equal(result.reportExports.html.format, "html");
  assert.match(result.reportExports.markdown.content, /# P5 v1 eval report/);
  assert.match(result.reportExports.json.content, /"schemaVersion": "p5_v1_report_export_v1"/);
  assert.match(result.reportExports.html.content, /<!doctype html>/i);
  assert.deepEqual(
    askCalls.map(call => ({ assistantId: call.assistantId, question: call.question })),
    [
      { assistantId: "assistant-1", question: "Q1" },
      { assistantId: "assistant-1", question: "Q2" }
    ]
  );
});

test("EvalQuestionSetsService runQuestionSet allows baseline override and captures ask failures", async () => {
  const service = buildService(
    {
      evalQuestionSet: {
        findFirst: async () => ({
          id: "set-1",
          tenantId: "tenant-auth",
          ownerId: "user-auth",
          baselineSnapshotId: "snapshot-selected",
          questionsJson: ["Q1"],
          pinnedBaselineResultJson: {
            total: 1,
            succeeded: 1,
            failed: 0,
            successRate: 1,
            groundedRate: 1,
            strongRate: 1,
            fallbackRate: 0,
            averageCitationCount: 1
          },
          pinnedBaselineCapturedAt: new Date("2026-03-29T00:00:00.000Z")
        }),
        update: async () => ({ id: "set-1" })
      },
      evalQuestionSetBaselineSnapshot: {
        findFirst: async ({ where }) => ({
          id: where.id,
          version: 4,
          questionsJson: ["Q1"]
        })
      }
    },
    {
      askAssistant: async () => {
        throw Object.assign(new Error("Ask pipeline failed."), {
          getResponse() {
            return {
              message: "Ask pipeline failed.",
              code: "ASK_PIPELINE_FAILED",
              traceId: "trace-err"
            };
          }
        });
      }
    }
  );

  const result = await service.runQuestionSet(
    "set-1",
    {
      assistantId: "assistant-1",
      baselineSnapshotId: "snapshot-override"
    },
    {
      tenantId: "tenant-auth",
      userId: "user-auth",
      sessionId: "session-1",
      authSource: "session"
    }
  );

  assert.equal(result.baselineSnapshotId, "snapshot-override");
  assert.deepEqual(result.totals, {
    total: 1,
    succeeded: 0,
    failed: 1
  });
  assert.deepEqual(result.items[0], {
    index: 1,
    question: "Q1",
    status: "failed",
    traceId: "trace-err",
    conversationId: null,
    answerStatus: null,
    qualityOverall: null,
    qualityPrimaryIssue: null,
    citationCount: 0,
    usedFallback: null,
    error: {
      message: "Ask pipeline failed.",
      code: "ASK_PIPELINE_FAILED"
    }
  });
  assert.deepEqual(result.summary, {
    total: 1,
    succeeded: 0,
    failed: 1,
    successRate: 0,
    groundedRate: 0,
    strongRate: 0,
    fallbackRate: 0,
    averageCitationCount: 0
  });
  assert.deepEqual(result.qualityGate, {
    mode: "warn",
    status: "warning",
    limitVersion: "p5_v1_core_quality_gate_v1",
    breachedMetricCount: 4,
    breachedMetrics: [
      {
        metric: "successRate",
        limitType: "min",
        limit: 0.8,
        current: 0,
        delta: -0.8
      },
      {
        metric: "groundedRate",
        limitType: "min",
        limit: 0.75,
        current: 0,
        delta: -0.75
      },
      {
        metric: "strongRate",
        limitType: "min",
        limit: 0.6,
        current: 0,
        delta: -0.6
      },
      {
        metric: "averageCitationCount",
        limitType: "min",
        limit: 0.8,
        current: 0,
        delta: -0.8
      }
    ],
    message: "4 core quality metric(s) crossed P5 v1 limits."
  });
  assert.deepEqual(result.baselineComparison, {
    hasPinnedBaselineEvalResult: true,
    baselineCapturedAt: new Date("2026-03-29T00:00:00.000Z"),
    baselineInitialized: false,
    comparisonMeaningful: true,
    questionSetDrift: {
      hasDrift: false,
      currentQuestionCount: 1,
      baselineQuestionCount: 1,
      addedQuestionCount: 0,
      removedQuestionCount: 0,
      unchangedQuestionCount: 1
    },
    deltas: {
      metrics: [
        {
          metric: "succeeded",
          current: 0,
          baseline: 1,
          delta: -1
        },
        {
          metric: "failed",
          current: 1,
          baseline: 0,
          delta: 1
        },
        {
          metric: "successRate",
          current: 0,
          baseline: 1,
          delta: -1
        },
        {
          metric: "groundedRate",
          current: 0,
          baseline: 1,
          delta: -1
        },
        {
          metric: "strongRate",
          current: 0,
          baseline: 1,
          delta: -1
        },
        {
          metric: "fallbackRate",
          current: 0,
          baseline: 0,
          delta: 0
        },
        {
          metric: "averageCitationCount",
          current: 0,
          baseline: 1,
          delta: -1
        }
      ],
      meaningfulDeltas: [
        {
          metric: "succeeded",
          current: 0,
          baseline: 1,
          delta: -1
        },
        {
          metric: "failed",
          current: 1,
          baseline: 0,
          delta: 1
        },
        {
          metric: "successRate",
          current: 0,
          baseline: 1,
          delta: -1
        },
        {
          metric: "groundedRate",
          current: 0,
          baseline: 1,
          delta: -1
        },
        {
          metric: "strongRate",
          current: 0,
          baseline: 1,
          delta: -1
        },
        {
          metric: "averageCitationCount",
          current: 0,
          baseline: 1,
          delta: -1
        }
      ]
    },
    diffSummary: {
      headline: "metrics regressed: 6; improved: 0; unchanged: 1; regressed questions: 0",
      regressedMetricCount: 6,
      improvedMetricCount: 0,
      unchangedMetricCount: 1,
      regressedQuestionCount: 0,
      regressedMetrics: [
        {
          metric: "succeeded",
          current: 0,
          baseline: 1,
          delta: -1
        },
        {
          metric: "failed",
          current: 1,
          baseline: 0,
          delta: 1
        },
        {
          metric: "successRate",
          current: 0,
          baseline: 1,
          delta: -1
        },
        {
          metric: "groundedRate",
          current: 0,
          baseline: 1,
          delta: -1
        },
        {
          metric: "strongRate",
          current: 0,
          baseline: 1,
          delta: -1
        },
        {
          metric: "averageCitationCount",
          current: 0,
          baseline: 1,
          delta: -1
        }
      ],
      improvedMetrics: [],
      topRegressionReasons: []
    }
  });
  assert.equal(result.reportExports.markdown.format, "markdown");
  assert.equal(result.reportExports.json.format, "json");
  assert.equal(result.reportExports.html.format, "html");
  assert.match(result.reportExports.markdown.content, /## Diff summary/);
  assert.match(result.reportExports.html.content, /<h2>Diff summary<\/h2>/);
});

test("EvalQuestionSetsService runQuestionSet fails in quality gate fail mode when limits are crossed", async () => {
  const service = buildService(
    {
      evalQuestionSet: {
        findFirst: async () => ({
          id: "set-1",
          tenantId: "tenant-auth",
          ownerId: "user-auth",
          baselineSnapshotId: "snapshot-selected",
          questionsJson: ["Q1"],
          pinnedBaselineResultJson: {
            total: 1,
            succeeded: 1,
            failed: 0,
            successRate: 1,
            groundedRate: 1,
            strongRate: 1,
            fallbackRate: 0,
            averageCitationCount: 1
          },
          pinnedBaselineCapturedAt: new Date("2026-03-29T00:00:00.000Z")
        }),
        update: async () => ({ id: "set-1" })
      },
      evalQuestionSetBaselineSnapshot: {
        findFirst: async ({ where }) => ({
          id: where.id,
          version: 4,
          questionsJson: ["Q1"]
        })
      }
    },
    {
      askAssistant: async () => {
        throw Object.assign(new Error("Ask pipeline failed."), {
          getResponse() {
            return {
              message: "Ask pipeline failed.",
              code: "ASK_PIPELINE_FAILED",
              traceId: "trace-err"
            };
          }
        });
      }
    }
  );

  await assert.rejects(
    service.runQuestionSet(
      "set-1",
      {
        assistantId: "assistant-1",
        baselineSnapshotId: "snapshot-override",
        qualityGateMode: "fail"
      },
      {
        tenantId: "tenant-auth",
        userId: "user-auth",
        sessionId: "session-1",
        authSource: "session"
      }
    ),
    error => {
      const response = typeof error?.getResponse === "function" ? error.getResponse() : null;
      assert.equal(response?.code, "EVAL_QUALITY_GATE_FAILED");
      assert.equal(response?.qualityGate?.mode, "fail");
      assert.equal(response?.qualityGate?.status, "failed");
      assert.equal(response?.qualityGate?.breachedMetricCount, 4);
      assert.equal(response?.runResult?.qualityGate?.status, "failed");
      return true;
    }
  );
});

test("EvalQuestionSetsService runQuestionSet returns per-question failure drilldown for regressions", async () => {
  const callCount = {
    ask: 0
  };

  const service = buildService(
    {
      evalQuestionSet: {
        findFirst: async () => ({
          id: "set-1",
          tenantId: "tenant-auth",
          ownerId: "user-auth",
          baselineSnapshotId: "snapshot-selected",
          questionsJson: ["Q1", "Q2"],
          pinnedBaselineResultJson: {
            summary: {
              total: 2,
              succeeded: 2,
              failed: 0,
              successRate: 1,
              groundedRate: 1,
              strongRate: 1,
              fallbackRate: 0,
              averageCitationCount: 2
            },
            items: [
              {
                status: "succeeded",
                answerStatus: "grounded",
                qualityOverall: "strong",
                qualityPrimaryIssue: "none",
                citationCount: 2,
                usedFallback: false
              },
              {
                status: "succeeded",
                answerStatus: "grounded",
                qualityOverall: "strong",
                qualityPrimaryIssue: "none",
                citationCount: 2,
                usedFallback: false
              }
            ]
          },
          pinnedBaselineCapturedAt: new Date("2026-03-29T00:00:00.000Z")
        }),
        update: async () => ({ id: "set-1" })
      },
      evalQuestionSetBaselineSnapshot: {
        findFirst: async ({ where }) => ({
          id: where.id,
          version: 5,
          questionsJson: ["Q1", "Q2"]
        })
      }
    },
    {
      askAssistant: async () => {
        callCount.ask += 1;
        if (callCount.ask === 1) {
          throw Object.assign(new Error("Ask pipeline failed."), {
            getResponse() {
              return {
                message: "Ask pipeline failed.",
                code: "ASK_PIPELINE_FAILED",
                traceId: "trace-err"
              };
            }
          });
        }

        return {
          traceId: "trace-2",
          conversationId: "conv-2",
          answerStatus: "grounded",
          citations: [{ id: "citation-1" }],
          qualityEvaluation: {
            overall: "partial",
            primaryIssue: "low_retrieval_score"
          },
          answeringMetadata: {
            usedFallback: true
          }
        };
      }
    }
  );

  const result = await service.runQuestionSet(
    "set-1",
    {
      assistantId: "assistant-1",
      baselineSnapshotId: "snapshot-selected"
    },
    {
      tenantId: "tenant-auth",
      userId: "user-auth",
      sessionId: "session-1",
      authSource: "session"
    }
  );

  assert.deepEqual(result.baselineComparison?.failureDrilldown, {
    regressedQuestionCount: 2,
    weakestItems: [
      {
        index: 1,
        question: "Q1",
        severity: "critical",
        reasonCodes: ["became_failed", "citations_decreased"],
        baseline: {
          status: "succeeded",
          answerStatus: "grounded",
          qualityOverall: "strong",
          qualityPrimaryIssue: "none",
          citationCount: 2,
          usedFallback: false
        },
        current: {
          status: "failed",
          answerStatus: null,
          qualityOverall: null,
          qualityPrimaryIssue: null,
          citationCount: 0,
          usedFallback: null,
          error: {
            message: "Ask pipeline failed.",
            code: "ASK_PIPELINE_FAILED"
          }
        }
      },
      {
        index: 2,
        question: "Q2",
        severity: "high",
        reasonCodes: ["quality_degraded", "fallback_introduced", "citations_decreased"],
        baseline: {
          status: "succeeded",
          answerStatus: "grounded",
          qualityOverall: "strong",
          qualityPrimaryIssue: "none",
          citationCount: 2,
          usedFallback: false
        },
        current: {
          status: "succeeded",
          answerStatus: "grounded",
          qualityOverall: "partial",
          qualityPrimaryIssue: "low_retrieval_score",
          citationCount: 1,
          usedFallback: true,
          error: null
        }
      }
    ]
  });
  assert.deepEqual(result.baselineComparison?.diffSummary, {
    headline: "metrics regressed: 7; improved: 0; unchanged: 0; regressed questions: 2",
    regressedMetricCount: 7,
    improvedMetricCount: 0,
    unchangedMetricCount: 0,
    regressedQuestionCount: 2,
    regressedMetrics: [
      {
        metric: "succeeded",
        current: 1,
        baseline: 2,
        delta: -1
      },
      {
        metric: "failed",
        current: 1,
        baseline: 0,
        delta: 1
      },
      {
        metric: "successRate",
        current: 0.5,
        baseline: 1,
        delta: -0.5
      },
      {
        metric: "groundedRate",
        current: 0.5,
        baseline: 1,
        delta: -0.5
      },
      {
        metric: "strongRate",
        current: 0,
        baseline: 1,
        delta: -1
      },
      {
        metric: "fallbackRate",
        current: 0.5,
        baseline: 0,
        delta: 0.5
      },
      {
        metric: "averageCitationCount",
        current: 0.5,
        baseline: 2,
        delta: -1.5
      }
    ],
    improvedMetrics: [],
    topRegressionReasons: [
      {
        reasonCode: "citations_decreased",
        count: 2
      },
      {
        reasonCode: "became_failed",
        count: 1
      },
      {
        reasonCode: "fallback_introduced",
        count: 1
      },
      {
        reasonCode: "quality_degraded",
        count: 1
      }
    ]
  });
});

test("EvalQuestionSetsService runQuestionSet marks baseline comparison as non-meaningful when question set drift is detected", async () => {
  const service = buildService(
    {
      evalQuestionSet: {
        findFirst: async () => ({
          id: "set-1",
          tenantId: "tenant-auth",
          ownerId: "user-auth",
          baselineSnapshotId: "snapshot-selected",
          questionsJson: ["Q1", "Q2"],
          pinnedBaselineResultJson: {
            total: 1,
            succeeded: 1,
            failed: 0,
            successRate: 1,
            groundedRate: 1,
            strongRate: 1,
            fallbackRate: 0,
            averageCitationCount: 1
          },
          pinnedBaselineCapturedAt: new Date("2026-03-29T00:00:00.000Z")
        }),
        update: async () => ({ id: "set-1" })
      },
      evalQuestionSetBaselineSnapshot: {
        findFirst: async ({ where }) => ({
          id: where.id,
          version: 4,
          questionsJson: ["Q1"]
        })
      }
    },
    {
      askAssistant: async () => ({
        traceId: "trace-1",
        conversationId: "conv-1",
        answerStatus: "grounded",
        citations: [{ id: "citation-1" }],
        qualityEvaluation: {
          overall: "strong",
          primaryIssue: "none"
        },
        answeringMetadata: {
          usedFallback: false
        }
      })
    }
  );

  const result = await service.runQuestionSet(
    "set-1",
    {
      assistantId: "assistant-1"
    },
    {
      tenantId: "tenant-auth",
      userId: "user-auth",
      sessionId: "session-1",
      authSource: "session"
    }
  );

  assert.equal(result.baselineComparison.comparisonMeaningful, false);
  assert.deepEqual(result.baselineComparison.questionSetDrift, {
    hasDrift: true,
    currentQuestionCount: 2,
    baselineQuestionCount: 1,
    addedQuestionCount: 1,
    removedQuestionCount: 0,
    unchangedQuestionCount: 1
  });
  assert.equal("deltas" in result.baselineComparison, false);
});

test("EvalQuestionSetsService runP5V1DemoReplay uses fixed scenario and returns replay entry", async () => {
  const askCalls = [];
  const findFirstByNameCalls = [];
  const updateCalls = [];
  const createdQuestionSet = {
    id: "set-demo",
    tenantId: "tenant-auth",
    ownerId: "user-auth",
    status: "draft",
    currentVersion: 1,
    name: "p5-v1-demo-replay",
    description: "Fixed P5 v1 demo replay scenario for stable end-to-end demonstration.",
    questionsJson: ["Q1", "Q2", "Q3"]
  };

  const service = buildService(
    {
      tenant: {
        findUnique: async () => ({ id: "tenant-auth" })
      },
      user: {
        findUnique: async () => ({ id: "user-auth" })
      },
      evalQuestionSet: {
        findFirst: async ({ where }) => {
          if (where.id) {
            return {
              id: "set-demo",
              tenantId: "tenant-auth",
              ownerId: "user-auth",
              baselineSnapshotId: "snapshot-demo",
              pinnedBaselineResultJson: null,
              pinnedBaselineCapturedAt: null,
              status: "draft"
            };
          }

          if (where.name) {
            findFirstByNameCalls.push(where.name);
            return null;
          }

          return null;
        },
        create: async () => createdQuestionSet,
        update: async args => {
          updateCalls.push(args);
          return {
            id: "set-demo",
            baselineSnapshotId: args.data.baselineSnapshotId ?? "snapshot-demo",
            baselineChosenAt: args.data.baselineChosenAt ?? null
          };
        }
      },
      evalQuestionSetBaselineSnapshot: {
        findFirst: async ({ where }) => {
          if (where.version) {
            return null;
          }

          return {
            id: where.id ?? "snapshot-demo",
            version: 2,
            questionsJson: [
              "Summarize one key capability of this knowledge base and cite evidence.",
              "What source families are currently supported for external ingestion?",
              "Ask a likely no-hit question and explain why the answer may be insufficient."
            ]
          };
        },
        create: async () => ({
          id: "snapshot-demo",
          version: 2,
          questionSetId: "set-demo"
        })
      }
    },
    {
      askAssistant: async input => {
        askCalls.push(input);
        return {
          traceId: `trace-${askCalls.length}`,
          conversationId: `conv-${askCalls.length}`,
          answerStatus: "grounded",
          citations: [{ id: `citation-${askCalls.length}` }],
          qualityEvaluation: {
            overall: "strong",
            primaryIssue: "none"
          },
          answeringMetadata: {
            usedFallback: false
          }
        };
      }
    }
  );

  const result = await service.runP5V1DemoReplay({
    tenantId: "tenant-auth",
    userId: "user-auth",
    sessionId: "session-1",
    authSource: "session"
  });

  assert.deepEqual(findFirstByNameCalls, ["p5-v1-demo-replay"]);
  assert.equal(result.replayEntry.id, "p5-v1");
  assert.equal(result.replayEntry.assistantId, "default-assistant");
  assert.equal(result.totals.total, 3);
  assert.equal(askCalls.length, 3);
  assert.deepEqual(
    askCalls.map(call => ({ assistantId: call.assistantId, question: call.question })),
    [
      {
        assistantId: "default-assistant",
        question: "Summarize one key capability of this knowledge base and cite evidence."
      },
      {
        assistantId: "default-assistant",
        question: "What source families are currently supported for external ingestion?"
      },
      {
        assistantId: "default-assistant",
        question: "Ask a likely no-hit question and explain why the answer may be insufficient."
      }
    ]
  );

  assert.ok(
    updateCalls.some(call => call.data && call.data.latestEvalResultSummaryJson),
    "expected eval-question-set run summary to be persisted"
  );
});
