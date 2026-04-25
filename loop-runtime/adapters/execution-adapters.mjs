import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const repoOpencodeConfig = path.join(repoRoot, 'opencode.jsonc');

export async function validateExecutionBackend(env = process.env) {
  const backend = resolveExecutionBackend(env);
  return { ok: true, backend };
}

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
  codexEnv,
  onSpawn,
  onExit,
  idleTimeoutMs
}) {
  if (backend === 'codex') {
    return await runCodexPrompt({
      prompt,
      title,
      sessionId,
      cwd,
      env,
      timeoutMs,
      codexEnv,
      onSpawn,
      onExit,
      idleTimeoutMs
    });
  }

  return await runOpenCodePrompt({
    prompt,
    title,
    sessionId,
    cwd,
    env,
    timeoutMs,
    opencodeEnv,
    onSpawn,
    onExit,
    idleTimeoutMs
  });
}

export function createIdleController({ idleTimeoutMs, onIdle }) {
  let idleTimeoutHandle = null;

  function clear() {
    if (idleTimeoutHandle) {
      clearTimeout(idleTimeoutHandle);
      idleTimeoutHandle = null;
    }
  }

  function reset() {
    clear();
    if (!Number.isFinite(idleTimeoutMs) || idleTimeoutMs <= 0) {
      return;
    }
    idleTimeoutHandle = setTimeout(() => {
      onIdle?.();
    }, idleTimeoutMs);
    idleTimeoutHandle.unref();
  }

  return { reset, clear };
}

async function runOpenCodePrompt({
  prompt,
  title,
  sessionId,
  cwd,
  env,
  timeoutMs,
  opencodeEnv,
  onSpawn,
  onExit,
  idleTimeoutMs
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
    onSpawn,
    onExit,
    idleTimeoutMs,
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
  codexEnv,
  onSpawn,
  onExit,
  idleTimeoutMs
}) {
  return await runCodexCliPrompt({
    prompt,
    title,
    sessionId,
    cwd,
    env,
    timeoutMs,
    codexEnv,
    onSpawn,
    onExit,
    idleTimeoutMs
  });
}

async function runCodexCliPrompt({
  prompt,
  title,
  sessionId,
  cwd,
  env,
  timeoutMs,
  codexEnv,
  onSpawn,
  onExit,
  idleTimeoutMs
}) {
  const { command, args } = buildCodexCliInvocation({
    prompt,
    sessionId,
    cwd,
    codexEnv,
    platform: process.platform
  });

  return await spawnPrompt({
    command,
    args,
    cwd,
    env,
    timeoutMs,
    onSpawn,
    onExit,
    idleTimeoutMs,
    injectEnv: codexEnv
  });
}

export function buildCodexCliInvocation({
  prompt,
  sessionId,
  cwd,
  codexEnv = {},
  platform = process.platform
}) {
  const command =
    codexEnv.CODEX_LOOP_COMMAND?.trim() ||
    (platform === 'win32' ? 'cmd.exe' : 'codex');
  const baseArgs = (codexEnv.CODEX_LOOP_ARGS ?? '').trim()
    ? splitShellWords(codexEnv.CODEX_LOOP_ARGS)
    : [];

  if (sessionId) {
    return {
      command,
      args:
        platform === 'win32'
          ? [
              '/c',
              'codex.cmd',
              'exec',
              ...baseArgs,
              'resume',
              sessionId,
              '--json',
              '--full-auto',
              '--cd',
              cwd,
              prompt
            ]
          : [
              'exec',
              ...baseArgs,
              'resume',
              sessionId,
              '--json',
              '--full-auto',
              '--cd',
              cwd,
              prompt
            ]
    };
  }

  return {
    command,
    args:
      platform === 'win32'
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
        : ['exec', ...baseArgs, '--json', '--full-auto', '--cd', cwd, prompt]
  };
}

async function spawnPrompt({
  command,
  args,
  cwd,
  env,
  timeoutMs,
  injectEnv,
  onSpawn,
  onExit,
  idleTimeoutMs
}) {
  const mergedEnv = { ...env, ...injectEnv };
  return await new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      env: mergedEnv,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true
    });
    onSpawn?.(child);

    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let idleTimedOut = false;
    let settled = false;
    const idleController = createIdleController({
      idleTimeoutMs,
      onIdle: () => {
        idleTimedOut = true;
        try {
          child.kill('SIGTERM');
        } catch {
          // ignore
        }
      }
    });

    function safeResolve(result) {
      if (settled) return;
      settled = true;
      if (timeoutHandle) clearTimeout(timeoutHandle);
      if (hardTimeoutHandle) clearTimeout(hardTimeoutHandle);
      idleController.clear();
      onExit?.(child, result);
      resolve(result);
    }

    idleController.reset();

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

    // Hard watchdog: guarantees the Promise resolves even if the child never fires 'close'
    const hardMs =
      (Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 1200000) +
      60000;
    const hardTimeoutHandle = setTimeout(() => {
      timedOut = true;
      try {
        child.kill('SIGKILL');
      } catch {
        // ignore
      }
      safeResolve({
        exitCode: 1,
        signal: 'SIGKILL',
        stdout,
        stderr,
        timedOut: true
      });
    }, hardMs);
    hardTimeoutHandle.unref();

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
      idleController.reset();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
      idleController.reset();
    });
    child.on('close', (exitCode, signal) => {
      safeResolve({
        exitCode: exitCode ?? 1,
        signal,
        stdout,
        stderr,
        timedOut,
        idleTimedOut
      });
    });
    child.on('error', (error) => {
      safeResolve({
        exitCode: 1,
        signal: null,
        stdout,
        stderr: `${stderr}${stderr ? '\n' : ''}${error.message}\n`,
        timedOut,
        idleTimedOut
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
