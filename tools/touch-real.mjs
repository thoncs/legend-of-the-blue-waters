/**
 * Real-pointer touch test.
 *
 * The other tools drive `input.tap()`, which exercises the action layer but
 * skips everything above it: Pixi's event system, hit areas, control schemes,
 * and — the thing that actually shipped broken — whether some decorative
 * full-screen layer is quietly swallowing every hit test. This one dispatches
 * genuine touch events at real screen coordinates, so it covers the path a
 * thumb takes.
 */
import { chromium, devices } from 'playwright';
import { spawn } from 'node:child_process';
import { resolveExecutable } from './browser.mjs';

const PORT = Number(process.env.SMOKE_PORT ?? 8090);
const ROOT = new URL('..', import.meta.url).pathname;

async function serve() {
  const proc = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
  for (let i = 0; i < 80; i++) {
    try { if ((await fetch(`http://localhost:${PORT}/index.html`)).ok) return proc; } catch { /* wait */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('static server did not come up');
}

const server = await serve();
const browser = await chromium.launch({ executablePath: resolveExecutable() });

// A real iPhone profile, rotated to landscape.
const iPhone = devices['iPhone 13'];
const page = await (await browser.newContext({
  ...iPhone,
  viewport: { width: iPhone.viewport.height, height: iPhone.viewport.width },
  isMobile: true,
  hasTouch: true,
})).newPage();

const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text().slice(0, 300)}`); });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load' });

const sceneName = () => page.evaluate(() => window.__lotbw?.scenes?.current?.constructor?.name);

/** Wait for the top scene to become `name`, or for it to simply change. */
async function waitScene(pred, budgetMS = 20000) {
  const deadline = Date.now() + budgetMS;
  while (Date.now() < deadline) {
    if (pred(await sceneName())) return true;
    await page.waitForTimeout(250);
  }
  return false;
}

/* --- 1. boot ------------------------------------------------------- */
const booted = await page
  .waitForFunction(() => window.__lotbw?.scenes?.current, null, { timeout: 25000 })
  .then(() => true, () => false);
if (!booted) {
  const msg = await page.locator('#boot-msg').textContent().catch(() => '(none)');
  errors.push(`never booted — boot screen says: ${String(msg).slice(0, 500)}`);
}

if (booted) {
  /* --- 2. nothing DOM-side is covering the stage ------------------- */
  const covers = await page.evaluate(() => {
    const out = [];
    const boot = document.getElementById('boot');
    if (boot && getComputedStyle(boot).pointerEvents !== 'none') out.push('#boot');
    const rot = document.getElementById('rotate-prompt');
    if (rot && getComputedStyle(rot).display !== 'none') out.push('#rotate-prompt');
    return out;
  });
  for (const c of covers) errors.push(`${c} is covering the stage and will eat every touch`);

  /* --- 3. no decorative layer is stealing hits --------------------- */
  // The regression that shipped: a full-screen Sprite in fxRoot with the
  // default eventMode. Pixi hit-tests a Sprite by its bounds whether or not
  // it ever emits events, so it blanketed the whole game.
  const thieves = await page.evaluate(() => {
    const g = window.__lotbw;
    const bad = [];
    const walk = (node, path) => {
      for (const c of node.children ?? []) {
        const name = c.label || c.constructor.name;
        const here = `${path}/${name}`;
        // Only leaf render objects block a hit test; plain Containers do not.
        const isLeaf = typeof c.containsPoint === 'function';
        if (isLeaf && c.visible && c.eventMode !== 'none') {
          let b = null;
          try { b = c.getBounds(); } catch { /* not measurable */ }
          const fullScreen = b && b.width >= g.width * 0.95 && b.height >= g.height * 0.95;
          const listens = (c.listenerCount?.('pointertap') ?? 0) + (c.listenerCount?.('pointerdown') ?? 0);
          if (fullScreen && listens === 0) bad.push(`${here} (${c.eventMode})`);
        }
        if (c.children?.length) walk(c, here);
      }
    };
    walk(g.app.stage, '');
    return bad;
  });
  for (const t of thieves) {
    errors.push(`full-screen layer may swallow touches: ${t} — set eventMode = 'none'`);
  }

  /* --- 3b. every on-screen control has real bounds ----------------- */
  // Pixi's Container keeps internal fields like `_origin`; shadowing one
  // corrupts the world transform and silently zeroes the bounds of every
  // child, so the controls render but cannot be hit. Measure, do not assume.
  const zeroed = await page.evaluate(() => {
    const g = window.__lotbw;
    const out = [];
    const wt = g.touch.worldTransform;
    if (!Number.isFinite(wt.tx) || !Number.isFinite(wt.ty)) {
      out.push(`TouchControls world transform is broken (tx=${wt.tx}, ty=${wt.ty})`);
    }
    for (const [action, b] of g.touch.buttons) {
      if (!b.visible) continue;
      const r = b.getBounds();
      if (r.width < 1 || r.height < 1) out.push(`button "${action}" has zero bounds`);
    }
    return out;
  });
  for (const z of zeroed) errors.push(z);

  /** Tap the centre of a display object, addressed from the game handle. */
  async function tapObject(pick, label) {
    const pos = await page.evaluate((src) => {
      // eslint-disable-next-line no-new-func
      const obj = new Function('g', `return (${src})(g)`)(window.__lotbw);
      if (!obj || !obj.visible) return null;
      const b = obj.getBounds();
      const g = window.__lotbw;
      const r = g.app.canvas.getBoundingClientRect();
      const vx = b.x + b.width / 2;
      const vy = b.y + b.height / 2;
      return { x: r.left + (vx / g.width) * r.width, y: r.top + (vy / g.height) * r.height };
    }, pick.toString());
    if (!pos) { errors.push(`${label}: target missing or hidden`); return false; }
    await page.touchscreen.tap(pos.x, pos.y);
    await page.waitForTimeout(250);
    return true;
  }

  console.log('boot scene:', await sceneName());

  /* --- 4. tap a title menu row ------------------------------------- */
  await tapObject((g) => g.scenes.current.menu?._rows?.[0]?.root, 'title menu row');
  if (!await waitScene((s) => s === 'IntroScene', 12000)) {
    // Lists may want a second commit tap; give it one before failing.
    await tapObject((g) => g.scenes.current.menu?._rows?.[0]?.root, 'title menu row (2nd)');
    if (!await waitScene((s) => s === 'IntroScene', 12000)) {
      errors.push('tapping "New Voyage" never started the game');
    }
  }
  console.log('after tapping New Voyage:', await sceneName());

  /* --- 5. tap-anywhere advances the intro -------------------------- */
  if (await sceneName() === 'IntroScene') {
    const box = page.viewportSize();
    for (let i = 0; i < 40 && await sceneName() === 'IntroScene'; i++) {
      await page.touchscreen.tap(box.width * 0.5, box.height * 0.35);
      await page.waitForTimeout(300);
    }
    if (await sceneName() !== 'BattleScene') {
      errors.push('tapping the screen never advanced the intro into the battle');
    }
  }
  console.log('after tapping through the intro:', await sceneName());

  /* --- 6. the on-screen confirm button drives the battle ----------- */
  if (await sceneName() === 'BattleScene') {
    const deadline = Date.now() + 120000;
    while (Date.now() < deadline && await sceneName() === 'BattleScene') {
      await tapObject((g) => g.touch.buttons.get('confirm'), 'confirm button');
      await page.waitForTimeout(150);
    }
    if (await sceneName() !== 'FieldScene') {
      errors.push('the on-screen confirm button never resolved the battle');
    }
  }
  console.log('after the battle:', await sceneName());

  /* --- 7. the stick moves the player ------------------------------- */
  if (await sceneName() === 'FieldScene') {
    // Clear the opening notice first — the field is in "tap to advance".
    const talkEnd = Date.now() + 30000;
    const box = page.viewportSize();
    while (Date.now() < talkEnd
      && await page.evaluate(() => !!window.__lotbw.scenes.current.talking)) {
      await page.touchscreen.tap(box.width * 0.5, box.height * 0.4);
      await page.waitForTimeout(250);
    }

    const before = await page.evaluate(() => {
      const p = window.__lotbw.scenes.current.player; return { x: p.tx, y: p.ty };
    });
    // A real drag in the stick zone: press low-left, drag right, hold, release.
    await page.touchscreen.tap(box.width * 0.2, box.height * 0.75); // wake the zone
    await page.mouse.move(box.width * 0.2, box.height * 0.75);
    await page.evaluate(async ([x0, y0]) => {
      const el = document.querySelector('#stage-host canvas');
      const send = (type, x, y) => el.dispatchEvent(new PointerEvent(type, {
        pointerId: 1, pointerType: 'touch', isPrimary: true, bubbles: true,
        cancelable: true, clientX: x, clientY: y,
      }));
      send('pointerdown', x0, y0);
      for (let i = 1; i <= 12; i++) { send('pointermove', x0 + i * 8, y0); await new Promise((r) => setTimeout(r, 40)); }
      await new Promise((r) => setTimeout(r, 900));
      send('pointerup', x0 + 96, y0);
    }, [box.width * 0.2, box.height * 0.75]);
    await page.waitForTimeout(400);
    const after = await page.evaluate(() => {
      const p = window.__lotbw.scenes.current.player; return { x: p.tx, y: p.ty };
    });
    if (before.x === after.x && before.y === after.y) {
      errors.push(`dragging the stick did not move the player (still at ${after.x},${after.y})`);
    } else {
      console.log(`stick moved the player ${before.x},${before.y} -> ${after.x},${after.y}`);
    }

    /* --- 8. the log button opens the ship's log -------------------- */
    await tapObject((g) => g.touch.buttons.get('menu'), 'log button');
    if (!await waitScene((s) => s === 'MenuScene', 12000)) {
      errors.push('the on-screen log button did not open the ship\'s log');
    }
    console.log('after tapping the log button:', await sceneName());
  }
}

await browser.close();
server.kill();

if (errors.length) {
  console.error('\nFAILED:\n' + errors.join('\n'));
  process.exit(1);
}
console.log('\nreal touch OK');
