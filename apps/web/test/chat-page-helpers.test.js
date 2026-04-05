import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

const helperModuleUrl = pathToFileURL(
  resolve(__dirname, "../src/pages/chat/chat-page-helpers.ts")
).href;

async function loadChatPageHelpers() {
  return import(helperModuleUrl);
}

test("chat page helpers format conversation updated time for english locale", async () => {
  const { formatConversationUpdatedAt } = await loadChatPageHelpers();

  const result = formatConversationUpdatedAt("2026-03-21T09:30:00.000Z", "en");

  assert.match(result, /Mar/);
  assert.match(result, /21/);
});

test("chat page helpers format message time for english locale", async () => {
  const { formatMessageTime } = await loadChatPageHelpers();

  const result = formatMessageTime("2026-03-21T09:30:00.000Z", "en");

  assert.match(result, /:30/);
});

test("chat page helpers build citation context with page and section", async () => {
  const { buildCitationContext } = await loadChatPageHelpers();

  const result = buildCitationContext(
    {
      chunkId: "chunk-1",
      documentId: "document-1",
      documentTitle: "Spec",
      pageNo: 4,
      sectionTitle: "Streaming",
      snippet: "..."
    },
    {
      pageLabel: pageNo => `page ${pageNo}`
    }
  );

  assert.equal(result, "page 4 • Streaming");
});

test("chat page helpers omit empty citation context parts", async () => {
  const { buildCitationContext } = await loadChatPageHelpers();

  const result = buildCitationContext(
    {
      chunkId: "chunk-2",
      documentId: "document-1",
      documentTitle: "Spec",
      pageNo: null,
      sectionTitle: null,
      snippet: "..."
    },
    {
      pageLabel: pageNo => `page ${pageNo}`
    }
  );

  assert.equal(result, null);
});
