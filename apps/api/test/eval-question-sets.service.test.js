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

test("EvalQuestionSetsController forwards request identity for create/update/lock/archive", async () => {
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
    }
  });

  const request = buildRequest();
  await controller.createQuestionSet({ name: "P5 set", questions: ["Q1"] }, request);
  await controller.updateQuestionSet("set-1", { name: "Updated" }, request);
  await controller.lockQuestionSet("set-1", request);
  await controller.archiveQuestionSet("set-1", request);

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
    }
  ]);
});

test("EvalQuestionSetsService writes question-set ownership from auth identity", async () => {
  const calls = {
    ensureTenant: [],
    ensureOwner: [],
    create: []
  };

  const service = new EvalQuestionSetsService({
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
  const service = new EvalQuestionSetsService({
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
  const service = new EvalQuestionSetsService({
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
  const service = new EvalQuestionSetsService({
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
