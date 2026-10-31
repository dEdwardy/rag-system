#!/usr/bin/env node
/**
 * Verifies the locale switch through the browser.
 *
 * Loads the app in Chinese, switches to English through the real control and
 * back again, then checks the navigation labels each time. Any label that is
 * still Chinese in English mode would show up here.
 *
 * Usage: node apps/web/scripts/verify-locale.mjs
 */
import { chromium } from 'playwright';

const WEB_BASE = process.env.SMOKE_BASE ?? 'http://127.0.0.1:5173';
const API_BASE = process.env.SMOKE_API_BASE ?? 'http://127.0.0.1:3000';
const EMAIL = process.env.SMOKE_EMAIL ?? 'default-user@example.com';
const PASSWORD = process.env.SMOKE_PASSWORD ?? 'local-password-1';

const EXPECTED_NAV = {
  zh: ['对话', '资料库', '工作区设置', '回答设置'],
  en: ['Chat', 'Library', 'Workspace settings', 'Answer settings']
};

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

await page.goto(`${WEB_BASE}/documents`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);

async function readNav() {
  return page.evaluate(() => {
    const nav = document.querySelector('nav');
    return nav ? nav.innerText.split('\n').map((line) => line.trim()).filter(Boolean) : [];
  });
}

// Both direction buttons exist at once, so match the exact label of the target
// instead of a substring: "切换到中文" and "切换到英文" both contain 切换.
const SWITCH_LABELS = {
  en: ['切换到英文', 'Switch to English'],
  zh: ['切换到中文', 'Switch to Chinese']
};

async function switchLocale(locale) {
  for (const label of SWITCH_LABELS[locale]) {
    const button = page.locator(`button[aria-label="${label}"]`).first();
    if ((await button.count()) > 0) {
      await button.click();
      await page.waitForTimeout(1200);
      return true;
    }
  }
  return false;
}

const results = [];
const initialNav = await readNav();
results.push({ phase: 'initial (zh)', nav: initialNav });

const switchedToEnglish = await switchLocale('en');
const englishNav = await readNav();
results.push({ phase: 'english', nav: englishNav, switched: switchedToEnglish });

const switchedToChinese = await switchLocale('zh');
const chineseAgain = await readNav();
results.push({ phase: 'chinese again', nav: chineseAgain, switched: switchedToChinese });

await browser.close();

for (const result of results) {
  console.log(`${result.phase}: ${result.nav.join(' | ') || '(empty)'}`);
}
console.log(`page errors: ${pageErrors.length}`);

const problems = [];

if (!englishNav.includes(EXPECTED_NAV.en[0])) {
  problems.push(`English navigation did not switch (expected "${EXPECTED_NAV.en[0]}")`);
}

for (const label of EXPECTED_NAV.en) {
  if (englishNav.some((entry) => entry === label)) {
    continue;
  }
  // Only report the missing label when the navigation switched at all.
  if (englishNav.includes(EXPECTED_NAV.en[0])) {
    problems.push(`English navigation is missing "${label}"`);
  }
}

if (englishNav.some((entry) => /[\u4e00-\u9fff]/.test(entry))) {
  problems.push(`Chinese text still present in English navigation: ${englishNav.join(' | ')}`);
}

if (!chineseAgain.includes(EXPECTED_NAV.zh[0])) {
  problems.push(`switching back to Chinese did not restore "${EXPECTED_NAV.zh[0]}"`);
}

if (pageErrors.length > 0) {
  problems.push(`page errors: ${pageErrors.join('; ')}`);
}

if (problems.length > 0) {
  console.error('\nproblems:');
  for (const problem of problems) {
    console.error('   ' + problem);
  }
  process.exit(1);
}

console.log('\nlocale switches both ways and the navigation follows it');
