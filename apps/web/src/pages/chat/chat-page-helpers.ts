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
  citation: Pick<Citation, 'pageNo' | 'sectionTitle'>,
  labels: {
    pageLabel: (pageNo: number) => string;
  }
) {
  const parts: string[] = [];

  if (citation.pageNo != null) {
    parts.push(labels.pageLabel(citation.pageNo));
  }

  if (citation.sectionTitle) {
    parts.push(citation.sectionTitle);
  }

  return parts.length > 0 ? parts.join(' - ') : null;
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
