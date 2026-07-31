/**
 * Abilities for the crew and for enemies.
 *
 * type:    'phys' scales on ATK, 'mag' scales on MAG, 'heal', 'buff', 'status'
 * target:  'enemy' | 'enemies' | 'ally' | 'allies' | 'self' | 'dead' | 'random'
 * power:   multiplier against the attacker's offence stat
 * guard:   extra Guard pips stripped on hit (weakness always strips 1)
 */

export const STATUS_DEFS = {
  blight: { name: 'Blight', kind: 'bad', color: 0x9fd85a, tick: 'hp', percent: 0.08, desc: 'Loses HP each turn.' },
  burn: { name: 'Burn', kind: 'bad', color: 0xff8a3a, tick: 'hp', percent: 0.06, desc: 'Loses HP each turn, defence down.' },
  slow: { name: 'Barnacled', kind: 'bad', color: 0x7f8fa0, mod: { spd: -0.45 }, desc: 'Speed sharply reduced.' },
  blind: { name: 'Fogbound', kind: 'bad', color: 0x6f7f8f, missChance: 0.45, desc: 'Physical attacks often miss.' },
  hush: { name: 'Hushed', kind: 'bad', color: 0xb9a6ff, silence: true, desc: 'Cannot use skills.' },
  atkDown: { name: 'Unnerved', kind: 'bad', color: 0xc88a8a, mod: { atk: -0.3 }, desc: 'Attack lowered.' },
  defDown: { name: 'Exposed', kind: 'bad', color: 0xc8a08a, mod: { def: -0.35 }, desc: 'Defence lowered.' },
  atkUp: { name: 'Rallied', kind: 'good', color: 0xffd45e, mod: { atk: 0.35 }, desc: 'Attack raised.' },
  defUp: { name: 'Braced', kind: 'good', color: 0x8fd4d8, mod: { def: 0.45, res: 0.3 }, desc: 'Defence raised.' },
  regen: { name: 'Mending', kind: 'good', color: 0x74c74d, tick: 'heal', percent: 0.09, desc: 'Recovers HP each turn.' },
  focus: { name: 'Sighted', kind: 'good', color: 0xffd45e, critBonus: 0.28, desc: 'Critical rate greatly raised.' },
  taunt: { name: 'Standing Fast', kind: 'good', color: 0xffb03a, desc: 'Draws enemy attacks.' },
};

export const SKILLS = {
  /* ------------------------------ Nia ------------------------------ */
  cutlassArc: {
    name: 'Cutlass Arc', owner: 'nia', cost: 8, type: 'phys', element: 'steel',
    power: 1.35, target: 'enemies',
    desc: 'One wide sweep across the whole enemy line.',
  },
  boardingRush: {
    name: 'Boarding Rush', owner: 'nia', cost: 10, type: 'phys', element: 'steel',
    power: 2.5, target: 'enemy',
    desc: 'Close the gap and hit once, hard.',
  },
  rallyCry: {
    name: 'Rally Cry', owner: 'nia', cost: 12, type: 'buff', target: 'allies',
    status: 'atkUp', turns: 4,
    desc: 'The crew finds its nerve. Attack up for everyone.',
  },
  ironResolve: {
    name: 'Iron Resolve', owner: 'nia', cost: 6, type: 'buff', target: 'self',
    status: 'defUp', turns: 4, taunt: true,
    desc: 'Plant your feet, draw their fire, and take it.',
  },
  captainsCall: {
    name: "Captain's Call", owner: 'nia', cost: 22, type: 'phys', element: 'steel',
    power: 3.1, target: 'enemy', guard: 1,
    desc: 'The blow your aunt was known for. Cracks guard outright.',
  },

  /* ------------------------------ Rook ----------------------------- */
  readTheWind: {
    name: 'Read the Wind', owner: 'rook', cost: 6, type: 'buff', target: 'allies',
    status: 'focus', turns: 4, scout: true,
    desc: 'Call out every weakness you can see. Crit up, weaknesses revealed.',
  },
  pinningShot: {
    name: 'Pinning Shot', owner: 'rook', cost: 8, type: 'phys', element: 'shot',
    power: 1.7, target: 'enemy', status: 'slow', statusChance: 0.75,
    desc: 'Take out a leg. Slows the target badly.',
  },
  ricochetShot: {
    name: 'Ricochet Shot', owner: 'rook', cost: 12, type: 'phys', element: 'shot',
    power: 0.95, target: 'random', hits: 3,
    desc: 'Three shots off the rocks, wherever they land.',
  },
  smokescreen: {
    name: 'Smokescreen', owner: 'rook', cost: 12, type: 'status', target: 'enemies',
    status: 'blind', statusChance: 0.8, turns: 4,
    desc: 'A cheap trick that has saved this crew twice.',
  },
  ghostShot: {
    name: 'Ghost Shot', owner: 'rook', cost: 18, type: 'phys', element: 'spirit',
    power: 2.7, target: 'enemy', pierce: true, guard: 1,
    desc: 'A shot fired from a gun with no name. Ignores defence.',
  },

  /* ----------------------------- Yerena ---------------------------- */
  tidemend: {
    name: 'Tidemend', owner: 'yerena', cost: 6, type: 'heal', target: 'ally', power: 1.9, flat: 40,
    desc: 'Cool water drawn over a wound.',
  },
  greenTide: {
    name: 'Green Tide', owner: 'yerena', cost: 14, type: 'heal', target: 'allies', power: 1.3, flat: 26,
    desc: 'The whole crew, all at once.',
  },
  saltbind: {
    name: 'Saltbind', owner: 'yerena', cost: 8, type: 'mag', element: 'tide',
    power: 1.8, target: 'enemy', guard: 1,
    desc: 'Salt drawn tight around a thing that hates it.',
  },
  spiritLantern: {
    name: 'Spirit Lantern', owner: 'yerena', cost: 12, type: 'mag', element: 'spirit',
    power: 1.5, target: 'enemies',
    desc: 'A light the restless cannot look away from.',
  },
  wardOfShells: {
    name: 'Ward of Shells', owner: 'yerena', cost: 10, type: 'buff', target: 'allies',
    status: 'defUp', turns: 4,
    desc: 'Nine shells, nine names, one wall.',
  },
  callingBack: {
    name: 'Calling Back', owner: 'yerena', cost: 20, type: 'revive', target: 'dead', ratio: 0.55,
    desc: 'She says the name until it answers.',
  },
  rootbind: {
    name: 'Rootbind', owner: 'yerena', cost: 18, type: 'mag', element: 'spirit',
    power: 1.9, target: 'enemies', status: 'slow', statusChance: 0.6,
    desc: 'The grove’s gift: roots through stone, through deck, through bone.',
  },
  tideheartSong: {
    name: 'Tideheart Song', owner: 'yerena', cost: 22, type: 'heal', target: 'allies',
    power: 2.1, flat: 60, status: 'regen', turns: 4,
    desc: 'The Dowager’s truce, sung back. Heals and keeps healing.',
  },

  /* ----------------------------- enemies --------------------------- */
  clawSwipe: { name: 'Claw Swipe', cost: 0, type: 'phys', element: 'steel', power: 1.25, target: 'enemy', desc: '' },
  drownedGrasp: { name: 'Drowned Grasp', cost: 0, type: 'phys', element: 'tide', power: 1.3, target: 'enemy', status: 'slow', statusChance: 0.35, desc: '' },
  lanternLure: { name: 'Lantern Lure', cost: 0, type: 'mag', element: 'spirit', power: 1.2, target: 'enemy', status: 'blind', statusChance: 0.5, desc: '' },
  grapeshot: { name: 'Grapeshot', cost: 0, type: 'phys', element: 'shot', power: 1.0, target: 'enemies', desc: '' },
  thornLash: { name: 'Thorn Lash', cost: 0, type: 'phys', element: 'steel', power: 1.35, target: 'enemy', status: 'blight', statusChance: 0.4, desc: '' },
  howl: { name: 'Howl', cost: 0, type: 'status', element: 'spirit', target: 'enemies', status: 'atkDown', statusChance: 0.7, turns: 3, desc: '' },
  sapDrain: { name: 'Sap Drain', cost: 0, type: 'mag', element: 'spirit', power: 1.1, target: 'enemy', drain: true, desc: '' },
  emberSpit: { name: 'Ember Spit', cost: 0, type: 'mag', element: 'flame', power: 1.35, target: 'enemy', status: 'burn', statusChance: 0.5, desc: '' },
  ashRattle: { name: 'Ash Rattle', cost: 0, type: 'phys', element: 'steel', power: 1.2, target: 'enemy', desc: '' },
  cinderWings: { name: 'Cinder Wings', cost: 0, type: 'mag', element: 'flame', power: 1.1, target: 'enemies', desc: '' },
  moltenSpill: { name: 'Molten Spill', cost: 0, type: 'mag', element: 'flame', power: 1.4, target: 'enemies', status: 'burn', statusChance: 0.4, desc: '' },
  sirenSong: { name: 'Siren Song', cost: 0, type: 'status', element: 'spirit', target: 'enemy', status: 'hush', statusChance: 0.6, turns: 3, desc: '' },
  undertow: { name: 'Undertow', cost: 0, type: 'mag', element: 'tide', power: 1.35, target: 'enemies', desc: '' },
  swallow: { name: 'Swallow', cost: 0, type: 'phys', element: 'tide', power: 1.7, target: 'enemy', desc: '' },
  mirelight: { name: 'Mirelight', cost: 0, type: 'mag', element: 'spirit', power: 1.25, target: 'enemy', status: 'blind', statusChance: 0.6, desc: '' },
  bogGrip: { name: 'Bog Grip', cost: 0, type: 'phys', element: 'tide', power: 1.3, target: 'enemy', status: 'slow', statusChance: 0.5, desc: '' },
  shadeTouch: { name: 'Shade Touch', cost: 0, type: 'mag', element: 'spirit', power: 1.3, target: 'enemy', drain: true, desc: '' },
  squallLash: { name: 'Squall Lash', cost: 0, type: 'mag', element: 'storm', power: 1.4, target: 'enemies', desc: '' },
  heraldsHorn: { name: "Herald's Horn", cost: 0, type: 'buff', target: 'allies', status: 'atkUp', turns: 3, desc: '' },
  ridingBolt: { name: 'Riding Bolt', cost: 0, type: 'mag', element: 'storm', power: 1.5, target: 'enemy', desc: '' },

  /* ------------------------------ bosses --------------------------- */
  drownedBroadside: { name: 'Drowned Broadside', cost: 0, type: 'phys', element: 'shot', power: 1.5, target: 'enemies', desc: '' },
  lanternCurse: { name: 'Lantern Curse', cost: 0, type: 'mag', element: 'spirit', power: 1.4, target: 'enemy', status: 'hush', statusChance: 0.55, desc: '' },
  callTheCrew: { name: 'Call the Crew', cost: 0, type: 'summon', summon: 'drownedDeckhand', count: 1, desc: '' },
  rootQuake: { name: 'Rootquake', cost: 0, type: 'phys', element: 'steel', power: 1.5, target: 'enemies', status: 'slow', statusChance: 0.4, desc: '' },
  seedOfYears: { name: 'Seed of Years', cost: 0, type: 'heal', target: 'self', power: 0, flat: 150, desc: '' },
  thornCanopy: { name: 'Thorn Canopy', cost: 0, type: 'mag', element: 'spirit', power: 1.45, target: 'enemies', status: 'blight', statusChance: 0.5, desc: '' },
  kingsflame: { name: 'Kingsflame', cost: 0, type: 'mag', element: 'flame', power: 1.75, target: 'enemies', status: 'burn', statusChance: 0.6, desc: '' },
  slagFist: { name: 'Slag Fist', cost: 0, type: 'phys', element: 'flame', power: 2.1, target: 'enemy', desc: '' },
  ashenCrown: { name: 'Ashen Crown', cost: 0, type: 'buff', target: 'self', status: 'defUp', turns: 3, desc: '' },
  dirgeOfPearls: { name: 'Dirge of Pearls', cost: 0, type: 'mag', element: 'tide', power: 1.7, target: 'enemies', status: 'hush', statusChance: 0.4, desc: '' },
  coralCrown: { name: 'Coral Crown', cost: 0, type: 'buff', target: 'self', status: 'defUp', turns: 3, desc: '' },
  dragUnder: { name: 'Drag Under', cost: 0, type: 'phys', element: 'tide', power: 2.2, target: 'enemy', status: 'slow', statusChance: 0.6, desc: '' },
  falseName: { name: 'False Name', cost: 0, type: 'status', element: 'spirit', target: 'enemies', status: 'hush', statusChance: 0.5, turns: 3, desc: '' },
  lanternSwap: { name: 'Lantern Swap', cost: 0, type: 'mag', element: 'spirit', power: 1.6, target: 'enemy', status: 'blind', statusChance: 0.7, desc: '' },
  tricksterCoin: { name: 'Trickster Coin', cost: 0, type: 'mag', element: 'spirit', power: 1.4, target: 'enemies', drain: true, desc: '' },
  longWind: { name: 'The Long Wind', cost: 0, type: 'mag', element: 'storm', power: 1.8, target: 'enemies', desc: '' },
  saintsGrief: { name: "Saint's Grief", cost: 0, type: 'mag', element: 'tide', power: 2.0, target: 'enemy', status: 'slow', statusChance: 0.5, desc: '' },
  eyeOfTheStorm: { name: 'Eye of the Storm', cost: 0, type: 'buff', target: 'self', status: 'defUp', turns: 3, desc: '' },
  blackwaterTide: { name: 'Blackwater Tide', cost: 0, type: 'mag', element: 'tide', power: 2.0, target: 'enemies', desc: '' },
  soundlessChoir: { name: 'Soundless Choir', cost: 0, type: 'status', element: 'spirit', target: 'enemies', status: 'hush', statusChance: 0.7, turns: 3, desc: '' },
  devour: { name: 'Devour', cost: 0, type: 'phys', element: 'tide', power: 2.6, target: 'enemy', drain: true, desc: '' },
  ironBellVolley: { name: 'Iron Bell Volley', cost: 0, type: 'phys', element: 'shot', power: 1.5, target: 'enemies', desc: '' },
  bountyMark: { name: 'Bounty Mark', cost: 0, type: 'status', target: 'enemy', status: 'defDown', statusChance: 0.9, turns: 4, desc: '' },
  hammerFall: { name: 'Hammer Fall', cost: 0, type: 'phys', element: 'steel', power: 2.3, target: 'enemy', guard: 1, desc: '' },
};

export function skill(id) {
  const def = SKILLS[id];
  if (!def) throw new Error(`skills: unknown skill "${id}"`);
  return def;
}

export function skillName(id) { return SKILLS[id]?.name ?? id; }
