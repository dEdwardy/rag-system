import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, apiStreamRequest } from "../../lib/api";
import {
  AskResponse,
  AskStreamEvent,
  AnswerPolicy,
  Assistant,
  Conversation,
  DocumentChunk,
  DocumentRecord,
  KnowledgeBase,
  Message,
  RetrievalProfileFilters,
  RetrievalProfile,
  TraceRecord
} from "../../types/api";

export function useAssistants() {
  return useQuery({
    queryKey: ["assistants"],
    queryFn: () => apiRequest<Assistant[]>("/assistants")
  });
}

export function useRetrievalProfiles() {
  return useQuery({
    queryKey: ["retrieval-profiles"],
    queryFn: () => apiRequest<RetrievalProfile[]>("/retrieval-profiles")
  });
}

export function useKnowledgeBases() {
  return useQuery({
    queryKey: ["knowledge-bases"],
    queryFn: () => apiRequest<KnowledgeBase[]>("/knowledge-bases")
  });
}

export function useDocuments(knowledgeBaseId: string) {
  return useQuery({
    queryKey: ["documents", knowledgeBaseId],
    queryFn: () => apiRequest<DocumentRecord[]>(`/knowledge-bases/${knowledgeBaseId}/documents`),
    refetchInterval: query => {
      const documents = query.state.data;
      if (!documents) {
        return false;
      }

      return documents.some(document => document.status === "pending" || document.status === "processing")
        ? 2000
        : false;
    }
  });
}

export function useDocumentChunks(documentId: string | null) {
  return useQuery({
    queryKey: ["document-chunks", documentId],
    queryFn: () => apiRequest<DocumentChunk[]>(`/documents/${documentId}/chunks`),
    enabled: documentId != null
  });
}

export function useDocument(documentId: string | null) {
  return useQuery({
    queryKey: ["document", documentId],
    queryFn: () => apiRequest<DocumentRecord>(`/documents/${documentId}`),
    enabled: documentId != null,
    refetchInterval: query => {
      const document = query.state.data;
      if (!document) {
        return false;
      }

      return document.status === "pending" || document.status === "processing" ? 2000 : false;
    }
  });
}

export function useConversations() {
  return useQuery({
    queryKey: ["conversations"],
    queryFn: () => apiRequest<Conversation[]>("/conversations")
  });
}

export function useConversationMessages(conversationId: string | null) {
  return useQuery({
    queryKey: ["conversation-messages", conversationId],
    queryFn: () => apiRequest<Message[]>(`/conversations/${conversationId}/messages`),
    enabled: conversationId != null
  });
}

export function useConversationTraces(conversationId: string | null) {
  return useQuery({
    queryKey: ["conversation-traces", conversationId],
    queryFn: () => apiRequest<TraceRecord[]>(`/conversations/${conversationId}/traces`),
    enabled: conversationId != null
  });
}

export function useTrace(traceId: string | null) {
  return useQuery({
    queryKey: ["trace", traceId],
    queryFn: () => apiRequest<TraceRecord>(`/traces/${traceId}`),
    enabled: traceId != null
  });
}

export function useAskAssistant(assistantId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { question: string; conversationId?: string }) =>
      apiRequest<AskResponse>(`/assistants/${assistantId}/ask`, {
        method: "POST",
        body: payload
      }),
    onSuccess: result => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({
        queryKey: ["conversation-messages", result.conversationId]
      });
      queryClient.invalidateQueries({
        queryKey: ["conversation-traces", result.conversationId]
      });
    }
  });
}

export function useAskAssistantStream(assistantId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      question: string;
      conversationId?: string;
      onEvent: (event: AskStreamEvent) => void;
    }) => {
      await apiStreamRequest<AskStreamEvent>(`/assistants/${assistantId}/ask/stream`, {
        method: "POST",
        body: {
          question: payload.question,
          conversationId: payload.conversationId
        },
        onEvent: payload.onEvent
      });
    },
    onSuccess: (_, variables) => {
      if (variables.conversationId) {
        queryClient.invalidateQueries({
          queryKey: ["conversation-messages", variables.conversationId]
        });
        queryClient.invalidateQueries({
          queryKey: ["conversation-traces", variables.conversationId]
        });
      }
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    }
  });
}

export function useUpdateAssistant(assistantId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: {
      name?: string;
      description?: string | null;
      systemPrompt?: string;
      retrievalProfileId?: string;
      answerPolicyJson?: AnswerPolicy | null;
      status?: "active" | "inactive";
    }) =>
      apiRequest<Assistant>(`/assistants/${assistantId}`, {
        method: "PATCH",
        body: payload
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assistants"] });
    }
  });
}

export function useUpdateRetrievalProfile(retrievalProfileId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: {
      name?: string;
      topK?: number;
      chunkWindow?: number;
      enableHybrid?: boolean;
      enableRerank?: boolean;
      scoreThreshold?: number;
      filtersJson?: RetrievalProfileFilters | null;
    }) =>
      apiRequest<RetrievalProfile>(`/retrieval-profiles/${retrievalProfileId}`, {
        method: "PATCH",
        body: payload
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["retrieval-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["assistants"] });
    }
  });
}

export function useUploadDocument(knowledgeBaseId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);

      return apiRequest<DocumentRecord>(`/knowledge-bases/${knowledgeBaseId}/documents/upload`, {
        method: "POST",
        body: formData
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents", knowledgeBaseId] });
    }
  });
}

export function useReindexDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ documentId, knowledgeBaseId }: { documentId: string; knowledgeBaseId: string }) =>
      apiRequest<DocumentRecord>(`/documents/${documentId}/reindex`, {
        method: "POST"
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["documents", variables.knowledgeBaseId] });
      queryClient.invalidateQueries({ queryKey: ["document", variables.documentId] });
      queryClient.invalidateQueries({ queryKey: ["document-chunks", variables.documentId] });
    }
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ documentId }: { documentId: string }) =>
      apiRequest<{ success: boolean }>(`/documents/${documentId}`, {
        method: "DELETE"
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.removeQueries({ queryKey: ["document", variables.documentId] });
      queryClient.removeQueries({ queryKey: ["document-chunks", variables.documentId] });
    }
  });
}
