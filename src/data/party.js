/**
 * The three playable characters, their growth curves and their learn sets.
 *
 * Roles: Nia holds the line and buffs, Rook exposes weaknesses and bursts,
 * Yerena keeps everyone standing and covers Tide/Spirit coverage.
 */

export const CHARACTERS = {
  nia: {
    id: 'nia',
    name: 'Nia Corvel',
    title: 'Captain, the Salt Wren',
    style: 'nia',
    role: 'Saber & command',
    blurb: 'Inherited a ship, a debt, and a torn chart. Fights forward, always.',
    element: 'steel',
    base: { hp: 130, mp: 22, atk: 15, def: 12, mag: 7, res: 9, spd: 10, luk: 8 },
    growth: { hp: 15, mp: 3, atk: 2.7, def: 2.1, mag: 1.0, res: 1.5, spd: 1.4, luk: 1.0 },
    learn: [
      { level: 1, skill: 'boardingRush' },
      { level: 3, skill: 'ironResolve' },
      { level: 6, skill: 'cutlassArc' },
      { level: 10, skill: 'rallyCry' },
      { level: 15, skill: 'captainsCall' },
    ],
    start: { weapon: 'driftwoodSaber', coat: 'saltclothVest', trinket: null },
  },

  rook: {
    id: 'rook',
    name: 'Rook Ondari',
    title: 'Navigator & gunner',
    style: 'rook',
    role: 'Precision & scouting',
    blurb: 'Sailed for a flag he will not name. Owed your aunt more than money.',
    element: 'shot',
    base: { hp: 102, mp: 28, atk: 13, def: 9, mag: 10, res: 8, spd: 15, luk: 12 },
    growth: { hp: 11, mp: 4, atk: 2.3, def: 1.4, mag: 1.7, res: 1.3, spd: 2.0, luk: 1.7 },
    learn: [
      { level: 1, skill: 'pinningShot' },
      { level: 2, skill: 'readTheWind' },
      { level: 7, skill: 'ricochetShot' },
      { level: 11, skill: 'smokescreen' },
    ],
    start: { weapon: 'pittedFlintlock', coat: 'saltclothVest', trinket: null },
  },

  yerena: {
    id: 'yerena',
    name: 'Yerena Palo',
    title: 'Shore-priestess of Marrowport',
    style: 'yerena',
    role: 'Mending & spirit',
    blurb: 'Keeps the old names. Argues with the sea on the crew’s behalf.',
    element: 'spirit',
    base: { hp: 94, mp: 38, atk: 8, def: 8, mag: 16, res: 14, spd: 11, luk: 10 },
    growth: { hp: 10, mp: 5.5, atk: 1.2, def: 1.3, mag: 2.9, res: 2.3, spd: 1.5, luk: 1.4 },
    learn: [
      { level: 1, skill: 'tidemend' },
      { level: 2, skill: 'saltbind' },
      { level: 5, skill: 'wardOfShells' },
      { level: 8, skill: 'spiritLantern' },
      { level: 12, skill: 'greenTide' },
      { level: 16, skill: 'callingBack' },
    ],
    start: { weapon: 'reedFocus', coat: 'saltclothVest', trinket: null },
  },
};

export const PARTY_ORDER = ['nia', 'rook', 'yerena'];

export const MAX_LEVEL = 40;

/** Total experience needed to reach `level`. */
export function xpForLevel(level) {
  if (level <= 1) return 0;
  let total = 0;
  for (let l = 2; l <= level; l++) total += Math.floor(16 * Math.pow(l - 1, 1.72) + 14 * (l - 1));
  return total;
}

/** Experience still owed before the next level (0 at max). */
export function xpToNext(level, xp) {
  if (level >= MAX_LEVEL) return 0;
  return Math.max(0, xpForLevel(level + 1) - xp);
}

/** Stat block for a character at a given level, before equipment. */
export function statsAt(charId, level) {
  const c = CHARACTERS[charId];
  const out = {};
  for (const key of Object.keys(c.base)) {
    out[key] = Math.floor(c.base[key] + c.growth[key] * (level - 1));
  }
  return out;
}

/** Skills known at a given level (story unlocks are added separately). */
export function skillsAt(charId, level) {
  return CHARACTERS[charId].learn.filter((l) => l.level <= level).map((l) => l.skill);
}
