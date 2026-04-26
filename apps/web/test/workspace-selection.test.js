import { test } from 'vitest';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

const helperModuleUrl = pathToFileURL(
  resolve(__dirname, '../src/features/api/workspace-selection.ts')
).href;

async function loadWorkspaceSelectionHelpers() {
  return import(helperModuleUrl);
}

test('workspace selection prefers the canonical default knowledge base as the primary workspace', async () => {
  const { getPrimaryKnowledgeBase } = await loadWorkspaceSelectionHelpers();

  const knowledgeBase = getPrimaryKnowledgeBase([
    { id: 'kb-2', name: 'Secondary KB', status: 'active' },
    { id: 'kb-1', name: 'Default Knowledge Base', status: 'inactive' }
  ]);

  assert.equal(knowledgeBase?.id, 'kb-1');
});

test('workspace selection prefers the active canonical default knowledge base when duplicate-looking defaults exist', async () => {
  const { getPrimaryKnowledgeBase } = await loadWorkspaceSelectionHelpers();

  const knowledgeBase = getPrimaryKnowledgeBase([
    {
      id: 'kb-z-empty',
      name: 'Default Knowledge Base',
      status: 'inactive'
    },
    {
      id: 'kb-a-filled',
      name: ' default knowledge base ',
      status: 'active'
    }
  ]);

  assert.equal(knowledgeBase?.id, 'kb-a-filled');
});

test('workspace selection aligns the active assistant to the primary knowledge base', async () => {
  const { getPrimaryAssistantForKnowledgeBase } =
    await loadWorkspaceSelectionHelpers();

  const assistant = getPrimaryAssistantForKnowledgeBase(
    [
      { id: 'assistant-1', kbId: 'kb-2', name: 'Other KB assistant' },
      { id: 'assistant-2', kbId: 'kb-1', name: 'Primary KB assistant' }
    ],
    'kb-1'
  );

  assert.equal(assistant?.id, 'assistant-2');
});

test('workspace selection prefers the default assistant when multiple assistants point at the same knowledge base', async () => {
  const { getPrimaryAssistantForKnowledgeBase } =
    await loadWorkspaceSelectionHelpers();

  const assistant = getPrimaryAssistantForKnowledgeBase(
    [
      {
        id: 'assistant-1',
        kbId: 'kb-1',
        name: 'Research Assistant',
        status: 'active'
      },
      {
        id: 'assistant-2',
        kbId: 'kb-1',
        name: 'Default Assistant',
        status: 'active'
      }
    ],
    'kb-1'
  );

  assert.equal(assistant?.id, 'assistant-2');
});

test('workspace selection still prefers the canonical default assistant for the same knowledge base', async () => {
  const { getPrimaryAssistantForKnowledgeBase } =
    await loadWorkspaceSelectionHelpers();

  const assistant = getPrimaryAssistantForKnowledgeBase(
    [
      {
        id: 'assistant-1',
        kbId: 'kb-1',
        name: 'Default Assistant',
        status: 'inactive'
      },
      {
        id: 'assistant-2',
        kbId: 'kb-1',
        name: 'Fallback Assistant',
        status: 'active'
      }
    ],
    'kb-1'
  );

  assert.equal(assistant?.id, 'assistant-1');
});

test('workspace selection deterministically keeps one canonical default assistant first when duplicate defaults exist for the same knowledge base', async () => {
  const { getPrimaryAssistantForKnowledgeBase } =
    await loadWorkspaceSelectionHelpers();

  const assistant = getPrimaryAssistantForKnowledgeBase(
    [
      {
        id: 'assistant-default-z',
        kbId: 'kb-1',
        name: 'Default Assistant',
        status: 'active'
      },
      {
        id: 'assistant-default-a',
        kbId: 'kb-1',
        name: 'Default Assistant',
        status: 'active'
      }
    ],
    'kb-1'
  );

  assert.equal(assistant?.id, 'assistant-default-a');
});

test('workspace selection treats canonical default assistant naming drift as default for the same knowledge base', async () => {
  const { getPrimaryAssistantForKnowledgeBase } =
    await loadWorkspaceSelectionHelpers();

  const assistant = getPrimaryAssistantForKnowledgeBase(
    [
      {
        id: 'assistant-secondary',
        kbId: 'kb-1',
        name: 'Research Assistant',
        status: 'active'
      },
      {
        id: 'assistant-default-name-drift',
        kbId: 'kb-1',
        name: ' default assistant ',
        status: 'inactive'
      }
    ],
    'kb-1'
  );

  assert.equal(assistant?.id, 'assistant-default-name-drift');
});

test('workspace selection treats canonical default assistant casing drift as default for the same knowledge base', async () => {
  const { getPrimaryAssistantForKnowledgeBase } =
    await loadWorkspaceSelectionHelpers();

  const assistant = getPrimaryAssistantForKnowledgeBase(
    [
      {
        id: 'assistant-secondary',
        kbId: 'kb-1',
        name: 'Research Assistant',
        status: 'active'
      },
      {
        id: 'assistant-default-casing-drift',
        kbId: 'kb-1',
        name: 'DEFAULT assistant',
        status: 'inactive'
      }
    ],
    'kb-1'
  );

  assert.equal(assistant?.id, 'assistant-default-casing-drift');
});

test('workspace selection treats canonical default assistant internal-whitespace drift as default for the same knowledge base', async () => {
  const { getPrimaryAssistantForKnowledgeBase } =
    await loadWorkspaceSelectionHelpers();

  const assistant = getPrimaryAssistantForKnowledgeBase(
    [
      {
        id: 'assistant-secondary',
        kbId: 'kb-1',
        name: 'Research Assistant',
        status: 'active'
      },
      {
        id: 'assistant-default-internal-whitespace-drift',
        kbId: 'kb-1',
        name: 'Default   Assistant',
        status: 'inactive'
      }
    ],
    'kb-1'
  );

  assert.equal(assistant?.id, 'assistant-default-internal-whitespace-drift');
});

test('workspace selection does not silently fall back to an assistant from another knowledge base', async () => {
  const { getPrimaryAssistantForKnowledgeBase } =
    await loadWorkspaceSelectionHelpers();

  const assistant = getPrimaryAssistantForKnowledgeBase(
    [{ id: 'assistant-1', kbId: 'kb-2', name: 'Other KB assistant' }],
    'kb-1'
  );

  assert.equal(assistant, null);
});
