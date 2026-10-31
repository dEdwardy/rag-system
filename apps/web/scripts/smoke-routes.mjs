#!/usr/bin/env node
/**
 * Browser smoke test for every route in the web app.
 *
 * Logs in through the API, reuses the session cookie in the browser context,
 * then visits each route and reports: navigation status, whether the page
 * rendered visible text, and any console/page errors.
 *
 * Usage: node apps/web/scripts/smoke-routes.mjs
 *        SMOKE_BASE=http://127.0.0.1:5173 node apps/web/scripts/smoke-routes.mjs
 */
import { chromium } from 'playwright';

const WEB_BASE = process.env.SMOKE_BASE ?? 'http://127.0.0.1:5173';
const API_BASE = process.env.SMOKE_API_BASE ?? 'http://127.0.0.1:3000';
const EMAIL = process.env.SMOKE_EMAIL ?? 'default-user@example.com';
const PASSWORD = process.env.SMOKE_PASSWORD ?? 'local-password-1';

const ROUTES = [
  '/',
  '/documents',
  '/knowledge-base',
  '/assistant',
  '/workbench',
  '/usage',
  '/reports',
  '/traces',
  '/login',
  '/invite'
];

async function loginCookie() {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD })
  });
  const rawCookie = response.headers.get('set-cookie') ?? '';
  const token = (rawCookie.match(/rag_access_token=([^;]+)/) ?? [])[1];
  if (!token) {
    throw new Error(`login failed (status ${response.status}); no access token`);
  }
  return token;
}

const token = await loginCookie();
// The cached browser build can differ from the one this Playwright version
// expects, so an explicit executable keeps the smoke runnable offline.
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

const results = [];

for (const route of ROUTES) {
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text().slice(0, 200));
    }
  });
  page.on('pageerror', (error) => {
    pageErrors.push(String(error.message ?? error).slice(0, 200));
  });

  let status = null;
  let textLength = 0;

  try {
    const response = await page.goto(`${WEB_BASE}${route}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000
    });
    status = response?.status() ?? null;
    await page.waitForTimeout(1200);
    const bodyText = await page.evaluate(() => document.body.innerText ?? '');
    textLength = bodyText.trim().length;
  } catch (error) {
    pageErrors.push(`navigation failed: ${String(error.message ?? error).slice(0, 200)}`);
  }

  results.push({ route, status, textLength, consoleErrors, pageErrors });
  await page.close();
}

// Public routes must also be checked without a session, otherwise the cookie
// redirects them to the app shell and the login form is never exercised.
const anonymousContext = await browser.newContext();
for (const route of ['/login', '/invite']) {
  const page = await anonymousContext.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(String(error.message ?? error).slice(0, 200)));

  let status = null;
  let textLength = 0;
  let hasPasswordField = false;

  try {
    const response = await page.goto(`${WEB_BASE}${route}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000
    });
    status = response?.status() ?? null;
    await page.waitForTimeout(1200);
    textLength = (await page.evaluate(() => document.body.innerText ?? '')).trim().length;
    hasPasswordField = (await page.locator('input[type="password"]').count()) > 0;
  } catch (error) {
    pageErrors.push(`navigation failed: ${String(error.message ?? error).slice(0, 200)}`);
  }

  results.push({ route: `${route} (anonymous)`, status, textLength, consoleErrors: [], pageErrors, hasPasswordField });
  await page.close();
}
await anonymousContext.close();

await browser.close();

const failures = [];
console.log('route'.padEnd(16) + 'status  text  console  pageerror');
for (const result of results) {
  console.log(
    result.route.padEnd(16) +
      String(result.status).padEnd(8) +
      String(result.textLength).padEnd(6) +
      String(result.consoleErrors.length).padEnd(9) +
      result.pageErrors.length
  );
  // The anonymous login route must expose a password field; otherwise the form
  // failed to render even though the shell responded 200.
  const needsPasswordField =
    result.route === '/login (anonymous)' && result.hasPasswordField !== true;
  if (
    result.status !== 200 ||
    result.textLength < 20 ||
    result.pageErrors.length > 0 ||
    needsPasswordField
  ) {
    failures.push(result);
  }
}

if (failures.length > 0) {
  console.log(`\nfailures: ${failures.length}`);
  for (const failure of failures) {
    console.log(`\n  ${failure.route}  status=${failure.status} text=${failure.textLength}`);
    for (const message of [...failure.pageErrors, ...failure.consoleErrors]) {
      console.log(`     ${message}`);
    }
  }
  process.exit(1);
}

console.log('\nall routes rendered without page errors');
