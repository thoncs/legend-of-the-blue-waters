/**
 * Visits every scene in the game and screenshots it, failing on any console
 * error. Run it after touching art, layout or scene wiring.
 *
 *   python3 -m http.server 8080 &
 *   node tools/scene-sweep.mjs
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveExecutable, BASE } from './browser.mjs';

const OUT = join(dirname(fileURLToPath(import.meta.url)), 'shots-sweep');
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: resolveExecutable(), args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 800, height: 470 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message + ' | ' + (e.stack || '').split('\n')[1]));
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForFunction(() => Boolean(window.__lotbw));

const shot = async (n) => { await page.screenshot({ path: `${OUT}/${n}.png` }); console.log('  ·', n); };

await page.evaluate(async () => {
  const g = window.__lotbw;
  g.state.newGame();
  g.state.join('rook');
  g.state.join('yerena');
  for (const m of g.state.party) { m.gainXp(4000); m.fullHeal(); }
  g.state.addGold(5000);
  g.state.addItem('palmSalve', 5);
  g.state.addItem('kindleCharm', 2);
  g.state.addItem('powderFlask', 3);
  g.state.addItem('gullwingCutlass', 1);
  g.state.addItem('cinderWard', 1);
  g.state.addItem('divingReed', 1);
  g.state.addItem('mireLantern', 1);
});

const maps = ['marrowport', 'greenfathom', 'whisperwood', 'moonwrack', 'mangroves', 'mireborne', 'ashfall', 'emberpath', 'pearlmaw', 'wailingpass', 'blackwater'];
console.log('maps:');
for (const id of maps) {
  await page.evaluate(async (mapId) => {
    const g = window.__lotbw;
    const { FieldScene } = await import('/src/scenes/FieldScene.js');
    await g.scenes.replace(FieldScene, { mapId }, { fade: false });
  }, id);
  await page.waitForTimeout(420);
  await shot(`map-${id}`);
}

console.log('battles:');
const fights = [
  ['halloway', 'shoals'], ['kaobo', 'jungle'], ['kingsflameIdol', 'volcano'],
  ['coralDowager', 'reef'], ['sableman', 'swamp'], ['saintMarene', 'storm'],
  ['blackwaterMaw', 'void'],
];
for (const [id, backdrop] of fights) {
  await page.evaluate(async ([enemy, bd]) => {
    const g = window.__lotbw;
    const { BattleScene } = await import('/src/scenes/BattleScene.js');
    await g.scenes.replace(BattleScene, { enemies: [enemy], isBoss: true, canFlee: false, backdrop: bd, onFinish: () => {} }, { fade: false });
  }, [id, backdrop]);
  await page.waitForTimeout(900);
  await shot(`boss-${id}`);
}

await page.evaluate(async () => {
  const g = window.__lotbw;
  const { BattleScene } = await import('/src/scenes/BattleScene.js');
  await g.scenes.replace(BattleScene, { enemies: ['ashSkeleton', 'cinderMoth', 'slagCrawler'], backdrop: 'volcano', onFinish: () => {} }, { fade: false });
});
await page.waitForTimeout(1200);
await shot('battle-group');
await page.keyboard.press('ArrowDown'); await page.waitForTimeout(220);
await page.keyboard.press('KeyZ'); await page.waitForTimeout(320);
await shot('battle-skill-list');
await page.keyboard.press('KeyZ'); await page.waitForTimeout(420);
await shot('battle-targeting');
for (let i = 0; i < 14; i++) { await page.keyboard.press('KeyZ'); await page.waitForTimeout(260); }
await shot('battle-midfight');

console.log('windows:');
await page.evaluate(async () => {
  const g = window.__lotbw;
  const { FieldScene } = await import('/src/scenes/FieldScene.js');
  await g.scenes.replace(FieldScene, { mapId: 'marrowport' }, { fade: false });
});
await page.waitForTimeout(400);
await page.evaluate(async () => {
  const g = window.__lotbw;
  const { MenuScene } = await import('/src/scenes/MenuScene.js');
  await g.scenes.push(MenuScene, { tab: 'party' });
});
await page.waitForTimeout(400);
await shot('menu-crew');
for (let i = 0; i < 6; i++) {
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(280);
  await shot(`menu-tab-${i + 1}`);
}
await page.keyboard.press('KeyX'); await page.waitForTimeout(300);

await page.evaluate(async () => {
  const g = window.__lotbw;
  const { ShopScene } = await import('/src/scenes/ShopScene.js');
  await g.scenes.push(ShopScene, { shopId: 'marrowport' });
});
await page.waitForTimeout(350);
await page.keyboard.press('KeyZ'); await page.waitForTimeout(300);
await shot('shop-buy');
await page.keyboard.press('ArrowDown'); await page.waitForTimeout(200);
await page.keyboard.press('ArrowDown'); await page.waitForTimeout(200);
await shot('shop-detail');
await page.keyboard.press('KeyX'); await page.waitForTimeout(200);
await page.keyboard.press('KeyX'); await page.waitForTimeout(300);

console.log('sea:');
await page.evaluate(async () => {
  const g = window.__lotbw;
  const { SeaChartScene } = await import('/src/scenes/SeaChartScene.js');
  await g.scenes.replace(SeaChartScene, {}, { fade: false });
});
await page.waitForTimeout(500);
await shot('sea');
await page.keyboard.press('KeyM'); await page.waitForTimeout(400);
await shot('sea-chart');
await page.keyboard.press('KeyM'); await page.waitForTimeout(200);

console.log('ending + gameover:');
await page.evaluate(async () => {
  const g = window.__lotbw;
  for (const id of ['lanternGalleon', 'ceibaWarden', 'ashenCrown', 'pearlWidow', 'sablemanMires', 'stormSaint']) {
    g.state.legendRecord(id).state = 'resolved';
  }
  g.state.legendRecord('ceibaWarden').branch = 'return';
  g.state.legendRecord('pearlWidow').branch = 'spare';
  const { EndingScene } = await import('/src/scenes/EndingScene.js');
  await g.scenes.replace(EndingScene, {}, { fade: false });
});
await page.waitForTimeout(700);
await shot('ending');
for (let i = 0; i < 9; i++) { await page.keyboard.press('KeyZ'); await page.waitForTimeout(220); }
await shot('ending-menu');

await page.evaluate(async () => {
  const g = window.__lotbw;
  const { GameOverScene } = await import('/src/scenes/GameOverScene.js');
  await g.scenes.replace(GameOverScene, {}, { fade: false });
});
await page.waitForTimeout(400);
await shot('gameover');

await browser.close();
if (errors.length) {
  console.error(`\n${errors.length} ERROR(S):`);
  for (const e of [...new Set(errors)]) console.error('  ' + e);
  process.exit(1);
}
console.log('\nclean run');
