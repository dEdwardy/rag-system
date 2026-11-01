import assert from 'node:assert/strict';
import { test } from 'vitest';

import { resolveAskRouteDecision } from '../src/modules/assistants/ask-route-decision.ts';

const ROUTE_ACCURACY_CASES = [
  {
    question: 'What does the onboarding document say about retries?',
    routeType: 'knowledge_base'
  },
  {
    question: 'How do I summarize the uploaded release notes?',
    routeType: 'knowledge_base'
  },
  {
    question: 'What is the assistant citation policy when sources are missing?',
    routeType: 'policy_reply'
  },
  {
    question: 'What is the assistant refusal policy for missing evidence?',
    routeType: 'policy_reply'
  },
  {
    question: 'Read https://example.com/posts/launch-announcement',
    routeType: 'external_source'
  },
  {
    question: 'Summarize the RSS feed https://example.com/rss.xml',
    routeType: 'external_source'
  },
  {
    question: 'Inspect sitemap https://example.com/sitemap.xml',
    routeType: 'external_source'
  },
  {
    question: 'Check https://example.com/one and https://example.com/two',
    routeType: 'external_source'
  },
  {
    question:
      'Read [the article](https://example.com/posts/x) and summarize it',
    routeType: 'external_source'
  }
];

test('route accuracy eval set stays above the regression threshold', () => {
  const results = ROUTE_ACCURACY_CASES.map((testCase) => {
    const decision = resolveAskRouteDecision(testCase.question);
    return {
      question: testCase.question,
      expected: testCase.routeType,
      actual: decision.routeType,
      passed: decision.routeType === testCase.routeType
    };
  });
  const passed = results.filter((result) => result.passed).length;
  const accuracy = passed / results.length;

  assert.deepEqual(
    results.filter((result) => !result.passed),
    [],
    'route accuracy eval mismatches'
  );
  assert.ok(
    accuracy >= 0.9,
    `route accuracy ${accuracy.toFixed(2)} is below the 0.90 threshold`
  );
});
