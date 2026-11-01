import assert from 'node:assert/strict';
import { test } from 'vitest';

import { AskQuotaService } from '../src/modules/assistants/ask-quota.ts';

const scope = { tenantId: 'tenant-1', userId: 'user-1' };

test('AskQuotaService enforces a per-user per-minute ask limit', () => {
  const quota = new AskQuotaService({
    perMinuteLimit: 2,
    dailyTokenBudget: 0,
    dailyCostBudgetUsd: 0,
    inputCostPerMillion: 0,
    outputCostPerMillion: 0
  });

  assert.doesNotThrow(() => quota.assertAllowed(scope, 1_000));
  assert.doesNotThrow(() => quota.assertAllowed(scope, 2_000));
  assert.throws(
    () => quota.assertAllowed(scope, 3_000),
    (error) => {
      assert.equal(error.getStatus(), 429);
      assert.equal(error.getResponse().code, 'ASK_RATE_LIMIT_EXCEEDED');
      return true;
    }
  );
});

test('AskQuotaService scopes the ask limit per user', () => {
  const quota = new AskQuotaService({
    perMinuteLimit: 1,
    dailyTokenBudget: 0,
    dailyCostBudgetUsd: 0,
    inputCostPerMillion: 0,
    outputCostPerMillion: 0
  });

  assert.doesNotThrow(() => quota.assertAllowed(scope, 1_000));
  assert.doesNotThrow(() =>
    quota.assertAllowed({ tenantId: 'tenant-1', userId: 'user-2' }, 1_000)
  );
  assert.throws(() => quota.assertAllowed(scope, 1_100), /Ask quota exceeded/);
});

test('AskQuotaService blocks asks after the daily token budget is exhausted', () => {
  const quota = new AskQuotaService({
    perMinuteLimit: 10,
    dailyTokenBudget: 100,
    dailyCostBudgetUsd: 0,
    inputCostPerMillion: 0,
    outputCostPerMillion: 0
  });
  const now = Date.UTC(2026, 10, 1, 12);
  quota.recordUsage(scope, { promptTokens: 60, completionTokens: 50 }, now);

  assert.throws(
    () => quota.assertAllowed(scope, now + 1_000),
    (error) => {
      assert.equal(error.getStatus(), 429);
      assert.equal(error.getResponse().code, 'ASK_TOKEN_BUDGET_EXCEEDED');
      return true;
    }
  );
});

test('AskQuotaService estimates cost from token prices', () => {
  const quota = new AskQuotaService({
    perMinuteLimit: 10,
    dailyTokenBudget: 0,
    dailyCostBudgetUsd: 0.01,
    inputCostPerMillion: 1_000,
    outputCostPerMillion: 2_000
  });
  const now = Date.UTC(2026, 10, 1, 12);
  quota.recordUsage(scope, { promptTokens: 6, completionTokens: 4 }, now);

  assert.throws(
    () => quota.assertAllowed(scope, now + 1_000),
    (error) => {
      assert.equal(error.getStatus(), 429);
      assert.equal(error.getResponse().code, 'ASK_COST_BUDGET_EXCEEDED');
      return true;
    }
  );
});
