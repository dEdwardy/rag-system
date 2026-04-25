import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import {
  buildCodexBaseArgs,
  buildCodexCliInvocation,
  createIdleController,
  extractExecutionSessionId,
  hasCodexConfigArg,
  hasCodexModelArg,
  validateExecutionBackend,
  parseJsonEnv,
  resolveExecutionBackend,
  splitShellWords
} from '../adapters/execution-adapters.mjs';
import {
  inferRecoveryRootCause,
  buildRecoveryNextSteps
} from '../core/recovery-utils.mjs';
import {
  buildBackendEnv,
  EXECUTION_BACKENDS,
  LOOP_ENV_KEYS
} from '../core/backend-config.mjs';

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
  assert.equal(resolveExecutionBackend({}), EXECUTION_BACKENDS.opencode);
});

test('resolveExecutionBackend accepts codex', () => {
  assert.equal(
    resolveExecutionBackend({
      [LOOP_ENV_KEYS.executorBackend]: EXECUTION_BACKENDS.codex
    }),
    EXECUTION_BACKENDS.codex
  );
});

test('validateExecutionBackend allows opencode without extra checks', async () => {
  const result = await validateExecutionBackend({
    [LOOP_ENV_KEYS.executorBackend]: EXECUTION_BACKENDS.opencode
  });
  assert.equal(result.ok, true);
  assert.equal(result.backend, EXECUTION_BACKENDS.opencode);
});

test('validateExecutionBackend checks codex command availability', async () => {
  const result = await validateExecutionBackend({
    [LOOP_ENV_KEYS.executorBackend]: EXECUTION_BACKENDS.codex,
    CODEX_LOOP_COMMAND: process.execPath
  });
  assert.equal(result.ok, true);
  assert.equal(result.backend, EXECUTION_BACKENDS.codex);
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

test('buildCodexCliInvocation keeps resume after exec on windows', () => {
  const invocation = buildCodexCliInvocation({
    prompt: 'Return one queue result line.',
    sessionId: 'thread-123',
    cwd: 'D:\\FeProjects\\rag-system',
    codexEnv: {
      args: '--model gpt-5.4'
    },
    platform: 'win32'
  });

  assert.equal(invocation.command, 'cmd.exe');
  assert.deepEqual(invocation.args, [
    '/c',
    'codex.cmd',
    'exec',
    '-c',
    'model_reasoning_effort=low',
    '--model',
    'gpt-5.4',
    'resume',
    'thread-123',
    '--json',
    '--full-auto',
    '--cd',
    'D:\\FeProjects\\rag-system',
    'Return one queue result line.'
  ]);
});

test('buildCodexCliInvocation uses custom codex command directly on windows', () => {
  const invocation = buildCodexCliInvocation({
    prompt: 'Return one queue result line.',
    cwd: 'D:\\FeProjects\\rag-system',
    codexEnv: {
      command: 'C:\\tools\\codex.exe',
      args: '--model gpt-5.4'
    },
    platform: 'win32'
  });

  assert.equal(invocation.command, 'C:\\tools\\codex.exe');
  assert.deepEqual(invocation.args, [
    'exec',
    '-c',
    'model_reasoning_effort=low',
    '--model',
    'gpt-5.4',
    '--json',
    '--full-auto',
    '--cd',
    'D:\\FeProjects\\rag-system',
    'Return one queue result line.'
  ]);
});

test('buildCodexBaseArgs supplies a stable default model for loop runs', () => {
  assert.deepEqual(buildCodexBaseArgs({}), [
    '-c',
    'model_reasoning_effort=low',
    '--model',
    'gpt-5.5'
  ]);
  assert.deepEqual(buildCodexBaseArgs({ model: 'gpt-5.2' }), [
    '-c',
    'model_reasoning_effort=low',
    '--model',
    'gpt-5.2'
  ]);
  assert.deepEqual(buildCodexBaseArgs({ args: '--model gpt-5.4-mini' }), [
    '-c',
    'model_reasoning_effort=low',
    '--model',
    'gpt-5.4-mini'
  ]);
});

test('buildCodexBaseArgs lets explicit reasoning effort override fast default', () => {
  assert.deepEqual(
    buildCodexBaseArgs({ args: '-c model_reasoning_effort=medium' }),
    ['-c', 'model_reasoning_effort=medium', '--model', 'gpt-5.5']
  );
});

test('buildBackendEnv normalizes shared and backend-specific model env', () => {
  assert.deepEqual(
    buildBackendEnv(
      {
        [LOOP_ENV_KEYS.executorModel]: 'gpt-shared',
        CODEX_LOOP_MODEL: 'gpt-codex',
        CODEX_LOOP_ARGS: '--sandbox workspace-write'
      },
      EXECUTION_BACKENDS.codex
    ),
    {
      command: '',
      args: '--sandbox workspace-write',
      model: 'gpt-codex'
    }
  );
});

test('hasCodexModelArg recognizes supported codex model forms', () => {
  assert.equal(hasCodexModelArg(['--model', 'gpt-5.4']), true);
  assert.equal(hasCodexModelArg(['-m', 'gpt-5.4']), true);
  assert.equal(hasCodexModelArg(['--model=gpt-5.4']), true);
  assert.equal(hasCodexModelArg(['--sandbox', 'workspace-write']), false);
});

test('hasCodexConfigArg recognizes config overrides', () => {
  assert.equal(
    hasCodexConfigArg(
      ['-c', 'model_reasoning_effort=low'],
      'model_reasoning_effort'
    ),
    true
  );
  assert.equal(
    hasCodexConfigArg(
      ['--config=model_reasoning_effort=medium'],
      'model_reasoning_effort'
    ),
    true
  );
  assert.equal(
    hasCodexConfigArg(['--model', 'gpt-5.5'], 'model_reasoning_effort'),
    false
  );
});

test('extractExecutionSessionId reads opencode and codex JSONL ids', () => {
  assert.equal(
    extractExecutionSessionId(
      '{"type":"thread.started","thread_id":"thread-1"}\n'
    ),
    'thread-1'
  );
  assert.equal(
    extractExecutionSessionId('{"sessionID":"session-1"}\n'),
    'session-1'
  );
});
