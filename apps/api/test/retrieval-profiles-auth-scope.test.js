import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'vitest';

const require = createRequire(import.meta.url);

const {
  AssistantsService
} = require('../src/modules/assistants/assistants.service.ts');
const {
  RetrievalProfilesController
} = require('../src/modules/retrieval-profiles/retrieval-profiles.controller.ts');
const {
  RetrievalProfilesService
} = require('../src/modules/retrieval-profiles/retrieval-profiles.service.ts');

function buildRequest() {
  return {
    authContext: {
      identity: {
        userId: 'user-auth',
        tenantId: 'tenant-auth',
        sessionId: 'session-1',
        authSource: 'session'
      },
      currentIdentity: {
        userId: 'user-auth',
        tenantId: 'tenant-auth',
        sessionId: 'session-1',
        authSource: 'session'
      }
    }
  };
}

test('RetrievalProfilesController passes request identity to read/write service calls', async () => {
  const calls = [];
  const controller = new RetrievalProfilesController({
    listRetrievalProfiles: async (identity) => {
      calls.push({ type: 'list', identity });
      return [];
    },
    getRetrievalProfile: async (id, identity) => {
      calls.push({ type: 'get', id, identity });
      return { id };
    },
    createRetrievalProfile: async (input, identity) => {
      calls.push({ type: 'create', input, identity });
      return { id: 'profile-1' };
    },
    updateRetrievalProfile: async (id, input, identity) => {
      calls.push({ type: 'update', id, input, identity });
      return { id };
    }
  });

  const request = buildRequest();
  await controller.listRetrievalProfiles(request);
  await controller.getRetrievalProfile('profile-1', request);
  await controller.createRetrievalProfile(
    {
      name: 'Scoped profile',
      topK: 3,
      chunkWindow: 0,
      enableHybrid: false,
      enableRerank: false,
      scoreThreshold: 0
    },
    request
  );
  await controller.updateRetrievalProfile(
    'profile-1',
    {
      topK: 5
    },
    request
  );

  assert.deepEqual(calls, [
    {
      type: 'list',
      identity: {
        userId: 'user-auth',
        tenantId: 'tenant-auth',
        sessionId: 'session-1',
        authSource: 'session'
      }
    },
    {
      type: 'get',
      id: 'profile-1',
      identity: {
        userId: 'user-auth',
        tenantId: 'tenant-auth',
        sessionId: 'session-1',
        authSource: 'session'
      }
    },
    {
      type: 'create',
      input: {
        name: 'Scoped profile',
        topK: 3,
        chunkWindow: 0,
        enableHybrid: false,
        enableRerank: false,
        scoreThreshold: 0
      },
      identity: {
        userId: 'user-auth',
        tenantId: 'tenant-auth',
        sessionId: 'session-1',
        authSource: 'session'
      }
    },
    {
      type: 'update',
      id: 'profile-1',
      input: {
        topK: 5
      },
      identity: {
        userId: 'user-auth',
        tenantId: 'tenant-auth',
        sessionId: 'session-1',
        authSource: 'session'
      }
    }
  ]);
});

test('RetrievalProfilesService applies owner scope to list/get and stamps owner on create', async () => {
  const calls = {
    list: [],
    get: [],
    create: []
  };
  const fakeService = Object.assign(
    Object.create(RetrievalProfilesService.prototype),
    {
      prisma: {
        retrievalProfile: {
          findMany: async (args) => {
            calls.list.push(args);
            return [];
          },
          findFirst: async (args) => {
            calls.get.push(args);
            return { id: 'profile-1' };
          },
          create: async (args) => {
            calls.create.push(args);
            return { id: 'profile-1' };
          }
        }
      }
    }
  );

  const scope = {
    tenantId: 'tenant-auth',
    userId: 'user-auth'
  };

  await RetrievalProfilesService.prototype.listRetrievalProfiles.call(
    fakeService,
    scope
  );
  await RetrievalProfilesService.prototype.getRetrievalProfile.call(
    fakeService,
    'profile-1',
    scope
  );
  await RetrievalProfilesService.prototype.createRetrievalProfile.call(
    fakeService,
    {
      name: 'Scoped profile',
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
        tenantId: 'tenant-auth',
        ownerId: 'user-auth'
      },
      orderBy: {
        createdAt: 'desc'
      }
    }
  ]);
  assert.deepEqual(calls.get, [
    {
      where: {
        id: 'profile-1',
        tenantId: 'tenant-auth',
        ownerId: 'user-auth'
      }
    }
  ]);
  assert.deepEqual(calls.create, [
    {
      data: {
        tenantId: 'tenant-auth',
        ownerId: 'user-auth',
        name: 'Scoped profile',
        topK: 3,
        chunkWindow: 0,
        enableHybrid: false,
        enableRerank: false,
        scoreThreshold: 0
      }
    }
  ]);
});

test('AssistantsService validates retrievalProfileId within current identity scope', async () => {
  const observedCalls = [];
  const scope = {
    tenantId: 'tenant-auth',
    userId: 'user-auth'
  };

  const fakeService = Object.assign(
    Object.create(AssistantsService.prototype),
    {
      getAssistant: async () => ({ id: 'assistant-1' }),
      retrievalProfilesService: {
        getRetrievalProfile: async (id, receivedScope) => {
          observedCalls.push({ id, scope: receivedScope });
          return { id };
        }
      },
      prisma: {
        assistant: {
          update: async () => ({ id: 'assistant-1' })
        }
      }
    }
  );

  await AssistantsService.prototype.updateAssistant.call(
    fakeService,
    'assistant-1',
    {
      retrievalProfileId: 'profile-owned'
    },
    scope
  );

  assert.deepEqual(observedCalls, [
    {
      id: 'profile-owned',
      scope
    }
  ]);
});

test('AssistantsService prefers the canonical default assistant in list results for the same owner scope', async () => {
  const scope = {
    tenantId: 'tenant-auth',
    userId: 'user-auth'
  };

  const fakeService = Object.assign(
    Object.create(AssistantsService.prototype),
    {
      prisma: {
        assistant: {
          findMany: async () => [
            {
              id: 'assistant-secondary',
              tenantId: 'tenant-auth',
              kbId: 'kb-1',
              name: 'Research Assistant',
              description: null,
              systemPrompt: 'secondary',
              retrievalProfileId: 'profile-1',
              answerPolicyJson: null,
              status: 'active'
            },
            {
              id: 'assistant-default',
              tenantId: 'tenant-auth',
              kbId: 'kb-1',
              name: 'Default Assistant',
              description: null,
              systemPrompt: 'default',
              retrievalProfileId: 'profile-1',
              answerPolicyJson: null,
              status: 'active'
            }
          ]
        }
      }
    }
  );

  const assistants = await AssistantsService.prototype.listAssistants.call(
    fakeService,
    scope
  );

  assert.equal(assistants[0]?.id, 'assistant-default');
  assert.equal(assistants[1]?.id, 'assistant-secondary');
});

test('AssistantsService deterministically keeps one canonical default assistant first when duplicates exist for the same knowledge base', async () => {
  const scope = {
    tenantId: 'tenant-auth',
    userId: 'user-auth'
  };

  const fakeService = Object.assign(
    Object.create(AssistantsService.prototype),
    {
      prisma: {
        assistant: {
          findMany: async () => [
            {
              id: 'assistant-default-z',
              tenantId: 'tenant-auth',
              kbId: 'kb-1',
              name: 'Default Assistant',
              description: null,
              systemPrompt: 'duplicate default',
              retrievalProfileId: 'profile-1',
              answerPolicyJson: null,
              status: 'active'
            },
            {
              id: 'assistant-default-a',
              tenantId: 'tenant-auth',
              kbId: 'kb-1',
              name: 'Default Assistant',
              description: null,
              systemPrompt: 'canonical default',
              retrievalProfileId: 'profile-1',
              answerPolicyJson: null,
              status: 'active'
            }
          ]
        }
      }
    }
  );

  const assistants = await AssistantsService.prototype.listAssistants.call(
    fakeService,
    scope
  );

  assert.equal(assistants[0]?.id, 'assistant-default-a');
  assert.equal(assistants[1]?.id, 'assistant-default-z');
});

test('AssistantsService prefers the default assistant bound to the primary knowledge base when multiple default assistants exist', async () => {
  const scope = {
    tenantId: 'tenant-auth',
    userId: 'user-auth'
  };

  const fakeService = Object.assign(
    Object.create(AssistantsService.prototype),
    {
      prisma: {
        assistant: {
          findMany: async () => [
            {
              id: 'assistant-default-secondary-kb',
              tenantId: 'tenant-auth',
              kbId: 'kb-secondary',
              name: 'Default Assistant',
              description: null,
              systemPrompt: 'secondary kb default',
              retrievalProfileId: 'profile-2',
              answerPolicyJson: null,
              status: 'active',
              knowledgeBase: {
                name: 'Secondary Knowledge Base'
              }
            },
            {
              id: 'assistant-default-primary-kb',
              tenantId: 'tenant-auth',
              kbId: 'kb-primary',
              name: 'Default Assistant',
              description: null,
              systemPrompt: 'primary kb default',
              retrievalProfileId: 'profile-1',
              answerPolicyJson: null,
              status: 'active',
              knowledgeBase: {
                name: 'Default Knowledge Base'
              }
            }
          ]
        }
      }
    }
  );

  const assistants = await AssistantsService.prototype.listAssistants.call(
    fakeService,
    scope
  );

  assert.equal(assistants[0]?.id, 'assistant-default-primary-kb');
  assert.equal(assistants[1]?.id, 'assistant-default-secondary-kb');
  assert.equal(assistants[0]?.knowledgeBase, undefined);
});

test('AssistantsService prefers an active canonical default assistant over an inactive duplicate on the same primary knowledge base', async () => {
  const scope = {
    tenantId: 'tenant-auth',
    userId: 'user-auth'
  };

  const fakeService = Object.assign(
    Object.create(AssistantsService.prototype),
    {
      prisma: {
        assistant: {
          findMany: async () => [
            {
              id: 'assistant-default-a',
              tenantId: 'tenant-auth',
              kbId: 'kb-primary',
              name: 'Default Assistant',
              description: null,
              systemPrompt: 'inactive duplicate',
              retrievalProfileId: 'profile-1',
              answerPolicyJson: null,
              status: 'inactive',
              knowledgeBase: {
                name: 'Default Knowledge Base'
              }
            },
            {
              id: 'assistant-default-z',
              tenantId: 'tenant-auth',
              kbId: 'kb-primary',
              name: 'Default Assistant',
              description: null,
              systemPrompt: 'active canonical default',
              retrievalProfileId: 'profile-1',
              answerPolicyJson: null,
              status: 'active',
              knowledgeBase: {
                name: 'Default Knowledge Base'
              }
            }
          ]
        }
      }
    }
  );

  const assistants = await AssistantsService.prototype.listAssistants.call(
    fakeService,
    scope
  );

  assert.equal(assistants[0]?.id, 'assistant-default-z');
  assert.equal(assistants[1]?.id, 'assistant-default-a');
});

test('AssistantsService treats canonical default assistant naming drift as default in list priority', async () => {
  const scope = {
    tenantId: 'tenant-auth',
    userId: 'user-auth'
  };

  const fakeService = Object.assign(
    Object.create(AssistantsService.prototype),
    {
      prisma: {
        assistant: {
          findMany: async () => [
            {
              id: 'assistant-secondary',
              tenantId: 'tenant-auth',
              kbId: 'kb-primary',
              name: 'Research Assistant',
              description: null,
              systemPrompt: 'secondary',
              retrievalProfileId: 'profile-1',
              answerPolicyJson: null,
              status: 'active',
              knowledgeBase: {
                name: 'Default Knowledge Base'
              }
            },
            {
              id: 'assistant-default-name-drift',
              tenantId: 'tenant-auth',
              kbId: 'kb-primary',
              name: ' default assistant ',
              description: null,
              systemPrompt: 'default with name drift',
              retrievalProfileId: 'profile-1',
              answerPolicyJson: null,
              status: 'inactive',
              knowledgeBase: {
                name: ' default knowledge base '
              }
            }
          ]
        }
      }
    }
  );

  const assistants = await AssistantsService.prototype.listAssistants.call(
    fakeService,
    scope
  );

  assert.equal(assistants[0]?.id, 'assistant-default-name-drift');
  assert.equal(assistants[1]?.id, 'assistant-secondary');
});

test('AssistantsService treats canonical default assistant and primary knowledge base internal-whitespace drift as default in list priority', async () => {
  const scope = {
    tenantId: 'tenant-auth',
    userId: 'user-auth'
  };

  const fakeService = Object.assign(
    Object.create(AssistantsService.prototype),
    {
      prisma: {
        assistant: {
          findMany: async () => [
            {
              id: 'assistant-secondary',
              tenantId: 'tenant-auth',
              kbId: 'kb-primary',
              name: 'Research Assistant',
              description: null,
              systemPrompt: 'secondary',
              retrievalProfileId: 'profile-1',
              answerPolicyJson: null,
              status: 'active',
              knowledgeBase: {
                name: 'Default Knowledge Base'
              }
            },
            {
              id: 'assistant-default-name-internal-whitespace-drift',
              tenantId: 'tenant-auth',
              kbId: 'kb-primary',
              name: 'Default   Assistant',
              description: null,
              systemPrompt: 'default with internal whitespace drift',
              retrievalProfileId: 'profile-1',
              answerPolicyJson: null,
              status: 'inactive',
              knowledgeBase: {
                name: 'Default   Knowledge    Base'
              }
            }
          ]
        }
      }
    }
  );

  const assistants = await AssistantsService.prototype.listAssistants.call(
    fakeService,
    scope
  );

  assert.equal(
    assistants[0]?.id,
    'assistant-default-name-internal-whitespace-drift'
  );
  assert.equal(assistants[1]?.id, 'assistant-secondary');
});
