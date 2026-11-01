import { HttpException, HttpStatus } from '@nestjs/common';

export type AskQuotaScope = {
  tenantId: string;
  userId: string;
};

type AskQuotaConfig = {
  perMinuteLimit: number;
  dailyTokenBudget: number;
  dailyCostBudgetUsd: number;
  inputCostPerMillion: number;
  outputCostPerMillion: number;
};

type MinuteBucket = {
  windowStartMs: number;
  count: number;
};

type DailyBucket = {
  dayKey: string;
  totalTokens: number;
  estimatedCostUsd: number;
};

export class AskQuotaService {
  private readonly minuteBuckets = new Map<string, MinuteBucket>();
  private readonly dailyBuckets = new Map<string, DailyBucket>();
  private readonly config: AskQuotaConfig;

  constructor(config: AskQuotaConfig = resolveAskQuotaConfig()) {
    this.config = config;
  }

  assertAllowed(scope: AskQuotaScope, now = Date.now()) {
    const key = this.buildKey(scope);
    const dayKey = this.buildDayKey(now);
    const minuteBucket = this.readMinuteBucket(key, now);
    const dailyBucket = this.readDailyBucket(key, dayKey);

    if (minuteBucket.count >= this.config.perMinuteLimit) {
      throw this.buildQuotaError('ASK_RATE_LIMIT_EXCEEDED', {
        limitType: 'asks_per_minute',
        limit: this.config.perMinuteLimit,
        current: minuteBucket.count,
        retryAfterMs: minuteBucket.windowStartMs + 60_000 - now
      });
    }

    if (
      this.config.dailyTokenBudget > 0 &&
      dailyBucket.totalTokens >= this.config.dailyTokenBudget
    ) {
      throw this.buildQuotaError('ASK_TOKEN_BUDGET_EXCEEDED', {
        limitType: 'daily_tokens',
        limit: this.config.dailyTokenBudget,
        current: dailyBucket.totalTokens
      });
    }

    if (
      this.config.dailyCostBudgetUsd > 0 &&
      dailyBucket.estimatedCostUsd >= this.config.dailyCostBudgetUsd
    ) {
      throw this.buildQuotaError('ASK_COST_BUDGET_EXCEEDED', {
        limitType: 'daily_cost_usd',
        limit: this.config.dailyCostBudgetUsd,
        current: Number(dailyBucket.estimatedCostUsd.toFixed(6))
      });
    }

    minuteBucket.count += 1;
  }

  recordUsage(
    scope: AskQuotaScope,
    usage: {
      promptTokens?: number | null;
      completionTokens?: number | null;
      estimatedCostUsd?: number | null;
    } | null,
    now = Date.now()
  ) {
    if (usage == null) {
      return;
    }

    const key = this.buildKey(scope);
    const dailyBucket = this.readDailyBucket(key, this.buildDayKey(now));
    const promptTokens = normalizeTokenCount(usage.promptTokens);
    const completionTokens = normalizeTokenCount(usage.completionTokens);
    const estimatedCostUsd =
      typeof usage.estimatedCostUsd === 'number' &&
      Number.isFinite(usage.estimatedCostUsd)
        ? usage.estimatedCostUsd
        : (promptTokens / 1_000_000) * this.config.inputCostPerMillion +
          (completionTokens / 1_000_000) * this.config.outputCostPerMillion;

    dailyBucket.totalTokens += promptTokens + completionTokens;
    dailyBucket.estimatedCostUsd += estimatedCostUsd;
  }

  private readMinuteBucket(key: string, now: number) {
    const existing = this.minuteBuckets.get(key);
    if (existing != null && now - existing.windowStartMs < 60_000) {
      return existing;
    }

    const next: MinuteBucket = {
      windowStartMs: now,
      count: 0
    };
    this.minuteBuckets.set(key, next);
    this.prune(now);
    return next;
  }

  private readDailyBucket(key: string, dayKey: string) {
    const existing = this.dailyBuckets.get(key);
    if (existing != null && existing.dayKey === dayKey) {
      return existing;
    }

    const next: DailyBucket = {
      dayKey,
      totalTokens: 0,
      estimatedCostUsd: 0
    };
    this.dailyBuckets.set(key, next);
    return next;
  }

  private prune(now: number) {
    if (this.minuteBuckets.size <= 512) {
      return;
    }

    for (const [key, bucket] of this.minuteBuckets.entries()) {
      if (now - bucket.windowStartMs >= 60_000) {
        this.minuteBuckets.delete(key);
      }
    }
  }

  private buildKey(scope: AskQuotaScope) {
    return `${scope.tenantId}:${scope.userId}`;
  }

  private buildDayKey(now: number) {
    return new Date(now).toISOString().slice(0, 10);
  }

  private buildQuotaError(code: string, details: Record<string, unknown>) {
    return new HttpException(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        error: 'Too Many Requests',
        message: 'Ask quota exceeded. Please retry later.',
        code,
        details
      },
      HttpStatus.TOO_MANY_REQUESTS
    );
  }
}

function resolveAskQuotaConfig(
  env: NodeJS.ProcessEnv = process.env
): AskQuotaConfig {
  return {
    perMinuteLimit: readPositiveInteger(env.ASK_RATE_LIMIT_PER_MINUTE, 30),
    dailyTokenBudget: readNonNegativeInteger(
      env.ASK_DAILY_TOKEN_BUDGET,
      200_000
    ),
    dailyCostBudgetUsd: readNonNegativeNumber(env.ASK_DAILY_COST_BUDGET_USD, 5),
    inputCostPerMillion: readNonNegativeNumber(
      env.LLM_INPUT_COST_PER_1M_TOKENS,
      0
    ),
    outputCostPerMillion: readNonNegativeNumber(
      env.LLM_OUTPUT_COST_PER_1M_TOKENS,
      0
    )
  };
}

function normalizeTokenCount(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : 0;
}

function readPositiveInteger(rawValue: string | undefined, fallback: number) {
  const parsed = Number.parseInt(rawValue ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readNonNegativeInteger(
  rawValue: string | undefined,
  fallback: number
) {
  const parsed = Number.parseInt(rawValue ?? '', 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function readNonNegativeNumber(rawValue: string | undefined, fallback: number) {
  const parsed = Number.parseFloat(rawValue ?? '');
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}
