import assert from 'node:assert/strict';
import { test } from 'vitest';
import { TracesService } from '../src/modules/traces/traces.service.ts';

function buildTrace(input) {
  return {
    id: input.id,
    modelName: input.modelName ?? 'model-a',
    latencyMs: input.latencyMs ?? 1000,
    status: input.status ?? 'success',
    createdAt: new Date(),
    retrievalMetadataJson: {
      timing: {
        firstTokenMs: input.firstTokenMs,
        totalMs: input.latencyMs ?? 1000
      },
      promptContextApproxTokens: input.approxPromptTokens ?? 100
    },
    answeringMetadataJson:
      input.usage == null
        ? {}
        : {
            llmUsage: input.usage
          }
  };
}

test('TracesService aggregates first-token P95 and LLM usage', async () => {
  const service = new TracesService({
    answerTrace: {
      findMany: async () => [
        buildTrace({
          id: 'trace-1',
          firstTokenMs: 100,
          latencyMs: 1000,
          usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 }
        }),
        buildTrace({
          id: 'trace-2',
          firstTokenMs: 300,
          latencyMs: 2000,
          usage: { promptTokens: 20, completionTokens: 10, totalTokens: 30 }
        }),
        buildTrace({
          id: 'trace-3',
          firstTokenMs: 500,
          latencyMs: 3000,
          usage: { promptTokens: 30, completionTokens: 15, totalTokens: 45 }
        })
      ]
    }
  });

  const summary = await service.getUsageSummary(
    { sinceHours: 24, limit: 100 },
    { tenantId: 'tenant-1', userId: 'user-1' }
  );

  assert.equal(summary.sampledTraceCount, 3);
  assert.equal(summary.latency.firstTokenP50Ms, 300);
  assert.equal(summary.latency.firstTokenP95Ms, 500);
  assert.equal(summary.tokens.promptTokens, 60);
  assert.equal(summary.tokens.completionTokens, 30);
  assert.equal(summary.tokens.totalTokens, 90);
  assert.equal(summary.tokens.promptTokensEstimated, false);
  assert.equal(summary.byModel[0].modelName, 'model-a');
  assert.equal(summary.byModel[0].traceCount, 3);
});

test('TracesService marks prompt token totals as estimated when usage is missing', async () => {
  const service = new TracesService({
    answerTrace: {
      findMany: async () => [
        buildTrace({
          id: 'trace-1',
          firstTokenMs: 120,
          approxPromptTokens: 80
        })
      ]
    }
  });

  const summary = await service.getUsageSummary(
    { sinceHours: 24, limit: 100 },
    { tenantId: 'tenant-1', userId: 'user-1' }
  );

  assert.equal(summary.tokens.promptTokens, 80);
  assert.equal(summary.tokens.promptTokensEstimated, true);
});
