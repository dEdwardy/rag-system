import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const apiRoot = resolve(scriptDir, '..');
const tsxCliPath = resolve(apiRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const vitestCliPath = resolve(apiRoot, 'node_modules', 'vitest', 'vitest.mjs');
const rawArgs = process.argv.slice(2).filter((argument) => argument !== '--');
const fastTestFiles = new Set([
  'test/answering.test.js',
  'test/ask-failures.test.js',
  'test/ask-route-decision.test.js',
  'test/ask-reuse.test.js',
  'test/ask-stream-controller.test.js',
  'test/ask-stream-retrieval-failure.test.js',
  'test/ask-stream-service.test.js',
  'test/ask-success.test.js',
  'test/auth-surface-route-policy.test.js',
  'test/chunking.test.js',
  'test/document-runs-summary.test.js',
  'test/embedding-cache.test.js',
  'test/external-source-sync.test.js',
  'test/fetch-with-retry.test.js',
  'test/http-exception-filter.test.js',
  'test/agent-langgraph.controller.test.js',
  'test/agent-tools.controller.test.js',
  'test/ingestion.orchestrator.test.js',
  'test/llm-answer-stream.test.js',
  'test/llm.test.js',
  'test/parsing.test.js',
  'test/prompt-manager.test.js',
  'test/auth-provider-boundary.test.js',
  'test/retrieval-profiles-auth-scope.test.js',
  'test/retrieval.test.js',
  'test/traces.service.test.js',
  'test/vector-store-runtime-config.test.js',
  'test/vitest-config.test.js'
]);

if (rawArgs.length === 0) {
  console.error('Usage: pnpm test:api:file -- test/<name>.test.js');
  process.exit(1);
}

const fileArgs = rawArgs.filter((argument) => !argument.startsWith('--'));
const passthroughArgs = rawArgs.filter((argument) => argument.startsWith('--'));

if (fileArgs.length === 0) {
  console.error('Usage: pnpm test:api:file -- test/<name>.test.js');
  process.exit(1);
}

const normalizedArgs = fileArgs.map((argument) => normalizeTestPath(argument));
const missingPaths = normalizedArgs.filter(
  (argument) => !existsSync(resolve(apiRoot, argument))
);

if (missingPaths.length > 0) {
  console.error(`Could not find test file(s): ${missingPaths.join(', ')}`);
  process.exit(1);
}

const useVitest = normalizedArgs.every((argument) =>
  fastTestFiles.has(argument)
);

if (!useVitest) {
  const ensureBuild = spawnSync(
    process.execPath,
    [resolve(apiRoot, 'scripts', 'ensure-build.mjs')],
    {
      cwd: apiRoot,
      stdio: 'inherit'
    }
  );

  if (ensureBuild.status !== 0) {
    process.exit(ensureBuild.status ?? 1);
  }
}

const result = spawnSync(
  process.execPath,
  useVitest
    ? [
        vitestCliPath,
        'run',
        '--pool=forks',
        '--maxWorkers=1',
        ...normalizedArgs,
        ...passthroughArgs
      ]
    : [tsxCliPath, '--test', '--test-concurrency=1', ...normalizedArgs],
  {
    cwd: apiRoot,
    stdio: 'inherit'
  }
);

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);

function normalizeTestPath(argument) {
  const normalized = argument.replace(/\\/g, '/').replace(/^\.\//, '');

  if (normalized.startsWith('apps/api/')) {
    return normalized.slice('apps/api/'.length);
  }

  return normalized;
}
