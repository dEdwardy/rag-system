import type {
  Citation,
  KnowledgeBaseDocumentSummary,
  TraceAnswerStatus,
  TraceFallbackReason,
  TraceInsufficientContextReason
} from '../../types/api';

export function formatConversationUpdatedAt(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(value));
}

export function formatMessageTime(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-US', {
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(value));
}

export function resolveAskErrorMessage(input: {
  error: unknown;
  fallbackMessage: string;
  locale: string;
}) {
  const fallbackMessage = normalizeErrorText(
    input.error instanceof Error ? input.error.message : input.fallbackMessage
  );
  const streamErrorCause = readStreamErrorCause(input.error);
  if (!streamErrorCause) {
    return fallbackMessage || input.fallbackMessage;
  }

  const normalizedCause = normalizeErrorText(streamErrorCause);
  if (!normalizedCause) {
    return fallbackMessage || input.fallbackMessage;
  }

  const isChinese = input.locale === 'zh';
  if (isRobotsTxtBlock(normalizedCause)) {
    return isChinese
      ? '\u8fd9\u4e2a\u7f51\u7ad9\u901a\u8fc7 robots.txt \u7981\u6b62\u81ea\u52a8\u6293\u53d6\uff0c\u6240\u4ee5\u65e0\u6cd5\u76f4\u63a5\u603b\u7ed3\u8be5\u7f51\u9875\u3002\u53ef\u4ee5\u6362\u4e00\u4e2a\u53ef\u8bbf\u95ee\u7684 URL\uff0c\u6216\u5148\u628a\u9875\u9762\u5185\u5bb9\u52a0\u5165\u8d44\u6599\u5e93\u3002'
      : 'This site blocks automated fetching through robots.txt, so the page cannot be summarized directly. Try another accessible URL, or add the page content to the library first.';
  }

  const fetchFailureReason = stripFetchFailurePrefix(normalizedCause);
  if (fetchFailureReason) {
    return isChinese
      ? `\u6293\u53d6\u5916\u90e8\u7f51\u9875\u5931\u8d25\uff1a${fetchFailureReason}`
      : `External web page fetch failed: ${fetchFailureReason}`;
  }

  return normalizedCause;
}

export function buildCitationContext(
  citation: Pick<Citation, 'documentTitle' | 'pageNo' | 'sectionTitle'>,
  labels: {
    pageLabel: (pageNo: number) => string;
  }
) {
  const parts: string[] = [];
  const documentTitle = normalizeCitationText(citation.documentTitle);
  const sectionTitle = normalizeCitationSectionTitle(citation.sectionTitle);

  if (documentTitle) {
    parts.push(documentTitle);
  }

  if (
    sectionTitle &&
    (!documentTitle ||
      sectionTitle.toLocaleLowerCase() !== documentTitle.toLocaleLowerCase())
  ) {
    parts.push(`"${sectionTitle}"`);
  }

  if (citation.pageNo != null) {
    parts.push(labels.pageLabel(citation.pageNo));
  }

  return parts.length > 0 ? parts.join(' • ') : null;
}

function normalizeCitationText(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.replace(/\s+/g, ' ');
}

function readStreamErrorCause(error: unknown) {
  if (typeof error !== 'object' || error == null || !('details' in error)) {
    return null;
  }

  const details = (error as { details?: unknown }).details;
  if (typeof details !== 'object' || details == null || !('cause' in details)) {
    return null;
  }

  const cause = (details as { cause?: unknown }).cause;
  return typeof cause === 'string' ? cause : null;
}

function normalizeErrorText(value: string | null | undefined) {
  return value?.replace(/\s+/g, ' ').trim() ?? '';
}

function isRobotsTxtBlock(value: string) {
  return value.toLowerCase().includes('blocked by robots.txt');
}

function stripFetchFailurePrefix(value: string) {
  return value.replace(/^Failed to fetch web page:\s*/i, '').trim() || null;
}

function normalizeCitationSectionTitle(value: string | null | undefined) {
  const normalized = normalizeCitationText(value);
  if (!normalized) {
    return null;
  }

  const withoutMarkdownHeading = normalized.replace(/^#{1,6}\s+/, '').trim();
  const withoutEnclosingQuotes = withoutMarkdownHeading.replace(
    /^(["'])(.*)\1$/,
    '$2'
  );
  return withoutEnclosingQuotes.trim() || null;
}

export type ChatReadinessState =
  | { kind: 'no_active_knowledge_base' }
  | { kind: 'no_documents' }
  | { kind: 'processing_documents'; count: number }
  | { kind: 'failed_documents'; count: number }
  | { kind: 'ready' };

export function buildChatReadinessState(
  summary: KnowledgeBaseDocumentSummary | null,
  hasKnowledgeBase: boolean
): ChatReadinessState {
  if (!hasKnowledgeBase) {
    return { kind: 'no_active_knowledge_base' };
  }

  if (!summary || summary.totalDocuments === 0) {
    return { kind: 'no_documents' };
  }

  if (summary.failedDocuments > 0 && summary.readyDocuments === 0) {
    return {
      kind: 'failed_documents',
      count: summary.failedDocuments
    };
  }

  if (summary.processingDocuments > 0 && summary.readyDocuments === 0) {
    return {
      kind: 'processing_documents',
      count: summary.processingDocuments
    };
  }

  return { kind: 'ready' };
}

type StarterQuestionContext = 'chat' | 'documents';

const CHAT_STARTER_QUESTION_PARAM = 'starterQuestion';
const CHAT_AUTO_ASK_PARAM = 'ask';

const CHINESE_STARTER_QUESTIONS = {
  chat: [
    '这份资料主要讲了什么？',
    '请列出最重要的三个要点。',
    '有哪些还不够清楚或缺少信息的地方？'
  ],
  documents: [
    '这批资料主要讲了什么？',
    '请列出最重要的三个要点。',
    '有哪些地方还不够清楚或缺少信息？'
  ]
} as const;

const ENGLISH_STARTER_QUESTIONS = {
  chat: [
    'What is this library mainly about?',
    'List the three most important points.',
    'What is still unclear or missing from these sources?'
  ],
  documents: [
    'What are these library items mainly about?',
    'List the three most important points.',
    'What is still unclear or missing from these sources?'
  ]
} as const;

export function buildStarterQuestions(
  locale: string,
  context: StarterQuestionContext = 'chat'
) {
  return locale === 'zh'
    ? [...CHINESE_STARTER_QUESTIONS[context]]
    : [...ENGLISH_STARTER_QUESTIONS[context]];
}

export function buildChatStarterQuestionHref(
  question: string,
  options?: { autoAsk?: boolean }
) {
  const normalizedQuestion = question.trim();
  if (!normalizedQuestion) {
    return '/';
  }

  const searchParams = new URLSearchParams();
  searchParams.set(CHAT_STARTER_QUESTION_PARAM, normalizedQuestion);
  if (options?.autoAsk) {
    searchParams.set(CHAT_AUTO_ASK_PARAM, '1');
  }
  return `/?${searchParams.toString()}`;
}

export function parseChatStarterQuestionFromSearch(search: string) {
  const searchParams = new URLSearchParams(search);
  const rawQuestion = searchParams.get(CHAT_STARTER_QUESTION_PARAM);
  if (!rawQuestion) {
    return null;
  }

  const normalizedQuestion = rawQuestion.trim();
  return normalizedQuestion.length > 0 ? normalizedQuestion : null;
}

export function parseChatAutoAskFromSearch(search: string) {
  const searchParams = new URLSearchParams(search);
  return searchParams.get(CHAT_AUTO_ASK_PARAM) === '1';
}

export function shouldDelayConversationAutoSelectForStarter(search: string) {
  return (
    parseChatAutoAskFromSearch(search) &&
    parseChatStarterQuestionFromSearch(search) != null
  );
}

type TraceSummaryHintInput = {
  answerStatus?: TraceAnswerStatus | null;
  insufficientContextReason?: TraceInsufficientContextReason | null;
  usedFallback?: boolean | null;
  fallbackReason?: TraceFallbackReason | null;
  missingInformationCount?: number | null;
  failureReadabilitySentence?: string | null;
  answerStatusSourceReadabilitySentence?: string | null;
  missingInformationProvenanceSentence?: string | null;
  retrievalModeProvenanceSentence?: string | null;
};

function normalizeTraceSummaryHintPart(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function buildInsufficientContextHint(
  reason: TraceInsufficientContextReason | null | undefined
) {
  if (reason === 'no_retrieval_hits') {
    return 'Marked as insufficient context: retrieval found no relevant source hits.';
  }

  if (reason === 'retrieved_context_insufficient') {
    return 'Marked as insufficient context: retrieved source evidence was too weak for a reliable answer.';
  }

  return null;
}

function buildFallbackHint(reason: TraceFallbackReason | null | undefined) {
  if (reason === 'vector_error') {
    return 'Fallback retrieval path was used because vector retrieval failed.';
  }

  if (reason === 'no_ranked_candidates') {
    return 'Fallback retrieval path was used because ranked retrieval returned no usable candidates.';
  }

  return null;
}

export function buildTraceSummaryHint(summary: TraceSummaryHintInput) {
  const failureHint = normalizeTraceSummaryHintPart(
    summary.failureReadabilitySentence
  );
  if (failureHint) {
    return failureHint;
  }

  const insufficientContextHint = buildInsufficientContextHint(
    summary.insufficientContextReason
  );
  if (insufficientContextHint) {
    return insufficientContextHint;
  }

  if (summary.answerStatus === 'insufficient_context') {
    return 'Marked as insufficient context in this answer.';
  }

  if (summary.insufficientContextReason != null) {
    return 'Marked as insufficient context from retrieved evidence.';
  }

  const fallbackHint = buildFallbackHint(summary.fallbackReason);
  if (fallbackHint) {
    return fallbackHint;
  }

  if (summary.usedFallback === true) {
    return 'Fallback retrieval path was used for this answer.';
  }

  if ((summary.missingInformationCount ?? 0) > 0) {
    return `Answer reports ${summary.missingInformationCount} missing information item${summary.missingInformationCount === 1 ? '' : 's'}.`;
  }

  return (
    normalizeTraceSummaryHintPart(
      summary.answerStatusSourceReadabilitySentence
    ) ??
    normalizeTraceSummaryHintPart(
      summary.missingInformationProvenanceSentence
    ) ??
    normalizeTraceSummaryHintPart(summary.retrievalModeProvenanceSentence) ??
    null
  );
}
