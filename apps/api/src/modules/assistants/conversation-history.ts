import type { ConversationHistoryMessage } from '../../infra/llm/llm.types';

export const DEFAULT_HISTORY_MESSAGE_LIMIT = 6;
export const DEFAULT_HISTORY_CHAR_BUDGET = 2000;
export const DEFAULT_HISTORY_ASSISTANT_CHAR_LIMIT = 800;
export const DEFAULT_HISTORY_USER_CHAR_LIMIT = 400;

const FOLLOW_UP_PATTERNS = [
  /\b(it|this|that|these|those|they|them|their|above|previous|former|latter)\b/i,
  /\b(continue|expand|elaborate|more detail|second one|second point|why|and then)\b/i,
  /它|这个|那个|这些|那些|上述|上面|前面|第二点|继续|展开|详细|为什么|还有|那呢|再具体/
];

const COMPLEX_QUESTION_PATTERNS = [
  /\b(compare|comparison|difference|differences|trade-?off|tradeoffs?|risks?|benefits?|across|versus|vs\.?|how|why)\b/i,
  /对比|比较|区别|差异|优缺点|利弊|风险|影响|跨文档|多个文档|为什么|如何|怎么/
];

export const AGENT_SECOND_PASS_MIN_TOP_SCORE = 0.3;

type MessageLike = {
  role: string;
  content: string;
};

export function buildConversationHistory(
  messages: MessageLike[],
  options: {
    maxMessages?: number;
    maxChars?: number;
    assistantCharLimit?: number;
    userCharLimit?: number;
  } = {}
): ConversationHistoryMessage[] {
  const maxMessages = options.maxMessages ?? DEFAULT_HISTORY_MESSAGE_LIMIT;
  const maxChars = options.maxChars ?? DEFAULT_HISTORY_CHAR_BUDGET;
  const assistantCharLimit =
    options.assistantCharLimit ?? DEFAULT_HISTORY_ASSISTANT_CHAR_LIMIT;
  const userCharLimit =
    options.userCharLimit ?? DEFAULT_HISTORY_USER_CHAR_LIMIT;

  const normalized = messages
    .filter(
      (message): message is ConversationHistoryMessage =>
        (message.role === 'user' || message.role === 'assistant') &&
        typeof message.content === 'string' &&
        message.content.trim().length > 0
    )
    .map((message) => ({
      role: message.role,
      content: truncateHistoryContent(
        message.content,
        message.role === 'assistant' ? assistantCharLimit : userCharLimit
      )
    }));

  const selected: ConversationHistoryMessage[] = [];
  let usedChars = 0;

  for (let index = normalized.length - 1; index >= 0; index -= 1) {
    const message = normalized[index];
    if (selected.length >= maxMessages) {
      break;
    }

    const cost = message.content.length;
    if (selected.length > 0 && usedChars + cost > maxChars) {
      break;
    }

    selected.unshift(message);
    usedChars += cost;
  }

  return selected;
}

export function shouldForceFollowUpRewrite(
  question: string,
  history: ConversationHistoryMessage[]
): boolean {
  if (history.length === 0) {
    return false;
  }

  const normalizedQuestion = question.replace(/\s+/g, ' ').trim();
  if (normalizedQuestion.length === 0) {
    return false;
  }

  if (normalizedQuestion.length <= 16) {
    return true;
  }

  return FOLLOW_UP_PATTERNS.some((pattern) => pattern.test(normalizedQuestion));
}

export function buildConversationHistoryMetadata(
  history: ConversationHistoryMessage[]
) {
  if (history.length === 0) {
    return null;
  }

  return {
    messageCount: history.length,
    charCount: history.reduce(
      (total, message) => total + message.content.length,
      0
    )
  };
}

export function withConversationHistoryMetadata<
  T extends Record<string, unknown>
>(metadata: T, history: ConversationHistoryMessage[]): T {
  const historyMetadata = buildConversationHistoryMetadata(history);
  if (historyMetadata == null) {
    return metadata;
  }

  return {
    ...metadata,
    conversationHistory: historyMetadata
  } as T;
}

export function shouldAttemptAgentSecondPass(input: {
  question: string;
  history: ConversationHistoryMessage[];
  evidence: {
    chunkCount: number;
    sourceCount: number;
    topScore: number | null;
  };
}): boolean {
  const normalizedQuestion = input.question.replace(/\s+/g, ' ').trim();
  if (normalizedQuestion.length === 0) {
    return false;
  }

  if (shouldForceFollowUpRewrite(normalizedQuestion, input.history)) {
    return true;
  }

  if (input.evidence.chunkCount === 0) {
    return true;
  }

  if (
    input.evidence.topScore != null &&
    input.evidence.topScore < AGENT_SECOND_PASS_MIN_TOP_SCORE
  ) {
    return true;
  }

  if (input.evidence.sourceCount <= 1 && input.evidence.chunkCount < 2) {
    return true;
  }

  return (
    COMPLEX_QUESTION_PATTERNS.some((pattern) =>
      pattern.test(normalizedQuestion)
    ) && input.evidence.sourceCount <= 1
  );
}

function truncateHistoryContent(content: string, limit: number) {
  const normalized = content.replace(/\s+/g, ' ').trim();
  if (normalized.length <= limit) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, limit - 3))}...`;
}
