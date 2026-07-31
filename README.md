# Legend of the Blue Waters

A complete, playable pirate-Caribbean JRPG for the browser: 8-bit top-down exploration,
classic turn-based battles, and six regional legends that drive the whole game.

Built with **PixiJS 8**, plain ES modules, and **no build step**. Every tile, character,
enemy, sound effect and music track is generated in code at boot — there is not a single
image or audio file in the repository.

---

## Running it

The game needs a static server (browsers refuse to load ES modules over `file://`):

```bash
# any one of these, from the repo root
python3 -m http.server 8080
npx serve -l 8080 .
npm start
```

Then open <http://localhost:8080/>. Click once or press a key to let the browser start audio.

There is nothing to install and nothing to build. PixiJS is vendored at
`vendor/pixi.min.mjs` (the official `pixi.js@8.19.0` ESM browser bundle, MIT licensed) and
mapped through an import map in `index.html`, so the game also runs fully offline.

### Optional dev tools

```bash
npm install            # only needed for the browser-driven scripts (playwright)
npm test               # headless logic + battle-balance report — no browser required
npm run smoke          # boots the game, plays the opening, screenshots it
npm run sweep          # visits every scene and screenshots it, fails on console errors
npm run loop           # plays the first legend end to end and asserts the world changed
```

`npm test` is the useful one day to day: it verifies the quest chain, equipment rules,
save round-trips and data integrity, then auto-plays 20 battles per encounter and prints
win rates and round counts.

---

## What is in it

- **Six regional legends**, each of which is simultaneously a quest chain, a reward
  source, and a set of battles — plus a hidden seventh.
- **Three settlements** and **eight field/dungeon regions**, on eleven hand-authored maps.
- **A sea layer**: sail the *Salt Wren* between islands on an open sea chart, with a
  full-screen chart overlay tracking discovered ports and legend progress.
- **Turn-based combat** with six elements, a Guard/Break system, status effects, an
  enemy roster of 36, equipment, consumables and a visible turn order.
- **Three-character party**, each with a distinct battle role and their own skill list.
- **Branching outcomes** on three legends that change items, skills, dialogue and prices.
- **Shops, an inn, a quest journal, three save slots, day/night, weather** and
  **New Game +**.
- Chiptune music and sound effects synthesised live with the Web Audio API.

Roughly 1–2 hours of content, deliberately compact and fully wired together rather than
large and half-finished.

---

## How it is built

Everything renders at a fixed **384×216** virtual resolution, integer-scaled with CSS so
the pixel art always lands on whole pixels.

- **PixiJS patterns.** `new Application()` + `await app.init(...)`, scenes as `Container`
  subclasses attached to `app.stage`, a single `app.ticker.add((ticker) => …)` driving
  every update from `ticker.deltaMS`, `eventMode: 'static'` on menu rows so every menu is
  clickable as well as keyboard-driven, and `Texture` sub-frames off one shared
  `TextureSource`.
- **One atlas.** All tiles, characters, ships, props, effects and battlers are painted
  into a single offscreen canvas at boot and sliced into sub-textures, so the whole world
  batches into very few draw calls.
- **Original pixel art.** A 5×8 bitmap font is hand-authored as ASCII art
  (`src/core/font.js`); characters are drawn by a parametric generator with palette swaps;
  enemies share a set of silhouette archetypes recoloured per region
  (`src/core/battlers.js`).
- **Maps as sketches.** Each map is written as ASCII art, one character per tile, with
  digits marking named anchor points that warps and objects refer to by name
  (`src/data/maps.js`). Tiles are drawn through a pooled sprite grid that only rebinds
  textures when the camera crosses a tile boundary.
- **Pure logic, separate presentation.** `src/systems/battle.js` never touches the display
  list: it returns a stream of events (`damage`, `break`, `status`, `down`, …) that
  `BattleScene` animates. That is why the whole combat system can be tested headlessly in
  Node.

---

## Controls

| Key | Action |
| --- | --- |
| **Arrows** / **WASD** | Move, steer the ship, move through menus |
| **Z** / **Enter** / **Space** | Confirm, talk, examine, advance text (hold in battle to fast-forward) |
| **X** / **Esc** | Cancel, back out, close a window |
| **C** / **Tab** | Open the ship's log (crew, gear, items, journal, options, save) |
| **Q** | Jump straight to the legend journal |
| **M** | Sea chart overlay (while sailing) |
| **Shift** (hold) | Run on foot, full sail at sea |
| **N** | Mute / unmute |
| **H** / **F1** | Controls and combat help |
| **Mouse** | Menu entries can also be hovered and clicked |

In battle, **Left/Right** pick a target, **X** backs out of a submenu.

---

## Game structure overview

```
index.html                 entry point, import map, boot screen
vendor/pixi.min.mjs        vendored PixiJS 8.19.0 (MIT)

src/main.js                Application init, canvas scaling, ticker, game context

src/core/
  scene.js                 Scene base class + scene stack with fade transitions
  input.js                 keyboard state, edge detection, menu auto-repeat
  font.js                  hand-authored 5x8 bitmap font, word wrap, typewriter text
  art.js                   palette, tile/prop/character/ship/effect art, atlas builder
  battlers.js              enemy + boss silhouettes (22 archetypes, recoloured per region)
  ui.js                    panels, bars, menus, dialogue box, damage popups
  audio.js                 Web Audio chiptune: 7 looping themes + 19 sound effects
  save.js                  three localStorage slots, versioned, plus options
  rng.js                   seeded PRNG and sampling helpers

src/data/                  all content, as plain data
  legends.js               the seven legends: rumours, stages, bosses, rewards, branches
  maps.js                  eleven ASCII tile maps + the sea chart, and their compiler
  enemies.js               36 enemies with weaknesses, guard, loot and AI weights
  party.js                 three characters, growth curves, learn sets
  skills.js                62 abilities and the status-effect table
  items.js                 47 consumables, weapons, coats, trinkets, relics, key items
  shops.js                 stock lists, gated by world flags
  dialogue.js              every spoken line, branched on world state

src/systems/
  gamestate.js             the save file: crew, inventory, flags, legends, clock, rep
  battle.js                turn engine — order, damage, elements, Guard/Break, statuses, AI
  quests.js                legend state machine and reward granting
  worldstate.js            "what has the world become?" — routes, gates, tints, prices

src/scenes/
  TitleScene.js  IntroScene.js  FieldScene.js  SeaChartScene.js
  BattleScene.js MenuScene.js   ShopScene.js   EndingScene.js  GameOverScene.js

tools/                     optional dev scripts (not needed to play)
```

### The loop

Hear a rumour in a settlement → sail to the region → work through its exploration
objective (light beacons, fill offering bowls, kindle braziers, recover pearls, read true
lanterns) → fight the legend's elite and boss → choose an outcome where one is offered →
collect a relic, a skill and a world change → the change opens the next region.

### Combat

Every enemy has **Guard pips** and elemental weaknesses. Hitting a weakness strips a pip;
at zero the enemy **Breaks** — it loses its next turn and takes 50% extra damage until its
guard returns. Rook's *Read the Wind* reveals weaknesses for the whole crew, which is what
turns each region's element chart into a puzzle rather than a memory test.

- **Nia Corvel** — saber and command. Big single hits, party attack buffs, a taunt-stance.
- **Rook Ondari** — navigator and gunner. Weakness scouting, multi-hit shots, debuffs.
- **Yerena Palo** — shore-priestess. Healing, revival, Tide and Spirit coverage.

Elements: **Steel · Shot · Flame · Tide · Spirit · Storm**.

---

## Legend list

| # | Legend | Region | Lv | Objective | Boss | Reward | World change |
| - | ------ | ------ | -- | --------- | ---- | ------ | ------------ |
| I | **The Lantern Galleon** | Moonwrack Shoals | 6 | Light three drowned beacons *after dark*, then board the wreck | Captain Halloway Vane | Spectral Compass | Shipping curse lifts; Marrowport's stock and the night lane open; the reef road to Pearlmaw becomes sailable |
| II | **The Ceiba Warden** ⚑ | Green Fathom / Whisperwood Shrine | 9 | Fill the three offering bowls beneath the ceiba | Kaobo the Rooted | Branch-dependent | **Return** the relic (Verdant Charm, Warden's Bark, Yerena learns *Rootbind*) · **Keep** it (Heartwood Idol, the grove goes cold) · **Sell** it in Mireborne (900 coin, smuggler standing, a name in a rival ledger) |
| III | **The Ashen Crown** ⚑ | Emberpath Ruins | 14 | Buy a Cinder Ward, kindle three tomb braziers, break the Sentinel | Kingsflame Idol | **Kingsflame Saber** or **Emberking's Crest** | Ashfall Rest opens its fire-forged stock; the vent shortcut stays walkable |
| IV | **The Pearl Widow** ⚑ | Pearlmaw Reef | 15 | Take a Diving Reed, recover the drowned divers' pearls, silence the Siren Chorus | The Coral Dowager (yields at low HP) | Branch-dependent | **Return the pearls** (Tideheart Pearl + Focus, Yerena learns *Tideheart Song*, the reef calms, Marrowport's best stock opens) · **Finish her** (Widow's Fang, richer loot, the reef stays hostile) |
| V | **The Sableman of the Mires** | Sable Mangroves | 12 | Borrow the Mire Lantern, read the three true lights, refuse the trade | The Sableman | Nameless Coin; Rook learns *Ghost Shot* | Mangrove runs go safe; Mireborne's black market opens |
| VI | **The Storm Saint of the Wailing Pass** | Wailing Pass | 21 | Resolve four legends, take the Storm Sail refit, sail the eye | Saint Marene → **The Blackwater Maw** | The ending | The Reach gets its first quiet season in sixty years |
| ★ | **The Iron Bell** *(hidden)* | Blackwater Trench | 25 | Survive their ambush at sea, then answer the bell once all six legends are told | The Iron Bell Company (three-on-three) | Iron Bell Sigil | Nobody is following you any more |

⚑ = branching outcome. Progression gates are all earned rather than arbitrary: the
Pearlmaw lane needs the Lantern Galleon resolved, Emberpath's lower halls need a Cinder
Ward, Pearlmaw's caverns need a Diving Reed, the mangrove lights need the Mire Lantern,
and the Wailing Pass needs four legends and a refit.

---

## Known limitations

- **A static server is required.** ES modules will not load from `file://`.
- **Desktop keyboard and mouse only.** No touch controls and no gamepad support.
- **Content is a vertical slice.** ~1–2 hours by design: eleven maps, 36 enemies, seven
  legends. Every system is finished, but the world is compact rather than sprawling.
- **Towns have no interiors.** Shops and inns are run by NPCs at their stalls and doors,
  which keeps the settlements lively but means there is nothing to walk into.
- **Music is procedural, not composed to picture.** Seven looping themes, no dynamic
  layering, and transitions are hard cuts rather than crossfades.
- **The party is fixed at three.** There is no bench, no swapping and no fourth slot.
- **No animation for skills beyond flashes, shakes and popups.** Combat feedback is
  readable but there are no per-skill effect animations.
- **Field encounters are step-based**, not visible-on-map monsters, so they cannot be
  avoided except by resolving the region's legend (which does turn them off).
- **Reputation is shallow.** It shifts shop prices and a few lines; it does not gate
  content.
- **Saves are browser-local.** Clearing site data clears the logs; there is no export.

---

## Next expansion ideas

1. **Visible field encounters.** Wandering enemy sprites with aggro ranges, so avoidance
   becomes a skill; the existing `encounters` tables already describe the roster.
2. **Town interiors.** The map compiler and warp system already support them — a tavern,
   a chapel and a forge would each be a 20-line ASCII sketch.
3. **Ship upgrades as systems, not just visuals.** Hull, sail and guns that change sea
   speed, encounter rates and open new lanes; `state.ship.tier` and the three ship
   sprites are already in place.
4. **Sea combat.** Reuse the battle engine with the ship as the combatant, broadsides as
   skills and boarding as a phase transition — `phase2` already supports two-part fights.
5. **A fourth companion.** The party system is not hard-coded to three; a maroon scout or
   a defected Iron Bell gunner would slot in with one data entry and a `join()` call.
6. **Per-skill effect animations.** The event stream from `battle.js` already names the
   skill and element, so animations can be attached without touching combat logic.
7. **More branches, and consequences that cross regions.** Selling the Heartwood Relic
   already changes three settlements; the same hook could let a sold relic show up in an
   enemy's hands later.
8. **A bestiary and a lore journal**, filled in as enemies are broken and rumours heard —
   the data is all there, it needs a tab.
9. **Weather that matters.** Storms that raise Storm damage and lower accuracy, fog that
   hides enemy weaknesses until scouted.
10. **New Game+ remixing.** NG+ currently scales enemies; swapping in elite variants,
    rerolling weaknesses and re-cutting the legend order would make a second run a
    different puzzle.

---

## Credits and licence

Original setting, characters, legends, art, music and code. The Caribbean-inspired
cultures, spirits and folklore here are fiction written for this game rather than a
depiction of any real tradition.

PixiJS is © the PixiJS contributors, MIT licensed, and vendored unmodified at
`vendor/pixi.min.mjs`.
