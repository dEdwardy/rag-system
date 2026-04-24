import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const repoOpencodeConfig = path.join(repoRoot, 'opencode.jsonc');

const codexThreadCache = new Map();

export function resolveExecutionBackend(env = process.env) {
  const backend = (env.LOOP_EXECUTOR_BACKEND ?? 'opencode')
    .trim()
    .toLowerCase();
  if (backend === 'codex') {
    return 'codex';
  }

  return 'opencode';
}

export async function runExecutionPrompt({
  backend,
  prompt,
  title,
  sessionId,
  cwd,
  env,
  timeoutMs,
  opencodeEnv,
  codexEnv
}) {
  if (backend === 'codex') {
    return await runCodexPrompt({
      prompt,
      title,
      sessionId,
      cwd,
      env,
      timeoutMs,
      codexEnv
    });
  }

  return await runOpenCodePrompt({
    prompt,
    title,
    sessionId,
    cwd,
    env,
    timeoutMs,
    opencodeEnv
  });
}

async function runOpenCodePrompt({
  prompt,
  title,
  sessionId,
  cwd,
  env,
  timeoutMs,
  opencodeEnv
}) {
  const args = sessionId
    ? [
        'run',
        '--continue',
        '--session',
        sessionId,
        '--agent',
        'build',
        '--model',
        'my/gpt-5.4',
        '--format',
        'json',
        '--title',
        title,
        prompt
      ]
    : [
        'run',
        '--agent',
        'build',
        '--model',
        'my/gpt-5.4',
        '--format',
        'json',
        '--title',
        title,
        prompt
      ];

  return await spawnPrompt({
    command: 'opencode',
    args,
    cwd,
    env,
    timeoutMs,
    injectEnv: {
      OPENCODE_CONFIG: repoOpencodeConfig,
      ...opencodeEnv
    }
  });
}

async function runCodexPrompt({
  prompt,
  title,
  sessionId,
  cwd,
  env,
  timeoutMs,
  codexEnv
}) {
  const useSdk =
    (codexEnv.CODEX_LOOP_MODE ?? 'sdk').trim().toLowerCase() !== 'cli';
  if (useSdk) {
    const sdkResult = await runCodexSdkPrompt({
      prompt,
      title,
      sessionId,
      codexEnv
    });
    if (sdkResult) {
      return sdkResult;
    }
  }

  return await runCodexCliPrompt({
    prompt,
    title,
    sessionId,
    cwd,
    env,
    timeoutMs,
    codexEnv
  });
}

async function runCodexSdkPrompt({ prompt, title, sessionId, codexEnv }) {
  let Codex;
  try {
    ({ Codex } = await import('@openai/codex-sdk'));
  } catch (error) {
    if ((codexEnv.CODEX_LOOP_MODE ?? 'sdk').trim().toLowerCase() !== 'cli') {
      return null;
    }
    return null;
  }

  const agent = new Codex(
    parseJsonEnv(codexEnv.CODEX_SDK_OPTIONS, {
      model: 'gpt-5.4-mini'
    })
  );
  const thread = sessionId
    ? (codexThreadCache.get(sessionId) ?? agent.resumeThread(sessionId))
    : agent.startThread();
  const result = await runWithTimeout(
    thread.run(prompt),
    codexEnv.CODEX_SDK_TIMEOUT_MS
  );
  const threadId =
    sessionId ??
    result?.threadId ??
    result?.threadID ??
    result?.thread?.id ??
    randomUUID();
  if (!codexThreadCache.has(threadId)) {
    codexThreadCache.set(threadId, thread);
  }
  return normalizeCodexResult({
    result,
    sessionId: threadId,
    title,
    thread
  });
}

async function runCodexCliPrompt({
  prompt,
  title,
  sessionId,
  cwd,
  env,
  timeoutMs,
  codexEnv
}) {
  const command =
    codexEnv.CODEX_LOOP_COMMAND?.trim() ||
    (process.platform === 'win32' ? 'cmd.exe' : 'codex');
  const baseArgs = (codexEnv.CODEX_LOOP_ARGS ?? '').trim()
    ? splitShellWords(codexEnv.CODEX_LOOP_ARGS)
    : [];
  const args =
    process.platform === 'win32'
      ? [
          '/c',
          'codex.cmd',
          'exec',
          ...baseArgs,
          '--json',
          '--full-auto',
          '--cd',
          cwd,
          prompt
        ]
      : ['exec', ...baseArgs, '--json', '--full-auto', '--cd', cwd, prompt];

  if (sessionId) {
    args.splice(1, 0, 'resume', sessionId);
  }

  return await spawnPrompt({
    command,
    args,
    cwd,
    env,
    timeoutMs,
    injectEnv: codexEnv
  });
}

function normalizeCodexResult({ result, sessionId, title }) {
  const structured = typeof result === 'string' ? { message: result } : result;
  return {
    exitCode: 0,
    signal: null,
    stdout: `${JSON.stringify({
      title,
      sessionID: sessionId,
      result: structured
    })}\n`,
    stderr: '',
    timedOut: false,
    sessionId,
    reportedError: null
  };
}

async function runWithTimeout(promise, timeoutMsValue) {
  const timeoutMs = Number(timeoutMsValue);
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return await promise;
  }

  let timeoutHandle;
  return await Promise.race([
    promise.finally(() => {
      if (timeoutHandle) clearTimeout(timeoutHandle);
    }),
    new Promise((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(new Error(`codex_sdk_timeout_${timeoutMs}`));
      }, timeoutMs);
      timeoutHandle.unref();
    })
  ]);
}

async function spawnPrompt({ command, args, cwd, env, timeoutMs, injectEnv }) {
  const mergedEnv = { ...env, ...injectEnv };
  return await new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      env: mergedEnv,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const timeoutHandle =
      Number.isFinite(timeoutMs) && timeoutMs > 0
        ? setTimeout(() => {
            timedOut = true;
            try {
              child.kill('SIGTERM');
            } catch {
              // ignore
            }
          }, timeoutMs)
        : null;
    timeoutHandle?.unref();

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('close', (exitCode, signal) => {
      if (timeoutHandle) clearTimeout(timeoutHandle);
      resolve({ exitCode: exitCode ?? 1, signal, stdout, stderr, timedOut });
    });
    child.on('error', (error) => {
      if (timeoutHandle) clearTimeout(timeoutHandle);
      resolve({
        exitCode: 1,
        signal: null,
        stdout,
        stderr: `${stderr}${stderr ? '\n' : ''}${error.message}\n`,
        timedOut
      });
    });
  });
}

export function parseJsonEnv(rawValue, fallback) {
  if (!rawValue) return fallback;
  try {
    return JSON.parse(rawValue);
  } catch {
    return fallback;
  }
}

export function splitShellWords(value) {
  return (
    value
      .match(/(?:[^\s"]+|"[^"]*")+/g)
      ?.map((item) => item.replace(/^"|"$/g, '')) ?? []
  );
}
