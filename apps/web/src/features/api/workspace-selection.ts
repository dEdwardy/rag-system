import type { Assistant, KnowledgeBase } from '../../types/api';

const DEFAULT_ASSISTANT_NAME = 'Default Assistant';
const DEFAULT_PRIMARY_KB_NAME = 'Default Knowledge Base';

export function getPrimaryKnowledgeBase(
  knowledgeBases: KnowledgeBase[] | null | undefined
): KnowledgeBase | null {
  if (!knowledgeBases || knowledgeBases.length === 0) {
    return null;
  }

  return knowledgeBases.slice().sort(compareKnowledgeBasePriority)[0] ?? null;
}

export function getPrimaryAssistantForKnowledgeBase(
  assistants: Assistant[] | null | undefined,
  knowledgeBaseId: string | null | undefined
): Assistant | null {
  if (!knowledgeBaseId) {
    return null;
  }

  const assistantsForKnowledgeBase =
    assistants?.filter((assistant) => assistant.kbId === knowledgeBaseId) ?? [];

  if (assistantsForKnowledgeBase.length === 0) {
    return null;
  }

  return (
    assistantsForKnowledgeBase.slice().sort(compareAssistantPriority)[0] ?? null
  );
}

function compareAssistantPriority(left: Assistant, right: Assistant) {
  const scoreDifference =
    scoreAssistantPriority(right) - scoreAssistantPriority(left);

  if (scoreDifference !== 0) {
    return scoreDifference;
  }

  return left.id.localeCompare(right.id);
}

function compareKnowledgeBasePriority(
  left: KnowledgeBase,
  right: KnowledgeBase
) {
  const scoreDifference =
    scoreKnowledgeBasePriority(right) - scoreKnowledgeBasePriority(left);

  if (scoreDifference !== 0) {
    return scoreDifference;
  }

  return left.id.localeCompare(right.id);
}

function scoreKnowledgeBasePriority(knowledgeBase: KnowledgeBase) {
  let score = 0;

  if (isDefaultPrimaryKnowledgeBaseName(knowledgeBase.name)) {
    score += 100;
  }

  if (knowledgeBase.status === 'active') {
    score += 10;
  }

  return score;
}

function scoreAssistantPriority(assistant: Assistant) {
  let score = 0;

  if (isDefaultAssistantName(assistant.name)) {
    score += 100;
  }

  if (assistant.status === 'active') {
    score += 10;
  }

  return score;
}

function isDefaultPrimaryKnowledgeBaseName(name: string | null | undefined) {
  return (
    typeof name === 'string' &&
    normalizeCanonicalDefaultName(name) ===
      normalizeCanonicalDefaultName(DEFAULT_PRIMARY_KB_NAME)
  );
}

function isDefaultAssistantName(name: string | null | undefined) {
  return (
    typeof name === 'string' &&
    normalizeCanonicalDefaultName(name) ===
      normalizeCanonicalDefaultName(DEFAULT_ASSISTANT_NAME)
  );
}

function normalizeCanonicalDefaultName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}
