import type { ConversationHistoryMessage } from '../../infra/llm/llm.types';
import { shouldAttemptAgentSecondPass } from './conversation-history';

export async function resolveAgentSecondPassQuery(input: {
  question: string;
  history: ConversationHistoryMessage[];
  primary?: {
    chunks: Array<{ score: number }>;
    contextGroups: unknown[];
  } | null;
  rewrite: (input: {
    question: string;
    history: ConversationHistoryMessage[];
  }) => Promise<{ rewrittenQuery: string | null }>;
}): Promise<string | null> {
  const chunkCount = input.primary?.chunks.length ?? 0;
  const sourceCount = input.primary?.contextGroups.length ?? 0;
  const topScore = input.primary?.chunks[0]?.score ?? null;

  if (
    !shouldAttemptAgentSecondPass({
      question: input.question,
      history: input.history,
      evidence: { chunkCount, sourceCount, topScore }
    })
  ) {
    return null;
  }

  const rewriteResult = await input.rewrite({
    question: input.question,
    history: input.history
  });
  const rewritten = rewriteResult.rewrittenQuery?.trim();
  return rewritten != null && rewritten !== input.question ? rewritten : null;
}
