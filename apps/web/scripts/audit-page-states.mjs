#!/usr/bin/env node
/**
 * Static audit for the web app's page routes.
 *
 * Reports, for every page component, whether it renders a loading, an empty and
 * an error branch, and checks that every in-app link target exists in the
 * router. Static only: it proves the branches exist, not that they are
 * reachable at runtime.
 *
 * Usage: node apps/web/scripts/audit-page-states.mjs
 * Exit code is 1 when a page is missing a state it should have, so the check can
 * be wired into CI later.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const srcRoot = resolve(scriptDir, '..', 'src');

// Pages that have nothing to be empty, so an empty branch is not expected.
const PAGES_WITHOUT_EMPTY_STATE = new Set(['LoginPage.tsx', 'InviteGatePage.tsx']);

const STATE_PATTERNS = {
  loading: /isLoading|isPending|isFetching|Skeleton|TypingIndicator|加载中|loading/i,
  empty: /length === 0|StatePanel|empty|Empty|no-\w+|没有|暂无|noConversations|noDocuments/i,
  error: /isError|error\b|Error|失败|无法加载|retry|重试/i
};

function collectPageFiles(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      collectPageFiles(path, out);
    } else if (entry.name.endsWith('Page.tsx')) {
      out.push(path);
    }
  }
  return out;
}

const pageFiles = collectPageFiles(srcRoot).sort();
const findings = [];

console.log('page'.padEnd(28) + 'loading empty error  lines');

for (const file of pageFiles) {
  const source = readFileSync(file, 'utf8');
  const page = file.split(/[/\\]/).pop();
  const states = {
    loading: STATE_PATTERNS.loading.test(source),
    empty: STATE_PATTERNS.empty.test(source),
    error: STATE_PATTERNS.error.test(source)
  };
  const expectsEmpty = !PAGES_WITHOUT_EMPTY_STATE.has(page);
  const missing = [
    !states.loading && 'loading',
    expectsEmpty && !states.empty && 'empty',
    !states.error && 'error'
  ].filter(Boolean);

  console.log(
    page.padEnd(28) +
      String(states.loading).padEnd(8) +
      String(states.empty).padEnd(6) +
      String(states.error).padEnd(6) +
      source.split('\n').length
  );

  if (missing.length > 0) {
    findings.push(`${page} missing: ${missing.join(', ')}`);
  }
}

const routerSource = readFileSync(join(srcRoot, 'app', 'router.tsx'), 'utf8');
const knownSegments = new Set(
  [...routerSource.matchAll(/path:\s*'([^']+)'/g)].map(
    (match) => match[1].split('/').filter(Boolean)[0] ?? ''
  )
);

const deadLinks = [];
for (const file of collectPageFiles(srcRoot)) {
  const source = readFileSync(file, 'utf8');
  for (const match of source.matchAll(/\bto=["']([^"'{$]+)["']/g)) {
    const target = match[1].trim();
    if (target === '/' || target === '') {
      continue;
    }
    const segment = target.split('/').filter(Boolean)[0];
    if (!knownSegments.has(segment)) {
      deadLinks.push(`${file.replace(srcRoot + '/', '')} -> ${target}`);
    }
  }
}

console.log('');
if (deadLinks.length > 0) {
  console.log(`dead links: ${deadLinks.length}`);
  for (const link of deadLinks) {
    console.log('   ' + link);
  }
} else {
  console.log('dead links: 0');
}

if (findings.length > 0) {
  console.log(`\nmissing states: ${findings.length}`);
  for (const finding of findings) {
    console.log('   ' + finding);
  }
  process.exit(1);
}

console.log('\nall pages expose the expected state branches');
