import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import {
  createIdleController,
  validateExecutionBackend,
  parseJsonEnv,
  resolveExecutionBackend,
  splitShellWords
} from '../adapters/execution-adapters.mjs';
import {
  inferRecoveryRootCause,
  buildRecoveryNextSteps
} from '../core/recovery-utils.mjs';

test('spawn hook contract can track a child lifecycle', async () => {
  let spawned = null;
  let exited = null;

  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [
      '-e',
      'setTimeout(() => process.exit(0), 10)'
    ]);
    spawned = child;
    child.on('close', (code, signal) => {
      exited = { child, code, signal };
      resolve();
    });
    child.on('error', reject);
  });

  assert.ok(spawned);
  assert.equal(exited.child, spawned);
  assert.equal(exited.code, 0);
});

test('resolveExecutionBackend defaults to opencode', () => {
  assert.equal(resolveExecutionBackend({}), 'opencode');
});

test('resolveExecutionBackend accepts codex', () => {
  assert.equal(
    resolveExecutionBackend({ LOOP_EXECUTOR_BACKEND: 'codex' }),
    'codex'
  );
});

test('validateExecutionBackend allows opencode without extra checks', async () => {
  const result = await validateExecutionBackend({
    LOOP_EXECUTOR_BACKEND: 'opencode'
  });
  assert.equal(result.ok, true);
  assert.equal(result.backend, 'opencode');
});

test('validateExecutionBackend allows codex cli mode without sdk package', async () => {
  const result = await validateExecutionBackend({
    LOOP_EXECUTOR_BACKEND: 'codex',
    CODEX_LOOP_MODE: 'cli'
  });
  assert.equal(result.ok, true);
  assert.equal(result.backend, 'codex');
});

test('createIdleController fires after a silent period', async () => {
  let fired = false;
  const idleController = createIdleController({
    idleTimeoutMs: 20,
    onIdle: () => {
      fired = true;
    }
  });

  idleController.reset();
  await new Promise((resolve) => setTimeout(resolve, 50));
  idleController.clear();

  assert.equal(fired, true);
});

test('inferRecoveryRootCause prefers pnpm failure markers', () => {
  const cause = inferRecoveryRootCause({
    result: { timedOut: false, idleTimedOut: false, reportedError: null },
    queueResult: null,
    failureMarkers: ['pnpm_command_failure'],
    changedFiles: []
  });

  assert.equal(cause, 'pnpm_dependency_or_script_failure');
});

test('buildRecoveryNextSteps includes diff guidance for changed files', () => {
  const steps = buildRecoveryNextSteps({
    rootCause: 'changes_present_without_clean_completion',
    changedFiles: ['M apps/api/src/example.ts'],
    validationCommand: 'pnpm --filter @rag-system/api test:file',
    commitCreated: false,
    queueFileName: 'demo-wave.queue.json'
  });

  assert.ok(
    steps.some((step) =>
      step.command.includes('git diff -- apps/api/src/example.ts')
    )
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
