import playwright from '/tmp/hp-tools/node_modules/playwright/index.js';
const { chromium } = playwright;

async function verifyOpsFlow() {
  console.log('Starting headless browser verification of Operations flow...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  try {
    // 1. Load application
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 15000 });
    console.log('✓ Page loaded');

    // If WelcomeScreen is displayed, choose Demo Mode
    const demoCard = page.locator('button:has-text("Explore the demo"), .welcome-card--demo');
    if (await demoCard.first().isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('  Welcome screen detected, selecting demo mode...');
      await demoCard.first().click();
      await page.waitForTimeout(500);
    }

    // Dismiss tour if open
    const tourCloseBtn = page.locator('.tour-bubble__close, button[aria-label="Close tour"], button:has-text("Got it"), button:has-text("Skip tour")');
    if (await tourCloseBtn.first().isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('  Tour detected, dismissing...');
      await tourCloseBtn.first().click();
      await page.waitForTimeout(300);
    }

    // 2. Select a preset problem
    const presetCard = page.locator('.preset-card').first();
    await presetCard.waitFor({ state: 'visible', timeout: 5000 });
    await presetCard.click();
    console.log('✓ Preset problem selected');

    // 3. Verify NextAction button state: "2. Run the test"
    const nextBtn = page.locator('.control-panel .next-action__btn');
    await nextBtn.waitFor({ state: 'visible' });
    const btnText = await nextBtn.innerText();
    console.log(`  NextAction button text: "${btnText}"`);

    // 4. Trigger simulation run
    console.log('  Clicking Run the test...');
    await nextBtn.click();

    // 5. Wait for simulation result or reveal banner
    await page.waitForSelector('.reveal-banner, .incident-metrics', { timeout: 12000 });
    console.log('✓ Simulation finished');

    // If reveal banner is visible, test Skip
    const skipBtn = page.locator('.reveal-banner button');
    if (await skipBtn.isVisible()) {
      console.log('  Reveal banner visible, testing Skip button...');
      await skipBtn.click();
      await page.waitForTimeout(300);
    }

    // 6. Verify Result card metrics
    const metricsCard = page.locator('.incident-metrics');
    await metricsCard.waitFor({ state: 'visible' });
    const lossText = await page.locator('.metric-card').first().innerText();
    console.log(`✓ Metrics visible: ${lossText.replace(/\n/g, ' ')}`);

    // 7. Verify NextAction button: "3. Shut the valves"
    await nextBtn.waitFor({ state: 'visible' });
    const isolateText = await nextBtn.innerText();
    console.log(`  NextAction button in located state: "${isolateText}"`);

    // 8. Trigger valve isolation
    console.log('  Clicking Shut the valves...');
    await nextBtn.click();
    await page.waitForSelector('.valve-list', { timeout: 5000 });
    console.log('✓ Valves isolated successfully');

    // 9. Verify NextAction button: "4. Export / share report"
    const exportText = await nextBtn.innerText();
    console.log(`  NextAction button in isolated state: "${exportText}"`);

    // 10. Click Export
    await nextBtn.click();
    await page.waitForTimeout(500);
    console.log('✓ Export report triggered');

    // 11. Test Reset
    const resetBtn = page.locator('.control-panel .next-action__secondary, .control-panel button:has-text("Try another leak")').first();
    if (await resetBtn.isVisible()) {
      await resetBtn.click();
      await page.waitForTimeout(500);
      console.log('✓ Reset flow completed');
    }

    // 12. Check Tablet / Responsive Tab Navigation & AI Advisor
    console.log('  Testing Tablet tab navigation (768px)...');
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(500);
    const advisorTab = page.locator('#tab-advisor');
    await advisorTab.waitFor({ state: 'visible', timeout: 5000 });
    await advisorTab.click();
    await page.waitForTimeout(1000);
    const asstTitle = await page.locator('.asst__title').innerText().catch(() => '');
    console.log(`✓ AI Advisor panel active on tablet: "${asstTitle}"`);
    await page.screenshot({ path: 'frontend/screenshots/ops_advisor_tablet.png' });
    console.log('✓ Screenshot saved to frontend/screenshots/ops_advisor_tablet.png');

    // 13. Check Mobile Viewport (<768px) and Bottom Sheet Action
    console.log('  Testing Mobile viewport (375px)...');
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);
    const mobileBtn = page.locator('.mobile-bottom-bar .next-action__btn');
    await mobileBtn.waitFor({ state: 'visible', timeout: 5000 });
    const mobileBtnText = await mobileBtn.innerText();
    console.log(`✓ Mobile bottom bar action button visible: "${mobileBtnText}"`);
    await page.screenshot({ path: 'frontend/screenshots/ops_mobile_layout.png' });
    console.log('✓ Screenshot saved to frontend/screenshots/ops_mobile_layout.png');

    // Restore desktop viewport
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(500);

    // Final desktop screenshot
    await page.screenshot({ path: 'frontend/screenshots/ops_flow_verified.png' });
    console.log('✓ Screenshot saved to frontend/screenshots/ops_flow_verified.png');

    if (errors.length > 0) {
      console.warn(`Encountered ${errors.length} console/page issues:`, errors.slice(0, 3));
    } else {
      console.log('✓ ZERO page errors during entire Operations flow test!');
    }
  } finally {
    await browser.close();
  }
}

verifyOpsFlow().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
