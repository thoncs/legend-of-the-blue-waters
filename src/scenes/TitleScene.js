/**
 * Title screen: moonlit sea, the Salt Wren riding it, and the main menu.
 */
import { Container, Graphics, Sprite } from 'pixi.js';
import { Scene } from '../core/scene.js';
import { PixelText, measure } from '../core/font.js';
import { MenuList, Panel, UI, Blinker } from '../core/ui.js';
import { CONTROL_HELP, input } from '../core/input.js';
import { audio } from '../core/audio.js';
import { slotSummaries, loadGame, formatPlayTime, deleteSlot } from '../core/save.js';
import { rng } from '../core/rng.js';

export class TitleScene extends Scene {
  onEnter() {
    this.controlScheme = 'menu';
    const { width, height, art } = this.game;

    this.sky = new Graphics();
    this.addChild(this.sky);
    const bands = [
      [0x0a1526, 0], [0x102340, 34], [0x1b3358, 58], [0x2b4a72, 74],
      [0x476a90, 86], [0x6a89a8, 96],
    ];
    for (let i = 0; i < bands.length; i++) {
      const [color, y] = bands[i];
      const next = bands[i + 1]?.[1] ?? 108;
      this.sky.rect(0, y, width, next - y).fill(color);
    }

    // Stars, thinning toward the horizon.
    this.stars = new Container();
    this.addChild(this.stars);
    for (let i = 0; i < 70; i++) {
      const s = new Sprite(art.tex('fx:dot'));
      s.x = Math.floor(rng() * width);
      s.y = Math.floor(Math.pow(rng(), 1.8) * 92);
      s.alpha = 0.25 + rng() * 0.75;
      s.tint = rng() < 0.15 ? 0xffe6a8 : 0xdff0ff;
      this.stars.addChild(s);
    }

    // Moon with a soft halo.
    const moon = new Graphics();
    moon.circle(348, 20, 15).fill({ color: 0xdfefff, alpha: 0.09 });
    moon.circle(348, 20, 10).fill({ color: 0xdfefff, alpha: 0.15 });
    moon.circle(348, 20, 7).fill(0xe8f4ff);
    moon.circle(345, 17, 2).fill({ color: 0xc4d8ea, alpha: 0.7 });
    moon.circle(351, 23, 1).fill({ color: 0xc4d8ea, alpha: 0.6 });
    this.addChild(moon);

    // Distant island silhouettes.
    const land = new Graphics();
    land.poly([0, 108, 26, 92, 44, 100, 70, 86, 96, 104, 120, 108]).fill(0x0d1b2a);
    land.poly([250, 108, 272, 90, 296, 98, 320, 84, 350, 102, 384, 96, 384, 108]).fill(0x0d1b2a);
    this.addChild(land);

    // Sea: rows of animated moonlit water.
    this.sea = new Container();
    this.sea.y = 104;
    this.addChild(this.sea);
    this.waterSprites = [];
    for (let row = 0; row < 8; row++) {
      for (let col = -1; col < width / 16 + 1; col++) {
        const s = new Sprite(art.tex('tile:moonsea0'));
        s.x = col * 16;
        s.y = row * 16;
        s.tint = row < 2 ? 0x8fa8c8 : 0xffffff;
        this.sea.addChild(s);
        this.waterSprites.push(s);
      }
    }

    // Glitter path under the moon.
    this.glitter = new Container();
    this.glitter.y = 104;
    this.addChild(this.glitter);
    for (let i = 0; i < 40; i++) {
      const g = new Sprite(art.tex('fx:dot'));
      g.x = 344 + Math.round((rng() - 0.5) * 42);
      g.y = Math.round(rng() * 100);
      g.tint = 0xdfefff;
      g.alpha = 0.2 + rng() * 0.6;
      this.glitter.addChild(g);
    }

    // The Salt Wren.
    this.ship = new Sprite(art.ship(0, 'left'));
    this.ship.scale.set(2);
    this.ship.x = 44;
    this.ship.y = 112;
    this.addChild(this.ship);

    // --- title ---
    this.titleWrap = new Container();
    this.addChild(this.titleWrap);

    const main = new PixelText({ text: 'LEGEND OF THE', color: 0xdfefff, accent: UI.accent, shadow: true });
    main.scale.set(2);
    main.x = Math.round((width - measure('LEGEND OF THE') * 2) / 2);
    main.y = 16;

    const sub = new PixelText({ text: 'BLUE WATERS', color: UI.accent, shadow: true });
    sub.scale.set(3);
    sub.x = Math.round((width - measure('BLUE WATERS') * 3) / 2);
    sub.y = 34;

    const rule = new Graphics();
    rule.rect(Math.round(width / 2) - 78, 62, 156, 1).fill({ color: 0x6f9fc0, alpha: 0.8 });
    rule.rect(Math.round(width / 2) - 3, 60, 6, 5).fill(UI.accent);

    const tag = new PixelText({ text: 'six legends of the Sunder Reach', color: 0xa8c4dc });
    tag.x = Math.round((width - measure('six legends of the Sunder Reach')) / 2);
    tag.y = 68;

    this.titleWrap.addChild(main, sub, rule, tag);

    // --- menu ---
    this.menuPanel = new Panel(150, 76);
    this.menuPanel.x = 117;
    this.menuPanel.y = 118;
    this.addChild(this.menuPanel);

    this.menu = new MenuList({
      items: this.mainItems(),
      width: 138,
      rows: 5,
      rowHeight: 12,
      onSelect: (item) => this.onMenu(item.value),
    });
    this.menu.x = 123;
    this.menu.y = 124;
    this.addChild(this.menu);

    const hintBar = new Graphics();
    hintBar.rect(0, height - 16, width, 16).fill({ color: 0x050c16, alpha: 0.72 });
    this.addChild(hintBar);

    this.hint = new Blinker('Z / Enter — choose      X — back      H — controls', 0x8fa8bc);
    this.hint.x = Math.round((width - this.hint.textWidth) / 2);
    this.hint.y = height - 12;
    this.addChild(this.hint);

    this.mode = 'main';
    this.popupUI = null;
    this.t = 0;
    this.waterFrame = 0;

    audio.playTheme('title');
  }

  mainItems() {
    const saves = slotSummaries();
    const cleared = saves.some((s) => s && s.legends >= 6);
    const items = [{ label: 'New Voyage', value: 'new' }];
    items.push({
      label: 'Continue',
      value: 'continue',
      disabled: !saves.some(Boolean),
      right: saves.some(Boolean) ? '' : 'no logs',
    });
    if (cleared) items.push({ label: 'New Game +', value: 'ngplus' });
    items.push({ label: 'Controls', value: 'help' });
    items.push({ label: 'Erase a Log', value: 'erase', disabled: !saves.some(Boolean) });
    return items;
  }

  onMenu(value) {
    if (value === 'new') this.startNewGame();
    else if (value === 'continue') this.showSlots('load');
    else if (value === 'ngplus') this.showSlots('ngplus');
    else if (value === 'help') this.showHelp();
    else if (value === 'erase') this.showSlots('erase');
  }

  async startNewGame(carryOver = null) {
    const { state } = this.game;
    state.newGame({ carryOver });
    rng.seed((Date.now() ^ 0x5bf03635) >>> 0);
    this.game.sessionStart = performance.now();
    const { IntroScene } = await import('./IntroScene.js');
    await this.game.scenes.replace(IntroScene, {}, { fade: true, outMS: 400 });
  }

  showSlots(mode) {
    this.mode = mode;
    const saves = slotSummaries();
    const items = saves.map((s, i) => {
      if (!s) return { label: `Log ${i + 1}  —  empty`, value: i, disabled: true };
      const ng = s.ngPlus ? ` NG+${s.ngPlus}` : '';
      return {
        label: `Log ${i + 1}  ${s.leader} Lv${s.level}${ng}`,
        value: i,
        right: `${s.legends}/6  ${formatPlayTime(s.playTimeMs ?? 0)}`,
      };
    });
    items.push({ label: 'Back', value: 'back' });

    const title = mode === 'erase' ? "Erase which log?"
      : mode === 'ngplus' ? 'Carry which crew forward?'
        : "Open which log?";
    this.openOverlay(title, items, (item) => {
      if (item.value === 'back') { this.closeOverlay(); return; }
      if (mode === 'erase') {
        deleteSlot(item.value);
        this.closeOverlay();
        this.menu.setItems(this.mainItems());
        return;
      }
      const rec = loadGame(item.value);
      if (!rec) return;
      if (mode === 'ngplus') {
        const carry = new (this.game.state.constructor)();
        carry.loadJSON(rec.data);
        this.closeOverlay();
        this.startNewGame(carry);
        return;
      }
      this.game.state.loadJSON(rec.data);
      this.game.sessionStart = performance.now();
      this.closeOverlay();
      this.resumeLoaded();
    });
  }

  async resumeLoaded() {
    const { state } = this.game;
    if (state.position.map === 'SEA') {
      const { SeaChartScene } = await import('./SeaChartScene.js');
      await this.game.scenes.replace(SeaChartScene, {}, { fade: true });
    } else {
      const { FieldScene } = await import('./FieldScene.js');
      await this.game.scenes.replace(FieldScene, { mapId: state.position.map, resume: true }, { fade: true });
    }
  }

  showHelp() {
    const items = CONTROL_HELP.map(([keys, what]) => ({ label: keys, right: what, disabled: true }));
    items.push({ label: 'Back', value: 'back' });
    this.openOverlay('Controls', items, () => this.closeOverlay(), 290, 11);
  }

  openOverlay(title, items, onSelect, width = 250, rows = 4) {
    this.closeOverlay();
    const { width: W, height: H } = this.game;
    const rowH = 11;
    const panelH = Math.min(rows, items.length) * rowH + 20;
    const c = new Container();
    const shade = new Graphics();
    shade.rect(0, 0, W, H).fill({ color: 0x000000, alpha: 0.55 });
    c.addChild(shade);
    const panel = new Panel(width, panelH, { title });
    panel.x = Math.round((W - width) / 2);
    panel.y = Math.round((H - panelH) / 2);
    c.addChild(panel);

    const menu = new MenuList({
      items,
      width: width - 12,
      rows: Math.min(rows, items.length),
      rowHeight: rowH,
      onSelect,
      onCancel: () => this.closeOverlay(),
    });
    menu.x = panel.x + 6;
    menu.y = panel.y + 10;
    // Skip past any purely informational rows.
    if (items[0]?.disabled) {
      const firstEnabled = items.findIndex((i) => !i.disabled);
      if (firstEnabled >= 0) { menu.index = firstEnabled; menu.refresh(); }
    }
    c.addChild(menu);

    this.popupUI = { root: c, menu };
    this.addChild(c);
    this.menu.enabled = false;
  }

  closeOverlay() {
    if (!this.popupUI) return;
    this.removeChild(this.popupUI.root);
    this.popupUI.root.destroy({ children: true });
    this.popupUI = null;
    this.mode = 'main';
    this.menu.enabled = true;
  }

  update(dtMS) {
    this.t += dtMS;
    this.hint.update(dtMS);

    // Water animation.
    const frame = Math.floor(this.t / 300) % 4;
    if (frame !== this.waterFrame) {
      this.waterFrame = frame;
      const tex = this.game.art.tex(`tile:moonsea${frame}`);
      for (const s of this.waterSprites) s.texture = tex;
    }
    this.sea.x = Math.round(Math.sin(this.t / 2600) * 4) - 4;

    // Glitter twinkle.
    for (let i = 0; i < this.glitter.children.length; i++) {
      const g = this.glitter.children[i];
      g.alpha = 0.15 + 0.6 * Math.abs(Math.sin(this.t / 400 + i));
    }

    // Ship bob and drift.
    this.ship.y = 112 + Math.round(Math.sin(this.t / 640) * 2);
    this.ship.x = 44 + Math.round(Math.sin(this.t / 3400) * 10);
    this.titleWrap.y = Math.round(Math.sin(this.t / 1800) * 1);

    if (this.popupUI) {
      this.popupUI.menu.update(dtMS);
      this.popupUI.menu.handleInput(input);
      return;
    }
    this.menu.update(dtMS);
    this.menu.handleInput(input);
    if (input.justPressed('help')) this.showHelp();
  }
}
