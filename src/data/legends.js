/**
 * The six regional legends — the spine of the whole game.
 *
 * Each legend is simultaneously a quest chain, a reward source, and a set of
 * battles. `stages` drive the journal text and the objective marker; `flags`
 * granted on completion are what the world reads to change itself.
 */

export const LEGEND_STATE = {
  UNHEARD: 'unheard',
  RUMORED: 'rumored',
  ACTIVE: 'active',
  RESOLVED: 'resolved',
};

export const LEGENDS = {
  lanternGalleon: {
    id: 'lanternGalleon',
    order: 1,
    name: 'The Lantern Galleon',
    region: 'Moonwrack Shoals',
    map: 'moonwrack',
    recommendedLevel: 6,
    rumor:
      'Every third moon, a galleon lit with drowned lanterns rides the Moonwrack ' +
      'shallows. Ships that answer its light are found the next week — empty, dry, ' +
      'and pointing the wrong way.',
    hook: 'Marrowport has lost four hulls this season. The harbourmaster will pay to lose no more.',
    stages: [
      { id: 'ask', objective: 'Ask along the Marrowport docks about the Lantern Galleon.' },
      { id: 'sail', objective: 'Sail to the Moonwrack Shoals. The galleon only rides after dark.' },
      { id: 'beacons', objective: 'Light the three drowned beacons on the sandbars.', counter: 'beacons', of: 3 },
      { id: 'board', objective: 'Board the galleon and face Captain Halloway Vane.' },
    ],
    enemies: ['drownedDeckhand', 'lanternWisp', 'barnacleGunner'],
    boss: 'halloway',
    reward: {
      gold: 420,
      items: ['spectralCompass'],
      flags: ['curse.lifted', 'route.pearlmaw'],
    },
    rewardText:
      'The lanterns go out one by one. Halloway’s compass is left spinning on the deck — ' +
      'and then it points, quite deliberately, at you.',
    worldChange:
      'The shipping curse breaks. Marrowport reopens the night lane, the harbour shop takes ' +
      'delivery of proper gear, and the reef road to Pearlmaw is sailable.',
  },

  ceibaWarden: {
    id: 'ceibaWarden',
    order: 2,
    name: 'The Ceiba Warden',
    region: 'Green Fathom',
    map: 'greenfathom',
    recommendedLevel: 9,
    rumor:
      'There is a ceiba in the Green Fathom older than the island’s name for it. ' +
      'It let people pass for two hundred years. This season it stopped.',
    hook: 'Three cutters went in for timber. The jungle handed back their axes, neatly stacked.',
    stages: [
      { id: 'enter', objective: 'Push inland through the Green Fathom to the old shrine.' },
      { id: 'bowls', objective: 'Fill the three offering bowls at the Whisperwood Shrine.', counter: 'bowls', of: 3 },
      { id: 'warden', objective: 'Face Kaobo the Rooted beneath the ceiba.' },
      { id: 'choice', objective: 'Decide what becomes of the Heartwood Relic.' },
    ],
    enemies: ['thornMimic', 'groveHowler', 'sapRevenant'],
    boss: 'kaobo',
    branching: true,
    branches: [
      {
        id: 'return',
        label: 'Return the relic to the roots',
        blurb: 'Give it back. Ask nothing. See what is offered.',
        reward: { items: ['verdantCharm', "wardensBark"], gold: 120, flags: ['grove.blessed'] },
        unlockSkill: { char: 'yerena', skill: 'rootbind' },
        rep: { marrowport: 1, mireborne: 0, ashfall: 1 },
        text:
          'The relic sinks into the root-mat like a stone into water. The canopy opens a road ' +
          'you did not walk in by, and Yerena stands very still for a while afterwards.',
      },
      {
        id: 'keep',
        label: 'Keep the relic',
        blurb: 'It is warm, it is strong, and the grove is not using it.',
        reward: { items: ['heartwoodIdol'], gold: 0, flags: ['grove.angered'] },
        rep: { marrowport: 0, mireborne: 1, ashfall: 0 },
        text:
          'Nothing screams. The jungle simply stops helping. Every leaf you touch on the way out ' +
          'is a little colder than the last.',
      },
      {
        id: 'sell',
        label: 'Sell it to the Mireborne broker',
        blurb: 'Coin now, and the smugglers will remember it.',
        reward: { gold: 900, flags: ['grove.sold', 'mireborne.blackmarket'] },
        rep: { marrowport: -1, mireborne: 2, ashfall: 0 },
        text:
          'The broker counts it out twice, which is how you know it was worth more. ' +
          'Word travels. Somewhere, a company with an iron bell on its flag adds a line to a ledger.',
      },
    ],
    reward: { gold: 300, xpBonus: 0, flags: [] },
    rewardText: 'The ceiba loosens its grip on the Fathom. What you do next is the actual legend.',
    worldChange:
      'The Green Fathom road opens either way — but whether the grove mends your crew or ' +
      'merely tolerates them depends on your answer.',
  },

  ashenCrown: {
    id: 'ashenCrown',
    order: 3,
    name: 'The Ashen Crown',
    region: 'Emberpath Ruins',
    map: 'emberpath',
    recommendedLevel: 14,
    rumor:
      'A pirate king had himself buried inside a volcano so nobody could dig him up. ' +
      'The mountain has been trying to give him back ever since.',
    hook: 'Ashfall Rest sells relics from the upper halls. Nobody sells anything from the lower ones.',
    stages: [
      { id: 'ward', objective: 'Get a Cinder Ward at Ashfall Rest — the vent paths will cook you without one.' },
      { id: 'braziers', objective: 'Kindle the three tomb braziers in the Emberpath Ruins.', counter: 'braziers', of: 3 },
      { id: 'sentinel', objective: 'Break the Ashbound Sentinel guarding the tomb door.' },
      { id: 'idol', objective: 'Face the Kingsflame Idol in the king’s vault.' },
      { id: 'claim', objective: 'Claim the king’s legacy.' },
    ],
    enemies: ['ashSkeleton', 'cinderMoth', 'slagCrawler'],
    elite: 'ashboundSentinel',
    boss: 'kingsflameIdol',
    branching: true,
    branches: [
      {
        id: 'saber',
        label: 'Take the Kingsflame Saber',
        blurb: 'A blade that never fully cools.',
        reward: { items: ['kingsflameSaber'], gold: 300, flags: ['ember.saber'] },
        rep: { ashfall: 1 },
        text: 'The saber comes free of the idol with a sound like a door closing on a hot room.',
      },
      {
        id: 'crest',
        label: "Take the Emberking's Crest",
        blurb: 'His sigil. Flame will not touch whoever wears it.',
        reward: { items: ['emberkingCrest'], gold: 300, flags: ['ember.crest'] },
        rep: { ashfall: 1 },
        text: 'The crest is still warm through your glove. It will stay that way.',
      },
    ],
    reward: { gold: 460, flags: ['ember.open', 'ashfall.forge'] },
    rewardText: 'The vault falls quiet. The mountain, for the first time in a generation, does not.',
    worldChange:
      'Ashfall Rest’s forge opens its fire-forged stock, and the vent shortcut through ' +
      'Emberpath stays walkable.',
  },

  pearlWidow: {
    id: 'pearlWidow',
    order: 4,
    name: 'The Pearl Widow',
    region: 'Pearlmaw Reef',
    map: 'pearlmaw',
    recommendedLevel: 15,
    rumor:
      'Nine divers went down at Pearlmaw and none came up. Their families still hear ' +
      'the diving song at low tide, sung back to them in the wrong voice.',
    hook: 'The reef gives pearls freely now. That is the part that frightens people.',
    stages: [
      { id: 'reed', objective: 'Find a Diving Reed — the reef caverns run long between air pockets.' },
      { id: 'pearls', objective: 'Recover the drowned divers’ pearls from the reef.', counter: 'pearls', of: 3 },
      { id: 'chorus', objective: 'Silence the Siren Chorus at the coral gate.' },
      { id: 'dowager', objective: 'Face the Coral Dowager on her throne.' },
      { id: 'truce', objective: 'Decide how the Dowager’s debt is settled.' },
    ],
    enemies: ['reefSiren', 'coralHusk', 'gulperEel'],
    elite: 'sirenChorus',
    boss: 'coralDowager',
    branching: true,
    branches: [
      {
        id: 'spare',
        label: 'Return the pearls and take the truce',
        blurb: 'She kept nine. Give the nine back and let it end.',
        reward: { items: ['tideheartPearl', 'tideheartFocus'], gold: 200, flags: ['reef.truce'] },
        unlockSkill: { char: 'yerena', skill: 'tideheartSong' },
        rep: { marrowport: 2, mireborne: 0, ashfall: 0 },
        text:
          'She takes the pearls one at a time and names each diver. When she reaches the ninth ' +
          'the reef goes quiet enough to hear your own crew breathing.',
      },
      {
        id: 'finish',
        label: 'Finish it and take the Fang',
        blurb: 'She is a drowning that learned to talk. End it.',
        reward: { items: ['widowsFang'], gold: 700, flags: ['reef.hostile'] },
        rep: { marrowport: 0, mireborne: 1, ashfall: 0 },
        text:
          'The coral throne cracks. The song does not stop — it just loses the melody, ' +
          'and the reef keeps singing the rest without her.',
      },
    ],
    reward: { gold: 520, flags: ['reef.cleared'] },
    rewardText: 'Pearlmaw stops taking. Whether it forgives is another matter.',
    worldChange:
      'The reef lane is safe to sail either way; a truce also calms the pearl beds ' +
      'and opens Marrowport’s best stock.',
  },

  sablemanMires: {
    id: 'sablemanMires',
    order: 5,
    name: 'The Sableman of the Mires',
    region: 'Sable Mangroves',
    map: 'mangroves',
    recommendedLevel: 12,
    rumor:
      'There is a gentleman in the mangroves who trades in names. He is very fair. ' +
      'Everyone who has traded with him agrees he was very fair, though none can say so out loud.',
    hook: 'Mireborne has lost three runners to false lights this month, and the smugglers are spooked.',
    stages: [
      { id: 'lantern', objective: 'Borrow a Mire Lantern in Mireborne — false lights cannot copy its flame.' },
      { id: 'lights', objective: 'Follow only the true lanterns deeper into the Sable Mangroves.', counter: 'lights', of: 3 },
      { id: 'smuggler', objective: 'Deal with the Hollow Smuggler at the black stilt-house.' },
      { id: 'sableman', objective: 'Refuse the Sableman’s trade — the hard way.' },
    ],
    enemies: ['lanternjack', 'mireLurker', 'bogShade'],
    elite: 'hollowSmuggler',
    boss: 'sableman',
    reward: {
      gold: 640,
      items: ['namelessCoin'],
      flags: ['mires.safe', 'mireborne.blackmarket'],
      unlockSkill: { char: 'rook', skill: 'ghostShot' },
    },
    rewardText:
      'He leaves you the coin he was going to pay with. Rook turns it over twice and does not ' +
      'like what he does not find on it.',
    worldChange:
      'The mangrove runs are safe again, Mireborne’s black market opens to you, and Rook learns ' +
      'a shot fired from a gun with no name.',
  },

  stormSaint: {
    id: 'stormSaint',
    order: 6,
    name: 'The Storm Saint of the Wailing Pass',
    region: 'Wailing Pass',
    map: 'wailingpass',
    recommendedLevel: 21,
    requiresLegends: 4,
    rumor:
      'The hurricane over the Wailing Pass has not moved in sixty years. Sailors call the thing ' +
      'inside it a saint, because calling it what it is has not helped anyone.',
    hook: 'Your aunt’s chart is torn exactly where the Pass should be. She did not sail past it. She sailed into it.',
    stages: [
      { id: 'gather', objective: 'Resolve four regional legends. The Pass will not open for less.', counter: 'legends', of: 4 },
      { id: 'refit', objective: 'Have the Salt Wren fitted with the Storm Sail at Marrowport.' },
      { id: 'pass', objective: 'Sail the eye of the Wailing Pass and make landfall on the Iron Reef.' },
      { id: 'saint', objective: 'Face Saint Marene of the Long Wind.' },
      { id: 'maw', objective: 'Face what she has been holding.' },
    ],
    enemies: ['squallWraith', 'brinebornHerald', 'stormRay'],
    boss: 'saintMarene',
    finalBoss: 'blackwaterMaw',
    reward: { gold: 2000, flags: ['pass.cleared', 'game.cleared'] },
    rewardText: 'The wind stops. It has not stopped here in sixty years, and the silence is enormous.',
    worldChange: 'The Sunder Reach gets its sixth legend back, and its first quiet season.',
  },

  ironBell: {
    id: 'ironBell',
    order: 7,
    hidden: true,
    name: 'The Iron Bell',
    region: 'Blackwater Trench',
    map: 'blackwater',
    recommendedLevel: 25,
    rumor:
      'A hunting company with a bell on its flag has been three days behind you since Marrowport. ' +
      'They are not slower than you. They are waiting.',
    hook: 'Every legend you resolve raises their price for you.',
    stages: [
      { id: 'hunted', objective: 'Survive the Iron Bell Company’s ambush at sea.' },
      { id: 'answer', objective: 'Answer the bell at the Blackwater Trench, after all six legends are told.' },
    ],
    enemies: ['vestrelKo', 'mardaQuill', 'grinBellows'],
    rematch: ['vestrelKoIron', 'grinBellowsIron', 'mardaQuillIron'],
    boss: 'vestrelKoIron',
    reward: { gold: 3000, items: ['ironBellSigil'], flags: ['ironbell.settled'] },
    rewardText: 'Vestrel Ko sets the sigil down rather than hands it over. "Ledger’s closed," she says.',
    worldChange: 'Nobody is following you any more.',
  },
};

export const LEGEND_ORDER = Object.values(LEGENDS)
  .sort((a, b) => a.order - b.order)
  .map((l) => l.id);

/** The six that count toward the ending (the Iron Bell is optional). */
export const MAIN_LEGENDS = LEGEND_ORDER.filter((id) => !LEGENDS[id].hidden);

export function legend(id) {
  const def = LEGENDS[id];
  if (!def) throw new Error(`legends: unknown legend "${id}"`);
  return def;
}
