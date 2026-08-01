/**
 * Touch-driven scene sweep on a landscape phone viewport.
 *
 * Navigates with the same virtual-action hook the on-screen controls use
 * (`input.tap`), so the tests exercise the player's input path rather than a
 * keyboard path no longer exists. Screenshots every scene, fails on console
 * errors, and checks that on-screen controls meet the 44 CSS px touch target.
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolveExecutable } from './browser.mjs';

const PORT = Number(process.env.SMOKE_PORT ?? 8081);
const OUT = process.env.SHOT_DIR ?? 'shots';
const ROOT = new URL('..', import.meta.url).pathname;

mkdirSync(`${ROOT}/${OUT}`, { recursive: true });

async function serve() {
  const proc = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
  for (let i = 0; i < 80; i++) {
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

await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__lotbw?.scenes?.current, null, { timeout: 30000 });

const settle = (ms = 420) => page.waitForTimeout(ms);
const tap = async (action, times = 1) => {
  for (let i = 0; i < times; i++) {
    await page.evaluate((a) => window.__lotbw.input.tap(a), action);
    await settle(180);
  }
};
const sceneName = () => page.evaluate(() => window.__lotbw.scenes.current?.constructor?.name);
const shot = async (name) => {
  await settle();
  await page.screenshot({ path: `${ROOT}/${OUT}/${name}.png` });
  console.log(`  ${name}  <- ${await sceneName()}`);
};

/**
 * Wait until the named scene is on top, driving `action` until it arrives.
 *
 * Bounded by wall-clock rather than a tap count: the game advances on frame
 * time, so on a slow or GPU-less machine a fixed number of taps is not a
 * fixed amount of game time, and the test would fail for being patient
 * enough only on fast hardware.
 */
async function until(name, action = 'confirm', budgetMS = 45000) {
  const deadline = Date.now() + budgetMS;
  while (Date.now() < deadline) {
    if (await sceneName() === name) return true;
    await tap(action);
  }
  return (await sceneName()) === name;
}

console.log('sweeping:');
await shot('01-title');

// New Voyage -> intro narration -> tutorial battle.
await tap('confirm');
if (!await until('IntroScene')) errors.push('never reached IntroScene');
await shot('02-intro');

if (!await until('BattleScene')) errors.push('never reached BattleScene');
await shot('03-battle');

// Fight it out; the tutorial battle is unloseable.
if (!await until('FieldScene', 'confirm', 120000)) {
  errors.push('battle never resolved into FieldScene');
}
await shot('04-field');

// Clear the opening notice before anything else; the field swallows the log
// button while a conversation is up.
const talkDeadline = Date.now() + 30000;
while (Date.now() < talkDeadline) {
  if (!await page.evaluate(() => !!window.__lotbw.scenes.current?.talking)) break;
  await tap('confirm');
}

// Walk a little so the camera and animation frames are exercised.
await page.evaluate(() => window.__lotbw.input.setStick(1, 0));
await settle(700);
await page.evaluate(() => window.__lotbw.input.setStick(0, 0));
await shot('05-field-walk');

// The ship's log. Scene pushes are async, so wait for it rather than
// sampling the stack the instant after the tap.
await tap('menu');
const opened = await page
  .waitForFunction(() => window.__lotbw.scenes.current?.constructor?.name === 'MenuScene',
    null, { timeout: 15000 })
  .then(() => true, () => false);
if (!opened) errors.push('log did not open');
await shot('06-menu');
await tap('cancel');

/* --- touch target audit ------------------------------------------- */
const audit = await page.evaluate(() => {
  const g = window.__lotbw;
  const scale = parseFloat(g.app.canvas.style.width) / g.width; // CSS px per virtual px
  const out = [];
  for (const [action, b] of g.touch.buttons) {
    if (!b.visible) continue;
    out.push({ action, cssDiameter: b.radius * 2 * scale });
  }
  return { scale, buttons: out, touchUnit: g.touchUnit, unitCss: g.touchUnit * scale };
});
const perf = await page.evaluate(() => ({
  fps: window.__lotbw.quality.fps(),
  tier: window.__lotbw.quality.tier,
}));
console.log(`\nframe rate: ${perf.fps} fps at tier "${perf.tier}"`);
console.log('touch targets:', JSON.stringify(audit, null, 2));
for (const b of audit.buttons) {
  if (b.cssDiameter < 44) errors.push(`touch target "${b.action}" is ${b.cssDiameter.toFixed(1)} CSS px, under 44`);
}
if (audit.unitCss < 43.5) errors.push(`touchUnit resolves to ${audit.unitCss.toFixed(1)} CSS px, under 44`);

await browser.close();
server.kill();

if (errors.length) {
  console.error('\nFAILED:\n' + errors.join('\n'));
  process.exit(1);
}
console.log(`\nsweep OK — shots in ${OUT}/`);
