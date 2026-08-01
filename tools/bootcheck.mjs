/**
 * Minimal boot probe: loads the page in a landscape phone viewport with touch
 * emulation, waits for the game handle, and reports any console error or
 * uncaught exception. Fast enough to run after every change.
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { resolveExecutable, BASE } from './browser.mjs';

const PORT = Number(process.env.SMOKE_PORT ?? 8080);

async function serve() {
  const proc = spawn('python3', ['-m', 'http.server', String(PORT)], {
    cwd: new URL('..', import.meta.url).pathname,
    stdio: 'ignore',
  });
  // Wait for the port to answer rather than sleeping a fixed amount.
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`http://localhost:${PORT}/index.html`);
      if (res.ok) return proc;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('static server did not come up');
}

const server = await serve();
const browser = await chromium.launch({ executablePath: resolveExecutable() });
const context = await browser.newContext({
  viewport: { width: 844, height: 390 },
  deviceScaleFactor: 3,
  hasTouch: true,
  isMobile: true,
});
const page = await context.newPage();

const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

await page.goto(BASE.replace('8080', String(PORT)), { waitUntil: 'load' });

let info = null;
try {
  await page.waitForFunction(() => window.__lotbw && window.__lotbw.scenes.current, null, { timeout: 20000 });
  info = await page.evaluate(() => {
    const g = window.__lotbw;
    return {
      scene: g.scenes.current?.constructor?.name,
      width: g.width,
      height: g.height,
      touchUnit: g.touchUnit,
      resolution: g.app.renderer.resolution,
      canvas: [g.app.canvas.width, g.app.canvas.height],
      css: [g.app.canvas.style.width, g.app.canvas.style.height],
      atlasPages: g.art.canvases?.map((c) => `${c.width}x${c.height}`),
      quality: g.quality.tier,
    };
  });
} catch (err) {
  errors.push(`boot: ${err.message}`);
  const bootMsg = await page.locator('#boot-msg').textContent().catch(() => null);
  if (bootMsg) errors.push(`boot screen said: ${bootMsg.slice(0, 600)}`);
}

if (info) console.log(JSON.stringify(info, null, 2));

await browser.close();
server.kill();

if (errors.length) {
  console.error('\nFAILED:\n' + errors.join('\n'));
  process.exit(1);
}
console.log('\nboot OK');
