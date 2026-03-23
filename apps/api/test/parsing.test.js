const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { Document, Packer, Paragraph, TextRun } = require("docx");
const { ParsingService } = require("../src/infra/parsing/parsing.service.ts");
const { FeedSourceService } = require("../src/infra/feed-source/feed-source.service.ts");
const { SitemapSourceService } = require("../src/infra/sitemap-source/sitemap-source.service.ts");
const { WebPageService } = require("../src/infra/web-page/web-page.service.ts");

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

test("FeedSourceService skips invalid entries and returns partial diagnostics", async () => {
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
        </item>
        <item>
          <title>Broken Entry</title>
        </item>
      </channel>
    </rss>`,
    {
      url: "https://example.com/feed.xml",
      maxItems: 2
    }
  );

  assert.equal(extracted.title, "Engineering Updates");
  assert.match(extracted.content, /Release A/);
  assert.doesNotMatch(extracted.content, /Broken Entry/);
  assert.deepEqual(extracted.diagnostics, {
    attemptedEntryCount: 2,
    succeededEntryCount: 1,
    failedEntryCount: 1,
    failedEntryRefs: ["Broken Entry"],
    failedEntries: [
      {
        ref: "Broken Entry",
        code: "ENTRY_CONTENT_EMPTY",
        message: "Feed entry is missing both summary and link.",
        retryable: false
      }
    ],
    failedEntriesTruncated: false,
    failedEntriesOmittedCount: 0,
    partial: true
  });
});

test("FeedSourceService still fails when all feed entries are invalid", async () => {
  const service = new FeedSourceService();

  assert.throws(
    () =>
      service.extractFromXml(
        `<?xml version="1.0" encoding="UTF-8"?>
        <rss version="2.0">
          <channel>
            <title>Engineering Updates</title>
            <item>
              <title>Broken Entry</title>
            </item>
          </channel>
        </rss>`,
        {
          url: "https://example.com/feed.xml",
          maxItems: 1
        }
      ),
    /all feed entries were invalid/i
  );
});

test("SitemapSourceService extracts ordered unique page URLs from sitemap XML", () => {
  const service = new SitemapSourceService(new WebPageService());
  const extracted = service.extractPageUrls(
    `<?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      <url><loc>https://example.com/guide/start</loc></url>
      <url><loc>https://example.com/guide/start</loc></url>
      <url><loc>https://example.com/guide/advanced</loc></url>
      <url><loc>mailto:test@example.com</loc></url>
    </urlset>`,
    {
      url: "https://example.com/sitemap.xml",
      maxPages: 2
    }
  );

  assert.deepEqual(extracted, [
    "https://example.com/guide/start",
    "https://example.com/guide/advanced"
  ]);
});

test("SitemapSourceService expands one-level sitemap index into bounded unique page URLs", async () => {
  const originalFetch = global.fetch;
  const service = new SitemapSourceService(new WebPageService());

  global.fetch = async url => {
    const normalizedUrl = String(url);

    if (normalizedUrl === "https://example.com/sitemap-index.xml") {
      return new Response(
        `<?xml version="1.0" encoding="UTF-8"?>
        <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
          <sitemap><loc>https://example.com/sitemaps/docs.xml</loc></sitemap>
          <sitemap><loc>https://example.com/sitemaps/blog.xml</loc></sitemap>
        </sitemapindex>`,
        {
          status: 200,
          headers: {
            "Content-Type": "application/xml; charset=utf-8"
          }
        }
      );
    }

    if (normalizedUrl === "https://example.com/sitemaps/docs.xml") {
      return new Response(
        `<?xml version="1.0" encoding="UTF-8"?>
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
          <url><loc>https://example.com/docs/start</loc></url>
          <url><loc>https://example.com/docs/shared</loc></url>
        </urlset>`,
        {
          status: 200,
          headers: {
            "Content-Type": "application/xml; charset=utf-8"
          }
        }
      );
    }

    if (normalizedUrl === "https://example.com/sitemaps/blog.xml") {
      return new Response(
        `<?xml version="1.0" encoding="UTF-8"?>
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
          <url><loc>https://example.com/docs/shared</loc></url>
          <url><loc>https://example.com/blog/post-a</loc></url>
        </urlset>`,
        {
          status: 200,
          headers: {
            "Content-Type": "application/xml; charset=utf-8"
          }
        }
      );
    }

    if (normalizedUrl === "https://example.com/docs/start") {
      return new Response(
        "<html><head><title>Docs Start</title></head><body><main><p>Marker alpha.</p></main></body></html>",
        {
          status: 200,
          headers: {
            "Content-Type": "text/html; charset=utf-8"
          }
        }
      );
    }

    if (normalizedUrl === "https://example.com/docs/shared") {
      return new Response(
        "<html><head><title>Docs Shared</title></head><body><main><p>Marker beta.</p></main></body></html>",
        {
          status: 200,
          headers: {
            "Content-Type": "text/html; charset=utf-8"
          }
        }
      );
    }

    if (normalizedUrl === "https://example.com/blog/post-a") {
      return new Response(
        "<html><head><title>Blog Post A</title></head><body><main><p>Marker gamma.</p></main></body></html>",
        {
          status: 200,
          headers: {
            "Content-Type": "text/html; charset=utf-8"
          }
        }
      );
    }

    throw new Error(`Unexpected fetch URL: ${normalizedUrl}`);
  };

  try {
    const extracted = await service.fetchSitemap({
      url: "https://example.com/sitemap-index.xml",
      maxPages: 2
    });

    assert.match(extracted.content, /https:\/\/example\.com\/docs\/start/);
    assert.match(extracted.content, /https:\/\/example\.com\/docs\/shared/);
    assert.doesNotMatch(extracted.content, /https:\/\/example\.com\/blog\/post-a/);
  } finally {
    global.fetch = originalFetch;
  }
});

test("SitemapSourceService tolerates partial sitemap page failures and returns structured diagnostics", async () => {
  const originalFetch = global.fetch;
  const service = new SitemapSourceService(new WebPageService());

  global.fetch = async url => {
    const normalizedUrl = String(url);

    if (normalizedUrl === "https://example.com/sitemap.xml") {
      return new Response(
        `<?xml version="1.0" encoding="UTF-8"?>
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
          <url><loc>https://example.com/pages/good</loc></url>
          <url><loc>https://example.com/pages/bad</loc></url>
        </urlset>`,
        {
          status: 200,
          headers: {
            "Content-Type": "application/xml; charset=utf-8"
          }
        }
      );
    }

    if (normalizedUrl === "https://example.com/pages/good") {
      return new Response(
        "<html><head><title>Good Page</title></head><body><main><p>Reachable marker.</p></main></body></html>",
        {
          status: 200,
          headers: {
            "Content-Type": "text/html; charset=utf-8"
          }
        }
      );
    }

    if (normalizedUrl === "https://example.com/pages/bad") {
      return new Response("%PDF-1.7", {
        status: 200,
        headers: {
          "Content-Type": "application/pdf"
        }
      });
    }

    throw new Error(`Unexpected fetch URL: ${normalizedUrl}`);
  };

  try {
    const extracted = await service.fetchSitemap({
      url: "https://example.com/sitemap.xml",
      maxPages: 5
    });

    assert.match(extracted.content, /https:\/\/example\.com\/pages\/good/);
    assert.doesNotMatch(extracted.content, /https:\/\/example\.com\/pages\/bad/);
    assert.deepEqual(extracted.diagnostics, {
      attemptedPageCount: 2,
      succeededPageCount: 1,
      failedPageCount: 1,
      failedPageUrls: ["https://example.com/pages/bad"],
      failedPages: [
        {
          url: "https://example.com/pages/bad",
          code: "UNSUPPORTED_CONTENT_TYPE",
          message: "Unsupported web page content type: application/pdf.",
          retryable: false
        }
      ],
      failedPagesTruncated: false,
      failedPagesOmittedCount: 0,
      partial: true
    });
  } finally {
    global.fetch = originalFetch;
  }
});

test("SitemapSourceService still fails when all sitemap pages fail", async () => {
  const originalFetch = global.fetch;
  const service = new SitemapSourceService(new WebPageService());

  global.fetch = async url => {
    const normalizedUrl = String(url);

    if (normalizedUrl === "https://example.com/sitemap.xml") {
      return new Response(
        `<?xml version="1.0" encoding="UTF-8"?>
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
          <url><loc>https://example.com/pages/bad-a</loc></url>
          <url><loc>https://example.com/pages/bad-b</loc></url>
        </urlset>`,
        {
          status: 200,
          headers: {
            "Content-Type": "application/xml; charset=utf-8"
          }
        }
      );
    }

    if (
      normalizedUrl === "https://example.com/pages/bad-a" ||
      normalizedUrl === "https://example.com/pages/bad-b"
    ) {
      return new Response("upstream exploded", {
        status: 502,
        headers: {
          "Content-Type": "text/plain; charset=utf-8"
        }
      });
    }

    throw new Error(`Unexpected fetch URL: ${normalizedUrl}`);
  };

  try {
    await assert.rejects(
      service.fetchSitemap({
        url: "https://example.com/sitemap.xml",
        maxPages: 5
      }),
      /all sitemap pages failed/i
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test("SitemapSourceService tolerates partial child sitemap failures for sitemap index", async () => {
  const originalFetch = global.fetch;
  const service = new SitemapSourceService(new WebPageService());

  global.fetch = async url => {
    const normalizedUrl = String(url);

    if (normalizedUrl === "https://example.com/sitemap-index.xml") {
      return new Response(
        `<?xml version="1.0" encoding="UTF-8"?>
        <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
          <sitemap><loc>https://example.com/sitemaps/good.xml</loc></sitemap>
          <sitemap><loc>https://example.com/sitemaps/bad.xml</loc></sitemap>
        </sitemapindex>`,
        {
          status: 200,
          headers: {
            "Content-Type": "application/xml; charset=utf-8"
          }
        }
      );
    }

    if (normalizedUrl === "https://example.com/sitemaps/good.xml") {
      return new Response(
        `<?xml version="1.0" encoding="UTF-8"?>
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
          <url><loc>https://example.com/pages/good</loc></url>
        </urlset>`,
        {
          status: 200,
          headers: {
            "Content-Type": "application/xml; charset=utf-8"
          }
        }
      );
    }

    if (normalizedUrl === "https://example.com/sitemaps/bad.xml") {
      return new Response("upstream exploded", {
        status: 502,
        headers: {
          "Content-Type": "text/plain; charset=utf-8"
        }
      });
    }

    if (normalizedUrl === "https://example.com/pages/good") {
      return new Response(
        "<html><head><title>Good Page</title></head><body><main><p>Child sitemap marker.</p></main></body></html>",
        {
          status: 200,
          headers: {
            "Content-Type": "text/html; charset=utf-8"
          }
        }
      );
    }

    throw new Error(`Unexpected fetch URL: ${normalizedUrl}`);
  };

  try {
    const extracted = await service.fetchSitemap({
      url: "https://example.com/sitemap-index.xml",
      maxPages: 5
    });

    assert.match(extracted.content, /https:\/\/example\.com\/pages\/good/);
    assert.deepEqual(extracted.diagnostics, {
      attemptedPageCount: 1,
      succeededPageCount: 1,
      failedPageCount: 0,
      failedPageUrls: [],
      failedPages: [],
      failedPagesTruncated: false,
      failedPagesOmittedCount: 0,
      partial: true,
      attemptedChildSitemapCount: 2,
      succeededChildSitemapCount: 1,
      failedChildSitemapCount: 1,
      failedChildSitemapUrls: ["https://example.com/sitemaps/bad.xml"],
      failedChildSitemaps: [
        {
          url: "https://example.com/sitemaps/bad.xml",
          code: "UPSTREAM_FETCH_FAILED",
          message: "Failed to fetch sitemap: upstream responded with 502.",
          retryable: true
        }
      ],
      failedChildSitemapsTruncated: false,
      failedChildSitemapsOmittedCount: 0
    });
  } finally {
    global.fetch = originalFetch;
  }
});

test("SitemapSourceService caps partial failure summaries and reports omitted counts", async () => {
  const originalFetch = global.fetch;
  const service = new SitemapSourceService(new WebPageService());

  global.fetch = async url => {
    const normalizedUrl = String(url);

    if (normalizedUrl === "https://example.com/sitemap.xml") {
      const entries = Array.from({ length: 12 }, (_, index) => {
        return `<url><loc>https://example.com/pages/fail-${index + 1}</loc></url>`;
      }).join("");

      return new Response(
        `<?xml version="1.0" encoding="UTF-8"?>
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries}<url><loc>https://example.com/pages/good</loc></url></urlset>`,
        {
          status: 200,
          headers: {
            "Content-Type": "application/xml; charset=utf-8"
          }
        }
      );
    }

    if (normalizedUrl === "https://example.com/pages/good") {
      return new Response(
        "<html><head><title>Good Page</title></head><body><main><p>Reachable marker.</p></main></body></html>",
        {
          status: 200,
          headers: {
            "Content-Type": "text/html; charset=utf-8"
          }
        }
      );
    }

    if (/https:\/\/example\.com\/pages\/fail-\d+/.test(normalizedUrl)) {
      return new Response("upstream exploded", {
        status: 502,
        headers: {
          "Content-Type": "text/plain; charset=utf-8"
        }
      });
    }

    throw new Error(`Unexpected fetch URL: ${normalizedUrl}`);
  };

  try {
    const extracted = await service.fetchSitemap({
      url: "https://example.com/sitemap.xml",
      maxPages: 20
    });

    assert.equal(extracted.diagnostics.failedPageCount, 12);
    assert.equal(extracted.diagnostics.failedPages.length, 10);
    assert.equal(extracted.diagnostics.failedPagesTruncated, true);
    assert.equal(extracted.diagnostics.failedPagesOmittedCount, 2);
  } finally {
    global.fetch = originalFetch;
  }
});

test("SitemapSourceService still fails when all child sitemaps fail", async () => {
  const originalFetch = global.fetch;
  const service = new SitemapSourceService(new WebPageService());

  global.fetch = async url => {
    const normalizedUrl = String(url);

    if (normalizedUrl === "https://example.com/sitemap-index.xml") {
      return new Response(
        `<?xml version="1.0" encoding="UTF-8"?>
        <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
          <sitemap><loc>https://example.com/sitemaps/bad-a.xml</loc></sitemap>
          <sitemap><loc>https://example.com/sitemaps/bad-b.xml</loc></sitemap>
        </sitemapindex>`,
        {
          status: 200,
          headers: {
            "Content-Type": "application/xml; charset=utf-8"
          }
        }
      );
    }

    if (
      normalizedUrl === "https://example.com/sitemaps/bad-a.xml" ||
      normalizedUrl === "https://example.com/sitemaps/bad-b.xml"
    ) {
      return new Response("upstream exploded", {
        status: 502,
        headers: {
          "Content-Type": "text/plain; charset=utf-8"
        }
      });
    }

    throw new Error(`Unexpected fetch URL: ${normalizedUrl}`);
  };

  try {
    await assert.rejects(
      service.fetchSitemap({
        url: "https://example.com/sitemap-index.xml",
        maxPages: 5
      }),
      /all child sitemap fetches failed/i
    );
  } finally {
    global.fetch = originalFetch;
  }
});
