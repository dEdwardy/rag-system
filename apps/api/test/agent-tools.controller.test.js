const assert = require('node:assert/strict');
const { UnauthorizedException } = require('@nestjs/common');

const {
  AgentToolsController
} = require('../src/modules/agent-tools/agent-tools.controller.ts');

test('AgentToolsController rejects requests with an invalid tool secret', async () => {
  process.env.AGENT_TOOL_GATEWAY_SECRET = 'expected-secret';

  const controller = new AgentToolsController(
    {
      askAssistant: async () => {
        throw new Error('should not be called');
      }
    },
    {
      getTrace: async () => {
        throw new Error('should not be called');
      }
    },
    {
      getDocument: async () => {
        throw new Error('should not be called');
      },
      listDocumentChunks: async () => {
        throw new Error('should not be called');
      }
    }
  );

  await assert.rejects(
    controller.ragSearch({
      secret: 'wrong-secret',
      assistantId: 'assistant-1',
      question: 'what is the answer?'
    }),
    (error) => {
      assert.ok(error instanceof UnauthorizedException);
      return true;
    }
  );
});

test('AgentToolsController forwards valid secrets to the existing ask path', async () => {
  process.env.AGENT_TOOL_GATEWAY_SECRET = 'expected-secret';

  const askCalls = [];
  const controller = new AgentToolsController(
    {
      askAssistant: async (input) => {
        askCalls.push(input);
        return {
          answer: 'tool answer',
          retrievedChunks: [],
          citations: [],
          diagnostics: {},
          confidence: 'high',
          missingInformation: []
        };
      }
    },
    {
      getTrace: async () => ({ id: 'trace-1' })
    },
    {
      getDocument: async () => ({ id: 'doc-1', status: 'ready' }),
      listDocumentChunks: async () => []
    }
  );

  const result = await controller.ragSearch({
    secret: 'expected-secret',
    assistantId: 'assistant-1',
    question: 'what is the answer?',
    tenantId: 'tenant-1',
    userId: 'user-1'
  });

  assert.equal(askCalls.length, 1);
  assert.equal(askCalls[0].assistantId, 'assistant-1');
  assert.equal(askCalls[0].question, 'what is the answer?');
  assert.equal(askCalls[0].authContext.identity.tenantId, 'tenant-1');
  assert.equal(askCalls[0].authContext.identity.userId, 'user-1');
  assert.equal(result.answer, 'tool answer');
});
