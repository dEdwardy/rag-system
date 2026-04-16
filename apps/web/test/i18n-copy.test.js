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
  assert.doesNotMatch(source, /\uFFFD/);
  assert.doesNotMatch(source, /default-kb|Default KB/);
});
