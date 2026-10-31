#!/usr/bin/env node
/**
 * Verifies the report center renders its summary metrics.
 *
 * Opens /reports for the seeded question set, runs a quality check through the
 * real control when no result is on screen yet, then requires every summary
 * metric label to render with real values, no question-mark placeholders and no
 * page errors.
 *
 * Usage: node apps/web/scripts/verify-reports.mjs
 */
import { chromium } from 'playwright';

const WEB_BASE = process.env.SMOKE_BASE ?? 'http://127.0.0.1:5173';
const API_BASE = process.env.SMOKE_API_BASE ?? 'http://127.0.0.1:3000';
const EMAIL = process.env.SMOKE_EMAIL ?? 'default-user@example.com';
const PASSWORD = process.env.SMOKE_PASSWORD ?? 'local-password-1';
const QUESTION_SET_ID = process.env.SMOKE_QUESTION_SET ?? 'cmvwbvgxm0001gkiophuspbmf';
const ASSISTANT_ID = process.env.SMOKE_ASSISTANT ?? 'default-assistant';

const REQUIRED_LABELS = ['成功率', '有依据率', '高质量率', '兜底率', '检索召回率', '检索 MRR'];
const RUN_BUTTON_LABEL = '开始质量检查';
const METRIC_TIMEOUT_MS = 240_000;

const loginResponse = await fetch(`${API_BASE}/auth/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD })
});
const token = ((loginResponse.headers.get('set-cookie') ?? '').match(/rag_access_token=([^;]+)/) ?? [])[1];
if (!token) {
  console.error(`login failed with status ${loginResponse.status}`);
  process.exit(1);
}

const executablePath = process.env.SMOKE_CHROMIUM_PATH ?? undefined;
const browser = await chromium.launch(executablePath ? { executablePath } : {});
const context = await browser.newContext();
const host = new URL(WEB_BASE);
await context.addCookies([
  {
    name: 'rag_access_token',
    value: token,
    domain: host.hostname,
    path: '/',
    httpOnly: true,
    secure: false,
    sameSite: 'Lax'
  }
]);

const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(String(error.message ?? error).slice(0, 200)));

const url = `${WEB_BASE}/reports?questionSetId=${QUESTION_SET_ID}&assistantId=${ASSISTANT_ID}`;
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(5000);

const readMain = () => page.evaluate(() => document.querySelector('main')?.innerText ?? '');
const hasMetrics = (text) => REQUIRED_LABELS.some((label) => text.includes(label));

let metricsVisible = hasMetrics(await readMain());

if (!metricsVisible) {
  const runButton = page.getByRole('button', { name: RUN_BUTTON_LABEL }).first();
  const buttonCount = await runButton.count();
  if (buttonCount === 0) {
    console.error(`"${RUN_BUTTON_LABEL}" button not found and no metrics on screen`);
    await browser.close();
    process.exit(1);
  }

  console.log(`running a quality check through "${RUN_BUTTON_LABEL}"…`);
  await runButton.click();

  const deadline = Date.now() + METRIC_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await page.waitForTimeout(3000);
    if (hasMetrics(await readMain())) {
      metricsVisible = true;
      break;
    }
  }
}

const mainText = await readMain();
await browser.close();

const missingLabels = REQUIRED_LABELS.filter((label) => !mainText.includes(label));
const percentages = mainText.match(/\d+(\.\d+)?%/g) ?? [];
const hasPlaceholders = /\?{2,}/.test(mainText);

console.log(`metrics visible: ${metricsVisible}`);
console.log(`labels found: ${REQUIRED_LABELS.filter((label) => mainText.includes(label)).join(', ') || '(none)'}`);
console.log(`percentages: ${percentages.slice(0, 8).join(', ') || '(none)'}`);
console.log(`question-mark placeholders: ${hasPlaceholders}`);
console.log(`page errors: ${pageErrors.length}`);

const problems = [];
if (!metricsVisible) {
  problems.push('summary metrics never rendered');
}
if (missingLabels.length > 0) {
  problems.push(`missing metric labels: ${missingLabels.join(', ')}`);
}
if (percentages.length === 0) {
  problems.push('no percentage rendered');
}
if (hasPlaceholders) {
  problems.push('question-mark placeholders rendered');
}
if (pageErrors.length > 0) {
  problems.push(`page errors: ${pageErrors.join('; ')}`);
}

if (problems.length > 0) {
  console.error('\nproblems:');
  for (const problem of problems) {
    console.error('   ' + problem);
  }
  console.error('\nmain sample:');
  console.error(mainText.slice(0, 1200));
  process.exit(1);
}

console.log('\nreport center renders every summary metric');
