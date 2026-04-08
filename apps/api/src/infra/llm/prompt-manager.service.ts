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
    return "answer.v2";
  }

  getRewritePromptId() {
    return "rewrite-query.v1";
  }

  buildAnswerPrompt(input: GenerateAnswerInput): ManagedPrompt {
    const systemPrompt = `${input.systemPrompt}

Answering rules:
- Use only the provided retrieved sources.
- Answer directly when the sources support it; otherwise use "insufficient_context".
- Cite only the provided source indexes like [1] or [1][2].
- Keep the answer factual and follow the requested answer policy.`;

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
