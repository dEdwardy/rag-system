const test = require("node:test");
const assert = require("node:assert/strict");
const { resolve } = require("node:path");
const { pathToFileURL } = require("node:url");

const helperModuleUrl = pathToFileURL(
  resolve(__dirname, "../src/pages/documents/documents-page-helpers.ts")
).href;

async function loadDocumentsHelpers() {
  return import(helperModuleUrl);
}

test("documents helpers validate source entry URL - empty", async () => {
  const { validateSourceEntryUrl } = await loadDocumentsHelpers();

  const t = (key) => {
    if (key === "documents.sourceEntryInlineErrorRequired") return "Enter a URL";
    return "";
  };

  const result = validateSourceEntryUrl("", t);
  assert.equal(result.normalizedUrl, "");
  assert.equal(result.error, "Enter a URL");
});

test("documents helpers validate source entry URL - valid http", async () => {
  const { validateSourceEntryUrl } = await loadDocumentsHelpers();

  const t = () => "";

  const result = validateSourceEntryUrl("https://example.com/page", t);
  assert.equal(result.normalizedUrl, "https://example.com/page");
  assert.equal(result.error, null);
});

test("documents helpers validate source entry URL - valid http with spaces trimmed", async () => {
  const { validateSourceEntryUrl } = await loadDocumentsHelpers();

  const t = () => "";

  const result = validateSourceEntryUrl("  http://example.com  ", t);
  assert.equal(result.normalizedUrl, "http://example.com");
  assert.equal(result.error, null);
});

test("documents helpers validate source entry URL - invalid protocol", async () => {
  const { validateSourceEntryUrl } = await loadDocumentsHelpers();

  const t = (key) => {
    if (key === "documents.sourceEntryInlineErrorInvalidHttpUrl") return "Invalid http(s) URL";
    return "";
  };

  const result = validateSourceEntryUrl("ftp://example.com", t);
  assert.equal(result.normalizedUrl, "ftp://example.com");
  assert.equal(result.error, "Invalid http(s) URL");
});

test("documents helpers validate source entry URL - malformed URL", async () => {
  const { validateSourceEntryUrl } = await loadDocumentsHelpers();

  const t = (key) => {
    if (key === "documents.sourceEntryInlineErrorInvalidHttpUrl") return "Invalid http(s) URL";
    return "";
  };

  const result = validateSourceEntryUrl("not-a-url", t);
  assert.equal(result.normalizedUrl, "not-a-url");
  assert.equal(result.error, "Invalid http(s) URL");
});