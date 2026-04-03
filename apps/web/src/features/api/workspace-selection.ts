import type { Assistant, KnowledgeBase } from "../../types/api";

export function getPrimaryKnowledgeBase(knowledgeBases: KnowledgeBase[] | null | undefined): KnowledgeBase | null {
  return knowledgeBases?.[0] ?? null;
}

export function getPrimaryAssistantForKnowledgeBase(
  assistants: Assistant[] | null | undefined,
  knowledgeBaseId: string | null | undefined
): Assistant | null {
  if (!knowledgeBaseId) {
    return null;
  }

  return assistants?.find(assistant => assistant.kbId === knowledgeBaseId) ?? null;
}
