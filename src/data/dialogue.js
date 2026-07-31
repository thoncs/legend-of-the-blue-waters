/**
 * All spoken content.
 *
 * A dialogue entry is a list of branches; the first branch whose `when(ctx)`
 * passes is played. `lines` are strings (spoken by the NPC) or
 * `{ speaker, text }` pairs. `then(ctx)` runs once the last line is dismissed.
 *
 * `ctx` is supplied by the field scene and exposes the whole game state as a
 * few small helpers — see FieldScene#dialogueContext.
 */

const P = (speaker, text) => ({ speaker, text });

export const DIALOGUE = {
  /* ============================== MARROWPORT ============================== */

  mp_rook: [
    {
      when: (c) => !c.inParty('rook'),
      lines: [
        'So it is true. Verrin Corvel leaves the sea a torn map and leaves her niece the bill.',
        'I owed your aunt eleven years and one very bad night in the Wailing Pass. I am not going to owe you as well.',
        P('Nia', 'I have not asked you for anything.'),
        'You were about to. I am a navigator, Captain. Being ahead of people is the job.',
      ],
      then: (c) => {
        c.join('rook');
        c.notice('[[Rook Ondari]] joins the crew.');
      },
    },
    {
      when: (c) => c.legendsResolved >= 4,
      lines: [
        'Four legends told and the chart still has that tear in it. You know what is under the tear.',
        'Say the word and I will plot the eye of the Pass. I have done it once. I would rather not do it alone again.',
      ],
    },
    {
      lines: [
        'The chart is not a map, Captain. It is a list. Six things your aunt meant to finish.',
        'We finish them in whatever order the wind allows. That is sailing.',
      ],
    },
  ],

  mp_yerena: [
    {
      when: (c) => !c.inParty('yerena'),
      lines: [
        'I poured out for your aunt this morning. Nobody else did, so I did it twice.',
        P('Nia', 'You knew her?'),
        'Everyone in Marrowport knew her. Knowing her and going with her were different sizes of foolish.',
        'You are going anyway. So I am going, and then only one of us has to be foolish about it.',
      ],
      then: (c) => {
        c.join('yerena');
        c.notice('[[Yerena Palo]] joins the crew.');
      },
    },
    {
      when: (c) => c.flag('grove.angered'),
      lines: [
        'The Fathom has gone quiet on me. Not angry. Quiet. That is worse and you know it is worse.',
      ],
    },
    {
      when: (c) => c.flag('grove.blessed'),
      lines: [
        'The grove still answers when I ask. Every morning I check, and every morning it still answers.',
        'Thank you for that. I will not say it again, so hold on to it.',
      ],
    },
    {
      lines: [
        'Keep the old names in your mouth, Captain. A legend that nobody says out loud gets hungry.',
      ],
    },
  ],

  mp_harbourmaster: [
    {
      when: (c) => c.legendState('lanternGalleon') === 'unheard',
      lines: [
        'Four hulls this season. Four. Found dry, found empty, found pointing north when they sailed south.',
        'The crews say the same thing before they stop talking altogether: [[a galleon full of drowned lanterns]], riding the Moonwrack shallows.',
        'Answer its light and it takes the ship. Do not answer and it follows you home.',
        P('Nia', 'And if somebody boarded it?'),
        'Then Marrowport would owe them a great deal of money and one very long drink.',
      ],
      then: (c) => {
        c.rumor('lanternGalleon');
        c.advance('lanternGalleon', 'sail');
        c.notice('Legend recorded: [[The Lantern Galleon]]. Take the Salt Wren from your berth — the pier is south of the plaza.');
      },
    },
    {
      when: (c) => c.legendState('lanternGalleon') === 'rumored' || c.legendState('lanternGalleon') === 'active',
      lines: [
        'Moonwrack is north-west of the harbour. Take the Salt Wren from your berth and read the chart.',
        'And go after dark. The galleon does not ride in daylight, and neither do its beacons.',
      ],
    },
    {
      when: (c) => c.legendsResolved >= 4 && !c.flag('ship.stormSail'),
      lines: [
        'Four legends. Four. Your aunt managed three and thought she was the best sailor in the Reach.',
        'So. The Wailing Pass. I have had a storm sail cut and doubled since the week you left, because I am not an optimist, I am a harbourmaster.',
        'Take it. Take it and do not tell me what is inside that hurricane. I have a family.',
      ],
      then: (c) => {
        c.give('stormSail', 1);
        c.setFlag('ship.stormSail', true);
        c.rumor('stormSaint');
        c.advance('stormSaint', 'pass');
        c.notice('The [[Salt Wren]] is refitted with the [[Storm Sail]]. The Wailing Pass is open.');
      },
    },
    {
      when: (c) => c.flag('game.cleared'),
      lines: [
        'Sixty years of that wind, and you turned it off like a lamp.',
        'The whole Reach has been sleeping badly out of habit. Give us a season and we will remember how.',
      ],
    },
    {
      when: (c) => c.flag('curse.lifted'),
      lines: [
        'Night lane is open again. First time since I took this desk.',
        'The shop has proper stock in, too. Turns out merchants like it when their cargo arrives.',
      ],
    },
    {
      lines: [
        'Every hull that comes home is a rumour brought back. Bring me some good ones.',
      ],
    },
  ],

  mp_shop: [
    {
      when: (c) => c.flag('curse.lifted'),
      lines: ['Stock came through the night lane for the first time in years. Ask me for anything.'],
      then: (c) => c.openShop('marrowport'),
    },
    {
      lines: ['Salt-tested, twice. What do you need?'],
      then: (c) => c.openShop('marrowport'),
    },
  ],

  mp_inn: [
    {
      lines: ['Room, meal, and we do not ask where the boots have been. Twenty coin.'],
      then: (c) => c.rest(20),
    },
  ],

  mp_fisher: [
    {
      when: (c) => c.legendState('pearlWidow') !== 'unheard' && !c.has('divingReed'),
      lines: [
        'Pearlmaw, is it. I dove that reef for nineteen years and I came up every single time.',
        'Nine of my people did not. You will want this — hollow cane, cut long. One more breath than you think you have.',
        'Bring their pearls back up if you can. Or do not. Just do not leave them down there because it was easier.',
      ],
      then: (c) => {
        c.give('divingReed', 1);
        c.notice('Received the [[Diving Reed]].');
      },
    },
    {
      when: (c) => c.flag('reef.truce'),
      lines: [
        'The song stopped. Forty years I have heard it at low tide and this morning there was just water.',
        'My hands would not stop shaking. Good shaking. There is such a thing.',
      ],
    },
    {
      lines: [
        'Fish come in fat and frightened lately. Something out there is doing the frightening.',
      ],
    },
  ],

  mp_child: [
    {
      when: (c) => c.legendsResolved >= 3,
      lines: [
        'My mother says you are going to get eaten. My father says you already were and this is the ghost.',
        'I say you are going to be a story. Can I be in it?',
      ],
    },
    {
      lines: [
        'Are you the one with the torn map? Everyone says the tear is where the monster lives.',
        'I would just tape it. Nobody listens to me.',
      ],
    },
  ],

  mp_chartmaker: [
    {
      when: (c) => c.legendState('pearlWidow') === 'unheard',
      lines: [
        'Your aunt brought me that chart to copy. I refused. I have never refused work before or since.',
        'It marks six places, Captain, and one of them is [[Pearlmaw Reef]], where nine divers went down and none came up.',
        'The reef gives pearls freely now. Free is what frightens me. Nothing in the Reach is free.',
        'Read the chart at sea — press the chart key and the Sunder Reach will lay itself out for you.',
      ],
      then: (c) => {
        c.rumor('pearlWidow');
        c.notice('Legend recorded: [[The Pearl Widow]].');
      },
    },
    {
      lines: [
        'Six marks, and a tear where the seventh would be. Your aunt did not tear it. Something in the Pass did.',
      ],
    },
  ],

  mp_maroon: [
    {
      when: (c) => c.legendState('ashenCrown') === 'unheard',
      lines: [
        'My grandmother’s people cut cane on the ash slopes before the mountain took the fields back.',
        'She said a pirate king had himself buried inside [[Emberpath]] so nobody could dig him up.',
        'The mountain has been trying to hand him back ever since. Ashfall Rest sells what comes up from the top halls.',
        'Nobody sells anything from the bottom ones. Ask yourself why nobody has.',
      ],
      then: (c) => {
        c.rumor('ashenCrown');
        c.notice('Legend recorded: [[The Ashen Crown]].');
      },
    },
    {
      when: (c) => c.legendState('ashenCrown') === 'resolved',
      lines: [
        'The plume changed colour the day you came back. Grandmother would have had something to say about it.',
        'Probably rude. She was very rude about kings.',
      ],
    },
    {
      lines: ['Take a ward before you go below in Emberpath. Not a charm. A ward. There is a difference and it is your skin.'],
    },
  ],

  /* ============================= GREEN FATHOM ============================= */

  gf_herbalist: [
    {
      when: (c) => c.legendState('ceibaWarden') === 'unheard',
      lines: [
        'You should not be this far in. Nobody should. Ask the three cutters who came for timber last month.',
        'The Fathom handed their axes back. Stacked. Neat. Handles pointing out, like a hint.',
        'There is a [[ceiba]] at the heart of this island older than the island’s name for it. It let people pass for two hundred years and this season it stopped.',
        'The shrine is north of here. The bowls have been empty a long time.',
      ],
      then: (c) => {
        c.rumor('ceibaWarden');
        c.notice('Legend recorded: [[The Ceiba Warden]].');
      },
    },
    {
      when: (c) => c.flag('grove.blessed'),
      lines: ['The canopy opened a road that was not there. I have walked it twice to be sure. Thank you.'],
    },
    {
      when: (c) => c.flag('grove.sold'),
      lines: [
        'I know what you sold. So does the Fathom. It will still let you pass — it is not petty.',
        'It just will not help you any more.',
      ],
    },
    {
      lines: ['Fill the bowls before you go up. That is not superstition, that is manners.'],
    },
  ],

  /* ============================== MIREBORNE ============================== */

  mb_broker: [
    {
      when: (c) => c.flag('mireborne.blackmarket'),
      lines: ['Back room is yours. Do not touch the third shelf, that is not for sale, that is evidence.'],
      then: (c) => c.openShop('mireborne'),
    },
    {
      lines: ['Front stock only. Earn the back room.'],
      then: (c) => c.openShop('mireborne'),
    },
  ],

  mb_inn: [
    { lines: ['Thirty. The wick stays lit all night, which you will be grateful for.'], then: (c) => c.rest(30) },
  ],

  mb_lantern: [
    {
      when: (c) => c.legendState('sablemanMires') !== 'unheard' && !c.has('mireLantern'),
      lines: [
        'You want to go out into the Sable with the lights moving? Then you take one of mine.',
        'Green glass, low wick. The false ones cannot copy this flame — they get the colour wrong every time, and they hate that.',
        'Count the lanterns as you go. If the count changes, do not follow either of them.',
      ],
      then: (c) => {
        c.give('mireLantern', 1);
        c.advance('sablemanMires', 'lights');
        c.notice('Borrowed the [[Mire Lantern]].');
      },
    },
    {
      when: (c) => c.flag('mires.safe'),
      lines: ['Three runners home this week and not one of them lost a name. Keep the lantern. Consider it rent.'],
    },
    {
      lines: ['A lantern is a promise that somebody is still awake. Do not make promises you cannot keep out there.'],
    },
  ],

  mb_runner: [
    {
      when: (c) => c.legendState('sablemanMires') === 'unheard',
      lines: [
        'Three of ours gone this month. Not drowned. Not caught. Gone, and their families cannot say the names any more.',
        'They try, and the sound comes out and it is not the name.',
        'There is a gentleman out in the mangroves who trades in them. Everyone says he is very fair. Nobody can say it out loud.',
      ],
      then: (c) => {
        c.rumor('sablemanMires');
        c.notice('Legend recorded: [[The Sableman of the Mires]].');
      },
    },
    {
      when: (c) => c.legendState('sablemanMires') === 'resolved',
      lines: ['Said my own name out loud in the square this morning. Twice. Just because I could.'],
    },
    {
      lines: ['Take the lantern from Yeva before you go out. Do not be proud about it.'],
    },
  ],

  mb_fisher: [
    { lines: ['Nets come up full of lantern glass out here. Never the wicks. Only ever the glass.'] },
  ],

  mb_priest: [
    {
      when: (c) => c.flag('game.cleared'),
      lines: ['Six names given back to the Reach in one season. We have not had a season like it. We may not again.'],
    },
    {
      lines: [
        'We keep the low names here — the ones too small for a shrine and too stubborn to go quiet.',
        'Yours is on the list now, Captain. That is not a compliment. It is a warning about how these things end.',
      ],
    },
  ],

  /* ============================= ASHFALL REST ============================ */

  af_smith: [
    {
      when: (c) => c.flag('ashfall.forge'),
      lines: ['Fire-forged stock is out. The mountain has been generous since you closed that vault.'],
      then: (c) => c.openShop('ashfall'),
    },
    {
      lines: ['Bring me something the mountain made and I will make it worse. What do you need?'],
      then: (c) => c.openShop('ashfall'),
    },
  ],

  af_inn: [
    { lines: ['Forty, and the ash gets swept out twice a night. You are paying for the sweeping.'], then: (c) => c.rest(40) },
  ],

  af_watch: [
    {
      when: (c) => c.legendState('ashenCrown') !== 'unheard' && !c.hasHeatWard(),
      lines: [
        'Going below? Then buy a [[Cinder Ward]] from Danu first. Not a charm. A ward.',
        'The vent paths under the third landing run hot enough to cook a man in his own coat. The ward is the difference.',
        'I have pulled eleven people out of there. Two of them were still people.',
      ],
    },
    {
      when: (c) => c.legendState('ashenCrown') === 'resolved',
      lines: ['Vents run cool as a cellar now. I have got nothing to watch. It is the best day of my career.'],
    },
    {
      lines: ['Ward on, hands off the braziers, and count the landings on the way down. Three, then stop.'],
    },
  ],

  af_digger: [
    {
      when: (c) => c.flag('ember.saber'),
      lines: ['You took the blade. Of course you did. Everyone takes the blade.'],
    },
    {
      when: (c) => c.flag('ember.crest'),
      lines: ['You took the crest and left the sword. First one who ever did. I like you.'],
    },
    {
      lines: [
        'Top halls are picked clean. Everything down there is somebody’s tool, somebody’s cup, somebody’s bad idea.',
        'The bottom halls are the king’s. We do not go. We are not brave, we are employed.',
      ],
    },
  ],

  af_child: [
    { lines: ['I can hold my breath the whole way past the vents. Do not tell Milla. Do not tell anyone.'] },
  ],

  /* ============================== incidental ============================= */

  generic_villager: [
    { lines: ['Fair winds, Captain.'] },
  ],
};

export function dialogue(id) {
  return DIALOGUE[id] ?? DIALOGUE.generic_villager;
}

/** Choose the first branch whose guard passes. */
export function pickBranch(entry, ctx) {
  for (const branch of entry) {
    if (!branch.when || branch.when(ctx)) return branch;
  }
  return null;
}
