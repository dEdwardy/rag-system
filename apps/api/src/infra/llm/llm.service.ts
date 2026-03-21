import { Injectable, Logger } from "@nestjs/common";
import {
  GenerateAnswerInput,
  GenerateAnswerOutput,
  RewriteQueryInput,
  RewriteQueryOutput
} from "./llm.types";
import { PromptManagerService } from "./prompt-manager.service";
import { structuredAnswerSchema } from "./structured-answer.schema";

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);

  constructor(private readonly promptManager: PromptManagerService) {}

  async generateAnswer(input: GenerateAnswerInput): Promise<GenerateAnswerOutput> {
    const ollamaBaseUrl = process.env.OLLAMA_BASE_URL;
    const ollamaModel = process.env.OLLAMA_MODEL;

    if (ollamaBaseUrl && ollamaModel) {
      try {
        return await this.generateOllamaAnswer(ollamaBaseUrl, ollamaModel, input);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown Ollama error.";
        this.logger.warn(`Falling back after Ollama error: ${message}`);
      }
    }

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return this.generateFallbackAnswer(input);
    }

    try {
      return await this.generateOpenAIAnswer(apiKey, input);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown LLM error.";
      this.logger.warn(`Falling back to local answer generation: ${message}`);
      return this.generateFallbackAnswer(input);
    }
  }

  async rewriteQuery(input: RewriteQueryInput): Promise<RewriteQueryOutput> {
    const ollamaBaseUrl = process.env.OLLAMA_BASE_URL;
    const ollamaModel = process.env.OLLAMA_MODEL;

    if (ollamaBaseUrl && ollamaModel) {
      try {
        return await this.rewriteQueryWithOllama(ollamaBaseUrl, ollamaModel, input);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown Ollama error.";
        this.logger.warn(`Falling back after Ollama rewrite error: ${message}`);
      }
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      try {
        return await this.rewriteQueryWithOpenAI(apiKey, input);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown LLM error.";
        this.logger.warn(`Falling back to local query rewrite: ${message}`);
      }
    }

    return this.rewriteQueryFallback(input);
  }

  private async generateOllamaAnswer(
    baseUrl: string,
    model: string,
    input: GenerateAnswerInput
  ): Promise<GenerateAnswerOutput> {
    const prompt = this.promptManager.buildAnswerPrompt(input);

    const response = await fetch(`${baseUrl}/api/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        prompt: prompt.fullPrompt,
        stream: false,
        options: {
          temperature: 0.2
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
      modelName: `ollama:${model}`,
      ...this.parseAnswerOutput(answer)
    };
  }

  private async generateOpenAIAnswer(
    apiKey: string,
    input: GenerateAnswerInput
  ): Promise<GenerateAnswerOutput> {
    const model = process.env.OPENAI_CHAT_MODEL ?? "gpt-4.1-mini";
    const prompt = this.promptManager.buildAnswerPrompt(input);

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
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
      modelName: model,
      ...this.parseAnswerOutput(answer)
    };
  }

  private async rewriteQueryWithOllama(
    baseUrl: string,
    model: string,
    input: RewriteQueryInput
  ): Promise<RewriteQueryOutput> {
    const prompt = this.promptManager.buildRewritePrompt(input);
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        prompt: prompt.fullPrompt,
        stream: false,
        options: {
          temperature: 0
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
      modelName: `ollama:${model}`,
      usedFallback: false
    };
  }

  private async rewriteQueryWithOpenAI(apiKey: string, input: RewriteQueryInput): Promise<RewriteQueryOutput> {
    const model = process.env.OPENAI_CHAT_MODEL ?? "gpt-4.1-mini";
    const prompt = this.promptManager.buildRewritePrompt(input);

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        temperature: 0,
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
      modelName: model,
      usedFallback: false
    };
  }

  private generateFallbackAnswer(input: GenerateAnswerInput): GenerateAnswerOutput {
    if (input.chunks.length === 0) {
      return {
        answer: "I couldn't find relevant information in the knowledge base.",
        modelName: "fallback-local",
        answerStatus: "insufficient_context",
        missingInformation: ["No relevant supporting sources were retrieved."]
      };
    }

    const topChunk = input.chunks[0];
    const answer = `Based on the retrieved sources [1], the most relevant information is:\n\n${topChunk.content}`;

    return {
      answer,
      modelName: "fallback-local",
      answerStatus: "grounded",
      missingInformation: [],
      citedChunkNumbers: [1]
    };
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
      usedFallback: true
    };
  }

  private normalizeRewriteOutput(value: string | null | undefined) {
    return value?.replace(/^["'`\s]+|["'`\s]+$/g, "").replace(/\s+/g, " ").trim() ?? "";
  }

  private parseAnswerOutput(rawAnswer: string): Omit<GenerateAnswerOutput, "modelName"> {
    const parsed = this.tryParseStructuredAnswer(rawAnswer);
    if (parsed) {
      return parsed;
    }

    return {
      answer: rawAnswer,
      answerStatus: undefined,
      missingInformation: [],
      citedChunkNumbers: this.extractCitedChunkNumbers(rawAnswer)
    };
  }

  private tryParseStructuredAnswer(rawAnswer: string): Omit<GenerateAnswerOutput, "modelName"> | null {
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
          citedChunkNumbers: payload.citations
        };
      } catch {}
    }

    return null;
  }
}
