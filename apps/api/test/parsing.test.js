const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { Document, Packer, Paragraph, TextRun } = require("docx");
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
