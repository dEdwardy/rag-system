import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(scriptDir, '..');
const vitestCliPath = resolve(
  webRoot,
  '..',
  'api',
  'node_modules',
  'vitest',
  'vitest.mjs'
);
const rawArgs = process.argv.slice(2).filter((argument) => argument !== '--');

if (rawArgs.length === 0) {
  console.error(
    'Usage: pnpm --filter @rag-system/web test:vitest:file -- test/<name>.test.js'
  );
  process.exit(1);
}

const fileArgs = rawArgs.filter((argument) => !argument.startsWith('--'));
const passthroughArgs = rawArgs.filter((argument) => argument.startsWith('--'));
const normalizedArgs = fileArgs.map(normalizeTestPath);
const missingPaths = normalizedArgs.filter(
  (argument) => !existsSync(resolve(webRoot, argument))
);

if (!existsSync(vitestCliPath)) {
  console.error(`Could not find Vitest CLI at ${vitestCliPath}`);
  process.exit(1);
}

if (missingPaths.length > 0) {
  console.error(`Could not find test file(s): ${missingPaths.join(', ')}`);
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  [
    vitestCliPath,
    'run',
    '--pool=forks',
    '--maxWorkers=1',
    ...normalizedArgs,
    ...passthroughArgs
  ],
  {
    cwd: webRoot,
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

  if (normalized.startsWith('apps/web/')) {
    return normalized.slice('apps/web/'.length);
  }

  return normalized;
}
