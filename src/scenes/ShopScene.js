/**
 * Buying and selling. Stock is filtered by world flags, so a legend you have
 * resolved visibly changes what a settlement can offer.
 */
import { Graphics } from 'pixi.js';
import { Scene } from '../core/scene.js';
import { PixelText } from '../core/font.js';
import { Panel, MenuList, UI, header } from '../core/ui.js';
import { input } from '../core/input.js';
import { audio } from '../core/audio.js';
import { shop as shopDef } from '../data/shops.js';
import { ITEMS, itemName, sellPrice, ELEMENT_LABEL } from '../data/items.js';
import { priceMultiplier } from '../systems/worldstate.js';

export class ShopScene extends Scene {
  onEnter(params) {
    this.controlScheme = 'menu';
    this.overlay = true;
    const { width, height, state } = this.game;
    this.shopId = params.shopId;
    this.def = shopDef(this.shopId);
    this.priceMul = priceMultiplier(state, this.shopId, this.def.priceMod ?? 1);

    const shade = new Graphics();
    shade.eventMode = 'none';
    shade.rect(0, 0, width, height).fill({ color: 0x050c14, alpha: 0.85 });
    this.addChild(shade);

    this.head = header(this.def.name.toUpperCase(), width);
    this.addChild(this.head);

    this.goldText = new PixelText({ text: '', color: UI.accent });
    this.goldText.y = 9;
    this.addChild(this.goldText);

    this.leftPanel = new Panel(480, height - 116);
    this.leftPanel.x = 18;
    this.leftPanel.y = 84;
    this.addChild(this.leftPanel);

    this.rightPanel = new Panel(width - 534, height - 116);
    this.rightPanel.x = 516;
    this.rightPanel.y = 84;
    this.addChild(this.rightPanel);

    this.detail = new PixelText({ text: '', color: UI.ink, maxWidth: width - 576 });
    this.detail.x = 540;
    this.detail.y = 102;
    this.addChild(this.detail);

    this.compare = new PixelText({ text: '', color: UI.dim, maxWidth: width - 576 });
    this.compare.x = 540;
    this.compare.y = 276;
    this.addChild(this.compare);

    this.keeperLine = new PixelText({ text: this.def.greeting, color: UI.dim, maxWidth: width - 576 });
    this.keeperLine.x = 540;
    this.keeperLine.y = height - 30;
    this.addChild(this.keeperLine);

    this.list = new MenuList({
      items: [], width: 438, rows: Math.max(3, Math.floor((this.game.height - 200) / this.game.touchUnit)), rowHeight: this.game.touchUnit,
      touchHeight: this.game.touchUnit,
      onSelect: (item) => this.onSelect(item),
      onCancel: () => this.onCancel(),
      onMove: (item) => this.renderDetail(item),
    });
    this.list.x = 42;
    this.list.y = 102;
    this.addChild(this.list);

    this.mode = 'root';
    this.refresh();
  }

  price(id) { return Math.max(1, Math.round((ITEMS[id]?.price ?? 0) * this.priceMul)); }

  refresh() {
    const { state } = this.game;
    this.goldText.text = `¤ ${state.gold}`;
    this.goldText.x = this.game.width - 24 - this.goldText.textWidth;
    this.list.setItems(this.itemsForMode(), false);
    this.renderDetail(this.list.current);
  }

  itemsForMode() {
    const { state } = this.game;
    if (this.mode === 'root') {
      return [
        { label: 'Buy', value: 'buy' },
        { label: 'Sell', value: 'sell' },
        { label: 'Leave', value: 'leave' },
      ];
    }
    if (this.mode === 'buy') {
      const stock = this.def.stock.filter((s) => !s.flag || state.flag(s.flag));
      const rows = stock.map((s) => {
        const cost = this.price(s.item);
        return {
          label: itemName(s.item),
          right: `${cost}`,
          value: s.item,
          itemId: s.item,
          disabled: state.gold < cost,
          rightColor: state.gold < cost ? UI.bad : UI.dim,
        };
      });
      rows.push({ label: '← back', value: 'back' });
      return rows;
    }
    // sell
    const owned = state.itemsOfKind('consumable', 'weapon', 'coat', 'trinket')
      .filter((it) => !it.unique && it.price > 0)
      .map((it) => ({
        label: `${it.name} x${it.count}`,
        right: `${sellPrice(it.id)}`,
        value: it.id,
        itemId: it.id,
      }));
    if (!owned.length) owned.push({ label: 'Nothing you can part with.', disabled: true });
    owned.push({ label: '← back', value: 'back' });
    return owned;
  }

  renderDetail(item) {
    const { state } = this.game;
    if (!item?.itemId) {
      this.detail.text = this.mode === 'root'
        ? 'Trade, or take your business elsewhere.'
        : '';
      this.compare.text = '';
      return;
    }
    const def = ITEMS[item.itemId];
    const lines = [def.name, '', def.desc];
    this.detail.text = lines.join('\n');

    const parts = [];
    if (def.stats) {
      for (const [k, v] of Object.entries(def.stats)) parts.push(`${k.toUpperCase()} +${v}`);
    }
    if (def.element) parts.push(`Element: ${ELEMENT_LABEL[def.element]}`);
    if (def.resist?.length) parts.push(`Resists: ${def.resist.map((e) => ELEMENT_LABEL[e]).join(', ')}`);
    if (def.slot) {
      const who = def.user ? state.member(def.user) : null;
      if (who) {
        const current = ITEMS[who.equip[def.slot]];
        parts.push('');
        parts.push(`${who.name} carries: ${current ? current.name : 'nothing'}`);
        for (const [k, v] of Object.entries(def.stats ?? {})) {
          const now = current?.stats?.[k] ?? 0;
          const d = v - now;
          parts.push(`  ${k.toUpperCase()} ${d >= 0 ? '+' : ''}${d}`);
        }
      } else if (!def.user) {
        parts.push('');
        parts.push('Fits any of the crew.');
      }
    }
    if (this.mode === 'buy') parts.push('', `Owned: ${state.countItem(item.itemId)}`);
    this.compare.text = parts.join('\n');
  }

  onSelect(item) {
    const { state } = this.game;
    if (item.value === 'back') { this.mode = 'root'; this.refresh(); return; }
    if (this.mode === 'root') {
      if (item.value === 'leave') { this.game.scenes.pop(); return; }
      this.mode = item.value;
      this.refresh();
      return;
    }
    if (this.mode === 'buy') {
      const cost = this.price(item.itemId);
      if (!state.spendGold(cost)) { audio.play('deny'); return; }
      state.addItem(item.itemId, 1);
      audio.play('coin');
      this.keeperLine.text = `"${itemName(item.itemId)}. Good pick."`;
      this._keep = this.list.index;
      this.refresh();
      this.list.index = Math.min(this._keep, this.list.itemsData.length - 1);
      this.list.refresh();
      this.renderDetail(this.list.current);
      return;
    }
    // sell
    const gain = sellPrice(item.itemId);
    if (!state.hasItem(item.itemId)) { audio.play('deny'); return; }
    state.removeItem(item.itemId, 1);
    state.addGold(gain);
    audio.play('coin');
    this.keeperLine.text = `"${gain} coin. No questions."`;
    this._keep = this.list.index;
    this.refresh();
    this.list.index = Math.min(this._keep, this.list.itemsData.length - 1);
    this.list.refresh();
    this.renderDetail(this.list.current);
  }

  onCancel() {
    if (this.mode !== 'root') { this.mode = 'root'; this.refresh(); return; }
    this.keeperLine.text = this.def.farewell;
    this.game.scenes.pop();
  }

  update(dtMS) {
    this.list.update(dtMS);
    this.list.handleInput(input);
  }
}
