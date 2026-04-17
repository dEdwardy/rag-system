export const messages = {
  appShell: {
    title: 'RAG System',
    subtitle: 'Personal RAG workspace, built on a reusable core',
    nav: {
      chat: 'Chat',
      documents: 'Library',
      knowledgeBase: 'Workspace settings',
      assistant: 'Assistant'
    },
    copy: {
      mainHeading: 'Use',
      setupHeading: 'Setup',
      advancedHeading: 'Workbench',
      primaryNavigation: 'Primary navigation',
      workspaceMenu: 'Workspace menu',
      mobileWorkspaceMenu: 'Mobile workspace menu',
      workspaceNavigation: 'Workspace navigation',
      openNavigationMenu: 'Open navigation menu',
      closeNavigationMenu: 'Close navigation menu',
      showAdvancedTools: 'Show workbench tools',
      hideAdvancedTools: 'Hide workbench tools',
      currentKnowledgeBase: 'Current workspace library',
      loadingKnowledgeBase: 'Loading workspace library',
      loadingWorkspace: 'Loading workspace',
      preparingWorkspaceShell:
        'Checking your session and preparing the app shell.',
      preparingRouterAndShell: 'Preparing the application router and shell.',
      loadingChatPanels: 'Loading conversation history and citations.',
      loadingOperationsData: 'Loading operations data...',
      loadingOperations: 'Loading operations',
      search: 'Search',
      notifications: 'Notifications',
      switchToChinese: 'Switch to Chinese',
      switchToEnglish: 'Switch to English',
      intelligentWorkspace: 'Intelligent answer workspace',
      noKnowledgeBase: 'No workspace library',
      loading: 'Loading',
      documentCount: '{count} documents',
      currentIdentityHeading: 'Current identity',
      currentIdentityDescription: 'Active session',
      userIdLabel: 'User',
      tenantIdLabel: 'Tenant',
      authSourceLabel: 'Auth source',
      loginSessionLabel: 'Login session',
      localSessionValue: 'Local session',
      oauthSessionPrefix: 'OAuth via {provider}',
      oauthProviderUnknown: 'provider',
      sessionIdLabel: 'Session ID',
      noSessionValue: 'Not available',
      logout: 'Log out'
    }
  },
  common: {
    mvp: 'MVP',
    noDescription: 'No description',
    actions: {
      ask: 'Ask',
      saveChanges: 'Save changes',
      uploadDocument: 'Upload document',
      viewDetails: 'View details',
      viewTraceDetails: 'View trace details',
      reindex: 'Reindex',
      delete: 'Delete',
      backToWorkbench: 'Back to workbench overview',
      backToDocuments: 'Back to documents',
      backToChat: 'Back to chat'
    },
    fields: {
      title: 'Title',
      status: 'Status',
      stage: 'Stage',
      chunks: 'Chunks',
      storage: 'Storage',
      details: 'Details',
      name: 'Name',
      description: 'Description',
      documents: 'Documents',
      created: 'Created',
      updated: 'Updated',
      version: 'Version',
      mime: 'MIME',
      storageKey: 'Storage Key',
      conversation: 'Conversation',
      assistant: 'Assistant',
      latency: 'Latency',
      model: 'Model',
      userQuery: 'User Query',
      rewrittenQuery: 'Rewritten Query',
      rawPayload: 'Raw Payload',
      retrievalProfile: 'Retrieval profile',
      assistantId: 'Assistant ID',
      profileId: 'Profile ID',
      topK: 'Top K',
      chunkWindow: 'Chunk window',
      scoreThreshold: 'Score threshold',
      systemPrompt: 'System prompt'
    },
    status: {
      active: 'active',
      inactive: 'inactive',
      pending: 'pending',
      processing: 'processing',
      ready: 'ready',
      failed: 'failed',
      success: 'success',
      user: 'user',
      assistant: 'assistant'
    },
    processingStage: {
      uploaded: 'uploaded',
      parsing: 'parsing',
      chunking: 'chunking',
      indexing: 'indexing',
      completed: 'completed',
      failed: 'failed'
    },
    misc: {
      focused: 'Focused',
      noSection: 'No section',
      pageShort: 'P{pageNo}',
      pageLong: 'page {pageNo}',
      chunkLabel: 'chunk: {chunkId}',
      tokenCount: 'tokenCount'
    }
  },
  chat: {
    title: 'Chat',
    subtitle:
      'Ask the current assistant against the current workspace library.',
    conversations: 'Conversations',
    latestCitations: 'Latest Citations',
    askPlaceholder: 'Ask a question about your library',
    askHintEnabled:
      'The current implementation uses chunk-based retrieval with citations.',
    askHintDisabled:
      'Assistant data is unavailable, so new requests are disabled.',
    copy: {
      heroTitle: 'Intelligent answer assistant',
      heroSubtitle:
        'Knowledge-grounded answers with visible sources and optional diagnostics',
      moreActions: 'More actions',
      moreActionsHint: 'More actions coming soon',
      currentKnowledgeBase: 'Current library',
      currentKnowledgeBaseHintHasKb:
        'Questions on this page use the current workspace library.',
      currentKnowledgeBaseHintNoKb:
        'Create a workspace library first, then chat will align to it automatically.',
      currentAssistant: 'Current assistant',
      currentAssistantHintHasAssistant:
        'This assistant is the active answer setup for the current workspace library.',
      currentAssistantHintNoAssistant:
        'The default assistant is still being prepared or repaired for the current workspace library. Wait a moment, then try again.',
      currentWorkspace: 'Current workspace',
      newConversationDraft: 'New conversation draft',
      noActiveKnowledgeBase: 'Workspace library unavailable',
      noKnowledgeBaseName: 'No active library',
      noAssistantName: 'No bound assistant',
      askStatus: 'Ask status',
      citationsAndTrace: 'Sources and diagnostics',
      waitingForNextTrace: 'Waiting for diagnostics',
      currentWorkspaceHintHasConversation:
        'The active conversation drives the latest sources and diagnostics view.',
      currentWorkspaceHintNewConversation:
        'A new question will start a fresh conversation.',
      askStatusHintHasAssistant:
        'This status now follows the current library readiness before sending questions.',
      askStatusHintNoAssistant:
        'Answer settings are still being prepared or repaired for the current workspace library before new questions can be sent.',
      citationsCount:
        '{conversationCount} conversations, {citationCount} current citations.',
      inputSection: 'Ask composer',
      inputHelpCanAsk:
        'Press Enter to send. Sources stay visible on the right, with diagnostics available when needed.',
      inputHelpDisabled:
        'The default assistant is being prepared or repaired for this library, so the composer is temporarily unavailable.',
      askInputPlaceholder: 'Ask a question and press Enter...',
      enterHint: 'Press Enter to send, Shift + Enter for a new line',
      fileUploadComingSoon: 'File upload coming soon',
      uploadFromLibrary: 'Add documents from the library page',
      history: 'History',
      newChat: 'New chat',
      conversationLabel: 'Conversation',
      renameConversation: 'Rename',
      deleteConversation: 'Delete',
      renameConversationPrompt: 'Enter a new conversation title:',
      renameConversationError: 'Failed to rename conversation.',
      deleteConversationConfirm:
        'Delete "{title}"? This keeps the messages but archives the conversation.',
      deleteConversationError: 'Failed to delete conversation.',
      currentCitations: 'Sources',
      viewTrace: 'Open diagnostics',
      regenerateAnswer: 'Regenerate',
      copyAnswer: 'Copy',
      copiedAnswer: 'Copied',
      stopGenerating: 'Stop generation',
      diagnosticsReady: 'Diagnostics ready',
      answerFailed: 'Answer failed',
      answerStopped: 'Stopped by you',
      preparingAnswer: 'Preparing answer',
      retrievingContext: 'Retrieving context',
      generatingAnswer: 'Generating answer',
      starterPromptHint:
        'Click one to send it now, then refine the follow-up in chat.',
      noDocuments: 'Library still empty',
      libraryNeedsAttention: 'Library needs review',
      libraryUpdating: 'Library updating',
      answerSettingsNeeded: 'Answer settings needed',
      inProgress: 'In progress',
      readyToAsk: 'Ready to ask',
      noModel: 'No model',
      answerPipelineCompleted: 'Answer pipeline completed',
      needsInspection: 'Needs inspection'
    },
    states: {
      loadingConversationsTitle: 'Loading conversations',
      loadingConversationsDescription: 'Loading recent chat sessions.',
      conversationsErrorTitle: 'Failed to load conversations.',
      noConversationsTitle: 'No conversations yet',
      noConversationsDescription:
        'Ask the assistant to create the first conversation.',
      noActiveConversationTitle: 'No active conversation',
      noActiveConversationDescription:
        'At least one library item is ready. Pick a starter question and send it now, or select a past conversation to continue.',
      loadingMessagesTitle: 'Loading messages',
      loadingMessagesDescription: 'Loading messages and trace references.',
      messagesErrorTitle: 'Failed to load messages.',
      noMessagesTitle: 'No messages',
      noMessagesDescription:
        'This conversation has no persisted messages yet. Send one starter question now to create the first answer turn.',
      noActiveKnowledgeBaseTitle: 'No active workspace library',
      noActiveKnowledgeBaseDescription:
        'Create or restore a workspace library first. Chat only becomes available after the current workspace has an active library.',
      noActiveKnowledgeBaseAction: 'Open workspace settings',
      noAssistantForKnowledgeBaseTitle:
        'Default assistant is still being prepared',
      noAssistantForKnowledgeBaseDescription:
        'The current workspace library is {knowledgeBaseName}. The system is preparing or repairing the default assistant for this library. Refresh this page in a moment if it does not appear automatically.',
      noAssistantForKnowledgeBaseAction: 'Open answer settings',
      noAssistantForKnowledgeBaseRefreshAction: 'Refresh default path',
      noDocumentsTitle: 'Add library items before chatting',
      noDocumentsDescription:
        'The current workspace library is {knowledgeBaseName}, but it does not have source material yet. Add the first files or links before starting chat.',
      noDocumentsAction: 'Open library',
      processingDocumentsTitle: 'Library updates are still running',
      processingDocumentsDescription:
        '{count} library items are still being added or refreshed. Let them finish first so chat uses the latest material.',
      processingDocumentsAction: 'Review library status',
      failedDocumentsTitle: 'Some library items need attention',
      failedDocumentsDescription:
        '{count} library items still need retry or cleanup. Review those items first, then continue to chat.',
      failedDocumentsAction: 'Open library',
      onboardingDiagnosticsTitle: 'Diagnostics appear after the first answer',
      onboardingDiagnosticsDescription:
        'Keep the focus on setup first. After the first question, this area will show sources and optional diagnostics.',
      assistantErrorTitle: 'Failed to load assistant.',
      askError: 'Ask request failed.',
      copyError: 'Failed to copy answer.',
      noTraceTitle: 'No diagnostics yet',
      noTraceDescription:
        'Pick a conversation to review its latest sources and diagnostics.',
      loadingTraceTitle: 'Loading diagnostics',
      loadingTraceDescription:
        'Loading sources and diagnostics for this conversation.',
      traceErrorTitle: 'Failed to load diagnostics.',
      noCitationsTitle: 'No citations yet',
      noCitationsDescription:
        'Ask a question in this conversation to capture source references and diagnostics.'
    }
  },
  documents: {
    title: 'Library',
    subtitle:
      'Add files or links to the current workspace library, then check when they are ready to use.',
    uploadSuccess: 'Uploaded {fileName}',
    uploadStart: 'Starting to upload {fileName}...',
    uploadBatchSuccess: 'Successfully uploaded {count} files',
    uploadBatchStart: 'Starting to upload {count} files...',
    uploadError: 'Upload failed.',
    uploadBatchError: 'Batch upload failed.',
    processingBanner:
      'Some library items are still updating. Wait for the refresh to finish before treating chat as fully ready.',
    processingBannerWithReady:
      'Some library items are still updating, but ready items can already support chat. You can start asking now and return here as updates finish.',
    loadKbError: 'Failed to load workspace library.',
    loadDocumentsError: 'Failed to load library items.',
    loadingTitle: 'Loading library',
    loadingDescription: 'Fetching the latest items and their readiness state.',
    noActiveKnowledgeBaseTitle: 'No active workspace library for this page',
    noActiveKnowledgeBaseDescription:
      'Create a workspace library before adding files, saving links, or reviewing library status.',
    noActiveKnowledgeBaseAction: 'Create a workspace library first',
    workspaceStatusNoActiveKnowledgeBase: 'Create a workspace library first',
    workspaceStatusNeedsAttention: 'Failed items need review',
    workspaceStatusProcessing: 'Items are updating',
    workspaceStatusReady: 'Library ready',
    workspaceNextActionNoActiveKnowledgeBase:
      'Create a workspace library before adding files, saving links, or reviewing library status.',
    workspaceNextActionNeedsAttention:
      'Open the failed item first, check the latest error summary, then retry or clean it up if needed.',
    workspaceNextActionProcessing:
      'Wait for the current updates to finish, then review the refreshed item states.',
    workspaceNextActionProcessingWithReady:
      'Some items are still processing, but ready items can already support chat. Start asking now and come back for the remaining updates.',
    workspaceNextActionReady:
      'The library is ready for chat. Move on to chat now, or keep adding more source material here.',
    workspaceNextActionLinkNoActiveKnowledgeBase: 'Open workspace settings',
    workspaceNextActionLinkNeedsAttention: 'Open the failed item',
    workspaceNextActionLinkProcessing: 'Open the in-progress item',
    workspaceNextActionLinkReady: 'Open chat',
    readyBannerTitle: 'Library ready for chat',
    readyBannerDescription:
      '{count} library items are ready. You can move on to chat now, or keep expanding this library.',
    readyBannerStarterHint:
      'Tip: click a starter question to open chat and ask it automatically.',
    currentKnowledgeBaseLabel: 'Current library target',
    currentKnowledgeBaseHintHasKb:
      'Files and links added here go into the current workspace library.',
    currentKnowledgeBaseHintNoKb:
      'Create a workspace library first so new library items have a clear home.',
    emptyTitle: 'No library items yet',
    emptyDescription:
      'Upload a file or save one source link, then return here to see when it is ready.',
    sourceEntryHeading: 'Add sources',
    sourceEntryScanPath:
      'Upload a file or paste one link, then check the item list below.',
    sourceEntryNoActiveKnowledgeBaseTitle:
      'No active workspace library for this page',
    sourceEntryNoActiveKnowledgeBaseDescription:
      'Create a workspace library before adding files, saving links, or reviewing library status.',
    sourceEntrySubmittingHint:
      'A source is being added right now. Wait for the current submission to finish, then review the list below.',
    sourceEntryStatusNoActiveKnowledgeBase:
      'Create a workspace library first to enable uploads, saved links, and library status.',
    sourceEntryStatusEmpty:
      'Upload a file or paste one link to start building this library.',
    sourceEntryStatusReady: 'Ready to save this link into the library.',
    sourceEntryStatusSubmitting:
      'Adding source in progress. Keep this section read-only until it finishes.',
    sourceEntryStatusSuccess:
      'Last saved source link: {url}. Check the list below for status.',
    sourceEntryInlineErrorRequired:
      'Enter a URL in this source field before submitting.',
    sourceEntryInlineErrorInvalidHttpUrl:
      'Enter a valid http(s) URL for this source field.',
    reindexRequested: 'Reindex requested for {title}',
    reindexError: 'Reindex failed.',
    webPage: {
      sectionTitle: 'Web page',
      sectionDescription: 'Save one web page link into the current library.',
      inputPlaceholder: 'https://example.com/page',
      submitAction: 'Add web page',
      submitSuccess: 'Saved web page link: {url}.',
      submitError: 'Failed to add web page.'
    },
    feed: {
      sectionTitle: 'Feed',
      sectionDescription: 'Save one RSS or Atom feed into the current library.',
      inputPlaceholder: 'https://example.com/feed.xml',
      submitAction: 'Add feed',
      submitSuccess: 'Saved feed link: {url}.',
      submitError: 'Failed to add feed.'
    },
    sitemap: {
      sectionTitle: 'Sitemap',
      sectionDescription: 'Save one sitemap link into the current library.',
      inputPlaceholder: 'https://example.com/sitemap.xml',
      submitAction: 'Add sitemap',
      submitSuccess: 'Saved sitemap link: {url}.',
      submitError: 'Failed to add sitemap.'
    },
    detail: {
      title: 'Document Detail',
      kicker: 'Document detail',
      subtitle:
        'Review document processing state, metadata, and generated chunks.',
      loadError: 'Failed to load document.',
      deleteSuccess: 'Deleted {title}',
      deleteError: 'Delete failed.',
      deleteDialogTitle: 'Confirm document deletion',
      deleteDialogDescriptionWithTitle:
        'Deleting "{title}" cannot be undone. This action will not change backend APIs, but it will permanently remove the current document record.',
      deleteDialogDescriptionFallback:
        'Deleting the current document cannot be undone.',
      deleteCancel: 'Cancel',
      processingAlert:
        'This document is still processing. The page will refresh automatically.',
      failedAlert:
        'Processing failed. Review the error message below and retry reindex when ready.',
      chunksTitle: 'Chunks',
      chunksLoadError: 'Failed to load chunks.',
      noChunks: 'No chunks generated yet.',
      linkedChunkMissing: 'The linked chunk was not found in this document.',
      documentStatus: 'Document status',
      primaryStatus: 'Primary status',
      nextAction: 'Next action',
      primaryStatusRunSummaryLoading: 'Loading latest run state.',
      primaryStatusRunSummaryMissing: 'No document run history yet.',
      primaryStatusSummaryProcessing:
        'Document ingestion is still in progress. Latest run: {runSummary}',
      primaryStatusSummaryFailed:
        'Latest ingestion run failed before this document became retrievable. What happened: {runSummary}',
      primaryStatusSummaryReady:
        'Document is currently ready for retrieval. Latest run: {runSummary}',
      primaryStatusNextActionProcessing:
        'Wait for ingestion to finish, then review the run summary below before opening diagnostics.',
      primaryStatusNextActionFailed:
        'Read the one-line run failure summary below, retry reindex when ready, then continue to diagnostics if answers still look off.',
      primaryStatusNextActionReady:
        'If answers look off, scan the latest run summary first, then continue to diagnostics.',
      storageAndDiagnostics: 'Storage and diagnostics',
      storageAndDiagnosticsCopy:
        'Keep the storage key and error details available, but treat them as secondary diagnostics.',
      runsTitle: 'Document runs',
      runsDescription:
        'Review the upload, reindex, and external resync history for this document by version and time.',
      runsEmptyTitle: 'No document runs yet',
      runsEmptyDescription:
        'This document does not have execution history yet.',
      runsLoadError: 'Failed to load document runs.',
      chunkListCopy:
        'The chunk list keeps its logic unchanged and only tightens hierarchy, focus state, and density.',
      detailHeroCopy:
        'Keep the same trace deep-link flow and tighten hierarchy, focus states, and reading density only.',
      traceFocusTitle: 'Focused from trace',
      traceFocusDescription: 'This chunk was opened from trace {traceId}.',
      traceFocusNextStep:
        'Review the focused chunk first, then jump back to the same trace context or return to the document workspace.',
      traceFocusReviewHeading: '1',
      traceFocusReviewChunk:
        'Start with the chunk text itself and confirm whether it actually supports the answer you were reviewing.',
      traceFocusReviewSelection:
        'Then check the trace badges here for rank, score, primary-vs-neighbor, and whether the answer cited this chunk.',
      traceFocusReviewReturn:
        'After that, jump back to diagnostics to decide whether retrieval, citations, or the final answer need the next review.',
      traceRankLabel: 'Trace rank #{rank}',
      traceScoreLabel: 'Trace score {score}',
      tracePrimary: 'Primary',
      traceNeighbor: 'Neighbor',
      traceCited: 'Cited',
      backToTrace: 'Back to trace'
    }
  },
  knowledgeBase: {
    title: 'Workspace settings',
    subtitle:
      'Choose the current library target and check whether your materials are ready to support chat.',
    actions: {
      create: 'Create workspace library',
      openDocuments: 'Open library',
      openAssistant: 'Open answer settings',
      refreshDefaultPath: 'Refresh default path',
      openChat: 'Open chat'
    },
    create: {
      modalTitle: 'Create the first workspace library',
      modalDescription:
        'Library items, chat, and answer settings all follow the current workspace library. Start by creating that shared target here.',
      nameLabel: 'Workspace library name',
      namePlaceholder: 'Personal workspace library',
      descriptionLabel: 'Description',
      descriptionPlaceholder:
        'Optional note about what this workspace library should cover.',
      submit: 'Create workspace library',
      cancel: 'Cancel',
      success: 'Workspace library created: {name}.',
      nextStepTitle: '{name} is now the current workspace library.',
      nextStepDescription:
        'Add the first library items now so chat and answer settings have real material to use.',
      nextStepPrimaryAction: 'Open library',
      nextStepDismiss: 'Dismiss',
      error: 'Failed to create the workspace library.',
      nameRequired: 'Enter a workspace library name before creating it.'
    },
    metrics: {
      readyDocuments: 'Ready items',
      processingDocuments: 'Updating items',
      failedDocuments: 'Items with issues',
      boundAssistants: 'Connected assistants'
    },
    summary: {
      title: 'Workspace snapshot',
      caption:
        '{documents} library items, {chunks} chunks, {assistants} assistants currently connected.',
      ready: 'Ready',
      processing: 'Updating',
      failed: 'Needs attention',
      empty: 'Empty',
      readyDescription:
        '{count} items are ready to support chat and answering.',
      processingDescription:
        '{count} items are still being added or refreshed.',
      failedDescription:
        '{count} items need attention before this workspace is fully ready.',
      emptyDescription:
        'Add library items to turn this workspace into something chat can use.'
    },
    nextAction: {
      addDocuments: 'Add library items before changing anything else.',
      reviewFailedDocuments:
        'Review the items with issues before adding more material.',
      waitForProcessing:
        'Wait for the current updates to finish, then check the refreshed states.',
      chatWhileProcessing:
        'Some library items are still updating, but ready items can already support chat. Start asking now and return to library status as updates finish.',
      prepareDefaultAssistant:
        'The library is ready. Open answer settings so the default assistant can finish preparing or repairing before chat.',
      workspaceReady:
        'This workspace is ready. The best next step is to move on to chat.'
    },
    feedback: {
      title: 'Current best next step'
    },
    states: {
      loadingTitle: 'Loading workspace settings',
      loadingDescription:
        'Fetching the current workspace library and linked resources.',
      loadErrorTitle: 'Failed to load workspace settings.',
      loadErrorDescription:
        'The current workspace library overview could not be loaded.',
      assistantsErrorTitle: 'Failed to load assistants.',
      assistantsErrorDescription:
        'Assistant data is unavailable for this workspace.',
      documentsErrorTitle: 'Failed to load library items.',
      documentsErrorDescription:
        'Library item status could not be loaded for this workspace.',
      emptyTitle: 'Create the first workspace library',
      emptyDescription:
        'This workspace does not have a library target yet. Create one first so library items, chat, and answer settings all stay aligned to the same context.',
      emptyAction: 'Create workspace library',
      noDocumentsTitle: 'No library items yet',
      noDocumentsDescription:
        'Add your first item to start preparing this workspace for chat.'
    }
  },
  assistant: {
    title: 'Answer settings',
    subtitle:
      'Choose how the assistant should respond, and adjust search behavior only when needed.',
    loadingTitle: 'Loading answer settings',
    loadingDescription:
      'Loading the current assistant settings and search profile.',
    assistantLoadError: 'Failed to load assistant settings.',
    retrievalProfileLoadError: 'Failed to load search profile.',
    updated: 'Answer settings updated.',
    updateError: 'Failed to update answer settings.',
    assistantName: 'Assistant name',
    status: 'Status',
    assistantIsActive: 'Assistant is active',
    assistantIsInactive: 'Assistant is inactive',
    answerPolicySection: 'How answers should look',
    responseStyle: 'Response style',
    responseStyleConcise: 'Concise',
    responseStyleBalanced: 'Balanced',
    responseStyleDetailed: 'Detailed',
    tone: 'Tone',
    toneNeutral: 'Neutral',
    toneFriendly: 'Friendly',
    toneDirect: 'Direct',
    outputFormat: 'Output format',
    outputFormatParagraph: 'Paragraph',
    outputFormatBullets: 'Bullets',
    outputFormatMarkdown: 'Markdown',
    language: 'Language',
    languageAuto: 'Auto',
    languageSameAsQuestion: 'Same as question',
    languageZh: 'Chinese',
    languageEn: 'English',
    citationMode: 'Source citation',
    citationModeRequired: 'Required',
    citationModeOptional: 'Optional',
    maxCitations: 'Max citations',
    noAnswerBehavior: 'When context is not enough',
    noAnswerBehaviorInsufficientContext: 'Say insufficient context',
    noAnswerBehaviorBestEffort: 'Best effort',
    includeMissingInformation: 'Suggest what information is still missing',
    retrievalSection: 'Search behavior',
    hybridLabel: 'Use hybrid search',
    rerankLabel: 'Reorder results before answering',
    note: 'These advanced search settings are saved now. Current backend search still mainly uses vector retrieval with lexical fallback.',
    copy: {
      heroTitle: 'Answer setup',
      heroSubtitle:
        'Keep response style, search behavior, and advanced limits in one place without changing the underlying payloads.',
      assistantIdentity: 'Assistant basics',
      assistantIdentityCopy:
        'Name, status, description, and system prompt stay together so this workspace keeps a clear assistant identity.',
      systemPromptHint:
        'Most users can leave the system prompt unchanged and start with the recommended answer settings below.',
      recommendedDefaults: 'Recommended answer settings',
      recommendedDefaultsCopy:
        'If you do not need to tune search manually, staying close to these defaults is usually the most stable day-to-day setup.',
      advancedTuning: 'Advanced search controls',
      advancedTuningCopy:
        'Only adjust this section when answers are clearly missing useful content or returning too much noise. Otherwise leave it alone.',
      answerPolicyCopy:
        'Choose tone, structure, citations, and fallback behavior for day-to-day answers.',
      retrievalCopy:
        'Adjust how much content gets searched before the assistant answers.',
      workspaceStatus: 'Current setup',
      currentLibraryLabel: 'Current library target',
      currentAssistantBindingLabel: 'Default assistant status',
      currentAssistantBindingValue:
        'This default assistant follows the current primary library automatically.',
      saveCheckpoint: 'Save changes',
      saveCheckpointCopy:
        'Save once to persist both assistant settings and search-profile changes together.'
    },
    answerPolicyRecommendedHint:
      'Recommended default: balanced + required citations + say insufficient context + suggest missing information.',
    retrievalRecommendedHint:
      'Recommended default: topK 3, chunk window 0, hybrid off, rerank off. Change these only when search results are clearly off.',
    advancedRetrievalHint:
      'Hybrid search, rerank, explicit strategy override, and filters are advanced controls. Use them only when results are too noisy or missing key hits.',
    showAdvancedTuning: 'Show advanced controls',
    hideAdvancedTuning: 'Hide advanced controls',
    showAssistantBasics: 'Show basics',
    hideAssistantBasics: 'Hide basics',
    assistantBasicsSummary:
      'Current answer settings: {name}, status {status}. Expand this section only when you need to review the name, description, or system prompt.',
    advancedTuningDefaultSummary:
      'Advanced search controls are currently using the default behavior.',
    advancedTuningCustomSummary:
      'Custom advanced search controls are currently active for this assistant.',
    retrievalStrategySection: 'Advanced search strategy',
    retrievalStrategyHelp:
      'Optionally save an explicit strategy override here. Turn it off to fall back to the default search settings above.',
    strategyOverrideEnabled: 'Use explicit search-strategy override',
    candidateSelectionMode: 'Search mode',
    retrievalModeVector: 'Vector',
    retrievalModeHybrid: 'Hybrid',
    retrievalModeLexical: 'Lexical',
    candidateMultiplier: 'Candidate multiplier',
    minCandidates: 'Minimum candidate count',
    hybridVectorWeight: 'Vector weight',
    hybridLexicalWeight: 'Keyword weight',
    queryRewriteEnabled: 'Rewrite questions before search',
    rerankStrategyEnabled: 'Use strategy-level rerank override',
    retrievalStrategyDefaultNote:
      'When this is off, the backend derives search strategy from the existing topK and related settings.',
    retrievalFiltersSection: 'Limit search scope',
    showFilters: 'Show scope limits',
    hideFilters: 'Hide scope limits',
    filtersDefaultSummary: 'No search scope limits are saved right now.',
    filtersCustomSummary:
      'Custom search scope limits are saved for this assistant.',
    filterHelp:
      'Use commas or new lines for list filters. Leaving every field empty removes any saved scope limits.',
    listFieldHint: 'Separate values with commas or new lines.',
    documentIdsInclude: 'Only include document IDs',
    documentIdsExclude: 'Exclude document IDs',
    sectionTitlesInclude: 'Only include section titles',
    sectionTitlesExclude: 'Exclude section titles',
    sectionTitlesContains: 'Section title contains',
    pageNumbersInclude: 'Only include page numbers',
    pageNumbersExclude: 'Exclude page numbers',
    pageNumbersMin: 'Minimum page',
    pageNumbersMax: 'Maximum page',
    noKnowledgeBaseTitle: 'No workspace library available',
    noKnowledgeBaseDescription:
      'Create a workspace library first. Answer settings in this workspace always follow the current library target.',
    noKnowledgeBaseAction: 'Open workspace settings',
    noAssistantForKnowledgeBaseTitle:
      'Default assistant is still being prepared',
    noAssistantForKnowledgeBaseDescription:
      'The current workspace library is {knowledgeBaseName}. The system is preparing or repairing the default assistant for this library. Refresh this page in a moment if it does not appear automatically.',
    noAssistantForKnowledgeBaseAction: 'Open answer settings',
    noAssistantForKnowledgeBaseRefreshAction: 'Refresh default path',
    noAssistantDocumentsPrimaryAction: 'Add library items first',
    noAssistantDocumentsSecondaryAction: 'Open library',
    missingProfileTitle: 'Missing search profile',
    missingProfileDescription:
      'The assistant exists, but its search profile could not be resolved.'
  },
  auth: {
    login: {
      brand: 'RAG System',
      title: 'Login',
      subtitle: 'Sign in with your local account or continue with a provider.',
      email: 'Email',
      emailPlaceholder: 'you@example.com...',
      password: 'Password',
      submit: 'Login',
      submitting: 'Logging in...',
      localDevAccount: 'Local dev account',
      useDevCredentials: 'Use dev credentials',
      continueWithGitHub: 'Continue with GitHub',
      continueWithGoogle: 'Continue with Google',
      continueWithOidc: 'Continue with OIDC',
      loadingProviders: 'Loading sign-in options',
      githubSetupRequired: 'GitHub setup required',
      googleSetupRequired: 'Google setup required',
      oidcSetupRequired: 'OIDC setup required'
    },
    oauthWorkspaceWelcome: {
      knowledge: {
        kicker: '{provider} workspace setup',
        titleWithDocuments:
          'Your workspace library has real source material now.',
        titleWithoutDocuments:
          'Start by setting up the current workspace library.',
        descriptionWithDocumentsWithAssistant:
          'The current workspace library already has documents and at least one connected answer setup. Review the workspace or move on to asking questions.',
        descriptionWithDocumentsWithoutAssistant:
          'The current workspace library already has documents, but you should still review answer settings before treating chat as fully ready.',
        descriptionWithoutDocumentsWithAssistant:
          'A workspace library and assistant exist for this workspace, but retrieval will stay thin until you add source files.',
        descriptionWithoutDocumentsWithoutAssistant:
          'This workspace still needs the first source files, and you may also need to finish answer settings before asking questions.',
        answerSetupReady: 'Answer setup connected',
        answerSetupPending: 'Answer setup not ready',
        documentsAvailable: '{count} documents available',
        actionUploadDocuments: 'Upload documents',
        actionOpenAnswerSettings: 'Open answer settings',
        actionReviewAnswerSettings: 'Review answer settings'
      },
      assistant: {
        kicker: '{provider} answer settings',
        titleWithAssistant:
          'Review the current answer settings before tuning further.',
        titleWithoutAssistant:
          'This workspace still needs answer settings for the current library.',
        descriptionWithoutAssistant:
          'Answer settings in this product follow the current workspace library. Review the library and document state first, then restore or connect the same workspace answer setup.',
        descriptionWithoutDocuments:
          'Answer settings already exist, but the workspace library is still empty. Upload documents first, then come back to tune prompting and retrieval behavior.',
        descriptionDefault:
          'Answer settings already exist and the workspace library has material. Tune settings here only when you need to improve answer behavior or retrieval quality.',
        answerSetupReady: 'Answer settings connected',
        answerSetupPending: 'Answer settings not ready',
        documentsAvailable: '{count} documents available',
        conversations: '{count} chats so far',
        actionUploadDocuments: 'Upload documents',
        actionOpenChat: 'Open chat',
        actionOpenWorkspaceSettings: 'Open workspace settings'
      },
      chat: {
        kicker: '{provider} chat workspace',
        titleNoDocuments:
          'Chat still needs source material from the current library.',
        titleNoAnswerSettings:
          'One more step is still missing before chat is ready.',
        titleReady: 'The current workspace is ready to continue in chat.',
        descriptionNoDocuments:
          'Before treating chat as ready, upload files into the current workspace library so retrieval uses your own workspace material instead of an empty corpus.',
        descriptionNoAnswerSettings:
          'The workspace library already has material, but chat still needs answer settings for this same workspace before you can ask reliably.',
        descriptionNoConversations:
          'The current workspace has material available. Start the first conversation when you are ready to verify chat end to end.',
        descriptionReady:
          'This workspace is already active. Continue the conversation or refine workspace settings and answer settings if answers still look off.',
        currentWorkspaceChat: 'Current workspace chat',
        documentsAvailable: '{count} documents available',
        conversations: '{count} conversations',
        actionUploadFiles: 'Upload files',
        actionOpenAnswerSettings: 'Open answer settings',
        actionStartChatting: 'Start chatting',
        actionOpenWorkspaceSettings: 'Open workspace settings',
        stepAddLibraryItems: 'Add library items',
        stepAddLibraryItemsDone:
          'Done. This workspace library already has source material.',
        stepAddLibraryItemsPending:
          'Upload the first files so chat has real workspace material to use.',
        stepReviewAnswerSettings: 'Review answer settings',
        stepReviewAnswerSettingsDone:
          'Done. Answer settings are already connected to this workspace.',
        stepReviewAnswerSettingsWithDocs:
          'This is the next step. Connect answer settings for the same workspace before chatting.',
        stepReviewAnswerSettingsPending:
          'This comes right after the first library items are ready.',
        stepStartChatting: 'Start chatting',
        stepStartChattingDone:
          'Everything is ready. Use chat to verify the full answer flow.',
        stepStartChattingPending:
          'Once the first two steps are done, come back here and start the first conversation.'
      }
    }
  },
  trace: {
    title: 'Diagnostic trace',
    subtitle:
      'Inspect retrieval, citations, and model metadata for one answer when something needs review.',
    loadError: 'Failed to load trace.',
    copy: {
      heroTitle: 'Diagnostics',
      heroSubtitle:
        'Review the latest trace from each conversation when answers need investigation.',
      heroSidecopy:
        'Scan the user question, outcome, and timing first, then open detailed diagnostics only when needed.',
      loadingConversations: 'Loading conversations',
      loadingLatestTrace: 'Loading latest diagnostic trace...',
      conversationsError: 'Failed to load conversations',
      latestResult: 'Latest result',
      loadTracesError: 'Failed to load traces',
      partialLoadError:
        'Failed to load traces for {count} conversation(s). {error}',
      noConversationsTitle: 'No conversations',
      noConversationsDescription:
        'There are no conversations with diagnostics to inspect yet.',
      traceHeading: 'Diagnostics',
      traceDescription:
        'Review the latest trace from each conversation when answers need investigation.',
      traceSidecopy:
        'Scan the user question, outcome, and timing first, then open detailed diagnostics only when needed.',
      modelUnknown: 'No model',
      latestResultSuccess: 'Answer pipeline completed',
      latestResultNeedsInspection: 'Needs diagnostics',
      traceId: 'Diagnostic trace id',
      firstToken: 'First token',
      answerGeneration: 'Answer generation',
      retrieval: 'Retrieval',
      slowestStage: 'Slowest stage',
      viewTraceDetails: 'View diagnostics',
      backToChat: 'Back to chat'
    },
    queryComparison: 'Query Comparison',
    queryComparisonDescription:
      'Compare the original question with the query that was actually used for retrieval.',
    rewriteApplied: 'Rewrite applied',
    rewriteNotApplied: 'No rewrite',
    rewriteSameAsOriginal: 'Same as the original user query.',
    retrievedChunks: 'Retrieved Chunks',
    sortedByScore: 'Sorted by final score descending.',
    sortedByTraceOrder:
      'Showing captured trace order because no score breakdown was persisted.',
    rankLabel: 'Rank #{rank}',
    primaryChunk: 'Primary',
    neighborChunk: 'Neighbor',
    citedChunk: 'Cited',
    chunkPreview: 'Chunk Preview',
    finalScoreLabel: 'Final {score}',
    vectorScoreLabel: 'Vector {score}',
    lexicalScoreLabel: 'Lexical {score}',
    hybridScoreLabel: 'Hybrid {score}',
    rerankScoreLabel: 'Rerank {score}',
    citations: 'Citations',
    noRetrievedChunks: 'No retrieved chunks captured for this trace.',
    noCitations: 'No citations recorded for this trace.'
  },
  documentRuns: {
    skippedStatus: 'Skipped',
    startedPrefix: 'Started',
    finishedPrefix: 'Finished',
    inProgress: 'In progress',
    startedAt: 'Started',
    finishedAt: 'Finished',
    failedStage: 'Failed stage',
    openDocument: 'Open document',
    minimalDiagnostics: 'Minimal diagnostics',
    diagnosticsSummary: {
      code: 'Code',
      retryable: 'Retryable',
      partial: 'Partial',
      failedPages: 'Failed pages',
      failedChildSitemaps: 'Failed child sitemaps',
      failedEntries: 'Failed entries',
      attemptedPages: 'Attempted pages',
      attemptedEntries: 'Attempted entries'
    }
  },
  report: {
    loadingQuestionSets: 'Loading question sets...',
    loadingBaselines: 'Loading baselines...',
    loadingResultsTable: 'Loading results table',
    loadingAnalysisPanels: 'Loading analysis panels'
  }
} as const;
