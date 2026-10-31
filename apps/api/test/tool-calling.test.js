import assert from 'node:assert/strict';
import { test } from 'vitest';

import {
  normalizeToolArguments,
  parseOllamaToolMessage,
  parseOpenAiToolMessage,
  toOllamaMessages,
  toOpenAiMessages,
  toOpenAiTools
} from '../src/infra/llm/tool-calling.ts';

test('parseOpenAiToolMessage reads string arguments', () => {
  const parsed = parseOpenAiToolMessage({
    content: 'Let me look that up.',
    tool_calls: [
      {
        id: 'call_abc',
        type: 'function',
        function: { name: 'rag_search', arguments: '{"query":"retention"}' }
      }
    ]
  });

  assert.equal(parsed.content, 'Let me look that up.');
  assert.deepEqual(parsed.toolCalls, [
    { id: 'call_abc', name: 'rag_search', argumentsJson: '{"query":"retention"}' }
  ]);
});

test('parseOllamaToolMessage normalizes object arguments to JSON', () => {
  const parsed = parseOllamaToolMessage({
    content: '',
    tool_calls: [
      { function: { name: 'rag_search', arguments: { query: 'retention' } } }
    ]
  });

  assert.equal(parsed.content, null);
  assert.equal(parsed.toolCalls.length, 1);
  assert.equal(parsed.toolCalls[0].name, 'rag_search');
  assert.deepEqual(JSON.parse(parsed.toolCalls[0].argumentsJson), {
    query: 'retention'
  });
  assert.equal(parsed.toolCalls[0].id, 'call_0');
});

test('parseOpenAiToolMessage drops entries without a function name', () => {
  const parsed = parseOpenAiToolMessage({
    content: null,
    tool_calls: [{ id: 'call_1', function: {} }, { id: 'call_2', function: undefined }]
  });

  assert.deepEqual(parsed.toolCalls, []);
});

test('parseOpenAiToolMessage treats a missing tool_calls field as no calls', () => {
  const parsed = parseOpenAiToolMessage({ content: 'plain answer' });

  assert.equal(parsed.content, 'plain answer');
  assert.deepEqual(parsed.toolCalls, []);
});

test('normalizeToolArguments handles strings, objects and junk', () => {
  assert.equal(normalizeToolArguments('{"a":1}'), '{"a":1}');
  assert.equal(normalizeToolArguments('   '), '{}');
  assert.equal(normalizeToolArguments({ a: 1 }), '{"a":1}');
  assert.equal(normalizeToolArguments(null), '{}');
  assert.equal(normalizeToolArguments(42), '{}');
});

test('toOpenAiMessages maps tool results with tool_call_id', () => {
  const messages = toOpenAiMessages([
    { role: 'system', content: 'sys' },
    { role: 'user', content: 'q' },
    {
      role: 'assistant',
      content: null,
      toolCalls: [{ id: 'call_1', name: 'rag_search', argumentsJson: '{"query":"x"}' }]
    },
    { role: 'tool', toolCallId: 'call_1', name: 'rag_search', content: 'result' }
  ]);

  assert.equal(messages[3].role, 'tool');
  assert.equal(messages[3].tool_call_id, 'call_1');
  assert.equal(messages[2].tool_calls[0].id, 'call_1');
  assert.equal(messages[2].tool_calls[0].function.arguments, '{"query":"x"}');
  assert.equal(messages[2].content, '');
});

test('toOllamaMessages keeps tool results positional and arguments as objects', () => {
  const messages = toOllamaMessages([
    {
      role: 'assistant',
      content: null,
      toolCalls: [{ id: 'call_1', name: 'rag_search', argumentsJson: '{"query":"x"}' }]
    },
    { role: 'tool', toolCallId: 'call_1', name: 'rag_search', content: 'result' }
  ]);

  assert.equal(messages[0].tool_calls[0].function.name, 'rag_search');
  assert.deepEqual(messages[0].tool_calls[0].function.arguments, { query: 'x' });
  assert.equal('tool_call_id' in messages[1], false);
});

test('toOllamaMessages falls back to an empty object for broken arguments', () => {
  const messages = toOllamaMessages([
    {
      role: 'assistant',
      content: null,
      toolCalls: [{ id: 'call_1', name: 'rag_search', argumentsJson: 'not-json' }]
    }
  ]);

  assert.deepEqual(messages[0].tool_calls[0].function.arguments, {});
});

test('toOpenAiTools emits function definitions with JSON Schema parameters', () => {
  const tools = toOpenAiTools([
    {
      name: 'rag_search',
      description: 'search the knowledge base',
      parameters: {
        type: 'object',
        properties: { query: { type: 'string' } },
        required: ['query']
      }
    }
  ]);

  assert.equal(tools[0].type, 'function');
  assert.equal(tools[0].function.name, 'rag_search');
  assert.deepEqual(tools[0].function.parameters.required, ['query']);
});
