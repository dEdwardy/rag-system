import type {
  GenerateWithToolsInput,
  GenerateWithToolsOutput,
  LlmChatMessage,
  LlmToolCall,
  LlmToolDefinition
} from "./llm.types";

/**
 * Transport for tool calling, kept out of `LlmService` so that file does not
 * keep growing. Both request builders and both response parsers are pure
 * functions so they can be unit tested without a model.
 */

export class LlmToolCallingUnavailableError extends Error {
  constructor() {
    super(
      "Tool calling requires a configured Ollama or OpenAI-compatible model."
    );
    this.name = "LlmToolCallingUnavailableError";
  }
}

export type ToolCompletionTarget = {
  baseUrl: string;
  model: string;
  apiKey?: string;
};

export async function requestOpenAiToolCompletion(input: {
  target: ToolCompletionTarget;
  request: GenerateWithToolsInput;
}): Promise<GenerateWithToolsOutput> {
  const response = await fetch(
    `${input.target.baseUrl}/chat/completions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${input.target.apiKey ?? ""}`
      },
      body: JSON.stringify({
        model: input.target.model,
        temperature: input.request.temperature ?? 0,
        reasoning_effort: "minimal",
        messages: toOpenAiMessages(input.request.messages),
        tools: toOpenAiTools(input.request.tools),
        tool_choice: "auto"
      }),
      signal: input.request.signal
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `OpenAI tool completion failed: ${response.status} ${errorText}`
    );
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: Record<string, unknown> }>;
  };
  const message = payload.choices?.[0]?.message ?? {};

  return {
    ...parseOpenAiToolMessage(message),
    modelName: input.target.model
  };
}

export async function requestOllamaToolCompletion(input: {
  target: ToolCompletionTarget;
  request: GenerateWithToolsInput;
}): Promise<GenerateWithToolsOutput> {
  const response = await fetch(`${input.target.baseUrl}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: input.target.model,
      stream: false,
      messages: toOllamaMessages(input.request.messages),
      tools: toOllamaTools(input.request.tools),
      options: {
        temperature: input.request.temperature ?? 0
      }
    }),
    signal: input.request.signal
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Ollama tool completion failed: ${response.status} ${errorText}`
    );
  }

  const payload = (await response.json()) as {
    message?: Record<string, unknown>;
  };

  return {
    ...parseOllamaToolMessage(payload.message ?? {}),
    modelName: input.target.model
  };
}

export function toOpenAiTools(tools: LlmToolDefinition[]) {
  return tools.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters
    }
  }));
}

export function toOllamaTools(tools: LlmToolDefinition[]) {
  return tools.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters
    }
  }));
}

export function toOpenAiMessages(messages: LlmChatMessage[]) {
  return messages.map((message) => {
    if (message.role === "tool") {
      return {
        role: "tool" as const,
        tool_call_id: message.toolCallId,
        content: message.content
      };
    }

    if (message.role === "assistant") {
      const base = {
        role: "assistant" as const,
        content: message.content ?? ""
      };
      if (!message.toolCalls || message.toolCalls.length === 0) {
        return base;
      }
      return {
        ...base,
        tool_calls: message.toolCalls.map((toolCall) => ({
          id: toolCall.id,
          type: "function" as const,
          function: {
            name: toolCall.name,
            arguments: toolCall.argumentsJson
          }
        }))
      };
    }

    return { role: message.role, content: message.content };
  });
}

export function toOllamaMessages(messages: LlmChatMessage[]) {
  return messages.map((message) => {
    // Ollama does not use tool_call_id; it matches tool results positionally.
    if (message.role === "tool") {
      return {
        role: "tool" as const,
        content: message.content
      };
    }

    if (message.role === "assistant") {
      const base = {
        role: "assistant" as const,
        content: message.content ?? ""
      };
      if (!message.toolCalls || message.toolCalls.length === 0) {
        return base;
      }
      return {
        ...base,
        tool_calls: message.toolCalls.map((toolCall) => ({
          function: {
            name: toolCall.name,
            arguments: safeParseJsonObject(toolCall.argumentsJson)
          }
        }))
      };
    }

    return { role: message.role, content: message.content };
  });
}

export function parseOpenAiToolMessage(message: Record<string, unknown>) {
  const rawCalls = Array.isArray(message.tool_calls)
    ? message.tool_calls
    : [];
  return {
    content: readContent(message.content),
    toolCalls: rawCalls
      .map((rawCall, index) => {
        const record = asRecord(rawCall);
        const fn = asRecord(record.function);
        const name = readString(fn.name);
        if (name == null) {
          return null;
        }
        return {
          id: readString(record.id) ?? `call_${index}`,
          name,
          argumentsJson: normalizeToolArguments(fn.arguments)
        };
      })
      .filter((call): call is LlmToolCall => call != null)
  };
}

export function parseOllamaToolMessage(message: Record<string, unknown>) {
  const rawCalls = Array.isArray(message.tool_calls)
    ? message.tool_calls
    : [];
  return {
    content: readContent(message.content),
    toolCalls: rawCalls
      .map((rawCall, index) => {
        const record = asRecord(rawCall);
        const fn = asRecord(record.function);
        const name = readString(fn.name);
        if (name == null) {
          return null;
        }
        return {
          id: readString(record.id) ?? `call_${index}`,
          name,
          argumentsJson: normalizeToolArguments(fn.arguments)
        };
      })
      .filter((call): call is LlmToolCall => call != null)
  };
}

/**
 * OpenAI sends `arguments` as a JSON string; Ollama sends an object. Callers
 * only ever deal with a JSON string.
 */
export function normalizeToolArguments(value: unknown): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : "{}";
  }

  if (typeof value === "object" && value != null) {
    try {
      return JSON.stringify(value);
    } catch {
      return "{}";
    }
  }

  return "{}";
}

function safeParseJsonObject(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === "object" && parsed != null
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value != null
    ? (value as Record<string, unknown>)
    : {};
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function readContent(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
