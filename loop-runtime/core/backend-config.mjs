export const LOOP_ENV_KEYS = Object.freeze({
  executorBackend: 'LOOP_EXECUTOR_BACKEND',
  executorModel: 'LOOP_EXECUTOR_MODEL',
  intervalMs: 'LOOP_INTERVAL_MS',
  itemTimeoutMs: 'LOOP_ITEM_TIMEOUT_MS',
  itemIdleTimeoutMs: 'LOOP_ITEM_IDLE_TIMEOUT_MS'
});

export const LEGACY_LOOP_ENV_KEYS = Object.freeze({
  intervalMs: 'OPENCODE_LOOP_INTERVAL_MS',
  itemTimeoutMs: 'OPENCODE_LOOP_ITEM_TIMEOUT_MS',
  itemIdleTimeoutMs: 'OPENCODE_LOOP_PROGRESS_IDLE_TIMEOUT_MS'
});

export const EXECUTION_BACKENDS = Object.freeze({
  opencode: 'opencode',
  codex: 'codex'
});

export const DEFAULT_EXECUTION_BACKEND = EXECUTION_BACKENDS.opencode;

export const BACKEND_ENV_PREFIXES = Object.freeze(['OPENCODE', 'CODEX']);

export const BACKEND_CONFIG = Object.freeze({
  [EXECUTION_BACKENDS.opencode]: Object.freeze({
    id: EXECUTION_BACKENDS.opencode,
    command: 'opencode',
    argsEnvKey: 'OPENCODE_LOOP_ARGS',
    commandEnvKey: 'OPENCODE_LOOP_COMMAND',
    configEnvKey: 'OPENCODE_CONFIG',
    modelEnvKey: 'OPENCODE_LOOP_MODEL',
    defaultAgent: 'build',
    defaultModel: 'my/gpt-5.4',
    outputFormat: 'json'
  }),
  [EXECUTION_BACKENDS.codex]: Object.freeze({
    id: EXECUTION_BACKENDS.codex,
    command: 'codex',
    windowsShellCommand: 'cmd.exe',
    windowsCliCommand: 'codex.cmd',
    argsEnvKey: 'CODEX_LOOP_ARGS',
    commandEnvKey: 'CODEX_LOOP_COMMAND',
    modelEnvKey: 'CODEX_LOOP_MODEL',
    defaultArgs: '-c model_reasoning_effort=low',
    defaultModel: 'gpt-5.5'
  })
});

export function normalizeExecutionBackend(value) {
  const backend = (value ?? DEFAULT_EXECUTION_BACKEND).trim().toLowerCase();
  return Object.values(EXECUTION_BACKENDS).includes(backend)
    ? backend
    : DEFAULT_EXECUTION_BACKEND;
}

export function resolveExecutionBackendFromEnv(env = process.env) {
  return normalizeExecutionBackend(env[LOOP_ENV_KEYS.executorBackend]);
}

export function getBackendConfig(backend) {
  return BACKEND_CONFIG[normalizeExecutionBackend(backend)];
}

export function envValue(env, key, fallback = '') {
  return env?.[key]?.trim?.() || fallback;
}

export function resolveLoopNumberEnv(env, primaryKey, legacyKey, fallback) {
  const raw = env?.[primaryKey] ?? env?.[legacyKey];
  const value = Number(raw ?? fallback);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function shouldStripBackendRuntimeEnv(key) {
  return BACKEND_ENV_PREFIXES.some((prefix) => key.startsWith(prefix));
}

export function buildBackendEnv(env, backend) {
  const config = getBackendConfig(backend);
  return {
    command: envValue(env, config.commandEnvKey),
    args: envValue(env, config.argsEnvKey),
    model: envValue(
      env,
      config.modelEnvKey,
      envValue(env, LOOP_ENV_KEYS.executorModel)
    )
  };
}
