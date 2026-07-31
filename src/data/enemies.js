/**
 * The bestiary: 21 regular enemies, 3 elites, 7 legend bosses and a rival crew.
 *
 * `guard` is the Break shield — hitting an elemental weakness strips one pip,
 * and at zero the enemy is Broken: it loses its next turn and takes +50%.
 * `weak` / `resist` are what make the elements matter; every legend region has
 * a different answer.
 */

export const ENEMIES = {
  /* ---------------------- coastal / tutorial ---------------------- */
  wreckCrab: {
    name: 'Wreck Crab', art: 'wreckCrab', level: 1,
    hp: 40, mp: 0, atk: 9, def: 5, mag: 4, res: 3, spd: 7, guard: 2,
    weak: ['steel'], resist: ['tide'],
    skills: [{ id: 'clawSwipe', weight: 2 }],
    xp: 8, gold: 9, drops: [{ item: 'rumTonic', chance: 0.2 }],
    flavor: 'It has made a home of somebody’s hull.',
  },
  reefCrab: {
    name: 'Glass Crab', art: 'reefCrab', level: 6,
    hp: 170, mp: 0, atk: 21, def: 15, mag: 6, res: 10, spd: 9, guard: 3,
    weak: ['steel'], resist: ['tide'],
    skills: [{ id: 'clawSwipe', weight: 3 }],
    xp: 26, gold: 24, drops: [{ item: 'rumTonic', chance: 0.25 }],
    flavor: 'Shell like a lantern pane. You can see it thinking.',
  },

  /* ------------------- Legend I: Moonwrack Shoals ------------------ */
  drownedDeckhand: {
    name: 'Drowned Deckhand', art: 'drownedDeckhand', level: 3,
    hp: 108, mp: 0, atk: 14, def: 8, mag: 8, res: 7, spd: 6, guard: 2,
    weak: ['flame', 'spirit'], resist: ['tide'], traits: ['undead'],
    skills: [{ id: 'drownedGrasp', weight: 2 }],
    xp: 16, gold: 14, drops: [{ item: 'bitterroot', chance: 0.25 }],
    flavor: 'Still hauling on a line that rotted away years ago.',
  },
  lanternWisp: {
    name: 'Lantern Wisp', art: 'lanternWisp', level: 4,
    hp: 86, mp: 0, atk: 10, def: 6, mag: 17, res: 14, spd: 14, guard: 2,
    weak: ['tide'], resist: ['flame', 'spirit'], traits: ['spirit'],
    skills: [{ id: 'lanternLure', weight: 3 }],
    xp: 19, gold: 18, drops: [{ item: 'clearWater', chance: 0.3 }],
    flavor: 'It bobs at the height a drowned man’s lantern would.',
  },
  barnacleGunner: {
    name: 'Barnacle Gunner', art: 'barnacleGunner', level: 5,
    hp: 150, mp: 0, atk: 18, def: 13, mag: 7, res: 9, spd: 8, guard: 3,
    weak: ['steel'], resist: ['shot'],
    skills: [{ id: 'grapeshot', weight: 2 }, { id: 'clawSwipe', weight: 2 }],
    xp: 24, gold: 26, drops: [{ item: 'powderFlask', chance: 0.2 }],
    flavor: 'Grew around a swivel gun until the two could not be told apart.',
  },

  /* -------------- Legend II: Green Fathom / Whisperwood ------------ */
  thornMimic: {
    name: 'Thorn Mimic', art: 'thornMimic', level: 6,
    hp: 180, mp: 0, atk: 20, def: 14, mag: 10, res: 8, spd: 7, guard: 3,
    weak: ['flame'], resist: ['tide'], traits: ['plant'],
    skills: [{ id: 'thornLash', weight: 3 }],
    xp: 27, gold: 22, drops: [{ item: 'bitterroot', chance: 0.3 }],
    flavor: 'Wears a fallen traveller’s pack as a flower wears a bee.',
  },
  groveHowler: {
    name: 'Grove Howler', art: 'groveHowler', level: 7,
    hp: 200, mp: 0, atk: 24, def: 13, mag: 9, res: 10, spd: 16, guard: 3,
    weak: ['shot'], resist: ['steel'],
    skills: [{ id: 'clawSwipe', weight: 3 }, { id: 'howl', weight: 1 }],
    xp: 31, gold: 28, drops: [{ item: 'palmSalve', chance: 0.15 }],
    flavor: 'Answers itself from three directions at once.',
  },
  sapRevenant: {
    name: 'Sap Revenant', art: 'sapRevenant', level: 8,
    hp: 240, mp: 0, atk: 22, def: 17, mag: 18, res: 14, spd: 8, guard: 3,
    weak: ['flame'], resist: ['spirit'], traits: ['plant', 'undead'],
    skills: [{ id: 'sapDrain', weight: 3 }, { id: 'thornLash', weight: 1 }],
    xp: 38, gold: 33, drops: [{ item: 'saltDraught', chance: 0.25 }],
    flavor: 'Someone was buried standing up. The grove disagreed.',
  },

  /* ----------------- Legend III: Emberpath Ruins ------------------- */
  ashSkeleton: {
    name: 'Ash Skeleton', art: 'ashSkeleton', level: 11,
    hp: 290, mp: 0, atk: 33, def: 22, mag: 12, res: 16, spd: 12, guard: 3,
    weak: ['steel'], resist: ['flame'], traits: ['undead'],
    skills: [{ id: 'ashRattle', weight: 3 }],
    xp: 58, gold: 46, drops: [{ item: 'powderFlask', chance: 0.25 }],
    flavor: 'The mountain breathes and they stand up. It exhales and they do not lie down.',
  },
  cinderMoth: {
    name: 'Cinder Moth', art: 'cinderMoth', level: 12,
    hp: 250, mp: 0, atk: 26, def: 16, mag: 30, res: 22, spd: 21, guard: 3,
    weak: ['shot', 'tide'], resist: ['flame'],
    skills: [{ id: 'cinderWings', weight: 2 }, { id: 'emberSpit', weight: 2 }],
    xp: 62, gold: 52, drops: [{ item: 'clearWater', chance: 0.3 }],
    flavor: 'Its wings leave a print of themselves burned onto the wall.',
  },
  slagCrawler: {
    name: 'Slag Crawler', art: 'slagCrawler', level: 13,
    hp: 360, mp: 0, atk: 36, def: 27, mag: 24, res: 20, spd: 7, guard: 4,
    weak: ['tide'], resist: ['flame', 'steel'],
    skills: [{ id: 'moltenSpill', weight: 2 }, { id: 'emberSpit', weight: 2 }],
    xp: 74, gold: 61, drops: [{ item: 'cinderWard', chance: 0.08 }],
    flavor: 'Leaves a glowing track that stays hot for hours.',
  },

  /* ------------------ Legend IV: Pearlmaw Reef --------------------- */
  reefSiren: {
    name: 'Reef Siren', art: 'reefSiren', level: 12,
    hp: 270, mp: 0, atk: 27, def: 17, mag: 32, res: 24, spd: 19, guard: 3,
    weak: ['shot'], resist: ['tide'],
    skills: [{ id: 'sirenSong', weight: 2 }, { id: 'undertow', weight: 2 }],
    xp: 63, gold: 55, drops: [{ item: 'clearWater', chance: 0.3 }],
    flavor: 'Sings the names of people who never told her their names.',
  },
  coralHusk: {
    name: 'Coral Husk', art: 'coralHusk', level: 13,
    hp: 390, mp: 0, atk: 31, def: 30, mag: 15, res: 22, spd: 6, guard: 4,
    weak: ['steel', 'flame'], resist: ['tide', 'shot'],
    skills: [{ id: 'clawSwipe', weight: 3 }],
    xp: 70, gold: 58, drops: [{ item: 'palmSalve', chance: 0.25 }],
    flavor: 'A diver the reef kept and then rebuilt from the outside in.',
  },
  gulperEel: {
    name: 'Gulper Eel', art: 'gulperEel', level: 14,
    hp: 320, mp: 0, atk: 38, def: 19, mag: 20, res: 18, spd: 23, guard: 3,
    weak: ['storm'], resist: ['tide'],
    skills: [{ id: 'swallow', weight: 3 }, { id: 'undertow', weight: 1 }],
    xp: 78, gold: 64, drops: [{ item: 'tidePhial', chance: 0.15 }],
    flavor: 'Mostly mouth, and the rest of it is on the way to being mouth.',
  },

  /* ----------------- Legend V: Sable Mangroves --------------------- */
  lanternjack: {
    name: 'Lanternjack', art: 'lanternjack', level: 10,
    hp: 220, mp: 0, atk: 22, def: 14, mag: 27, res: 20, spd: 20, guard: 3,
    weak: ['tide'], resist: ['spirit'], traits: ['spirit'],
    skills: [{ id: 'mirelight', weight: 3 }],
    xp: 52, gold: 44, drops: [{ item: 'clearWater', chance: 0.35 }],
    flavor: 'Every swamp has one light too many.',
  },
  mireLurker: {
    name: 'Mire Lurker', art: 'mireLurker', level: 11,
    hp: 300, mp: 0, atk: 31, def: 21, mag: 12, res: 14, spd: 13, guard: 3,
    weak: ['flame'], resist: ['tide'],
    skills: [{ id: 'bogGrip', weight: 3 }, { id: 'clawSwipe', weight: 2 }],
    xp: 57, gold: 48, drops: [{ item: 'palmSalve', chance: 0.2 }],
    flavor: 'You will hear it after it has already decided.',
  },
  bogShade: {
    name: 'Bog Shade', art: 'bogShade', level: 12,
    hp: 260, mp: 0, atk: 24, def: 16, mag: 31, res: 26, spd: 16, guard: 3,
    weak: ['flame'], resist: ['steel', 'shot'], traits: ['spirit'],
    skills: [{ id: 'shadeTouch', weight: 3 }, { id: 'mirelight', weight: 1 }],
    xp: 64, gold: 53, drops: [{ item: 'saltDraught', chance: 0.3 }],
    flavor: 'A shape that stops being a shape when you look straight at it.',
  },

  /* ------------------ Legend VI: Wailing Pass ---------------------- */
  squallWraith: {
    name: 'Squall Wraith', art: 'squallWraith', level: 17,
    hp: 400, mp: 0, atk: 38, def: 25, mag: 44, res: 34, spd: 24, guard: 4,
    weak: ['spirit'], resist: ['storm', 'shot'], traits: ['spirit'],
    skills: [{ id: 'squallLash', weight: 3 }, { id: 'shadeTouch', weight: 1 }],
    xp: 118, gold: 92, drops: [{ item: 'stormBottle', chance: 0.15 }],
    flavor: 'What is left when a storm takes a person and keeps the shape.',
  },
  brinebornHerald: {
    name: 'Brineborn Herald', art: 'brinebornHerald', level: 18,
    hp: 540, mp: 0, atk: 48, def: 38, mag: 28, res: 30, spd: 15, guard: 4,
    weak: ['storm'], resist: ['tide', 'steel'],
    skills: [{ id: 'heraldsHorn', weight: 1 }, { id: 'clawSwipe', weight: 3 }],
    xp: 136, gold: 108, drops: [{ item: 'galleyStew', chance: 0.2 }],
    flavor: 'It announces the Saint. Nobody asked it to.',
  },
  stormRay: {
    name: 'Storm Ray', art: 'stormRay', level: 18,
    hp: 430, mp: 0, atk: 42, def: 26, mag: 40, res: 28, spd: 28, guard: 4,
    weak: ['shot'], resist: ['storm'],
    skills: [{ id: 'ridingBolt', weight: 3 }],
    xp: 128, gold: 96, drops: [{ item: 'stormBottle', chance: 0.12 }],
    flavor: 'Rides the lightning down and does not seem to mind.',
  },

  /* ----------------------------- elites ---------------------------- */
  ashboundSentinel: {
    name: 'Ashbound Sentinel', art: 'ashboundSentinel', level: 14,
    hp: 760, mp: 0, atk: 42, def: 36, mag: 22, res: 26, spd: 11, guard: 5,
    weak: ['tide'], resist: ['flame', 'steel'], traits: ['elite'],
    skills: [{ id: 'slagFist', weight: 2 }, { id: 'ashenCrown', weight: 1 }, { id: 'ashRattle', weight: 2 }],
    xp: 240, gold: 260, drops: [{ item: 'reefmail', chance: 0.35 }],
    flavor: 'Stood at this door before the door was built.',
  },
  sirenChorus: {
    name: 'Siren Chorus', art: 'sirenChorus', level: 14,
    hp: 560, mp: 0, atk: 34, def: 24, mag: 44, res: 32, spd: 22, guard: 5,
    weak: ['shot'], resist: ['tide'], traits: ['elite'],
    skills: [{ id: 'dirgeOfPearls', weight: 2 }, { id: 'sirenSong', weight: 2 }, { id: 'undertow', weight: 1 }],
    xp: 235, gold: 250, drops: [{ item: 'driftglassCharm', chance: 0.35 }],
    flavor: 'Three voices from one throat, and none of them agree.',
  },
  hollowSmuggler: {
    name: 'Hollow Smuggler', art: 'hollowSmuggler', level: 12,
    hp: 620, mp: 0, atk: 36, def: 26, mag: 26, res: 22, spd: 20, guard: 4,
    weak: ['spirit'], resist: ['shot'], traits: ['elite'],
    skills: [{ id: 'bountyMark', weight: 1 }, { id: 'grapeshot', weight: 2 }, { id: 'shadeTouch', weight: 2 }],
    xp: 200, gold: 300, drops: [{ item: 'gunnersGlove', chance: 0.3 }],
    flavor: 'Traded his name away and has been running the debt ever since.',
  },

  /* ----------------------------- bosses ---------------------------- */
  halloway: {
    name: 'Captain Halloway Vane', art: 'halloway', level: 9,
    hp: 980, mp: 0, atk: 27, def: 20, mag: 26, res: 22, spd: 15, guard: 5,
    weak: ['flame', 'spirit'], resist: ['tide'], traits: ['boss', 'undead'],
    skills: [
      { id: 'drownedBroadside', weight: 2 },
      { id: 'lanternCurse', weight: 2 },
      { id: 'callTheCrew', weight: 1 },
      { id: 'drownedGrasp', weight: 2 },
    ],
    xp: 320, gold: 420,
    flavor: 'Still calling the tack for a crew that drowned with him.',
  },
  kaobo: {
    name: 'Kaobo the Rooted', art: 'kaobo', level: 11,
    hp: 1150, mp: 0, atk: 34, def: 30, mag: 32, res: 28, spd: 10, guard: 6,
    weak: ['flame'], resist: ['tide', 'spirit'], traits: ['boss', 'plant'],
    skills: [
      { id: 'rootQuake', weight: 2 },
      { id: 'thornCanopy', weight: 2 },
      { id: 'seedOfYears', weight: 1 },
      { id: 'thornLash', weight: 2 },
    ],
    xp: 420, gold: 520,
    flavor: 'Older than the island’s name for it. Politer, too, until it is not.',
  },
  kingsflameIdol: {
    name: 'Kingsflame Idol', art: 'kingsflameIdol', level: 15,
    hp: 1820, mp: 0, atk: 46, def: 38, mag: 44, res: 32, spd: 13, guard: 6,
    weak: ['tide'], resist: ['flame', 'steel'], traits: ['boss'],
    skills: [
      { id: 'kingsflame', weight: 2 },
      { id: 'slagFist', weight: 2 },
      { id: 'ashenCrown', weight: 1 },
      { id: 'emberSpit', weight: 2 },
    ],
    xp: 620, gold: 760,
    flavor: 'The tomb’s last servant, wearing the king’s face because the king would not.',
  },
  coralDowager: {
    name: 'The Coral Dowager', art: 'coralDowager', level: 15,
    hp: 1740, mp: 0, atk: 42, def: 32, mag: 50, res: 38, spd: 18, guard: 6,
    weak: ['storm', 'shot'], resist: ['tide'], traits: ['boss'],
    skills: [
      { id: 'dirgeOfPearls', weight: 2 },
      { id: 'dragUnder', weight: 2 },
      { id: 'coralCrown', weight: 1 },
      { id: 'undertow', weight: 2 },
    ],
    xp: 600, gold: 720,
    yieldAt: 0.15,
    flavor: 'She kept nine divers and gave back nine pearls. She calls that fair.',
  },
  sableman: {
    name: 'The Sableman', art: 'sableman', level: 13,
    hp: 1520, mp: 0, atk: 38, def: 27, mag: 46, res: 34, spd: 26, guard: 6,
    weak: ['flame', 'tide'], resist: ['spirit'], traits: ['boss', 'spirit'],
    skills: [
      { id: 'falseName', weight: 2 },
      { id: 'lanternSwap', weight: 2 },
      { id: 'tricksterCoin', weight: 2 },
      { id: 'mirelight', weight: 1 },
    ],
    xp: 500, gold: 640,
    flavor: 'Wants your name. Will trade you something for it, and the trade will be fair, and you will still lose.',
  },
  saintMarene: {
    name: 'Saint Marene of the Long Wind', art: 'saintMarene', level: 21,
    hp: 2600, mp: 0, atk: 56, def: 44, mag: 62, res: 46, spd: 24, guard: 7,
    weak: ['spirit', 'steel'], resist: ['storm', 'tide'], traits: ['boss'],
    skills: [
      { id: 'longWind', weight: 3 },
      { id: 'saintsGrief', weight: 2 },
      { id: 'eyeOfTheStorm', weight: 1 },
      { id: 'ridingBolt', weight: 2 },
    ],
    xp: 1200, gold: 1400,
    flavor: 'Not a demon. Not a saint. A woman who agreed to hold something and was never let go.',
  },
  blackwaterMaw: {
    name: 'The Blackwater Maw', art: 'blackwaterMaw', level: 23,
    hp: 2200, mp: 0, atk: 56, def: 44, mag: 60, res: 46, spd: 20, guard: 8,
    weak: ['spirit', 'storm'], resist: ['tide', 'shot'], traits: ['boss', 'final'],
    skills: [
      { id: 'blackwaterTide', weight: 3 },
      { id: 'devour', weight: 2 },
      { id: 'soundlessChoir', weight: 2 },
    ],
    xp: 2000, gold: 2400,
    flavor: 'The thing the Pass was built around. It has been patient.',
  },

  /* ------------------------ the Iron Bell Co. ---------------------- */
  vestrelKo: {
    name: 'Vestrel Ko', art: 'vestrelKo', level: 13,
    hp: 980, mp: 0, atk: 40, def: 30, mag: 24, res: 24, spd: 22, guard: 5,
    weak: ['spirit'], resist: ['steel'], traits: ['elite', 'rival'],
    skills: [{ id: 'ironBellVolley', weight: 2 }, { id: 'bountyMark', weight: 1 }, { id: 'clawSwipe', weight: 2 }],
    xp: 280, gold: 420, drops: [{ item: 'gunnersGlove', chance: 0.4 }],
    flavor: 'Runs the Iron Bell like a ledger. You are an entry in it.',
  },
  mardaQuill: {
    name: 'Marda Quill', art: 'mardaQuill', level: 13,
    hp: 700, mp: 0, atk: 36, def: 22, mag: 30, res: 22, spd: 27, guard: 4,
    weak: ['steel'], resist: ['shot'], traits: ['elite', 'rival'],
    skills: [{ id: 'grapeshot', weight: 3 }, { id: 'pinningShot', weight: 2 }],
    xp: 240, gold: 340, drops: [{ item: 'braidedCord', chance: 0.4 }],
    flavor: 'Keeps the Company’s books and its powder, in that order.',
  },
  /* The trench rematch: the same three, after a year of hunting you. */
  vestrelKoIron: {
    name: 'Vestrel Ko, Ledgerkeeper', art: 'vestrelKo', level: 26,
    hp: 2200, mp: 0, atk: 60, def: 46, mag: 40, res: 40, spd: 30, guard: 6,
    weak: ['spirit'], resist: ['steel', 'shot'], traits: ['boss', 'rival'],
    skills: [{ id: 'ironBellVolley', weight: 3 }, { id: 'bountyMark', weight: 1 }, { id: 'hammerFall', weight: 2 }],
    xp: 900, gold: 1200,
    flavor: 'She has read every line you ever wrote in somebody else’s ledger.',
  },
  mardaQuillIron: {
    name: 'Marda Quill, Powdermaster', art: 'mardaQuill', level: 26,
    hp: 1600, mp: 0, atk: 54, def: 34, mag: 48, res: 34, spd: 34, guard: 5,
    weak: ['steel'], resist: ['shot', 'flame'], traits: ['elite', 'rival'],
    skills: [{ id: 'grapeshot', weight: 3 }, { id: 'pinningShot', weight: 2 }, { id: 'ricochetShot', weight: 1 }],
    xp: 700, gold: 900, drops: [{ item: 'braidedCord', chance: 0.6 }],
    flavor: 'Carries enough powder to end the argument and the island.',
  },
  grinBellowsIron: {
    name: 'Grin Bellows, Bellringer', art: 'grinBellows', level: 26,
    hp: 2400, mp: 0, atk: 66, def: 54, mag: 20, res: 28, spd: 16, guard: 6,
    weak: ['shot'], resist: ['steel', 'tide'], traits: ['elite', 'rival'],
    skills: [{ id: 'hammerFall', weight: 3 }, { id: 'ashRattle', weight: 2 }],
    xp: 700, gold: 900, drops: [{ item: 'sailorsKnot', chance: 0.6 }],
    flavor: 'Still does not talk. Rings the bell instead.',
  },

  grinBellows: {
    name: 'Grin Bellows', art: 'grinBellows', level: 13,
    hp: 1150, mp: 0, atk: 46, def: 38, mag: 14, res: 18, spd: 9, guard: 5,
    weak: ['shot'], resist: ['steel'], traits: ['elite', 'rival'],
    skills: [{ id: 'hammerFall', weight: 3 }, { id: 'ashRattle', weight: 2 }],
    xp: 250, gold: 360, drops: [{ item: 'sailorsKnot', chance: 0.4 }],
    flavor: 'Does not talk. The name was a joke that outlived the joker.',
  },
};

export function enemy(id) {
  const def = ENEMIES[id];
  if (!def) throw new Error(`enemies: unknown enemy "${id}"`);
  return def;
}

/** Every enemy id, useful for the bestiary count in the README/tests. */
export const ENEMY_IDS = Object.keys(ENEMIES);
