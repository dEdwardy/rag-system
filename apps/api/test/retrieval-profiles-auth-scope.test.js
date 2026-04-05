const assert = require("node:assert/strict");
const { test } = require("node:test");

const { AssistantsService } = require("../src/modules/assistants/assistants.service.ts");
const { RetrievalProfilesController } = require("../src/modules/retrieval-profiles/retrieval-profiles.controller.ts");
const { RetrievalProfilesService } = require("../src/modules/retrieval-profiles/retrieval-profiles.service.ts");

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

test("RetrievalProfilesController passes request identity to read/write service calls", async () => {
  const calls = [];
  const controller = new RetrievalProfilesController({
    listRetrievalProfiles: async identity => {
      calls.push({ type: "list", identity });
      return [];
    },
    getRetrievalProfile: async (id, identity) => {
      calls.push({ type: "get", id, identity });
      return { id };
    },
    createRetrievalProfile: async (input, identity) => {
      calls.push({ type: "create", input, identity });
      return { id: "profile-1" };
    },
    updateRetrievalProfile: async (id, input, identity) => {
      calls.push({ type: "update", id, input, identity });
      return { id };
    }
  });

  const request = buildRequest();
  await controller.listRetrievalProfiles(request);
  await controller.getRetrievalProfile("profile-1", request);
  await controller.createRetrievalProfile(
    {
      name: "Scoped profile",
      topK: 3,
      chunkWindow: 0,
      enableHybrid: false,
      enableRerank: false,
      scoreThreshold: 0
    },
    request
  );
  await controller.updateRetrievalProfile(
    "profile-1",
    {
      topK: 5
    },
    request
  );

  assert.deepEqual(calls, [
    {
      type: "list",
      identity: {
        userId: "user-auth",
        tenantId: "tenant-auth",
        sessionId: "session-1",
        authSource: "session"
      }
    },
    {
      type: "get",
      id: "profile-1",
      identity: {
        userId: "user-auth",
        tenantId: "tenant-auth",
        sessionId: "session-1",
        authSource: "session"
      }
    },
    {
      type: "create",
      input: {
        name: "Scoped profile",
        topK: 3,
        chunkWindow: 0,
        enableHybrid: false,
        enableRerank: false,
        scoreThreshold: 0
      },
      identity: {
        userId: "user-auth",
        tenantId: "tenant-auth",
        sessionId: "session-1",
        authSource: "session"
      }
    },
    {
      type: "update",
      id: "profile-1",
      input: {
        topK: 5
      },
      identity: {
        userId: "user-auth",
        tenantId: "tenant-auth",
        sessionId: "session-1",
        authSource: "session"
      }
    }
  ]);
});

test("RetrievalProfilesService applies owner scope to list/get and stamps owner on create", async () => {
  const calls = {
    list: [],
    get: [],
    create: []
  };
  const fakeService = Object.assign(Object.create(RetrievalProfilesService.prototype), {
    prisma: {
      retrievalProfile: {
        findMany: async args => {
          calls.list.push(args);
          return [];
        },
        findFirst: async args => {
          calls.get.push(args);
          return { id: "profile-1" };
        },
        create: async args => {
          calls.create.push(args);
          return { id: "profile-1" };
        }
      }
    }
  });

  const scope = {
    tenantId: "tenant-auth",
    userId: "user-auth"
  };

  await RetrievalProfilesService.prototype.listRetrievalProfiles.call(fakeService, scope);
  await RetrievalProfilesService.prototype.getRetrievalProfile.call(fakeService, "profile-1", scope);
  await RetrievalProfilesService.prototype.createRetrievalProfile.call(
    fakeService,
    {
      name: "Scoped profile",
      topK: 3,
      chunkWindow: 0,
      enableHybrid: false,
      enableRerank: false,
      scoreThreshold: 0
    },
    scope
  );

  assert.deepEqual(calls.list, [
    {
      where: {
        tenantId: "tenant-auth",
        ownerId: "user-auth"
      },
      orderBy: {
        createdAt: "desc"
      }
    }
  ]);
  assert.deepEqual(calls.get, [
    {
      where: {
        id: "profile-1",
        tenantId: "tenant-auth",
        ownerId: "user-auth"
      }
    }
  ]);
  assert.deepEqual(calls.create, [
    {
      data: {
        tenantId: "tenant-auth",
        ownerId: "user-auth",
        name: "Scoped profile",
        topK: 3,
        chunkWindow: 0,
        enableHybrid: false,
        enableRerank: false,
        scoreThreshold: 0
      }
    }
  ]);
});

test("AssistantsService validates retrievalProfileId within current identity scope", async () => {
  const observedCalls = [];
  const scope = {
    tenantId: "tenant-auth",
    userId: "user-auth"
  };

  const fakeService = Object.assign(Object.create(AssistantsService.prototype), {
    getAssistant: async () => ({ id: "assistant-1" }),
    retrievalProfilesService: {
      getRetrievalProfile: async (id, receivedScope) => {
        observedCalls.push({ id, scope: receivedScope });
        return { id };
      }
    },
    prisma: {
      assistant: {
        update: async () => ({ id: "assistant-1" })
      }
    }
  });

  await AssistantsService.prototype.updateAssistant.call(
    fakeService,
    "assistant-1",
    {
      retrievalProfileId: "profile-owned"
    },
    scope
  );

  assert.deepEqual(observedCalls, [
    {
      id: "profile-owned",
      scope
    }
  ]);
});
