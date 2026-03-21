const test = require("node:test");
const assert = require("node:assert/strict");
const { resolve } = require("node:path");
const { pathToFileURL } = require("node:url");

const helperModuleUrl = pathToFileURL(
  resolve(__dirname, "../src/pages/assistant/assistant-config-form.ts")
).href;

async function loadAssistantConfigHelpers() {
  return import(helperModuleUrl);
}

test("assistant config defaults apply when answer policy is missing", async () => {
  const { createAssistantConfigFormValues } = await loadAssistantConfigHelpers();

  const values = createAssistantConfigFormValues(
    {
      id: "assistant-1",
      tenantId: "tenant-1",
      kbId: "kb-1",
      name: "Default Assistant",
      description: null,
      systemPrompt: "Answer carefully.",
      retrievalProfileId: "profile-1",
      answerPolicyJson: null,
      status: "active"
    },
    {
      id: "profile-1",
      name: "Default Retrieval Profile",
      topK: 4,
      chunkWindow: 1,
      enableHybrid: true,
      enableRerank: false,
      scoreThreshold: 12,
      filtersJson: {
        documentIds: {
          include: ["doc-a", "doc-b"]
        },
        sectionTitles: {
          contains: ["spec", "faq"]
        }
      },
      strategyJson: null,
      createdAt: "2026-03-21T00:00:00.000Z",
      updatedAt: "2026-03-21T00:00:00.000Z"
    }
  );

  assert.equal(values.responseStyle, "concise");
  assert.equal(values.tone, "neutral");
  assert.equal(values.outputFormat, "paragraph");
  assert.equal(values.language, "auto");
  assert.equal(values.citationMode, "required");
  assert.equal(values.maxCitations, 3);
  assert.equal(values.noAnswerBehavior, "say_insufficient_context");
  assert.equal(values.includeMissingInformation, true);
  assert.equal(values.documentIdsInclude, "doc-a\ndoc-b");
  assert.equal(values.sectionTitlesContains, "spec\nfaq");
});

test("assistant config payload builder normalizes answer policy and retrieval filters", async () => {
  const { buildAssistantUpdatePayload, buildRetrievalProfileUpdatePayload } =
    await loadAssistantConfigHelpers();

  const assistantPayload = buildAssistantUpdatePayload({
    name: "Research Assistant",
    description: "",
    systemPrompt: "Use sources.",
    status: "inactive",
    topK: 5,
    chunkWindow: 1,
    enableHybrid: false,
    enableRerank: true,
    scoreThreshold: 0,
    responseStyle: "balanced",
    tone: "direct",
    outputFormat: "bullets",
    language: "zh",
    citationMode: "optional",
    maxCitations: 5,
    noAnswerBehavior: "best_effort",
    includeMissingInformation: false,
    documentIdsInclude: "",
    documentIdsExclude: "",
    sectionTitlesInclude: "",
    sectionTitlesExclude: "",
    sectionTitlesContains: "",
    pageNumbersInclude: "",
    pageNumbersExclude: "",
    pageNumbersMin: null,
    pageNumbersMax: null
  });

  assert.deepEqual(assistantPayload, {
    name: "Research Assistant",
    description: null,
    systemPrompt: "Use sources.",
    status: "inactive",
    answerPolicyJson: {
      responseStyle: "balanced",
      tone: "direct",
      outputFormat: "bullets",
      language: "zh",
      citationMode: "optional",
      maxCitations: 5,
      noAnswerBehavior: "best_effort",
      includeMissingInformation: false
    }
  });

  const retrievalPayload = buildRetrievalProfileUpdatePayload({
    name: "Research Assistant",
    description: "",
    systemPrompt: "Use sources.",
    status: "inactive",
    topK: 5,
    chunkWindow: 1,
    enableHybrid: false,
    enableRerank: true,
    scoreThreshold: 0,
    responseStyle: "balanced",
    tone: "direct",
    outputFormat: "bullets",
    language: "zh",
    citationMode: "optional",
    maxCitations: 5,
    noAnswerBehavior: "best_effort",
    includeMissingInformation: false,
    documentIdsInclude: "doc-1, doc-2\ndoc-1",
    documentIdsExclude: "doc-9",
    sectionTitlesInclude: "",
    sectionTitlesExclude: "drafts",
    sectionTitlesContains: "spec\nappendix",
    pageNumbersInclude: "1, 2, 2",
    pageNumbersExclude: "9",
    pageNumbersMin: 3,
    pageNumbersMax: 7
  });

  assert.deepEqual(retrievalPayload, {
    topK: 5,
    chunkWindow: 1,
    enableHybrid: false,
    enableRerank: true,
    scoreThreshold: 0,
    filtersJson: {
      documentIds: {
        include: ["doc-1", "doc-2"],
        exclude: ["doc-9"]
      },
      sectionTitles: {
        exclude: ["drafts"],
        contains: ["spec", "appendix"]
      },
      pageNumbers: {
        include: [1, 2],
        exclude: [9],
        min: 3,
        max: 7
      }
    }
  });
});

test("assistant config retrieval payload clears filters when all filter fields are empty", async () => {
  const { buildRetrievalProfileUpdatePayload } = await loadAssistantConfigHelpers();

  const retrievalPayload = buildRetrievalProfileUpdatePayload({
    name: "Assistant",
    description: null,
    systemPrompt: "Use sources.",
    status: "active",
    topK: 3,
    chunkWindow: 0,
    enableHybrid: false,
    enableRerank: false,
    scoreThreshold: 0,
    responseStyle: "concise",
    tone: "neutral",
    outputFormat: "paragraph",
    language: "auto",
    citationMode: "required",
    maxCitations: 3,
    noAnswerBehavior: "say_insufficient_context",
    includeMissingInformation: true,
    documentIdsInclude: "",
    documentIdsExclude: "",
    sectionTitlesInclude: "",
    sectionTitlesExclude: "",
    sectionTitlesContains: "",
    pageNumbersInclude: "",
    pageNumbersExclude: "",
    pageNumbersMin: null,
    pageNumbersMax: null
  });

  assert.deepEqual(retrievalPayload, {
    topK: 3,
    chunkWindow: 0,
    enableHybrid: false,
    enableRerank: false,
    scoreThreshold: 0,
    filtersJson: null
  });
});
