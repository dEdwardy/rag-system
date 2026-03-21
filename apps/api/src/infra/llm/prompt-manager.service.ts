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
  buildAnswerPrompt(input: GenerateAnswerInput): ManagedPrompt {
    const systemPrompt = `${input.systemPrompt}

Answering rules:
- Use only the provided retrieved sources.
- When a statement is supported by a source, append source markers like [1] or [1][2].
- Do not cite sources that were not provided.
- If the retrieved sources are insufficient, say so clearly.
- Keep the answer concise and factual.`;

    const context = input.chunks
      .map(
        (chunk, index) =>
          `[${index + 1}] document="${chunk.documentTitle}"${chunk.sectionTitle ? ` section="${chunk.sectionTitle}"` : ""} score=${chunk.score.toFixed(3)}\n${chunk.content}`
      )
      .join("\n\n");

    const userPrompt = `Question:
${input.question}

Retrieved sources:
${context}

Answer policy:
- responseStyle=${input.answerPolicy.responseStyle}
- citationMode=${input.answerPolicy.citationMode}
- maxCitations=${input.answerPolicy.maxCitations}
- noAnswerBehavior=${input.answerPolicy.noAnswerBehavior}

Return JSON only with this shape:
{"answer":"string","status":"grounded|insufficient_context","citations":[1],"citationEvidence":[{"source":1,"quote":"exact text"}],"missingInformation":["string"]}

Rules:
- "citations" must contain only 1-based source indexes from the retrieved sources.
- "citationEvidence" must be an array of objects with "source" and "quote".
- Each "quote" must be copied verbatim from the cited retrieved source.
- Use an empty array when there are no supported citations.
- Use "grounded" only when the answer is supported by the provided sources.
- Use "insufficient_context" when the sources do not support a reliable answer.
- Use an empty "citationEvidence" array when no direct quote can be provided.
- "missingInformation" should be an array and may be empty.
- Do not wrap the JSON in markdown fences.`;

    return {
      promptId: "answer.v1",
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
      promptId: "rewrite-query.v1",
      systemPrompt,
      userPrompt,
      fullPrompt: `${systemPrompt}\n\n${userPrompt}`
    };
  }
}
