type DocumentLike = {
  status: 'pending' | 'processing' | 'ready' | 'failed';
  chunkCount: number;
};

export type KnowledgeBaseWorkspaceSummary = {
  chunkCount: number;
  readyCount: number;
  processingCount: number;
  failedCount: number;
  tone: 'failed' | 'processing' | 'ready' | 'empty';
  toneColor: 'red' | 'yellow' | 'indigo' | 'gray';
  toneLabelKey:
    | 'knowledgeBase.summary.failed'
    | 'knowledgeBase.summary.processing'
    | 'knowledgeBase.summary.ready'
    | 'knowledgeBase.summary.empty';
};

export function buildKnowledgeBaseWorkspaceSummary({
  documents
}: {
  documents: DocumentLike[];
  assistantCount: number;
}): KnowledgeBaseWorkspaceSummary {
  const chunkCount = documents.reduce(
    (sum, document) => sum + document.chunkCount,
    0
  );
  const readyCount = documents.filter(
    (document) => document.status === 'ready'
  ).length;
  const processingCount = documents.filter(
    (document) =>
      document.status === 'pending' || document.status === 'processing'
  ).length;
  const failedCount = documents.filter(
    (document) => document.status === 'failed'
  ).length;
  const tone =
    failedCount > 0
      ? 'failed'
      : processingCount > 0
        ? 'processing'
        : readyCount > 0
          ? 'ready'
          : 'empty';
  const toneColor =
    tone === 'failed'
      ? 'red'
      : tone === 'processing'
        ? 'yellow'
        : tone === 'ready'
          ? 'indigo'
          : 'gray';
  const toneLabelKey =
    tone === 'failed'
      ? 'knowledgeBase.summary.failed'
      : tone === 'processing'
        ? 'knowledgeBase.summary.processing'
        : tone === 'ready'
          ? 'knowledgeBase.summary.ready'
          : 'knowledgeBase.summary.empty';

  return {
    chunkCount,
    readyCount,
    processingCount,
    failedCount,
    tone,
    toneColor,
    toneLabelKey
  };
}

export type KnowledgeBaseWorkspaceNextAction = {
  action:
    | 'add_documents'
    | 'review_failed_documents'
    | 'wait_for_processing'
    | 'prepare_default_assistant'
    | 'workspace_ready';
  labelKey:
    | 'knowledgeBase.nextAction.addDocuments'
    | 'knowledgeBase.nextAction.reviewFailedDocuments'
    | 'knowledgeBase.nextAction.waitForProcessing'
    | 'knowledgeBase.nextAction.prepareDefaultAssistant'
    | 'knowledgeBase.nextAction.workspaceReady';
  actionHref: '/documents' | '/assistant' | '/';
};

export function buildKnowledgeBaseWorkspaceNextAction({
  documents,
  assistantCount
}: {
  documents: DocumentLike[];
  assistantCount: number;
}): KnowledgeBaseWorkspaceNextAction {
  const summary = buildKnowledgeBaseWorkspaceSummary({
    documents,
    assistantCount
  });

  if (documents.length === 0) {
    return {
      action: 'add_documents',
      labelKey: 'knowledgeBase.nextAction.addDocuments',
      actionHref: '/documents'
    };
  }

  if (summary.failedCount > 0) {
    return {
      action: 'review_failed_documents',
      labelKey: 'knowledgeBase.nextAction.reviewFailedDocuments',
      actionHref: '/documents'
    };
  }

  if (summary.processingCount > 0) {
    return {
      action: 'wait_for_processing',
      labelKey: 'knowledgeBase.nextAction.waitForProcessing',
      actionHref: '/documents'
    };
  }

  if (assistantCount === 0) {
    return {
      action: 'prepare_default_assistant',
      labelKey: 'knowledgeBase.nextAction.prepareDefaultAssistant',
      actionHref: '/assistant'
    };
  }

  return {
    action: 'workspace_ready',
    labelKey: 'knowledgeBase.nextAction.workspaceReady',
    actionHref: '/'
  };
}
