import type { AgentStep } from '../../types/api';

type Translate = (
  key: string,
  values?: Record<string, string | number>
) => string;

const STEP_NAME_KEYS: Record<string, string> = {
  route_question: 'chat.agentSteps.routeQuestion',
  run_primary_retrieval: 'chat.agentSteps.primaryRetrieval',
  judge_missing_information: 'chat.agentSteps.judgeMissingInformation',
  run_second_pass: 'chat.agentSteps.secondPass',
  finalize_answer: 'chat.agentSteps.finalizeAnswer',
  plan: 'chat.agentSteps.plan',
  act: 'chat.agentSteps.act',
  finalize: 'chat.agentSteps.finalize'
};

const STEP_RUNNING_KEYS: Record<string, string> = {
  route_question: 'chat.agentSteps.routeQuestionRunning',
  run_primary_retrieval: 'chat.agentSteps.primaryRetrievalRunning',
  judge_missing_information: 'chat.agentSteps.judgeMissingInformationRunning',
  run_second_pass: 'chat.agentSteps.secondPassRunning',
  finalize_answer: 'chat.agentSteps.finalizeAnswerRunning',
  plan: 'chat.agentSteps.planRunning',
  act: 'chat.agentSteps.actRunning',
  finalize: 'chat.agentSteps.finalizeRunning'
};

const TOOL_NAME_KEYS: Record<string, string> = {
  rag_search: 'chat.agentTools.ragSearch',
  rag_answer: 'chat.agentTools.ragAnswer',
  trace_lookup: 'chat.agentTools.traceLookup',
  document_lookup: 'chat.agentTools.documentLookup'
};

export function resolveAgentStepLabel(step: AgentStep, t: Translate) {
  const key = STEP_NAME_KEYS[step.name];
  return key == null ? step.name : t(key);
}

export function resolveAgentToolLabel(toolName: string | null, t: Translate) {
  if (toolName == null) {
    return null;
  }

  const key = TOOL_NAME_KEYS[toolName];
  return key == null ? toolName : t(key);
}

export function resolveAgentStatusLabel(
  status: AgentStep['status'],
  t: Translate
) {
  return t(`chat.agentStatus.${status}`);
}

export function resolveAgentStepSummary(step: AgentStep, t: Translate) {
  if (step.status === 'running') {
    const runningKey = STEP_RUNNING_KEYS[step.name];
    if (runningKey != null) {
      return t(runningKey);
    }
  }

  const diagnostics = asRecord(step.diagnostics);

  if (step.name === 'route_question') {
    const routeType = readString(diagnostics?.routeType);
    const routeLabel =
      routeType != null &&
      ['knowledge_base', 'policy_reply', 'external_source'].includes(routeType)
        ? t(`chat.agentRoutes.${routeType}`)
        : null;
    return routeLabel == null
      ? step.summary
      : t('chat.agentSteps.routeSelected', { route: routeLabel });
  }

  if (step.name === 'run_primary_retrieval') {
    const chunkCount = readNumber(diagnostics?.chunkCount);
    return chunkCount == null
      ? step.summary
      : t('chat.agentSteps.retrievedChunks', { count: chunkCount });
  }

  if (step.name === 'judge_missing_information') {
    const secondPassQuery = readString(diagnostics?.secondPassQuery);
    return secondPassQuery == null
      ? t('chat.agentSteps.noSecondPassNeeded')
      : t('chat.agentSteps.secondPassNeeded');
  }

  if (step.name === 'run_second_pass') {
    if (step.status === 'skipped') {
      return t('chat.agentSteps.secondPassSkipped');
    }

    const chunkCount = readNumber(diagnostics?.chunkCount);
    return chunkCount == null
      ? step.summary
      : t('chat.agentSteps.retrievedChunks', { count: chunkCount });
  }

  if (step.name === 'finalize_answer' || step.name === 'finalize') {
    return step.status === 'completed'
      ? t('chat.agentSteps.finalizeAnswerCompleted')
      : step.summary;
  }

  return step.summary;
}

function asRecord(value: unknown) {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function readString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function readNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
