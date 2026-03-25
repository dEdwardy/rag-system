import { Injectable, Logger } from "@nestjs/common";
import {
  GenerateAnswerInput,
  GenerateAnswerOutput,
  GenerateAnswerStreamInput,
  GenerateAnswerStreamOutput,
  RewriteQueryInput,
  RewriteQueryOutput
} from "./llm.types";
import { resolveLlmRuntimeConfig } from "./llm-runtime-config";
import { PromptManagerService } from "./prompt-manager.service";
import { structuredAnswerSchema } from "./structured-answer.schema";

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);

  constructor(private readonly promptManager: PromptManagerService) {}

  async generateAnswer(input: GenerateAnswerInput): Promise<GenerateAnswerOutput> {
    const runtimeConfig = resolveLlmRuntimeConfig();

    if (runtimeConfig.ollamaBaseUrl && runtimeConfig.ollamaModel) {
      try {
        return await this.generateOllamaAnswer(runtimeConfig, input);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown Ollama error.";
        this.logger.warn(`Falling back after Ollama error: ${message}`);
      }
    }

    if (!runtimeConfig.openAiApiKey) {
      return this.generateFallbackAnswer(input);
    }

    try {
      return await this.generateOpenAIAnswer(runtimeConfig, input);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown LLM error.";
      this.logger.warn(`Falling back to local answer generation: ${message}`);
      return this.generateFallbackAnswer(input);
    }
  }

  async generateAnswerStream(input: GenerateAnswerStreamInput): Promise<GenerateAnswerStreamOutput> {
    const runtimeConfig = resolveLlmRuntimeConfig();

    if (runtimeConfig.ollamaBaseUrl && runtimeConfig.ollamaModel) {
      try {
        return await this.generateOllamaAnswerStream(runtimeConfig, input);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown Ollama error.";
        this.logger.warn(`Falling back after Ollama stream error: ${message}`);
      }
    }

    if (runtimeConfig.openAiApiKey) {
      try {
        return await this.generateOpenAIAnswerStream(runtimeConfig, input);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown LLM error.";
        this.logger.warn(`Falling back after OpenAI stream error: ${message}`);
      }
    }

    return this.generateFallbackAnswerStream(input);
  }

  async rewriteQuery(input: RewriteQueryInput): Promise<RewriteQueryOutput> {
    const runtimeConfig = resolveLlmRuntimeConfig();

    if (runtimeConfig.ollamaBaseUrl && runtimeConfig.ollamaModel) {
      try {
        return await this.rewriteQueryWithOllama(runtimeConfig, input);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown Ollama error.";
        this.logger.warn(`Falling back after Ollama rewrite error: ${message}`);
      }
    }

    if (runtimeConfig.openAiApiKey) {
      try {
        return await this.rewriteQueryWithOpenAI(runtimeConfig, input);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown LLM error.";
        this.logger.warn(`Falling back to local query rewrite: ${message}`);
      }
    }

    return this.rewriteQueryFallback(input);
  }

  private async generateOllamaAnswer(runtimeConfig: ReturnType<typeof resolveLlmRuntimeConfig>, input: GenerateAnswerInput) {
    const prompt = this.promptManager.buildAnswerPrompt(input);

    const response = await fetch(`${runtimeConfig.ollamaBaseUrl}/api/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: runtimeConfig.ollamaModel,
        prompt: prompt.fullPrompt,
        stream: false,
        options: {
          temperature: runtimeConfig.answerTemperature
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama request failed: ${response.status} ${errorText}`);
    }

    const payload = (await response.json()) as { response?: string };
    const answer = payload.response?.trim();

    if (!answer) {
      throw new Error("Ollama response did not include generated text.");
    }

    return {
      modelName: `ollama:${runtimeConfig.ollamaModel}`,
      promptId: prompt.promptId,
      usedFallback: false,
      ...this.parseAnswerOutput(answer)
    };
  }

  private async generateOpenAIAnswer(runtimeConfig: ReturnType<typeof resolveLlmRuntimeConfig>, input: GenerateAnswerInput) {
    const prompt = this.promptManager.buildAnswerPrompt(input);

    const response = await fetch(`${runtimeConfig.openAiBaseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${runtimeConfig.openAiApiKey}`
      },
      body: JSON.stringify({
        model: runtimeConfig.openAiChatModel,
        temperature: runtimeConfig.answerTemperature,
        messages: [
          {
            role: "system",
            content: prompt.systemPrompt
          },
          {
            role: "user",
            content: prompt.userPrompt
          }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI request failed: ${response.status} ${errorText}`);
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const answer = payload.choices?.[0]?.message?.content?.trim();

    if (!answer) {
      throw new Error("OpenAI response did not include an answer.");
    }

    return {
      modelName: runtimeConfig.openAiChatModel,
      promptId: prompt.promptId,
      usedFallback: false,
      ...this.parseAnswerOutput(answer)
    };
  }

  parseStructuredAnswer(input: {
    rawAnswer: string;
    modelName: string;
    promptId: string;
    usedFallback: boolean;
  }): GenerateAnswerOutput {
    return {
      modelName: input.modelName,
      promptId: input.promptId,
      usedFallback: input.usedFallback,
      ...this.parseAnswerOutput(input.rawAnswer)
    };
  }

  private async generateOllamaAnswerStream(
    runtimeConfig: ReturnType<typeof resolveLlmRuntimeConfig>,
    input: GenerateAnswerStreamInput
  ): Promise<GenerateAnswerStreamOutput> {
    const prompt = this.promptManager.buildAnswerPrompt(input);

    const response = await fetch(`${runtimeConfig.ollamaBaseUrl}/api/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: runtimeConfig.ollamaModel,
        prompt: prompt.fullPrompt,
        stream: true,
        options: {
          temperature: runtimeConfig.answerTemperature
        }
      })
    });

    if (!response.ok || !response.body) {
      const errorText = await response.text();
      throw new Error(`Ollama stream request failed: ${response.status} ${errorText}`);
    }

    let rawAnswer = "";
    let emittedAnswer = "";
    await this.readNdjsonStream(response, async payload => {
      const chunk = typeof payload.response === "string" ? payload.response : "";
      if (!chunk) {
        return;
      }

      rawAnswer += chunk;
      emittedAnswer = await this.emitVisibleAnswerDelta({
        rawAnswer,
        emittedAnswer,
        onDelta: input.onDelta
      });
    });

    if (!rawAnswer.trim()) {
      throw new Error("Ollama stream response did not include generated text.");
    }

    return {
      rawAnswer: rawAnswer.trim(),
      modelName: `ollama:${runtimeConfig.ollamaModel}`,
      promptId: prompt.promptId,
      usedFallback: false
    };
  }

  private async generateOpenAIAnswerStream(
    runtimeConfig: ReturnType<typeof resolveLlmRuntimeConfig>,
    input: GenerateAnswerStreamInput
  ): Promise<GenerateAnswerStreamOutput> {
    const prompt = this.promptManager.buildAnswerPrompt(input);

    const response = await fetch(`${runtimeConfig.openAiBaseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${runtimeConfig.openAiApiKey}`
      },
      body: JSON.stringify({
        model: runtimeConfig.openAiChatModel,
        temperature: runtimeConfig.answerTemperature,
        stream: true,
        messages: [
          {
            role: "system",
            content: prompt.systemPrompt
          },
          {
            role: "user",
            content: prompt.userPrompt
          }
        ]
      })
    });

    if (!response.ok || !response.body) {
      const errorText = await response.text();
      throw new Error(`OpenAI stream request failed: ${response.status} ${errorText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let rawAnswer = "";
    let emittedAnswer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      while (true) {
        const delimiterIndex = buffer.indexOf("\n\n");
        if (delimiterIndex < 0) {
          break;
        }

        const eventBlock = buffer.slice(0, delimiterIndex);
        buffer = buffer.slice(delimiterIndex + 2);

        for (const line of eventBlock.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) {
            continue;
          }

          const data = trimmed.slice(5).trim();
          if (data === "[DONE]") {
            continue;
          }

          const payload = JSON.parse(data) as {
            choices?: Array<{ delta?: { content?: string } }>;
          };
          const chunk = payload.choices?.[0]?.delta?.content ?? "";
          if (!chunk) {
            continue;
          }

          rawAnswer += chunk;
          emittedAnswer = await this.emitVisibleAnswerDelta({
            rawAnswer,
            emittedAnswer,
            onDelta: input.onDelta
          });
        }
      }
    }

    if (!rawAnswer.trim()) {
      throw new Error("OpenAI stream response did not include generated text.");
    }

    return {
      rawAnswer: rawAnswer.trim(),
      modelName: runtimeConfig.openAiChatModel,
      promptId: prompt.promptId,
      usedFallback: false
    };
  }

  private async rewriteQueryWithOllama(
    runtimeConfig: ReturnType<typeof resolveLlmRuntimeConfig>,
    input: RewriteQueryInput
  ): Promise<RewriteQueryOutput> {
    const prompt = this.promptManager.buildRewritePrompt(input);
    const response = await fetch(`${runtimeConfig.ollamaBaseUrl}/api/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: runtimeConfig.ollamaModel,
        prompt: prompt.fullPrompt,
        stream: false,
        options: {
          temperature: runtimeConfig.rewriteTemperature
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama rewrite request failed: ${response.status} ${errorText}`);
    }

    const payload = (await response.json()) as { response?: string };
    const rewrittenQuery = this.normalizeRewriteOutput(payload.response);

    if (!rewrittenQuery) {
      throw new Error("Ollama rewrite response did not include text.");
    }

    return {
      rewrittenQuery,
      modelName: `ollama:${runtimeConfig.ollamaModel}`,
      usedFallback: false,
      promptId: prompt.promptId
    };
  }

  private async rewriteQueryWithOpenAI(
    runtimeConfig: ReturnType<typeof resolveLlmRuntimeConfig>,
    input: RewriteQueryInput
  ): Promise<RewriteQueryOutput> {
    const prompt = this.promptManager.buildRewritePrompt(input);

    const response = await fetch(`${runtimeConfig.openAiBaseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${runtimeConfig.openAiApiKey}`
      },
      body: JSON.stringify({
        model: runtimeConfig.openAiChatModel,
        temperature: runtimeConfig.rewriteTemperature,
        messages: [
          {
            role: "system",
            content: prompt.systemPrompt
          },
          {
            role: "user",
            content: prompt.userPrompt
          }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI rewrite request failed: ${response.status} ${errorText}`);
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const rewrittenQuery = this.normalizeRewriteOutput(payload.choices?.[0]?.message?.content);

    if (!rewrittenQuery) {
      throw new Error("OpenAI rewrite response did not include text.");
    }

    return {
      rewrittenQuery,
      modelName: runtimeConfig.openAiChatModel,
      usedFallback: false,
      promptId: prompt.promptId
    };
  }

  private generateFallbackAnswer(input: GenerateAnswerInput): GenerateAnswerOutput {
    if (input.chunks.length === 0) {
      return {
        answer: this.buildFallbackNoHitAnswer(input.question, input.answerPolicy.language),
        modelName: "fallback-local",
        promptId: this.promptManager.getAnswerPromptId(),
        usedFallback: true,
        answerStatus: "insufficient_context",
        missingInformation: [this.buildFallbackNoHitMissingInformation(input.question, input.answerPolicy.language)]
      };
    }

    const topChunk = input.chunks[0];
    const answer = this.buildFallbackGroundedAnswer({
      question: input.question,
      language: input.answerPolicy.language,
      content: topChunk.content
    });

    return {
      answer,
      modelName: "fallback-local",
      promptId: this.promptManager.getAnswerPromptId(),
      usedFallback: true,
      answerStatus: "grounded",
      missingInformation: [],
      citedChunkNumbers: [1]
    };
  }

  private buildFallbackNoHitAnswer(question: string, language: GenerateAnswerInput["answerPolicy"]["language"]) {
    const resolvedLanguage = this.resolveAnswerLanguage(question, language);
    if (resolvedLanguage === "zh") {
      return "我没有在知识库中找到足够相关的信息来回答这个问题。";
    }

    return "I couldn't find relevant information in the knowledge base.";
  }

  private buildFallbackNoHitMissingInformation(
    question: string,
    language: GenerateAnswerInput["answerPolicy"]["language"]
  ) {
    const resolvedLanguage = this.resolveAnswerLanguage(question, language);
    if (resolvedLanguage === "zh") {
      return "\u6ca1\u6709\u68c0\u7d22\u5230\u53ef\u7528\u4e8e\u652f\u6301\u56de\u7b54\u7684\u76f8\u5173\u6765\u6e90\u3002";
    }

    return "No relevant supporting sources were retrieved.";
  }

  private buildFallbackGroundedAnswer(input: {
    question: string;
    language: GenerateAnswerInput["answerPolicy"]["language"];
    content: string;
  }) {
    const resolvedLanguage = this.resolveAnswerLanguage(input.question, input.language);
    if (resolvedLanguage === "zh") {
      return `根据检索到的来源 [1]，目前最相关的信息是：\n\n${input.content}`;
    }

    return `Based on the retrieved sources [1], the most relevant information is:\n\n${input.content}`;
  }

  private resolveAnswerLanguage(
    question: string,
    language: GenerateAnswerInput["answerPolicy"]["language"]
  ) {
    if (language === "zh" || language === "en") {
      return language;
    }

    const hasChinese = /[\u3400-\u9fff]/.test(question);
    return hasChinese ? "zh" : "en";
  }

  private async generateFallbackAnswerStream(
    input: GenerateAnswerStreamInput
  ): Promise<GenerateAnswerStreamOutput> {
    const result = this.generateFallbackAnswer(input);
    const streamAnswer =
      input.chunks.length === 0 && input.answerPolicy.noAnswerBehavior === "say_insufficient_context"
        ? this.buildStreamInsufficientContextAnswer(input.question, input.answerPolicy.language)
        : result.answer;
    await input.onDelta(streamAnswer);

    return {
      rawAnswer: streamAnswer,
      modelName: result.modelName,
      promptId: result.promptId,
      usedFallback: result.usedFallback,
      answerStatus: result.answerStatus,
      missingInformation: result.missingInformation,
      citedChunkNumbers: result.citedChunkNumbers,
      citationEvidence: result.citationEvidence
    };
  }

  private buildStreamInsufficientContextAnswer(
    question: string,
    language: GenerateAnswerInput["answerPolicy"]["language"]
  ) {
    const resolvedLanguage = this.resolveAnswerLanguage(question, language);
    if (resolvedLanguage === "zh") {
      return "\u6839\u636e\u5f53\u524d\u68c0\u7d22\u5230\u7684\u8d44\u6599\uff0c\u6211\u8fd8\u6ca1\u6709\u8db3\u591f\u4fe1\u606f\u6765\u53ef\u9760\u56de\u7b54\u8fd9\u4e2a\u95ee\u9898\u3002";
    }

    return "I don't have enough information in the retrieved sources to answer that reliably.";
  }

  private async emitVisibleAnswerDelta(input: {
    rawAnswer: string;
    emittedAnswer: string;
    onDelta: (delta: string) => void | Promise<void>;
  }) {
    const structuredAnswerPreview = this.extractStructuredAnswerPreview(input.rawAnswer);
    const visibleAnswer =
      structuredAnswerPreview ??
      (this.looksLikeStructuredPayload(input.rawAnswer) ? input.emittedAnswer : input.rawAnswer);
    const nextDelta = visibleAnswer.slice(input.emittedAnswer.length);
    if (nextDelta) {
      await input.onDelta(nextDelta);
      return visibleAnswer;
    }

    return input.emittedAnswer;
  }

  private extractCitedChunkNumbers(answer: string) {
    const matches = answer.matchAll(/\[(\d+)\]/g);
    const chunkNumbers: number[] = [];

    for (const match of matches) {
      const parsed = Number.parseInt(match[1] ?? "", 10);
      if (!Number.isNaN(parsed) && !chunkNumbers.includes(parsed)) {
        chunkNumbers.push(parsed);
      }
    }

    return chunkNumbers;
  }

  private rewriteQueryFallback(input: RewriteQueryInput): RewriteQueryOutput {
    const normalizedQuestion = input.question.replace(/\s+/g, " ").trim();
    const terms = normalizedQuestion
      .split(/[^a-z0-9\u4e00-\u9fa5_\-/.:]+/i)
      .map(term => term.trim())
      .filter(term => term.length > 1);
    const stopwords = new Set([
      "the",
      "a",
      "an",
      "is",
      "are",
      "what",
      "where",
      "when",
      "why",
      "how",
      "tell",
      "me",
      "about",
      "please",
      "does",
      "do",
      "did",
      "and",
      "or",
      "to",
      "of",
      "in",
      "on",
      "for",
      "with",
      "include"
    ]);

    const filteredTerms = terms.filter(term => {
      const normalized = term.toLowerCase();
      return !stopwords.has(normalized);
    });

    const uniqueTerms: string[] = [];
    for (const term of filteredTerms) {
      if (!uniqueTerms.some(item => item.toLowerCase() === term.toLowerCase())) {
        uniqueTerms.push(term);
      }
    }

    const rewrittenQuery = uniqueTerms.join(" ").trim() || normalizedQuestion;

    return {
      rewrittenQuery,
      modelName: "fallback-rewrite-local",
      usedFallback: true,
      promptId: this.promptManager.getRewritePromptId()
    };
  }

  private normalizeRewriteOutput(value: string | null | undefined) {
    return value?.replace(/^["'`\s]+|["'`\s]+$/g, "").replace(/\s+/g, " ").trim() ?? "";
  }

  private parseAnswerOutput(rawAnswer: string): Omit<GenerateAnswerOutput, "modelName" | "promptId" | "usedFallback"> {
    const parsed = this.tryParseStructuredAnswer(rawAnswer);
    if (parsed) {
      return parsed;
    }

    return {
      answer: rawAnswer,
      answerStatus: undefined,
      missingInformation: [],
      citedChunkNumbers: this.extractCitedChunkNumbers(rawAnswer),
      citationEvidence: []
    };
  }

  private tryParseStructuredAnswer(
    rawAnswer: string
  ): Omit<GenerateAnswerOutput, "modelName" | "promptId" | "usedFallback"> | null {
    const normalized = rawAnswer.trim();
    const candidates = [normalized];
    const fencedMatch = normalized.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fencedMatch?.[1]) {
      candidates.push(fencedMatch[1].trim());
    }

    const firstBrace = normalized.indexOf("{");
    const lastBrace = normalized.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      candidates.push(normalized.slice(firstBrace, lastBrace + 1));
    }

    for (const candidate of candidates) {
      try {
        const payload = structuredAnswerSchema.parse(JSON.parse(candidate));

        return {
          answer: payload.answer,
          answerStatus: payload.status,
          missingInformation: payload.missingInformation,
          citedChunkNumbers: payload.citations,
          citationEvidence: payload.citationEvidence
        };
      } catch {}
    }

    return null;
  }

  private extractStructuredAnswerPreview(rawAnswer: string) {
    const answerKeyMatch = /"answer"\s*:\s*"/.exec(rawAnswer);
    if (!answerKeyMatch) {
      return null;
    }

    let index = answerKeyMatch.index + answerKeyMatch[0].length;
    let result = "";

    while (index < rawAnswer.length) {
      const character = rawAnswer[index];

      if (character === "\\") {
        const escapedCharacter = rawAnswer[index + 1];
        if (!escapedCharacter) {
          break;
        }

        if (escapedCharacter === "u") {
          const unicodeValue = rawAnswer.slice(index + 2, index + 6);
          if (unicodeValue.length < 4 || !/^[0-9a-fA-F]{4}$/.test(unicodeValue)) {
            break;
          }

          result += String.fromCharCode(Number.parseInt(unicodeValue, 16));
          index += 6;
          continue;
        }

        result += this.decodeEscapedCharacter(escapedCharacter);
        index += 2;
        continue;
      }

      if (character === "\"") {
        return result;
      }

      result += character;
      index += 1;
    }

    return result;
  }

  private decodeEscapedCharacter(value: string) {
    switch (value) {
      case "n":
        return "\n";
      case "r":
        return "\r";
      case "t":
        return "\t";
      case "\"":
        return "\"";
      case "\\":
        return "\\";
      case "/":
        return "/";
      case "b":
        return "\b";
      case "f":
        return "\f";
      default:
        return value;
    }
  }

  private looksLikeStructuredPayload(rawAnswer: string) {
    const trimmedStart = rawAnswer.trimStart();
    return (
      trimmedStart.startsWith("{") ||
      trimmedStart.startsWith("```json") ||
      trimmedStart.startsWith('{"') ||
      /"answer"\s*:/.test(rawAnswer)
    );
  }

  private async readNdjsonStream(
    response: Response,
    onEvent: (payload: Record<string, unknown>) => void | Promise<void>
  ) {
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("Expected a readable stream body.");
    }

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      while (true) {
        const newlineIndex = buffer.indexOf("\n");
        if (newlineIndex < 0) {
          break;
        }

        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);

        if (!line) {
          continue;
        }

        await onEvent(JSON.parse(line));
      }
    }

    const trailing = buffer.trim();
    if (trailing) {
      await onEvent(JSON.parse(trailing));
    }
  }
}
