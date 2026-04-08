import { Injectable } from "@nestjs/common";
import { GenerateAnswerInput, RewriteQueryInput } from "./llm.types";

type ManagedPrompt = {
  promptId: string;
  systemPrompt: string;
  userPrompt: string;
  fullPrompt: string;
};

@Injectable()
export class PromptManagerService {
  private readonly maxChunkContentLength = 1200;

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
    const isSummaryLike = /总结|概括|列举|哪些|维度|挑战|方面|类型|主要|分别|归纳/.test(input.question);
    const summaryRules = isSummaryLike
      ? `
- This is a summary/list-style question.
- If the retrieved evidence supports several parallel main themes, categories, dimensions, challenges, techniques, aspects, or application areas, list all of them explicitly.
- Do not omit supported points.
- Prefer coverage over aggressive brevity when several distinct themes are present.
`
      : "";

    const systemPrompt = `${input.systemPrompt}

Answering rules:
- Use only the provided retrieved sources.
- Answer directly when the sources support it; otherwise use "insufficient_context".
- Cite only the provided source indexes like [1] or [1][2].
- Keep the answer factual and follow the requested answer policy.${summaryRules}`;

    const context = input.chunks
      .map(
        (chunk, index) =>
          `[${index + 1}] document="${chunk.documentTitle}"${chunk.sectionTitle ? ` section="${chunk.sectionTitle}"` : ""} score=${chunk.score.toFixed(3)}\n${this.truncateChunkContent(chunk.content)}`
      )
      .join("\n\n");

    const userPrompt = `Question:
${input.question}

Retrieved sources:
${context}

Answer policy:
- responseStyle=${input.answerPolicy.responseStyle}
- tone=${input.answerPolicy.tone}
- outputFormat=${input.answerPolicy.outputFormat}
- language=${input.answerPolicy.language}
- citationMode=${input.answerPolicy.citationMode}
- maxCitations=${input.answerPolicy.maxCitations}
- noAnswerBehavior=${input.answerPolicy.noAnswerBehavior}
- includeMissingInformation=${input.answerPolicy.includeMissingInformation}

Return JSON only with this shape:
{"answer":"string","status":"grounded|insufficient_context","citations":[1],"missingInformation":["string"]}

Rules:
- "citations" must contain only 1-based source indexes from the retrieved sources.
- Use "grounded" only when the answer is supported by the provided sources.
- Use "insufficient_context" when the sources do not support a reliable answer.
- "missingInformation" should be an array and may be empty.
- Match the requested responseStyle, tone, outputFormat, and language policy.
- If outputFormat=bullets, prefer a short bullet list.
- If outputFormat=markdown, use concise markdown structure without code fences unless needed.
- If language=same_as_question, answer in the same language as the question.
- If language=zh or language=en, answer in that language.
- If includeMissingInformation=false, return an empty "missingInformation" array unless the answer is insufficient_context.
- Do not wrap the JSON in markdown fences.`;

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
          `[${index + 1}] document="${chunk.documentTitle}"${chunk.sectionTitle ? ` section="${chunk.sectionTitle}"` : ""}
${this.truncateChunkContent(chunk.content)}`
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

    const userPrompt = `Question:
${input.question}

Retrieved sources:
${context}

Task:
- Identify the parallel main items that should appear in the final answer.
- Keep only main items.
- Do not explain them.
- Do not include unsupported items.`;

    return {
      promptId: this.getSummaryMainItemsPromptId(),
      systemPrompt,
      userPrompt,
      fullPrompt: `${systemPrompt}\n\n${userPrompt}`
    };
  }

  private truncateChunkContent(content: string) {
    const normalized = content.replace(/\s+/g, " ").trim();
    if (normalized.length <= this.maxChunkContentLength) {
      return normalized;
    }

    return `${normalized.slice(0, this.maxChunkContentLength)}...`;
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
}
