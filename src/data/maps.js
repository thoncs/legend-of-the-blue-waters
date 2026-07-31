/**
 * The world: eleven hand-authored tile maps plus the open sea chart.
 *
 * Maps are written as ASCII sketches — one character per 16px tile — which
 * keeps them readable and editable in place. `TILE_DEFS` maps each character
 * to a generated texture and its collision. Digits inside a sketch are
 * *marks*: named anchor tiles that warps, NPCs and objects refer to by name
 * instead of by fragile hand-counted coordinates.
 */

/** char -> { tex | anim, solid, [hazard] } */
export const TILE_DEFS = {
  // --- walkable ground ---
  '.': { tex: 'grass' },
  ',': { tex: 'sand' },
  '"': { tex: 'grassTall' },
  '*': { tex: 'flowers' },
  p: { tex: 'dirtPath' },
  j: { tex: 'jungleFloor' },
  S: { tex: 'stoneFloor' },
  s: { tex: 'ruinFloor' },
  F: { tex: 'woodFloor' },
  '=': { tex: 'dock' },
  '-': { tex: 'bridge' },
  A: { tex: 'ashGround' },
  G: { tex: 'swampGround' },
  c: { tex: 'reefSand' },
  ':': { tex: 'shoalSand' },
  B: { tex: 'bones' },
  V: { tex: 'voidFloor' },
  O: { tex: 'obsidian' },
  l: { tex: 'lavaRock' },
  d: { tex: 'sandWet' },

  // --- water (never walkable) ---
  '~': { anim: ['water0', 'water1', 'water2'], solid: true },
  W: { anim: ['deep0', 'deep1', 'deep2'], solid: true },
  _: { anim: ['shallow0', 'shallow1', 'shallow2'], solid: true },
  n: { anim: ['moonsea0', 'moonsea1', 'moonsea2'], solid: true },
  o: { tex: 'reefWater', solid: true },
  w: { tex: 'swampWater', solid: true },
  X: { tex: 'stormSea', solid: true },

  // --- solid scenery ---
  T: { tex: 'jungleTree', solid: true },
  t: { tex: 'palm', solid: true },
  b: { tex: 'bush', solid: true },
  R: { tex: 'rock', solid: true },
  '^': { tex: 'cliff', solid: true },
  '%': { tex: 'cliffTop', solid: true },
  '#': { tex: 'stoneWall', solid: true },
  u: { tex: 'ruinWall', solid: true },
  H: { tex: 'woodWall', solid: true },
  P: { tex: 'plaster', solid: true },
  '/': { tex: 'roofRed', solid: true },
  k: { tex: 'roofBlue', solid: true },
  y: { tex: 'roofPalm', solid: true },
  m: { tex: 'mangrove', solid: true },
  r: { tex: 'reeds', solid: true },
  C: { tex: 'coral', solid: true },
  x: { tex: 'wreck', solid: true },
  L: { tex: 'lava', solid: true, hazard: true },
  '!': { tex: 'ironRock', solid: true },
  v: { tex: 'vine', solid: true },
};

/* ------------------------------------------------------------------ *
 * Maps
 * ------------------------------------------------------------------ */

export const MAPS = {
  /* =============================== MARROWPORT =============================== */
  marrowport: {
    name: 'Marrowport',
    kind: 'town',
    music: 'town',
    w: 40, h: 24, fill: '~',
    start: { x: 18, y: 15, dir: 'down' },
    marks: {
      1: { id: 'northRoad', base: 'p' },
      2: { id: 'berth', base: '=' },
    },
    rows: [
      '%%%%%%%%%%%%%%%%%%1%%%%%%%%%%%%%%%%%%%%%',
      '%%%%%%%%%%%%%%%%%%p%%%%%%%%%%%%%%%%%%%%%',
      '%%..T...........ppp...........T....%%%%%',
      '%..............ppppp..............%%%%%%',
      '%...//////.....ppp.....//////.....%%%%%%',
      '%...//////.....ppp.....//////.....%%%%%%',
      '%...PPPPPP.....ppp.....PPPPPP.....%%%%%%',
      '%...PPPPPP.....ppp.....PPPPPP.....%%%%%%',
      '%..............ppp................%%%%%%',
      '%....kkkkkk....ppp....kkkkkk......%%%%%%',
      '%....kkkkkk....ppp....kkkkkk......%%%%%%',
      '%....PPPPPP....ppp....PPPPPP......%%%%%%',
      '%....PPPPPP....ppp....PPPPPP......%%%%%%',
      '%..............ppp................%%%%%%',
      '%..ppppppppppppppppppppppppppp....%%%%%%',
      ',,,,,,,,,,,,,,,ppp,,,,,,,,,,,,,,,,,,%%%',
      ',,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,',
      '~~~~~~~~~~~~~~~==~~~~~~~~~~~~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~==~~~~~~~~~~~~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~==~~~~~~~~~~~~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~=2~~~~~~~~~~~~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    ],
    warps: [
      { mark: 'northRoad', to: 'greenfathom', tx: 15, ty: 21, dir: 'up' },
      { mark: 'berth', to: 'SEA', dir: 'down' },
    ],
    npcs: [
      { id: 'harbourmaster', x: 21, y: 14, style: 'officer', dir: 'left', name: 'Harbourmaster Delith', dialogue: 'mp_harbourmaster' },
      { id: 'shopkeep', x: 8, y: 8, style: 'merchant', dir: 'down', name: 'Halyard & Hook', dialogue: 'mp_shop', shop: 'marrowport' },
      { id: 'innkeep', x: 25, y: 13, style: 'sailor', dir: 'down', name: 'The Brined Lantern', dialogue: 'mp_inn', inn: { price: 20 } },
      { id: 'yerena_npc', x: 12, y: 3, style: 'yerena', dir: 'down', name: 'Yerena Palo', dialogue: 'mp_yerena' },
      { id: 'rook_npc', x: 16, y: 16, style: 'rook', dir: 'right', name: 'Rook Ondari', dialogue: 'mp_rook' },
      { id: 'fisher', x: 30, y: 16, style: 'fisher', dir: 'left', name: 'Old Wessa', dialogue: 'mp_fisher', wander: true },
      { id: 'child', x: 14, y: 11, style: 'child', dir: 'right', name: 'Pell', dialogue: 'mp_child', wander: true },
      { id: 'chartmaker', x: 28, y: 8, style: 'elder', dir: 'down', name: 'Chart-maker Ovi', dialogue: 'mp_chartmaker' },
      { id: 'maroon', x: 6, y: 13, style: 'maroon', dir: 'right', name: 'Teller of the Ridge', dialogue: 'mp_maroon' },
    ],
    objects: [
      { id: 'mp_sign', x: 19, y: 14, prop: 'sign', solid: true, kind: 'sign', text: 'MARROWPORT — every hull that comes home is a rumour brought back.' },
      { id: 'mp_door1', x: 8, y: 7, prop: 'door', solid: true, kind: 'decor' },
      { id: 'mp_door2', x: 26, y: 7, prop: 'door', solid: true, kind: 'decor' },
      { id: 'mp_door3', x: 8, y: 12, prop: 'door', solid: true, kind: 'decor' },
      { id: 'mp_door4', x: 25, y: 12, prop: 'door', solid: true, kind: 'decor' },
      { id: 'mp_barrel1', x: 17, y: 16, prop: 'barrel', solid: true, kind: 'decor' },
      { id: 'mp_crate1', x: 20, y: 16, prop: 'crate', solid: true, kind: 'decor' },
      { id: 'mp_anchor', x: 13, y: 16, prop: 'anchor', solid: true, kind: 'decor' },
      { id: 'mp_lantern1', x: 15, y: 14, prop: 'lantern', solid: true, kind: 'decor', night: true },
      { id: 'mp_lantern2', x: 23, y: 14, prop: 'lantern', solid: true, kind: 'decor', night: true },
      { id: 'mp_well', x: 18, y: 9, prop: 'well', solid: true, kind: 'examine', text: 'The well is brackish. Marrowport drinks rain and complains about it.' },
      { id: 'mp_chest1', x: 3, y: 3, prop: 'chest', solid: true, kind: 'chest', contents: { gold: 60 } },
      { id: 'mp_chest2', x: 32, y: 2, prop: 'chest', solid: true, kind: 'chest', contents: { item: 'rumTonic', count: 2 } },
    ],
  },

  /* =============================== GREEN FATHOM ============================= */
  greenfathom: {
    name: 'The Green Fathom',
    kind: 'field',
    music: 'field',
    w: 40, h: 24, fill: 'T',
    start: { x: 15, y: 21, dir: 'up' },
    marks: {
      1: { id: 'southRoad', base: 'p' },
      2: { id: 'shrineDoor', base: 'j' },
      3: { id: 'seaLanding', base: ',' },
    },
    rows: [
      'TTTTTTTTTTTTTTTTTT2TTTTTTTTTTTTTTTTTTTTT',
      'TTTTTTTTTTTTTTTTTTjTTTTTTTTTTTTTTTTTTTTT',
      'TTTTTTTTTTTTTTTTjjjjjTTTTTTTTTTTTTTTTTTT',
      'TTTTTTTTTTTTTTjjjjjjjjjTTTTTTTTTTTTTTTTT',
      'TTTTTTTTTTTTjjjjTTTjjjjjTTTTTTTTTTTTTTTT',
      'TTTTTTTTTTjjjjTTTTTTTjjjjjTTTTTTTTTTTTTT',
      'TTTTTTTTjjjjTTTTTTTTTTTjjjjTTTTTTTTTTTTT',
      'TTTTTTjjjjTTTTTbbbTTTTTTjjjjTTTTTTTTTTTT',
      'TTTTjjjjTTTTTTb***bTTTTTTjjjjjTTTTTTTTTT',
      'TTjjjjTTTTTTTTb*"*bTTTTTTTTjjjjTTTTTTTTT',
      'Tjjjj""jjjjjjjjb*bjjjjjjjjjjjjjjTTTTTTTT',
      'Tjjj""""jjjjjjjjjjjjjjjjjjjjjjjjjjTTTTTT',
      'Tjjjj""jjjjjjjjjjjjjjjjjjjjjjjjjjjjTTTTT',
      'TTjjjjTTTTTTTTTTTTTTTTTjjjjTTTTTTjjjTTTT',
      'TTTjjTTTTTTTTTTTTTTTTTTjjjTTTTTTTjjjjTTT',
      'TTTjjjTTTTTTTTTTTTTTTTjjjTTTTTTTTTjjjTTT',
      'TTTTjjjjjTTTTTTTTTTTjjjjTTTTTTTTTTjjjTTT',
      'TTTTTTjjjjjjjjjjjjjjjjTTTTTTTTTTTTjjjTTT',
      'TTTTTTTTTTjjjjjjjjjjTTTTTTTTTTTTTTjjjTTT',
      'TTTTTTTTTTTTTjjjjjTTTTTTTTTTTTTTTjjjjTTT',
      'TTTTTTTTTTTTTTpppTTTTTTTTTTTTTTTjjj,,,TT',
      'TTTTTTTTTTTTTTp1pTTTTTTTTTTTTTTT,,,3,,TT',
      'TTTTTTTTTTTTTTpppTTTTTTTTTTTTTT,,,,,,,~~',
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTT~~~~~~~~~~',
    ],
    warps: [
      { mark: 'southRoad', to: 'marrowport', tx: 18, ty: 2, dir: 'down' },
      { mark: 'shrineDoor', to: 'whisperwood', tx: 14, ty: 17, dir: 'up' },
      { mark: 'seaLanding', to: 'SEA', dir: 'down' },
    ],
    npcs: [
      { id: 'gf_herbalist', x: 5, y: 11, style: 'herbalist', dir: 'right', name: 'Serel of the Fathom', dialogue: 'gf_herbalist' },
    ],
    objects: [
      { id: 'gf_sign', x: 15, y: 20, prop: 'sign', solid: true, kind: 'sign', text: 'THE GREEN FATHOM — the ceiba lets you in. Ask it nicely about coming out.' },
      { id: 'gf_shrinesign', x: 17, y: 2, prop: 'sign', solid: true, kind: 'sign', text: 'Offerings go in the bowls. The bowls are older than the shrine.' },
      { id: 'gf_chest1', x: 3, y: 12, prop: 'chest', solid: true, kind: 'chest', contents: { item: 'palmSalve', count: 2 } },
      { id: 'gf_chest2', x: 35, y: 16, prop: 'chest', solid: true, kind: 'chest', contents: { item: 'braidedCord' } },
      { id: 'gf_statue', x: 16, y: 9, prop: 'statue', solid: true, kind: 'examine', text: 'A stone figure with its hands cupped. Something used to be poured into them.' },
    ],
    encounters: {
      rate: 0.055,
      groups: [
        { weight: 3, members: ['thornMimic'] },
        { weight: 3, members: ['groveHowler'] },
        { weight: 2, members: ['thornMimic', 'groveHowler'] },
        { weight: 2, members: ['sapRevenant'] },
        { weight: 1, members: ['groveHowler', 'groveHowler', 'thornMimic'] },
      ],
      safeFlag: null,
    },
  },

  /* ============================== WHISPERWOOD ============================== */
  whisperwood: {
    name: 'Whisperwood Shrine',
    kind: 'dungeon',
    music: 'field',
    w: 30, h: 20, fill: 'v',
    start: { x: 14, y: 17, dir: 'up' },
    tint: 0x6f8f6a,
    marks: {
      1: { id: 'exit', base: 's' },
      2: { id: 'warden', base: 's' },
    },
    rows: [
      'vvvvvvvvvvvvvvvvvvvvvvvvvvvvvv',
      'vvvvvvvvvvvvuuuuuuvvvvvvvvvvvv',
      'vvvvvvvvvvvvus2suvvvvvvvvvvvvv',
      'vvvvvvvvvvvvusssuvvvvvvvvvvvvv',
      'vvvvvvvvvvuusssssuuvvvvvvvvvvv',
      'vvvvvvvvvvussssssssuvvvvvvvvvv',
      'vvvvvvvvuuussssssssuuuvvvvvvvv',
      'vvvvvvvvusssssuuusssssuvvvvvvv',
      'vvvvvvvvusssuuvvvuusssuvvvvvvv',
      'vvvvvuuussssuvvvvvussssuuuvvvv',
      'vvvvvussssssuvvvvvusssssssuvvv',
      'vvvvvusssssssuuuuusssssssuuvvv',
      'vvvvvuussssssssssssssssssuvvvv',
      'vvvvvvvusssssssssssssssssuvvvv',
      'vvvvvvvuusssssssssssssssuuvvvv',
      'vvvvvvvvvusssssssssssssuuvvvvv',
      'vvvvvvvvvvusssssssssssuvvvvvvv',
      'vvvvvvvvvvvussss1sssssuvvvvvvv',
      'vvvvvvvvvvvvuuuuuuuuuuvvvvvvvv',
      'vvvvvvvvvvvvvvvvvvvvvvvvvvvvvv',
    ],
    warps: [
      { mark: 'exit', to: 'greenfathom', tx: 18, ty: 1, dir: 'down' },
    ],
    objects: [
      { id: 'ww_bowl1', x: 9, y: 10, prop: 'bowl', solid: true, kind: 'legendBowl', legend: 'ceibaWarden', counter: 'bowls', filledProp: 'bowlFull' },
      { id: 'ww_bowl2', x: 20, y: 10, prop: 'bowl', solid: true, kind: 'legendBowl', legend: 'ceibaWarden', counter: 'bowls', filledProp: 'bowlFull' },
      { id: 'ww_bowl3', x: 14, y: 14, prop: 'bowl', solid: true, kind: 'legendBowl', legend: 'ceibaWarden', counter: 'bowls', filledProp: 'bowlFull' },
      { id: 'ww_warden', x: 14, y: 2, prop: 'shrine', solid: true, kind: 'legendBoss', legend: 'ceibaWarden' },
      { id: 'ww_chest', x: 10, y: 7, prop: 'chest', solid: true, kind: 'chest', contents: { item: 'saltDraught', count: 3 } },
      { id: 'ww_chest2', x: 19, y: 7, prop: 'chest', solid: true, kind: 'chest', contents: { item: 'coralCenser' } },
      { id: 'ww_vine', x: 14, y: 12, prop: 'vine', solid: false, kind: 'examine', text: 'Roots have grown through the flagstones in the shape of a doorway.' },
    ],
    encounters: {
      rate: 0.07,
      groups: [
        { weight: 3, members: ['sapRevenant'] },
        { weight: 3, members: ['thornMimic', 'thornMimic'] },
        { weight: 2, members: ['groveHowler', 'sapRevenant'] },
        { weight: 1, members: ['sapRevenant', 'sapRevenant'] },
      ],
      safeFlag: 'grove.blessed',
    },
  },

  /* =============================== MOONWRACK =============================== */
  moonwrack: {
    name: 'Moonwrack Shoals',
    kind: 'field',
    music: 'sea',
    w: 40, h: 24, fill: 'n',
    start: { x: 20, y: 21, dir: 'up' },
    forceNight: true,
    weather: 'fog',
    marks: {
      1: { id: 'landing', base: ':' },
      2: { id: 'galleon', base: 'B' },
    },
    rows: [
      'nnnnnnnnnnnnnnnnxxxxxxnnnnnnnnnnnnnnnnnn',
      'nnnnnnnnnnnnnnnxxxxxxxxnnnnnnnnnnnnnnnnn',
      'nnnnnnnnnnnnnnxxBBBBBBxxnnnnnnnnnnnnnnnn',
      'nnnnnnnnnnnnnnxBBBB2BBBxnnnnnnnnnnnnnnnn',
      'nnnnnnnnnnnnnnxBBBBBBBBxnnnnnnnnnnnnnnnn',
      'nnnnnnnnnnnnnnxxBBBBBBxxnnnnnnnnnnnnnnnn',
      'nnnnnnnnnnnnnnn::BBBB::nnnnnnnnnnnnnnnnn',
      'nnnnnnnnnnnnnn:::::::::nnnnnnnnnnnnnnnnn',
      'nnnnnn::::nnnn:::::::::nnnn::::nnnnnnnnn',
      'nnnn::::::::nn:::::::::nn::::::::nnnnnnn',
      'nnn:::::::::::::::::::::::::::::::nnnnnn',
      'nnn::::B::::::::::::::::::::B:::::nnnnnn',
      'nnnn:::::::nnnn:::::nnnn:::::::::nnnnnnn',
      'nnnnn::::nnnnnn:::::nnnnnn::::nnnnnnnnnn',
      'nnnnnnnnnnnnnnn:::::nnnnnnnnnnnnnnnnnnnn',
      'nnnnnnnnnn::::::::::::::::nnnnnnnnnnnnnn',
      'nnnnnnnn::::::::::::::::::::nnnnnnnnnnnn',
      'nnnnnnn::::B:::::::::::B::::::nnnnnnnnnn',
      'nnnnnnn::::::::::::::::::::::nnnnnnnnnnn',
      'nnnnnnnn:::::::::::::::::::nnnnnnnnnnnnn',
      'nnnnnnnnnn:::::::::::::::nnnnnnnnnnnnnnn',
      'nnnnnnnnnnnnn:::1:::::nnnnnnnnnnnnnnnnnn',
      'nnnnnnnnnnnnnn::::::nnnnnnnnnnnnnnnnnnnn',
      'nnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnn',
    ],
    warps: [
      { mark: 'landing', to: 'SEA', dir: 'down' },
    ],
    objects: [
      { id: 'mw_beacon1', x: 7, y: 11, prop: 'beacon', solid: true, kind: 'legendBeacon', legend: 'lanternGalleon', counter: 'beacons', filledProp: 'beaconLit' },
      { id: 'mw_beacon2', x: 28, y: 11, prop: 'beacon', solid: true, kind: 'legendBeacon', legend: 'lanternGalleon', counter: 'beacons', filledProp: 'beaconLit' },
      { id: 'mw_beacon3', x: 18, y: 17, prop: 'beacon', solid: true, kind: 'legendBeacon', legend: 'lanternGalleon', counter: 'beacons', filledProp: 'beaconLit' },
      { id: 'mw_galleon', x: 19, y: 3, prop: 'anchor', solid: true, kind: 'legendBoss', legend: 'lanternGalleon' },
      { id: 'mw_grave', x: 11, y: 17, prop: 'grave', solid: true, kind: 'examine', text: 'A name scratched into a plank and pushed upright into the sand. The name is yours, spelled wrong.' },
      { id: 'mw_chest', x: 33, y: 10, prop: 'chest', solid: true, kind: 'chest', contents: { item: 'kindleCharm' } },
      { id: 'mw_chest2', x: 5, y: 9, prop: 'chest', solid: true, kind: 'chest', contents: { gold: 180 } },
    ],
    encounters: {
      rate: 0.06,
      groups: [
        { weight: 3, members: ['drownedDeckhand'] },
        { weight: 3, members: ['lanternWisp', 'lanternWisp'] },
        { weight: 2, members: ['drownedDeckhand', 'lanternWisp'] },
        { weight: 2, members: ['barnacleGunner'] },
        { weight: 1, members: ['drownedDeckhand', 'drownedDeckhand', 'barnacleGunner'] },
      ],
      safeFlag: 'curse.lifted',
    },
  },

  /* ============================ SABLE MANGROVES ============================ */
  mangroves: {
    name: 'The Sable Mangroves',
    kind: 'field',
    music: 'field',
    w: 40, h: 24, fill: 'w',
    start: { x: 20, y: 21, dir: 'up' },
    weather: 'rain',
    tint: 0x7f9f8f,
    marks: {
      1: { id: 'landing', base: 'G' },
      2: { id: 'townRoad', base: '=' },
      3: { id: 'stilthouse', base: 'F' },
    },
    rows: [
      'wwwwwwwwwwwwwwwwwFFFFFwwwwwwwwwwwwwwwwww',
      'wwwwwwwwwwwwwwwwwFF3FFwwwwwwwwwwwwwwwwww',
      'wwwwwwwwwwwwwwwwwFFFFFwwwwwwwwwwwwwwwwww',
      'wwwwwwwwwwwwwwwwwww-wwwwwwwwwwwwwwwwwwww',
      'wwwwwwwwwmmmwwwwwww-wwwwwwwwmmmwwwwwwwww',
      'wwwwwwwmGGGGGmwwwww-wwwwwwmGGGGGmwwwwwww',
      'wwwwwwmGGGGGGGmwwww-wwwwwmGGGGGGGmwwwwww',
      'wwwwwwmGGGGGGGmwwww-wwwwwmGGGGGGGmwwwwww',
      'wwwwwwwmGGGGGmwwwww-wwwwwwmGGGGGmwwwwwww',
      'wwwwwwwwmGGGmwwwwww-wwwwwwwmGGGmwwwwwwww',
      'wwwwwwwwww-wwwwwwww-wwwwwwww-wwwwwwwwwww',
      'wwwwwwwwww-wwwwwwww-wwwwwwww-wwwwwwwwwww',
      'wwwwwwwGGGGGGGGGGGGGGGGGGGGGGGGGGwwwwwww',
      'wwwwwwGGGGGGGGGGGGGGGGGGGGGGGGGGGGwwwwww',
      'wwwwwGGGGmmGGGGGGGGGGGGGGGGmmGGGGGGwwwww',
      'wwwwwGGGmwwmGGGGGGGGGGGGGGmwwmGGGGGGwwww',
      'wwwwwwGGmwwmGGGrrrrrGGGGmwwmGGGGGwwwwwww',
      'wwwwwwwGGGGGGGGrrrrrGGGGGGGGGGGwwwwwwwww',
      'wwwwwwwwGGGGGGGGGGGGGGGGGGGGGGwwwwwwwwww',
      'wwwwwwwwwGGGGGGGGGGGGGGGGGGGGwwwwwwwwwww',
      'wwwwwwwwwwGGGGGGGGGGGGGGGGGGwwwwwwwwwwww',
      'wwwwwwwwwwwGGGGGGG1GGGGGGGGwwwwwwwwwwwww',
      'wwwwwwwwww==GGGGGGGGGGGGGGGwwwwwwwwwwwww',
      'wwwwwwwww=2=wwwwwwwwwwwwwwwwwwwwwwwwwwww',
    ],
    warps: [
      { mark: 'landing', to: 'SEA', dir: 'down' },
      { mark: 'townRoad', to: 'mireborne', tx: 19, ty: 1, dir: 'down' },
    ],
    objects: [
      { id: 'mg_light1', x: 10, y: 6, prop: 'lantern', solid: true, kind: 'legendLight', legend: 'sablemanMires', counter: 'lights' },
      { id: 'mg_light2', x: 29, y: 6, prop: 'lantern', solid: true, kind: 'legendLight', legend: 'sablemanMires', counter: 'lights' },
      { id: 'mg_light3', x: 21, y: 17, prop: 'lantern', solid: true, kind: 'legendLight', legend: 'sablemanMires', counter: 'lights' },
      { id: 'mg_false1', x: 7, y: 15, prop: 'lantern', solid: true, kind: 'falseLight' },
      { id: 'mg_false2', x: 33, y: 15, prop: 'lantern', solid: true, kind: 'falseLight' },
      { id: 'mg_sableman', x: 19, y: 1, prop: 'lantern', solid: true, kind: 'legendBoss', legend: 'sablemanMires' },
      { id: 'mg_chest', x: 12, y: 13, prop: 'chest', solid: true, kind: 'chest', contents: { item: 'driftglassCharm' } },
      { id: 'mg_chest2', x: 25, y: 18, prop: 'chest', solid: true, kind: 'chest', contents: { gold: 260 } },
      { id: 'mg_sign', x: 17, y: 20, prop: 'sign', solid: true, kind: 'sign', text: 'THE SABLE MANGROVES — count the lanterns. If the count changes, do not follow either.' },
    ],
    encounters: {
      rate: 0.06,
      groups: [
        { weight: 3, members: ['lanternjack', 'lanternjack'] },
        { weight: 3, members: ['mireLurker'] },
        { weight: 2, members: ['bogShade'] },
        { weight: 2, members: ['mireLurker', 'lanternjack'] },
        { weight: 1, members: ['bogShade', 'bogShade'] },
      ],
      safeFlag: 'mires.safe',
    },
  },

  /* ================================ MIREBORNE ============================== */
  mireborne: {
    name: 'Mireborne',
    kind: 'town',
    music: 'town',
    w: 40, h: 22, fill: 'w',
    start: { x: 20, y: 3, dir: 'down' },
    tint: 0x93a9a0,
    marks: {
      1: { id: 'mireRoad', base: '=' },
      2: { id: 'berth', base: '=' },
    },
    rows: [
      'wwwwwwwwwwwwwwwwww=1=wwwwwwwwwwwwwwwwwww',
      'wwwwwwwwwwwwwwwwww===wwwwwwwwwwwwwwwwwww',
      'wwwwwwwwwwwwwww=======wwwwwwwwwwwwwwwwww',
      'wwwwwwwwwwww============wwwwwwwwwwwwwwww',
      'wwwwwwwyyyy=============yyyywwwwwwwwwwww',
      'wwwwwwwyyyy=============yyyywwwwwwwwwwww',
      'wwwwwwwHHHH=============HHHHwwwwwwwwwwww',
      'wwwwwwwHHHH=============HHHHwwwwwwwwwwww',
      'wwwwww==================================',
      'wwwwww==================================',
      'wwwwww=====yyyyyy======yyyy=============',
      'wwwwww=====yyyyyy======yyyy=============',
      'wwwwww=====HHHHHH======HHHH=============',
      'wwwwww=====HHHHHH======HHHH=============',
      'wwwwww==================================',
      'wwwwwww===============================ww',
      'wwwwwwww=============================www',
      'wwwwwwwwww========================wwwwww',
      'wwwwwwwwwwww===============wwwwwwwwwwwww',
      'wwwwwwwwwwwwww=========wwwwwwwwwwwwwwwww',
      'wwwwwwwwwwwwwwww==2==wwwwwwwwwwwwwwwwwww',
      'wwwwwwwwwwwwwwwwww=wwwwwwwwwwwwwwwwwwwww',
    ],
    warps: [
      { mark: 'mireRoad', to: 'mangroves', tx: 12, ty: 22, dir: 'up' },
      { mark: 'berth', to: 'SEA', dir: 'down' },
    ],
    npcs: [
      { id: 'mb_broker', x: 14, y: 14, style: 'smuggler', dir: 'down', name: 'Broker Ilsan', dialogue: 'mb_broker', shop: 'mireborne' },
      { id: 'mb_inn', x: 25, y: 14, style: 'merchant', dir: 'down', name: 'The Low Wick', dialogue: 'mb_inn', inn: { price: 30 } },
      { id: 'mb_lanternkeeper', x: 10, y: 8, style: 'elder', dir: 'right', name: 'Lantern-keeper Yeva', dialogue: 'mb_lantern' },
      { id: 'mb_runner', x: 28, y: 9, style: 'smuggler', dir: 'left', name: 'Runner Kess', dialogue: 'mb_runner', wander: true },
      { id: 'mb_fisher', x: 18, y: 16, style: 'fisher', dir: 'down', name: 'Netmender Bo', dialogue: 'mb_fisher' },
      { id: 'mb_priest', x: 20, y: 5, style: 'priest', dir: 'down', name: 'Keeper of the Low Names', dialogue: 'mb_priest' },
    ],
    objects: [
      { id: 'mb_sign', x: 20, y: 8, prop: 'sign', solid: true, kind: 'sign', text: 'MIREBORNE — no flags, no questions, no credit.' },
      { id: 'mb_barrel', x: 12, y: 9, prop: 'barrel', solid: true, kind: 'decor' },
      { id: 'mb_crate', x: 27, y: 15, prop: 'crate', solid: true, kind: 'decor' },
      { id: 'mb_lantern1', x: 16, y: 8, prop: 'lantern', solid: true, kind: 'decor', night: true },
      { id: 'mb_lantern2', x: 24, y: 8, prop: 'lantern', solid: true, kind: 'decor', night: true },
      { id: 'mb_chest', x: 8, y: 16, prop: 'chest', solid: true, kind: 'chest', contents: { item: 'smokePot', count: 3 } },
    ],
  },

  /* ============================== ASHFALL REST ============================= */
  ashfall: {
    name: 'Ashfall Rest',
    kind: 'town',
    music: 'town',
    w: 36, h: 22, fill: '^',
    start: { x: 18, y: 18, dir: 'up' },
    tint: 0xd9b49a,
    marks: {
      1: { id: 'berth', base: '=' },
      2: { id: 'ruinRoad', base: 'A' },
    },
    rows: [
      '^^^^^^^^^^^^^^^^^^2^^^^^^^^^^^^^^^^^',
      '^^^^^^^^^^^^^^^^^^A^^^^^^^^^^^^^^^^^',
      '^^^^^^^^^^^^^^^AAAAA^^^^^^^^^^^^^^^^',
      '^^^^^^^^^^^^^AAAAAAAAA^^^^^^^^^^^^^^',
      '^^^^^^^^^^^AAAAAAAAAAAAA^^^^^^^^^^^^',
      '^^^^^^^///AAAAAAAAAAAAA///^^^^^^^^^^',
      '^^^^^^^///AAAAAAAAAAAAA///^^^^^^^^^^',
      '^^^^^^^PPPAAAAAAAAAAAAAPPP^^^^^^^^^^',
      '^^^^^^^PPPAAAAAAAAAAAAAPPP^^^^^^^^^^',
      '^^^^^^AAAAAAAAAAAAAAAAAAAAAA^^^^^^^^',
      '^^^^^AAAAAAAAAAAAAAAAAAAAAAAA^^^^^^^',
      '^^^^^AAAA///AAAAAAA///AAAAAAA^^^^^^^',
      '^^^^^AAAA///AAAAAAA///AAAAAAA^^^^^^^',
      '^^^^^AAAAPPPAAAAAAAPPPAAAAAAA^^^^^^^',
      '^^^^^AAAAPPPAAAAAAAPPPAAAAAAA^^^^^^^',
      '^^^^^AAAAAAAAAAAAAAAAAAAAAAAA^^^^^^^',
      '^^^^^^AAAAAAAAAAAAAAAAAAAAAA^^^^^^^^',
      '^^^^^^^AAAAAAAAAAAAAAAAAAAA^^^^^^^^^',
      ',,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,',
      '~~~~~~~~~~~~~~~~==~~~~~~~~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~~==~~~~~~~~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~~=1~~~~~~~~~~~~~~~~~~',
    ],
    warps: [
      { mark: 'berth', to: 'SEA', dir: 'down' },
      { mark: 'ruinRoad', to: 'emberpath', tx: 15, ty: 20, dir: 'up' },
    ],
    npcs: [
      { id: 'af_smith', x: 10, y: 15, style: 'smith', dir: 'down', name: 'Forgekeeper Danu', dialogue: 'af_smith', shop: 'ashfall' },
      { id: 'af_inn', x: 22, y: 15, style: 'merchant', dir: 'down', name: 'The Cinder Rest', dialogue: 'af_inn', inn: { price: 40 } },
      { id: 'af_digger', x: 8, y: 9, style: 'maroon', dir: 'right', name: 'Relic-hand Coro', dialogue: 'af_digger' },
      { id: 'af_watch', x: 18, y: 3, style: 'officer', dir: 'down', name: 'Vent-watch Milla', dialogue: 'af_watch' },
      { id: 'af_child', x: 26, y: 10, style: 'child', dir: 'left', name: 'Sooty', dialogue: 'af_child', wander: true },
    ],
    objects: [
      { id: 'af_sign', x: 18, y: 9, prop: 'sign', solid: true, kind: 'sign', text: 'ASHFALL REST — the mountain gives back everything eventually. Bring a ward.' },
      { id: 'af_fire', x: 16, y: 12, prop: 'fire', solid: true, kind: 'examine', text: 'A vent fire that nobody lit and nobody puts out.' },
      { id: 'af_chest', x: 6, y: 11, prop: 'chest', solid: true, kind: 'chest', contents: { item: 'powderFlask', count: 2 } },
      { id: 'af_cannon', x: 27, y: 16, prop: 'cannon', solid: true, kind: 'decor' },
    ],
  },

  /* ============================ EMBERPATH RUINS ============================ */
  emberpath: {
    name: 'Emberpath Ruins',
    kind: 'dungeon',
    music: 'field',
    w: 32, h: 22, fill: '!',
    start: { x: 15, y: 20, dir: 'up' },
    tint: 0xffb08a,
    weather: 'ash',
    marks: {
      1: { id: 'exit', base: 'A' },
      2: { id: 'vault', base: 's' },
      3: { id: 'sentinel', base: 's' },
    },
    rows: [
      '!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!',
      '!!!!!!!!!!!!uuuuuuuu!!!!!!!!!!!!',
      '!!!!!!!!!!!!us2ssssu!!!!!!!!!!!!',
      '!!!!!!!!!!!!ussssssu!!!!!!!!!!!!',
      '!!!!!!!!!!!!uus3suuu!!!!!!!!!!!!',
      '!!!!!!!!!!!!!!sss!!!!!!!!!!!!!!!',
      '!!!!!!!!!!!!!!sss!!!!!!!!!!!!!!!',
      '!!!!!!!!!llllsssslll!!!!!!!!!!!!',
      '!!!!!!!lllLLllsslLLlll!!!!!!!!!!',
      '!!!!!!lllLLLllsslLLLlll!!!!!!!!!',
      '!!!!!!llllLLllsslLLllll!!!!!!!!!',
      '!!!!!!lllllllssssllllll!!!!!!!!!',
      '!!!!!AAAllllsssssslllAAA!!!!!!!!',
      '!!!!AAAAAAAAssssssAAAAAAA!!!!!!!',
      '!!!!AAAAAAAAAAAAAAAAAAAAA!!!!!!!',
      '!!!!AAALLLAAAAAAAAAALLLAA!!!!!!!',
      '!!!!AAALLLAAAAAAAAAALLLAA!!!!!!!',
      '!!!!AAAAAAAAAAAAAAAAAAAAA!!!!!!!',
      '!!!!!AAAAAAAAAAAAAAAAAAA!!!!!!!!',
      '!!!!!!!AAAAAAAAAAAAAAA!!!!!!!!!!',
      '!!!!!!!!!!!!!!A1A!!!!!!!!!!!!!!!',
      '!!!!!!!!!!!!!!AAA!!!!!!!!!!!!!!!',
    ],
    warps: [
      { mark: 'exit', to: 'ashfall', tx: 18, ty: 1, dir: 'down' },
    ],
    objects: [
      { id: 'ep_brazier1', x: 6, y: 13, prop: 'brazier', solid: true, kind: 'legendBrazier', legend: 'ashenCrown', counter: 'braziers', filledProp: 'brazierLit' },
      { id: 'ep_brazier2', x: 24, y: 13, prop: 'brazier', solid: true, kind: 'legendBrazier', legend: 'ashenCrown', counter: 'braziers', filledProp: 'brazierLit' },
      { id: 'ep_brazier3', x: 15, y: 17, prop: 'brazier', solid: true, kind: 'legendBrazier', legend: 'ashenCrown', counter: 'braziers', filledProp: 'brazierLit' },
      { id: 'ep_sentinel', x: 15, y: 4, prop: 'statue', solid: true, kind: 'legendElite', legend: 'ashenCrown' },
      { id: 'ep_idol', x: 14, y: 2, prop: 'relic', solid: true, kind: 'legendBoss', legend: 'ashenCrown' },
      { id: 'ep_chest', x: 5, y: 16, prop: 'chest', solid: true, kind: 'chest', contents: { item: 'galleyStew', count: 2 } },
      { id: 'ep_chest2', x: 23, y: 16, prop: 'chest', solid: true, kind: 'chest', contents: { gold: 420 } },
      { id: 'ep_grave', x: 15, y: 12, prop: 'grave', solid: true, kind: 'examine', text: 'A row of ash-cast footprints, walking in. None walking out.' },
    ],
    encounters: {
      rate: 0.07,
      groups: [
        { weight: 3, members: ['ashSkeleton', 'ashSkeleton'] },
        { weight: 3, members: ['cinderMoth'] },
        { weight: 2, members: ['slagCrawler'] },
        { weight: 2, members: ['ashSkeleton', 'cinderMoth'] },
        { weight: 1, members: ['slagCrawler', 'ashSkeleton'] },
      ],
      safeFlag: 'ember.open',
    },
    heatGate: true,
  },

  /* ============================== PEARLMAW REEF ============================ */
  pearlmaw: {
    name: 'Pearlmaw Reef',
    kind: 'field',
    music: 'sea',
    w: 36, h: 22, fill: 'o',
    start: { x: 18, y: 20, dir: 'up' },
    tint: 0xa8dcea,
    marks: {
      1: { id: 'landing', base: 'c' },
      2: { id: 'throne', base: 'c' },
      3: { id: 'gate', base: 'c' },
    },
    rows: [
      'oooooooooooooCCCCCCooooooooooooooooo',
      'ooooooooooooCCcccc2Cooooooooooooooo',
      'ooooooooooooCccccccCooooooooooooooo',
      'oooooooooooCCcccccccCoooooooooooooo',
      'oooooooooooCcccC3CccCoooooooooooooo',
      'ooooooooooCCccCCoCCccCooooooooooooo',
      'ooooooooooCcccCoooooCcccCoooooooooo',
      'oooooooooCcccCooooooooCcccCooooooooo',
      'oooooooCCcccCoooooooooooCcccCoooooo',
      'ooooooCcccccCoooooooooooCccccCooooo',
      'oooooCccccccccccccccccccccccccCoooo',
      'ooooCccccccccccccccccccccccccccCooo',
      'ooooCcccCCCcccccccccccccCCCccccCooo',
      'oooooCccCoooCcccccccccCoooCcccCoooo',
      'ooooooCcCooooCcccccccCooooCccCooooo',
      'oooooooCCooooCcccccccCooooCCCooooooo',
      'ooooooooooooCcccccccccCoooooooooooo',
      'oooooooooooCcccccccccccCooooooooooo',
      'ooooooooooCcccccccccccccCoooooooooo',
      'oooooooooooCccccccccccCooooooooooooo',
      'ooooooooooooCccc1cccCoooooooooooooo',
      'oooooooooooooCCCCCCCoooooooooooooooo',
    ],
    warps: [
      { mark: 'landing', to: 'SEA', dir: 'down' },
    ],
    objects: [
      { id: 'pm_pearl1', x: 7, y: 11, prop: 'pearl', solid: true, kind: 'legendPearl', legend: 'pearlWidow', counter: 'pearls' },
      { id: 'pm_pearl2', x: 28, y: 11, prop: 'pearl', solid: true, kind: 'legendPearl', legend: 'pearlWidow', counter: 'pearls' },
      { id: 'pm_pearl3', x: 17, y: 17, prop: 'pearl', solid: true, kind: 'legendPearl', legend: 'pearlWidow', counter: 'pearls' },
      { id: 'pm_chorus', x: 16, y: 4, prop: 'statue', solid: true, kind: 'legendElite', legend: 'pearlWidow' },
      { id: 'pm_throne', x: 18, y: 1, prop: 'shrine', solid: true, kind: 'legendBoss', legend: 'pearlWidow' },
      { id: 'pm_chest', x: 6, y: 13, prop: 'chest', solid: true, kind: 'chest', contents: { item: 'reefmail' } },
      { id: 'pm_chest2', x: 29, y: 13, prop: 'chest', solid: true, kind: 'chest', contents: { gold: 380 } },
      { id: 'pm_rope', x: 18, y: 19, prop: 'ropeCoil', solid: false, kind: 'examine', text: 'A diving line, cut clean at the far end. Somebody let go on purpose.' },
    ],
    encounters: {
      rate: 0.065,
      groups: [
        { weight: 3, members: ['reefSiren'] },
        { weight: 3, members: ['coralHusk'] },
        { weight: 2, members: ['gulperEel'] },
        { weight: 2, members: ['reefSiren', 'coralHusk'] },
        { weight: 1, members: ['gulperEel', 'reefSiren'] },
      ],
      safeFlag: 'reef.truce',
    },
    breathGate: true,
  },

  /* ============================== WAILING PASS ============================= */
  wailingpass: {
    name: 'The Wailing Pass',
    kind: 'field',
    music: 'sea',
    w: 34, h: 22, fill: 'X',
    start: { x: 15, y: 20, dir: 'up' },
    tint: 0x8fa4c8,
    weather: 'storm',
    marks: {
      1: { id: 'landing', base: ':' },
      2: { id: 'saint', base: ':' },
      3: { id: 'trench', base: 'V' },
    },
    rows: [
      'XXXXXXXXXXXXXX!!!!!!XXXXXXXXXXXXXX',
      'XXXXXXXXXXXX!!VVVVVV!!XXXXXXXXXXXX',
      'XXXXXXXXXXX!!VVVV3VVV!!XXXXXXXXXXX',
      'XXXXXXXXXXX!VVVVVVVVVV!XXXXXXXXXXX',
      'XXXXXXXXXXX!!VVVVVVVV!!XXXXXXXXXXX',
      'XXXXXXXXXXXX!!!:2:!!!!XXXXXXXXXXXX',
      'XXXXXXXXXXXXXX:::XXXXXXXXXXXXXXXXX',
      'XXXXXXXXXXXXX:::::XXXXXXXXXXXXXXXX',
      'XXXXXXXXXXX:::::::::XXXXXXXXXXXXXX',
      'XXXXXXXXX:::::::::::::XXXXXXXXXXXX',
      'XXXXXXX:::::::::::::::::XXXXXXXXXX',
      'XXXXXX!:::::::::::::::::!XXXXXXXXX',
      'XXXXX!!:::::!!!!!:::::::!!XXXXXXXX',
      'XXXXX!::::!!!XXX!!!:::::!!XXXXXXXX',
      'XXXXX!:::!!XXXXXXX!!:::::!XXXXXXXX',
      'XXXXXX!::!XXXXXXXXX!::::!XXXXXXXXX',
      'XXXXXX!!::!!XXXXX!!:::!!XXXXXXXXXX',
      'XXXXXXX!!::!!!!!!!!:::!XXXXXXXXXXX',
      'XXXXXXXX!!:::::::::::!!XXXXXXXXXXX',
      'XXXXXXXXX!!:::::::::!!XXXXXXXXXXXX',
      'XXXXXXXXXX!!!!:1:!!!!XXXXXXXXXXXXX',
      'XXXXXXXXXXXXX!!!!!XXXXXXXXXXXXXXXX',
    ],
    warps: [
      { mark: 'landing', to: 'SEA', dir: 'down' },
    ],
    objects: [
      { id: 'wp_saint', x: 16, y: 5, prop: 'shrine', solid: true, kind: 'legendBoss', legend: 'stormSaint' },
      { id: 'wp_trench', x: 17, y: 2, prop: 'doorArch', solid: true, kind: 'trench' },
      { id: 'wp_chest', x: 8, y: 11, prop: 'chest', solid: true, kind: 'chest', contents: { item: 'stormweave' } },
      { id: 'wp_chest2', x: 22, y: 11, prop: 'chest', solid: true, kind: 'chest', contents: { item: 'kindleCharm', count: 2 } },
      { id: 'wp_grave', x: 12, y: 18, prop: 'grave', solid: true, kind: 'examine', text: 'Sixty years of wrecks, stacked into a cairn by something with hands.' },
    ],
    encounters: {
      rate: 0.075,
      groups: [
        { weight: 3, members: ['squallWraith'] },
        { weight: 3, members: ['stormRay'] },
        { weight: 2, members: ['brinebornHerald'] },
        { weight: 2, members: ['squallWraith', 'stormRay'] },
        { weight: 1, members: ['brinebornHerald', 'squallWraith'] },
      ],
      safeFlag: 'pass.cleared',
    },
  },

  /* =========================== BLACKWATER TRENCH =========================== */
  blackwater: {
    name: 'Blackwater Trench',
    kind: 'dungeon',
    music: 'boss',
    w: 24, h: 16, fill: 'V',
    start: { x: 11, y: 14, dir: 'up' },
    tint: 0x6a5f8a,
    marks: {
      1: { id: 'exit', base: 'V' },
      2: { id: 'bell', base: 'V' },
    },
    rows: [
      'VVVVVVVVVVVVVVVVVVVVVVVV',
      'VVVVVVVVVVV2VVVVVVVVVVVV',
      'VVVVVVVVVVVVVVVVVVVVVVVV',
      'VVVVVVVVOOOOOOVVVVVVVVVV',
      'VVVVVVOOOOOOOOOOVVVVVVVV',
      'VVVVVOOOOOOOOOOOOVVVVVVV',
      'VVVVOOOOOOOOOOOOOOVVVVVV',
      'VVVVOOOOOOOOOOOOOOVVVVVV',
      'VVVVVOOOOOOOOOOOOVVVVVVV',
      'VVVVVVOOOOOOOOOOVVVVVVVV',
      'VVVVVVVOOOOOOOOVVVVVVVVV',
      'VVVVVVVVOOOOOOVVVVVVVVVV',
      'VVVVVVVVVOOOOVVVVVVVVVVV',
      'VVVVVVVVVVVVVVVVVVVVVVVV',
      'VVVVVVVVVVV1VVVVVVVVVVVV',
      'VVVVVVVVVVVVVVVVVVVVVVVV',
    ],
    warps: [
      { mark: 'exit', to: 'wailingpass', tx: 17, ty: 4, dir: 'down' },
    ],
    objects: [
      { id: 'bw_bell', x: 11, y: 1, prop: 'anchor', solid: true, kind: 'legendBoss', legend: 'ironBell' },
      { id: 'bw_chest', x: 6, y: 7, prop: 'chest', solid: true, kind: 'chest', contents: { item: 'kindleCharm', count: 3 } },
    ],
    encounters: {
      rate: 0.05,
      groups: [
        { weight: 2, members: ['squallWraith', 'squallWraith'] },
        { weight: 2, members: ['brinebornHerald'] },
      ],
      safeFlag: 'ironbell.settled',
    },
  },
};

/* ------------------------------------------------------------------ *
 * The sea chart — free sailing between islands.
 * ------------------------------------------------------------------ */

export const SEA_CHART = {
  name: 'The Sunder Reach',
  w: 48, h: 32, fill: 'W',
  music: 'sea',
  rows: [
    'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
    'WWWWWWWWW~~~~~~WWWWWWWWWWWWWWWWWWW~~~~~~WWWWWWWW',
    'WWWWWWW~~~,,,,~~~WWWWWWWWWWWWWWW~~~,,,,~~~WWWWWW',
    'WWWWWW~~,,,%%,,,~~WWWWWWWWWWWWW~~,,,::,,,~~WWWWW',
    'WWWWW~~,,,%%%%,,,~~WWWWWWWWWWW~~,,::::::,,~~WWWW',
    'WWWWW~,,,%%%%%%,,,~WWWWWWWWWWW~,,::xx::::,,~WWWW',
    'WWWWW~,,,%%%%%%,,,~WWWWWWWWWWW~,,,::::::,,,~WWWW',
    'WWWWW~~,,,%%%%,,,~~WWWWWWWWWWWW~~,,,::,,,~~WWWWW',
    'WWWWWW~~~,,,,~~~WWWWWWWWWWWWWWWWW~~,,,,~~WWWWWWW',
    'WWWWWWWW~~~~~~WWWWWWWWWWWWWWWWWWWWW~~~~WWWWWWWWW',
    'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWWW~~~~~~~~~~~~WWWWWWWWWWWWWWWWWWWWWW',
    'WWWWWWWWWWWW~~~,,,,,,,,,,~~~WWWWWWWWWWWWWWWWWWWW',
    'WWWWWWWWWWW~~,,,....TT....,,,~~WWWWWWWWWWWWWWWWW',
    'WWWWWWWWWW~~,,,..TTTTTTTT..,,,~~WWWWWWWWWWWWWWWW',
    'WWWWWWWWW~~,,,..TTTTTTTTTT..,,,~~WWWWWWWWWWWWWWW',
    'WWWWWWWWW~,,,..TTTTTTTTTTTT..,,,~WWWWWWWWWWWWWWW',
    'WWWWWWWWW~,,,..TTTTTTTTTTTT..,,,~WWWWWWWWWWWWWWW',
    'WWWWWWWWW~~,,,..TTTTTTTTTT..,,,~~WWWWWWWWWWWWWWW',
    'WWWWWWWWWW~~,,,..TTTTTTTT..,,,~~WWWWWWWWWWWWWWWW',
    'WWWWWWWWWWW~~,,,,........,,,,~~WWWWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWW~~~,,,,,,,,,,~~~WWWWWWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWWWWW~~~~~~~~~~WWWWWWWWWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
    'WWWWWW~~~~~WWWWWWWWWWWWWWWWWWW~~~~~~~~~WWWWWWWWW',
    'WWWWW~~GGG~~WWWWWWWWWWWWWWWW~~~lllll~~~WWWWWWWWW',
    'WWWW~~GGGGGG~~WWWWWWWWWWWWW~~lllLLllll~~WWWWWWWW',
    'WWWW~GGGGGGGGG~WWWWWWWWWWW~~llllLLllll~~WWWWWWWW',
    'WWWW~~GGGGGGG~~WWWWWWWWWWWW~~lllllllll~~WWWWWWWW',
    'WWWWW~~~GGG~~~WWWWWWWWWWWWWWW~~lllll~~WWWWWWWWWW',
    'WWWWWWWW~~~WWWWWWWWWWWWWWWWWWWWW~~~WWWWWWWWWWWWW',
  ],
  start: { x: 24, y: 24 },
  /** Ports: where the ship can put in, and what gates them. */
  ports: [
    {
      id: 'marrowport', map: 'marrowport', x: 24, y: 22, label: 'Marrowport',
      blurb: 'Coral harbour. Home berth.',
    },
    {
      id: 'greenfathom', map: 'greenfathom', x: 21, y: 13, label: 'Green Fathom',
      blurb: 'Jungle interior. The ceiba stands somewhere inside.',
      legend: 'ceibaWarden',
    },
    {
      id: 'moonwrack', map: 'moonwrack', x: 12, y: 9, label: 'Moonwrack Shoals',
      blurb: 'Haunted shallows. Lanterns on the water after dark.',
      legend: 'lanternGalleon',
    },
    {
      id: 'pearlmaw', map: 'pearlmaw', x: 36, y: 9, label: 'Pearlmaw Reef',
      blurb: 'Pearl beds and a song under the water.',
      legend: 'pearlWidow',
      requires: 'route.pearlmaw',
      denied: 'The reef road is fogged solid. Something out at Moonwrack is holding it shut.',
    },
    {
      id: 'mangroves', map: 'mangroves', x: 12, y: 28, label: 'Sable Mangroves',
      blurb: 'Stilt-village and false lights.',
      legend: 'sablemanMires',
    },
    {
      id: 'mireborne', map: 'mireborne', x: 6, y: 27, label: 'Mireborne',
      blurb: 'No flags, no questions.',
    },
    {
      id: 'ashfall', map: 'ashfall', x: 28, y: 28, label: 'Ashfall Rest',
      blurb: 'Cliff outpost under the ash plume.',
      legend: 'ashenCrown',
    },
    {
      id: 'wailingpass', map: 'wailingpass', x: 42, y: 4, label: 'The Wailing Pass',
      blurb: 'A hurricane that has not moved in sixty years.',
      legend: 'stormSaint',
      requires: 'ship.stormSail',
      denied: 'The Salt Wren cannot take that wind. Not with this rigging.',
    },
  ],
  /** Random sea encounters happen only in these rectangles. */
  danger: [
    { x0: 2, y0: 2, x1: 20, y1: 12, groups: [{ weight: 2, members: ['drownedDeckhand', 'lanternWisp'] }, { weight: 1, members: ['barnacleGunner'] }], flag: 'curse.lifted' },
    { x0: 28, y0: 2, x1: 46, y1: 12, groups: [{ weight: 2, members: ['reefSiren'] }, { weight: 1, members: ['gulperEel'] }], flag: 'reef.cleared' },
    { x0: 2, y0: 22, x1: 20, y1: 31, groups: [{ weight: 2, members: ['lanternjack', 'lanternjack'] }, { weight: 1, members: ['mireLurker'] }], flag: 'mires.safe' },
    { x0: 26, y0: 22, x1: 46, y1: 31, groups: [{ weight: 2, members: ['cinderMoth'] }, { weight: 1, members: ['slagCrawler'] }], flag: 'ember.open' },
  ],
  encounterRate: 0.012,
};

/* ------------------------------------------------------------------ *
 * Compiler
 * ------------------------------------------------------------------ */

const compiled = new Map();

/**
 * Turn an authored sketch into flat arrays the field renderer can index.
 * Rows shorter than `w` are padded with the map's `fill` character, so
 * hand-authored sketches never have to be counted to the character.
 */
export function buildMap(id) {
  if (compiled.has(id)) return compiled.get(id);
  const def = MAPS[id];
  if (!def) throw new Error(`maps: unknown map "${id}"`);
  return compiled.set(id, compileSketch(id, def)).get(id);
}

export function compileSketch(id, def) {
  const { w, h, fill = '.' } = def;
  const chars = new Array(w * h).fill(fill);
  const marks = {};

  for (let y = 0; y < h; y++) {
    const row = def.rows[y] ?? '';
    for (let x = 0; x < w; x++) {
      const ch = row[x] ?? fill;
      if (ch >= '0' && ch <= '9') {
        const markDef = def.marks?.[ch];
        if (markDef) {
          marks[markDef.id] = { x, y };
          chars[y * w + x] = markDef.base;
          continue;
        }
      }
      chars[y * w + x] = TILE_DEFS[ch] ? ch : fill;
    }
  }

  const solid = new Uint8Array(w * h);
  for (let i = 0; i < chars.length; i++) {
    solid[i] = TILE_DEFS[chars[i]]?.solid ? 1 : 0;
  }

  // Objects marked solid also block movement.
  for (const obj of def.objects ?? []) {
    if (obj.solid && obj.x >= 0 && obj.x < w && obj.y >= 0 && obj.y < h) {
      solid[obj.y * w + obj.x] = 1;
    }
  }

  const warps = (def.warps ?? []).map((warp) => {
    if (warp.mark) {
      const at = marks[warp.mark];
      if (!at) throw new Error(`maps: map "${id}" has no mark "${warp.mark}"`);
      return { ...warp, x: at.x, y: at.y };
    }
    return warp;
  });

  return {
    id,
    ...def,
    chars,
    solid,
    marks,
    warps,
    npcs: (def.npcs ?? []).map((n) => ({ ...n })),
    objects: (def.objects ?? []).map((o) => ({ ...o })),
  };
}

/** Sea chart shares the tile vocabulary but has its own compile pass. */
export function buildSeaChart() {
  if (compiled.has('__sea')) return compiled.get('__sea');
  const { w, h, fill } = SEA_CHART;
  const chars = new Array(w * h).fill(fill);
  const solid = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const row = SEA_CHART.rows[y] ?? '';
    for (let x = 0; x < w; x++) {
      const ch = TILE_DEFS[row[x]] ? row[x] : fill;
      chars[y * w + x] = ch;
      // At sea, land blocks the ship and water does not.
      const def = TILE_DEFS[ch];
      const isWater = ch === 'W' || ch === '~' || ch === '_' || ch === 'n' || ch === 'X' || ch === 'o';
      solid[y * w + x] = isWater ? 0 : 1;
      void def;
    }
  }
  // Ports punch a dock hole through the coastline.
  for (const port of SEA_CHART.ports) {
    solid[port.y * w + port.x] = 0;
  }
  const result = { ...SEA_CHART, chars, solid };
  compiled.set('__sea', result);
  return result;
}

export const MAP_IDS = Object.keys(MAPS);
