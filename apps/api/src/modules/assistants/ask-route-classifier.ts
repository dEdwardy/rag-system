import { Injectable } from '@nestjs/common';
import type { TraceRouteReason, TraceRouteType } from '@rag-system/shared';
import { LlmService } from '../../infra/llm/llm.service';
import {
  resolveAskRouteDecision,
  type AskRouteDecision
} from './ask-route-decision';

/**
 * Where the final route decision came from. Kept separate from
 * `TraceRouteType` / `TraceRouteReason` so the shared trace contract and the
 * report UI do not need new enum members for what is purely a diagnostics
 * concern.
 */
export type AskRouteDecisionSource = 'rule' | 'llm' | 'llm_fallback';

export type ResolvedAskRouteDecision = {
  decision: AskRouteDecision;
  source: AskRouteDecisionSource;
  detail: string | null;
};

export type RouteClassifierCompletionInput = {
  systemPrompt: string;
  userPrompt: string;
  signal?: AbortSignal;
};

export type RouteClassifierCompletion = (
  input: RouteClassifierCompletionInput
) => Promise<string>;

export const ASK_ROUTE_CLASSIFIER_PROMPT_ID = 'route-classifier.v1';

export const ASK_ROUTE_CLASSIFIER_TIMEOUT_MS = 2500;

/**
 * The model may only choose between these two. `external_source` is excluded
 * on purpose: that route is only valid when the question carries an explicit
 * source URL, and the URL extraction is deterministic. A model guess without a
 * URL would produce a route the executor cannot satisfy.
 */
const LLM_CLASSIFIABLE_ROUTE_TYPES = ['knowledge_base', 'policy_reply'] as const;

type LlmClassifiableRouteType = (typeof LLM_CLASSIFIABLE_ROUTE_TYPES)[number];

const CLASSIFIER_SYSTEM_PROMPT = `You classify a user question for a retrieval-augmented answering system.
Reply with a single JSON object and nothing else:
{"routeType":"knowledge_base"|"policy_reply","rationale":"<max 120 chars>"}

Choose "policy_reply" only when the question asks about the assistant itself,
its rules, its citation/refusal behaviour, or what it can and cannot do.
Choose "knowledge_base" for every question that expects an answer from stored
documents. When unsure, choose "knowledge_base".`;

export async function resolveAskRouteDecisionWithLlm(input: {
  question: string;
  complete: RouteClassifierCompletion | null;
  timeoutMs?: number;
}): Promise<ResolvedAskRouteDecision> {
  const ruleDecision = resolveAskRouteDecision(input.question);

  // Deterministic winners stay deterministic. An explicit source URL is a fact
  // the model cannot infer, and a matched policy pattern is cheaper to detect
  // than to classify, so neither is worth a model round-trip.
  if (ruleDecision.routeType !== 'knowledge_base') {
    return {
      decision: ruleDecision,
      source: 'rule',
      detail: `rule:${ruleDecision.routeReason}`
    };
  }

  if (input.complete == null) {
    return {
      decision: ruleDecision,
      source: 'rule',
      detail: 'classifier_disabled'
    };
  }

  const timeoutMs = input.timeoutMs ?? ASK_ROUTE_CLASSIFIER_TIMEOUT_MS;
  const abortController = new AbortController();
  const timer = setTimeout(() => abortController.abort(), timeoutMs);

  try {
    const raw = await input.complete({
      systemPrompt: CLASSIFIER_SYSTEM_PROMPT,
      userPrompt: input.question,
      signal: abortController.signal
    });

    if (raw.trim().length === 0) {
      return {
        decision: ruleDecision,
        source: 'llm_fallback',
        detail: 'empty_completion'
      };
    }

    const parsed = parseClassifierOutput(raw);
    if (parsed == null) {
      return {
        decision: ruleDecision,
        source: 'llm_fallback',
        detail: 'invalid_output'
      };
    }

    if (parsed.routeType === 'external_source') {
      return {
        decision: ruleDecision,
        source: 'llm_fallback',
        detail: 'external_source_requires_explicit_url'
      };
    }

    return {
      decision: toRouteDecision(parsed.routeType),
      source: 'llm',
      detail: parsed.rationale
    };
  } catch (error) {
    return {
      decision: ruleDecision,
      source: 'llm_fallback',
      detail: abortController.signal.aborted
        ? 'timeout'
        : error instanceof Error
          ? error.message.slice(0, 160)
          : 'unknown_error'
    };
  } finally {
    clearTimeout(timer);
  }
}

export function parseClassifierOutput(raw: string): {
  routeType: TraceRouteType;
  rationale: string | null;
} | null {
  const jsonText = extractFirstJsonObject(raw);
  if (jsonText == null) {
    return null;
  }

  let payload: unknown;
  try {
    payload = JSON.parse(jsonText);
  } catch {
    return null;
  }

  if (typeof payload !== 'object' || payload == null) {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const routeType = record.routeType;
  if (typeof routeType !== 'string') {
    return null;
  }

  const normalized = routeType.trim().toLowerCase();
  if (normalized !== 'knowledge_base' && normalized !== 'policy_reply' && normalized !== 'external_source') {
    return null;
  }

  const rationale =
    typeof record.rationale === 'string' && record.rationale.trim().length > 0
      ? record.rationale.trim().slice(0, 160)
      : null;

  return {
    routeType: normalized as TraceRouteType,
    rationale
  };
}

function toRouteDecision(routeType: LlmClassifiableRouteType): AskRouteDecision {
  const routeReason: TraceRouteReason =
    routeType === 'policy_reply' ? 'policy_question' : 'default_kb_ask';

  return { routeType, routeReason };
}

function extractFirstJsonObject(raw: string): string | null {
  const trimmed = raw.trim();
  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  const start = withoutFence.indexOf('{');
  if (start === -1) {
    return null;
  }

  const end = withoutFence.lastIndexOf('}');
  if (end <= start) {
    return null;
  }

  return withoutFence.slice(start, end + 1);
}

@Injectable()
export class AskRouteClassifier {
  constructor(private readonly llmService: LlmService) {}

  async classify(question: string): Promise<ResolvedAskRouteDecision> {
    return resolveAskRouteDecisionWithLlm({
      question,
      complete: async ({ systemPrompt, userPrompt, signal }) =>
        this.llmService.generateRawCompletion({
          prompt: {
            systemPrompt,
            userPrompt,
            fullPrompt: `${systemPrompt}\n\nQuestion: ${userPrompt}`
          },
          signal
        })
    });
  }
}
