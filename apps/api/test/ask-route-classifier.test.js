import assert from 'node:assert/strict';
import { test } from 'vitest';

import {
  ASK_ROUTE_CLASSIFIER_TIMEOUT_MS,
  parseClassifierOutput,
  resolveAskRouteDecisionWithLlm
} from '../src/modules/assistants/ask-route-classifier.ts';

function completeWith(text) {
  return async () => text;
}

test('resolveAskRouteDecisionWithLlm keeps explicit source URLs on the rule path', async () => {
  let called = false;
  const resolved = await resolveAskRouteDecisionWithLlm({
    question: 'Summarize https://example.com/article for me',
    complete: async () => {
      called = true;
      return '{"routeType":"knowledge_base"}';
    }
  });

  assert.equal(called, false);
  assert.equal(resolved.source, 'rule');
  assert.equal(resolved.decision.routeType, 'external_source');
  assert.equal(resolved.decision.routeReason, 'explicit_source_url');
  assert.equal(resolved.detail, 'rule:explicit_source_url');
});

test('resolveAskRouteDecisionWithLlm keeps policy patterns on the rule path', async () => {
  let called = false;
  const resolved = await resolveAskRouteDecisionWithLlm({
    question: '你的能力边界是什么？',
    complete: async () => {
      called = true;
      return '{"routeType":"knowledge_base"}';
    }
  });

  assert.equal(called, false);
  assert.equal(resolved.source, 'rule');
  assert.equal(resolved.decision.routeType, 'policy_reply');
});

test('resolveAskRouteDecisionWithLlm accepts an LLM policy classification', async () => {
  const resolved = await resolveAskRouteDecisionWithLlm({
    question: 'Who wrote the rules you follow when you answer?',
    complete: completeWith(
      '{"routeType":"policy_reply","rationale":"asks about assistant rules"}'
    )
  });

  assert.equal(resolved.source, 'llm');
  assert.equal(resolved.decision.routeType, 'policy_reply');
  assert.equal(resolved.decision.routeReason, 'policy_question');
  assert.equal(resolved.detail, 'asks about assistant rules');
});

test('resolveAskRouteDecisionWithLlm keeps a knowledge-base classification', async () => {
  const resolved = await resolveAskRouteDecisionWithLlm({
    question: 'What does the deployment guide say about restarts?',
    complete: completeWith('{"routeType":"knowledge_base"}')
  });

  assert.equal(resolved.source, 'llm');
  assert.equal(resolved.decision.routeType, 'knowledge_base');
  assert.equal(resolved.decision.routeReason, 'default_kb_ask');
  assert.equal(resolved.detail, null);
});

test('resolveAskRouteDecisionWithLlm parses JSON wrapped in a markdown fence', async () => {
  const resolved = await resolveAskRouteDecisionWithLlm({
    question: 'Which document covers retention?',
    complete: completeWith('```json\n{"routeType":"knowledge_base"}\n```')
  });

  assert.equal(resolved.source, 'llm');
  assert.equal(resolved.decision.routeType, 'knowledge_base');
});

test('resolveAskRouteDecisionWithLlm rejects an LLM external_source guess', async () => {
  const resolved = await resolveAskRouteDecisionWithLlm({
    question: 'What is on the page the guide refers to?',
    complete: completeWith('{"routeType":"external_source"}')
  });

  assert.equal(resolved.source, 'llm_fallback');
  assert.equal(resolved.detail, 'external_source_requires_explicit_url');
  assert.equal(resolved.decision.routeType, 'knowledge_base');
});

test('resolveAskRouteDecisionWithLlm falls back on unparsable output', async () => {
  const resolved = await resolveAskRouteDecisionWithLlm({
    question: 'How do I export a report?',
    complete: completeWith('I think this is a knowledge base question.')
  });

  assert.equal(resolved.source, 'llm_fallback');
  assert.equal(resolved.detail, 'invalid_output');
  assert.equal(resolved.decision.routeType, 'knowledge_base');
  assert.equal(resolved.decision.routeReason, 'default_kb_ask');
});

test('resolveAskRouteDecisionWithLlm falls back on an unknown route type', async () => {
  const resolved = await resolveAskRouteDecisionWithLlm({
    question: 'How do I export a report?',
    complete: completeWith('{"routeType":"chitchat"}')
  });

  assert.equal(resolved.source, 'llm_fallback');
  assert.equal(resolved.detail, 'invalid_output');
});

test('resolveAskRouteDecisionWithLlm falls back on an empty completion', async () => {
  const resolved = await resolveAskRouteDecisionWithLlm({
    question: 'How do I export a report?',
    complete: completeWith('   ')
  });

  assert.equal(resolved.source, 'llm_fallback');
  assert.equal(resolved.detail, 'empty_completion');
});

test('resolveAskRouteDecisionWithLlm falls back when the model call throws', async () => {
  const resolved = await resolveAskRouteDecisionWithLlm({
    question: 'How do I export a report?',
    complete: async () => {
      throw new Error('upstream 503');
    }
  });

  assert.equal(resolved.source, 'llm_fallback');
  assert.equal(resolved.detail, 'upstream 503');
  assert.equal(resolved.decision.routeType, 'knowledge_base');
});

test('resolveAskRouteDecisionWithLlm bounds the model call with a timeout', async () => {
  const resolved = await resolveAskRouteDecisionWithLlm({
    question: 'How do I export a report?',
    timeoutMs: 5,
    complete: ({ signal }) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new Error('aborted')));
      })
  });

  assert.equal(resolved.source, 'llm_fallback');
  assert.equal(resolved.detail, 'timeout');
});

test('resolveAskRouteDecisionWithLlm stays on rules when no completer is wired', async () => {
  const resolved = await resolveAskRouteDecisionWithLlm({
    question: 'How do I export a report?',
    complete: null
  });

  assert.equal(resolved.source, 'rule');
  assert.equal(resolved.detail, 'classifier_disabled');
  assert.equal(resolved.decision.routeType, 'knowledge_base');
});

test('parseClassifierOutput tolerates surrounding prose', () => {
  const parsed = parseClassifierOutput(
    'Here you go: {"routeType":"policy_reply","rationale":"asks about rules"} done'
  );

  assert.deepEqual(parsed, {
    routeType: 'policy_reply',
    rationale: 'asks about rules'
  });
});

test('parseClassifierOutput rejects non-object payloads', () => {
  assert.equal(parseClassifierOutput('knowledge_base'), null);
  assert.equal(parseClassifierOutput('{"routeType":42}'), null);
  assert.equal(parseClassifierOutput('{'), null);
});

test('classifier timeout default is small enough for an inline route decision', () => {
  assert.ok(ASK_ROUTE_CLASSIFIER_TIMEOUT_MS <= 3000);
});
