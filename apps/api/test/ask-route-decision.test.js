const assert = require('node:assert/strict');

const {
  resolveAskRouteDecision,
  resolveExplicitExternalSourceRoute,
  resolveExplicitExternalSourceRoutes,
  isPolicyQuestion
} = require('../src/modules/assistants/ask-route-decision.ts');

test('route helper keeps normal questions on the knowledge-base path', () => {
  assert.deepEqual(
    resolveAskRouteDecision(
      'What does the onboarding document say about retries?'
    ),
    {
      routeType: 'knowledge_base',
      routeReason: 'default_kb_ask'
    }
  );
});

test('route helper classifies policy questions as deterministic policy replies', () => {
  assert.equal(
    isPolicyQuestion(
      'What is the assistant citation policy when sources are missing?'
    ),
    true
  );
  assert.deepEqual(
    resolveAskRouteDecision(
      'What is the assistant citation policy when sources are missing?'
    ),
    {
      routeType: 'policy_reply',
      routeReason: 'policy_question'
    }
  );
});

test('route helper classifies explicit source urls before policy-like wording', () => {
  assert.deepEqual(
    resolveAskRouteDecision(
      'Check this source and tell me the citation policy: https://example.com/guide'
    ),
    {
      routeType: 'external_source',
      routeReason: 'explicit_source_url'
    }
  );
});

test('route helper resolves source kinds across web, feed, and sitemap boundaries', () => {
  const webSource = resolveExplicitExternalSourceRoute(
    'Read https://example.com/posts/launch-announcement'
  );
  assert.equal(webSource?.url, 'https://example.com/posts/launch-announcement');
  assert.equal(webSource?.sourceKind, 'web');

  const feedSource = resolveExplicitExternalSourceRoute(
    'Summarize the RSS feed https://example.com/rss.xml'
  );
  assert.equal(feedSource?.url, 'https://example.com/rss.xml');
  assert.equal(feedSource?.sourceKind, 'feed');

  const sitemapSource = resolveExplicitExternalSourceRoute(
    'Inspect sitemap https://example.com/sitemap.xml'
  );
  assert.equal(sitemapSource?.url, 'https://example.com/sitemap.xml');
  assert.equal(sitemapSource?.sourceKind, 'sitemap');
});

test('route helper deduplicates urls and marks plural explicit source routing', () => {
  const sources = resolveExplicitExternalSourceRoutes(
    'Compare [home](https://example.com) with https://example.com and https://example.com/feed.xml'
  );

  assert.equal(sources.length, 2);
  assert.deepEqual(
    sources.map((source) => ({
      url: source.url,
      sourceKind: source.sourceKind
    })),
    [
      { url: 'https://example.com', sourceKind: 'web' },
      { url: 'https://example.com/feed.xml', sourceKind: 'feed' }
    ]
  );
  assert.deepEqual(
    resolveAskRouteDecision(
      'Compare [home](https://example.com) with https://example.com and https://example.com/feed.xml'
    ),
    {
      routeType: 'external_source',
      routeReason: 'explicit_source_urls'
    }
  );
});
