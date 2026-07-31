/**
 * Shop stock. Entries can be gated behind world flags so that resolving a
 * legend visibly changes what a settlement is able to sell you.
 */

export const SHOPS = {
  marrowport: {
    name: 'Halyard & Hook',
    keeper: 'Sella Marrow',
    greeting: 'Everything here has been salt-tested. Twice, mostly.',
    farewell: 'Fair winds. Mind the night lane.',
    priceMod: 1,
    stock: [
      { item: 'rumTonic' },
      { item: 'saltDraught' },
      { item: 'bitterroot' },
      { item: 'clearWater' },
      { item: 'smokePot' },
      { item: 'powderFlask' },
      { item: 'gullwingCutlass' },
      { item: 'longnoseCarbine' },
      { item: 'coralCenser' },
      { item: 'privateersCoat' },
      { item: 'braidedCord' },
      { item: 'sailorsKnot' },
      // Unlocked once the Lantern Galleon stops eating the shipping lane.
      { item: 'palmSalve', flag: 'curse.lifted' },
      { item: 'galleyStew', flag: 'curse.lifted' },
      { item: 'chainShot', flag: 'curse.lifted' },
      { item: 'kindleCharm', flag: 'curse.lifted' },
      // The Dowager's truce reopens the deep pearl beds.
      { item: 'tidewornFalchion', flag: 'reef.truce' },
      { item: 'ancestorBell', flag: 'reef.truce' },
      { item: 'driftglassCharm', flag: 'reef.truce' },
    ],
  },

  mireborne: {
    name: 'Ilsan’s Back Room',
    keeper: 'Broker Ilsan',
    greeting: 'No flags, no questions. Prices are what they are.',
    farewell: 'You were never here.',
    priceMod: 1.15,
    stock: [
      { item: 'rumTonic' },
      { item: 'saltDraught' },
      { item: 'smokePot' },
      { item: 'powderFlask' },
      { item: 'clearWater' },
      { item: 'braidedCord' },
      { item: 'gunnersGlove' },
      // The black market opens once you have standing in the mires.
      { item: 'tidePhial', flag: 'mireborne.blackmarket' },
      { item: 'stormBottle', flag: 'mireborne.blackmarket' },
      { item: 'kindleCharm', flag: 'mireborne.blackmarket' },
      { item: 'stormlockPistol', flag: 'mireborne.blackmarket' },
      { item: 'reefmail', flag: 'mireborne.blackmarket' },
    ],
  },

  ashfall: {
    name: 'Danu’s Forge',
    keeper: 'Forgekeeper Danu',
    greeting: 'Bring me something the mountain made and I will make it worse.',
    farewell: 'Keep your ward on below the third landing.',
    priceMod: 1.05,
    stock: [
      { item: 'rumTonic' },
      { item: 'palmSalve' },
      { item: 'bitterroot' },
      { item: 'powderFlask' },
      { item: 'cinderWard' },
      { item: 'privateersCoat' },
      { item: 'gullwingCutlass' },
      { item: 'longnoseCarbine' },
      // Fire-forged stock, unlocked by the Ashen Crown.
      { item: 'tidewornFalchion', flag: 'ashfall.forge' },
      { item: 'stormlockPistol', flag: 'ashfall.forge' },
      { item: 'ancestorBell', flag: 'ashfall.forge' },
      { item: 'reefmail', flag: 'ashfall.forge' },
      { item: 'stormweave', flag: 'ashfall.forge' },
      { item: 'gunnersGlove', flag: 'ashfall.forge' },
    ],
  },
};

export function shop(id) {
  const def = SHOPS[id];
  if (!def) throw new Error(`shops: unknown shop "${id}"`);
  return def;
}
