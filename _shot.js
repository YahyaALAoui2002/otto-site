const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();

  const pages = {
    fr_desktop: { file: 'index.html', viewport: { width: 1440, height: 900 } },
    fr_mobile: { file: 'index.html', viewport: { width: 390, height: 844 } },
    en_desktop: { file: 'en/index.html', viewport: { width: 1440, height: 900 } },
  };

  for (const [label, cfg] of Object.entries(pages)) {
    const url = 'file:///' + path.resolve(__dirname, cfg.file).replace(/\\/g, '/');
    const page = await browser.newPage({ viewport: cfg.viewport, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('requestfailed', (r) => errors.push('REQFAIL ' + r.url()));
    await page.goto(url);
    await page.waitForTimeout(500);
    await page.screenshot({ path: `_shot_${label}.png` });
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    console.log(label, 'scrollWidth=', scrollWidth, 'viewport=', cfg.viewport.width, scrollWidth > cfg.viewport.width ? 'OVERFLOW' : 'ok', errors.length ? 'ERRORS:' + errors.join('|') : '');
    await page.close();
  }

  await browser.close();
})();
