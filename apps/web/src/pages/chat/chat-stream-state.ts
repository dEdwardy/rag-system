import type { Citation } from "../../types/api";

export type ChatStreamAssistantMessage = {
  id: string;
  role: "assistant";
  content: string;
  createdAt: string;
  status: "streaming" | "done" | "error";
  traceId: string | null;
  citations: Citation[];
  assistantMessageId?: string;
  errorMessage?: string;
};

export type ChatStreamUserMessage = {
  id: string;
  role: "user";
  content: string;
  createdAt: string;
};

export type ChatStreamEvent =
  | {
      type: "status";
      phase: "started" | "retrieving" | "generating";
    }
  | {
      type: "answer_delta";
      delta: string;
    }
  | {
      type: "final";
      data: {
        conversationId: string;
        assistantMessageId: string;
        traceId: string;
        answer: string;
        citations: Citation[];
      };
    }
  | {
      type: "error";
      message: string;
    };

export function createPendingChatTurn(input: { question: string }) {
  const timestamp = Date.now().toString();
  const createdAt = new Date().toISOString();

  return {
    userMessage: {
      id: `local-user-${timestamp}`,
      role: "user" as const,
      content: input.question,
      createdAt
    },
    assistantMessage: {
      id: `local-assistant-${timestamp}`,
      role: "assistant" as const,
      content: "",
      createdAt,
      status: "streaming" as const,
      traceId: null,
      citations: []
    }
  };
}

export function applyChatStreamEvent(
  message: ChatStreamAssistantMessage,
  event: ChatStreamEvent
): ChatStreamAssistantMessage {
  if (event.type === "answer_delta") {
    return {
      ...message,
      content: `${message.content}${event.delta}`
    };
  }

  if (event.type === "final") {
    return {
      ...message,
      status: "done",
      content: event.data.answer,
      traceId: event.data.traceId,
      citations: event.data.citations,
      assistantMessageId: event.data.assistantMessageId
    };
  }

  if (event.type === "error") {
    return {
      ...message,
      status: "error",
      errorMessage: event.message
    };
  }

  return message;
}
