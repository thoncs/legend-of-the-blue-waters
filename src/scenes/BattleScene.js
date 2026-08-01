/**
 * Front-and-side view turn-based battle.
 *
 * The scene owns presentation only: it pumps the engine in systems/battle.js,
 * animates whatever events come back, and hands input decisions in.
 */
import { Container, Graphics, Sprite } from 'pixi.js';
import { Scene } from '../core/scene.js';
import { PixelText, measure } from '../core/font.js';
import { Panel, MenuList, Bar, UI, Popup } from '../core/ui.js';
import { input } from '../core/input.js';
import { audio } from '../core/audio.js';
import { rng } from '../core/rng.js';
import { Battle, OUTCOME } from '../systems/battle.js';
import { SKILLS, STATUS_DEFS } from '../data/skills.js';
import { ITEMS, ELEMENT_COLOR, ELEMENT_LABEL, itemName } from '../data/items.js';

/** Launch a battle as a full scene swap. */
export async function startBattle(game, opts) {
  return game.scenes.replace(BattleScene, opts, { fade: true, outMS: 260, inMS: 240 });
}

const BACKDROPS = {
  shore: { sky: [0x1c3a5c, 0x2f5f84, 0x4d87a8], ground: 0xc8a76a, groundLit: 0xe8cf9a, silhouette: 0x0e2033, motif: 'palms' },
  jungle: { sky: [0x14301f, 0x1f4a2c, 0x2f6b3c], ground: 0x2c5f2a, groundLit: 0x4f9e3f, silhouette: 0x0c1c12, motif: 'trees' },
  shrine: { sky: [0x101c18, 0x1a2c22, 0x27402f], ground: 0x5a5648, groundLit: 0x7d7466, silhouette: 0x090f0c, motif: 'pillars' },
  shoals: { sky: [0x0b1730, 0x152a4c, 0x25406e], ground: 0x6e8399, groundLit: 0x8ea3b8, silhouette: 0x060d1c, motif: 'wrecks' },
  swamp: { sky: [0x121f1a, 0x1d3025, 0x2f4a38], ground: 0x3a3a2a, groundLit: 0x4a4a34, silhouette: 0x080f0b, motif: 'trees' },
  volcano: { sky: [0x2a0f0c, 0x4a1a12, 0x7a2c18], ground: 0x3a332f, groundLit: 0x584e49, silhouette: 0x160806, motif: 'peaks' },
  reef: { sky: [0x0d3a48, 0x14606e, 0x1f8e9c], ground: 0x9fd0c4, groundLit: 0xbfe0d4, silhouette: 0x07242c, motif: 'coral' },
  storm: { sky: [0x0a1220, 0x141f34, 0x22354f], ground: 0x2b3340, groundLit: 0x3d4756, silhouette: 0x05090f, motif: 'peaks' },
  void: { sky: [0x07080f, 0x0d1020, 0x1a2038], ground: 0x141826, groundLit: 0x222840, silhouette: 0x030408, motif: 'none' },
};

const ENEMY_SLOTS = [
  { x: 62, y: 128 }, { x: 118, y: 116 }, { x: 44, y: 100 }, { x: 132, y: 148 },
];
const PARTY_SLOTS = [
  { x: 268, y: 100 }, { x: 290, y: 122 }, { x: 312, y: 144 },
];

/** Turn-order chips and status rows need a name that fits in ~8 characters. */
function shortName(full) {
  const cleaned = full.replace(/^(The|A)\s+/i, '');
  const first = cleaned.split(' ')[0];
  return first.length > 9 ? `${first.slice(0, 8)}.` : first;
}

export class BattleScene extends Scene {
  onEnter(params = {}) {
    this.controlScheme = 'battle';
    const { width, height, state } = this.game;
    this.params = params;
    this.battle = new Battle(state, {
      enemies: params.enemies,
      canFlee: params.canFlee ?? true,
      isBoss: params.isBoss ?? false,
    });

    this.backdrop = new Container();
    this.addChild(this.backdrop);
    this.buildBackdrop(params.backdrop ?? 'shore');

    this.stage3d = new Container();
    this.addChild(this.stage3d);

    this.enemyLayer = new Container();
    this.partyLayer = new Container();
    this.fxLayer = new Container();
    this.stage3d.addChild(this.enemyLayer, this.partyLayer, this.fxLayer);

    this.sprites = new Map();
    this.buildCombatants();

    this.ui = new Container();
    this.addChild(this.ui);
    this.buildUI();

    this.popups = [];
    this.shake = 0;
    this.t = 0;
    this.mode = 'intro';
    this.pending = [];
    this.eventTimer = 0;
    this.introTimer = params.introText ? 1500 : 400;
    this.phase = 1;

    if (params.introText) {
      this.setMessage(params.introText);
      this.bannerText.text = params.introText;
      this.bannerText.x = Math.round((width - this.bannerText.textWidth) / 2);
      this.bannerText.y = 94;
      this.banner.visible = true;
    }

    // Show HP bars and guard pips before the first blow lands.
    this.refreshStatus();
    this.refreshGuardPips();
    this.refreshOrder();

    audio.playTheme(params.music ?? (params.isBoss ? 'boss' : 'battle'));
    void height;
  }

  /* ---------------------------- backdrop ---------------------------- */

  buildBackdrop(kind) {
    const { width, height, art } = this.game;
    const def = BACKDROPS[kind] ?? BACKDROPS.shore;
    const g = new Graphics();
    const horizon = 104;
    g.rect(0, 0, width, 36).fill(def.sky[0]);
    g.rect(0, 36, width, 34).fill(def.sky[1]);
    g.rect(0, 70, width, horizon - 70).fill(def.sky[2]);
    g.rect(0, horizon, width, height - horizon).fill(def.ground);
    // Dithered band where ground meets sky, so the seam reads as depth.
    for (let y = 0; y < 10; y++) {
      for (let x = (y % 2); x < width; x += 2) {
        g.rect(x, horizon + y, 1, 1).fill({ color: def.groundLit, alpha: 1 - y / 12 });
      }
    }
    g.rect(0, horizon + 10, width, height - horizon - 10).fill(def.groundLit);
    // Scatter over the ground so the lower half is not a flat slab of colour.
    for (let i = 0; i < 260; i++) {
      const x = Math.floor(rng() * width);
      const depth = rng();
      const y = horizon + 8 + Math.floor(depth * depth * (height - horizon - 8));
      const w = 1 + Math.floor(rng() * 2);
      g.rect(x, y, w, 1).fill({ color: rng() < 0.5 ? def.ground : def.silhouette, alpha: 0.18 + rng() * 0.3 });
    }
    // A darker apron at the very bottom keeps the UI panels legible.
    for (let y = 0; y < 22; y++) {
      g.rect(0, height - 22 + y, width, 1).fill({ color: def.silhouette, alpha: (y / 22) * 0.5 });
    }
    this.backdrop.addChild(g);

    // Parallax silhouettes.
    const sil = new Graphics();
    if (def.motif === 'palms') {
      for (const x of [22, 60, 300, 348]) {
        sil.rect(x, 58, 3, 40).fill(def.silhouette);
        for (const [dx, dy] of [[-12, -6], [-7, -11], [0, -13], [7, -11], [12, -6]]) {
          sil.rect(x + dx, 58 + dy, 8, 3).fill(def.silhouette);
        }
      }
    } else if (def.motif === 'trees') {
      for (let i = 0; i < 9; i++) {
        const x = i * 46 + 8;
        sil.rect(x + 8, 62, 4, 36).fill(def.silhouette);
        sil.ellipse(x + 10, 58, 20, 14).fill(def.silhouette);
      }
    } else if (def.motif === 'pillars') {
      for (const x of [30, 84, 292, 346]) {
        sil.rect(x, 40, 14, 58).fill(def.silhouette);
        sil.rect(x - 3, 36, 20, 5).fill(def.silhouette);
      }
    } else if (def.motif === 'wrecks') {
      // A half-sunk hull with two broken masts leaning out of the shallows.
      sil.poly([128, 96, 140, 78, 232, 74, 250, 96]).fill(def.silhouette);
      sil.rect(174, 46, 4, 30).fill(def.silhouette);
      sil.poly([178, 50, 200, 58, 178, 66]).fill(def.silhouette);
      sil.poly([4, 96, 26, 40, 36, 42, 44, 96]).fill(def.silhouette);
      sil.poly([310, 96, 336, 34, 346, 38, 366, 96]).fill(def.silhouette);
      sil.rect(0, 92, width, 4).fill(def.silhouette);
    } else if (def.motif === 'peaks') {
      sil.poly([-10, 96, 60, 34, 120, 96]).fill(def.silhouette);
      sil.poly([210, 96, 300, 20, 394, 96]).fill(def.silhouette);
    } else if (def.motif === 'coral') {
      // Branching fans rather than posts.
      for (const [x, h] of [[16, 34], [58, 24], [96, 40], [286, 30], [330, 44], [364, 26]]) {
        const base = 96;
        sil.rect(x - 1, base - h, 3, h).fill(def.silhouette);
        for (let b = 0; b < 4; b++) {
          const by = base - h + 4 + b * ((h - 6) / 4);
          const dir = b % 2 === 0 ? -1 : 1;
          sil.poly([x, by, x + dir * (7 + b), by - 5 - b, x + dir * (9 + b), by - 1 - b, x, by + 2])
            .fill(def.silhouette);
        }
        sil.ellipse(x, base - h - 1, 5, 4).fill(def.silhouette);
      }
      sil.rect(0, 94, width, 2).fill(def.silhouette);
    }
    // The motifs are drawn against a 96px horizon; nudge them onto the real one.
    sil.y = 8;
    this.backdrop.addChild(sil);
    this.silhouette = sil;

    // A few drifting motes for atmosphere.
    this.motes = [];
    for (let i = 0; i < 22; i++) {
      const s = new Sprite(art.tex('fx:dot'));
      s.x = rng() * width;
      s.y = 20 + rng() * (height - 40);
      s.alpha = 0.12 + rng() * 0.3;
      s.tint = kind === 'volcano' ? 0xffb03a : kind === 'void' ? 0xb9a6ff : 0xdff0ff;
      this.backdrop.addChild(s);
      this.motes.push({ s, vy: -4 - rng() * 8, vx: (rng() - 0.5) * 6 });
    }
  }

  /* -------------------------- combatants ---------------------------- */

  buildCombatants() {
    const { art } = this.game;

    this.battle.enemies.forEach((e, i) => this.addEnemySprite(e, i));

    this.battle.party.forEach((p, i) => {
      const slot = PARTY_SLOTS[i] ?? PARTY_SLOTS[PARTY_SLOTS.length - 1];
      const holder = new Container();
      const shadow = new Sprite(art.tex('fx:shadow'));
      shadow.x = -11;
      shadow.y = -3;
      shadow.scale.set(1.4, 1.1);
      shadow.alpha = 0.5;
      // Heroes are 16px overworld sprites; doubled here so they read at the
      // same scale as the 32-64px battlers facing them.
      const sprite = new Sprite(art.actor(p.style, 'left', 0));
      sprite.scale.set(2);
      sprite.x = -16;
      sprite.y = -32;
      holder.addChild(shadow, sprite);
      holder.x = slot.x;
      holder.y = slot.y;
      this.partyLayer.addChild(holder);
      this.sprites.set(p.key, { holder, sprite, home: { x: slot.x, y: slot.y }, flash: 0, bob: rng() * 6.28 });
    });
  }

  addEnemySprite(e, i) {
    const { art } = this.game;
    const slot = ENEMY_SLOTS[i % ENEMY_SLOTS.length];
    const holder = new Container();
    const tex = art.battler(e.art);
    // Bosses loom: the same art at 1.5x reads as a different weight class.
    const scale = e.traits?.includes('boss') ? 1.5 : 1;
    const w = tex.width * scale;
    const h = tex.height * scale;
    const shadow = new Sprite(art.tex('fx:shadow'));
    shadow.x = -Math.round(w * 0.35);
    shadow.y = -2;
    shadow.scale.set(Math.max(1, w / 22), 1);
    shadow.alpha = 0.45;
    const sprite = new Sprite(tex);
    sprite.scale.set(scale);
    sprite.x = -Math.round(w / 2);
    sprite.y = -h;
    holder.addChild(shadow, sprite);
    holder.x = slot.x;
    holder.y = slot.y;
    this.enemyLayer.addChild(holder);
    this.sprites.set(e.key, { holder, sprite, home: { x: slot.x, y: slot.y }, flash: 0, bob: rng() * 6.28 });
  }

  /* ------------------------------- UI ------------------------------- */

  buildUI() {
    const { width, height } = this.game;

    // Message strip.
    this.msgPanel = new Panel(width - 12, 18);
    this.msgPanel.x = 6;
    this.msgPanel.y = 4;
    this.ui.addChild(this.msgPanel);
    this.msgText = new PixelText({ text: '', color: UI.ink, maxWidth: width - 26 });
    this.msgText.x = 12;
    this.msgText.y = 9;
    this.ui.addChild(this.msgText);

    // Turn order strip.
    this.orderStrip = new Container();
    this.orderStrip.x = 6;
    this.orderStrip.y = 24;
    this.ui.addChild(this.orderStrip);

    // Party status.
    const rowH = 18;
    this.statusPanel = new Panel(124, 10 + this.battle.party.length * rowH);
    this.statusPanel.x = width - 128;
    this.statusPanel.y = height - this.statusPanel.panelHeight - 4;
    this.ui.addChild(this.statusPanel);

    this.statusRows = this.battle.party.map((p, i) => {
      const row = new Container();
      row.x = this.statusPanel.x + 6;
      row.y = this.statusPanel.y + 5 + i * rowH;
      const name = new PixelText({ text: shortName(p.name), color: UI.ink });
      const hpText = new PixelText({ text: '', color: UI.dim });
      hpText.x = 0;
      hpText.y = 9;
      const hpBar = new Bar(58, 5, UI.hp);
      hpBar.x = 46;
      hpBar.y = 0;
      const mpBar = new Bar(58, 3, UI.mp);
      mpBar.x = 46;
      mpBar.y = 8;
      const statusText = new PixelText({ text: '', color: UI.accent });
      statusText.x = 108;
      statusText.y = 8;
      row.addChild(name, hpText, hpBar, mpBar, statusText);
      this.ui.addChild(row);
      return { row, name, hpBar, mpBar, hpText, statusText, combatant: p };
    });

    // Command menu.
    this.cmdPanel = new Panel(96, 74);
    this.cmdPanel.x = 6;
    this.cmdPanel.y = height - 78;
    this.cmdPanel.visible = false;
    this.ui.addChild(this.cmdPanel);

    this.cmdMenu = new MenuList({
      items: [], width: 84, rows: 5, rowHeight: 12,
      onSelect: (item) => this.onCommand(item),
      onCancel: () => this.onCommandCancel(),
      onMove: (item) => this.describeCommand(item),
    });
    this.cmdMenu.x = 12;
    this.cmdMenu.y = height - 72;
    this.cmdMenu.visible = false;
    this.ui.addChild(this.cmdMenu);

    // Info line for skills/items.
    this.infoPanel = new Panel(146, 34);
    this.infoPanel.x = 106;
    this.infoPanel.y = height - 38;
    this.infoPanel.visible = false;
    this.ui.addChild(this.infoPanel);
    this.infoText = new PixelText({ text: '', color: UI.dim, maxWidth: 132 });
    this.infoText.x = 112;
    this.infoText.y = height - 33;
    this.infoText.visible = false;
    this.ui.addChild(this.infoText);

    // Enemy inspection card (shown while targeting).
    this.targetCard = new Panel(112, 40);
    this.targetCard.x = 6;
    this.targetCard.y = 44;
    this.targetCard.visible = false;
    this.ui.addChild(this.targetCard);
    this.targetText = new PixelText({ text: '', color: UI.ink, maxWidth: 100 });
    this.targetText.x = 12;
    this.targetText.y = 49;
    this.targetText.visible = false;
    this.ui.addChild(this.targetText);

    // Target cursor.
    this.targetCursor = new PixelText({ text: '▼', color: UI.accent });
    this.targetCursor.visible = false;
    this.ui.addChild(this.targetCursor);

    // Big centred banner (intro / BREAK / victory).
    this.banner = new Container();
    this.bannerBg = new Graphics();
    this.bannerBg.rect(0, 88, width, 24).fill({ color: 0x000000, alpha: 0.6 });
    this.bannerText = new PixelText({ text: '', color: UI.accent, align: 'center' });
    this.banner.addChild(this.bannerBg, this.bannerText);
    this.banner.visible = false;
    this.ui.addChild(this.banner);

    this.guardPips = new Container();
    this.ui.addChild(this.guardPips);
  }

  setMessage(text) {
    this.msgText.text = text ?? '';
  }

  refreshStatus() {
    for (const row of this.statusRows) {
      const c = row.combatant;
      const ratio = c.hp / c.maxHp;
      row.hpBar.setColorByRatio(ratio);
      row.hpBar.draw(ratio);
      row.mpBar.draw(c.maxMp ? c.mp / c.maxMp : 0);
      row.hpText.text = `${c.hp}`;
      row.name.color = c.alive ? UI.ink : 0x9a6a6a;
      const bad = Object.keys(c.statuses);
      row.statusText.text = bad.length ? '★' : '';
      row.statusText.color = bad.some((s) => STATUS_DEFS[s]?.kind === 'bad') ? UI.bad : UI.good;
    }
  }

  refreshOrder() {
    this.orderStrip.removeChildren();
    // Before the first round the queue is empty; preview it by speed instead.
    const source = this.battle.queue.length
      ? [this.battle.activeActor, ...this.battle.queue]
      : this.battle.all.filter((c) => c.alive).sort((a, b) => b.stat('spd') - a.stat('spd'));
    const upcoming = source.filter(Boolean).slice(0, 6);
    let x = 0;
    for (let i = 0; i < upcoming.length; i++) {
      const c = upcoming[i];
      if (!c.alive) continue;
      const label = shortName(c.name);
      const w = measure(label) + 8;
      const g = new Graphics();
      g.rect(x, 0, w, 11).fill({ color: c.isParty ? 0x1c3a52 : 0x4a2030, alpha: 0.9 });
      g.rect(x, 0, w, 11).stroke({ color: i === 0 ? UI.accent : 0x3f6f92, width: 1, alignment: 0 });
      const t = new PixelText({ text: label, color: i === 0 ? UI.accent : UI.dim });
      t.x = x + 4;
      t.y = 2;
      this.orderStrip.addChild(g, t);
      x += w + 3;
    }
  }

  /** On-screen height of a combatant's sprite, honouring its scale. */
  spriteHeight(view) {
    return (view?.sprite?.texture?.height ?? 16) * (view?.sprite?.scale?.y ?? 1);
  }

  refreshGuardPips() {
    this.guardPips.removeChildren();
    for (const e of this.battle.enemies) {
      if (!e.alive) continue;
      const view = this.sprites.get(e.key);
      if (!view) continue;
      const g = new Graphics();
      const top = view.holder.y - this.spriteHeight(view) - 8;
      const cx = view.holder.x;
      if (e.brokenTurns > 0) {
        const t = new PixelText({ text: 'BREAK', color: UI.bad });
        t.x = Math.round(cx - measure('BREAK') / 2);
        t.y = Math.round(top - 2);
        this.guardPips.addChild(t);
        continue;
      }
      const pips = e.maxGuard;
      const totalW = pips * 4 - 1;
      for (let i = 0; i < pips; i++) {
        const filled = i < e.guard;
        g.rect(Math.round(cx - totalW / 2 + i * 4), Math.round(top), 3, 3)
          .fill(filled ? 0x9fd8ff : 0x3a4a58);
      }
      this.guardPips.addChild(g);
    }
  }

  /* ---------------------------- commands ---------------------------- */

  openCommands(actor) {
    this.actor = actor;
    this.cmdStack = [];
    this.cmdPanel.visible = true;
    this.cmdMenu.visible = true;
    this.setMessage(`${actor.name} — what is the order?`);
    const items = [
      { label: 'Attack', value: 'attack' },
      { label: 'Skill', value: 'skill', disabled: actor.silenced || !actor.member.skills.length },
      { label: 'Item', value: 'item' },
      { label: 'Brace', value: 'defend' },
      { label: 'Run', value: 'flee', disabled: !this.battle.canFlee },
    ];
    this.cmdMenu.setItems(items);
    this.cmdMenu.enabled = true;
    this.describeCommand(items[0]);
    this.refreshOrder();
  }

  closeCommands() {
    this.cmdPanel.visible = false;
    this.cmdMenu.visible = false;
    this.cmdMenu.enabled = false;
    this.infoPanel.visible = false;
    this.infoText.visible = false;
    this.hideTargeting();
  }

  describeCommand(item) {
    if (!item) return;
    let text = '';
    if (item.value === 'attack') text = `Strike with ${ITEMS[this.actor.member.equip.weapon]?.name ?? 'bare hands'}. (${ELEMENT_LABEL[this.actor.element] ?? '—'})`;
    else if (item.value === 'defend') text = 'Take the hit properly. Damage halved, a little breath back.';
    else if (item.value === 'flee') text = this.battle.canFlee ? 'Leave. Speed decides.' : 'There is no leaving this one.';
    else if (item.skill) {
      const s = SKILLS[item.skill];
      text = `${s.desc}  (${s.cost} MP${s.element ? `, ${ELEMENT_LABEL[s.element]}` : ''})`;
    } else if (item.item) {
      text = ITEMS[item.item].desc;
    } else if (item.value === 'skill') text = 'Something learned the hard way.';
    else if (item.value === 'item') text = 'Whatever is in the crew’s pockets.';
    this.infoText.text = text;
    this.infoPanel.visible = Boolean(text);
    this.infoText.visible = Boolean(text);
  }

  onCommand(item) {
    if (item.value === 'back') {
      this.restoreMenu();
    } else if (item.value === 'attack') {
      this.beginTargeting({ kind: 'attack' }, 'enemy');
    } else if (item.value === 'defend') {
      this.submit({ kind: 'defend' });
    } else if (item.value === 'flee') {
      this.submit({ kind: 'flee' });
    } else if (item.value === 'skill') {
      this.openSkills();
    } else if (item.value === 'item') {
      this.openItems();
    } else if (item.skill) {
      const def = SKILLS[item.skill];
      const need = ['enemy'].includes(def.target) ? 'enemy'
        : ['ally'].includes(def.target) ? 'ally'
          : def.target === 'dead' ? 'dead' : null;
      if (need) this.beginTargeting({ kind: 'skill', skill: item.skill }, need);
      else this.submit({ kind: 'skill', skill: item.skill });
    } else if (item.item) {
      const eff = ITEMS[item.item].effect;
      const need = eff.target === 'enemy' ? 'enemy'
        : eff.target === 'ally' ? 'ally'
          : eff.target === 'dead' ? 'dead' : null;
      if (need) this.beginTargeting({ kind: 'item', item: item.item }, need);
      else this.submit({ kind: 'item', item: item.item });
    }
  }

  onCommandCancel() {
    if (this.targeting) { this.hideTargeting(); this.restoreMenu(); return; }
    if (this.cmdStack.length) { this.restoreMenu(); return; }
  }

  restoreMenu() {
    const prev = this.cmdStack.pop();
    if (prev) {
      this.cmdMenu.setItems(prev.items);
      this.cmdMenu.index = prev.index;
      this.cmdMenu.refresh();
      this.describeCommand(this.cmdMenu.current);
    } else {
      this.openCommands(this.actor);
    }
  }

  pushMenu(items) {
    this.cmdStack.push({ items: this.cmdMenu.itemsData, index: this.cmdMenu.index });
    this.cmdMenu.setItems(items);
    this.describeCommand(items[0]);
  }

  openSkills() {
    const member = this.actor.member;
    const items = member.skills.map((id) => {
      const s = SKILLS[id];
      return { label: s.name, right: `${s.cost}`, skill: id, disabled: this.actor.mp < s.cost };
    });
    if (!items.length) { audio.play('deny'); return; }
    items.push({ label: '← back', value: 'back' });
    this.pushMenu(items);
  }

  openItems() {
    const state = this.game.state;
    const items = state.itemsOfKind('consumable')
      .filter((it) => it.effect)
      .map((it) => ({ label: it.name, right: `x${it.count}`, item: it.id }));
    if (!items.length) {
      this.setMessage('Nothing in anyone’s pockets.');
      audio.play('deny');
      return;
    }
    items.push({ label: '← back', value: 'back' });
    this.pushMenu(items);
  }

  /* ---------------------------- targeting --------------------------- */

  beginTargeting(action, kindWanted) {
    const pool = kindWanted === 'enemy' ? this.battle.livingEnemies
      : kindWanted === 'dead' ? this.battle.party.filter((p) => !p.alive)
        : this.battle.livingParty;
    if (!pool.length) { audio.play('deny'); return; }
    this.targeting = { action, pool, index: 0 };
    this.cmdMenu.enabled = false;
    this.targetCursor.visible = true;
    this.updateTargetCursor();
  }

  hideTargeting() {
    this.targeting = null;
    this.targetCursor.visible = false;
    this.targetCard.visible = false;
    this.targetText.visible = false;
    this.cmdMenu.enabled = true;
  }

  updateTargetCursor() {
    if (!this.targeting) return;
    const t = this.targeting.pool[this.targeting.index];
    const view = this.sprites.get(t.key);
    if (!view) return;
    this.targetCursor.x = Math.round(view.holder.x - 2);
    this.targetCursor.y = Math.round(view.holder.y - this.spriteHeight(view) - 18);

    if (t.side === 'enemy') {
      const lines = [t.name];
      if (t.revealed) {
        const weak = t.weak.map((e) => ELEMENT_LABEL[e]).join(', ') || 'none';
        lines.push(`Weak: ${weak}`);
        lines.push(`Guard ${t.guard}/${t.maxGuard}   HP ${Math.round((t.hp / t.maxHp) * 100)}%`);
      } else {
        lines.push('Weaknesses unknown.');
        lines.push('Rook can read them.');
      }
      this.targetText.text = lines.join('\n');
      this.targetCard.visible = true;
      this.targetText.visible = true;
    } else {
      this.targetText.text = `${t.name}\nHP ${t.hp}/${t.maxHp}   MP ${t.mp}/${t.maxMp}`;
      this.targetCard.visible = true;
      this.targetText.visible = true;
    }
  }

  handleTargeting() {
    const tg = this.targeting;
    if (input.repeat('right') || input.repeat('down')) {
      tg.index = (tg.index + 1) % tg.pool.length;
      audio.play('cursor');
      this.updateTargetCursor();
    }
    if (input.repeat('left') || input.repeat('up')) {
      tg.index = (tg.index - 1 + tg.pool.length) % tg.pool.length;
      audio.play('cursor');
      this.updateTargetCursor();
    }
    if (input.justPressed('confirm')) {
      const action = { ...tg.action, target: tg.pool[tg.index] };
      this.hideTargeting();
      this.submit(action);
    }
    if (input.justPressed('cancel')) {
      audio.play('cancel');
      this.hideTargeting();
    }
  }

  submit(action) {
    this.closeCommands();
    this.battle.chooseAction(action);
    this.mode = 'pump';
  }

  /* ------------------------- event animation ------------------------ */

  playEvents(events, followUp) {
    this.pending = events.slice();
    this.followUp = followUp ?? null;
    this.mode = 'anim';
    this.eventTimer = 0;
  }

  eventDuration(ev) {
    switch (ev.type) {
      case 'round': return 240;
      case 'turn': return 90;
      case 'action': return 340;
      case 'damage': return 300;
      case 'heal': return 300;
      case 'mp': return 160;
      case 'break': return 620;
      case 'down': return 420;
      case 'revive': return 420;
      case 'status': return 260;
      case 'statusMiss': return 160;
      case 'statusEnd': return 0;
      case 'miss': return 260;
      case 'stagger': return 420;
      case 'guardRestore': return 220;
      case 'message': return 900;
      case 'summon': return 500;
      case 'scout': return 500;
      case 'escaped': return 700;
      case 'yield': return 900;
      case 'cured': return 260;
      default: return 160;
    }
  }

  applyEvent(ev) {
    const view = ev.target ? this.sprites.get(ev.target.key) : null;
    switch (ev.type) {
      case 'round':
        this.setMessage(`Round ${ev.round}`);
        this.refreshOrder();
        break;
      case 'turn':
        this.refreshOrder();
        break;
      case 'action': {
        const actorView = this.sprites.get(ev.actor.key);
        if (actorView) {
          actorView.lunge = ev.actor.isParty ? -10 : 10;
        }
        this.setMessage(`${ev.actor.name}: ${ev.label}`);
        if (ev.skill) audio.play(SKILLS[ev.skill]?.type === 'heal' ? 'heal' : 'magic');
        else if (ev.item) audio.play('confirm');
        break;
      }
      case 'damage': {
        if (view) { view.flash = 200; view.shake = 220; }
        this.shake = Math.min(7, 2 + ev.amount / 60);
        const color = ev.crit ? 0xffe08a : ev.weak ? 0x9fd8ff : ev.resist ? 0x8fa8bc : 0xffffff;
        let label = `${ev.amount}`;
        if (ev.crit) label += '!';
        this.popup(ev.target, label, color, { scaleUp: ev.crit || ev.weak });
        if (ev.weak) this.popup(ev.target, 'WEAK', 0x9fd8ff, { offsetY: -12, duration: 700 });
        if (ev.resist) this.popup(ev.target, 'resist', 0x8fa8bc, { offsetY: -12, duration: 700 });
        audio.play(ev.crit ? 'crit' : ev.element === 'shot' ? 'shot' : 'hit');
        break;
      }
      case 'heal':
        this.popup(ev.target, `+${ev.amount}`, UI.good);
        if (ev.kind !== 'status') audio.play('heal');
        break;
      case 'mp':
        this.popup(ev.target, `+${ev.amount} MP`, UI.mp, { offsetY: -10 });
        break;
      case 'break':
        this.bannerFlash('BREAK!');
        this.shake = 8;
        audio.play('brk');
        if (view) view.flash = 400;
        break;
      case 'miss':
        this.popup(ev.target, 'miss', 0x8fa8bc);
        audio.play('guard');
        break;
      case 'status': {
        const def = STATUS_DEFS[ev.status];
        this.popup(ev.target, def?.name ?? ev.status, def?.color ?? 0xffffff, { offsetY: -8 });
        break;
      }
      case 'statusMiss':
        this.popup(ev.target, 'resisted', 0x8fa8bc, { offsetY: -8 });
        break;
      case 'down': {
        if (view) view.dying = 420;
        audio.play('down');
        this.setMessage(`${ev.target.name} goes down.`);
        break;
      }
      case 'revive':
        this.popup(ev.target, 'UP!', UI.accent, { scaleUp: true });
        audio.play('levelup');
        break;
      case 'stagger':
        this.setMessage(`${ev.actor.name} is broken and cannot move.`);
        break;
      case 'guardRestore':
        this.setMessage(`${ev.actor.name} recovers its guard.`);
        break;
      case 'message':
        this.setMessage(ev.text);
        break;
      case 'cured':
        this.popup(ev.target, 'clear', UI.good, { offsetY: -8 });
        break;
      case 'scout':
        this.setMessage('Rook calls the weaknesses out loud.');
        audio.play('confirm');
        break;
      case 'summon': {
        const i = this.battle.enemies.indexOf(ev.target);
        this.addEnemySprite(ev.target, i);
        this.setMessage(`${ev.target.name} answers the call.`);
        break;
      }
      case 'escaped':
        this.setMessage('You get clear.');
        audio.play('cancel');
        break;
      case 'yield':
        this.bannerFlash('SHE YIELDS');
        this.setMessage(`${ev.target.name} stops fighting.`);
        break;
      default:
        break;
    }
    this.refreshStatus();
    this.refreshGuardPips();
  }

  popup(target, text, color, opts = {}) {
    const view = this.sprites.get(target.key);
    if (!view) return;
    const p = new Popup(text, color, { duration: opts.duration ?? 780, scaleUp: opts.scaleUp });
    const h = this.spriteHeight(view);
    p.place(view.holder.x, view.holder.y - h - 6 + (opts.offsetY ?? 0));
    this.fxLayer.addChild(p);
    this.popups.push(p);
  }

  bannerFlash(text) {
    this.bannerText.text = text;
    this.bannerText.x = Math.round((this.game.width - this.bannerText.textWidth) / 2);
    this.bannerText.y = 94;
    this.banner.visible = true;
    this.bannerTimer = 700;
  }

  /* ------------------------------ results --------------------------- */

  showResults(outcome) {
    this.mode = 'result';
    this.closeCommands();
    const { width, height, state } = this.game;

    if (outcome === OUTCOME.DEFEAT) {
      this.setMessage('The crew goes down.');
      audio.stopTheme();
      audio.fanfare('defeat');
      this.resultTimer = 1600;
      return;
    }
    if (outcome === OUTCOME.ESCAPED) {
      this.resultTimer = 500;
      return;
    }

    // Phase two of a two-part boss fight starts without leaving the scene.
    if (this.params.phase2 && this.phase === 1) {
      this.phase = 2;
      this.startPhaseTwo();
      return;
    }

    const rewards = this.battle.claimRewards();
    audio.stopTheme();
    audio.fanfare('victory');

    const lines = [];
    if (outcome === OUTCOME.YIELD) lines.push('They stop fighting.');
    lines.push(`Experience  ${rewards.xpEach} each`);
    lines.push(`Doubloons   ${rewards.gold}`);
    for (const d of rewards.drops) lines.push(`Found  ${itemName(d)}`);
    for (const lv of rewards.levelUps) {
      lines.push(`${lv.member.name} reaches Lv ${lv.to}!`);
      for (const s of lv.skills) lines.push(`  learns ${SKILLS[s]?.name ?? s}`);
    }

    const panelW = 210;
    const panelH = 26 + lines.length * 10;
    const panel = new Panel(panelW, panelH, { title: outcome === OUTCOME.YIELD ? 'Stand-off' : 'Victory' });
    panel.x = Math.round((width - panelW) / 2);
    panel.y = Math.round((height - panelH) / 2);
    this.ui.addChild(panel);
    const text = new PixelText({ text: lines.join('\n'), color: UI.ink, maxWidth: panelW - 16 });
    text.x = panel.x + 8;
    text.y = panel.y + 12;
    this.ui.addChild(text);
    this.resultPanel = panel;
    this.resultText = text;
    this.resultTimer = 400;
    void state;
  }

  startPhaseTwo() {
    const { state } = this.game;
    // Marene's last act is to hold the water off you: a partial mend so the
    // second phase is a fight, not a formality.
    for (const m of state.party) {
      const s = m.maxStats;
      if (m.hp > 0) {
        m.hp = Math.min(s.hp, m.hp + Math.round(s.hp * 0.5));
        m.mp = Math.min(s.mp, m.mp + Math.round(s.mp * 0.5));
      }
    }
    for (const view of this.sprites.values()) {
      if (view.holder.parent === this.enemyLayer) {
        view.holder.parent.removeChild(view.holder);
        view.holder.destroy({ children: true });
      }
    }
    for (const e of this.battle.enemies) this.sprites.delete(e.key);

    this.battle = new Battle(state, {
      enemies: this.params.phase2,
      canFlee: false,
      isBoss: true,
    });
    this.battle.enemies.forEach((e, i) => this.addEnemySprite(e, i));
    // Rebind the party status rows to the new battle's combatants.
    this.battle.party.forEach((p, i) => {
      const slot = PARTY_SLOTS[i] ?? PARTY_SLOTS[PARTY_SLOTS.length - 1];
      const old = this.partyLayer.children[i];
      this.sprites.set(p.key, {
        holder: old, sprite: old.children[1], home: { x: slot.x, y: slot.y }, flash: 0, bob: rng() * 6.28,
      });
      if (this.statusRows[i]) this.statusRows[i].combatant = p;
    });

    audio.playTheme('boss');
    this.bannerFlash('IT IS STILL THERE');
    this.setMessage('Marene lets go, and the water opens.');
    this.mode = 'intro';
    this.introTimer = 1500;
  }

  finish(outcome) {
    if (this._finished) return;
    this._finished = true;
    this.params.onFinish?.(outcome, this.battle);
  }

  /* ------------------------------- loop ----------------------------- */

  update(dtMS) {
    this.t += dtMS;

    // Backdrop motes.
    for (const m of this.motes) {
      m.s.y += m.vy * dtMS / 1000;
      m.s.x += m.vx * dtMS / 1000;
      if (m.s.y < 10) { m.s.y = this.game.height - 10; m.s.x = rng() * this.game.width; }
    }

    // Sprite idle bob, flash, lunge and death fade.
    for (const [, view] of this.sprites) {
      view.bob += dtMS / 520;
      const bobY = Math.sin(view.bob) * 1.2;
      let ox = 0;
      if (view.lunge) {
        ox = view.lunge;
        view.lunge *= 0.82;
        if (Math.abs(view.lunge) < 0.5) view.lunge = 0;
      }
      if (view.shake > 0) {
        view.shake -= dtMS;
        ox += (rng() - 0.5) * 5;
      }
      view.holder.x = view.home.x + ox;
      view.holder.y = view.home.y + bobY;
      if (view.flash > 0) {
        view.flash -= dtMS;
        view.sprite.tint = (Math.floor(view.flash / 60) % 2) ? 0xffffff : 0xff9a9a;
        if (view.flash <= 0) view.sprite.tint = 0xffffff;
      }
      if (view.dying > 0) {
        view.dying -= dtMS;
        view.holder.alpha = Math.max(0, view.dying / 420);
        if (view.dying <= 0) view.holder.visible = false;
      }
    }

    // Screen shake.
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dtMS * 0.02);
      this.stage3d.x = Math.round((rng() - 0.5) * this.shake);
      this.stage3d.y = Math.round((rng() - 0.5) * this.shake);
    } else {
      this.stage3d.x = 0;
      this.stage3d.y = 0;
    }

    // Floating numbers.
    for (let i = this.popups.length - 1; i >= 0; i--) {
      if (this.popups[i].step(dtMS)) {
        this.popups[i].destroy();
        this.popups.splice(i, 1);
      }
    }

    if (this.bannerTimer > 0) {
      this.bannerTimer -= dtMS;
      if (this.bannerTimer <= 0) this.banner.visible = false;
    }

    switch (this.mode) {
      case 'intro':
        this.introTimer -= dtMS;
        if (this.introTimer <= 0 || input.justPressed('confirm')) {
          this.banner.visible = false;
          this.mode = 'pump';
        }
        break;

      case 'pump': {
        const step = this.battle.advance();
        if (step.kind === 'end') { this.showResults(step.outcome); break; }
        if (step.kind === 'input') {
          if (step.events?.length) {
            this.playEvents(step.events, { kind: 'input', actor: step.actor });
          } else {
            this.openCommands(step.actor);
            this.mode = 'input';
          }
          break;
        }
        this.playEvents(step.events, step.followUp);
        break;
      }

      case 'anim': {
        this.eventTimer -= dtMS;
        if (this.eventTimer > 0) break;
        if (!this.pending.length) {
          const follow = this.followUp;
          this.followUp = null;
          if (follow?.kind === 'end') { this.showResults(follow.outcome); break; }
          if (follow?.kind === 'input') { this.openCommands(follow.actor); this.mode = 'input'; break; }
          this.mode = 'pump';
          break;
        }
        const ev = this.pending.shift();
        this.applyEvent(ev);
        this.eventTimer = this.eventDuration(ev) * (input.isDown('confirm') ? 0.35 : 1);
        break;
      }

      case 'input':
        this.cmdMenu.update(dtMS);
        if (this.targeting) this.handleTargeting();
        else {
          this.cmdMenu.handleInput(input);
        }
        break;

      case 'result':
        this.resultTimer -= dtMS;
        if (this.resultTimer <= 0 && (input.justPressed('confirm') || input.justPressed('cancel') || this.battle.outcome === OUTCOME.ESCAPED)) {
          this.finish(this.battle.outcome);
        }
        if (this.battle.outcome === OUTCOME.DEFEAT && this.resultTimer <= 0) {
          this.finish(OUTCOME.DEFEAT);
        }
        break;

      default:
        break;
    }
  }
}
