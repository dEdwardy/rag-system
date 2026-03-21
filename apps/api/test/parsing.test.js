const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { Document, Packer, Paragraph, TextRun } = require("docx");
const { ParsingService } = require("../dist/infra/parsing/parsing.service.js");
const { WebPageService } = require("../dist/infra/web-page/web-page.service.js");

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

test("ParsingService parses DOCX documents into plain text", async () => {
  const service = new ParsingService();
  const document = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            children: [new TextRun("DOCX Sample Title")]
          }),
          new Paragraph({
            children: [new TextRun("This DOCX fixture should be parsed into plain text.")]
          }),
          new Paragraph({
            children: [new TextRun("Second paragraph for ingestion.")]
          })
        ]
      }
    ]
  });
  const fileBuffer = Buffer.from(await Packer.toBuffer(document));

  const content = await service.parseDocument({
    sourceName: "sample.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    fileBuffer
  });

  assert.match(content, /DOCX Sample Title/);
  assert.match(content, /This DOCX fixture should be parsed into plain text\./);
  assert.match(content, /Second paragraph for ingestion\./);
});

test("WebPageService extracts normalized title and text from HTML", async () => {
  const service = new WebPageService();
  const extracted = service.extractFromHtml(
    `<!doctype html>
    <html>
      <head>
        <title>Example Title</title>
        <style>.hidden { display: none; }</style>
        <script>console.log("ignore");</script>
      </head>
      <body>
        <main>
          <h1>Heading</h1>
          <p>First paragraph with marker.</p>
          <p>Second &amp; final paragraph.</p>
        </main>
      </body>
    </html>`
  );

  assert.equal(extracted.title, "Example Title");
  assert.match(extracted.content, /Heading/);
  assert.match(extracted.content, /First paragraph with marker\./);
  assert.match(extracted.content, /Second & final paragraph\./);
  assert.doesNotMatch(extracted.content, /console\.log/);
});
