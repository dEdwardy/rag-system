const assert = require('node:assert/strict');
const { test } = require('node:test');

const { AuthService } = require('../src/modules/auth/auth.service.ts');
const {
  DocumentsService
} = require('../src/modules/documents/documents.service.ts');
const {
  KnowledgeBasesController
} = require('../src/modules/knowledge-bases/knowledge-bases.controller.ts');
const {
  KnowledgeBasesService
} = require('../src/modules/knowledge-bases/knowledge-bases.service.ts');

function createTransactionalPrismaMock(prisma) {
  return {
    ...prisma,
    async $transaction(callback) {
      return callback(this);
    }
  };
}

test('KnowledgeBasesController derives create identity from request auth context', async () => {
  const calls = [];
  const controller = new KnowledgeBasesController({
    createKnowledgeBase: async (input, identity) => {
      calls.push({ input, identity });
      return { id: 'kb-1' };
    }
  });

  await controller.createKnowledgeBase(
    {
      name: 'KB from auth',
      description: 'desc'
    },
    {
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
    }
  );

  assert.deepEqual(calls, [
    {
      input: {
        name: 'KB from auth',
        description: 'desc'
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

test('KnowledgeBasesController scopes read and update calls by request identity', async () => {
  const calls = [];
  const controller = new KnowledgeBasesController({
    listKnowledgeBases: async (identity) => {
      calls.push({ type: 'list', identity });
      return [];
    },
    getKnowledgeBase: async (id, identity) => {
      calls.push({ type: 'get', id, identity });
      return { id };
    },
    updateKnowledgeBase: async (id, input, identity) => {
      calls.push({ type: 'update', id, input, identity });
      return { id, ...input };
    }
  });

  const request = {
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

  await controller.listKnowledgeBases(request);
  await controller.getKnowledgeBase('kb-1', request);
  await controller.updateKnowledgeBase(
    'kb-1',
    { name: 'Updated name' },
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
      id: 'kb-1',
      identity: {
        userId: 'user-auth',
        tenantId: 'tenant-auth',
        sessionId: 'session-1',
        authSource: 'session'
      }
    },
    {
      type: 'update',
      id: 'kb-1',
      input: {
        name: 'Updated name'
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

test('KnowledgeBasesService writes tenantId and ownerId from current identity', async () => {
  const calls = {
    ensureTenant: [],
    ensureOwner: [],
    create: []
  };

  const service = new KnowledgeBasesService({
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
    knowledgeBase: {
      create: async (args) => {
        calls.create.push(args);
        return { id: 'kb-1', ...args.data };
      }
    }
  });

  await service.createKnowledgeBase(
    {
      name: 'Auth scoped KB',
      description: 'desc'
    },
    {
      tenantId: 'tenant-auth',
      userId: 'user-auth'
    }
  );

  assert.deepEqual(calls.ensureTenant, [{ id: 'tenant-auth' }]);
  assert.deepEqual(calls.ensureOwner, [{ id: 'user-auth' }]);
  assert.deepEqual(calls.create, [
    {
      data: {
        name: 'Auth scoped KB',
        description: 'desc',
        tenantId: 'tenant-auth',
        ownerId: 'user-auth'
      }
    }
  ]);
});

test('KnowledgeBasesService scopes list and get queries by owner identity', async () => {
  const calls = {
    list: [],
    get: []
  };

  const service = new KnowledgeBasesService({
    knowledgeBase: {
      findMany: async (args) => {
        calls.list.push(args);
        return [];
      },
      findUnique: async (args) => {
        calls.get.push(args);
        return {
          id: 'kb-1',
          tenantId: 'tenant-auth',
          ownerId: 'user-auth'
        };
      }
    }
  });

  await service.listKnowledgeBases({
    tenantId: 'tenant-auth',
    userId: 'user-auth'
  });
  await service.getKnowledgeBase('kb-1', {
    tenantId: 'tenant-auth',
    userId: 'user-auth'
  });

  assert.deepEqual(calls.list, [
    {
      select: {
        id: true,
        tenantId: true,
        ownerId: true,
        name: true,
        description: true,
        status: true,
        createdAt: true,
        updatedAt: true
      },
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
        id: 'kb-1'
      },
      select: {
        id: true,
        tenantId: true,
        ownerId: true,
        name: true,
        description: true,
        status: true,
        createdAt: true,
        updatedAt: true
      }
    }
  ]);
});

test('KnowledgeBasesService prefers the canonical active default knowledge base first in scoped lists', async () => {
  const service = new KnowledgeBasesService({
    knowledgeBase: {
      findMany: async () => [
        {
          id: 'kb-z-secondary',
          tenantId: 'tenant-auth',
          ownerId: 'user-auth',
          name: 'Secondary Knowledge Base',
          description: 'secondary',
          status: 'active',
          createdAt: new Date('2026-04-18T10:00:00.000Z'),
          updatedAt: new Date('2026-04-18T10:00:00.000Z')
        },
        {
          id: 'kb-z-empty-default',
          tenantId: 'tenant-auth',
          ownerId: 'user-auth',
          name: 'Default Knowledge Base',
          description: 'empty',
          status: 'inactive',
          createdAt: new Date('2026-04-18T11:00:00.000Z'),
          updatedAt: new Date('2026-04-18T11:00:00.000Z')
        },
        {
          id: 'kb-a-filled-default',
          tenantId: 'tenant-auth',
          ownerId: 'user-auth',
          name: ' default knowledge base ',
          description: 'filled',
          status: 'active',
          createdAt: new Date('2026-04-18T09:00:00.000Z'),
          updatedAt: new Date('2026-04-18T09:00:00.000Z')
        }
      ]
    }
  });

  const result = await service.listKnowledgeBases({
    tenantId: 'tenant-auth',
    userId: 'user-auth'
  });

  assert.deepEqual(
    result.map((knowledgeBase) => knowledgeBase.id),
    ['kb-a-filled-default', 'kb-z-empty-default', 'kb-z-secondary']
  );
});

test('AuthService default assistant repair keeps the canonical default knowledge base and ignores blank assistant records on the main path', async () => {
  const calls = {
    assistantFindManyWhere: [],
    assistantUpdate: null,
    knowledgeBaseFindManyWhere: null
  };

  const authService = new AuthService(
    createTransactionalPrismaMock({
      authIdentityLink: {
        findUnique: async () => null,
        create: async () => ({ id: 'link-oauth-empty-default-1' })
      },
      user: {
        findUnique: async () => null,
        create: async () => ({
          id: 'user-oauth-empty-default-1',
          tenantId: 'default-tenant',
          role: 'owner',
          status: 'active'
        })
      },
      tenant: {
        findUnique: async () => ({ id: 'default-tenant' })
      },
      knowledgeBase: {
        findMany: async ({ where }) => {
          calls.knowledgeBaseFindManyWhere = where;
          return [
            {
              id: 'kb-empty-active-1',
              name: '',
              status: 'active'
            },
            {
              id: 'kb-canonical-default-1',
              name: ' Default Knowledge Base ',
              status: 'inactive'
            }
          ];
        },
        findFirst: async () => {
          throw new Error('knowledge base should use canonical findMany path');
        },
        create: async () => {
          throw new Error('knowledge base should not be created');
        }
      },
      retrievalProfile: {
        findMany: async () => [
          {
            id: 'rp-canonical-default-1',
            name: 'Default Retrieval Profile'
          }
        ],
        findFirst: async () => {
          throw new Error(
            'retrieval profile should use canonical findMany path'
          );
        },
        create: async () => {
          throw new Error('retrieval profile should not be created');
        }
      },
      assistant: {
        findMany: async ({ where }) => {
          calls.assistantFindManyWhere.push(where);

          if (where?.kbId === 'kb-canonical-default-1') {
            return [
              {
                id: 'assistant-blank-primary-1',
                kbId: 'kb-canonical-default-1',
                retrievalProfileId: 'rp-canonical-default-1',
                status: 'active',
                name: '   '
              }
            ];
          }

          return [
            {
              id: 'assistant-blank-primary-1',
              kbId: 'kb-canonical-default-1',
              retrievalProfileId: 'rp-canonical-default-1',
              status: 'active',
              name: '   '
            },
            {
              id: 'assistant-owner-default-1',
              kbId: 'kb-empty-active-1',
              retrievalProfileId: 'rp-stale-owner-1',
              status: 'inactive',
              name: ' Default Assistant '
            }
          ];
        },
        create: async () => {
          throw new Error(
            'assistant should not be created when default repair is possible'
          );
        },
        update: async ({ where, data }) => {
          calls.assistantUpdate = { where, data };
          return { id: 'assistant-owner-default-1' };
        }
      }
    }),
    {
      exchangeCodeForIdentity: async () => ({
        subject: 'github-subject-empty-default-1',
        email: 'oauth-empty-default@example.com',
        profileSnapshot: {
          id: 8101,
          login: 'oauth-empty-default-user',
          name: 'OAuth Empty Default User'
        }
      })
    }
  );

  const result = await authService.completeOauthProviderCallback({
    provider: 'github',
    code: 'github-code-empty-default-1',
    state: 'state-oauth-empty-default-1',
    expectedState: 'state-oauth-empty-default-1'
  });

  assert.equal(result.identity.userId, 'user-oauth-empty-default-1');
  assert.deepEqual(calls.knowledgeBaseFindManyWhere, {
    tenantId: 'default-tenant',
    ownerId: 'user-oauth-empty-default-1'
  });
  assert.deepEqual(calls.assistantFindManyWhere, [
    {
      tenantId: 'default-tenant',
      kbId: 'kb-canonical-default-1'
    },
    {
      tenantId: 'default-tenant',
      knowledgeBase: {
        ownerId: 'user-oauth-empty-default-1'
      }
    }
  ]);
  assert.deepEqual(calls.assistantUpdate, {
    where: {
      id: 'assistant-owner-default-1'
    },
    data: {
      kbId: 'kb-canonical-default-1',
      retrievalProfileId: 'rp-canonical-default-1',
      status: 'active'
    }
  });
});

test('AuthService default workspace bootstrap creates the default assistant on the canonical default knowledge base and retrieval profile when duplicates exist', async () => {
  const calls = {
    knowledgeBaseCreate: [],
    retrievalProfileCreate: [],
    assistantCreate: [],
    assistantUpdate: []
  };

  const authService = new AuthService(
    createTransactionalPrismaMock({
      authIdentityLink: {
        findUnique: async () => null,
        create: async () => ({ id: 'link-oauth-bootstrap-dupes-1' })
      },
      user: {
        findUnique: async () => null,
        create: async () => ({
          id: 'user-oauth-bootstrap-dupes-1',
          tenantId: 'default-tenant',
          role: 'owner',
          status: 'active'
        })
      },
      tenant: {
        findUnique: async () => ({ id: 'default-tenant' })
      },
      knowledgeBase: {
        findMany: async () => [
          {
            id: 'kb-blank-active-2',
            name: '   ',
            status: 'active'
          },
          {
            id: 'kb-canonical-active-2',
            name: ' Default Knowledge Base ',
            status: 'active'
          },
          {
            id: 'kb-canonical-inactive-2',
            name: 'Default Knowledge Base',
            status: 'inactive'
          }
        ],
        findFirst: async () => {
          throw new Error('knowledge base should use canonical findMany path');
        },
        create: async (args) => {
          calls.knowledgeBaseCreate.push(args);
          return { id: 'unexpected-kb-create' };
        }
      },
      retrievalProfile: {
        findMany: async () => [
          {
            id: 'rp-non-default-2',
            name: 'Custom Retrieval Profile'
          },
          {
            id: 'rp-canonical-default-2',
            name: ' Default Retrieval Profile '
          }
        ],
        findFirst: async () => {
          throw new Error(
            'retrieval profile should use canonical findMany path'
          );
        },
        create: async (args) => {
          calls.retrievalProfileCreate.push(args);
          return { id: 'unexpected-rp-create' };
        }
      },
      assistant: {
        findMany: async () => [],
        create: async (args) => {
          calls.assistantCreate.push(args);
          return { id: 'assistant-bootstrap-dupes-1' };
        },
        update: async (args) => {
          calls.assistantUpdate.push(args);
          return { id: 'unexpected-assistant-update' };
        }
      }
    }),
    {
      exchangeCodeForIdentity: async () => ({
        subject: 'github-subject-bootstrap-dupes-1',
        email: 'oauth-bootstrap-dupes@example.com',
        profileSnapshot: {
          id: 8102,
          login: 'oauth-bootstrap-dupes-user',
          name: 'OAuth Bootstrap Dupes User'
        }
      })
    }
  );

  const result = await authService.completeOauthProviderCallback({
    provider: 'github',
    code: 'github-code-bootstrap-dupes-1',
    state: 'state-oauth-bootstrap-dupes-1',
    expectedState: 'state-oauth-bootstrap-dupes-1'
  });

  assert.equal(result.identity.userId, 'user-oauth-bootstrap-dupes-1');
  assert.deepEqual(calls.knowledgeBaseCreate, []);
  assert.deepEqual(calls.retrievalProfileCreate, []);
  assert.deepEqual(calls.assistantUpdate, []);
  assert.equal(calls.assistantCreate.length, 1);
  assert.deepEqual(calls.assistantCreate[0].data, {
    tenantId: 'default-tenant',
    kbId: 'kb-canonical-active-2',
    name: 'Default Assistant',
    description: 'Default assistant for the primary knowledge base.',
    systemPrompt:
      'Answer only from the retrieved knowledge base content. If the retrieved sources explicitly contain the answer, answer directly and cite the supporting snippets. Only say the information is insufficient when the retrieved sources still do not support a reliable answer.',
    retrievalProfileId: 'rp-canonical-default-2',
    status: 'active'
  });
});

test('AuthService default assistant repair keeps the canonical active assistant when duplicate default assistant records exist on the primary knowledge base', async () => {
  const calls = {
    assistantUpdate: [],
    assistantCreate: []
  };

  const authService = new AuthService(
    createTransactionalPrismaMock({
      authIdentityLink: {
        findUnique: async () => null,
        create: async () => ({ id: 'link-oauth-duplicate-assistant-1' })
      },
      user: {
        findUnique: async () => null,
        create: async () => ({
          id: 'user-oauth-duplicate-assistant-1',
          tenantId: 'default-tenant',
          role: 'owner',
          status: 'active'
        })
      },
      tenant: {
        findUnique: async () => ({ id: 'default-tenant' })
      },
      knowledgeBase: {
        findMany: async () => [
          {
            id: 'kb-canonical-default-3',
            name: 'Default Knowledge Base',
            status: 'active'
          },
          {
            id: 'kb-secondary-3',
            name: 'Secondary Knowledge Base',
            status: 'active'
          }
        ],
        findFirst: async () => {
          throw new Error('knowledge base should use canonical findMany path');
        },
        create: async () => {
          throw new Error('knowledge base should not be created');
        }
      },
      retrievalProfile: {
        findMany: async () => [
          {
            id: 'rp-canonical-default-3',
            name: 'Default Retrieval Profile'
          }
        ],
        findFirst: async () => {
          throw new Error(
            'retrieval profile should use canonical findMany path'
          );
        },
        create: async () => {
          throw new Error('retrieval profile should not be created');
        }
      },
      assistant: {
        findMany: async ({ where }) => {
          if (where?.kbId === 'kb-canonical-default-3') {
            return [
              {
                id: 'assistant-a-blank-3',
                kbId: 'kb-canonical-default-3',
                retrievalProfileId: 'rp-canonical-default-3',
                status: 'active',
                name: ' '
              },
              {
                id: 'assistant-z-default-inactive-3',
                kbId: 'kb-canonical-default-3',
                retrievalProfileId: 'rp-canonical-default-3',
                status: 'inactive',
                name: 'Default Assistant'
              },
              {
                id: 'assistant-m-default-active-3',
                kbId: 'kb-canonical-default-3',
                retrievalProfileId: 'rp-canonical-default-3',
                status: 'active',
                name: ' Default Assistant '
              }
            ];
          }

          return [
            {
              id: 'assistant-owner-secondary-3',
              kbId: 'kb-secondary-3',
              retrievalProfileId: 'rp-canonical-default-3',
              status: 'active',
              name: 'Default Assistant'
            }
          ];
        },
        create: async (args) => {
          calls.assistantCreate.push(args);
          return { id: 'unexpected-assistant-create' };
        },
        update: async (args) => {
          calls.assistantUpdate.push(args);
          return { id: 'unexpected-assistant-update' };
        }
      }
    }),
    {
      exchangeCodeForIdentity: async () => ({
        subject: 'github-subject-duplicate-assistant-1',
        email: 'oauth-duplicate-assistant@example.com',
        profileSnapshot: {
          id: 8103,
          login: 'oauth-duplicate-assistant-user',
          name: 'OAuth Duplicate Assistant User'
        }
      })
    }
  );

  const result = await authService.completeOauthProviderCallback({
    provider: 'github',
    code: 'github-code-duplicate-assistant-1',
    state: 'state-oauth-duplicate-assistant-1',
    expectedState: 'state-oauth-duplicate-assistant-1'
  });

  assert.equal(result.identity.userId, 'user-oauth-duplicate-assistant-1');
  assert.deepEqual(calls.assistantCreate, []);
  assert.deepEqual(calls.assistantUpdate, []);
});

test('KnowledgeBasesService denies read detail when owner check fails', async () => {
  const service = new KnowledgeBasesService({
    knowledgeBase: {
      findUnique: async () => ({
        id: 'kb-1',
        tenantId: 'tenant-auth',
        ownerId: 'user-other'
      })
    }
  });

  await assert.rejects(
    service.getKnowledgeBase('kb-1', {
      tenantId: 'tenant-auth',
      userId: 'user-auth'
    }),
    /Access blocked by owner_only_v1 policy \(owner_mismatch: resource owner does not match current user\)\./
  );
});

test('KnowledgeBasesService denies write update when owner check fails', async () => {
  const calls = {
    update: []
  };
  const service = new KnowledgeBasesService({
    knowledgeBase: {
      findUnique: async () => ({
        id: 'kb-1',
        tenantId: 'tenant-auth',
        ownerId: 'user-other'
      }),
      update: async (args) => {
        calls.update.push(args);
        return { id: 'kb-1' };
      }
    }
  });

  await assert.rejects(
    service.updateKnowledgeBase(
      'kb-1',
      { name: 'should-not-update' },
      { tenantId: 'tenant-auth', userId: 'user-auth' }
    ),
    /Access blocked by owner_only_v1 policy \(owner_mismatch: resource owner does not match current user\)\./
  );
  assert.deepEqual(calls.update, []);
});

test('DocumentsService verifies document read access through knowledge-base owner check', async () => {
  const calls = {
    documentGet: [],
    knowledgeBaseGet: []
  };

  const service = new DocumentsService(
    {
      document: {
        findUnique: async (args) => {
          calls.documentGet.push(args);
          return {
            id: 'doc-1',
            kbId: 'kb-1'
          };
        }
      }
    },
    {
      getKnowledgeBase: async (id, scope) => {
        calls.knowledgeBaseGet.push({ id, scope });
        return { id };
      }
    },
    {},
    {},
    {},
    {},
    {},
    {},
    {}
  );

  await service.getDocument('doc-1', {
    tenantId: 'tenant-auth',
    userId: 'user-auth'
  });

  assert.deepEqual(calls.documentGet, [
    {
      where: { id: 'doc-1' },
      select: {
        id: true,
        kbId: true,
        title: true,
        sourceType: true,
        sourceName: true,
        mimeType: true,
        storageKey: true,
        status: true,
        processingStage: true,
        errorMessage: true,
        diagnosticsJson: true,
        sourceConfigJson: true,
        chunkCount: true,
        version: true,
        createdAt: true,
        updatedAt: true
      }
    }
  ]);
  assert.deepEqual(calls.knowledgeBaseGet, [
    {
      id: 'kb-1',
      scope: {
        tenantId: 'tenant-auth',
        userId: 'user-auth'
      }
    }
  ]);
});
