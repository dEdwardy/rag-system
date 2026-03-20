const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { ParsingService } = require("../dist/infra/parsing/parsing.service.js");

test("ParsingService parses text-based PDFs", async () => {
  const service = new ParsingService();
  const fileBuffer = readFileSync(resolve(__dirname, "../../../scripts/sample.pdf"));

  const content = await service.parseDocument({
    sourceName: "sample.pdf",
    mimeType: "application/pdf",
    fileBuffer
  });

  assert.match(content, /Dummy PDF file/);
});
