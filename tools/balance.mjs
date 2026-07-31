/**
 * Headless logic test — no browser needed.
 *
 *   node tools/balance.mjs
 *
 * Verifies the quest chain, equipment rules, save round-trips and data
 * integrity, then auto-plays 20 battles per scenario and prints win rates and
 * round counts so encounter pacing can be tuned with numbers instead of vibes.
 */
import { GameState } from '../src/systems/gamestate.js';
import { Battle, OUTCOME } from '../src/systems/battle.js';
import { SKILLS } from '../src/data/skills.js';
import { ENEMIES } from '../src/data/enemies.js';
import { LEGENDS } from '../src/data/legends.js';
import { rumorLegend, bumpCounter, resolveLegend, objectiveText, passUnlocked } from '../src/systems/quests.js';
import { rng } from '../src/core/rng.js';
import { ITEMS } from '../src/data/items.js';

let fails = 0;
const check = (cond, msg) => { if (!cond) { console.log('  FAIL: ' + msg); fails++; } };

/* ---------------- quest chain ---------------- */
console.log('== quest chain ==');
{
  const s = new GameState().newGame();
  s.join('rook'); s.join('yerena');
  check(s.party.length === 3, 'party of three');
  check(s.legendState('lanternGalleon') === 'unheard', 'starts unheard');
  rumorLegend(s, 'lanternGalleon');
  check(s.legendState('lanternGalleon') === 'rumored', 'rumour recorded');
  console.log('  objective:', objectiveText(s, 'lanternGalleon'));
  for (let i = 0; i < 3; i++) {
    const r = bumpCounter(s, 'lanternGalleon', 'beacons');
    console.log(`  beacon ${r.value}/${r.of} complete=${r.complete}`);
  }
  check(s.legendState('lanternGalleon') === 'active', 'active after lighting');
  const { notices } = resolveLegend(s, 'lanternGalleon', null);
  console.log('  ' + notices.join(' | '));
  check(s.legendState('lanternGalleon') === 'resolved', 'resolved');
  check(s.hasItem('spectralCompass'), 'compass granted');
  check(s.flag('route.pearlmaw'), 'pearlmaw route open');
  check(s.flag('curse.lifted'), 'curse lifted');
  check(s.resolvedCount === 1, 'one legend told');

  // Branch: keep vs return on the Ceiba Warden.
  const branch = resolveLegend(s, 'ceibaWarden', 'return');
  check(s.hasItem('verdantCharm'), 'verdant charm from returning the relic');
  check(s.flag('grove.blessed'), 'grove blessed flag');
  check(s.member('yerena').skills.includes('rootbind'), 'Yerena learns Rootbind');
  check(branch.branch.id === 'return', 'branch recorded');

  resolveLegend(s, 'ashenCrown', 'saber');
  resolveLegend(s, 'sablemanMires', null);
  check(s.member('rook').skills.includes('ghostShot'), 'Rook learns Ghost Shot');
  check(passUnlocked(s) === true, 'pass unlocks at four legends');
  console.log('  resolved:', s.resolvedCount, 'passUnlocked:', passUnlocked(s));

  // Save round-trip.
  const json = JSON.parse(JSON.stringify(s.toJSON()));
  const s2 = new GameState().loadJSON(json);
  check(s2.resolvedCount === s.resolvedCount, 'save round-trip keeps legends');
  check(s2.party.length === 3, 'save round-trip keeps party');
  check(s2.member('yerena').skills.includes('rootbind'), 'save round-trip keeps taught skills');
  check(s2.gold === s.gold, 'save round-trip keeps gold');
}

/* ---------------- equipment ---------------- */
console.log('\n== equipment ==');
{
  const s = new GameState().newGame();
  s.join('rook');
  s.addItem('gullwingCutlass');
  const before = s.member('nia').maxStats.atk;
  s.equip('nia', 'gullwingCutlass');
  const after = s.member('nia').maxStats.atk;
  check(after > before, `equipping raises ATK (${before} -> ${after})`);
  check(s.hasItem('driftwoodSaber'), 'old weapon returns to the hold');
  check(s.equip('rook', 'gullwingCutlass') === null, 'Rook cannot hold Nia-only gear');
  s.addItem('cinderWard');
  s.equip('nia', 'cinderWard');
  check(s.partyHasTag('heatproof'), 'cinder ward makes the crew heatproof');
}

/* ---------------- battle simulation ---------------- */
function autoBattle(state, enemies, { canFlee = false, maxRounds = 200 } = {}) {
  const b = new Battle(state, { enemies, canFlee });
  let guard = 0;
  while (guard++ < 4000) {
    const step = b.advance();
    if (step.kind === 'end') return { outcome: step.outcome, rounds: b.round, battle: b };
    if (step.kind === 'input') {
      const actor = step.actor;
      const m = actor.member;
      // A simple but sensible policy: heal when hurt, otherwise hit weaknesses.
      const healer = m.skills.find((id) => SKILLS[id].type === 'heal' && SKILLS[id].target === 'ally');
      const hurt = b.livingParty.find((p) => p.hp < p.maxHp * 0.4);
      if (healer && hurt && actor.mp >= SKILLS[healer].cost) {
        b.chooseAction({ kind: 'skill', skill: healer, target: hurt });
      } else {
        const foes = b.livingEnemies;
        let best = null;
        for (const id of m.skills) {
          const sk = SKILLS[id];
          if (actor.mp < sk.cost) continue;
          if (sk.type !== 'phys' && sk.type !== 'mag') continue;
          const hitsWeak = foes.some((f) => f.isWeak(sk.element));
          const score = (hitsWeak ? 2 : 1) * (sk.power ?? 1) * (sk.target === 'enemies' ? foes.length * 0.8 : 1);
          if (!best || score > best.score) best = { id, score, sk };
        }
        const target = foes.find((f) => best && f.isWeak(best.sk.element)) ?? foes[0];
        if (best && best.score > 1.4) b.chooseAction({ kind: 'skill', skill: best.id, target });
        else b.chooseAction({ kind: 'attack', target });
      }
      continue;
    }
    if (b.round > maxRounds) return { outcome: 'timeout', rounds: b.round, battle: b };
  }
  return { outcome: 'hung', rounds: b.round, battle: b };
}

function crewAt(level) {
  const s = new GameState().newGame();
  s.join('rook'); s.join('yerena');
  for (const m of s.party) {
    while (m.level < level) m.gainXp(1000);
    m.fullHeal();
  }
  return s;
}

console.log('\n== battle balance (20 runs each) ==');
const scenarios = [
  ['tutorial   ', 1, ['wreckCrab', 'wreckCrab']],
  ['shoals mob ', 5, ['drownedDeckhand', 'lanternWisp']],
  ['halloway   ', 8, ['halloway']],
  ['fathom mob ', 9, ['thornMimic', 'groveHowler']],
  ['kaobo      ', 11, ['kaobo']],
  ['sableman   ', 13, ['sableman']],
  ['sentinel   ', 14, ['ashboundSentinel']],
  ['idol       ', 16, ['kingsflameIdol']],
  ['dowager    ', 16, ['coralDowager']],
  ['iron bell  ', 14, ['vestrelKo', 'mardaQuill', 'grinBellows']],
  ['marene     ', 21, ['saintMarene']],
  ['the maw    ', 23, ['blackwaterMaw']],
  ['superboss  ', 26, ['vestrelKoIron', 'grinBellowsIron', 'mardaQuillIron']],
];
for (const [name, level, foes] of scenarios) {
  let wins = 0; let rounds = 0; let worst = 0;
  for (let i = 0; i < 20; i++) {
    rng.seed(1000 + i);
    const s = crewAt(level);
    const r = autoBattle(s, foes);
    if (r.outcome === OUTCOME.VICTORY || r.outcome === OUTCOME.YIELD) wins++;
    rounds += r.rounds;
    worst = Math.max(worst, r.rounds);
    if (r.outcome === 'hung' || r.outcome === 'timeout') { console.log(`  ${name} ${r.outcome}!`); fails++; }
  }
  console.log(`  ${name} Lv${String(level).padStart(2)}  win ${String(wins).padStart(2)}/20  avg ${(rounds / 20).toFixed(1)} rounds  max ${worst}`);
}

/* ---------------- rewards + level ups ---------------- */
console.log('\n== rewards ==');
{
  rng.seed(7);
  const s = crewAt(4);
  const before = s.gold;
  const r = autoBattle(s, ['drownedDeckhand', 'lanternWisp']);
  const rewards = r.battle.claimRewards();
  console.log(`  outcome ${r.outcome}  xp/each ${rewards.xpEach}  gold ${rewards.gold}  drops ${rewards.drops.join(',') || 'none'}`);
  check(s.gold > before, 'gold awarded');
  check(rewards.xpEach > 0, 'xp awarded');
}

/* ---------------- data integrity ---------------- */
console.log('\n== data integrity ==');
{
  for (const [id, e] of Object.entries(ENEMIES)) {
    for (const s of e.skills ?? []) check(SKILLS[s.id], `enemy ${id} references skill ${s.id}`);
    for (const d of e.drops ?? []) check(ITEMS[d.item], `enemy ${id} drops real item ${d.item}`);
  }
  for (const [id, l] of Object.entries(LEGENDS)) {
    check(ENEMIES[l.boss], `legend ${id} boss exists`);
    if (l.elite) check(ENEMIES[l.elite], `legend ${id} elite exists`);
    if (l.finalBoss) check(ENEMIES[l.finalBoss], `legend ${id} final boss exists`);
    for (const e of l.enemies) check(ENEMIES[e], `legend ${id} enemy ${e} exists`);
    for (const item of l.reward?.items ?? []) check(ITEMS[item], `legend ${id} reward ${item} exists`);
    for (const b of l.branches ?? []) {
      for (const item of b.reward?.items ?? []) check(ITEMS[item], `legend ${id} branch ${b.id} item ${item} exists`);
      if (b.unlockSkill) check(SKILLS[b.unlockSkill.skill], `legend ${id} branch skill exists`);
    }
  }
  const counts = {
    enemies: Object.keys(ENEMIES).length,
    bosses: Object.values(ENEMIES).filter((e) => e.traits?.includes('boss')).length,
    elites: Object.values(ENEMIES).filter((e) => e.traits?.includes('elite')).length,
    items: Object.keys(ITEMS).length,
    skills: Object.keys(SKILLS).length,
    legends: Object.keys(LEGENDS).length,
  };
  console.log('  ' + JSON.stringify(counts));
  check(counts.enemies >= 12, 'at least 12 enemy types');
  check(counts.bosses + counts.elites >= 6, 'at least 6 bosses/elites');
}

console.log(fails ? `\n${fails} FAILURE(S)` : '\nALL LOGIC CHECKS PASSED');
process.exit(fails ? 1 : 0);
