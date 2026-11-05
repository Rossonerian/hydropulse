// Accessibility (a11y) test runner using axe-core and Playwright.
// Tests ops idle/located/isolated and studio schematic/catalog/import
// across night/day themes at 1366x768 and 390x844.
// Writes a11y.json and prints a summary highlighting color-contrast.

import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const playwrightDir = process.env.PLAYWRIGHT_DIR || '/tmp/hp-tools/node_modules';
const require = createRequire(join(resolve(playwrightDir), 'noop.js'));
const { chromium } = require('playwright');

const outDir = resolve(process.argv[2] || '/tmp/hp-a11y');
mkdirSync(outDir, { recursive: true });

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:5173';
const axePath = resolve(playwrightDir, 'axe-core/axe.min.js');

const viewports = [
  { width: 1366, height: 768, label: '1366x768' },
  { width: 390, height: 844, label: '390x844' },
];
const themes = ['night', 'day'];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function clickFirst(page, locators, { timeout = 800 } = {}) {
  for (const locFactory of locators) {
    try {
      const loc = locFactory(page).first();
      await loc.waitFor({ state: 'visible', timeout });
      await loc.click({ timeout });
      return true;
    } catch {}
  }
  return false;
}

async function runAxe(page) {
  try {
    await page.addScriptTag({ path: axePath });
    const axeResults = await page.evaluate(async () => {
      if (!window.axe) throw new Error('axe-core not loaded on window');
      return await window.axe.run(document, {
        resultTypes: ['violations'],
      });
    });
    return axeResults.violations || [];
  } catch (err) {
    return [{ axeError: err.message }];
  }
}

const states = [
  {
    name: 'ops-idle',
    setup: async (page) => {
      // already at base url
      await sleep(300);
    },
  },
  {
    name: 'ops-located',
    setup: async (page) => {
      const clicked = await clickFirst(page, [
        (p) => p.getByRole('button', { name: /kengeri mainline|rupture|preset 1|scenario 1/i }),
        (p) => p.locator('.preset-card').first(),
      ], { timeout: 800 });
      if (!clicked) {
        await page.keyboard.press('1').catch(() => {});
      }
      await sleep(600);
    },
  },
  {
    name: 'ops-isolated',
    setup: async (page) => {
      await page.keyboard.press('i').catch(() => {});
      await clickFirst(page, [
        (p) => p.getByRole('button', { name: /isolate valves/i }),
        (p) => p.locator('button.isolate-button'),
      ], { timeout: 800 });
      await sleep(400);
    },
  },
  {
    name: 'studio-schematic',
    setup: async (page) => {
      const clicked = await clickFirst(page, [
        (p) => p.getByRole('link', { name: /network studio/i }),
        (p) => p.getByRole('button', { name: /network studio/i }),
        (p) => p.locator('button[aria-label*="Network Studio" i]'),
      ], { timeout: 800 });
      if (!clicked) {
        await page.keyboard.press('n').catch(() => {});
      }
      await sleep(600);
    },
  },
  {
    name: 'studio-catalog',
    setup: async (page) => {
      await clickFirst(page, [
        (p) => p.getByRole('button', { name: /catalog/i }),
        (p) => p.locator('button[title*="Catalog" i]'),
      ], { timeout: 800 });
      await sleep(400);
    },
  },
  {
    name: 'studio-import',
    setup: async (page) => {
      await page.keyboard.press('Escape').catch(() => {});
      await clickFirst(page, [
        (p) => p.getByRole('button', { name: /^import/i }),
        (p) => p.locator('button[title*="Import" i]'),
      ], { timeout: 800 });
      await sleep(400);
    },
  },
];

console.log('Starting accessibility audit (a11y)...');
console.log(`Base URL: ${baseUrl}`);
console.log(`Viewports: ${viewports.map((v) => v.label).join(', ')}`);
console.log(`Themes: ${themes.join(', ')}`);
console.log(`States: ${states.map((s) => s.name).join(', ')}`);
console.log('--------------------------------------------------');

const browser = await chromium.launch();
const allResults = [];
const colorContrastIssues = [];
const violationsByRule = {};
const violationsByImpact = { critical: 0, serious: 0, moderate: 0, minor: 0, unknown: 0 };

try {
  for (const theme of themes) {
    for (const vp of viewports) {
      console.log(`\nTesting theme: [${theme}] at viewport: [${vp.label}]`);
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
      });
      context.setDefaultTimeout(2000);

      await context.addInitScript((th) => {
        try {
          localStorage.setItem('hp-theme', th);
          document.documentElement.setAttribute('data-theme', th);
        } catch {}
      }, theme);

      const page = await context.newPage();

      try {
        await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 5000 });
      } catch (err) {
        console.warn(`Initial page load warning: ${err.message}`);
      }

      for (const st of states) {
        process.stdout.write(`  State: ${st.name.padEnd(18)} ... `);
        try {
          await st.setup(page);
        } catch (setupErr) {
          // Continue to axe evaluation even if specific interaction failed
        }

        const violations = await runAxe(page);
        const hasAxeError = violations.some((v) => v.axeError);

        let contrastCount = 0;
        let validViolations = 0;

        if (!hasAxeError) {
          for (const viol of violations) {
            validViolations++;
            const impact = viol.impact || 'unknown';
            violationsByImpact[impact] = (violationsByImpact[impact] || 0) + viol.nodes.length;
            violationsByRule[viol.id] = (violationsByRule[viol.id] || 0) + viol.nodes.length;

            if (viol.id === 'color-contrast') {
              contrastCount += viol.nodes.length;
              for (const node of viol.nodes) {
                const targetSel = node.target.join(' ');
                colorContrastIssues.push({
                  theme,
                  viewport: vp.label,
                  state: st.name,
                  target: targetSel,
                  html: node.html.slice(0, 100),
                  failureSummary: node.failureSummary,
                });
              }
            }
          }
        }

        console.log(`violations: ${validViolations} (contrast: ${contrastCount})${hasAxeError ? ' [Axe error: ' + violations[0].axeError + ']' : ''}`);

        allResults.push({
          theme,
          viewport: vp.label,
          state: st.name,
          violations: hasAxeError ? [] : violations,
          error: hasAxeError ? violations[0].axeError : null,
        });
      }

      await context.close().catch(() => {});
    }
  }
} finally {
  await browser.close().catch(() => {});
}

const summary = {
  totalRuns: allResults.length,
  successfulRuns: allResults.filter((r) => !r.error).length,
  totalViolationsInstances: Object.values(violationsByRule).reduce((a, b) => a + b, 0),
  byImpact: violationsByImpact,
  byRule: violationsByRule,
  colorContrastCount: colorContrastIssues.length,
  colorContrastIssues: colorContrastIssues.slice(0, 20),
};

const jsonPath = join(outDir, 'a11y.json');
writeFileSync(jsonPath, JSON.stringify({ summary, details: allResults }, null, 2));

console.log('\n==================================================');
console.log('             A11Y AUDIT SUMMARY                   ');
console.log('==================================================');
console.log(`Total state/theme/viewport runs : ${summary.totalRuns}`);
console.log(`Successful scans                : ${summary.successfulRuns}`);
console.log(`Total violation instances       : ${summary.totalViolationsInstances}`);
console.log('\nViolations by Impact:');
for (const [imp, count] of Object.entries(violationsByImpact)) {
  console.log(`  - ${imp.padEnd(10)}: ${count}`);
}
console.log('\nTop Violations by Rule:');
const sortedRules = Object.entries(violationsByRule).sort((a, b) => b[1] - a[1]);
for (const [rule, count] of sortedRules.slice(0, 10)) {
  console.log(`  - ${rule.padEnd(25)}: ${count}`);
}

console.log('\nColor Contrast Highlight:');
console.log(`Total contrast violations: ${colorContrastIssues.length}`);
if (colorContrastIssues.length > 0) {
  console.log('Sample contrast issues:');
  for (const item of colorContrastIssues.slice(0, 6)) {
    console.log(`  [${item.theme} | ${item.viewport} | ${item.state}] ${item.target} -> ${(item.failureSummary || '').split('\n')[0]}`);
  }
}
console.log('==================================================');
console.log(`Results written to: ${jsonPath}`);
