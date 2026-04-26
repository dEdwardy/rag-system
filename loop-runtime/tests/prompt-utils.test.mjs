import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildContinuationPrompt,
  buildExecutionPrompt,
  buildFinalizerPrompt
} from '../core/prompt-utils.mjs';

test('buildExecutionPrompt omits commit instruction for no-commit handshake items', () => {
  const prompt = buildExecutionPrompt(
    {
      id: 'codex-smoke-cli-handshake',
      promptText:
        'Do not modify any files. Do not run git commit. Return exactly one machine-readable line.',
      verification: {
        commands: ['node -e "console.log(\'codex smoke validation ok\')"']
      },
      dependsOn: []
    },
    'codex-smoke-wave.queue.json'
  );

  assert.match(prompt, /- Do not create a commit for this item\./);
  assert.doesNotMatch(
    prompt,
    /- If validation passes, commit the change on the current branch and do not push\./
  );
});

test('buildExecutionPrompt keeps commit instruction for normal change items', () => {
  const prompt = buildExecutionPrompt(
    {
      id: 'normal-item',
      promptText: 'Update the implementation and finish with a queue result.',
      verification: {
        commands: ['pnpm test:api:file -- test/example.test.js']
      },
      dependsOn: ['dep-a']
    },
    'demo-wave.queue.json'
  );

  assert.match(
    prompt,
    /Upstream dependencies that must already be satisfied: dep-a\./
  );
  assert.match(
    prompt,
    /- If validation passes, commit the change on the current branch and do not push\./
  );
});

test('buildContinuationPrompt and buildFinalizerPrompt keep queue result contract', () => {
  const item = {
    id: 'item-a',
    promptText: 'Finish the item.',
    verification: {
      commands: ['pnpm check:encoding']
    }
  };

  assert.match(
    buildContinuationPrompt(item, 'demo-wave.queue.json'),
    /QUEUE_RESULT status=<completed\|needs_replan> item=item-a validation=pnpm check:encoding changed_files=<comma-separated-or-none> commit=<hash-or-none>/
  );
  assert.match(
    buildFinalizerPrompt(item, 'demo-wave.queue.json'),
    /Do not make additional code changes, do not create another commit, and do not rerun validation unless the prior run clearly failed\./
  );
});
