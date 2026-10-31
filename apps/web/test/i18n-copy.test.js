import { test } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

const englishMessagesPath = resolve(__dirname, '../src/i18n/messages.en.ts');
const chineseMessagesPath = resolve(__dirname, '../src/i18n/messages.zh.ts');

test('split locale catalogs keep current English workspace navigation and assistant copy', () => {
  const source = readFileSync(englishMessagesPath, 'utf8');

  assert.match(
    source,
    /subtitle:\s*'Personal RAG workspace, built on a reusable core'/
  );
  assert.match(source, /documents:\s*'Library'/);
  assert.match(source, /knowledgeBase:\s*'Workspace settings'/);
  assert.match(source, /assistant:\s*'Assistant'/);
  assert.match(source, /currentKnowledgeBase:\s*'Current workspace library'/);
  assert.match(
    source,
    /noAssistantForKnowledgeBaseTitle:\s*'Default assistant is still being prepared'/
  );
  assert.match(source, /preparing or repairing the default assistant/);
  assert.match(
    source,
    /being prepared or repaired for the current workspace library/
  );
  assert.match(
    source,
    /Chat already becomes available as soon as this library has ready source material/
  );
  assert.match(
    source,
    /If the library is still empty, add the first library items first\./
  );
  assert.match(source, /Refresh default path" and wait for it to show up/);
  assert.match(source, /starterPromptHint:\s*'Click one to send it now/);
  assert.doesNotMatch(source, /default-kb|Default KB/);
});

test('split locale catalogs keep current Chinese workspace labels without replacement glyphs', () => {
  const source = readFileSync(chineseMessagesPath, 'utf8');

  assert.match(source, /title:\s*'RAG/);
  assert.match(source, /documents:\s*'[\u4e00-\u9fff]+/);
  assert.match(source, /knowledgeBase:\s*'[\u4e00-\u9fff]+/);
  assert.match(source, /assistant:\s*'[\u4e00-\u9fff]+/);
  assert.match(source, /noDescription:\s*'[\u4e00-\u9fff]+/);
  assert.match(source, /当前资料库的默认助手仍在补建或修复中/);
  assert.match(source, /只要这个资料库已经有可提问资料，对话就会开放/);
  assert.match(source, /如果资料库还是空的，请先添加第一批资料。/);
  assert.match(source, /请先点击“刷新默认路径”，再等它/);
  assert.match(source, /点任意首问会立即发送，后续可以在对话里继续细化。/);
  assert.doesNotMatch(source, /\uFFFD/);
  assert.doesNotMatch(source, /default-kb|Default KB/);
});

// Guards the direction that users actually feel: a key present in English but
// missing in Chinese renders English text inside a Chinese UI. The reverse
// direction (Chinese keys absent from English) is tracked separately.
test('every English catalog key also exists in the Chinese catalog', () => {
  const englishKeys = collectCatalogKeys(readFileSync(englishMessagesPath, 'utf8'));
  const chineseKeys = collectCatalogKeys(readFileSync(chineseMessagesPath, 'utf8'));
  const missingInChinese = [...englishKeys].filter((key) => !chineseKeys.has(key));

  assert.deepEqual(missingInChinese, [], 'English keys missing from messages.zh.ts');
});

test('neither catalog contains placeholder-only values', () => {
  for (const path of [englishMessagesPath, chineseMessagesPath]) {
    const source = readFileSync(path, 'utf8');
    const placeholderValues = [...source.matchAll(/^\s+\w+:\s*'(\?+)'\s*,?$/gm)].map(
      (match) => match[1]
    );

    assert.deepEqual(placeholderValues, [], `${path} contains ?-only values`);
  }
});

function collectCatalogKeys(source) {
  const keys = new Set();
  const stack = [];

  for (const rawLine of source.split('\n')) {
    const line = rawLine.trim();
    const opening = line.match(/^(\w+):\s*\{$/);
    if (opening) {
      stack.push(opening[1]);
      continue;
    }

    if (line === '}' || line === '},' || line === '} as const;') {
      stack.pop();
      continue;
    }

    const leaf = line.match(/^(\w+):\s*['"`]/) ?? line.match(/^(\w+):$/);
    if (leaf) {
      keys.add([...stack, leaf[1]].join('.'));
    }
  }

  return keys;
}