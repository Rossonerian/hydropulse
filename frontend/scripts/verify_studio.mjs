import playwright from '/tmp/hp-tools/node_modules/playwright/index.js';
const { chromium } = playwright;

async function verifyStudio() {
  console.log('Starting headless browser verification of Network Studio...');
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

    // Dismiss welcome screen if open
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

    // 2. Switch to Network Editor (Studio)
    const studioNavBtn = page.locator('button:has-text("Network editor"), .topbar-nav-btn:has-text("Network editor")');
    await studioNavBtn.waitFor({ state: 'visible', timeout: 5000 });
    await studioNavBtn.click();
    await page.waitForTimeout(1000);
    console.log('✓ Switched to Network Studio view');

    // 3. Verify Mode 1: 2D Schematic
    console.log('  Checking 2D Schematic mode...');
    const schematicCanvas = page.locator('.stu-shell-canvas, .react-flow');
    await schematicCanvas.first().waitFor({ state: 'visible', timeout: 5000 });
    const tools = page.locator('.stu-shell-tools');
    await tools.waitFor({ state: 'visible', timeout: 5000 });
    console.log('✓ 2D Schematic and Tool Rail active');

    // Capture 2D Schematic desktop screenshot
    await page.screenshot({ path: 'frontend/screenshots/studio_schematic_desktop.png' });
    console.log('✓ Screenshot saved to frontend/screenshots/studio_schematic_desktop.png');

    // 4. Switch to Mode 2: GIS Geographic Map
    console.log('  Switching to GIS Geographic mode...');
    const gisBtn = page.locator('button[title*="Geographic"], button:has-text("GIS Map"), button:has-text("Geographic"), .stu-bar button:has-text("GIS")');
    if (await gisBtn.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await gisBtn.first().click();
      await page.waitForTimeout(1500);
      console.log('✓ Clicked GIS Map mode');
    } else {
      // Find mode selector buttons in StudioBar
      const modeButtons = page.locator('.stu-bar-segmented button, .stu-bar button');
      const count = await modeButtons.count();
      for (let i = 0; i < count; i++) {
        const text = await modeButtons.nth(i).innerText();
        if (/GIS|Geographic|Map/i.test(text)) {
          await modeButtons.nth(i).click();
          await page.waitForTimeout(1500);
          console.log(`✓ Clicked mode button: "${text}"`);
          break;
        }
      }
    }

    // Capture GIS desktop screenshot
    await page.screenshot({ path: 'frontend/screenshots/studio_gis_desktop.png' });
    console.log('✓ Screenshot saved to frontend/screenshots/studio_gis_desktop.png');

    // 5. Switch to Mode 3: 3D Terrain
    console.log('  Switching to 3D Terrain mode...');
    const terrainBtn = page.locator('button[title*="Terrain"], button:has-text("3D Terrain"), button:has-text("Terrain"), .stu-bar button:has-text("3D")');
    if (await terrainBtn.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await terrainBtn.first().click();
      await page.waitForTimeout(1500);
      console.log('✓ Clicked 3D Terrain mode');
    } else {
      const modeButtons = page.locator('.stu-bar-segmented button, .stu-bar button');
      const count = await modeButtons.count();
      for (let i = 0; i < count; i++) {
        const text = await modeButtons.nth(i).innerText();
        if (/3D|Terrain/i.test(text)) {
          await modeButtons.nth(i).click();
          await page.waitForTimeout(1500);
          console.log(`✓ Clicked mode button: "${text}"`);
          break;
        }
      }
    }

    // Capture 3D Terrain desktop screenshot
    await page.screenshot({ path: 'frontend/screenshots/studio_terrain_desktop.png' });
    console.log('✓ Screenshot saved to frontend/screenshots/studio_terrain_desktop.png');

    // 6. Test Tablet Layout (1024x768)
    console.log('  Testing Tablet layout (1024x768)...');
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'frontend/screenshots/studio_tablet_layout.png' });
    console.log('✓ Screenshot saved to frontend/screenshots/studio_tablet_layout.png');

    if (errors.length > 0) {
      console.warn(`Encountered ${errors.length} console/page issues in Studio:`, errors.slice(0, 3));
    } else {
      console.log('✓ ZERO page errors during entire Studio verification!');
    }
  } finally {
    await browser.close();
  }
}

verifyStudio().catch((err) => {
  console.error('Studio verification failed:', err);
  process.exit(1);
});
