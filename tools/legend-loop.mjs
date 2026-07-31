/**
 * Plays the first legend end to end through the real game loop: recruiting,
 * the rumour, resting to nightfall, sailing, lighting the beacons, the boss,
 * the reward and the world-state change.
 *
 *   python3 -m http.server 8080 &
 *   node tools/legend-loop.mjs
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveExecutable, BASE } from './browser.mjs';

const OUT = join(dirname(fileURLToPath(import.meta.url)), 'shots-loop');
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: resolveExecutable(), args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 800, height: 470 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message + ' | ' + (e.stack || '').split('\n')[1]));
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForFunction(() => Boolean(window.__lotbw));

let fails = 0;
const check = (cond, msg) => { console.log(`  ${cond ? 'ok  ' : 'FAIL'} ${msg}`); if (!cond) fails++; };
const shot = async (n) => page.screenshot({ path: `${OUT}/${n}.png` });
const scene = () => page.evaluate(() => window.__lotbw.scenes.current?.constructor.name);
const st = (fn) => page.evaluate(fn);

/** Stand next to a tile and face it. */
const faceTile = (x, y, dir) => page.evaluate(([tx, ty, d]) => {
  const s = window.__lotbw.scenes.current;
  const back = { up: [0, 1], down: [0, -1], left: [1, 0], right: [-1, 0] }[d];
  s.player.tx = tx + back[0]; s.player.ty = ty + back[1];
  s.player.fromX = s.player.tx; s.player.fromY = s.player.ty;
  s.player.moveT = 1; s.player.moving = false; s.player.dir = d;
}, [x, y, dir]);

const interact = async () => {
  await page.evaluate(() => window.__lotbw.scenes.current.interact());
  await page.waitForTimeout(200);
};

/** Press Z until the dialogue queue drains. */
const talkThrough = async (max = 40) => {
  for (let i = 0; i < max; i++) {
    const talking = await page.evaluate(() => Boolean(window.__lotbw.scenes.current?.talking));
    if (!talking) return;
    await page.keyboard.press('KeyZ');
    await page.waitForTimeout(170);
  }
};

console.log('\n== new game ==');
await st(async () => {
  const g = window.__lotbw;
  g.state.newGame();
  const { FieldScene } = await import('/src/scenes/FieldScene.js');
  await g.scenes.replace(FieldScene, { mapId: 'marrowport' }, { fade: false });
});
await page.waitForTimeout(400);
check(await scene() === 'FieldScene', 'field scene loaded');
check(await st(() => window.__lotbw.state.party.length) === 1, 'starts with Nia alone');

console.log('\n== recruiting ==');
await faceTile(16, 16, 'down');
await interact();
await talkThrough();
check(await st(() => window.__lotbw.state.has('rook')), 'Rook joins on the dock');

await faceTile(12, 3, 'up');
await interact();
await talkThrough();
check(await st(() => window.__lotbw.state.has('yerena')), 'Yerena joins at the chapel');
await shot('01-crew');

console.log('\n== rumour ==');
await faceTile(21, 14, 'right');
await interact();
await talkThrough();
check(['rumored', 'active'].includes(await st(() => window.__lotbw.state.legendState('lanternGalleon'))), 'harbourmaster gives the rumour');
console.log('   objective:', await st(async () => {
  const { objectiveText } = await import('/src/systems/quests.js');
  return objectiveText(window.__lotbw.state, 'lanternGalleon');
}));

console.log('\n== the inn ==');
await faceTile(25, 13, 'right');
await interact();
await talkThrough();
// The rest menu is a choice overlay: pick "Wait for nightfall".
await page.keyboard.press('ArrowDown'); await page.waitForTimeout(180);
await page.keyboard.press('KeyZ'); await page.waitForTimeout(320);
await talkThrough();
check(await st(() => window.__lotbw.state.isNight), 'resting to nightfall works');
await shot('02-night');

console.log('\n== sailing ==');
await st(async () => {
  const g = window.__lotbw;
  const { SeaChartScene } = await import('/src/scenes/SeaChartScene.js');
  await g.scenes.replace(SeaChartScene, {}, { fade: false });
});
await page.waitForTimeout(400);
check(await scene() === 'SeaChartScene', 'sea chart entered');
await st(() => {
  const s = window.__lotbw.scenes.current;
  const port = s.ports.find((p) => p.id === 'moonwrack');
  s.ship.tx = port.x; s.ship.ty = port.y;
  s.ship.fromX = port.x; s.ship.fromY = port.y; s.ship.moveT = 1;
  s.updateTip();
});
await page.waitForTimeout(200);
await shot('03-sea');
await page.keyboard.press('KeyZ');
await page.waitForTimeout(900);
check(await scene() === 'FieldScene', 'landed');
check(await st(() => window.__lotbw.scenes.current.mapId) === 'moonwrack', 'landed at Moonwrack Shoals');
await shot('04-shoals');

console.log('\n== beacons ==');
const beacons = [[7, 11], [28, 11], [18, 17]];
for (const [x, y] of beacons) {
  await faceTile(x, y, 'up');
  await interact();
  await talkThrough();
}
const lit = await st(async () => {
  const { counterValue } = await import('/src/systems/quests.js');
  return counterValue(window.__lotbw.state, 'lanternGalleon', 'beacons');
});
check(lit === 3, `three beacons lit (${lit}/3)`);
await shot('05-beacons');

console.log('\n== boarding the galleon ==');
await faceTile(19, 3, 'up');
await interact();
await talkThrough();
await page.waitForTimeout(1600);
check(await scene() === 'BattleScene', 'boss battle started');
await shot('06-halloway');

// Put the captain on the ropes so the test finishes quickly, then mash attack.
await st(() => {
  const b = window.__lotbw.scenes.current.battle;
  for (const p of b.party) { p.base.atk *= 3; p.base.mag *= 3; }
  for (const e of b.enemies) { e.hp = 60; e.guard = 1; }
});
for (let i = 0; i < 150; i++) {
  await page.keyboard.press('KeyZ');
  await page.waitForTimeout(110);
  if (await scene() !== 'BattleScene') break;
}
await page.waitForTimeout(1400);
console.log('   scene after battle:', await scene());
await talkThrough(60);
await page.waitForTimeout(400);
await shot('07-resolved');

const after = await st(() => {
  const s = window.__lotbw.state;
  return {
    legend: s.legendState('lanternGalleon'),
    compass: s.hasItem('spectralCompass'),
    curse: s.flag('curse.lifted'),
    route: s.flag('route.pearlmaw'),
    gold: s.gold,
    resolved: s.resolvedCount,
  };
});
console.log('  ', JSON.stringify(after));
check(after.legend === 'resolved', 'legend resolved');
check(after.compass, 'Spectral Compass awarded');
check(after.curse && after.route, 'world-state flags set');

console.log('\n== world change ==');
const stock = await st(async () => {
  const { SHOPS } = await import('/src/data/shops.js');
  const s = window.__lotbw.state;
  return SHOPS.marrowport.stock.filter((e) => !e.flag || s.flag(e.flag)).map((e) => e.item);
});
check(stock.includes('palmSalve') && stock.includes('kindleCharm'), 'Marrowport stock opens up after the curse lifts');

console.log('\n== save / load ==');
const saved = await st(() => {
  const g = window.__lotbw;
  const json = g.state.toJSON();
  const before = { gold: g.state.gold, resolved: g.state.resolvedCount, party: g.state.party.length };
  g.state.loadJSON(JSON.parse(JSON.stringify(json)));
  return { before, after: { gold: g.state.gold, resolved: g.state.resolvedCount, party: g.state.party.length } };
});
check(JSON.stringify(saved.before) === JSON.stringify(saved.after), 'save round-trip is lossless');

await browser.close();
if (errors.length) {
  console.error(`\n${errors.length} PAGE ERROR(S):`);
  for (const e of [...new Set(errors)]) console.error('  ' + e);
  fails++;
}
console.log(fails ? `\n${fails} FAILURE(S)` : '\nLEGEND LOOP PASSED');
process.exit(fails ? 1 : 0);
