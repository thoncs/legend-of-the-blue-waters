/**
 * The sea layer: sail the Salt Wren between islands, put in at ports, and
 * read the chart overlay for legend progress.
 */
import { Container, Graphics, Sprite } from 'pixi.js';
import { Scene } from '../core/scene.js';
import { PixelText, measure } from '../core/font.js';
import { Panel, UI, MenuList } from '../core/ui.js';
import { input } from '../core/input.js';
import { audio } from '../core/audio.js';
import { rng } from '../core/rng.js';
import { buildSeaChart, TILE_DEFS, SEA_CHART } from '../data/maps.js';
import { LEGENDS, LEGEND_STATE } from '../data/legends.js';
import { portsFor } from '../systems/worldstate.js';
import { objectiveText, rumorLegend, activateLegend, advanceStage } from '../systems/quests.js';
import { TILE } from '../core/art.js';

const SAIL_MS = 118;
const FULL_SAIL_MS = 74;

export class SeaChartScene extends Scene {
  onEnter(params = {}) {
    this.controlScheme = 'sea';
    const { width, height, art, state } = this.game;
    this.chart = buildSeaChart();
    this.params = params;

    this.world = new Container();
    this.addChild(this.world);
    this.tileLayer = new Container();
    this.markerLayer = new Container();
    this.shipLayer = new Container();
    this.world.addChild(this.tileLayer, this.markerLayer, this.shipLayer);

    this.viewCols = Math.ceil(width / TILE) + 2;
    this.viewRows = Math.ceil(height / TILE) + 2;
    this.tilePool = [];
    this.animTiles = [];
    for (let i = 0; i < this.viewCols * this.viewRows; i++) {
      const s = new Sprite(art.tex('tile:water0'));
      this.tileLayer.addChild(s);
      this.tilePool.push(s);
    }
    this.tileOrigin = { x: -999, y: -999 };
    this.animFrame = 0;

    // Port markers.
    this.ports = portsFor(state);
    this.portSprites = [];
    for (const port of this.ports) {
      const holder = new Container();
      const flag = new Graphics();
      flag.rect(7, 2, 2, 12).fill(0x6b452b);
      flag.poly([9, 2, 16, 5, 9, 8]).fill(port.open ? UI.accent : 0x7a5f5f);
      flag.rect(4, 13, 8, 2).fill(0x4a4038);
      holder.addChild(flag);
      holder.x = port.x * TILE;
      holder.y = port.y * TILE;
      this.markerLayer.addChild(holder);
      this.portSprites.push({ port, holder });
    }

    // Ship.
    this.shipTier = state.flag('ship.stormSail') ? 2 : state.flag('curse.lifted') ? 1 : 0;
    state.ship.tier = this.shipTier;
    const startPort = this.ports.find((p) => p.id === (params.from ?? state.lastPort));
    if (startPort) { state.ship.x = startPort.x; state.ship.y = startPort.y; }
    this.ship = {
      tx: state.ship.x, ty: state.ship.y, dir: 'down',
      fromX: state.ship.x, fromY: state.ship.y, moveT: 1, moving: false,
    };
    this.shipSprite = new Sprite(art.ship(this.shipTier, 'down'));
    this.shipLayer.addChild(this.shipSprite);

    this.wake = [];
    for (let i = 0; i < 10; i++) {
      const s = new Sprite(art.tex('fx:dot'));
      s.tint = 0xdff0ff;
      s.alpha = 0;
      this.shipLayer.addChild(s);
      this.wake.push({ s, life: 0 });
    }

    // HUD.
    this.hud = new Container();
    this.addChild(this.hud);

    this.namePanel = new Panel(10, 16);
    this.namePanel.x = 4;
    this.namePanel.y = 4;
    this.nameText = new PixelText({ text: '', color: UI.accent });
    this.nameText.x = 10;
    this.nameText.y = 8;
    this.hud.addChild(this.namePanel, this.nameText);

    this.tipPanel = new Panel(width - 8, 16);
    this.tipPanel.x = 4;
    this.tipPanel.y = height - 20;
    this.tipText = new PixelText({ text: '', color: UI.ink });
    this.tipText.x = 10;
    this.tipText.y = height - 16;
    this.hud.addChild(this.tipPanel, this.tipText);

    this.legendCount = new PixelText({ text: '', color: UI.dim });
    this.legendCount.y = 8;
    this.hud.addChild(this.legendCount);

    this.chartOverlay = null;
    this.noticeTimer = 0;
    if (params.notice) {
      this.tipText.text = params.notice;
      this.tipText.color = UI.accent;
      this.noticeTimer = 5200;
    }
    this.stepsSince = 0;
    this.threshold = 8 + rng.int(10);
    this.busy = false;
    this.t = 0;

    audio.playTheme('sea');
    this.setName(SEA_CHART.name);
    this.updateCamera();
    this.refreshTiles(true);
    this.updateTip();

    state.position = { map: 'SEA', x: this.ship.tx, y: this.ship.ty, dir: 'down' };
  }

  onExit() {
    const { state } = this.game;
    state.ship.x = this.ship.tx;
    state.ship.y = this.ship.ty;
  }

  setName(text) {
    this.nameText.text = text;
    this.namePanel.resize(this.nameText.textWidth + 12, 16);
  }

  /* ---------------------------- rendering ---------------------------- */

  refreshTiles(force = false) {
    const originX = Math.floor(this.camX / TILE);
    const originY = Math.floor(this.camY / TILE);
    if (!force && originX === this.tileOrigin.x && originY === this.tileOrigin.y) return;
    this.tileOrigin = { x: originX, y: originY };
    this.animTiles.length = 0;
    const { art } = this.game;
    const { w, h, chars } = this.chart;
    let i = 0;
    for (let row = 0; row < this.viewRows; row++) {
      for (let col = 0; col < this.viewCols; col++) {
        const s = this.tilePool[i++];
        const tx = originX + col;
        const ty = originY + row;
        s.x = tx * TILE;
        s.y = ty * TILE;
        if (tx < 0 || ty < 0 || tx >= w || ty >= h) { s.visible = false; continue; }
        s.visible = true;
        const ch = chars[ty * w + tx];
        const def = TILE_DEFS[ch];
        if (def?.anim) {
          s.texture = art.tex(`tile:${def.anim[this.animFrame % def.anim.length]}`);
          this.animTiles.push({ sprite: s, frames: def.anim });
        } else {
          s.texture = art.tex(`tile:${def?.tex ?? 'water0'}`);
        }
      }
    }
  }

  get camX() { return this._camX ?? 0; }
  get camY() { return this._camY ?? 0; }

  shipPixel() {
    const t = Math.min(1, this.ship.moveT);
    return {
      x: (this.ship.fromX + (this.ship.tx - this.ship.fromX) * t) * TILE,
      y: (this.ship.fromY + (this.ship.ty - this.ship.fromY) * t) * TILE,
    };
  }

  updateCamera() {
    const { width, height } = this.game;
    const mapW = this.chart.w * TILE;
    const mapH = this.chart.h * TILE;
    const p = this.shipPixel();
    let cx = p.x + TILE / 2 - width / 2;
    let cy = p.y + TILE / 2 - height / 2;
    cx = Math.max(0, Math.min(cx, mapW - width));
    cy = Math.max(0, Math.min(cy, mapH - height));
    this._camX = cx;
    this._camY = cy;
    this.world.x = -Math.round(cx);
    this.world.y = -Math.round(cy);
  }

  /* ---------------------------- movement ----------------------------- */

  passable(x, y) {
    const { w, h, solid } = this.chart;
    if (x < 0 || y < 0 || x >= w || y >= h) return false;
    return !solid[y * w + x];
  }

  portAt(x, y) {
    return this.ports.find((p) => p.x === x && p.y === y) ?? null;
  }

  nearbyPort() {
    const dirs = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [dx, dy] of dirs) {
      const p = this.portAt(this.ship.tx + dx, this.ship.ty + dy);
      if (p) return p;
    }
    return null;
  }

  tryMove(dx, dy, fast) {
    const dir = dx < 0 ? 'left' : dx > 0 ? 'right' : dy < 0 ? 'up' : 'down';
    this.ship.dir = dir;
    const nx = this.ship.tx + dx;
    const ny = this.ship.ty + dy;
    if (!this.passable(nx, ny)) return false;
    this.ship.fromX = this.ship.tx;
    this.ship.fromY = this.ship.ty;
    this.ship.tx = nx;
    this.ship.ty = ny;
    this.ship.moveT = 0;
    this.ship.moving = true;
    this.ship.duration = fast ? FULL_SAIL_MS : SAIL_MS;
    this.spawnWake();
    return true;
  }

  spawnWake() {
    const p = this.shipPixel();
    const w = this.wake.find((k) => k.life <= 0);
    if (!w) return;
    w.life = 700;
    w.s.x = p.x + 8 + (rng() - 0.5) * 6;
    w.s.y = p.y + 13;
    w.s.alpha = 0.8;
  }

  onArrive() {
    const { state } = this.game;
    state.advanceStep();
    state.ship.x = this.ship.tx;
    state.ship.y = this.ship.ty;
    state.position = { map: 'SEA', x: this.ship.tx, y: this.ship.ty, dir: this.ship.dir };

    const port = this.nearbyPort();
    if (port && !state.discovered[port.id]) {
      state.discovered[port.id] = true;
      audio.play('confirm');
    }
    this.updateTip();
    if (this.maybeAmbush()) return;
    this.rollEncounter();
  }

  /**
   * The Iron Bell Company has been three days behind you since Marrowport.
   * Once two legends are told they stop being behind you.
   */
  maybeAmbush() {
    const { state } = this.game;
    if (state.flag('ironbell.ambushed')) return false;
    if (state.resolvedCount < 2) return false;
    if (this.nearbyPort() || this.stepsSince < 5) return false;
    state.setFlag('ironbell.ambushed', true);
    rumorLegend(state, 'ironBell');
    activateLegend(state, 'ironBell');
    advanceStage(state, 'ironBell', 'answer');
    this.startAmbush();
    return true;
  }

  async startAmbush() {
    if (this.busy) return;
    this.busy = true;
    audio.play('encounter');
    const game = this.game;
    const { startBattle } = await import('./BattleScene.js');
    await startBattle(game, {
      enemies: ['vestrelKo', 'mardaQuill', 'grinBellows'],
      canFlee: true,
      isBoss: true,
      backdrop: 'shore',
      music: 'boss',
      introText: 'A black cutter comes out of the squall with an iron bell on the flag.',
      onFinish: async (outcome) => {
        if (outcome === 'defeat') {
          const { GameOverScene } = await import('./GameOverScene.js');
          await game.scenes.replace(GameOverScene, {}, { fade: true });
          return;
        }
        const notice = outcome === 'escaped'
          ? 'You lose them in the squall. The bell keeps ringing behind you.'
          : 'They break off and run. Vestrel Ko does not look angry. She looks like she is writing something down.';
        const { SeaChartScene: Self } = await import('./SeaChartScene.js');
        await game.scenes.replace(Self, { notice }, { fade: true });
      },
    });
  }

  updateTip() {
    const { state } = this.game;
    this.legendCount.text = `legends ${state.resolvedCount}/6`;
    this.legendCount.x = this.game.width - 6 - this.legendCount.textWidth;
    // A one-off message (battle aftermath) holds the line for a few seconds.
    if (this.noticeTimer > 0) return;
    const port = this.nearbyPort();
    if (port) {
      if (!port.open) {
        this.tipText.text = `${port.label} — ${port.reason ?? 'closed'}`;
        this.tipText.color = UI.bad;
      } else {
        const suffix = port.legendName
          ? `  ·  ${port.legendName}${port.legendState === LEGEND_STATE.RESOLVED ? ' (told)' : ''}`
          : '';
        this.tipText.text = `Z — put in at ${port.label}${suffix}`;
        this.tipText.color = UI.accent;
      }
      this.setName(port.label);
    } else {
      this.tipText.text = 'Arrows steer · Shift full sail · M chart · Z put in';
      this.tipText.color = UI.dim;
      this.setName(SEA_CHART.name);
    }
  }

  rollEncounter() {
    const { state } = this.game;
    this.stepsSince++;
    if (this.stepsSince < this.threshold) return;
    const zone = SEA_CHART.danger.find((d) =>
      this.ship.tx >= d.x0 && this.ship.tx <= d.x1 && this.ship.ty >= d.y0 && this.ship.ty <= d.y1);
    if (!zone) return;
    if (zone.flag && state.flag(zone.flag)) return;
    if (rng() > SEA_CHART.encounterRate * 22) return;
    this.stepsSince = 0;
    this.threshold = 8 + rng.int(10);
    this.startEncounter(rng.weighted(zone.groups).members);
  }

  async startEncounter(members) {
    if (this.busy) return;
    this.busy = true;
    audio.play('encounter');
    const game = this.game;
    const { startBattle } = await import('./BattleScene.js');
    await startBattle(game, {
      enemies: members,
      canFlee: true,
      backdrop: 'shore',
      music: 'battle',
      introText: 'Something comes up alongside.',
      onFinish: async (outcome) => {
        if (outcome === 'defeat') {
          const { GameOverScene } = await import('./GameOverScene.js');
          await game.scenes.replace(GameOverScene, {}, { fade: true });
          return;
        }
        const { SeaChartScene: Self } = await import('./SeaChartScene.js');
        await game.scenes.replace(Self, {}, { fade: true, outMS: 200, inMS: 240 });
      },
    });
  }

  async putIn() {
    const port = this.nearbyPort();
    if (!port) return;
    if (!port.open) { audio.play('deny'); return; }
    this.busy = true;
    const { state } = this.game;
    state.discovered[port.id] = true;
    state.lastPort = port.id;
    state.ship.x = port.x;
    state.ship.y = port.y;
    audio.play('sail');
    const { FieldScene } = await import('./FieldScene.js');
    await this.game.scenes.replace(FieldScene, { mapId: port.map }, { fade: true });
  }

  /* ------------------------- chart overlay --------------------------- */

  toggleChart() {
    if (this.chartOverlay) { this.closeChart(); return; }
    const { width, height, state } = this.game;
    const c = new Container();
    const shade = new Graphics();
    shade.rect(0, 0, width, height).fill({ color: 0x050c14, alpha: 0.9 });
    c.addChild(shade);

    const panel = new Panel(width - 12, height - 12, { title: 'THE SUNDER REACH' });
    panel.x = 6;
    panel.y = 6;
    c.addChild(panel);

    // Mini map, three pixels per tile.
    const mini = new Graphics();
    const scale = 3;
    const mx = 12;
    const my = 22;
    mini.rect(mx - 2, my - 2, this.chart.w * scale + 4, this.chart.h * scale + 4).fill(0x081420);
    mini.rect(mx - 2, my - 2, this.chart.w * scale + 4, this.chart.h * scale + 4)
      .stroke({ color: UI.frameDim, width: 1, alignment: 0 });
    for (let y = 0; y < this.chart.h; y++) {
      for (let x = 0; x < this.chart.w; x++) {
        const solid = this.chart.solid[y * this.chart.w + x];
        const ch = this.chart.chars[y * this.chart.w + x];
        let color = solid ? 0x4f7a44 : 0x14364e;
        if (!solid && ch === '~') color = 0x1d5675;
        if (ch === 'l' || ch === 'L') color = 0x7a3a24;
        if (ch === ':') color = 0x6e8399;
        if (ch === 'G') color = 0x3a5a44;
        if (ch === '%') color = 0x6b7079;
        mini.rect(mx + x * scale, my + y * scale, scale, scale).fill(color);
      }
    }
    mini.rect(mx + this.ship.tx * scale - 2, my + this.ship.ty * scale - 2, 5, 5).fill(0x000000);
    mini.rect(mx + this.ship.tx * scale - 1, my + this.ship.ty * scale - 1, 3, 3).fill(UI.accent);
    c.addChild(mini);

    const youAre = new PixelText({ text: '★ the Salt Wren', color: UI.accent });
    youAre.x = mx;
    youAre.y = my + this.chart.h * scale + 6;
    c.addChild(youAre);

    // Port pins + legend status list.
    const listX = mx + this.chart.w * scale + 12;
    let ly = my;
    const known = state.knownLegends.sort((a, b) => LEGENDS[a].order - LEGENDS[b].order);
    const title = new PixelText({ text: 'LEGENDS', color: UI.accent });
    title.x = listX; title.y = ly;
    c.addChild(title);
    ly += 12;
    if (!known.length) {
      const none = new PixelText({ text: 'No legends heard yet.\nAsk in Marrowport.', color: UI.dim, maxWidth: width - listX - 16 });
      none.x = listX; none.y = ly;
      c.addChild(none);
    }
    for (const id of known) {
      const def = LEGENDS[id];
      const st = state.legendState(id);
      const mark = st === LEGEND_STATE.RESOLVED ? '★' : st === LEGEND_STATE.ACTIVE ? '▶' : '·';
      const t = new PixelText({
        text: `${mark} ${def.name}`,
        color: st === LEGEND_STATE.RESOLVED ? UI.good : UI.ink,
      });
      t.x = listX; t.y = ly;
      c.addChild(t);
      ly += 9;
      const o = new PixelText({
        text: objectiveText(state, id),
        color: UI.dim,
        maxWidth: width - listX - 16,
      });
      o.x = listX + 6; o.y = ly;
      c.addChild(o);
      ly += Math.max(10, o.textHeight + 3);
      if (ly > height - 30) break;
    }

    for (const p of this.ports) {
      if (!state.discovered[p.id]) continue;
      const pin = new Graphics();
      pin.rect(mx + p.x * scale - 1, my + p.y * scale - 1, 3, 3).fill(p.open ? 0xffd45e : 0x9a6a6a);
      c.addChild(pin);
      const label = new PixelText({ text: p.label, color: UI.dim });
      label.x = mx + p.x * scale + 5;
      label.y = my + p.y * scale - 4;
      // Keep labels inside the chart box; flip left when they would run out.
      if (label.x + label.textWidth > listX - 8) label.x = mx + p.x * scale - 5 - label.textWidth;
      if (label.x > mx - 2) c.addChild(label);
    }

    const hint = new PixelText({ text: 'M or X to close', color: UI.dim });
    hint.x = 12;
    hint.y = height - 16;
    c.addChild(hint);

    this.chartOverlay = c;
    this.addChild(c);
    audio.play('confirm');
  }

  closeChart() {
    if (!this.chartOverlay) return;
    this.removeChild(this.chartOverlay);
    this.chartOverlay.destroy({ children: true });
    this.chartOverlay = null;
  }

  async openMenu(tab) {
    if (this.busy) return;
    this.busy = true;
    const { MenuScene } = await import('./MenuScene.js');
    await this.game.scenes.push(MenuScene, { tab });
    this.busy = false;
  }

  onResume() {
    audio.playTheme('sea');
    this.busy = false;
  }

  /* ------------------------------- loop ------------------------------ */

  update(dtMS) {
    this.t += dtMS;
    if (this.noticeTimer > 0) {
      this.noticeTimer -= dtMS;
      if (this.noticeTimer <= 0) this.updateTip();
    }
    const frame = Math.floor(this.t / 300) % 6;
    if (frame !== this.animFrame) {
      this.animFrame = frame;
      const { art } = this.game;
      for (const { sprite, frames } of this.animTiles) {
        sprite.texture = art.tex(`tile:${frames[this.animFrame % frames.length]}`);
      }
    }

    // Port flags flutter.
    for (const { holder } of this.portSprites) {
      holder.y = holder.y; // markers stay put; the flutter is in the ship
    }

    for (const w of this.wake) {
      if (w.life <= 0) continue;
      w.life -= dtMS;
      w.s.alpha = Math.max(0, w.life / 700) * 0.8;
      w.s.y += dtMS * 0.004;
    }

    if (this.chartOverlay) {
      if (input.justPressed('chart') || input.justPressed('cancel') || input.justPressed('confirm')) {
        this.closeChart();
      }
      return;
    }

    if (this.busy) return;

    if (this.ship.moving) {
      this.ship.moveT += dtMS / this.ship.duration;
      if (this.ship.moveT >= 1) {
        this.ship.moveT = 1;
        this.ship.moving = false;
        this.onArrive();
      } else if (this.ship.moveT > 0.5 && !this._wakeMid) {
        this._wakeMid = true;
        this.spawnWake();
      }
    }
    if (!this.ship.moving) {
      this._wakeMid = false;
      const fast = input.isDown('run');
      if (input.isDown('up')) this.tryMove(0, -1, fast);
      else if (input.isDown('down')) this.tryMove(0, 1, fast);
      else if (input.isDown('left')) this.tryMove(-1, 0, fast);
      else if (input.isDown('right')) this.tryMove(1, 0, fast);
    }

    const p = this.shipPixel();
    this.shipSprite.texture = this.game.art.ship(this.shipTier, this.ship.dir);
    this.shipSprite.x = Math.round(p.x);
    this.shipSprite.y = Math.round(p.y + Math.sin(this.t / 420) * 1.2);

    this.updateCamera();
    this.refreshTiles();

    if (input.justPressed('confirm')) this.putIn();
    if (input.justPressed('chart')) this.toggleChart();
    if (input.justPressed('menu') || input.justPressed('cancel')) this.openMenu('party');
    if (input.justPressed('journal')) this.openMenu('journal');
  }
}

export { MenuList, measure };
