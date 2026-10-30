// Browser smoke test at phone size: npm run build && npm run smoke
// Needs Playwright (`npm i -D playwright` once, or a global install).
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { start } from './serve.mjs';
import config from '../site.config.mjs';

// require() also finds a globally installed Playwright, which import does not.
const { chromium } = createRequire(import.meta.url)('playwright');

const port = 4399;
const base = `http://localhost:${port}${new URL(config.url).pathname.replace(/\/$/, '')}`;
const shots = process.env.SHOTS_DIR || 'screenshots';
mkdirSync(shots, { recursive: true });

const server = await start(port);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

async function pick(role, text, name) {
  const input = page.locator(`[data-role="${role}"] input`);
  await input.click();
  await input.fill(text);
  await page.locator(`[data-role="${role}"] li`, { hasText: name }).first().click();
}
function check(cond, msg) {
  if (!cond) throw new Error(`Smoke test failed: ${msg}`);
  console.log(`ok - ${msg}`);
}

try {
  // calculator
  await page.goto(base + '/');
  await pick('a', 'relax', 'Relaxaurus');
  await pick('b', 'spark', 'Sparkit');
  await page.waitForSelector('.child-card');
  check((await page.textContent('#calc-result')).includes('Relaxaurus Lux'), 'Relaxaurus + Sparkit = Relaxaurus Lux');
  check(page.url().includes('a=relaxaurus') && page.url().includes('b=sparkit'), 'calculator URL is shareable');
  await page.screenshot({ path: `${shots}/1-calculator.png`, fullPage: false });

  await page.goto(base + '/?a=katress&b=wixen');
  await page.waitForSelector('.child-card');
  const kw = await page.textContent('#calc-result');
  check(kw.includes('Katress Ignis') && kw.includes('Wixen Noct'), 'gender-specific result shows both outcomes');

  // My Pals
  await page.goto(base + '/my-pals/');
  for (const slug of ['lamball', 'cattiva', 'chikipi']) await page.check(`input[value="${slug}"]`);
  check((await page.textContent('#my-count')).startsWith('3 of'), 'My Pals counts ticks');
  await page.fill('#my-search', 'lamb');
  check(await page.locator('#my-list li:not([hidden])').count() >= 1, 'My Pals search filters');
  await page.reload();
  check(await page.isChecked('input[value="cattiva"]'), 'My Pals survives reload');
  await page.screenshot({ path: `${shots}/2-my-pals.png` });

  // finder with owned filter
  await page.goto(base + '/find/?t=daedream');
  await page.waitForSelector('#find-result .pairs');
  await page.click('label.switch');
  check(await page.isChecked('#only-owned'), 'finder: owned switch toggles');
  check((await page.textContent('#find-result')).includes('Lamball'), 'finder: owned filter keeps Lamball + Cattiva');
  await page.screenshot({ path: `${shots}/3-finder.png` });

  // planner
  await page.goto(base + '/planner/');
  await pick('t', 'daed', 'Daedream');
  await page.waitForSelector('.steps li');
  check((await page.locator('.steps li').count()) === 1, 'planner: one step to Daedream');
  await page.goto(base + '/planner/?t=jetragon');
  await page.waitForFunction(() => document.querySelector('#plan-result').textContent.includes("can't be bred"));
  check(true, 'planner: Jetragon unreachable message');
  await page.screenshot({ path: `${shots}/4-planner.png` });

  // directory + pal page
  await page.goto(base + '/pals/');
  await page.fill('#dir-search', 'anub');
  check((await page.textContent('#dir-count')) === '1 Pal', 'directory search');
  await page.click('.chip-btn[data-work="Mining"]');
  await page.fill('#dir-search', '');
  check(Number((await page.textContent('#dir-count')).split(' ')[0]) > 10, 'directory work filter');
  await page.goto(base + '/pals/anubis/');
  check((await page.textContent('h1')) === 'How to breed Anubis', 'Pal page renders');
  await page.screenshot({ path: `${shots}/5-pal-page.png` });

  // no horizontal scrolling on phones
  for (const path of ['/', '/find/', '/planner/', '/my-pals/', '/pals/', '/pals/anubis/', '/guide/how-breeding-works/']) {
    await page.goto(base + path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check(overflow <= 0, `no sideways scroll on ${path}`);
  }
  // dark mode renders too
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto(base + '/?a=katress&b=wixen');
  await page.waitForSelector('.child-card');
  await page.screenshot({ path: `${shots}/6-dark-calculator.png` });
  await page.goto(base + '/pals/anubis/');
  await page.screenshot({ path: `${shots}/7-dark-pal-page.png` });
  await page.emulateMedia({ colorScheme: 'light' });

  check(errors.length === 0, `no console errors${errors.length ? ': ' + errors.join('; ') : ''}`);
} finally {
  await browser.close();
  server.close();
}
