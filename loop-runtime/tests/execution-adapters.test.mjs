import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseJsonEnv,
  resolveExecutionBackend,
  splitShellWords
} from '../adapters/execution-adapters.mjs';

test('resolveExecutionBackend defaults to opencode', () => {
  assert.equal(resolveExecutionBackend({}), 'opencode');
});

test('resolveExecutionBackend accepts codex', () => {
  assert.equal(
    resolveExecutionBackend({ LOOP_EXECUTOR_BACKEND: 'codex' }),
    'codex'
  );
});

test('parseJsonEnv returns fallback when input is empty or invalid', () => {
  assert.deepEqual(parseJsonEnv('', { a: 1 }), { a: 1 });
  assert.deepEqual(parseJsonEnv('not-json', { a: 1 }), { a: 1 });
});

test('parseJsonEnv parses valid json strings', () => {
  assert.deepEqual(parseJsonEnv('{"a":1,"b":"x"}', {}), { a: 1, b: 'x' });
});

test('splitShellWords preserves quoted segments', () => {
  assert.deepEqual(splitShellWords('--flag "two words" --name value'), [
    '--flag',
    'two words',
    '--name',
    'value'
  ]);
});
