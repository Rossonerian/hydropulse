// Screenshot + layout harness for the frontend redesign.
// Playwright is NOT a project dependency. Install it outside the repo and point
// PLAYWRIGHT_DIR at that node_modules folder, e.g.
//   npm i --prefix /tmp/hp-tools playwright
//   PLAYWRIGHT_DIR=/tmp/hp-tools/node_modules node scripts/shots.mjs screenshots/redesign/after
// Optional: BASE_URL (default http://127.0.0.1:5173), VIEWPORTS=1366x768,390x844, STATES=ops-idle,studio-map,
// THEME=day (sets localStorage hp-theme before load).
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const require = createRequire(
  process.env.PLAYWRIGHT_DIR ? join(resolve(process.env.PLAYWRIGHT_DIR), 'noop.js') : import.meta.url,
);
const { chromium } = require('playwright');

const outDir = resolve(process.argv[2] || 'screenshots/redesign/after');
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:5173';
const allViewports = [
  [1920, 1080],
  [1440, 900],
  [1366, 768],
  [1024, 768],
  [768, 1024],
  [390, 844],
  [360, 800],
];
const viewports = process.env.VIEWPORTS
  ? process.env.VIEWPORTS.split(',').map((v) => v.split('x').map(Number))
  : allViewports;
const wanted = process.env.STATES ? new Set(process.env.STATES.split(',')) : null;
mkdirSync(outDir, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Try each locator factory in order; click the first visible match.
async function clickFirst(page, factories, { timeout = 2500 } = {}) {
  for (const make of factories) {
    const loc = make(page).first();
    try {
      await loc.waitFor({ state: 'visible', timeout });
      await loc.click();
      return true;
    } catch {
      /* try next */
    }
  }
  return false;
}

async function overflow(page) {
  return page.evaluate(() => {
    const el = document.documentElement;
    return { scrollWidth: el.scrollWidth, clientWidth: el.clientWidth, overflowX: el.scrollWidth > el.clientWidth };
  });
}

const steps = [
  ['ops-idle', async (page) => page.waitForSelector('.leaflet-container', { timeout: 15000 })],
  [
    'ops-located',
    async (page) => {
      await page.locator('body').click({ position: { x: 2, y: 2 } }).catch(() => {});
      await page.keyboard.press('1');
      await sleep(3500);
    },
  ],
  [
    'ops-isolated',
    async (page) => {
      await page.keyboard.press('i');
      await sleep(1500);
    },
  ],
  [
    'studio-schematic',
    async (page) => {
      await page.keyboard.press('Escape');
      await page.keyboard.press('n');
      await sleep(800);
      const loaded = await clickFirst(page, [
        (p) => p.getByRole('button', { name: /load kengeri sample/i }),
        (p) => p.getByRole('button', { name: /load sample/i }),
      ]);
      if (!loaded) {
        // Redesigned Studio keeps the sample loader inside the File menu.
        await clickFirst(page, [(p) => p.getByRole('button', { name: /^file/i })]);
        await clickFirst(page, [(p) => p.getByRole('menuitem', { name: /load kengeri sample/i })]);
      }
      await sleep(1200);
    },
  ],
  [
    'studio-map',
    async (page) => {
      await clickFirst(page, [
        (p) => p.getByRole('radio', { name: /^map$/i }),
        (p) => p.getByRole('tab', { name: /^map$/i }),
        (p) => p.getByRole('button', { name: /^(gis )?map$/i }),
      ]);
      await sleep(2500);
    },
  ],
  [
    'studio-terrain',
    async (page) => {
      await clickFirst(page, [
        (p) => p.getByRole('radio', { name: /terrain/i }),
        (p) => p.getByRole('tab', { name: /terrain/i }),
        (p) => p.getByRole('button', { name: /terrain/i }),
      ]);
      await sleep(3000);
    },
  ],
  [
    'studio-catalog',
    async (page) => {
      await clickFirst(page, [(p) => p.getByRole('button', { name: /catalog/i })]);
      await sleep(900);
    },
  ],
  [
    'studio-import',
    async (page) => {
      await page.keyboard.press('Escape');
      await sleep(300);
      // Close the catalog explicitly when it does not handle Escape.
      await clickFirst(page, [(p) => p.getByRole('button', { name: /^close/i })], { timeout: 800 });
      await sleep(300);
      await clickFirst(page, [
        (p) => p.getByRole('button', { name: /^import/i }),
        (p) => p.getByRole('button', { name: /stage/i }),
      ]);
      await sleep(900);
    },
  ],
];

const report = [];
const browser = await chromium.launch();
for (const [w, h] of viewports) {
  const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  if (process.env.THEME)
    await context.addInitScript((t) => {
      try {
        localStorage.setItem('hp-theme', t);
      } catch {}
    }, process.env.THEME);
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  for (const [name, run] of steps) {
    const row = { viewport: `${w}x${h}`, state: name };
    try {
      await run(page);
      row.ok = true;
    } catch (e) {
      row.ok = false;
      row.error = e.message.split('\n')[0];
    }
    Object.assign(row, await overflow(page));
    if (!wanted || wanted.has(name)) {
      const file = `${name}-${w}x${h}.png`;
      await page.screenshot({ path: join(outDir, file) });
      row.file = file;
      report.push(row);
    }
  }
  report.push({ viewport: `${w}x${h}`, consoleErrors });
  await context.close();
}
await browser.close();
writeFileSync(join(outDir, 'report.json'), JSON.stringify(report, null, 2));
for (const r of report) {
  if (r.consoleErrors) console.log(`${r.viewport} console errors: ${r.consoleErrors.length}`, r.consoleErrors.slice(0, 5));
  else console.log(`${r.viewport} ${r.state} ok=${r.ok} overflowX=${r.overflowX} (${r.scrollWidth}/${r.clientWidth})${r.error ? ' ' + r.error : ''}`);
}
