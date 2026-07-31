/**
 * Every item in the game: consumables, equipment and legend relics.
 *
 * `slot` decides where equipment goes ('weapon' | 'coat' | 'trinket');
 * consumables have no slot but carry a battle/field `effect`.
 */

export const ELEMENTS = ['steel', 'shot', 'flame', 'tide', 'spirit', 'storm'];

export const ELEMENT_LABEL = {
  steel: 'Steel',
  shot: 'Shot',
  flame: 'Flame',
  tide: 'Tide',
  spirit: 'Spirit',
  storm: 'Storm',
};

export const ELEMENT_COLOR = {
  steel: 0xc8d0da,
  shot: 0xffd45e,
  flame: 0xff8a3a,
  tide: 0x5fc8e0,
  spirit: 0xb9a6ff,
  storm: 0x9fd8ff,
};

export const ITEMS = {
  /* ------------------------- consumables ------------------------- */
  rumTonic: {
    name: 'Rum Tonic', kind: 'consumable', price: 30,
    desc: 'Harbour cure-all. Restores 70 HP to one ally.',
    effect: { type: 'heal', hp: 70, target: 'ally' }, usableInField: true,
  },
  palmSalve: {
    name: 'Palm Salve', kind: 'consumable', price: 96,
    desc: 'Pressed shore-herb. Restores 180 HP to one ally.',
    effect: { type: 'heal', hp: 180, target: 'ally' }, usableInField: true,
  },
  galleyStew: {
    name: 'Galley Stew', kind: 'consumable', price: 210,
    desc: 'Shared from the pot. Restores 130 HP to the whole crew.',
    effect: { type: 'heal', hp: 130, target: 'allies' }, usableInField: true,
  },
  saltDraught: {
    name: 'Salt Draught', kind: 'consumable', price: 60,
    desc: 'Bitter and bracing. Restores 30 MP to one ally.',
    effect: { type: 'heal', mp: 30, target: 'ally' }, usableInField: true,
  },
  bitterroot: {
    name: 'Bitterroot', kind: 'consumable', price: 25,
    desc: 'Chewed for blight and bad water. Cures Blight and Burn.',
    effect: { type: 'cure', statuses: ['blight', 'burn'], target: 'ally' }, usableInField: true,
  },
  clearWater: {
    name: 'Clear Water', kind: 'consumable', price: 35,
    desc: 'Rain caught in a shell. Cures Fogbound and Hushed.',
    effect: { type: 'cure', statuses: ['blind', 'hush'], target: 'ally' }, usableInField: true,
  },
  kindleCharm: {
    name: 'Kindle Charm', kind: 'consumable', price: 300,
    desc: 'A wick that remembers the flame. Revives a fallen ally at half HP.',
    effect: { type: 'revive', ratio: 0.5, target: 'dead' }, usableInField: true,
  },
  powderFlask: {
    name: 'Powder Flask', kind: 'consumable', price: 70,
    desc: 'Throw and duck. 110 Flame damage to one enemy.',
    effect: { type: 'damage', element: 'flame', power: 110, target: 'enemy' },
  },
  chainShot: {
    name: 'Chain Shot', kind: 'consumable', price: 130,
    desc: 'Wrecks rigging and guard alike. 70 Shot damage to all enemies, strips 1 Guard.',
    effect: { type: 'damage', element: 'shot', power: 70, target: 'enemies', guard: 1 },
  },
  tidePhial: {
    name: 'Tide Phial', kind: 'consumable', price: 160,
    desc: 'Cold as a trench. 140 Tide damage and Barnacled to one enemy.',
    effect: { type: 'damage', element: 'tide', power: 140, target: 'enemy', status: 'slow' },
  },
  stormBottle: {
    name: 'Storm Bottle', kind: 'consumable', price: 280,
    desc: 'Uncork it and let the weather out. 150 Storm damage to all enemies.',
    effect: { type: 'damage', element: 'storm', power: 150, target: 'enemies' },
  },
  smokePot: {
    name: 'Smoke Pot', kind: 'consumable', price: 45,
    desc: 'Leave an argument early. Always escapes a battle that allows it.',
    effect: { type: 'escape' },
  },

  /* --------------------------- weapons --------------------------- */
  driftwoodSaber: {
    name: 'Driftwood Saber', kind: 'weapon', slot: 'weapon', user: 'nia', price: 0,
    desc: 'Your aunt taught you on this blade. It still holds an edge.',
    stats: { atk: 6 }, element: 'steel',
  },
  gullwingCutlass: {
    name: 'Gullwing Cutlass', kind: 'weapon', slot: 'weapon', user: 'nia', price: 340,
    desc: 'Light in the wrist, wide in the swing.',
    stats: { atk: 13, spd: 1 }, element: 'steel',
  },
  tidewornFalchion: {
    name: 'Tideworn Falchion', kind: 'weapon', slot: 'weapon', user: 'nia', price: 760,
    desc: 'Pulled from a reef and never rusted.',
    stats: { atk: 19, res: 2 }, element: 'tide',
  },
  kingsflameSaber: {
    name: 'Kingsflame Saber', kind: 'weapon', slot: 'weapon', user: 'nia', price: 0, unique: true,
    desc: 'Forged in the throat of Emberpath. The blade never fully cools.',
    stats: { atk: 24, mag: 4 }, element: 'flame',
  },
  pittedFlintlock: {
    name: 'Pitted Flintlock', kind: 'weapon', slot: 'weapon', user: 'rook', price: 0,
    desc: 'Rook swears it has never once misfired. Rook lies.',
    stats: { atk: 5, spd: 1 }, element: 'shot',
  },
  longnoseCarbine: {
    name: 'Longnose Carbine', kind: 'weapon', slot: 'weapon', user: 'rook', price: 320,
    desc: 'A barrel long enough to argue with the horizon.',
    stats: { atk: 12, spd: 2 }, element: 'shot',
  },
  stormlockPistol: {
    name: 'Stormlock Pistol', kind: 'weapon', slot: 'weapon', user: 'rook', price: 740,
    desc: 'The pan sparks even in a downpour.',
    stats: { atk: 17, spd: 2, mag: 3 }, element: 'storm',
  },
  widowsFang: {
    name: "Widow's Fang", kind: 'weapon', slot: 'weapon', user: 'rook', price: 0, unique: true,
    desc: 'A coral spur cut from the Dowager. Cold to hold.',
    stats: { atk: 22, spd: 3 }, element: 'tide',
  },
  reedFocus: {
    name: 'Reed Focus', kind: 'weapon', slot: 'weapon', user: 'yerena', price: 0,
    desc: 'Bound river-reed. Yerena has carried it since she was small.',
    stats: { mag: 5, res: 1 }, element: 'spirit',
  },
  coralCenser: {
    name: 'Coral Censer', kind: 'weapon', slot: 'weapon', user: 'yerena', price: 300,
    desc: 'Smoke pours out of it the wrong way in still air.',
    stats: { mag: 12, res: 2 }, element: 'spirit',
  },
  ancestorBell: {
    name: 'Ancestor Bell', kind: 'weapon', slot: 'weapon', user: 'yerena', price: 720,
    desc: 'Rung at dusk so the old names are not forgotten.',
    stats: { mag: 17, res: 4, mp: 10 }, element: 'spirit',
  },
  tideheartFocus: {
    name: 'Tideheart Focus', kind: 'weapon', slot: 'weapon', user: 'yerena', price: 0, unique: true,
    desc: 'A pearl that keeps the Dowager’s truce alive in your hands.',
    stats: { mag: 21, res: 5, mp: 16 }, element: 'tide',
  },

  /* ---------------------------- coats ---------------------------- */
  saltclothVest: {
    name: 'Saltcloth Vest', kind: 'coat', slot: 'coat', price: 0,
    desc: 'Stiff with dried spray. Better than nothing.',
    stats: { def: 3 },
  },
  privateersCoat: {
    name: "Privateer's Coat", kind: 'coat', slot: 'coat', price: 260,
    desc: 'Heavy blue wool with the buttons filed blank.',
    stats: { def: 7, res: 2 },
  },
  reefmail: {
    name: 'Reefmail', kind: 'coat', slot: 'coat', price: 480,
    desc: 'Overlapping shell plates, sewn while wet.',
    stats: { def: 11, res: 4 },
  },
  stormweave: {
    name: 'Stormweave', kind: 'coat', slot: 'coat', price: 820,
    desc: 'Cloth that shrugs off rain and most of the lightning.',
    stats: { def: 14, res: 8, spd: 1 }, resist: ['storm'],
  },
  wardensBark: {
    name: "Warden's Bark", kind: 'coat', slot: 'coat', price: 0, unique: true,
    desc: 'Living bark, offered rather than taken.',
    stats: { def: 12, res: 9, hp: 40 }, resist: ['spirit'],
  },

  /* -------------------------- trinkets --------------------------- */
  braidedCord: {
    name: 'Braided Cord', kind: 'trinket', slot: 'trinket', price: 130,
    desc: 'Knotted for a fast wind. Speed +3.',
    stats: { spd: 3 },
  },
  sailorsKnot: {
    name: "Sailor's Knot", kind: 'trinket', slot: 'trinket', price: 170,
    desc: 'Tied so the wearer comes home. Max HP +40.',
    stats: { hp: 40 },
  },
  cinderWard: {
    name: 'Cinder Ward', kind: 'trinket', slot: 'trinket', price: 240,
    desc: 'Ash-glazed clay. Halves Flame damage, and lets you walk the vent paths of Emberpath.',
    stats: { res: 3 }, resist: ['flame'], tags: ['heatproof'],
  },
  spectralCompass: {
    name: 'Spectral Compass', kind: 'trinket', slot: 'trinket', price: 0, unique: true,
    desc: 'Its needle points at whatever is watching you. Evasion up, hidden ways revealed.',
    stats: { spd: 3, luk: 6 }, tags: ['seer'],
  },
  heartwoodIdol: {
    name: 'Heartwood Idol', kind: 'trinket', slot: 'trinket', price: 0, unique: true,
    desc: 'Warm as a palm. Restores 6 MP each turn — and the grove has not forgiven you.',
    stats: { mag: 5 }, tags: ['mpRegen'],
  },
  verdantCharm: {
    name: 'Verdant Charm', kind: 'trinket', slot: 'trinket', price: 0, unique: true,
    desc: 'Given, not taken. The grove mends your crew as you walk.',
    stats: { res: 4, hp: 25 }, tags: ['regen'],
  },
  emberkingCrest: {
    name: "Emberking's Crest", kind: 'trinket', slot: 'trinket', price: 0, unique: true,
    desc: 'A pirate king’s sigil, still warm. Flame cannot touch the bearer.',
    stats: { atk: 4, def: 4 }, resist: ['flame'], tags: ['heatproof'],
  },
  tideheartPearl: {
    name: 'Tideheart Pearl', kind: 'trinket', slot: 'trinket', price: 0, unique: true,
    desc: 'The Dowager’s truce, made solid. Tide cannot drown the bearer.',
    stats: { mag: 6, res: 5 }, resist: ['tide'],
  },
  namelessCoin: {
    name: 'Nameless Coin', kind: 'trinket', slot: 'trinket', price: 0, unique: true,
    desc: 'No face, no year, no mint. Any fight you can leave, you can leave.',
    stats: { luk: 8, spd: 2 }, tags: ['alwaysFlee'],
  },
  ironBellSigil: {
    name: 'Iron Bell Sigil', kind: 'trinket', slot: 'trinket', price: 0, unique: true,
    desc: 'Taken from a rival who wanted it more than you did.',
    stats: { atk: 4, def: 4, mag: 4, res: 4, spd: 3, luk: 3 },
  },
  driftglassCharm: {
    name: 'Driftglass Charm', kind: 'trinket', slot: 'trinket', price: 200,
    desc: 'Sea-worn glass. Magic and spirit slide off it. Res +6.',
    stats: { res: 6 },
  },
  gunnersGlove: {
    name: "Gunner's Glove", kind: 'trinket', slot: 'trinket', price: 260,
    desc: 'Scorched at the thumb. Attack +5.',
    stats: { atk: 5 },
  },

  /* -------------------------- key items -------------------------- */
  sunderedChart: {
    name: 'Sundered Chart', kind: 'key', price: 0,
    desc: 'Your aunt’s map, torn along the Wailing Pass. Six legends are marked on it.',
  },
  mireLantern: {
    name: 'Mire Lantern', kind: 'key', price: 0,
    desc: 'Green glass and a low wick. False lights cannot copy it.',
  },
  divingReed: {
    name: 'Diving Reed', kind: 'key', price: 0,
    desc: 'Hollow cane the pearl divers used. Long enough for one more breath.',
  },
  heartwoodRelic: {
    name: 'Heartwood Relic', kind: 'key', price: 0,
    desc: 'A knot of living wood cut from beneath the ceiba. It has a pulse.',
  },
  drownedPearls: {
    name: 'Drowned Pearls', kind: 'key', price: 0,
    desc: 'Nine pearls, one for each diver Pearlmaw kept.',
  },
  stormSail: {
    name: 'Storm Sail', kind: 'key', price: 0,
    desc: 'Cut and doubled for a wind that does not stop. The Wailing Pass is open to you.',
  },
};

/** Convenience: every id, with its record, as an array. */
export const ITEM_LIST = Object.entries(ITEMS).map(([id, def]) => ({ id, ...def }));

export function item(id) {
  const def = ITEMS[id];
  if (!def) throw new Error(`items: unknown item "${id}"`);
  return def;
}

export function itemName(id) { return ITEMS[id]?.name ?? id; }

export function isEquipment(id) { return Boolean(ITEMS[id]?.slot); }

/** Sell price is a flat 40% of list, rounded down. */
export function sellPrice(id) { return Math.floor((ITEMS[id]?.price ?? 0) * 0.4); }
