/**
 * End-to-end smoke test (optional dev tool).
 *
 *   npx playwright install chromium     # once, if you have no browser
 *   python3 -m http.server 8080 &       # serve the project root
 *   node tools/smoke.mjs                # drive the game and screenshot it
 *
 * It boots the page, fails on any console error or uncaught rejection, then
 * plays: title -> new game -> intro -> tutorial battle -> town -> menu ->
 * journal -> sea chart. Screenshots land in tools/shots/.
 */
import { chromium } from 'playwright';
import { mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SHOTS = join(HERE, 'shots');
const BASE = process.env.SMOKE_URL ?? 'http://localhost:8080/';

/** Use the browser the environment already has, if any. */
function resolveExecutable() {
  if (process.env.SMOKE_CHROME) return process.env.SMOKE_CHROME;
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (root && existsSync(root)) {
    const dir = readdirSync(root).filter((d) => /^chromium-\d+$/.test(d)).sort().pop();
    if (dir) {
      const candidate = join(root, dir, 'chrome-linux', 'chrome');
      if (existsSync(candidate)) return candidate;
    }
  }
  return undefined;
}

const errors = [];

async function main() {
  mkdirSync(SHOTS, { recursive: true });
  const executablePath = resolveExecutable();
  const browser = await chromium.launch({ executablePath, args: ['--no-sandbox', '--mute-audio'] });
  const page = await browser.newPage({ viewport: { width: 1160, height: 700 } });

  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
  });
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));

  const shot = async (name) => {
    await page.screenshot({ path: join(SHOTS, `${name}.png`) });
    console.log(`  · ${name}.png`);
  };
  const key = async (k, times = 1, delay = 240) => {
    for (let i = 0; i < times; i++) {
      await page.keyboard.press(k);
      await page.waitForTimeout(delay);
    }
  };

  console.log(`booting ${BASE}`);
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window.__lotbw), null, { timeout: 20000 });
  await page.waitForTimeout(700);

  const scene = () => page.evaluate(() => window.__lotbw.scenes.current?.constructor.name);

  console.log('title screen');
  await shot('01-title');

  console.log('new game + intro');
  await page.keyboard.press('KeyZ');
  await page.waitForTimeout(900);
  await shot('02-intro');
  await key('KeyZ', 10, 320);
  await shot('03-first-battle');

  console.log(`scene: ${await scene()}`);

  // Fight through the tutorial battle: attack, attack, attack…
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press('KeyZ');
    await page.waitForTimeout(240);
    const s = await scene();
    if (s === 'FieldScene') break;
  }
  await page.waitForTimeout(1200);
  await shot('04-marrowport');
  console.log(`scene: ${await scene()}`);

  console.log('walking and talking');
  await key('ArrowLeft', 2, 200);
  await key('ArrowDown', 1, 200);
  await page.keyboard.press('KeyZ');
  await page.waitForTimeout(400);
  await shot('05-dialogue');
  await key('KeyZ', 8, 260);

  console.log('menus');
  await page.keyboard.press('KeyC');
  await page.waitForTimeout(600);
  await shot('06-menu-crew');
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(300);
  await shot('07-menu-gear');
  await page.keyboard.press('KeyQ');
  await page.waitForTimeout(400);
  await shot('08-journal');
  await page.keyboard.press('KeyX');
  await page.waitForTimeout(500);

  console.log('putting to sea');
  await page.evaluate(() => {
    const g = window.__lotbw;
    g.state.position = { map: 'marrowport', x: 16, y: 17, dir: 'down' };
  });
  await key('ArrowDown', 6, 200);
  await page.waitForTimeout(900);
  const s2 = await scene();
  console.log(`scene: ${s2}`);
  await shot('09-sea-or-port');
  await page.keyboard.press('KeyM');
  await page.waitForTimeout(500);
  await shot('10-chart');

  await browser.close();

  if (errors.length) {
    console.error(`\n${errors.length} PAGE ERROR(S):`);
    for (const e of errors) console.error('  ' + e);
    process.exit(1);
  }
  console.log('\nNo console errors. Screenshots in tools/shots/.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
