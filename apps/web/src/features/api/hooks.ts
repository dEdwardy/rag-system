import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, apiStreamRequest } from "../../lib/api";
import {
  AuditEventRecord,
  AuthMeResponse,
  AuthProvidersResponse,
  AskResponse,
  AskStreamEvent,
  AnswerPolicy,
  Assistant,
  Conversation,
  DocumentChunk,
  DocumentRunRecord,
  DocumentRecord,
  KnowledgeBase,
  KnowledgeBaseDocumentRunRecord,
  KnowledgeBaseDocumentRunComparison,
  KnowledgeBaseDocumentRunSummary,
  EvalQuestionSetRunResult,
  EvalQuestionSetRunQualityGateMode,
  HealthResponse,
  Message,
  RetrievalProfileFilters,
  RetrievalStrategy,
  RetrievalProfile,
  TraceRecord
} from "../../types/api";

const AUTH_ME_QUERY_KEY = ["auth", "me"] as const;

export function useAuthMe(enabled = true) {
  return useQuery({
    queryKey: AUTH_ME_QUERY_KEY,
    queryFn: () => apiRequest<AuthMeResponse>("/auth/me"),
    enabled,
    retry: false
  });
}

export function useAuthProviders(enabled = true) {
  return useQuery({
    queryKey: ["auth", "providers"],
    queryFn: () => apiRequest<AuthProvidersResponse>("/auth/providers"),
    enabled,
    retry: false
  });
}

export function useApiHealth() {
  return useQuery({
    queryKey: ["health"],
    queryFn: () => apiRequest<HealthResponse>("/health"),
    retry: false,
    refetchInterval: 30000
  });
}

export function useAuditEvents(
  input: {
    source?: "all" | "trace" | "document_run";
    issueOnly?: boolean;
    sinceHours?: number;
    query?: string;
    limit?: number;
  } = {}
) {
  return useQuery({
    queryKey: ["audit-events", input],
    queryFn: () => {
      const params = new URLSearchParams();
      if (input.source != null) {
        params.set("source", input.source);
      }
      if (input.issueOnly != null) {
        params.set("issueOnly", String(input.issueOnly));
      }
      if (input.sinceHours != null) {
        params.set("sinceHours", String(input.sinceHours));
      }
      if (input.query != null && input.query.trim().length > 0) {
        params.set("query", input.query.trim());
      }
      if (input.limit != null) {
        params.set("limit", String(input.limit));
      }

      const query = params.toString();
      return apiRequest<AuditEventRecord[]>(`/audit/events${query ? `?${query}` : ""}`);
    },
    refetchInterval: 15000
  });
}

export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { email: string; password: string }) =>
      apiRequest<{ identity: AuthMeResponse["currentIdentity"]; expiresAt: string }>("/auth/login", {
        method: "POST",
        body: payload
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: AUTH_ME_QUERY_KEY });
    }
  });
}

export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      apiRequest<{ ok: true }>("/auth/logout", {
        method: "POST"
      }),
    onSuccess: () => {
      queryClient.removeQueries();
    }
  });
}

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

export function useKnowledgeBases(enabled = true) {
  return useQuery({
    queryKey: ["knowledge-bases"],
    queryFn: () => apiRequest<KnowledgeBase[]>("/knowledge-bases"),
    enabled
  });
}

export function useCreateKnowledgeBase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { name: string; description?: string }) =>
      apiRequest<KnowledgeBase>("/knowledge-bases", {
        method: "POST",
        body: payload
      }),
    onSuccess: async createdKnowledgeBase => {
      queryClient.setQueryData<KnowledgeBase[]>(["knowledge-bases"], currentKnowledgeBases => {
        const otherKnowledgeBases = (currentKnowledgeBases ?? []).filter(
          knowledgeBase => knowledgeBase.id !== createdKnowledgeBase.id
        );

        return [createdKnowledgeBase, ...otherKnowledgeBases].sort(
          (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
        );
      });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["knowledge-bases"] }),
        queryClient.invalidateQueries({ queryKey: ["documents"] }),
        queryClient.invalidateQueries({ queryKey: ["assistants"] })
      ]);
    }
  });
}

export function useDocuments(knowledgeBaseId: string, enabled = true) {
  return useQuery({
    queryKey: ["documents", knowledgeBaseId],
    queryFn: () => apiRequest<DocumentRecord[]>(`/knowledge-bases/${knowledgeBaseId}/documents`),
    enabled,
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

export function useDocumentRuns(documentId: string | null) {
  return useQuery({
    queryKey: ["document-runs", documentId],
    queryFn: () => apiRequest<DocumentRunRecord[]>(`/documents/${documentId}/runs`),
    enabled: documentId != null,
    refetchInterval: query => {
      const runs = query.state.data;
      if (!runs?.length) {
        return false;
      }

      return runs.some(run => run.status === "pending" || run.status === "processing") ? 2000 : false;
    }
  });
}

export function useKnowledgeBaseDocumentRuns(
  knowledgeBaseId: string | null,
  input: {
    limit?: number;
    sinceHours?: number;
    includeDiagnostics?: boolean;
    issueOnly?: boolean;
    status?: DocumentRunRecord["status"];
    sourceType?: string;
  } = {}
) {
  return useQuery({
    queryKey: ["knowledge-base-document-runs", knowledgeBaseId, input],
    queryFn: () => {
      const params = new URLSearchParams();
      if (input.limit != null) {
        params.set("limit", String(input.limit));
      }
      if (input.sinceHours != null) {
        params.set("sinceHours", String(input.sinceHours));
      }
      if (input.includeDiagnostics != null) {
        params.set("includeDiagnostics", String(input.includeDiagnostics));
      }
      if (input.issueOnly != null) {
        params.set("issueOnly", String(input.issueOnly));
      }
      if (input.status != null) {
        params.set("status", input.status);
      }
      if (input.sourceType != null) {
        params.set("sourceType", input.sourceType);
      }

      const query = params.toString();
      return apiRequest<KnowledgeBaseDocumentRunRecord[]>(
        `/knowledge-bases/${knowledgeBaseId}/document-runs${query ? `?${query}` : ""}`
      );
    },
    enabled: knowledgeBaseId != null,
    refetchInterval: query => {
      const runs = query.state.data;
      if (!runs?.length) {
        return false;
      }

      return runs.some(run => run.status === "pending" || run.status === "processing") ? 2000 : false;
    }
  });
}

export function useKnowledgeBaseDocumentRunSummary(
  knowledgeBaseId: string | null,
  input: {
    documentId?: string;
    sourceType?: string;
    status?: DocumentRunRecord["status"];
    trigger?: DocumentRunRecord["trigger"];
    issueOnly?: boolean;
    sinceHours?: number;
  } = {}
) {
  return useQuery({
    queryKey: ["knowledge-base-document-runs-summary", knowledgeBaseId, input],
    queryFn: () => {
      const params = new URLSearchParams();
      if (input.documentId != null) {
        params.set("documentId", input.documentId);
      }
      if (input.sourceType != null) {
        params.set("sourceType", input.sourceType);
      }
      if (input.status != null) {
        params.set("status", input.status);
      }
      if (input.trigger != null) {
        params.set("trigger", input.trigger);
      }
      if (input.issueOnly != null) {
        params.set("issueOnly", String(input.issueOnly));
      }
      if (input.sinceHours != null) {
        params.set("sinceHours", String(input.sinceHours));
      }

      const query = params.toString();
      return apiRequest<KnowledgeBaseDocumentRunSummary>(
        `/knowledge-bases/${knowledgeBaseId}/document-runs/summary${query ? `?${query}` : ""}`
      );
    },
    enabled: knowledgeBaseId != null,
    refetchInterval: query => {
      const summary = query.state.data;
      if (!summary) {
        return false;
      }

      return summary.byStatus.pending > 0 || summary.byStatus.processing > 0 ? 2000 : false;
    }
  });
}

export function useKnowledgeBaseDocumentRunComparison(
  knowledgeBaseId: string | null,
  input:
    | {
        documentId?: string;
        sourceType?: string;
        status?: DocumentRunRecord["status"];
        trigger?: DocumentRunRecord["trigger"];
        issueOnly?: boolean;
        leftRunId: string;
        rightRunId: string;
      }
    | {
        documentId?: string;
        sourceType?: string;
        status?: DocumentRunRecord["status"];
        trigger?: DocumentRunRecord["trigger"];
        issueOnly?: boolean;
        leftSinceHours: number;
        rightSinceHours: number;
      },
  enabled = true
) {
  return useQuery({
    queryKey: ["knowledge-base-document-runs-comparison", knowledgeBaseId, input],
    queryFn: () => {
      const params = new URLSearchParams();
      if (input.documentId != null) {
        params.set("documentId", input.documentId);
      }
      if (input.sourceType != null) {
        params.set("sourceType", input.sourceType);
      }
      if (input.status != null) {
        params.set("status", input.status);
      }
      if (input.trigger != null) {
        params.set("trigger", input.trigger);
      }
      if (input.issueOnly != null) {
        params.set("issueOnly", String(input.issueOnly));
      }

      if ("leftRunId" in input) {
        params.set("leftRunId", input.leftRunId);
        params.set("rightRunId", input.rightRunId);
      } else {
        params.set("leftSinceHours", String(input.leftSinceHours));
        params.set("rightSinceHours", String(input.rightSinceHours));
      }

      return apiRequest<KnowledgeBaseDocumentRunComparison>(
        `/knowledge-bases/${knowledgeBaseId}/document-runs/comparison?${params.toString()}`
      );
    },
    enabled: knowledgeBaseId != null && enabled
  });
}

export function useConversations(enabled = true) {
  return useQuery({
    queryKey: ["conversations"],
    queryFn: () => apiRequest<Conversation[]>("/conversations"),
    enabled
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
    queryFn: () => apiRequest<TraceRecord[]>(`/conversations/${conversationId}/traces?limit=1`),
    enabled: conversationId != null
  });
}

export function useLatestConversationTraces(conversationIds: string[], enabled = true) {
  const tracesQuery = useQuery({
    queryKey: ["latest-conversation-traces", conversationIds],
    queryFn: () =>
      apiRequest<Array<{ conversationId: string; trace: TraceRecord }>>(
        `/traces/latest-by-conversation?conversationIds=${encodeURIComponent(conversationIds.join(","))}`
      ),
    enabled: enabled && conversationIds.length > 0
  });

  const latestTraceByConversationId = conversationIds.reduce<Record<string, TraceRecord | null>>((acc, conversationId) => {
    acc[conversationId] = null;
    return acc;
  }, {});

  for (const item of tracesQuery.data ?? []) {
    latestTraceByConversationId[item.conversationId] = item.trace;
  }

  const isLoading = tracesQuery.isLoading;
  const isError = tracesQuery.isError;
  const failedConversationCount = tracesQuery.isError ? conversationIds.length : 0;
  const error = tracesQuery.error ?? null;

  return {
    latestTraceByConversationId,
    isLoading,
    isError,
    failedConversationCount,
    error
  };
}

export function useTrace(traceId: string | null) {
  return useQuery({
    queryKey: ["trace", traceId],
    queryFn: () => apiRequest<TraceRecord>(`/traces/${traceId}`),
    enabled: traceId != null
  });
}

export function useTraces(input: { query?: string; limit?: number } = {}) {
  return useQuery({
    queryKey: ["traces", input],
    queryFn: () => {
      const params = new URLSearchParams();
      if (input.query != null && input.query.trim().length > 0) {
        params.set("query", input.query.trim());
      }
      if (input.limit != null) {
        params.set("limit", String(input.limit));
      }

      const query = params.toString();
      return apiRequest<TraceRecord[]>(`/traces${query ? `?${query}` : ""}`);
    }
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
      signal?: AbortSignal;
    }) => {
      await apiStreamRequest<AskStreamEvent>(`/assistants/${assistantId}/ask/stream`, {
        method: "POST",
        body: {
          question: payload.question,
          conversationId: payload.conversationId
        },
        signal: payload.signal,
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
      strategyJson?: RetrievalStrategy | null;
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

export function useRunEvalQuestionSet() {
  return useMutation({
    mutationFn: (payload: {
      questionSetId: string;
      assistantId: string;
      baselineSnapshotId?: string;
      qualityGateMode?: EvalQuestionSetRunQualityGateMode;
    }) =>
      apiRequest<EvalQuestionSetRunResult>(`/eval/question-sets/${payload.questionSetId}/runs`, {
        method: "POST",
        body: {
          assistantId: payload.assistantId,
          ...(payload.baselineSnapshotId ? { baselineSnapshotId: payload.baselineSnapshotId } : {}),
          ...(payload.qualityGateMode ? { qualityGateMode: payload.qualityGateMode } : {})
        }
      })
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
      queryClient.invalidateQueries({ queryKey: ["knowledge-base-document-runs", knowledgeBaseId] });
      queryClient.invalidateQueries({ queryKey: ["knowledge-base-document-runs-summary", knowledgeBaseId] });
    }
  });
}

export function useCreateWebPageDocument(knowledgeBaseId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { url: string; title?: string }) =>
      apiRequest<DocumentRecord>(`/knowledge-bases/${knowledgeBaseId}/documents/web-page`, {
        method: "POST",
        body: payload
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents", knowledgeBaseId] });
      queryClient.invalidateQueries({ queryKey: ["knowledge-base-document-runs", knowledgeBaseId] });
      queryClient.invalidateQueries({ queryKey: ["knowledge-base-document-runs-summary", knowledgeBaseId] });
    }
  });
}

export function useCreateFeedDocument(knowledgeBaseId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { url: string; title?: string }) =>
      apiRequest<DocumentRecord>(`/knowledge-bases/${knowledgeBaseId}/documents/feed`, {
        method: "POST",
        body: payload
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents", knowledgeBaseId] });
      queryClient.invalidateQueries({ queryKey: ["knowledge-base-document-runs", knowledgeBaseId] });
      queryClient.invalidateQueries({ queryKey: ["knowledge-base-document-runs-summary", knowledgeBaseId] });
    }
  });
}

export function useCreateSitemapDocument(knowledgeBaseId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { url: string; title?: string; maxPages?: number }) =>
      apiRequest<DocumentRecord>(`/knowledge-bases/${knowledgeBaseId}/documents/sitemap`, {
        method: "POST",
        body: payload
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents", knowledgeBaseId] });
      queryClient.invalidateQueries({ queryKey: ["knowledge-base-document-runs", knowledgeBaseId] });
      queryClient.invalidateQueries({ queryKey: ["knowledge-base-document-runs-summary", knowledgeBaseId] });
    }
  });
}

export function useReindexDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ documentId }: { documentId: string; knowledgeBaseId: string }) =>
      apiRequest<DocumentRecord>(`/documents/${documentId}/reindex`, {
        method: "POST"
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["documents", variables.knowledgeBaseId] });
      queryClient.invalidateQueries({ queryKey: ["document", variables.documentId] });
      queryClient.invalidateQueries({ queryKey: ["document-chunks", variables.documentId] });
      queryClient.invalidateQueries({ queryKey: ["document-runs", variables.documentId] });
      queryClient.invalidateQueries({ queryKey: ["knowledge-base-document-runs", variables.knowledgeBaseId] });
      queryClient.invalidateQueries({ queryKey: ["knowledge-base-document-runs-summary", variables.knowledgeBaseId] });
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
      queryClient.invalidateQueries({ queryKey: ["knowledge-base-document-runs"] });
      queryClient.invalidateQueries({ queryKey: ["knowledge-base-document-runs-summary"] });
      queryClient.removeQueries({ queryKey: ["document", variables.documentId] });
      queryClient.removeQueries({ queryKey: ["document-chunks", variables.documentId] });
      queryClient.removeQueries({ queryKey: ["document-runs", variables.documentId] });
    }
  });
}
