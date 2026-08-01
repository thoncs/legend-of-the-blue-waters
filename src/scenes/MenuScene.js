/**
 * The ship's log: crew, gear, items, the legend journal, options, saving and
 * a controls reference. Opens over the field scene and pops back to it.
 */
import { Container, Graphics } from 'pixi.js';
import { Scene } from '../core/scene.js';
import { PixelText, measure } from '../core/font.js';
import { Panel, MenuList, Bar, UI, header } from '../core/ui.js';
import { input, CONTROL_HELP } from '../core/input.js';
import { audio } from '../core/audio.js';
import { ITEMS, itemName, ELEMENT_LABEL } from '../data/items.js';
import { SKILLS } from '../data/skills.js';
import { LEGENDS, LEGEND_STATE } from '../data/legends.js';
import { objectiveText } from '../systems/quests.js';
import { saveGame, slotSummaries, formatPlayTime } from '../core/save.js';

const TABS = ['Crew', 'Gear', 'Items', 'Journal', 'Options', 'Save', 'Help'];

export class MenuScene extends Scene {
  onEnter(params = {}) {
    this.controlScheme = 'menu';
    this.overlay = true;
    const { width, height } = this.game;

    const shade = new Graphics();
    shade.rect(0, 0, width, height).fill({ color: 0x050c14, alpha: 0.82 });
    this.addChild(shade);

    this.head = header('SHIP’S LOG', width);
    this.addChild(this.head);

    this.tabBar = new Container();
    this.tabBar.y = 16;
    this.addChild(this.tabBar);

    this.goldText = new PixelText({ text: '', color: UI.accent });
    this.goldText.y = 3;
    this.addChild(this.goldText);

    this.leftPanel = new Panel(126, height - 46);
    this.leftPanel.x = 4;
    this.leftPanel.y = 28;
    this.addChild(this.leftPanel);

    this.rightPanel = new Panel(width - 138, height - 46);
    this.rightPanel.x = 134;
    this.rightPanel.y = 28;
    this.addChild(this.rightPanel);

    this.detail = new Container();
    this.detail.x = 141;
    this.detail.y = 34;
    this.addChild(this.detail);

    this.list = new MenuList({
      items: [],
      width: 118,
      rows: 13,
      rowHeight: 13,
      onSelect: (item) => this.onSelect(item),
      onCancel: () => this.onCancel(),
      onMove: (item) => this.renderDetail(item),
    });
    this.list.x = 10;
    this.list.y = 34;
    this.addChild(this.list);

    this.footer = new PixelText({ text: '', color: UI.dim });
    this.footer.x = 6;
    this.footer.y = height - 12;
    this.addChild(this.footer);

    this.tab = Math.max(0, TABS.indexOf(this.capitalize(params.tab ?? 'party')));
    if (this.tab < 0) this.tab = 0;
    if (params.tab === 'journal') this.tab = TABS.indexOf('Journal');
    if (params.tab === 'help') this.tab = TABS.indexOf('Help');
    if (params.tab === 'save') this.tab = TABS.indexOf('Save');
    /** @type {Array<{mode:string, data?:any}>} */
    this.stack = [{ mode: 'root' }];
    this.buildTabs();
    this.refresh();
  }

  capitalize(s) { return s ? s[0].toUpperCase() + s.slice(1) : s; }

  get mode() { return this.stack[this.stack.length - 1]; }

  buildTabs() {
    this.tabBar.removeChildren();
    let x = 6;
    this.tabLabels = [];
    for (let i = 0; i < TABS.length; i++) {
      const label = new PixelText({ text: TABS[i], color: UI.dim });
      label.x = x;
      label.y = 0;
      this.tabBar.addChild(label);
      this.tabLabels.push(label);
      x += measure(TABS[i]) + 9;
    }
    const underline = new Graphics();
    this.tabBar.addChild(underline);
    this.tabUnderline = underline;
  }

  refreshTabs() {
    let x = 6;
    for (let i = 0; i < TABS.length; i++) {
      this.tabLabels[i].color = i === this.tab ? UI.accent : UI.dim;
      x += measure(TABS[i]) + 9;
    }
    const g = this.tabUnderline;
    g.clear();
    let cx = 6;
    for (let i = 0; i < this.tab; i++) cx += measure(TABS[i]) + 9;
    g.rect(cx - 2, 10, measure(TABS[this.tab]) + 4, 1).fill(UI.accent);
  }

  refresh() {
    const { state } = this.game;
    this.goldText.text = `¤ ${state.gold}`;
    this.goldText.x = this.game.width - 6 - this.goldText.textWidth;
    this.refreshTabs();
    const keptIndex = this._keepIndex ? this.list.index : 0;
    this._keepIndex = false;
    this.list.setItems(this.itemsForMode(), false);
    if (keptIndex) {
      this.list.index = Math.min(keptIndex, this.list.itemsData.length - 1);
      this.list.refresh();
    }
    this.renderDetail(this.list.current);
    this.footer.text = this.footerHint();
  }

  footerHint() {
    if (this.mode.mode !== 'root') return 'Z choose    X back';
    return 'Left/Right switch pages    Z choose    X close';
  }

  /* --------------------------- list contents --------------------------- */

  itemsForMode() {
    const { state } = this.game;
    const m = this.mode;
    if (m.mode === 'gearSlot') {
      const member = state.member(m.data.charId);
      return [
        { label: 'Weapon', right: itemName(member.equip.weapon) || '—', value: 'weapon' },
        { label: 'Coat', right: itemName(member.equip.coat) || '—', value: 'coat' },
        { label: 'Trinket', right: itemName(member.equip.trinket) || '—', value: 'trinket' },
      ];
    }
    if (m.mode === 'gearPick') {
      const { charId, slot } = m.data;
      const owned = state.itemsOfKind('weapon', 'coat', 'trinket')
        .filter((it) => it.slot === slot && (!it.user || it.user === charId))
        .map((it) => ({ label: it.name, right: `x${it.count}`, value: it.id, itemId: it.id }));
      const member = state.member(charId);
      if (member.equip[slot]) owned.unshift({ label: '— take it off —', value: '__off' });
      if (!owned.length) owned.push({ label: 'nothing that fits', disabled: true });
      return owned;
    }
    if (m.mode === 'itemTarget') {
      return state.party.map((p) => ({
        label: p.name.split(' ')[0],
        right: `${p.hp}/${p.maxStats.hp}`,
        value: p.id,
      }));
    }

    switch (TABS[this.tab]) {
      case 'Crew':
        return state.party.map((p) => ({
          label: p.name, right: `Lv${p.level}`, value: p.id, charId: p.id,
        }));
      case 'Gear':
        return state.party.map((p) => ({
          label: p.name, right: `Lv${p.level}`, value: p.id, charId: p.id,
        }));
      case 'Items': {
        const consumables = state.itemsOfKind('consumable')
          .map((it) => ({ label: it.name, right: `x${it.count}`, value: it.id, itemId: it.id }));
        const keys = state.itemsOfKind('key')
          .map((it) => ({ label: it.name, right: 'key', value: it.id, itemId: it.id, keyItem: true }));
        const gear = state.itemsOfKind('weapon', 'coat', 'trinket')
          .map((it) => ({ label: it.name, right: `x${it.count}`, value: it.id, itemId: it.id, disabled: true }));
        const out = [...consumables, ...keys, ...gear];
        return out.length ? out : [{ label: 'The lockers are bare.', disabled: true }];
      }
      case 'Journal': {
        const known = state.knownLegends;
        if (!known.length) return [{ label: 'No legends heard yet.', disabled: true }];
        return known
          .sort((a, b) => LEGENDS[a].order - LEGENDS[b].order)
          .map((id) => {
            const st = state.legendState(id);
            const mark = st === LEGEND_STATE.RESOLVED ? '★' : st === LEGEND_STATE.ACTIVE ? '▶' : '·';
            return {
              label: `${mark} ${LEGENDS[id].name}`,
              value: id,
              legendId: id,
              rightColor: st === LEGEND_STATE.RESOLVED ? UI.good : UI.dim,
              right: st === LEGEND_STATE.RESOLVED ? 'told' : st === LEGEND_STATE.ACTIVE ? 'open' : 'rumour',
            };
          });
      }
      case 'Options':
        return [
          { label: 'Music', right: `${Math.round(this.game.options.musicVolume * 100)}%`, value: 'music' },
          { label: 'Sound', right: `${Math.round(this.game.options.sfxVolume * 100)}%`, value: 'sfx' },
          { label: 'Mute all', right: this.game.options.muted ? 'on' : 'off', value: 'mute' },
          { label: 'Text speed', right: ['slow', 'normal', 'fast', 'instant'][this.game.options.textSpeed], value: 'text' },
          { label: 'Return to title', value: 'title' },
        ];
      case 'Save': {
        const slots = slotSummaries();
        return slots.map((s, i) => ({
          label: `Log ${i + 1}`,
          right: s ? `${s.leader} Lv${s.level} · ${s.legends}/6` : 'empty',
          value: i,
        }));
      }
      case 'Help':
        return CONTROL_HELP.map(([k, v]) => ({ label: k, right: v, disabled: true }));
      default:
        return [];
    }
  }

  /* ----------------------------- detail pane --------------------------- */

  renderDetail(item) {
    this.detail.removeChildren();
    const { state, width } = this.game;
    const w = width - 152;
    const add = (node, x, y) => { node.x = x; node.y = y; this.detail.addChild(node); return node; };
    const line = (text, y, color = UI.ink, maxWidth = w) =>
      add(new PixelText({ text, color, maxWidth }), 0, y);

    const m = this.mode;
    if (m.mode === 'gearPick' && item?.itemId) {
      const def = ITEMS[item.itemId];
      line(def.name, 0, UI.accent);
      line(def.desc, 12, UI.dim);
      let y = 44;
      const member = state.member(m.data.charId);
      const current = ITEMS[member.equip[m.data.slot]];
      for (const [k, v] of Object.entries(def.stats ?? {})) {
        const now = current?.stats?.[k] ?? 0;
        const delta = v - now;
        const sign = delta > 0 ? '+' : '';
        line(`${k.toUpperCase()}  ${v}   (${sign}${delta})`, y,
          delta > 0 ? UI.good : delta < 0 ? UI.bad : UI.dim);
        y += 10;
      }
      if (def.element) line(`Element: ${ELEMENT_LABEL[def.element]}`, y, UI.dim);
      return;
    }

    switch (TABS[this.tab]) {
      case 'Crew':
      case 'Gear': {
        const p = state.member(item?.charId ?? item?.value) ?? state.party[0];
        if (!p) return;
        const s = p.maxStats;
        line(p.name, 0, UI.accent);
        line(`${p.def.title}  ·  Lv ${p.level}`, 10, UI.dim);

        const hpBar = new Bar(88, 5, UI.hp);
        hpBar.draw(p.hp / s.hp);
        add(hpBar, 0, 24);
        line(`HP ${p.hp}/${s.hp}`, 31, UI.dim);
        const mpBar = new Bar(88, 5, UI.mp);
        mpBar.draw(s.mp ? p.mp / s.mp : 0);
        add(mpBar, 110, 24);
        line(`MP ${p.mp}/${s.mp}`, 31, UI.dim).x = 110;

        const xpBar = new Bar(198, 3, UI.accent);
        xpBar.draw(p.xpRatio);
        add(xpBar, 0, 44);
        line(`next level in ${p.xpToNext} xp`, 50, UI.dim);

        const stats = [['ATK', s.atk], ['DEF', s.def], ['MAG', s.mag], ['RES', s.res], ['SPD', s.spd], ['LUK', s.luk]];
        stats.forEach(([k, v], i) => {
          line(`${k} ${String(v).padStart(3)}`, 64 + Math.floor(i / 3) * 10, UI.ink).x = (i % 3) * 46;
        });

        line('Carried', 88, UI.accent);
        ['weapon', 'coat', 'trinket'].forEach((slot, i) => {
          line(`${slot}: ${itemName(p.equip[slot]) || '—'}`, 99 + i * 10, UI.dim);
        });

        line('Skills', 132, UI.accent);
        p.skills.slice(0, 6).forEach((id, i) => {
          const sk = SKILLS[id];
          const node = line(`${sk.name} ${sk.cost}mp`, 143 + Math.floor(i / 2) * 10, UI.ink, 106);
          node.x = (i % 2) * 112;
        });
        break;
      }
      case 'Items': {
        if (!item?.itemId) { line('Nothing selected.', 0, UI.dim); break; }
        const def = ITEMS[item.itemId];
        line(def.name, 0, UI.accent);
        line(def.desc, 12, UI.dim);
        if (def.stats) {
          let y = 44;
          for (const [k, v] of Object.entries(def.stats)) { line(`${k.toUpperCase()} +${v}`, y, UI.good); y += 10; }
        }
        if (def.kind === 'consumable' && def.usableInField) line('Z to use.', 96, UI.accent);
        if (def.slot) line('Equip from the Gear page.', 96, UI.dim);
        break;
      }
      case 'Journal': {
        const id = item?.legendId;
        if (!id) { line('The chart is blank here.', 0, UI.dim); break; }
        const def = LEGENDS[id];
        const rec = state.legendRecord(id);
        line(def.name, 0, UI.accent);
        line(`${def.region}  ·  suggested Lv ${def.recommendedLevel}`, 10, UI.dim);
        line(def.rumor, 24, UI.ink);
        const y = 24 + Math.max(3, Math.ceil(def.rumor.length / 52)) * 10 + 6;
        line('Objective', y, UI.accent);
        line(objectiveText(state, id), y + 11, rec.state === LEGEND_STATE.RESOLVED ? UI.good : UI.ink);
        if (rec.state === LEGEND_STATE.RESOLVED) {
          line('Outcome', y + 34, UI.accent);
          const branch = def.branches?.find((b) => b.id === rec.branch);
          line(branch ? branch.blurb : def.worldChange, y + 45, UI.dim);
        } else {
          line('Known adversaries', y + 34, UI.accent);
          line(def.enemies.map((e) => e).join(', '), y + 45, UI.dim);
        }
        break;
      }
      case 'Options':
        line('Options', 0, UI.accent);
        line('Left/Right adjusts the highlighted line.', 14, UI.dim);
        line(`Legends told: ${state.resolvedCount}/6`, 40, UI.ink);
        line(`Days at sea: ${state.day}`, 52, UI.dim);
        line(`Steps: ${state.steps}`, 64, UI.dim);
        if (state.ngPlus) line(`New Game + ${state.ngPlus}`, 76, UI.accent);
        break;
      case 'Save': {
        const slots = slotSummaries();
        const s = slots[item?.value ?? 0];
        line('Save the voyage', 0, UI.accent);
        if (s) {
          line(`${s.leader}  Lv ${s.level}`, 16);
          line(`${s.where}  ·  day ${s.day}`, 28, UI.dim);
          line(`Legends ${s.legends}/6   ¤${s.gold}`, 40, UI.dim);
          line(`Played ${formatPlayTime(s.playTimeMs ?? 0)}`, 52, UI.dim);
          line('Choosing this log overwrites it.', 72, UI.bad);
        } else {
          line('Empty log.', 16, UI.dim);
        }
        break;
      }
      case 'Help':
        line('Controls', 0, UI.accent);
        line('Battles reward reading the enemy: strike an elemental weakness to strip a Guard pip. At zero pips the enemy Breaks — it loses a turn and takes half again as much damage.', 16, UI.ink);
        line('Rook’s Read the Wind reveals weaknesses for the whole crew.', 72, UI.dim);
        line('Rest at an inn to heal, pass the time, and save.', 94, UI.dim);
        break;
      default:
        break;
    }
  }

  /* ------------------------------ actions ------------------------------ */

  onSelect(item) {
    const { state } = this.game;
    const m = this.mode;

    if (m.mode === 'gearSlot') {
      this.stack.push({ mode: 'gearPick', data: { charId: m.data.charId, slot: item.value } });
      this.refresh();
      return;
    }
    if (m.mode === 'gearPick') {
      const { charId, slot } = m.data;
      if (item.value === '__off') state.unequip(charId, slot);
      else if (item.itemId) state.equip(charId, item.itemId);
      audio.play('confirm');
      this.stack.pop();
      this.refresh();
      return;
    }
    if (m.mode === 'itemTarget') {
      const target = state.member(item.value);
      const def = ITEMS[m.data.itemId];
      const eff = def.effect;
      let used = false;
      if (eff.type === 'heal') {
        if (eff.hp && target.hp > 0 && target.hp < target.maxStats.hp) {
          target.hp = Math.min(target.maxStats.hp, target.hp + eff.hp); used = true;
        }
        if (eff.mp && target.mp < target.maxStats.mp) {
          target.mp = Math.min(target.maxStats.mp, target.mp + eff.mp); used = true;
        }
      } else if (eff.type === 'revive') {
        if (target.hp <= 0) { target.hp = Math.round(target.maxStats.hp * (eff.ratio ?? 0.5)); used = true; }
      } else if (eff.type === 'cure') {
        used = true; // No lingering field statuses; still consumes as a "you feel better".
      }
      if (used) {
        state.removeItem(m.data.itemId, 1);
        audio.play('heal');
      } else {
        audio.play('deny');
      }
      this.stack.pop();
      this.refresh();
      return;
    }

    switch (TABS[this.tab]) {
      case 'Gear':
        this.stack.push({ mode: 'gearSlot', data: { charId: item.charId } });
        this.refresh();
        break;
      case 'Items': {
        const def = ITEMS[item.itemId];
        if (!def || def.kind !== 'consumable' || !def.usableInField) { audio.play('deny'); break; }
        if (def.effect.target === 'allies') {
          for (const p of state.party) {
            if (p.hp <= 0) continue;
            if (def.effect.hp) p.hp = Math.min(p.maxStats.hp, p.hp + def.effect.hp);
            if (def.effect.mp) p.mp = Math.min(p.maxStats.mp, p.mp + def.effect.mp);
          }
          state.removeItem(item.itemId, 1);
          audio.play('heal');
          this.refresh();
        } else {
          this.stack.push({ mode: 'itemTarget', data: { itemId: item.itemId } });
          this.refresh();
        }
        break;
      }
      case 'Options':
        this.adjustOption(item.value, 0);
        break;
      case 'Save': {
        state.playTimeMs += performance.now() - this.game.sessionStart;
        this.game.sessionStart = performance.now();
        const res = saveGame(item.value, state.toJSON(), state.saveMeta());
        audio.play(res.ok ? 'chest' : 'deny');
        this.flash(res.ok ? `Saved to Log ${item.value + 1}.` : `Could not save: ${res.reason}`);
        this.refresh();
        break;
      }
      default:
        break;
    }
  }

  adjustOption(which, delta) {
    const o = this.game.options;
    if (which === 'music') {
      o.musicVolume = Math.max(0, Math.min(1, o.musicVolume + delta * 0.1));
      audio.setMusicVolume(o.musicVolume);
    } else if (which === 'sfx') {
      o.sfxVolume = Math.max(0, Math.min(1, o.sfxVolume + delta * 0.1));
      audio.setSfxVolume(o.sfxVolume);
      if (delta) audio.play('cursor');
    } else if (which === 'mute') {
      o.muted = !o.muted;
      audio.setMuted(o.muted);
    } else if (which === 'text') {
      o.textSpeed = (o.textSpeed + (delta === 0 ? 1 : delta) + 4) % 4;
    } else if (which === 'title') {
      this.returnToTitle();
      return;
    }
    this.game.saveOptions();
    this._keepIndex = true;
    this.refresh();
  }

  async returnToTitle() {
    const { TitleScene } = await import('./TitleScene.js');
    await this.game.scenes.replace(TitleScene, {}, { fade: true });
  }

  flash(text) {
    this.footer.text = text;
    this._flashTimer = 2200;
  }

  onCancel() {
    if (this.stack.length > 1) {
      this.stack.pop();
      this.refresh();
      return;
    }
    this.game.scenes.pop();
  }

  update(dtMS) {
    this.list.update(dtMS);
    if (this._flashTimer > 0) {
      this._flashTimer -= dtMS;
      if (this._flashTimer <= 0) this.footer.text = this.footerHint();
    }

    // Options rows respond to left/right; everything else uses them for tabs.
    if (this.stack.length === 1 && TABS[this.tab] === 'Options' && this.list.current) {
      const which = this.list.current.value;
      if (which === 'music' || which === 'sfx') {
        if (input.repeat('right')) { this.adjustOption(which, 1); return; }
        if (input.repeat('left')) { this.adjustOption(which, -1); return; }
      }
    }

    if (this.stack.length === 1) {
      if (input.justPressed('journal')) {
        this.tab = TABS.indexOf('Journal');
        audio.play('cursor');
        this.refresh();
        return;
      }
      let moved = 0;
      if (input.repeat('right') || input.justPressed('menu')) moved = 1;
      else if (input.repeat('left')) moved = -1;
      if (moved !== 0) {
        this.tab = (this.tab + moved + TABS.length) % TABS.length;
        audio.play('cursor');
        this.refresh();
        return;
      }
    }

    this.list.handleInput(input);
  }
}
