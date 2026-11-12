#!/usr/bin/env node
/**
 * Accessibility audit (ISO/IEC 25010 interaction capability / WCAG 2.1 AA).
 *
 * Runs axe-core against the pipeline page and every Output tab, in light and dark, on a small generated
 * dataset. Exits non-zero when anything is found, so it can gate a release.
 *
 *   npm run build && npx vite preview --port 4311 &
 *   npm run audit:a11y                 # URL=http://localhost:4311 by default
 *
 * Needs Playwright with a browser installed (`npx playwright install chromium`).
 */
const { chromium } = require('playwright');
const fs = require('fs');
const os = require('os');
const path = require('path');

const URL = process.env.URL || 'http://localhost:4311/';
const axeSrc = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nf-a11y-'));
const csv = path.join(dir, 'enroll.csv');
const rows = ['student,course,teacher,dept,credits'];
const teach = { DB: 'Smith', OS: 'Jones', AI: 'Lee', Net: 'Kim' };
for (let i = 1; i <= 60; i++) {
  const c = Object.keys(teach)[i % 4];
  rows.push(`S${(i % 25) + 1},${c},${teach[c]},${c === 'Net' ? 'EE' : 'CS'},${c === 'DB' || c === 'AI' ? 3 : 4}`);
}
fs.writeFileSync(csv, rows.join('\n'));

(async () => {
  const browser = await chromium.launch();
  const found = [];
  for (const theme of ['light', 'dark']) {
    const page = await browser.newPage({ viewport: { width: 1300, height: 820 } });
    await page.addInitScript(t => {
      try {
        localStorage.setItem('normaflow.theme', t);
      } catch {
        /* storage blocked */
      }
    }, theme);
    await page.goto(URL);
    await page.getByRole('button', { name: 'Start' }).click(); // the launch dialog asks for a workspace name
    await page.setInputFiles('input[type=file]', csv);
    const scan = async name => {
      await page.evaluate(src => {
        if (!window.axe) (0, eval)(src);
      }, axeSrc);
      const r = await page.evaluate(() => axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'] }));
      for (const v of r.violations) found.push(`${theme} / ${name}: ${v.id} (${v.impact}) x${v.nodes.length} - ${v.help}`);
    };
    await scan('pipeline');
    await page.fill('input[aria-label^="Describe"]', 'bcnf, er diagram, sql, report');
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: /apply & run/i }).click();
    await page.getByText('Output', { exact: true }).first().click({ timeout: 100000 });
    await page.waitForTimeout(1500);
    const tabs = page.locator('aside[aria-label="Result sections"] button');
    for (let i = 0, n = await tabs.count(); i < n; i++) {
      await tabs.nth(i).click({ timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(700);
      await scan(`output tab ${i + 1}`);
    }
    await page.close();
  }
  await browser.close();
  if (found.length) {
    console.error(`${found.length} accessibility violation group(s):\n` + found.join('\n'));
    process.exit(1);
  }
  console.log('axe-core: no WCAG 2.1 AA or best-practice violations (pipeline + all Output tabs, light + dark).');
})();
