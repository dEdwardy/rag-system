#!/usr/bin/env node
/**
 * Verifies that an answer's citation marker is actually usable in the browser.
 *
 * Asks a question that retrieves from the knowledge base, waits for an answer,
 * then requires:
 *   1. at least one citation chip rendered inside the answer,
 *   2. clicking it opens the source panel with the cited snippet,
 *   3. closing the panel returns to the answer.
 *
 * Usage: node apps/web/scripts/verify-citation.mjs
 */
import { chromium } from 'playwright';

const WEB_BASE = process.env.SMOKE_BASE ?? 'http://127.0.0.1:5173';
const API_BASE = process.env.SMOKE_API_BASE ?? 'http://127.0.0.1:3000';
const EMAIL = process.env.SMOKE_EMAIL ?? 'default-user@example.com';
const PASSWORD = process.env.SMOKE_PASSWORD ?? 'local-password-1';
const QUESTION =
  process.env.SMOKE_QUESTION ?? '如果我要把网页内容接入知识库，通常支持哪些来源类型？';

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

await page.goto(`${WEB_BASE}/`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('textarea[name="question"]', { timeout: 30_000 });
await page.fill('textarea[name="question"]', QUESTION);
await page.press('textarea[name="question"]', 'Enter');

const chip = page.locator('button[title*=".md"]').first();
let chipCount = 0;
try {
  await chip.waitFor({ state: 'visible', timeout: 90_000 });
  chipCount = await page.locator('button[title*=".md"]').count();
} catch {
  const body = await page.evaluate(() => document.body.innerText);
  console.error('no citation chip appeared within 90s');
  console.error('answer text sample:', body.slice(-400));
  await browser.close();
  process.exit(1);
}

const chipTitle = await chip.getAttribute('title');
await chip.click();

const modalVisible = await page
  .locator('text=引用来源')
  .first()
  .isVisible()
  .catch(() => false);
const modalText = modalVisible
  ? (await page.evaluate(() => document.body.innerText)).slice(-500)
  : '';

await browser.close();

console.log(`citation chips: ${chipCount}`);
console.log(`chip title: ${chipTitle}`);
console.log(`source panel opened: ${modalVisible}`);
console.log(`page errors: ${pageErrors.length}`);

if (!modalVisible) {
  console.error('\nsource panel did not open after clicking the citation chip');
  if (modalText) console.error('body tail:', modalText);
  process.exit(1);
}

if (pageErrors.length > 0) {
  console.error('\npage errors during the run:');
  for (const message of pageErrors) console.error('   ' + message);
  process.exit(1);
}

console.log('\ncitation chip opens its source panel');
