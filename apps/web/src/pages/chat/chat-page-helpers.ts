import type { Citation, KnowledgeBaseDocumentSummary } from '../../types/api';

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

  if (citation.pageNo != null) {
    parts.push(labels.pageLabel(citation.pageNo));
  }

  if (
    sectionTitle &&
    (!documentTitle ||
      sectionTitle.toLocaleLowerCase() !== documentTitle.toLocaleLowerCase())
  ) {
    parts.push(sectionTitle);
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

function normalizeCitationSectionTitle(value: string | null | undefined) {
  const normalized = normalizeCitationText(value);
  if (!normalized) {
    return null;
  }

  const withoutMarkdownHeading = normalized.replace(/^#{1,6}\s+/, '').trim();
  return withoutMarkdownHeading || null;
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

export function buildChatStarterQuestionHref(question: string) {
  const normalizedQuestion = question.trim();
  if (!normalizedQuestion) {
    return '/';
  }

  const searchParams = new URLSearchParams();
  searchParams.set(CHAT_STARTER_QUESTION_PARAM, normalizedQuestion);
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

type TraceSummaryHintInput = {
  failureReadabilitySentence?: string | null;
  answerStatusSourceReadabilitySentence?: string | null;
  missingInformationProvenanceSentence?: string | null;
  retrievalModeProvenanceSentence?: string | null;
};

function normalizeTraceSummaryHintPart(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

export function buildTraceSummaryHint(summary: TraceSummaryHintInput) {
  return (
    normalizeTraceSummaryHintPart(summary.failureReadabilitySentence) ??
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
