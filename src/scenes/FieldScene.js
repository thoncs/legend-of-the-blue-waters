/**
 * Overworld exploration: tile rendering, grid movement, NPCs, interactables,
 * legend objectives, random encounters, weather and day/night.
 */
import { Container, Graphics, Sprite } from 'pixi.js';
import { Scene } from '../core/scene.js';
import { PixelText, measure } from '../core/font.js';
import { DialogueBox, Panel, UI, MenuList } from '../core/ui.js';
import { input } from '../core/input.js';
import { audio } from '../core/audio.js';
import { rng } from '../core/rng.js';
import { buildMap, TILE_DEFS } from '../data/maps.js';
import { dialogue as dialogueFor, pickBranch } from '../data/dialogue.js';
import { LEGENDS, LEGEND_STATE } from '../data/legends.js';
import { itemName } from '../data/items.js';
import {
  rumorLegend, activateLegend, advanceStage, bumpCounter, counterValue,
  resolveLegend, passUnlocked,
} from '../systems/quests.js';
import {
  ambientTint, encountersEnabled, gateBlocked, musicFor, nightGate,
} from '../systems/worldstate.js';
import { saveGame } from '../core/save.js';
import { TILE, ACTOR_FRAMES } from '../core/art.js';

const STEP_MS = 148;
const RUN_MS = 92;

/** Flavour for each kind of legend objective object. */
const OBJECT_FLAVOR = {
  legendBeacon: {
    verb: 'beacon',
    done: 'The beacon is already burning.',
    text: 'You strike the drowned beacon. The wick is soaked through and catches anyway.',
    complete: 'The third beacon takes. Out past the sandbars, something enormous turns to face the light.',
  },
  legendBowl: {
    verb: 'bowl',
    done: 'This bowl is filled.',
    text: 'You fill the bowl — rainwater, cut fruit, a coin turned face down. Manners, Serel called it.',
    complete: 'The third bowl fills and the whole grove leans in a direction that is not the wind.',
  },
  legendBrazier: {
    verb: 'brazier',
    done: 'This brazier is lit.',
    text: 'The brazier takes the flame greedily, the way a thing does when it has been waiting.',
    complete: 'Three braziers. Somewhere below, a door that has not moved in a century remembers how.',
  },
  legendPearl: {
    verb: 'pearl',
    done: 'You have taken this one.',
    text: 'A pearl the size of a thumbnail, still warm. Someone was holding it recently.',
    complete: 'Nine pearls, and the reef stops pretending it does not notice you.',
  },
  legendLight: {
    verb: 'light',
    done: 'You have already read this one.',
    text: 'Your lantern and this one burn the same green. A true light. You mark the way.',
    complete: 'Three true lights, and every false one in the mangrove goes out at once.',
  },
};

export class FieldScene extends Scene {
  onEnter(params = {}) {
    this.controlScheme = 'field';
    const { state, art, width, height } = this.game;
    this.params = params;
    this.mapId = params.mapId ?? state.position.map;
    this.map = buildMap(this.mapId);

    // --- world layers ---
    this.world = new Container();
    this.addChild(this.world);
    this.groundLayer = new Container();
    this.propLayer = new Container();
    this.entityLayer = new Container();
    this.entityLayer.sortableChildren = true;
    this.world.addChild(this.groundLayer, this.propLayer, this.entityLayer);

    this.viewCols = Math.ceil(width / TILE) + 2;
    this.viewRows = Math.ceil(height / TILE) + 2;
    this.tilePool = [];
    this.animTiles = [];
    for (let i = 0; i < this.viewCols * this.viewRows; i++) {
      const s = new Sprite(art.tex('tile:grass'));
      this.groundLayer.addChild(s);
      this.tilePool.push(s);
    }
    this.tileOrigin = { x: -999, y: -999 };
    this.animFrame = 0;

    // --- props ---
    this.propSprites = new Map();
    for (const obj of this.map.objects) {
      const s = new Sprite(art.tex(`prop:${this.propTexture(obj)}`));
      s.x = obj.x * TILE;
      s.y = obj.y * TILE;
      this.propLayer.addChild(s);
      this.propSprites.set(obj.id, s);
    }

    // --- npcs ---
    this.npcs = this.map.npcs.map((def) => {
      const s = new Sprite(art.actor(def.style, def.dir ?? 'down', 0));
      s.x = def.x * TILE;
      s.y = def.y * TILE;
      s.zIndex = def.y * TILE;
      this.entityLayer.addChild(s);
      return {
        def, sprite: s, tx: def.x, ty: def.y, dir: def.dir ?? 'down',
        homeX: def.x, homeY: def.y, wanderT: rng() * 3000, frame: 0, animT: 0,
        moving: false, fromX: def.x, fromY: def.y, moveT: 0,
      };
    });

    // --- player ---
    const start = params.resume && state.position.map === this.mapId
      ? state.position
      : { x: params.tx ?? this.map.start.x, y: params.ty ?? this.map.start.y, dir: params.dir ?? this.map.start.dir };
    this.player = {
      tx: start.x, ty: start.y, dir: start.dir ?? 'down',
      fromX: start.x, fromY: start.y, moveT: 1, moving: false,
      frame: 0, animT: 0, stepPhase: 0,
    };
    this.playerSprite = new Sprite(art.actor(state.leader?.style ?? 'nia', this.player.dir, 0));
    this.entityLayer.addChild(this.playerSprite);
    this.followers = state.party.slice(1).map((m) => {
      const s = new Sprite(art.actor(m.style, this.player.dir, 0));
      s.alpha = 0.98;
      this.entityLayer.addChild(s);
      return { sprite: s, member: m, trail: [] };
    });
    this.trail = [];

    state.position = { map: this.mapId, x: this.player.tx, y: this.player.ty, dir: this.player.dir };

    // --- weather + tint ---
    this.weather = new Container();
    this.addChild(this.weather);
    this.weatherParts = [];
    this.setupWeather();

    this.tintLayer = new Graphics();
    this.tintLayer.rect(0, 0, width, height).fill(0xffffff);
    this.tintLayer.blendMode = 'multiply';
    this.addChild(this.tintLayer);
    this.applyTint();

    this.flashLayer = new Graphics();
    this.flashLayer.rect(0, 0, width, height).fill(0xffffff);
    this.flashLayer.alpha = 0;
    this.addChild(this.flashLayer);

    // --- HUD ---
    this.hud = new Container();
    this.addChild(this.hud);

    this.clockPanel = new Panel(58, 14);
    this.clockPanel.x = width - 62;
    this.clockPanel.y = 4;
    this.hud.addChild(this.clockPanel);
    this.clockText = new PixelText({ text: '', color: UI.ink });
    this.clockText.x = width - 56;
    this.clockText.y = 7;
    this.hud.addChild(this.clockText);

    this.banner = new Container();
    this.bannerPanel = new Panel(10, 16);
    this.bannerText = new PixelText({ text: '', color: UI.accent });
    this.banner.addChild(this.bannerPanel, this.bannerText);
    this.banner.x = 6;
    this.banner.y = 4;
    this.hud.addChild(this.banner);
    this.bannerTime = 0;

    // --- dialogue ---
    this.dialogueBox = new DialogueBox(width - 16, 3);
    this.dialogueBox.x = 8;
    this.dialogueBox.y = height - this.dialogueBox.height_ - 6;
    this.dialogueBox.visible = false;
    this.addChild(this.dialogueBox);
    this.dialogueBox.charsPerSecond = [26, 42, 64, 999][this.game.options.textSpeed] ?? 64;

    this.choiceUI = null;
    this.queue = [];
    this.talking = false;
    this.onDialogueDone = null;
    this.stepsSinceEncounter = 0;
    this.encounterThreshold = this.rollEncounterThreshold();
    this.busy = false;
    this.t = 0;

    audio.playTheme(musicFor(state, this.map));
    this.showBanner(params.banner ?? this.map.name);
    // Camera first: the tile pool is laid out relative to the camera origin.
    this.updateCamera(true);
    this.refreshTiles(true);

    // Anything queued by the previous scene (battle results, notices).
    if (params.afterBattle) this.handleAfterBattle(params.afterBattle);
    else if (params.openingNotice) this.say([params.openingNotice], '');
    else if (params.notice) this.say([params.notice], '');
  }

  onExit() {
    this.game.state.position = { map: this.mapId, x: this.player.tx, y: this.player.ty, dir: this.player.dir };
  }

  /* --------------------------- rendering --------------------------- */

  propTexture(obj) {
    const state = this.game.state;
    if (obj.kind === 'chest') return state.chests[obj.id] ? 'chestOpen' : 'chest';
    if (obj.filledProp && obj.counter && obj.legend) {
      const done = state.legendRecord(obj.legend).counters[`${obj.counter}:${obj.id}`];
      if (done) return obj.filledProp;
    }
    if (obj.kind === 'legendLight' && this.game.state.legendRecord(obj.legend)?.counters[`lights:${obj.id}`]) {
      return 'lantern';
    }
    return obj.prop;
  }

  refreshTiles(force = false) {
    const originX = Math.floor(this.camX / TILE);
    const originY = Math.floor(this.camY / TILE);
    if (!force && originX === this.tileOrigin.x && originY === this.tileOrigin.y) return;
    this.tileOrigin = { x: originX, y: originY };
    this.animTiles.length = 0;

    const { art } = this.game;
    const { w, h, chars } = this.map;
    let i = 0;
    for (let row = 0; row < this.viewRows; row++) {
      for (let col = 0; col < this.viewCols; col++) {
        const s = this.tilePool[i++];
        const tx = originX + col;
        const ty = originY + row;
        s.x = tx * TILE;
        s.y = ty * TILE;
        if (tx < 0 || ty < 0 || tx >= w || ty >= h) {
          s.visible = false;
          continue;
        }
        s.visible = true;
        const ch = chars[ty * w + tx];
        const def = TILE_DEFS[ch];
        if (def?.anim) {
          s.texture = art.tex(`tile:${def.anim[this.animFrame % def.anim.length]}`);
          this.animTiles.push({ sprite: s, frames: def.anim });
        } else {
          s.texture = art.tex(`tile:${def?.tex ?? 'grass'}`);
        }
      }
    }
  }

  updateAnimTiles() {
    const { art } = this.game;
    for (const { sprite, frames } of this.animTiles) {
      sprite.texture = art.tex(`tile:${frames[this.animFrame % frames.length]}`);
    }
  }

  get camX() { return this._camX ?? 0; }
  get camY() { return this._camY ?? 0; }

  updateCamera(snap = false) {
    const { width, height } = this.game;
    const mapW = this.map.w * TILE;
    const mapH = this.map.h * TILE;
    const px = this.playerPixel();
    let cx = px.x + TILE / 2 - width / 2;
    let cy = px.y + TILE / 2 - height / 2;
    cx = mapW <= width ? (mapW - width) / 2 : Math.max(0, Math.min(cx, mapW - width));
    cy = mapH <= height ? (mapH - height) / 2 : Math.max(0, Math.min(cy, mapH - height));
    this._camX = snap ? cx : cx;
    this._camY = snap ? cy : cy;
    this.world.x = -Math.round(this._camX);
    this.world.y = -Math.round(this._camY);
  }

  playerPixel() {
    const t = Math.min(1, this.player.moveT);
    const x = (this.player.fromX + (this.player.tx - this.player.fromX) * t) * TILE;
    const y = (this.player.fromY + (this.player.ty - this.player.fromY) * t) * TILE;
    return { x, y };
  }

  applyTint() {
    const color = ambientTint(this.game.state, this.map);
    this.tintLayer.tint = color;
    this.tintLayer.visible = color !== 0xffffff;
  }

  setupWeather() {
    const kind = this.map.weather;
    if (!kind) return;
    const { art, width, height } = this.game;
    const count = kind === 'fog' ? 14 : kind === 'ash' ? 40 : 60;
    for (let i = 0; i < count; i++) {
      let s;
      if (kind === 'rain' || kind === 'storm') {
        s = new Sprite(art.tex('fx:drop'));
        s.tint = 0xa8c8e0;
        s.alpha = 0.5 + rng() * 0.4;
        s.scale.set(1, 2 + rng() * 2);
      } else if (kind === 'ash') {
        s = new Sprite(art.tex('fx:mote'));
        s.tint = 0xd8c0a8;
        s.alpha = 0.3 + rng() * 0.5;
      } else {
        s = new Sprite(art.tex('fx:burst'));
        s.tint = 0xbcd0e0;
        s.alpha = 0.05 + rng() * 0.07;
        s.scale.set(3 + rng() * 4);
      }
      s.x = rng() * width;
      s.y = rng() * height;
      this.weather.addChild(s);
      this.weatherParts.push({
        sprite: s,
        vx: kind === 'fog' ? 4 + rng() * 6 : -20 - rng() * 30,
        vy: kind === 'fog' ? 0 : kind === 'ash' ? 12 + rng() * 14 : 210 + rng() * 120,
        wob: rng() * 6.28,
      });
    }
  }

  updateWeather(dtMS) {
    if (!this.weatherParts.length) return;
    const { width, height } = this.game;
    const dt = dtMS / 1000;
    for (const p of this.weatherParts) {
      p.sprite.x += p.vx * dt;
      p.sprite.y += p.vy * dt;
      if (this.map.weather === 'ash') {
        p.wob += dt * 2;
        p.sprite.x += Math.sin(p.wob) * 0.4;
      }
      if (p.sprite.y > height + 8) { p.sprite.y = -8; p.sprite.x = rng() * width; }
      if (p.sprite.x < -40) p.sprite.x = width + 20;
      if (p.sprite.x > width + 40) p.sprite.x = -20;
    }
    if (this.map.weather === 'storm') {
      this._lightning = (this._lightning ?? 2000) - dtMS;
      if (this._lightning <= 0) {
        this._lightning = 4000 + rng() * 7000;
        this.flashLayer.alpha = 0.55;
        audio.play('thunder');
      }
    }
    if (this.flashLayer.alpha > 0) {
      this.flashLayer.alpha = Math.max(0, this.flashLayer.alpha - dtMS * 0.0022);
    }
  }

  showBanner(text) {
    this.bannerText.text = text;
    this.bannerPanel.resize(this.bannerText.textWidth + 12, 16);
    this.bannerText.x = 6;
    this.bannerText.y = 4;
    this.bannerTime = 2600;
    this.banner.alpha = 1;
    this.banner.visible = true;
  }

  /* ---------------------------- movement --------------------------- */

  passable(x, y) {
    const { w, h, solid } = this.map;
    if (x < 0 || y < 0 || x >= w || y >= h) return false;
    if (solid[y * w + x]) return false;
    for (const n of this.npcs) if (n.tx === x && n.ty === y) return false;
    return true;
  }

  tryMove(dx, dy, running) {
    const dir = dx < 0 ? 'left' : dx > 0 ? 'right' : dy < 0 ? 'up' : 'down';
    this.player.dir = dir;
    const nx = this.player.tx + dx;
    const ny = this.player.ty + dy;
    if (!this.passable(nx, ny)) {
      this.playerSprite.texture = this.game.art.actor(this.leaderStyle, dir, 0);
      return false;
    }
    this.trail.unshift({ x: this.player.tx, y: this.player.ty, dir });
    if (this.trail.length > 12) this.trail.pop();
    this.player.fromX = this.player.tx;
    this.player.fromY = this.player.ty;
    this.player.tx = nx;
    this.player.ty = ny;
    this.player.moveT = 0;
    this.player.moving = true;
    this.player.duration = running ? RUN_MS : STEP_MS;
    return true;
  }

  get leaderStyle() { return this.game.state.leader?.style ?? 'nia'; }

  onArrive() {
    const { state } = this.game;
    state.advanceStep();
    state.position = { map: this.mapId, x: this.player.tx, y: this.player.ty, dir: this.player.dir };
    this.player.stepPhase = (this.player.stepPhase + 1) % 2;
    this.applyTint();

    const warp = this.map.warps.find((w) => w.x === this.player.tx && w.y === this.player.ty);
    if (warp) { this.takeWarp(warp); return; }

    if (this.rollEncounter()) return;
  }

  rollEncounterThreshold() {
    return 6 + rng.int(8);
  }

  rollEncounter() {
    const { state } = this.game;
    if (!encountersEnabled(state, this.map)) return false;
    this.stepsSinceEncounter++;
    if (this.stepsSinceEncounter < this.encounterThreshold) return false;
    if (rng() > this.map.encounters.rate * 8) return false;
    this.stepsSinceEncounter = 0;
    this.encounterThreshold = this.rollEncounterThreshold();
    const group = rng.weighted(this.map.encounters.groups);
    this.startEncounter(group.members);
    return true;
  }

  async startEncounter(members) {
    if (this.busy) return;
    this.busy = true;
    audio.play('encounter');
    const game = this.game;
    const mapId = this.mapId;
    const { startBattle } = await import('./BattleScene.js');
    await startBattle(game, {
      enemies: members,
      canFlee: true,
      backdrop: this.backdropKind(),
      music: 'battle',
      onFinish: async (outcome) => {
        const { FieldScene } = await import('./FieldScene.js');
        if (outcome === 'defeat') {
          const { GameOverScene } = await import('./GameOverScene.js');
          await game.scenes.replace(GameOverScene, {}, { fade: true, fadeColor: 0x000000 });
          return;
        }
        await game.scenes.replace(FieldScene, { mapId, resume: true }, { fade: true, outMS: 200, inMS: 240 });
      },
    });
  }

  backdropKind() {
    return {
      marrowport: 'shore', greenfathom: 'jungle', whisperwood: 'shrine',
      moonwrack: 'shoals', mangroves: 'swamp', mireborne: 'swamp',
      ashfall: 'volcano', emberpath: 'volcano', pearlmaw: 'reef',
      wailingpass: 'storm', blackwater: 'void',
    }[this.mapId] ?? 'shore';
  }

  async takeWarp(warp) {
    if (this.busy) return;
    const { state } = this.game;
    if (warp.to === 'SEA') {
      this.busy = true;
      state.position = { map: this.mapId, x: this.player.tx, y: this.player.ty, dir: this.player.dir };
      state.lastPort = this.mapId;
      audio.play('sail');
      const { SeaChartScene } = await import('./SeaChartScene.js');
      await this.game.scenes.replace(SeaChartScene, { from: this.mapId }, { fade: true });
      return;
    }
    const target = buildMap(warp.to);
    const block = gateBlocked(state, target);
    if (block) {
      this.say([block], '');
      // Step back off the warp tile so the message does not repeat.
      this.player.tx = this.player.fromX;
      this.player.ty = this.player.fromY;
      this.player.moveT = 1;
      return;
    }
    this.busy = true;
    const { FieldScene } = await import('./FieldScene.js');
    await this.game.scenes.replace(FieldScene, {
      mapId: warp.to, tx: warp.tx, ty: warp.ty, dir: warp.dir,
    }, { fade: true, outMS: 240, inMS: 260 });
  }

  /* -------------------------- interaction -------------------------- */

  facingTile() {
    const d = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[this.player.dir];
    return { x: this.player.tx + d[0], y: this.player.ty + d[1] };
  }

  interact() {
    const at = this.facingTile();
    const npc = this.npcs.find((n) => n.tx === at.x && n.ty === at.y);
    if (npc) {
      npc.dir = { up: 'down', down: 'up', left: 'right', right: 'left' }[this.player.dir];
      npc.sprite.texture = this.game.art.actor(npc.def.style, npc.dir, 0);
      this.talkToNpc(npc);
      return;
    }
    const obj = this.map.objects.find((o) => o.x === at.x && o.y === at.y);
    if (obj) { this.useObject(obj); return; }

    // Standing on something worth remarking on.
    const here = this.map.objects.find((o) => o.x === this.player.tx && o.y === this.player.ty);
    if (here) this.useObject(here);
  }

  dialogueContext(npc) {
    const { state } = this.game;
    const self = this;
    return {
      state,
      npc,
      gold: state.gold,
      get legendsResolved() { return state.resolvedCount; },
      has: (id) => state.hasItem(id),
      flag: (name) => state.flag(name),
      legendState: (id) => state.legendState(id),
      inParty: (id) => state.has(id),
      hasHeatWard: () => state.partyHasTag('heatproof'),
      rumor: (id) => { rumorLegend(state, id); },
      activate: (id) => { activateLegend(state, id); },
      advance: (id, stage) => { advanceStage(state, id, stage); },
      give: (id, n = 1) => { state.addItem(id, n); },
      setFlag: (name, v = true) => state.setFlag(name, v),
      join: (id) => {
        const m = state.join(id);
        if (m) self.rebuildFollowers();
      },
      notice: (text) => { self.queue.push({ speaker: '', text }); },
      openShop: (id) => { self.pendingShop = id; },
      rest: (price) => { self.pendingRest = price; },
    };
  }

  talkToNpc(npc) {
    const entry = dialogueFor(npc.def.dialogue);
    const ctx = this.dialogueContext(npc);
    const branch = pickBranch(entry, ctx);
    if (!branch) return;
    const lines = branch.lines.map((l) => (typeof l === 'string'
      ? { speaker: npc.def.name, text: l }
      : { speaker: l.speaker, text: l.text }));
    this.pendingShop = null;
    this.pendingRest = null;
    this.say(lines, npc.def.name, () => {
      branch.then?.(ctx);
      // `then` may have pushed extra notices into the queue.
      if (this.queue.length) { this.talking = true; this.dialogueBox.visible = true; this.nextLine(); return; }
      this.afterDialogue();
    });
  }

  afterDialogue() {
    if (this.pendingShop) {
      const id = this.pendingShop;
      this.pendingShop = null;
      this.openShop(id);
    } else if (this.pendingRest != null) {
      const price = this.pendingRest;
      this.pendingRest = null;
      this.openRest(price);
    }
  }

  useObject(obj) {
    const { state } = this.game;
    switch (obj.kind) {
      case 'sign':
      case 'examine':
        this.say([obj.text], '');
        return;
      case 'chest': {
        if (state.chests[obj.id]) { this.say(['Empty. You already took it.'], ''); return; }
        state.chests[obj.id] = true;
        const lines = [];
        if (obj.contents.gold) {
          state.addGold(obj.contents.gold);
          lines.push(`You find [[${obj.contents.gold}]] doubloons.`);
        }
        if (obj.contents.item) {
          const n = obj.contents.count ?? 1;
          state.addItem(obj.contents.item, n);
          lines.push(`You find [[${itemName(obj.contents.item)}]]${n > 1 ? ` x${n}` : ''}.`);
        }
        this.propSprites.get(obj.id).texture = this.game.art.tex('prop:chestOpen');
        audio.play('chest');
        this.say(lines, '');
        return;
      }
      case 'legendBeacon':
      case 'legendBowl':
      case 'legendBrazier':
      case 'legendPearl':
      case 'legendLight':
        this.useLegendObject(obj);
        return;
      case 'falseLight':
        this.say([
          'The flame in this one is the wrong green — too clean, too still.',
          'It goes out as you look at it, politely, as if it had never been lit.',
        ], '');
        return;
      case 'legendElite':
        this.tryLegendFight(obj, 'elite');
        return;
      case 'legendBoss':
        this.tryLegendFight(obj, 'boss');
        return;
      case 'trench':
        this.tryTrench();
        return;
      default:
        return;
    }
  }

  useLegendObject(obj) {
    const { state } = this.game;
    const legendId = obj.legend;
    const def = LEGENDS[legendId];
    const flavor = OBJECT_FLAVOR[obj.kind];
    const rec = state.legendRecord(legendId);
    const perObject = `${obj.counter}:${obj.id}`;

    if (rec.counters[perObject]) { this.say([flavor.done], ''); return; }

    // Story gating: you should know what you are doing here first.
    if (rec.state === LEGEND_STATE.UNHEARD) {
      rumorLegend(state, legendId);
      this.say([
        `You do not know what this is for yet — but the shape of it is unmistakable.`,
        `Legend recorded: [[${def.name}]].`,
      ], '');
      return;
    }
    if (obj.kind === 'legendBeacon' && !nightGate(state, this.map)) {
      this.say(['The beacon will not take in this light. These only burn after dark.'], '');
      return;
    }
    if (obj.kind === 'legendLight' && !state.hasItem('mireLantern')) {
      this.say([
        'Without a true flame to compare it to, this lantern is just a light in a swamp.',
        'Yeva in Mireborne keeps the green glass ones.',
      ], '');
      return;
    }

    rec.counters[perObject] = 1;
    const res = bumpCounter(state, legendId, obj.counter);
    activateLegend(state, legendId);
    audio.play('confirm');

    const sprite = this.propSprites.get(obj.id);
    if (obj.filledProp) sprite.texture = this.game.art.tex(`prop:${obj.filledProp}`);
    else sprite.tint = 0xffe08a;

    const lines = [flavor.text];
    if (res.complete) {
      lines.push(flavor.complete);
      if (legendId === 'sablemanMires') {
        this.say(lines, '', () => this.smugglerAmbush());
        return;
      }
    } else {
      lines.push(`(${res.value} of ${res.of})`);
    }
    this.say(lines, '');
  }

  async smugglerAmbush() {
    const game = this.game;
    const mapId = this.mapId;
    this.say([
      'A shape unfolds from the stilt-house shadow, holding a lantern that gives no light at all.',
      'HOLLOW SMUGGLER: "He said someone would come counting. He did not say you would count right."',
    ], '', async () => {
      const { startBattle } = await import('./BattleScene.js');
      audio.play('encounter');
      await startBattle(game, {
        enemies: ['hollowSmuggler'],
        canFlee: false,
        isBoss: true,
        backdrop: 'swamp',
        music: 'boss',
        onFinish: async (outcome) => {
          const { FieldScene } = await import('./FieldScene.js');
          if (outcome === 'defeat') {
            const { GameOverScene } = await import('./GameOverScene.js');
            await game.scenes.replace(GameOverScene, {}, { fade: true });
            return;
          }
          game.state.setFlag('mires.smuggler', true);
          await game.scenes.replace(FieldScene, {
            mapId, resume: true,
            notice: 'The smuggler folds up like a dropped coat. Past him, the black stilt-house is waiting with its door open.',
          }, { fade: true });
        },
      });
    });
  }

  /** Gate-check and launch a legend's elite or boss encounter. */
  tryLegendFight(obj, kind) {
    const { state } = this.game;
    const legendId = obj.legend;
    const def = LEGENDS[legendId];
    const rec = state.legendRecord(legendId);

    if (rec.state === LEGEND_STATE.RESOLVED) {
      this.say([def.rewardText], '');
      return;
    }
    if (rec.state === LEGEND_STATE.UNHEARD) {
      rumorLegend(state, legendId);
      this.say([`You have heard nothing about this place. You are about to.`,
        `Legend recorded: [[${def.name}]].`], '');
      return;
    }

    const gate = this.legendGate(legendId, kind);
    if (gate) { this.say([gate], ''); return; }

    const enemies = kind === 'elite' ? [def.elite] : [def.boss];
    let intro = `${def.name.toUpperCase()} — ${def.region}`;
    let phase2 = null;

    if (legendId === 'stormSaint' && kind === 'boss') phase2 = [def.finalBoss];
    if (legendId === 'ironBell') {
      enemies.length = 0;
      enemies.push(...def.rematch);
      intro = 'THE IRON BELL COMPANY';
    }

    this.say(this.legendIntroLines(legendId, kind), '', () => {
      this.launchLegendBattle(legendId, kind, enemies, intro, phase2);
    });
  }

  legendGate(legendId, kind) {
    const { state } = this.game;
    const rec = state.legendRecord(legendId);
    const need = (counter, of, what) => {
      const v = counterValue(state, legendId, counter);
      return v >= of ? null : `${what} (${v}/${of})`;
    };
    switch (legendId) {
      case 'lanternGalleon':
        if (!state.isNight) return 'The wreck-line is only a wreck-line by daylight. Come back after dark.';
        return need('beacons', 3, 'The galleon will not answer until all three drowned beacons burn.');
      case 'ceibaWarden':
        return need('bowls', 3, 'The shrine will not open with its bowls empty.');
      case 'ashenCrown':
        if (kind === 'elite') return need('braziers', 3, 'The Sentinel does not stir. The tomb braziers are cold.');
        if (!state.flag('ember.sentinel')) return 'The Ashbound Sentinel stands between you and the vault door.';
        return null;
      case 'pearlWidow':
        if (kind === 'elite') return need('pearls', 3, 'The chorus keeps singing. You are missing pearls.');
        if (!state.flag('reef.chorus')) return 'The coral gate holds. Something is still singing behind it.';
        return null;
      case 'sablemanMires': {
        const lights = need('lights', 3, 'The mangrove keeps rearranging itself. Read the true lights first.');
        if (lights) return lights;
        if (!state.flag('mires.smuggler')) return 'A hollow shape blocks the stilt-house stair.';
        return null;
      }
      case 'stormSaint':
        if (!passUnlocked(state)) return 'The Pass is not finished with you yet. Four legends, at least.';
        return null;
      case 'ironBell':
        if (state.resolvedCount < 6) return 'The bell hangs silent. It is waiting for all six legends to be told.';
        return null;
      default:
        return null;
    }
    void rec;
  }

  legendIntroLines(legendId, kind) {
    const def = LEGENDS[legendId];
    if (kind === 'elite') {
      return [`Something between you and the rest of [[${def.name}]] decides it has waited long enough.`];
    }
    switch (legendId) {
      case 'lanternGalleon':
        return [
          'Three beacons burn and the shoal-fog splits like a curtain.',
          'She is enormous. Every lantern on her is lit and every lantern is underwater.',
          'HALLOWAY VANE: "You answered the light. Everyone answers the light."',
        ];
      case 'ceibaWarden':
        return [
          'The bowls are full. The ceiba puts down a root the width of a mast, and then a face.',
          'KAOBO: "Two hundred years I let you walk through. Tell me what changed and I will let you finish walking."',
        ];
      case 'ashenCrown':
        return [
          'The vault is a throat and the throat is full of light.',
          'The idol wears the king’s face because the king would not stay to wear it himself.',
        ];
      case 'pearlWidow':
        return [
          'The coral throne is a woman’s shape and a reef’s shape at the same time.',
          'THE CORAL DOWAGER: "Nine went down. I gave back nine pearls. Which of us is the thief?"',
        ];
      case 'sablemanMires':
        return [
          'He is very tall and very polite and his head is a lantern with a face cut into it.',
          'THE SABLEMAN: "Your name, Captain. Small thing. You will hardly notice."',
          'NIA: "No."',
          'THE SABLEMAN: "…Nobody says no. Say it again."',
          'NIA: "No."',
        ];
      case 'stormSaint':
        return [
          'The eye of the Pass is glass-calm and sixty years deep.',
          'She stands in the middle of it with her arms out, holding something down.',
          'SAINT MARENE: "Do not. Whatever you have come to do — do not make me let go."',
        ];
      case 'ironBell':
        return [
          'Three shadows on the trench rim, and a bell that has not stopped ringing since Marrowport.',
          'VESTREL KO: "You have been a very good year for us, Captain. Let us close the ledger."',
        ];
      default:
        return [`${def.name}.`];
    }
  }

  async launchLegendBattle(legendId, kind, enemies, intro, phase2) {
    if (this.busy) return;
    this.busy = true;
    const game = this.game;
    const mapId = this.mapId;
    const { startBattle } = await import('./BattleScene.js');
    audio.play('encounter');
    await startBattle(game, {
      enemies,
      canFlee: false,
      isBoss: true,
      backdrop: this.backdropKind(),
      music: legendId === 'stormSaint' || legendId === 'ironBell' ? 'boss' : 'boss',
      introText: intro,
      phase2,
      onFinish: async (outcome) => {
        const { FieldScene } = await import('./FieldScene.js');
        if (outcome === 'defeat') {
          const { GameOverScene } = await import('./GameOverScene.js');
          await game.scenes.replace(GameOverScene, {}, { fade: true });
          return;
        }
        await game.scenes.replace(FieldScene, {
          mapId, resume: true,
          afterBattle: { legend: legendId, kind, outcome },
        }, { fade: true });
      },
    });
  }

  async tryTrench() {
    const { state } = this.game;
    if (state.resolvedCount < 6) {
      this.say([
        'A door of standing water, and past it the trench goes down further than the Reach is wide.',
        'It will not open. Not yet. It is counting something, and it has not finished counting.',
      ], '');
      return;
    }
    if (state.legendState('ironBell') === LEGEND_STATE.RESOLVED) {
      this.say(['The trench is quiet. Whatever was owed here is settled.'], '');
      return;
    }
    rumorLegend(state, 'ironBell');
    activateLegend(state, 'ironBell');
    this.busy = true;
    const game = this.game;
    const { FieldScene } = await import('./FieldScene.js');
    this.say([
      'Six legends told. The water-door thins to a film and lets you through.',
      'Somewhere below, a bell you have been hearing since Marrowport finally stops.',
    ], '', async () => {
      await game.scenes.replace(FieldScene, { mapId: 'blackwater', tx: 11, ty: 14, dir: 'up' }, { fade: true });
    });
  }

  /* ----------------------- post-battle resolution ------------------- */

  handleAfterBattle({ legend: legendId, kind, outcome }) {
    const { state } = this.game;
    const def = LEGENDS[legendId];

    if (kind === 'elite') {
      if (legendId === 'ashenCrown') state.setFlag('ember.sentinel', true);
      if (legendId === 'pearlWidow') state.setFlag('reef.chorus', true);
      this.say(['The way is open.'], '');
      return;
    }

    // The Dowager yields rather than dying, which is what makes her branch work.
    if (legendId === 'pearlWidow') {
      const lines = outcome === 'yield'
        ? [
          'She stops. Not beaten — decided.',
          'THE CORAL DOWAGER: "You carry nine pearls that are not yours. Say what you mean to do with them."',
        ]
        : ['The coral throne cracks down its centre. She looks almost relieved.'];
      this.say(lines, '', () => this.offerBranch(legendId));
      return;
    }

    if (def.branches?.length) {
      this.say([def.rewardText], '', () => this.offerBranch(legendId));
      return;
    }

    if (legendId === 'stormSaint') {
      this.finishStormSaint();
      return;
    }

    this.say([def.rewardText], '', () => this.completeLegend(legendId, null));
  }

  offerBranch(legendId) {
    const def = LEGENDS[legendId];
    const items = def.branches.map((b) => ({
      label: b.label,
      right: '',
      value: b.id,
      blurb: b.blurb,
    }));
    this.openChoice(def.name, items, (item) => {
      this.closeOverlay();
      this.completeLegend(legendId, item.value);
    });
  }

  completeLegend(legendId, branchId) {
    const { state } = this.game;
    const { notices, branch } = resolveLegend(state, legendId, branchId);
    audio.fanfare('victory');
    const lines = [];
    if (branch) lines.push(branch.text);
    lines.push(...notices);
    lines.push(LEGENDS[legendId].worldChange);
    if (state.resolvedCount >= 4 && !state.flag('ship.stormSail')) {
      lines.push('Four legends told. The harbourmaster at Marrowport will want to see you.');
    }
    this.say(lines, '', () => {
      this.refreshProps();
      if (legendId === 'ironBell') state.setFlag('ironbell.settled', true);
    });
  }

  async finishStormSaint() {
    const { state } = this.game;
    resolveLegend(state, 'stormSaint', null);
    state.setFlag('game.cleared', true);
    const game = this.game;
    this.say([
      'The wind stops.',
      'It has not stopped here in sixty years, and the silence is so enormous that Rook sits down on the deck.',
      'SAINT MARENE: "…Oh. Oh, it is quiet."',
    ], '', async () => {
      const { EndingScene } = await import('./EndingScene.js');
      await game.scenes.replace(EndingScene, {}, { fade: true, outMS: 800, inMS: 900 });
    });
  }

  refreshProps() {
    for (const obj of this.map.objects) {
      const s = this.propSprites.get(obj.id);
      if (s) s.texture = this.game.art.tex(`prop:${this.propTexture(obj)}`);
    }
  }

  rebuildFollowers() {
    for (const f of this.followers) {
      this.entityLayer.removeChild(f.sprite);
      f.sprite.destroy();
    }
    this.followers = this.game.state.party.slice(1).map((m) => {
      const s = new Sprite(this.game.art.actor(m.style, this.player.dir, 0));
      s.x = this.player.tx * TILE;
      s.y = this.player.ty * TILE;
      this.entityLayer.addChild(s);
      return { sprite: s, member: m };
    });
  }

  /* ---------------------------- dialogue --------------------------- */

  /**
   * The on-screen controls follow the field's state: a conversation turns the
   * whole screen into "tap to advance", a choice hands over to its menu, and
   * otherwise the stick and buttons are back.
   */
  syncScheme() {
    if (this.choiceUI) this.setControlScheme('menu');
    else if (this.talking) this.setControlScheme('tap');
    else this.setControlScheme('field');
  }

  say(lines, speaker = '', done = null) {
    const normalized = lines.filter(Boolean).map((l) => (typeof l === 'string' ? { speaker, text: l } : l));
    this.queue.push(...normalized);
    this.onDialogueDone = done;
    this.talking = true;
    this.dialogueBox.visible = true;
    this.syncScheme();
    this.nextLine();
  }

  nextLine() {
    const next = this.queue.shift();
    if (!next) {
      this.talking = false;
      this.dialogueBox.visible = false;
      this.syncScheme();
      const cb = this.onDialogueDone;
      this.onDialogueDone = null;
      if (cb) cb();
      else this.afterDialogue();
      return;
    }
    this.dialogueBox.show(next.text, next.speaker);
  }

  /* ----------------------------- windows --------------------------- */

  openChoice(title, items, onSelect) {
    this.closeOverlay();
    const { width, height } = this.game;
    const w = 250;
    const rowH = 12;
    const h = items.length * rowH + 34;
    const c = new Container();
    const shade = new Graphics();
    shade.rect(0, 0, width, height).fill({ color: 0x000000, alpha: 0.5 });
    c.addChild(shade);
    const panel = new Panel(w, h, { title });
    panel.x = Math.round((width - w) / 2);
    panel.y = Math.round((height - h) / 2) - 10;
    c.addChild(panel);

    const blurb = new PixelText({ text: items[0]?.blurb ?? '', color: UI.dim, maxWidth: w - 16 });
    blurb.x = panel.x + 8;
    blurb.y = panel.y + h - 20;
    c.addChild(blurb);

    const menu = new MenuList({
      items, width: w - 14, rows: items.length, rowHeight: rowH,
      onSelect,
      onMove: (item) => { blurb.text = item?.blurb ?? ''; },
    });
    menu.x = panel.x + 7;
    menu.y = panel.y + 12;
    c.addChild(menu);

    this.choiceUI = { root: c, menu };
    this.addChild(c);
    this.syncScheme();
  }

  closeOverlay() {
    if (!this.choiceUI) return;
    this.removeChild(this.choiceUI.root);
    this.choiceUI.root.destroy({ children: true });
    this.choiceUI = null;
    this.syncScheme();
  }

  async openShop(shopId) {
    if (this.busy) return;
    this.busy = true;
    const { ShopScene } = await import('./ShopScene.js');
    await this.game.scenes.push(ShopScene, { shopId });
    this.busy = false;
  }

  openRest(price) {
    const { state } = this.game;
    if (state.gold < price) {
      this.say([`That is ${price} coin, Captain, and you are carrying ${state.gold}.`], '');
      return;
    }
    const items = [
      { label: `Sleep until morning  (${price}c)`, value: 'morning' },
      { label: `Wait for nightfall  (${price}c)`, value: 'night' },
      { label: 'Not just now', value: 'no' },
    ];
    this.openChoice('Rest', items, (item) => {
      this.closeOverlay();
      if (item.value === 'no') return;
      state.spendGold(price);
      state.restAll();
      state.setHour(item.value === 'morning' ? 7 : 20);
      this.applyTint();
      audio.play('heal');
      this.autosave();
      this.say([
        item.value === 'morning'
          ? 'You sleep badly and wake better. The crew is whole again.'
          : 'You wait out the daylight. By the time you step outside the lanterns are lit.',
        'Voyage saved to Log 1.',
      ], '');
    });
  }

  autosave() {
    const { state } = this.game;
    state.playTimeMs += performance.now() - this.game.sessionStart;
    this.game.sessionStart = performance.now();
    saveGame(0, state.toJSON(), state.saveMeta());
  }

  async openMenu(tab = 'party') {
    if (this.busy) return;
    this.busy = true;
    const { MenuScene } = await import('./MenuScene.js');
    await this.game.scenes.push(MenuScene, { tab });
    this.busy = false;
  }

  onResume() {
    // Party may have changed (equipment, revives) while a window was open.
    this.rebuildFollowers();
    this.playerSprite.texture = this.game.art.actor(this.leaderStyle, this.player.dir, 0);
    this.applyTint();
    audio.playTheme(musicFor(this.game.state, this.map));
  }

  /* ------------------------------ loop ----------------------------- */

  update(dtMS) {
    this.t += dtMS;

    const frame = Math.floor(this.t / 300) % 6;
    if (frame !== this.animFrame) { this.animFrame = frame; this.updateAnimTiles(); }

    this.updateWeather(dtMS);
    this.updateNpcs(dtMS);

    if (this.bannerTime > 0) {
      this.bannerTime -= dtMS;
      if (this.bannerTime < 600) this.banner.alpha = Math.max(0, this.bannerTime / 600);
      if (this.bannerTime <= 0) this.banner.visible = false;
    }
    this.clockText.text = `${this.game.state.timeLabel} d${this.game.state.day}`;

    // The view must keep up even while a window or a conversation is open.
    this.updateCamera();
    this.refreshTiles();

    if (this.choiceUI) {
      this.choiceUI.menu.update(dtMS);
      this.choiceUI.menu.handleInput(input);
      return;
    }

    if (this.talking) {
      this.dialogueBox.update(dtMS);
      if (input.justPressed('confirm') || input.justPressed('cancel')) {
        if (this.dialogueBox.advance()) this.nextLine();
      }
      this.updatePlayerSprite(dtMS, false);
      return;
    }

    if (this.busy) return;

    // Movement.
    if (this.player.moving) {
      this.player.moveT += dtMS / this.player.duration;
      if (this.player.moveT >= 1) {
        this.player.moveT = 1;
        this.player.moving = false;
        this.onArrive();
      }
    }
    if (!this.player.moving && !this.busy && !this.talking) {
      const running = input.isDown('run');
      if (input.isDown('up')) this.tryMove(0, -1, running);
      else if (input.isDown('down')) this.tryMove(0, 1, running);
      else if (input.isDown('left')) this.tryMove(-1, 0, running);
      else if (input.isDown('right')) this.tryMove(1, 0, running);
    }

    this.updatePlayerSprite(dtMS, this.player.moving);

    if (input.justPressed('confirm')) this.interact();
    if (input.justPressed('menu') || input.justPressed('cancel')) this.openMenu('party');
    if (input.justPressed('journal')) this.openMenu('journal');
    if (input.justPressed('help')) this.openMenu('help');
  }

  updatePlayerSprite(dtMS, moving) {
    const p = this.player;
    if (moving) {
      p.animT += dtMS;
      if (p.animT > 120) { p.animT = 0; p.frame = (p.frame + 1) % ACTOR_FRAMES; }
    } else {
      p.frame = 0;
    }
    this.playerSprite.texture = this.game.art.actor(this.leaderStyle, p.dir, p.frame);
    const px = this.playerPixel();
    this.playerSprite.x = Math.round(px.x);
    this.playerSprite.y = Math.round(px.y);
    this.playerSprite.zIndex = this.playerSprite.y + 8;

    // Followers trail a few steps behind, single file.
    for (let i = 0; i < this.followers.length; i++) {
      const f = this.followers[i];
      const node = this.trail[i] ?? { x: p.tx, y: p.ty, dir: p.dir };
      const target = { x: node.x * TILE, y: node.y * TILE };
      f.sprite.x += (target.x - f.sprite.x) * Math.min(1, dtMS / 90);
      f.sprite.y += (target.y - f.sprite.y) * Math.min(1, dtMS / 90);
      f.sprite.zIndex = f.sprite.y + 7 - i;
      const dx = target.x - f.sprite.x;
      const dy = target.y - f.sprite.y;
      let dir = node.dir ?? p.dir;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
        dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
        f.frame = ((f.frame ?? 0) + (dtMS > 0 ? 0 : 0));
      }
      f.animT = (f.animT ?? 0) + dtMS;
      if (f.animT > 140) { f.animT = 0; f.walk = f.walk === 1 ? 2 : 1; }
      const walking = Math.abs(dx) > 1 || Math.abs(dy) > 1;
      f.sprite.texture = this.game.art.actor(f.member.style, dir, walking ? (f.walk ?? 1) : 0);
    }
  }

  updateNpcs(dtMS) {
    for (const n of this.npcs) {
      if (n.moving) {
        n.moveT += dtMS / 260;
        if (n.moveT >= 1) { n.moveT = 1; n.moving = false; }
        const x = (n.fromX + (n.tx - n.fromX) * n.moveT) * TILE;
        const y = (n.fromY + (n.ty - n.fromY) * n.moveT) * TILE;
        n.sprite.x = Math.round(x);
        n.sprite.y = Math.round(y);
        n.animT += dtMS;
        if (n.animT > 140) { n.animT = 0; n.frame = (n.frame + 1) % ACTOR_FRAMES; }
        n.sprite.texture = this.game.art.actor(n.def.style, n.dir, n.frame);
      } else {
        n.sprite.texture = this.game.art.actor(n.def.style, n.dir, 0);
      }
      n.sprite.zIndex = n.sprite.y + 8;

      if (!n.def.wander || this.talking) continue;
      n.wanderT -= dtMS;
      if (n.wanderT <= 0 && !n.moving) {
        n.wanderT = 1800 + rng() * 2600;
        const dirs = [[0, -1, 'up'], [0, 1, 'down'], [-1, 0, 'left'], [1, 0, 'right']];
        const [dx, dy, dir] = dirs[rng.int(4)];
        const nx = n.tx + dx;
        const ny = n.ty + dy;
        n.dir = dir;
        const withinHome = Math.abs(nx - n.homeX) <= 2 && Math.abs(ny - n.homeY) <= 2;
        const free = this.passable(nx, ny) && !(nx === this.player.tx && ny === this.player.ty);
        if (withinHome && free) {
          n.fromX = n.tx; n.fromY = n.ty;
          n.tx = nx; n.ty = ny;
          n.moveT = 0; n.moving = true;
        }
      }
    }
  }
}

export { measure };
