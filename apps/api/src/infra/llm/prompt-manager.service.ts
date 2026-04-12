import { Injectable } from "@nestjs/common";
import { GenerateAnswerInput, JudgeRerankInput, RewriteQueryInput } from "./llm.types";

type ManagedPrompt = {
  promptId: string;
  systemPrompt: string;
  userPrompt: string;
  fullPrompt: string;
};

@Injectable()
export class PromptManagerService {
  private readonly maxChunkContentLength = 1200;
  private readonly maxSummaryChunkContentLength = 420;
  private readonly maxCompactSummaryChunkContentLength = 260;

  getAnswerPromptId() {
    return "answer.v3";
  }

  getRewritePromptId() {
    return "rewrite-query.v1";
  }

  getSummaryMainItemsPromptId() {
    return "summary-main-items.v1";
  }

  buildAnswerPrompt(input: GenerateAnswerInput): ManagedPrompt {
    const isSummaryLike = this.isSummaryLikeQuestion(input.question);
    const compactSummaryContext = isSummaryLike && input.chunks.length > 5;
    const compactAnswerContext = input.chunks.length > 0;
    const summaryRules = isSummaryLike
      ? `
- Summary/list question: cover all supported peer items.`
      : "";

    const systemPrompt = `${input.systemPrompt}

Rules:
- Use only the provided sources.
- Answer directly when the provided sources support a brief factual answer.
- If the sources support part of the answer, give the supported answer first and mention the limitation briefly.
- Use "insufficient_context" only when the sources do not support even a brief factual answer.
- Cite only source indexes like [1] or [1][2].
- Stay factual and follow the answer policy.${summaryRules}`;

    const context = input.chunks
      .map(
        (chunk, index) =>
          compactAnswerContext
            ? `[${index + 1}]${chunk.sectionTitle ? ` s="${this.compactLabel(chunk.sectionTitle, 48)}"` : ""}${chunk.documentTitle ? ` d="${this.compactLabel(chunk.documentTitle, 36)}"` : ""}\n${this.truncateChunkContent(chunk.content, isSummaryLike, compactSummaryContext)}`
            : `[${index + 1}] d="${this.compactLabel(chunk.documentTitle, 48)}"${chunk.sectionTitle ? ` s="${this.compactLabel(chunk.sectionTitle, 64)}"` : ""}\n${this.truncateChunkContent(chunk.content, isSummaryLike, compactSummaryContext)}`
      )
      .join("\n\n");

    const userPrompt = `Q:
${input.question}

Sources:
${context}

Policy:
- style=${input.answerPolicy.responseStyle}
- tone=${input.answerPolicy.tone}
- format=${input.answerPolicy.outputFormat}
- language=${input.answerPolicy.language}
- citations=${input.answerPolicy.citationMode}
- maxCitations=${input.answerPolicy.maxCitations}
- noAnswer=${input.answerPolicy.noAnswerBehavior}
- includeMissingInformation=${input.answerPolicy.includeMissingInformation}

Return JSON only:
{"answer":"string","status":"grounded|insufficient_context","citations":[1],"missingInformation":["string"]}

Rules:
- citations are 1-based source indexes only.
- use grounded when the sources support a brief factual answer.
- use insufficient_context only when the sources do not support even a brief factual answer.
- keep missingInformation as an array.
- match the requested policy.
- do not wrap JSON in fences.`;

    return {
      promptId: this.getAnswerPromptId(),
      systemPrompt,
      userPrompt,
      fullPrompt: `${systemPrompt}\n\n${userPrompt}`
    };
  }

  buildSummaryMainItemsPrompt(input: {
    question: string;
    chunks: GenerateAnswerInput["chunks"];
  }): ManagedPrompt {
    const context = input.chunks
      .map(
        (chunk, index) =>
          `[${index + 1}]${chunk.sectionTitle ? ` s="${this.compactLabel(chunk.sectionTitle, 48)}"` : ""}${chunk.documentTitle ? ` d="${this.compactLabel(chunk.documentTitle, 36)}"` : ""}
${this.truncateChunkContent(chunk.content, true, true)}`
      )
      .join("\n\n");

    const systemPrompt = `Extract only the parallel main items needed to answer a summary/list-style question.

Rules:
- Return JSON only.
- Use this exact shape: {"mainItems":["string"]}.
- Extract only peer main items explicitly supported by the retrieved sources.
- Do not include subpoints, examples, timelines, background sections, or explanations.
- If the evidence supports three peer main items, include all three.
- If no reliable peer main items are supported, return {"mainItems":[]}.`;

    const userPrompt = `Q:
${input.question}

Sources:
${context}

Task:
- identify the parallel main items for the final answer
- keep only main items
- do not explain them
- do not include unsupported items`;

    return {
      promptId: this.getSummaryMainItemsPromptId(),
      systemPrompt,
      userPrompt,
      fullPrompt: `${systemPrompt}\n\n${userPrompt}`
    };
  }

  buildRewritePrompt(input: RewriteQueryInput): ManagedPrompt {
    const systemPrompt = `Rewrite the following user question into a concise retrieval query.

Rules:
- Preserve important entities, product names, filenames, and identifiers.
- Remove filler words and conversational phrasing.
- Return only the rewritten query with no explanation.`;

    const userPrompt = `Question:
${input.question}`;

    return {
      promptId: this.getRewritePromptId(),
      systemPrompt,
      userPrompt,
      fullPrompt: `${systemPrompt}\n\n${userPrompt}`
    };
  }

  buildJudgeRerankPrompt(input: JudgeRerankInput): ManagedPrompt {
    const context = input.candidates
      .map(
        (candidate, index) =>
          `[${index + 1}] chunkId="${candidate.chunkId}" document="${candidate.documentTitle}"${candidate.sectionTitle ? ` section="${candidate.sectionTitle}"` : ""} score=${candidate.score.toFixed(3)}\n${this.truncateChunkContent(candidate.content, true)}`
      )
      .join("\n\n");

    const systemPrompt = `Rank the retrieved candidates for the question using only the provided snippets.

Rules:
- Return JSON only.
- Use this exact shape: {"ranking":["chunkId1","chunkId2"]}.
- Order the chunkIds from most relevant to least relevant.
- Include only chunkIds from the provided candidate list.
- Prefer the candidates that best answer the question directly.`;

    const userPrompt = `Question:
${input.question}

Candidates:
${context}`;

    return {
      promptId: `${this.getRewritePromptId()}:judge`,
      systemPrompt,
      userPrompt,
      fullPrompt: `${systemPrompt}\n\n${userPrompt}`
    };
  }

  private truncateChunkContent(content: string, summaryLike = false, compactSummary = false) {
    const normalized = content.replace(/\s+/g, " ").trim();
    const limit = summaryLike
      ? compactSummary
        ? this.maxCompactSummaryChunkContentLength
        : this.maxSummaryChunkContentLength
      : this.maxChunkContentLength;
    if (normalized.length <= limit) {
      return normalized;
    }

    return `${normalized.slice(0, limit)}...`;
  }

  private compactLabel(value: string, limit: number) {
    const normalized = value.replace(/\s+/g, " ").trim();
    if (normalized.length <= limit) {
      return normalized;
    }

    return `${normalized.slice(0, limit - 1)}...`;
  }

  private isSummaryLikeQuestion(question: string) {
    return /summary|summarize|list|compare|categories|themes|steps|differences|鎬荤粨|姒傛嫭|鍒楀嚭|姣旇緝|鍖哄埆|瑕佺偣|鍝簺|鏂归潰|缁村害/i
      .test(question);
  }
}
