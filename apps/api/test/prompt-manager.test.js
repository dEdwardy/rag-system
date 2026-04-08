const assert = require("node:assert/strict");
const { PromptManagerService } = require("../src/infra/llm/prompt-manager.service.ts");

test("PromptManagerService builds versioned answer prompts", () => {
  const service = new PromptManagerService();
  const prompt = service.buildAnswerPrompt({
    systemPrompt: "assistant system prompt",
    question: "Where is the answer?",
    answerPolicy: {
      responseStyle: "balanced",
      tone: "friendly",
      outputFormat: "bullets",
      language: "same_as_question",
      citationMode: "required",
      maxCitations: 2,
      noAnswerBehavior: "say_insufficient_context",
      includeMissingInformation: false
    },
    chunks: [
      {
        chunkId: "chunk-1",
        documentId: "doc-1",
        documentTitle: "Doc 1",
        content: "Chunk content",
        score: 0.9,
        pageNo: 3,
        sectionTitle: "Facts"
      }
    ]
  });

  assert.equal(prompt.promptId, "answer.v2");
  assert.match(prompt.systemPrompt, /assistant system prompt/);
  assert.match(prompt.userPrompt, /responseStyle=balanced/);
  assert.match(prompt.userPrompt, /tone=friendly/);
  assert.match(prompt.userPrompt, /outputFormat=bullets/);
  assert.match(prompt.userPrompt, /language=same_as_question/);
  assert.match(prompt.userPrompt, /includeMissingInformation=false/);
  assert.match(prompt.userPrompt, /Retrieved sources:/);
  assert.match(prompt.fullPrompt, /Return JSON only/);
  assert.doesNotMatch(prompt.fullPrompt, /citationEvidence/);
  assert.match(prompt.fullPrompt, /"citations":\[1\]/);
  assert.match(prompt.fullPrompt, /"missingInformation":\["string"\]/);
});

test("PromptManagerService truncates long retrieved source content in answer prompts", () => {
  const service = new PromptManagerService();
  const longContent = "A".repeat(1400);
  const prompt = service.buildAnswerPrompt({
    systemPrompt: "assistant system prompt",
    question: "Where is the answer?",
    answerPolicy: {
      responseStyle: "balanced",
      tone: "friendly",
      outputFormat: "bullets",
      language: "same_as_question",
      citationMode: "required",
      maxCitations: 2,
      noAnswerBehavior: "say_insufficient_context",
      includeMissingInformation: false
    },
    chunks: [
      {
        chunkId: "chunk-1",
        documentId: "doc-1",
        documentTitle: "Doc 1",
        content: longContent,
        score: 0.9,
        pageNo: 3,
        sectionTitle: "Facts"
      }
    ]
  });

  assert.ok(prompt.userPrompt.includes(`${"A".repeat(1200)}...`));
  assert.ok(!prompt.userPrompt.includes("A".repeat(1300)));
});

test("PromptManagerService builds versioned rewrite prompts", () => {
  const service = new PromptManagerService();
  const prompt = service.buildRewritePrompt({
    question: "Please tell me about product ABC in short"
  });

  assert.equal(prompt.promptId, "rewrite-query.v1");
  assert.match(prompt.fullPrompt, /Rewrite the following user question into a concise retrieval query/);
  assert.match(prompt.userPrompt, /Please tell me about product ABC in short/);
});
