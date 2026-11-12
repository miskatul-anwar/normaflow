#!/usr/bin/env node
/**
 * One pass over the whole UI: pipeline page and every Output tab, for a single table and for several,
 * in light and dark, at 900, 1300 and 1700 px. For every view it checks
 *   - no horizontal page overflow,
 *   - no element running past the edge of its scroll container (clipped content), except in regions
 *     that are meant to scroll (diagrams, code, chip rows),
 *   - no console or page errors,
 *   - no axe-core violations (WCAG 2.1 AA + best practice).
 * Exits non-zero on any finding. Needs a built app: `npm run build && npx vite preview --port 4311`.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const os = require('os');
const path = require('path');

const URL = process.env.URL || 'http://localhost:4311/';
const axeSrc = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nf-ui-'));

const write = (name, text) => {
  const p = path.join(dir, name);
  fs.writeFileSync(p, text);
  return p;
};
const teach = { DB: 'Smith', OS: 'Jones', AI: 'Lee', Net: 'Kim' };
const single = write(
  'enroll.csv',
  ['student,course,teacher,dept,credits', ...Array.from({ length: 60 }, (_, i) => {
    const c = Object.keys(teach)[(i + 1) % 4];
    return `S${(i % 25) + 1},${c},${teach[c]},${c === 'Net' ? 'EE' : 'CS'},${c === 'DB' || c === 'AI' ? 3 : 4}`;
  })].join('\n'),
);
const multi = [
  write('customer.csv', ['CustomerId,Name,City', ...Array.from({ length: 40 }, (_, i) => `${i + 1},Cust ${i + 1},City ${i % 6}`)].join('\n')),
  write('invoice.csv', ['InvoiceId,CustomerId,Total', ...Array.from({ length: 120 }, (_, i) => `${i + 1},${(i % 40) + 1},${(i % 9) + 1}.5`)].join('\n')),
  write('line.csv', ['LineId,InvoiceId,Qty', ...Array.from({ length: 300 }, (_, i) => `${i + 1},${(i % 120) + 1},${(i % 4) + 1}`)].join('\n')),
];

const REQUEST = 'bcnf, cardinality, lossless check, dependency preservation, er diagram, sql, report';
const THEMES = ['light', 'dark'];
const SIZES = [[900, 640], [1300, 820], [1700, 1000]];
const RUNS = [['single table', [single]], ['3 tables', multi]];

const overflowProbe = () => {
  const out = [];
  const de = document.documentElement;
  if (de.scrollWidth > de.clientWidth + 1) out.push(`page scrolls horizontally (${de.scrollWidth} > ${de.clientWidth})`);
  const scrolls = el => {
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      const o = getComputedStyle(n).overflowX;
      if ((o === 'auto' || o === 'scroll') && n.scrollWidth > n.clientWidth + 1) return true;
    }
    return false;
  };
  const panel = document.querySelector('main') || document.body;
  const pr = panel.getBoundingClientRect();
  let n = 0;
  for (const el of panel.querySelectorAll('*')) {
    if (n > 3) break;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const st = getComputedStyle(el);
    if (st.position === 'fixed' || st.position === 'absolute') continue;
    if (r.right > pr.right + 2 && !scrolls(el)) {
      out.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} runs ${Math.round(r.right - pr.right)}px past the panel`);
      n++;
    }
  }
  return out;
};

(async () => {
  const browser = await chromium.launch();
  const findings = [];
  let views = 0;
  for (const theme of THEMES) {
    for (const [W, H] of SIZES) {
      for (const [runName, files] of RUNS) {
        const page = await browser.newPage({ viewport: { width: W, height: H } });
        const errors = [];
        page.on('pageerror', e => errors.push(e.message));
        page.on('console', m => m.type() === 'error' && errors.push(m.text()));
        await page.addInitScript(t => localStorage.setItem('normaflow.theme', t), theme);
        const tag = `${theme} ${W}px, ${runName}`;
        const check = async view => {
          views++;
          await page.evaluate(src => { if (!window.axe) (0, eval)(src); }, axeSrc);
          const ax = await page.evaluate(() => axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'] }));
          for (const v of ax.violations) findings.push(`${tag} / ${view}: axe ${v.id} x${v.nodes.length}`);
          for (const o of await page.evaluate(overflowProbe)) findings.push(`${tag} / ${view}: ${o}`);
        };
        await page.goto(URL);
        await check('workspace naming dialog');
        await page.getByRole('button', { name: 'Start' }).click();
        await check('pipeline, empty');
        await page.setInputFiles('input[type=file]', files);
        await page.fill('input[aria-label^="Describe"]', REQUEST);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(600);
        await check('pipeline, plan preview');
        await page.getByRole('button', { name: /apply & run/i }).click();
        await page.getByText('Output', { exact: true }).first().click({ timeout: 120000 });
        await page.waitForTimeout(1200);
        const tabs = page.locator('aside[aria-label="Result sections"] button');
        const n = await tabs.count();
        for (let i = 0; i < n; i++) {
          const label = (await tabs.nth(i).locator('span').first().innerText().catch(() => `tab ${i + 1}`)) || `tab ${i + 1}`;
          await tabs.nth(i).click({ timeout: 2500 }).catch(() => {});
          await page.waitForTimeout(label.includes('ERD') ? 2500 : 600);
          await check(`output: ${label}`);
        }
        if (n !== 10) findings.push(`${tag}: expected 10 result tabs, found ${n}`);
        for (const e of errors) findings.push(`${tag}: console/page error: ${e.slice(0, 120)}`);
        await page.close();
      }
    }
  }
  await browser.close();
  console.log(`${views} views checked (${THEMES.length} themes x ${SIZES.length} sizes x ${RUNS.length} runs).`);
  if (findings.length) {
    console.error(`${findings.length} finding(s):\n` + [...new Set(findings)].join('\n'));
    process.exit(1);
  }
  console.log('No overflow, clipped content, console errors or axe violations in any view.');
})();
