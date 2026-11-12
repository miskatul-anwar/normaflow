#!/usr/bin/env node
/**
 * Design-consistency audit. "Well crafted" is subjective, but its parts are measurable: the same kind of
 * element should look the same everywhere. This reads computed styles on the pipeline page and every
 * Output tab (light and dark) and fails when the interface drifts from the rules in docs/DESIGN.md:
 *   - at most two font families (Inter and a monospace face);
 *   - at most 7 distinct text sizes, none below 10 px;
 *   - standard buttons at fixed heights with a 6 or 8 px radius (list rows are square);
 *   - bordered cards only at the radii 4, 8 or the 13.6 px panel radius.
 * Needs a built app: npm run build && npx vite preview --port 4311
 */
const { chromium } = require('playwright');
const fs = require('fs');
const os = require('os');
const path = require('path');

const URL = process.env.URL || 'http://localhost:4311/';
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nf-cons-'));
const FILES = ['a', 'b', 'c'].map(n => {
  const f = path.join(dir, `${n}.csv`);
  const rows = Array.from({ length: 50 }, (_, k) => `${k + 1},${(k % 10) + 1},Name ${k % 7},${k % 5}`);
  fs.writeFileSync(f, ['id,ref,name,qty', ...rows].join('\n'));
  return f;
});

const REQUEST = 'bcnf, cardinality, lossless check, dependency preservation, er diagram, sql, report';
const BUTTON_HEIGHTS = new Set(['24', '26', '32', '34', '36', '40', '44', '46']);
const BUTTON_RADII = new Set(['0px', '6px', '8px']);
const CARD_RADII = new Set(['4px', '8px', '13.6px']);

const probe = () => {
  const o = { font: [], family: [], btn: [], card: [] };
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height || el.closest('svg')) continue;
    const cs = getComputedStyle(el);
    if (el.children.length === 0 && el.textContent.trim()) {
      o.font.push(cs.fontSize);
      o.family.push(cs.fontFamily.split(',')[0].replace(/["']/g, ''));
    }
    const inChrome = el.closest('.react-flow') || el.closest('.nf-tab') || el.closest('aside');
    if (el.tagName === 'BUTTON' && r.height > 20 && !inChrome) o.btn.push(`${Math.round(r.height)}/${cs.borderRadius}`);
    if (parseFloat(cs.borderTopWidth) > 0 && r.width > 240 && r.height > 60 && cs.borderRadius !== '0px') o.card.push(cs.borderRadius);
  }
  return o;
};

(async () => {
  const browser = await chromium.launch();
  const agg = { font: {}, family: {}, btn: {}, card: {} };
  const add = o => {
    for (const k of Object.keys(o)) for (const v of o[k]) agg[k][v] = (agg[k][v] || 0) + 1;
  };
  for (const theme of ['light', 'dark']) {
    const page = await browser.newPage({ viewport: { width: 1300, height: 820 } });
    await page.addInitScript(t => localStorage.setItem('normaflow.theme', t), theme);
    await page.goto(URL);
    await page.getByRole('button', { name: 'Start' }).click(); // the launch dialog asks for a workspace name
    await page.setInputFiles('input[type=file]', FILES);
    await page.fill('input[aria-label^="Describe"]', REQUEST);
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: /apply & run/i }).click();
    add(await page.evaluate(probe));
    await page.getByText('Output', { exact: true }).first().click({ timeout: 90000 });
    await page.waitForTimeout(1000);
    const tabs = page.locator('aside[aria-label="Result sections"] button');
    for (let i = 0, n = await tabs.count(); i < n; i++) {
      await tabs.nth(i).click({ timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(i === 6 ? 2500 : 500);
      add(await page.evaluate(probe));
    }
    await page.close();
  }
  await browser.close();

  const sizes = Object.keys(agg.font).map(parseFloat).sort((a, b) => a - b);
  const fails = [];
  if (Object.keys(agg.family).length > 2) fails.push(`font families: ${Object.keys(agg.family).join(', ')}`);
  if (sizes.length > 7) fails.push(`${sizes.length} text sizes (max 7): ${sizes.join(', ')} px`);
  if (sizes[0] < 10) fails.push(`text smaller than 10 px: ${sizes[0]} px`);
  for (const [k, count] of Object.entries(agg.btn)) {
    const [h, r] = k.split('/');
    if (!BUTTON_RADII.has(r)) fails.push(`button radius ${r} (x${count})`);
    if (!BUTTON_HEIGHTS.has(h)) fails.push(`button height ${h} px (x${count})`);
  }
  for (const r of Object.keys(agg.card)) if (!CARD_RADII.has(r)) fails.push(`card radius ${r}`);

  console.log('font families      :', Object.keys(agg.family).join(', '));
  console.log('text sizes (px)    :', sizes.join(', '));
  console.log('button height/radius:', Object.keys(agg.btn).join(', '));
  console.log('card radii         :', Object.keys(agg.card).join(', '));
  if (fails.length) {
    console.error(`Consistency findings:\n${fails.join('\n')}`);
    process.exit(1);
  }
  console.log('Consistent: the interface stays inside the design rules in every view.');
})();
