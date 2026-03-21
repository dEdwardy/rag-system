const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { Document, Packer, Paragraph, TextRun } = require("docx");
const { ParsingService } = require("../dist/infra/parsing/parsing.service.js");
const { FeedSourceService } = require("../dist/infra/feed-source/feed-source.service.js");
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

test("FeedSourceService extracts normalized title and entry text from RSS", async () => {
  const service = new FeedSourceService();
  const extracted = service.extractFromXml(
    `<?xml version="1.0" encoding="UTF-8"?>
    <rss version="2.0">
      <channel>
        <title>Engineering Updates</title>
        <description>Recent delivery notes.</description>
        <item>
          <title>Release A</title>
          <link>https://example.com/releases/a</link>
          <description><![CDATA[<p>Marker alpha summary.</p>]]></description>
          <pubDate>Sun, 21 Mar 2026 10:00:00 GMT</pubDate>
        </item>
        <item>
          <title>Release B</title>
          <description>Marker beta summary.</description>
        </item>
      </channel>
    </rss>`,
    {
      url: "https://example.com/feed.xml",
      maxItems: 1
    }
  );

  assert.equal(extracted.title, "Engineering Updates");
  assert.match(extracted.content, /Feed: Engineering Updates/);
  assert.match(extracted.content, /Recent delivery notes\./);
  assert.match(extracted.content, /Release A/);
  assert.match(extracted.content, /Marker alpha summary\./);
  assert.match(extracted.content, /https:\/\/example\.com\/releases\/a/);
  assert.doesNotMatch(extracted.content, /Release B/);
});
