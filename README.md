# Legend of the Blue Waters

A complete, playable pirate-Caribbean JRPG for the browser: top-down exploration,
classic turn-based battles, and six regional legends that drive the whole game.

Built for a **phone, held sideways, driven entirely by touch** — there is no keyboard
support, by design.

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
npm run bootcheck      # boots on a landscape phone viewport, reports any console error
npm run mobile         # touch-driven sweep on a phone viewport, audits touch targets
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

The stage is a fixed **648 px tall**; its width comes from the device's aspect ratio
(clamped to 1152–1728), so a phone fills edge to edge instead of letterboxing a 16:9 box
into a ~2.16:1 screen. The renderer draws at the device's real pixel density, so the art
is upscaled once on the GPU rather than squeezed through a fractional CSS downscale.

Tiles are **48 px** and characters **48×72**, shaded off six-stop colour ramps with
dithered transitions, ambient occlusion at contact points, and a rim light that assumes
the sun is up and to the left.

- **PixiJS patterns.** `new Application()` + `await app.init(...)`, scenes as `Container`
  subclasses attached to `app.stage`, a single `app.ticker.add((ticker) => …)` driving
  every update from `ticker.deltaMS`, `eventMode: 'static'` on everything tappable, and
  `Texture` sub-frames off one shared `TextureSource`.
- **Touch, all the way down.** `core/input.js` has no keyboard listeners at all: it
  exposes named actions fed by `setVirtual` / `setStick` / `tap`, which the on-screen
  controls and the headless test tools both drive. Touch targets are sized from
  `game.touchUnit` — the number of virtual pixels equal to 44 CSS px on the current
  device — so they stay thumb-sized whatever the screen.
- **Pixel buffers, not canvas calls.** Sprites are composed in typed arrays and blitted
  one `putImageData` per atlas slot. At 48 px tiles the old one-`fillRect`-per-pixel
  approach would be roughly two million canvas calls at boot.
- **Effects scale to the device.** `core/quality.js` watches the frame time and steps
  bloom, depth blur and particle density down a tier when it stays bad, and never
  oscillates back up on its own. The options tab can pin a tier.
- **One post pass.** `core/postfx.js` is a custom GLSL filter doing bright-pass bloom,
  colour grade and split-tone in a single 17-tap gather, wrapped around the scene root
  so the on-screen controls stay crisp above it. The threshold sits above diffuse
  surfaces, so lit sand does not glow but the moon, foam, flame and light pools do.
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

| Gesture | Action |
| --- | --- |
| **Touch and drag, left of screen** | Walk, steer the ship. The stick appears wherever your thumb lands |
| **Push the stick to the rim** | Run on foot, full sail at sea |
| **◉ button** | Talk, examine, confirm, advance text (hold in battle to fast-forward) |
| **✕ button** | Cancel, back out, close a window |
| **Log button** | Crew, gear, items, journal, options, save |
| **Chart button** | Sea chart — appears only while sailing |
| **Tap anywhere** | Advance dialogue |
| **Tap an enemy** | Pick it as your target in battle |
| **Tap a menu row** | Highlight it; tap again to choose |
| **Tap a tab** | Switch pages in the ship's log |

In battle you can tap an enemy directly instead of stepping the cursor along the line.

---

## Game structure overview

```
index.html                 entry point, import map, boot screen
vendor/pixi.min.mjs        vendored PixiJS 8.19.0 (MIT)

src/main.js                Application init, canvas scaling, ticker, game context

src/core/
  scene.js                 Scene base class + scene stack with fade transitions
  input.js                 named touch actions, edge detection, menu auto-repeat
  touch.js                 floating analog stick + action buttons, per-scene schemes
  font.js                  hand-authored 8x14 bitmap font, word wrap, typewriter text
  paint.js                 colour ramps, seamless noise, the pixel-buffer drawing surface
  art.js                   palette, tile/prop/character/ship/effect art, atlas builder
  postfx.js                bloom + colour grade in one custom GLSL pass
  lighting.js              additive light pools over the night darkness
  particles.js             pooled emitter: embers, spray, dust, sparks
  quality.js               frame-time driven effect tiers
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
- **Touch only, landscape only.** There is no keyboard or gamepad support, and portrait
  shows a rotate prompt rather than a second layout.
- **Content is a vertical slice.** ~1–2 hours by design: eleven maps, 36 enemies, seven
  legends. Every system is finished, but the world is compact rather than sprawling.
- **Towns have no interiors.** Shops and inns are run by NPCs at their stalls and doors,
  which keeps the settlements lively but means there is nothing to walk into.
- **Music is procedural, not composed to picture.** Seven looping themes, no dynamic
  layering, and transitions are hard cuts rather than crossfades.
- **The party is fixed at three.** There is no bench, no swapping and no fourth slot.
- **No per-skill effect animations.** Combat has impact flashes, shakes, popups and
  particle bursts, but each skill does not get its own choreography.
- **Battle enemies are still one frame.** They have a contact shadow, an outline and a
  rim light, but no idle animation.
- **Some screens got a mechanical rescale.** The shop, sea chart, ending and game-over
  screens were scaled to the new stage and verified free of errors, but they have not
  had the hand-tuning the title, field, battle, log and intro screens received.
- **Depth blur is set per battle.** The parallax blur is chosen from the quality tier
  when the backdrop is built, so a mid-fight downgrade takes effect on the next fight.
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
