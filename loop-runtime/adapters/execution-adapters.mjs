import { spawn } from 'node:child_process';
import { execFile } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  EXECUTION_BACKENDS,
  getBackendConfig,
  resolveExecutionBackendFromEnv
} from '../core/backend-config.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const repoOpencodeConfig = path.join(repoRoot, 'opencode.jsonc');

export async function validateExecutionBackend(env = process.env) {
  const backend = resolveExecutionBackend(env);
  const config = getBackendConfig(backend);
  if (backend === EXECUTION_BACKENDS.codex) {
    const commandCheck = await checkCommandAvailable(
      buildBackendVersionInvocation({
        config,
        commandOverride: env[config.commandEnvKey]?.trim(),
        platform: process.platform
      })
    );
    if (!commandCheck.ok) {
      return {
        ok: false,
        backend,
        message: `codex backend unavailable: ${commandCheck.message}`
      };
    }
  }

  return { ok: true, backend };
}

export function buildBackendVersionInvocation({
  config,
  commandOverride,
  platform = process.platform
}) {
  if (commandOverride) {
    return { command: commandOverride, args: ['--version'] };
  }

  if (platform === 'win32' && config.windowsCliCommand) {
    return {
      command: config.windowsShellCommand,
      args: ['/c', config.windowsCliCommand, '--version']
    };
  }

  return { command: config.command, args: ['--version'] };
}

export function resolveExecutionBackend(env = process.env) {
  return resolveExecutionBackendFromEnv(env);
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
  if (backend === EXECUTION_BACKENDS.codex) {
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
  const config = getBackendConfig(EXECUTION_BACKENDS.opencode);
  const args = sessionId
    ? [
        'run',
        '--continue',
        '--session',
        sessionId,
        '--agent',
        opencodeEnv?.agent || config.defaultAgent,
        '--model',
        resolveOpenCodeModel(opencodeEnv),
        '--format',
        config.outputFormat,
        '--title',
        title,
        prompt
      ]
    : [
        'run',
        '--agent',
        opencodeEnv?.agent || config.defaultAgent,
        '--model',
        resolveOpenCodeModel(opencodeEnv),
        '--format',
        config.outputFormat,
        '--title',
        title,
        prompt
      ];

  return await spawnPrompt({
    command: opencodeEnv?.command || config.command,
    args,
    cwd,
    env,
    timeoutMs,
    onSpawn,
    onExit,
    idleTimeoutMs,
    injectEnv: {
      [config.configEnvKey]: repoOpencodeConfig,
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
  const config = getBackendConfig(EXECUTION_BACKENDS.codex);
  const command =
    codexEnv.command ||
    (platform === 'win32' ? config.windowsShellCommand : config.command);
  const usesWindowsShell = platform === 'win32' && !codexEnv.command;
  const baseArgs = buildCodexBaseArgs(codexEnv);

  if (sessionId) {
    return {
      command,
      args: usesWindowsShell
        ? [
            '/c',
            codexEnv.cliCommand || config.windowsCliCommand,
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
    args: usesWindowsShell
      ? [
          '/c',
          codexEnv.cliCommand || config.windowsCliCommand,
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

export function buildCodexBaseArgs(codexEnv = {}) {
  const config = getBackendConfig(EXECUTION_BACKENDS.codex);
  const userArgs = (codexEnv.args ?? '').trim()
    ? splitShellWords(codexEnv.args)
    : [];
  const defaultArgs =
    config.defaultArgs && !hasCodexConfigArg(userArgs, 'model_reasoning_effort')
      ? splitShellWords(config.defaultArgs)
      : [];
  const args = [...defaultArgs, ...userArgs];
  if (!hasCodexModelArg(args)) {
    args.push('--model', codexEnv.model?.trim() || config.defaultModel);
  }
  return args;
}

function resolveOpenCodeModel(opencodeEnv = {}) {
  const config = getBackendConfig(EXECUTION_BACKENDS.opencode);
  return opencodeEnv.model?.trim?.() || config.defaultModel;
}

export function hasCodexModelArg(args) {
  return args.some(
    (arg) => arg === '--model' || arg === '-m' || arg.startsWith('--model=')
  );
}

export function hasCodexConfigArg(args, key) {
  return args.some((arg, index) => {
    if (arg === '-c' || arg === '--config') {
      return args[index + 1]?.startsWith(`${key}=`) ?? false;
    }
    return arg.startsWith(`-c${key}=`) || arg.startsWith(`--config=${key}=`);
  });
}

export function extractExecutionSessionId(stdout) {
  for (const line of stdout.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('{')) continue;
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed?.thread_id) return parsed.thread_id;
      if (parsed?.session_id) return parsed.session_id;
      if (parsed?.sessionID) return parsed.sessionID;
      const nested = parsed?.part?.sessionID ?? parsed?.part?.thread_id;
      if (nested) return nested;
    } catch {
      // ignore non-JSON or partial lines
    }
  }
  return null;
}

function checkCommandAvailable({ command, args }) {
  return new Promise((resolve) => {
    execFile(command, args, { windowsHide: true }, (error, stdout, stderr) => {
      if (error) {
        resolve({
          ok: false,
          message:
            stderr?.trim() ||
            stdout?.trim() ||
            error.message ||
            `${command} not found`
        });
        return;
      }
      resolve({ ok: true, message: stdout?.trim() || stderr?.trim() || 'ok' });
    });
  });
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
        sessionId: extractExecutionSessionId(stdout),
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
