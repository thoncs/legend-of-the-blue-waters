/**
 * Reusable UI widgets: framed panels, bars, keyboard+mouse menus, the
 * dialogue box, and floating combat popups. Everything is built from
 * Graphics and PixelText so it stays crisp at the virtual resolution.
 */
import { Container, Graphics, Sprite } from 'pixi.js';
import { PixelText, measure, ADVANCE, LINE_H, wrapIndices, parseMarkup } from './font.js';
import { PAL } from './art.js';
import { audio } from './audio.js';

export const UI = {
  frame: 0x9fd8ff,
  frameDim: 0x3f6f92,
  fill: 0x101f2e,
  fillLit: 0x1a3550,
  ink: 0xf2f6e8,
  dim: 0x8fa8bc,
  accent: 0xffd45e,
  good: 0x74c74d,
  bad: 0xff7a6a,
  mp: 0x7fb8ff,
  hp: 0x74c74d,
  hpLow: 0xffb03a,
  hpCrit: 0xff5a4a,
};

/** Paint a classic double-lined window into `g`. */
export function drawPanel(g, w, h, opts = {}) {
  const {
    fill = UI.fill,
    frame = UI.frame,
    frameDim = UI.frameDim,
    alpha = 0.94,
  } = opts;
  g.clear();
  g.rect(0, 0, w, h).fill({ color: 0x000000, alpha: alpha * 0.55 });
  g.rect(1, 1, w - 2, h - 2).fill({ color: fill, alpha });
  g.rect(1, 1, w - 2, 1).fill({ color: UI.fillLit, alpha });
  g.rect(0, 0, w, h).stroke({ color: frameDim, width: 1, alignment: 0 });
  g.rect(2, 2, w - 4, h - 4).stroke({ color: frame, width: 1, alignment: 0 });
  // Corner studs sell the "carved frame" look.
  for (const [cx, cy] of [[2, 2], [w - 3, 2], [2, h - 3], [w - 3, h - 3]]) {
    g.rect(cx, cy, 1, 1).fill(UI.accent);
  }
  return g;
}

export class Panel extends Container {
  constructor(w, h, opts = {}) {
    super();
    this.bg = new Graphics();
    this.addChild(this.bg);
    this.panelWidth = w;
    this.panelHeight = h;
    this.opts = opts;
    drawPanel(this.bg, w, h, opts);
    if (opts.title) {
      this.titleText = new PixelText({ text: opts.title, color: UI.accent });
      this.titleText.x = 7;
      this.titleText.y = 2;
      this.addChild(this.titleText);
    }
  }

  resize(w, h) {
    this.panelWidth = w;
    this.panelHeight = h;
    drawPanel(this.bg, w, h, this.opts);
  }
}

/** Horizontal stat bar with an optional inline label. */
export class Bar extends Container {
  constructor(w, h = 4, color = UI.hp) {
    super();
    this.w = w;
    this.h = h;
    this.color = color;
    this.g = new Graphics();
    this.addChild(this.g);
    this.value = 1;
    this.draw(1);
  }

  /** @param {number} ratio 0..1 */
  draw(ratio) {
    this.value = Math.max(0, Math.min(1, ratio));
    const { w, h } = this;
    const g = this.g;
    g.clear();
    g.rect(0, 0, w, h).fill(0x081018);
    g.rect(1, 1, w - 2, h - 2).fill(0x1c3346);
    const inner = Math.round((w - 2) * this.value);
    if (inner > 0) {
      g.rect(1, 1, inner, h - 2).fill(this.color);
      g.rect(1, 1, inner, 1).fill({ color: 0xffffff, alpha: 0.35 });
    }
  }

  setColorByRatio(r) {
    this.color = r > 0.5 ? UI.hp : r > 0.22 ? UI.hpLow : UI.hpCrit;
  }
}

/**
 * Keyboard-and-mouse driven list. Rows can be laid out in multiple columns
 * (used by the item grid and the shop).
 */
export class MenuList extends Container {
  constructor(opts = {}) {
    super();
    const {
      items = [],
      width = 120,
      rows = 6,
      columns = 1,
      rowHeight = 12,
      onSelect = null,
      onCancel = null,
      onMove = null,
      wrap = true,
      showCursor = true,
    } = opts;

    this.itemsData = items;
    this.listWidth = width;
    this.rowsVisible = rows;
    this.columns = columns;
    this.rowHeight = rowHeight;
    this.onSelect = onSelect;
    this.onCancel = onCancel;
    this.onMove = onMove;
    this.wrapNav = wrap;
    this.index = 0;
    this.scroll = 0;
    this.enabled = true;

    this.rowsLayer = new Container();
    this.addChild(this.rowsLayer);

    this.cursorSprite = new PixelText({ text: '▶', color: UI.accent });
    this.cursorSprite.visible = showCursor;
    this.addChild(this.cursorSprite);
    this._cursorBlink = 0;

    /** @type {Array<{root:Container,label:PixelText,right:PixelText|null}>} */
    this._rows = [];
    this.rebuild();
  }

  get colWidth() { return Math.floor(this.listWidth / this.columns); }
  get current() { return this.itemsData[this.index] ?? null; }

  setItems(items, keepIndex = false) {
    this.itemsData = items;
    if (!keepIndex) { this.index = 0; this.scroll = 0; }
    this.index = Math.min(this.index, Math.max(0, items.length - 1));
    this.rebuild();
  }

  rebuild() {
    const capacity = this.rowsVisible * this.columns;
    // Pool row containers; only ever build as many as fit on screen.
    while (this._rows.length < capacity) {
      const root = new Container();
      const label = new PixelText({ text: '', color: UI.ink });
      const right = new PixelText({ text: '', color: UI.dim });
      root.addChild(label, right);
      root.eventMode = 'static';
      root.cursor = 'pointer';
      const slot = this._rows.length;
      root.on('pointerover', () => this._pointerFocus(slot));
      root.on('pointertap', () => this._pointerSelect(slot));
      this.rowsLayer.addChild(root);
      this._rows.push({ root, label, right });
    }
    this.refresh();
  }

  _slotToIndex(slot) {
    const col = Math.floor(slot / this.rowsVisible);
    const row = slot % this.rowsVisible;
    return this.scroll + col * this.rowsVisible + row;
  }

  _pointerFocus(slot) {
    if (!this.enabled) return;
    const idx = this._slotToIndex(slot);
    if (idx >= 0 && idx < this.itemsData.length && idx !== this.index) {
      this.index = idx;
      this.refresh();
      audio.play('cursor');
      this.onMove?.(this.current, this.index);
    }
  }

  _pointerSelect(slot) {
    if (!this.enabled) return;
    const idx = this._slotToIndex(slot);
    if (idx < 0 || idx >= this.itemsData.length) return;
    this.index = idx;
    this.refresh();
    this._activate();
  }

  _activate() {
    const item = this.current;
    if (!item) return;
    if (item.disabled) { audio.play('deny'); return; }
    audio.play('confirm');
    this.onSelect?.(item, this.index);
  }

  refresh() {
    const total = this.itemsData.length;
    const perPage = this.rowsVisible * this.columns;
    // Keep the cursor inside the visible window.
    const localIndex = this.index - this.scroll;
    if (localIndex < 0) this.scroll = this.index - (this.index % this.rowsVisible);
    else if (localIndex >= perPage) {
      this.scroll = (Math.floor(this.index / this.rowsVisible) - this.columns + 1) * this.rowsVisible;
    }
    this.scroll = Math.max(0, Math.min(this.scroll, Math.max(0, total - perPage)));
    this.scroll -= this.scroll % this.rowsVisible;

    for (let slot = 0; slot < this._rows.length; slot++) {
      const { root, label, right } = this._rows[slot];
      const idx = this._slotToIndex(slot);
      const item = this.itemsData[idx];
      if (!item) { root.visible = false; continue; }
      root.visible = true;
      const col = Math.floor(slot / this.rowsVisible);
      const row = slot % this.rowsVisible;
      root.x = col * this.colWidth;
      root.y = row * this.rowHeight;
      root.hitArea = { contains: (px, py) => px >= 0 && py >= 0 && px <= this.colWidth && py <= this.rowHeight };

      label.text = item.label ?? '';
      label.x = 8;
      label.y = 0;
      const selected = idx === this.index;
      label.color = item.disabled ? 0x5f7386 : selected ? UI.accent : UI.ink;

      if (item.right) {
        right.visible = true;
        right.text = item.right;
        right.color = item.rightColor ?? (item.disabled ? 0x5f7386 : UI.dim);
        right.x = this.colWidth - 6 - measure(item.right);
        right.y = 0;
      } else {
        right.visible = false;
      }
    }

    const curCol = Math.floor((this.index - this.scroll) / this.rowsVisible);
    const curRow = (this.index - this.scroll) % this.rowsVisible;
    this.cursorSprite.x = curCol * this.colWidth;
    this.cursorSprite.y = curRow * this.rowHeight;
    this.cursorSprite.visible = this.itemsData.length > 0;
  }

  move(delta) {
    const total = this.itemsData.length;
    if (!total) return;
    let next = this.index + delta;
    if (this.wrapNav) next = (next + total) % total;
    else next = Math.max(0, Math.min(total - 1, next));
    if (next === this.index) return;
    this.index = next;
    this.refresh();
    audio.play('cursor');
    this.onMove?.(this.current, this.index);
  }

  /** Feed the shared input object; returns true if the menu consumed it. */
  handleInput(input) {
    if (!this.enabled) return false;
    let used = false;
    if (input.repeat('down')) { this.move(1); used = true; }
    if (input.repeat('up')) { this.move(-1); used = true; }
    if (this.columns > 1) {
      if (input.repeat('right')) { this.move(this.rowsVisible); used = true; }
      if (input.repeat('left')) { this.move(-this.rowsVisible); used = true; }
    }
    if (input.justPressed('confirm')) { this._activate(); used = true; }
    if (input.justPressed('cancel')) {
      audio.play('cancel');
      this.onCancel?.();
      used = true;
    }
    return used;
  }

  update(dtMS) {
    this._cursorBlink += dtMS;
    this.cursorSprite.alpha = 0.55 + 0.45 * Math.abs(Math.sin(this._cursorBlink / 260));
  }
}

/** Scrolling, typewritten dialogue window with a speaker nameplate. */
export class DialogueBox extends Container {
  constructor(width = 368, lines = 3) {
    super();
    this.boxWidth = width;
    this.lineCount = lines;
    this.height_ = lines * LINE_H + 14;

    this.panel = new Panel(width, this.height_);
    this.addChild(this.panel);

    this.namePanel = new Panel(10, 14);
    this.namePanel.y = -13;
    this.namePanel.x = 4;
    this.addChild(this.namePanel);
    this.nameText = new PixelText({ text: '', color: UI.accent });
    this.nameText.x = 9;
    this.nameText.y = -9;
    this.addChild(this.nameText);

    this.body = new PixelText({
      text: '',
      color: UI.ink,
      maxWidth: width - 16,
      lineHeight: LINE_H,
    });
    this.body.x = 8;
    this.body.y = 7;
    this.addChild(this.body);

    this.more = new PixelText({ text: '▼', color: UI.accent });
    this.more.x = width - 12;
    this.more.y = this.height_ - 11;
    this.addChild(this.more);
    this.more.visible = false;

    this.charsPerSecond = 55;
    this._elapsed = 0;
    this._pages = [];
    this._page = 0;
    this._done = true;
    this._blink = 0;
  }

  get isFinished() { return this._done && this._page >= this._pages.length - 1; }
  get isPageComplete() { return this._revealed >= this.body.charCount; }

  setSpeaker(name) {
    const has = !!name;
    this.namePanel.visible = has;
    this.nameText.visible = has;
    if (has) {
      this.nameText.text = name;
      this.namePanel.resize(this.nameText.textWidth + 10, 14);
    }
  }

  /** Show `text`, split into pages that fit the window. */
  show(text, speaker = '') {
    this.setSpeaker(speaker);
    const { plain } = parseMarkup(text);
    const lines = wrapIndices(plain, this.boxWidth - 16);
    // Re-slice the original (markup intact) text into page-sized chunks.
    this._pages = [];
    let chunk = [];
    for (let i = 0; i < lines.length; i++) {
      chunk.push(lines[i]);
      if (chunk.length === this.lineCount) {
        this._pages.push(this._chunkToMarkup(text, plain, chunk));
        chunk = [];
      }
    }
    if (chunk.length) this._pages.push(this._chunkToMarkup(text, plain, chunk));
    if (!this._pages.length) this._pages = [''];
    this._page = 0;
    this._showPage();
  }

  /** Rebuild a page string, re-inserting the `[[accent]]` markers. */
  _chunkToMarkup(source, plain, lines) {
    const { flags } = parseMarkup(source);
    let out = '';
    let on = false;
    for (let li = 0; li < lines.length; li++) {
      if (li > 0) out += '\n';
      for (const idx of lines[li]) {
        const ch = idx < 0 ? ' ' : plain[idx];
        const want = idx >= 0 && flags[idx] === true;
        if (want && !on) { out += '[['; on = true; }
        if (!want && on) { out += ']]'; on = false; }
        out += ch;
      }
    }
    if (on) out += ']]';
    return out;
  }

  _showPage() {
    this.body.text = this._pages[this._page] ?? '';
    this._revealed = 0;
    this._elapsed = 0;
    this._done = false;
    this.body.reveal(0);
    this.more.visible = false;
  }

  /** Confirm pressed: finish the reveal, or turn the page. @returns true when the whole message is done. */
  advance() {
    if (!this._done) {
      this._revealed = this.body.charCount;
      this.body.reveal(this._revealed);
      this._done = true;
      return false;
    }
    if (this._page < this._pages.length - 1) {
      this._page++;
      this._showPage();
      audio.play('cursor');
      return false;
    }
    return true;
  }

  update(dtMS) {
    this._blink += dtMS;
    if (!this._done) {
      this._elapsed += dtMS;
      const target = Math.floor((this._elapsed / 1000) * this.charsPerSecond);
      if (target !== this._revealed) {
        this._revealed = target;
        this.body.reveal(target);
      }
      if (this._revealed >= this.body.charCount) this._done = true;
    } else {
      this.more.visible = true;
      this.more.y = this.height_ - 11 + (Math.sin(this._blink / 220) > 0 ? 0 : 1);
      this.more.alpha = 0.6 + 0.4 * Math.abs(Math.sin(this._blink / 300));
    }
  }
}

/** Floating text that drifts upward and fades; used for damage and pickups. */
export class Popup extends PixelText {
  constructor(text, color, opts = {}) {
    super({ text, color, shadow: true, align: 'center' });
    this.life = 0;
    this.duration = opts.duration ?? 800;
    this.rise = opts.rise ?? 18;
    this.startX = 0;
    this.startY = 0;
    this.scaleUp = opts.scaleUp ?? false;
  }

  place(x, y) {
    this.startX = x - this.textWidth / 2;
    this.startY = y;
    this.x = this.startX;
    this.y = this.startY;
    return this;
  }

  /** @returns true when the popup has expired */
  step(dtMS) {
    this.life += dtMS;
    const t = Math.min(1, this.life / this.duration);
    this.y = this.startY - this.rise * (1 - Math.pow(1 - t, 2.2));
    this.alpha = t > 0.65 ? 1 - (t - 0.65) / 0.35 : 1;
    if (this.scaleUp) {
      const pop = t < 0.16 ? 1 + (0.16 - t) * 3 : 1;
      this.scale.set(pop);
    }
    return t >= 1;
  }
}

/** Small helper: a labelled key/value line used across menus. */
export function statLine(labelText, valueText, width, opts = {}) {
  const row = new Container();
  const l = new PixelText({ text: labelText, color: opts.labelColor ?? UI.dim });
  const v = new PixelText({ text: valueText, color: opts.valueColor ?? UI.ink });
  v.x = width - measure(valueText);
  row.addChild(l, v);
  row.labelText = l;
  row.valueText = v;
  return row;
}

/** A full-width header strip used at the top of full-screen menus. */
export function header(title, width) {
  const c = new Container();
  const g = new Graphics();
  g.rect(0, 0, width, 13).fill({ color: 0x0b1a2a, alpha: 0.95 });
  g.rect(0, 13, width, 1).fill(UI.frameDim);
  c.addChild(g);
  const t = new PixelText({ text: title, color: UI.accent });
  t.x = 6; t.y = 3;
  c.addChild(t);
  c.titleText = t;
  return c;
}

/** Blinking "press confirm" hint. */
export class Blinker extends PixelText {
  constructor(text, color = UI.dim) {
    super({ text, color });
    this._t = 0;
  }
  update(dtMS) {
    this._t += dtMS;
    this.alpha = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(this._t / 380));
  }
}

/** Reusable icon-ish sprite factory for menus (uses generated art). */
export function iconSprite(art, name, scale = 1) {
  const s = new Sprite(art.tex(name));
  s.scale.set(scale);
  return s;
}

export { ADVANCE, LINE_H, measure };
