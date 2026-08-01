/**
 * All original artwork for the game, drawn in code into one texture atlas.
 *
 * Nothing here is loaded from disk: tiles, characters, ships, objects and
 * effects are painted pixel by pixel onto an offscreen canvas at boot, then
 * sliced into sub-textures that all share a single GPU texture (so the whole
 * world batches into very few draw calls).
 */
import { Rectangle, Texture, TextureSource } from 'pixi.js';
import { drawBattler, BATTLER_ART } from './battlers.js';

export const TILE = 16;

/** The game's whole colour vocabulary. Keep additions rare so art stays cohesive. */
export const PAL = {
  black: '#080e16',
  ink: '#101f2e',
  shadow: '#0b1420',
  deep: '#0f2f47',
  sea: '#1b5675',
  seaLit: '#27789a',
  teal: '#3fb8b0',
  foam: '#93e6dc',
  pale: '#cdeff0',
  white: '#f2f6e8',
  bone: '#ddd6bb',
  boneDark: '#a89f80',

  sand: '#e8cf9a',
  sandDark: '#c8a76a',
  sandWet: '#a98a58',
  dirt: '#8a6a44',

  wood: '#6b452b',
  woodLit: '#8f6039',
  woodPale: '#b08050',

  grass: '#4f9e3f',
  grassDark: '#397a30',
  grassLit: '#74c74d',
  jungle: '#2c5f2a',
  jungleDark: '#1c4220',
  leaf: '#6fc24a',

  rock: '#6b7079',
  rockDark: '#464b54',
  stone: '#8d9099',
  stoneLit: '#aab0b8',
  moss: '#5c7a44',

  lava: '#ff6a2b',
  ember: '#ffb03a',
  emberPale: '#ffe08a',
  ash: '#584e49',
  ashDark: '#332e2b',

  swamp: '#2f4a38',
  swampDark: '#1d3025',
  swampLit: '#4a6b4a',

  coral: '#e0736f',
  coralLit: '#f4a3a0',
  coralDeep: '#a8434f',

  night: '#1b2a4a',
  moon: '#c9e6ff',
  ghost: '#9fd8ff',
  ghostDim: '#5f8fb8',
  spirit: '#b9a6ff',

  gold: '#ffd45e',
  copper: '#c8813a',
  iron: '#9aa2ad',
  blood: '#b8354a',
  wine: '#792438',
  royal: '#3a6fb0',
  violet: '#6b4fa0',
};

/* ------------------------------------------------------------------ *
 * Atlas plumbing
 * ------------------------------------------------------------------ */

/** Cheap deterministic hash noise so speckle patterns are stable per tile. */
function noise(x, y, seed = 0) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** 2048 is the texture size every WebGL implementation is required to support. */
const ATLAS_W = 2048;
const ATLAS_MAX_H = 2048;

class ShelfAtlas {
  constructor(width = ATLAS_W, maxHeight = ATLAS_MAX_H) {
    this.width = width;
    this.maxHeight = maxHeight;
    /** Shelf state per page; art at 3x is close enough to the cap to need it. */
    this.pages = [ShelfAtlas._page()];
    /** @type {Map<string, {page:number,x:number,y:number,w:number,h:number}>} */
    this.regions = new Map();
  }

  static _page() {
    return { x: 0, y: 0, rowH: 0, pending: [], canvas: null };
  }

  /** Reserve a w*h slot named `name`; `draw(ctx, x, y)` paints into it. */
  add(name, w, h, draw) {
    if (w > this.width || h > this.maxHeight) {
      throw new Error(`art: sprite "${name}" (${w}x${h}) does not fit an atlas page`);
    }
    let index = this.pages.length - 1;
    let page = this.pages[index];

    if (page.x + w > this.width) {
      page.x = 0;
      page.y += page.rowH + 1;
      page.rowH = 0;
    }
    // Out of vertical room: start a fresh page rather than overflowing silently.
    if (page.y + h + 1 > this.maxHeight) {
      this.pages.push(ShelfAtlas._page());
      index = this.pages.length - 1;
      page = this.pages[index];
    }

    const slot = { page: index, x: page.x, y: page.y, w, h };
    this.regions.set(name, slot);
    page.pending.push({ slot, draw });
    page.x += w + 1;
    page.rowH = Math.max(page.rowH, h);
    return slot;
  }

  bake() {
    const sources = [];
    for (let i = 0; i < this.pages.length; i++) {
      const page = this.pages[i];
      const canvas = document.createElement('canvas');
      canvas.width = this.width;
      canvas.height = Math.max(64, Math.min(this.maxHeight, page.y + page.rowH + 1));
      const ctx = canvas.getContext('2d', { willReadFrequently: false });
      ctx.imageSmoothingEnabled = false;
      for (const { slot, draw } of page.pending) {
        ctx.save();
        draw(ctx, slot.x, slot.y);
        ctx.restore();
      }
      page.pending.length = 0;
      page.canvas = canvas;

      const base = Texture.from(canvas);
      base.source.scaleMode = 'nearest';
      base.source.label = `world-atlas-${i}`;
      sources.push(base);
    }

    const frames = new Map();
    for (const [name, r] of this.regions) {
      frames.set(name, new Texture({
        source: sources[r.page].source,
        frame: new Rectangle(r.x, r.y, r.w, r.h),
        label: name,
      }));
    }
    return { base: sources[0], pages: sources, frames, canvases: this.pages.map((p) => p.canvas) };
  }
}

/** Small painting facade bound to an atlas slot origin. */
function pen(ctx, ox, oy, w = TILE, h = TILE) {
  return {
    w, h,
    fill(color) { ctx.fillStyle = color; ctx.fillRect(ox, oy, w, h); },
    px(x, y, color) {
      const ix = Math.round(x);
      const iy = Math.round(y);
      if (ix < 0 || iy < 0 || ix >= w || iy >= h) return;
      ctx.fillStyle = color;
      ctx.fillRect(ox + ix, oy + iy, 1, 1);
    },
    rect(x, y, rw, rh, color) {
      // Clip to the slot so a sprite can never bleed into its neighbour.
      const x0 = Math.max(0, Math.round(x));
      const y0 = Math.max(0, Math.round(y));
      const x1 = Math.min(w, Math.round(x + rw));
      const y1 = Math.min(h, Math.round(y + rh));
      if (x1 <= x0 || y1 <= y0) return;
      ctx.fillStyle = color;
      ctx.fillRect(ox + x0, oy + y0, x1 - x0, y1 - y0);
    },
    line(x0, y0, x1, y1, color) {
      const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
      const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
      let err = dx - dy, x = x0, y = y0;
      for (let guard = 0; guard < 256; guard++) {
        this.px(x, y, color);
        if (x === x1 && y === y1) break;
        const e2 = 2 * err;
        if (e2 > -dy) { err -= dy; x += sx; }
        if (e2 < dx) { err += dx; y += sy; }
      }
    },
    ellipse(cx, cy, rx, ry, color) {
      const RX = Math.max(1, Math.round(rx));
      const RY = Math.max(1, Math.round(ry));
      const CX = Math.round(cx);
      const CY = Math.round(cy);
      for (let y = -RY; y <= RY; y++) {
        for (let x = -RX; x <= RX; x++) {
          if ((x * x) / (RX * RX) + (y * y) / (RY * RY) <= 1.05) this.px(CX + x, CY + y, color);
        }
      }
    },
    /** Sprinkle `color` across the slot with the given probability. */
    speckle(color, density, seed = 0) {
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (noise(x, y, seed) < density) this.px(x, y, color);
        }
      }
    },
    /** Dither the bottom `rows` of the slot toward `color`. */
    shade(color, alphaRows) {
      for (let y = 0; y < alphaRows; y++) {
        for (let x = 0; x < w; x++) {
          if ((x + y) % 2 === 0) this.px(x, h - 1 - y, color);
        }
      }
    },
  };
}

/* ------------------------------------------------------------------ *
 * Terrain tiles
 * ------------------------------------------------------------------ */

function water(p, frame, base, lit, crest, seed) {
  p.fill(base);
  // Long horizontal swells rather than noise: water should read as water at
  // 16px, not as static.
  for (let y = 0; y < TILE; y++) {
    const swell = Math.sin(y * 0.62 + frame * 1.9 + seed * 0.11);
    if (swell > 0.45) {
      const start = (Math.floor(swell * 9) + frame * 3 + seed) % TILE;
      const len = 3 + Math.floor(noise(y, seed, frame) * 4);
      for (let i = 0; i < len; i++) p.px((start + i) % TILE, y, lit);
    }
  }
  // Exactly one drifting crest dash per tile: enough to sparkle, not enough
  // to turn a whole ocean into static.
  const cy = (frame * 5 + seed) % TILE;
  const cx = (Math.floor(noise(1, frame, seed) * TILE) + frame * 4) % TILE;
  p.px(cx, cy, crest);
  p.px((cx + 1) % TILE, cy, crest);
}

const TILE_ART = {
  /* --- open water (3-frame shimmer) --- */
  water0: (p) => water(p, 0, PAL.sea, PAL.seaLit, PAL.foam, 11),
  water1: (p) => water(p, 1, PAL.sea, PAL.seaLit, PAL.foam, 11),
  water2: (p) => water(p, 2, PAL.sea, PAL.seaLit, PAL.foam, 11),
  deep0: (p) => water(p, 0, PAL.deep, PAL.sea, PAL.seaLit, 23),
  deep1: (p) => water(p, 1, PAL.deep, PAL.sea, PAL.seaLit, 23),
  deep2: (p) => water(p, 2, PAL.deep, PAL.sea, PAL.seaLit, 23),
  shallow0: (p) => water(p, 0, PAL.seaLit, PAL.teal, PAL.pale, 31),
  shallow1: (p) => water(p, 1, PAL.seaLit, PAL.teal, PAL.pale, 31),
  shallow2: (p) => water(p, 2, PAL.seaLit, PAL.teal, PAL.pale, 31),
  moonsea0: (p) => water(p, 0, '#16294a', '#25406e', PAL.moon, 41),
  moonsea1: (p) => water(p, 1, '#16294a', '#25406e', PAL.moon, 41),
  moonsea2: (p) => water(p, 2, '#16294a', '#25406e', PAL.moon, 41),

  /* --- shoreline & ground --- */
  sand: (p) => { p.fill(PAL.sand); p.speckle(PAL.sandDark, 0.10, 3); p.speckle(PAL.white, 0.03, 9); },
  sandWet: (p) => { p.fill(PAL.sandDark); p.speckle(PAL.sandWet, 0.14, 5); },
  shore: (p) => {
    p.fill(PAL.sand);
    p.speckle(PAL.sandDark, 0.08, 4);
    p.rect(0, 12, 16, 4, PAL.seaLit);
    for (let x = 0; x < 16; x++) if (noise(x, 0, 7) > 0.5) p.px(x, 11, PAL.foam);
  },
  grass: (p) => {
    p.fill(PAL.grass);
    p.speckle(PAL.grassDark, 0.12, 2);
    p.speckle(PAL.grassLit, 0.06, 6);
    p.px(3, 5, PAL.grassDark); p.px(3, 4, PAL.grassDark);
    p.px(11, 10, PAL.grassDark); p.px(11, 9, PAL.grassDark);
  },
  grassTall: (p) => {
    p.fill(PAL.grass);
    p.speckle(PAL.grassDark, 0.1, 8);
    for (let x = 1; x < 16; x += 3) {
      const hgt = 4 + Math.floor(noise(x, 1, 12) * 4);
      for (let y = 0; y < hgt; y++) p.px(x, 15 - y, y % 2 ? PAL.grassLit : PAL.grassDark);
    }
  },
  flowers: (p) => {
    p.fill(PAL.grass);
    p.speckle(PAL.grassDark, 0.1, 14);
    const cols = [PAL.gold, PAL.coralLit, PAL.pale];
    for (let i = 0; i < 5; i++) {
      const x = 2 + Math.floor(noise(i, 3, 21) * 12);
      const y = 2 + Math.floor(noise(i, 9, 21) * 12);
      p.px(x, y, cols[i % 3]);
      p.px(x, y + 1, PAL.grassDark);
    }
  },
  jungleFloor: (p) => {
    p.fill(PAL.jungleDark);
    p.speckle(PAL.jungle, 0.3, 15);
    p.speckle(PAL.moss, 0.08, 27);
  },
  dirtPath: (p) => { p.fill(PAL.dirt); p.speckle(PAL.sandWet, 0.16, 17); p.speckle(PAL.wood, 0.08, 19); },

  /* --- blocking scenery --- */
  jungleTree: (p) => {
    p.fill(PAL.jungleDark);
    for (let i = 0; i < 22; i++) {
      const x = Math.floor(noise(i, 1, 33) * 16);
      const y = Math.floor(noise(i, 2, 33) * 16);
      p.ellipse(x, y, 2, 2, i % 3 ? PAL.jungle : PAL.leaf);
    }
    p.rect(7, 11, 2, 5, PAL.wood);
  },
  palm: (p) => {
    p.fill('#00000000');
    p.rect(7, 7, 2, 9, PAL.wood);
    p.px(7, 10, PAL.woodLit); p.px(8, 13, PAL.woodLit);
    const frond = [[-6, -1], [-4, -3], [-1, -4], [2, -4], [5, -3], [7, -1]];
    for (const [dx, dy] of frond) {
      p.line(8, 7, 8 + dx, 7 + dy, PAL.leaf);
      p.px(8 + dx, 7 + dy + 1, PAL.jungle);
    }
    p.px(7, 6, PAL.copper); p.px(9, 6, PAL.copper);
  },
  bush: (p) => {
    p.ellipse(8, 10, 6, 5, PAL.jungle);
    p.ellipse(6, 8, 4, 3, PAL.grassDark);
    p.ellipse(10, 9, 3, 3, PAL.leaf);
    p.rect(4, 14, 9, 1, PAL.jungleDark);
  },
  rock: (p) => {
    p.ellipse(8, 10, 6, 5, PAL.rock);
    p.ellipse(6, 8, 3, 2, PAL.stoneLit);
    p.line(9, 7, 11, 12, PAL.rockDark);
    p.rect(3, 14, 11, 1, PAL.rockDark);
  },
  vine: (p) => {
    // A wall of roots — the Whisperwood's version of a locked door.
    p.fill(PAL.jungleDark);
    p.speckle(PAL.jungle, 0.22, 301);
    for (let x = 0; x < 16; x += 3) {
      for (let y = 0; y < 16; y++) {
        const wob = Math.round(Math.sin((y + x) * 0.8) * 1.5);
        p.px(x + wob, y, y % 5 === 0 ? PAL.leaf : PAL.wood);
        p.px(x + wob + 1, y, PAL.jungleDark);
      }
    }
    p.speckle(PAL.moss, 0.07, 303);
  },
  cliff: (p) => {
    p.fill(PAL.rockDark);
    p.speckle(PAL.rock, 0.25, 43);
    p.rect(0, 0, 16, 3, PAL.rock);
    p.speckle(PAL.stone, 0.06, 51);
    for (let y = 4; y < 16; y += 4) p.line(0, y, 15, y + 1, PAL.black);
  },
  cliffTop: (p) => {
    p.fill(PAL.rock);
    p.speckle(PAL.stone, 0.2, 61);
    p.speckle(PAL.rockDark, 0.12, 62);
    p.rect(0, 13, 16, 3, PAL.rockDark);
  },

  /* --- built environment --- */
  stoneFloor: (p) => {
    p.fill(PAL.stone);
    p.speckle(PAL.stoneLit, 0.08, 71);
    p.rect(0, 7, 16, 1, PAL.rockDark);
    p.rect(0, 15, 16, 1, PAL.rockDark);
    p.rect(7, 0, 1, 8, PAL.rockDark);
    p.rect(3, 8, 1, 8, PAL.rockDark);
    p.rect(12, 8, 1, 8, PAL.rockDark);
  },
  stoneWall: (p) => {
    p.fill(PAL.rockDark);
    p.speckle(PAL.rock, 0.35, 73);
    p.rect(0, 5, 16, 1, PAL.black);
    p.rect(0, 11, 16, 1, PAL.black);
    p.rect(5, 0, 1, 6, PAL.black);
    p.rect(10, 6, 1, 6, PAL.black);
    p.rect(2, 12, 1, 4, PAL.black);
  },
  ruinFloor: (p) => {
    p.fill('#6a6257');
    p.speckle('#7d7466', 0.14, 81);
    p.speckle(PAL.moss, 0.08, 83);
    p.line(2, 3, 9, 8, PAL.ashDark);
    p.line(11, 2, 13, 12, PAL.ashDark);
  },
  ruinWall: (p) => {
    p.fill('#4a463f');
    p.speckle('#5d584f', 0.3, 91);
    p.rect(0, 6, 16, 1, PAL.black);
    p.rect(6, 0, 1, 7, PAL.black);
    p.rect(11, 7, 1, 9, PAL.black);
    p.speckle(PAL.moss, 0.05, 93);
  },
  woodFloor: (p) => {
    p.fill(PAL.wood);
    for (let y = 0; y < 16; y += 4) {
      p.rect(0, y, 16, 3, y % 8 === 0 ? PAL.woodLit : PAL.wood);
      p.rect(0, y + 3, 16, 1, PAL.shadow);
    }
    p.speckle(PAL.woodPale, 0.05, 101);
  },
  woodWall: (p) => {
    p.fill(PAL.woodLit);
    for (let x = 0; x < 16; x += 4) p.rect(x, 0, 1, 16, PAL.wood);
    p.rect(0, 0, 16, 2, PAL.woodPale);
    p.rect(0, 14, 16, 2, PAL.wood);
  },
  plaster: (p) => {
    p.fill(PAL.bone);
    p.speckle(PAL.boneDark, 0.09, 111);
    p.rect(0, 0, 16, 2, PAL.woodLit);
    p.rect(0, 7, 16, 1, PAL.woodLit);
  },
  roofRed: (p) => {
    p.fill(PAL.wine);
    for (let y = 0; y < 16; y += 4) {
      for (let x = (y % 8 === 0 ? 0 : 2); x < 16; x += 4) {
        p.rect(x, y, 3, 3, PAL.blood);
        p.px(x, y, PAL.wine);
      }
    }
  },
  roofBlue: (p) => {
    p.fill('#254a72');
    for (let y = 0; y < 16; y += 4) {
      for (let x = (y % 8 === 0 ? 0 : 2); x < 16; x += 4) {
        p.rect(x, y, 3, 3, PAL.royal);
        p.px(x, y, '#254a72');
      }
    }
  },
  roofPalm: (p) => {
    p.fill('#8a7038');
    for (let y = 0; y < 16; y += 3) {
      p.rect(0, y, 16, 2, y % 6 === 0 ? '#a68b47' : '#7a6230');
    }
    p.speckle('#c2a45c', 0.08, 121);
  },
  dock: (p) => {
    p.fill(PAL.wood);
    for (let y = 0; y < 16; y += 5) p.rect(0, y, 16, 4, y % 10 === 0 ? PAL.woodLit : PAL.wood);
    for (let y = 4; y < 16; y += 5) p.rect(0, y, 16, 1, PAL.shadow);
    p.rect(0, 0, 1, 16, PAL.shadow);
    p.rect(15, 0, 1, 16, PAL.shadow);
  },
  bridge: (p) => {
    p.fill(PAL.woodLit);
    for (let y = 0; y < 16; y += 4) p.rect(0, y, 16, 1, PAL.wood);
    p.rect(0, 0, 16, 2, PAL.woodPale);
    p.rect(0, 14, 16, 2, PAL.woodPale);
  },

  /* --- volcanic --- */
  lava: (p) => {
    p.fill(PAL.lava);
    p.speckle(PAL.ember, 0.2, 131);
    p.speckle(PAL.emberPale, 0.06, 133);
    p.speckle(PAL.ashDark, 0.07, 137);
  },
  lavaRock: (p) => {
    p.fill(PAL.ashDark);
    p.speckle(PAL.ash, 0.28, 141);
    p.line(2, 12, 7, 4, PAL.lava);
    p.line(9, 13, 12, 6, PAL.ember);
  },
  ashGround: (p) => { p.fill(PAL.ash); p.speckle(PAL.ashDark, 0.2, 151); p.speckle('#726860', 0.08, 153); },
  obsidian: (p) => { p.fill('#221d22'); p.speckle('#3b3140', 0.18, 161); p.speckle(PAL.violet, 0.03, 163); },

  /* --- mangrove / swamp --- */
  swampWater: (p) => {
    p.fill(PAL.swamp);
    p.speckle(PAL.swampDark, 0.2, 171);
    p.speckle(PAL.swampLit, 0.08, 173);
    p.px(4, 6, PAL.moss); p.px(5, 6, PAL.moss); p.px(11, 11, PAL.moss);
  },
  swampGround: (p) => { p.fill('#4a4a34'); p.speckle('#5f5c3e', 0.2, 181); p.speckle(PAL.swampDark, 0.12, 183); },
  mangrove: (p) => {
    p.fill(PAL.swamp);
    p.speckle(PAL.swampDark, 0.2, 191);
    for (let i = 0; i < 5; i++) {
      const x = 1 + i * 3;
      p.line(x, 15, x + 2, 6, PAL.wood);
      p.line(x + 2, 6, x + 4, 12, PAL.wood);
    }
    p.ellipse(8, 4, 7, 4, PAL.jungleDark);
    p.ellipse(6, 3, 4, 2, PAL.jungle);
  },
  reeds: (p) => {
    p.fill(PAL.swamp);
    for (let x = 1; x < 16; x += 2) {
      const hgt = 6 + Math.floor(noise(x, 5, 201) * 8);
      for (let y = 0; y < hgt; y++) p.px(x, 15 - y, y > hgt - 3 ? '#8a8a4a' : PAL.swampLit);
    }
  },

  /* --- reef --- */
  reefSand: (p) => { p.fill('#bfe0d4'); p.speckle(PAL.pale, 0.12, 211); p.speckle(PAL.teal, 0.08, 213); },
  coral: (p) => {
    p.fill('#bfe0d4');
    p.ellipse(5, 11, 4, 4, PAL.coral);
    p.ellipse(11, 9, 3, 4, PAL.coralLit);
    p.line(5, 11, 4, 4, PAL.coralDeep);
    p.line(11, 9, 13, 3, PAL.coralDeep);
    p.px(4, 4, PAL.coralLit); p.px(13, 3, PAL.coral);
  },
  reefWater: (p) => {
    water(p, 0, '#1f7f8e', '#33a3ab', PAL.pale, 221);
    p.ellipse(4, 12, 3, 2, '#186a78');
    p.ellipse(12, 5, 3, 2, '#186a78');
  },

  /* --- haunted shoals --- */
  shoalSand: (p) => {
    // Wet sandbar: ripple lines read much better at night than speckle.
    p.fill('#aebfd2');
    for (let y = 1; y < 16; y += 3) {
      const off = Math.round(Math.sin(y * 1.3) * 3);
      for (let x = 0; x < 16; x++) {
        if ((x + off) % 7 < 4) p.px(x, y, '#8ea3b8');
      }
    }
    p.speckle('#dfe9f2', 0.03, 233);
  },
  bones: (p) => {
    p.fill('#aebfd2');
    p.speckle('#8ea3b8', 0.1, 241);
    p.rect(3, 7, 8, 2, PAL.bone);
    p.px(2, 6, PAL.bone); p.px(2, 9, PAL.bone);
    p.px(11, 6, PAL.bone); p.px(11, 9, PAL.bone);
    p.ellipse(12, 12, 2, 2, PAL.bone);
    p.px(11, 12, PAL.ink); p.px(13, 12, PAL.ink);
  },
  wreck: (p) => {
    p.fill('#16294a');
    p.speckle('#25406e', 0.2, 251);
    for (let i = 0; i < 4; i++) p.line(1 + i * 4, 15, 3 + i * 4, 3, PAL.wood);
    p.rect(0, 8, 16, 2, PAL.woodLit);
    p.speckle(PAL.moss, 0.06, 253);
  },

  /* --- storm --- */
  stormSea: (p) => {
    water(p, 1, '#152238', '#22354f', '#7fa8c9', 261);
    p.speckle(PAL.white, 0.04, 263);
  },
  ironRock: (p) => {
    p.fill('#2b3340');
    p.speckle('#3d4756', 0.24, 271);
    p.speckle(PAL.iron, 0.06, 273);
    p.line(3, 14, 8, 2, PAL.black);
  },
  voidFloor: (p) => {
    p.fill('#0d1020');
    p.speckle('#1a2038', 0.2, 281);
    p.speckle(PAL.violet, 0.03, 283);
    p.speckle(PAL.ghost, 0.015, 287);
  },
};

/* ------------------------------------------------------------------ *
 * Props (transparent overlays drawn on top of terrain)
 * ------------------------------------------------------------------ */

const PROP_ART = {
  chest: (p) => {
    p.rect(2, 6, 12, 8, PAL.woodLit);
    p.rect(2, 6, 12, 3, PAL.wood);
    p.rect(2, 5, 12, 1, PAL.copper);
    p.rect(2, 13, 12, 1, PAL.shadow);
    p.rect(7, 8, 2, 4, PAL.gold);
    p.px(7, 10, PAL.ink);
    p.rect(2, 6, 1, 8, PAL.copper);
    p.rect(13, 6, 1, 8, PAL.copper);
  },
  chestOpen: (p) => {
    p.rect(2, 9, 12, 5, PAL.woodLit);
    p.rect(2, 4, 12, 4, PAL.wood);
    p.rect(3, 9, 10, 2, PAL.ink);
    p.rect(2, 13, 12, 1, PAL.shadow);
    p.px(6, 10, PAL.gold); p.px(9, 10, PAL.gold);
  },
  sign: (p) => {
    p.rect(7, 9, 2, 6, PAL.wood);
    p.rect(2, 3, 12, 7, PAL.woodLit);
    p.rect(2, 3, 12, 1, PAL.woodPale);
    p.rect(4, 5, 8, 1, PAL.wood);
    p.rect(4, 7, 6, 1, PAL.wood);
  },
  barrel: (p) => {
    p.ellipse(8, 8, 5, 7, PAL.wood);
    p.rect(3, 5, 11, 1, PAL.copper);
    p.rect(3, 11, 11, 1, PAL.copper);
    p.rect(6, 2, 5, 1, PAL.woodPale);
    p.rect(3, 15, 11, 1, PAL.shadow);
  },
  crate: (p) => {
    p.rect(2, 4, 12, 11, PAL.woodLit);
    p.rect(2, 4, 12, 1, PAL.woodPale);
    p.line(2, 4, 13, 14, PAL.wood);
    p.line(13, 4, 2, 14, PAL.wood);
    p.rect(2, 14, 12, 1, PAL.shadow);
  },
  brazier: (p) => {
    p.rect(6, 12, 4, 4, PAL.iron);
    p.rect(3, 9, 10, 3, PAL.rockDark);
    p.rect(4, 8, 8, 1, PAL.iron);
    p.rect(5, 10, 6, 1, PAL.ashDark);
  },
  brazierLit: (p) => {
    p.rect(6, 12, 4, 4, PAL.iron);
    p.rect(3, 9, 10, 3, PAL.rockDark);
    p.rect(4, 8, 8, 1, PAL.iron);
    p.ellipse(8, 6, 3, 4, PAL.lava);
    p.ellipse(8, 6, 2, 3, PAL.ember);
    p.ellipse(8, 5, 1, 2, PAL.emberPale);
    p.px(6, 2, PAL.ember); p.px(10, 3, PAL.ember);
  },
  beacon: (p) => {
    p.rect(6, 6, 4, 10, PAL.rockDark);
    p.rect(5, 15, 6, 1, PAL.rock);
    p.rect(4, 3, 8, 4, PAL.iron);
    p.rect(5, 4, 6, 2, PAL.ink);
  },
  beaconLit: (p) => {
    p.rect(6, 6, 4, 10, PAL.rockDark);
    p.rect(5, 15, 6, 1, PAL.rock);
    p.rect(4, 3, 8, 4, PAL.iron);
    p.rect(5, 4, 6, 2, PAL.emberPale);
    p.ellipse(8, 5, 4, 3, PAL.gold);
    p.ellipse(8, 5, 2, 2, PAL.white);
  },
  bowl: (p) => {
    p.ellipse(8, 10, 6, 3, PAL.stone);
    p.ellipse(8, 9, 5, 2, PAL.rockDark);
    p.rect(6, 12, 5, 3, PAL.rock);
  },
  bowlFull: (p) => {
    p.ellipse(8, 10, 6, 3, PAL.stone);
    p.ellipse(8, 9, 5, 2, PAL.leaf);
    p.px(7, 8, PAL.gold); p.px(9, 9, PAL.coralLit);
    p.rect(6, 12, 5, 3, PAL.rock);
  },
  shrine: (p) => {
    p.rect(3, 5, 10, 11, PAL.stone);
    p.rect(3, 5, 10, 2, PAL.stoneLit);
    p.rect(5, 8, 6, 6, PAL.rockDark);
    p.ellipse(8, 10, 2, 2, PAL.ghost);
    p.rect(2, 14, 12, 2, PAL.rock);
    p.px(4, 3, PAL.stone); p.px(11, 3, PAL.stone);
  },
  statue: (p) => {
    p.rect(4, 13, 8, 3, PAL.rockDark);
    p.rect(6, 5, 4, 8, PAL.stone);
    p.ellipse(8, 4, 2, 3, PAL.stoneLit);
    p.px(7, 4, PAL.rockDark); p.px(9, 4, PAL.rockDark);
    p.rect(4, 7, 8, 1, PAL.stone);
  },
  grave: (p) => {
    p.rect(4, 5, 8, 10, PAL.stone);
    p.ellipse(8, 5, 4, 3, PAL.stone);
    p.rect(7, 7, 2, 5, PAL.rockDark);
    p.rect(5, 8, 6, 1, PAL.rockDark);
    p.rect(3, 15, 10, 1, PAL.moss);
  },
  lantern: (p) => {
    p.rect(7, 1, 2, 3, PAL.iron);
    p.rect(4, 4, 8, 8, PAL.rockDark);
    p.rect(5, 5, 6, 6, PAL.gold);
    p.rect(6, 6, 4, 4, PAL.emberPale);
    p.rect(5, 12, 6, 4, PAL.rockDark);
  },
  anchor: (p) => {
    p.rect(7, 2, 2, 11, PAL.iron);
    p.rect(4, 5, 8, 1, PAL.iron);
    p.line(3, 9, 8, 13, PAL.iron);
    p.line(12, 9, 8, 13, PAL.iron);
    p.px(7, 1, PAL.stone); p.px(8, 1, PAL.stone);
  },
  cannon: (p) => {
    p.rect(2, 7, 11, 4, PAL.ashDark);
    p.rect(2, 7, 3, 4, PAL.iron);
    p.ellipse(5, 13, 3, 2, PAL.wood);
    p.ellipse(11, 13, 2, 2, PAL.wood);
    p.rect(1, 8, 1, 2, PAL.black);
  },
  stairsDown: (p) => {
    p.rect(1, 2, 14, 13, PAL.rockDark);
    for (let i = 0; i < 4; i++) p.rect(1 + i, 3 + i * 3, 14 - i * 2, 2, PAL.stone);
  },
  door: (p) => {
    p.rect(3, 2, 10, 14, PAL.wood);
    p.rect(3, 2, 10, 1, PAL.copper);
    p.rect(4, 4, 8, 10, PAL.woodLit);
    p.rect(7, 4, 1, 10, PAL.wood);
    p.px(10, 9, PAL.gold);
  },
  doorArch: (p) => {
    p.rect(2, 1, 12, 15, PAL.rockDark);
    p.rect(4, 4, 8, 12, PAL.black);
    p.ellipse(8, 4, 4, 3, PAL.black);
    p.rect(2, 1, 12, 2, PAL.stone);
  },
  well: (p) => {
    p.ellipse(8, 10, 6, 4, PAL.stone);
    p.ellipse(8, 10, 4, 3, PAL.deep);
    p.rect(3, 10, 1, 5, PAL.rock);
    p.rect(12, 10, 1, 5, PAL.rock);
    p.rect(3, 2, 10, 1, PAL.wood);
    p.rect(4, 3, 1, 4, PAL.wood);
    p.rect(11, 3, 1, 4, PAL.wood);
  },
  ropeCoil: (p) => {
    p.ellipse(8, 11, 6, 4, PAL.sandDark);
    p.ellipse(8, 11, 4, 2, PAL.dirt);
    p.ellipse(8, 11, 2, 1, PAL.sandDark);
  },
  fire: (p) => {
    p.ellipse(8, 11, 5, 4, PAL.lava);
    p.ellipse(8, 10, 3, 4, PAL.ember);
    p.ellipse(8, 9, 1, 3, PAL.emberPale);
  },
  vine: (p) => {
    for (let y = 0; y < 16; y++) {
      p.px(6 + Math.round(Math.sin(y * 0.7) * 2), y, PAL.jungle);
      if (y % 4 === 0) p.px(8 + Math.round(Math.sin(y * 0.7) * 2), y, PAL.leaf);
    }
    p.rect(0, 0, 16, 2, PAL.jungleDark);
  },
  pearl: (p) => {
    p.ellipse(8, 9, 4, 4, PAL.pale);
    p.ellipse(7, 8, 2, 2, PAL.white);
    p.ellipse(8, 12, 5, 2, PAL.coralDeep);
  },
  relic: (p) => {
    p.ellipse(8, 8, 5, 6, PAL.gold);
    p.ellipse(8, 8, 3, 4, PAL.copper);
    p.px(8, 6, PAL.white);
    p.rect(5, 14, 7, 2, PAL.wood);
  },
};

/* ------------------------------------------------------------------ *
 * Characters
 * ------------------------------------------------------------------ */

/**
 * Overworld actor styles. Each generates 4 facings x 3 walk frames at 16x16.
 * Keys are referenced from map/NPC data.
 */
export const ACTOR_STYLES = {
  nia: { skin: '#f0c090', hair: '#3b2418', top: PAL.blood, bottom: '#2f3d55', hat: null, accent: PAL.gold, sash: true },
  rook: { skin: '#8a5a3a', hair: '#1d1512', top: '#2f5f8f', bottom: '#3b3b46', hat: '#1d2430', accent: PAL.copper },
  yerena: { skin: '#c98b5e', hair: '#4a2f5f', top: '#cfe0d0', bottom: '#5c7a44', hat: null, accent: PAL.teal, shawl: true },
  sailor: { skin: '#e0b083', hair: '#5a4030', top: '#d8d8d0', bottom: '#3a4a63', hat: null, accent: PAL.royal },
  officer: { skin: '#f0c090', hair: '#6a5030', top: '#2b3f6b', bottom: '#1d2a44', hat: '#1d2a44', accent: PAL.gold },
  smuggler: { skin: '#8a5a3a', hair: '#221a14', top: '#4a3a5a', bottom: '#2a2230', hat: '#2a2230', accent: PAL.violet },
  herbalist: { skin: '#c98b5e', hair: '#2a1f18', top: '#6a8f4a', bottom: '#4a5f38', hat: null, accent: PAL.leaf },
  fisher: { skin: '#b07a4a', hair: '#3a2a1a', top: '#4a8f8a', bottom: '#3a5a58', hat: '#8a7038', accent: PAL.teal },
  smith: { skin: '#8a5a3a', hair: '#4a2a1a', top: '#7a3a2a', bottom: '#3a2a22', hat: null, accent: PAL.ember },
  priest: { skin: '#e0b083', hair: '#d8d8d0', top: '#e8e0d0', bottom: '#c8bca8', hat: null, accent: PAL.gold, shawl: true },
  child: { skin: '#f0c090', hair: '#8a6030', top: '#e0a050', bottom: '#5a6a8a', hat: null, accent: PAL.white, small: true },
  elder: { skin: '#c98b5e', hair: '#c8c8c0', top: '#7a6a5a', bottom: '#4a4038', hat: null, accent: PAL.bone },
  rival: { skin: '#e0b083', hair: '#8a1a2a', top: '#2a2a34', bottom: '#1a1a22', hat: '#1a1a22', accent: PAL.iron },
  ghostSailor: { skin: '#9fd8ff', hair: '#5f8fb8', top: '#4a6f8a', bottom: '#3a5568', hat: null, accent: PAL.ghost, ghost: true },
  maroon: { skin: '#7a4a2a', hair: '#1a1210', top: '#8a6a3a', bottom: '#5a4a30', hat: null, accent: PAL.copper },
  merchant: { skin: '#e0b083', hair: '#5a4a3a', top: '#8a4a7a', bottom: '#4a3a5a', hat: '#4a3a5a', accent: PAL.gold },
};

const DIRS = ['down', 'left', 'right', 'up'];

function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amount));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amount));
  const b = Math.max(0, Math.min(255, (n & 255) + amount));
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/**
 * Draw one 16x16 actor pose.
 * @param {*} p pen bound to the slot
 * @param {*} s style descriptor
 * @param {'down'|'left'|'right'|'up'} dir
 * @param {0|1|2} frame 0 = idle, 1/2 = alternating steps
 */
function drawActor(p, s, dir, frame) {
  const top = s.top;
  const topDark = shade(top, -30);
  const bottom = s.bottom;
  const bottomDark = shade(bottom, -25);
  const skin = s.skin;
  const skinDark = shade(skin, -35);
  const hair = s.hair;
  const yOff = s.small ? 2 : 0;
  const bob = frame === 0 ? 0 : 0;

  // Contact shadow.
  p.ellipse(8, 15, 4, 1, 'rgba(8,14,22,0.35)');

  // Legs (swing on walk frames).
  const legTop = 12 + yOff;
  const swing = frame === 1 ? 1 : frame === 2 ? -1 : 0;
  p.rect(5, legTop, 2, 4 - yOff, bottom);
  p.rect(9, legTop, 2, 4 - yOff, bottom);
  if (swing !== 0) {
    p.rect(5 + (swing > 0 ? -1 : 0), legTop + 2, 2, 2, bottomDark);
    p.rect(9 + (swing > 0 ? 0 : 1), legTop + 2, 2, 2, bottomDark);
  }
  p.rect(5, 15, 2, 1, PAL.shadow);
  p.rect(9, 15, 2, 1, PAL.shadow);

  // Torso.
  const bodyTop = 8 + yOff;
  p.rect(4, bodyTop, 8, 5 - yOff, top);
  p.rect(4, bodyTop, 8, 1, shade(top, 22));
  p.rect(4, legTop - 1, 8, 1, topDark);
  if (s.sash) {
    p.line(4, bodyTop + 3, 11, bodyTop + 1, s.accent);
  }
  if (s.shawl) {
    p.rect(3, bodyTop, 10, 2, shade(top, 18));
    p.px(3, bodyTop + 2, s.accent);
    p.px(12, bodyTop + 2, s.accent);
  }

  // Arms.
  p.rect(3, bodyTop + 1, 1, 3, topDark);
  p.rect(12, bodyTop + 1, 1, 3, topDark);
  p.px(3, bodyTop + 4, skin);
  p.px(12, bodyTop + 4, skin);

  // Head.
  const headTop = 2 + yOff;
  p.rect(4, headTop, 8, 6, skin);
  p.rect(4, headTop, 8, 1, skinDark);
  p.px(4, headTop + 5, skinDark);
  p.px(11, headTop + 5, skinDark);

  // Hair per facing.
  if (dir === 'up') {
    p.rect(4, headTop, 8, 6, hair);
  } else {
    p.rect(4, headTop - 1, 8, 2, hair);
    p.px(3, headTop + 1, hair);
    p.px(12, headTop + 1, hair);
    if (dir === 'left') { p.rect(4, headTop, 3, 3, hair); }
    if (dir === 'right') { p.rect(9, headTop, 3, 3, hair); }
    if (dir === 'down') { p.px(4, headTop + 1, hair); p.px(11, headTop + 1, hair); }
  }

  // Eyes.
  if (dir === 'down') {
    p.px(6, headTop + 3, PAL.ink);
    p.px(9, headTop + 3, PAL.ink);
  } else if (dir === 'left') {
    p.px(5, headTop + 3, PAL.ink);
    p.px(7, headTop + 3, PAL.ink);
  } else if (dir === 'right') {
    p.px(8, headTop + 3, PAL.ink);
    p.px(10, headTop + 3, PAL.ink);
  }

  // Headwear.
  if (s.hat) {
    p.rect(2, headTop - 1, 12, 1, s.hat);
    p.rect(4, headTop - 3, 8, 2, s.hat);
    p.rect(4, headTop - 3, 8, 1, shade(s.hat, 25));
    if (s.accent) p.rect(4, headTop - 1, 8, 1, s.accent);
  }

  if (s.ghost) {
    // Wisp away the feet for spectral NPCs.
    p.rect(5, 14, 2, 2, 'rgba(0,0,0,0)');
    p.rect(9, 14, 2, 2, 'rgba(0,0,0,0)');
  }
}

/* ------------------------------------------------------------------ *
 * Ships (sea chart)
 * ------------------------------------------------------------------ */

const SHIP_TIERS = [
  { hull: PAL.wood, trim: PAL.woodPale, sail: '#e8e2d0', flag: PAL.blood },
  { hull: '#5a3f5a', trim: PAL.ghost, sail: '#cfe6f5', flag: PAL.ghost },
  { hull: '#3d3a52', trim: PAL.gold, sail: '#f0e6c0', flag: PAL.gold },
];

function drawShip(p, tier, dir) {
  const t = SHIP_TIERS[tier];
  p.ellipse(8, 14, 5, 2, 'rgba(8,14,22,0.3)');
  if (dir === 'up' || dir === 'down') {
    p.ellipse(8, 9, 3, 6, t.hull);
    p.ellipse(8, 9, 2, 5, t.trim);
    p.rect(7, 2, 2, 9, PAL.wood);
    p.ellipse(8, 6, 3, 4, t.sail);
    p.rect(8, 1, 4, 2, t.flag);
    if (dir === 'up') { p.rect(6, 3, 5, 1, t.trim); } else { p.rect(6, 13, 5, 1, t.trim); }
  } else {
    const flip = dir === 'left' ? -1 : 1;
    const cx = 8;
    p.ellipse(cx, 11, 6, 3, t.hull);
    p.ellipse(cx, 10, 5, 2, t.trim);
    p.rect(cx - 1, 3, 2, 8, PAL.wood);
    for (let y = 4; y < 10; y++) {
      const wdt = 2 + (y - 4);
      p.rect(cx + (flip > 0 ? 1 : -wdt), y, wdt, 1, t.sail);
    }
    p.rect(cx + (flip > 0 ? 0 : -3), 1, 4, 2, t.flag);
    p.px(cx + flip * 6, 10, t.trim);
  }
}

/* ------------------------------------------------------------------ *
 * Effects & UI bits
 * ------------------------------------------------------------------ */

const FX_ART = {
  dot: (p) => p.fill(PAL.white),
  drop: (p) => { p.rect(0, 0, 1, 4, PAL.pale); },
  mote: (p) => { p.rect(0, 0, 2, 2, PAL.white); },
  slash: (p) => {
    for (let i = 0; i < 24; i++) p.px(23 - i, i, i % 3 === 0 ? PAL.white : PAL.pale);
    for (let i = 0; i < 24; i++) p.px(22 - i, i, PAL.white);
  },
  burst: (p) => {
    p.ellipse(12, 12, 11, 11, 'rgba(255,255,255,0.18)');
    p.ellipse(12, 12, 7, 7, 'rgba(255,255,255,0.5)');
    p.ellipse(12, 12, 3, 3, PAL.white);
  },
  ring: (p) => {
    for (let a = 0; a < 64; a++) {
      const r = (a / 64) * Math.PI * 2;
      p.px(12 + Math.round(Math.cos(r) * 11), 12 + Math.round(Math.sin(r) * 11), PAL.white);
    }
  },
  shadowBlob: (p) => p.ellipse(8, 4, 7, 3, 'rgba(8,14,22,0.4)'),
  cursorHand: (p) => {
    p.rect(1, 2, 2, 4, PAL.gold);
    p.rect(3, 3, 2, 2, PAL.gold);
    p.rect(5, 4, 2, 1, PAL.white);
    p.rect(1, 1, 1, 1, PAL.white);
  },
  waveEdge: (p) => {
    for (let x = 0; x < 16; x++) {
      const hgt = 2 + Math.round(Math.sin(x * 0.8) * 1.6);
      for (let y = 0; y < hgt; y++) p.px(x, y, PAL.foam);
    }
  },
};

/* ------------------------------------------------------------------ *
 * Public builder
 * ------------------------------------------------------------------ */

export class Art {
  constructor(frames, base) {
    this.frames = frames;
    this.base = base;
  }

  /** Fetch a texture by name; throws loudly rather than silently drawing nothing. */
  tex(name) {
    const t = this.frames.get(name);
    if (!t) throw new Error(`art: unknown texture "${name}"`);
    return t;
  }

  has(name) { return this.frames.has(name); }

  actor(style, dir = 'down', frame = 0) {
    return this.tex(`actor:${style}:${dir}:${frame}`);
  }

  ship(tier = 0, dir = 'down') {
    return this.tex(`ship:${Math.min(2, tier)}:${dir}`);
  }

  battler(key) {
    return this.tex(`battler:${key}`);
  }
}

/** Build every texture the game uses. Returns an `Art` handle. */
export function buildArt() {
  TextureSource.defaultOptions.scaleMode = 'nearest';
  const atlas = new ShelfAtlas();

  for (const [name, draw] of Object.entries(TILE_ART)) {
    atlas.add(`tile:${name}`, TILE, TILE, (ctx, x, y) => draw(pen(ctx, x, y)));
  }
  for (const [name, draw] of Object.entries(PROP_ART)) {
    atlas.add(`prop:${name}`, TILE, TILE, (ctx, x, y) => draw(pen(ctx, x, y)));
  }
  for (const [key, style] of Object.entries(ACTOR_STYLES)) {
    for (const dir of DIRS) {
      for (let f = 0; f < 3; f++) {
        atlas.add(`actor:${key}:${dir}:${f}`, TILE, TILE,
          (ctx, x, y) => drawActor(pen(ctx, x, y), style, dir, f));
      }
    }
  }
  for (let tier = 0; tier < SHIP_TIERS.length; tier++) {
    for (const dir of DIRS) {
      atlas.add(`ship:${tier}:${dir}`, TILE, TILE,
        (ctx, x, y) => drawShip(pen(ctx, x, y), tier, dir));
    }
  }
  atlas.add('fx:dot', 1, 1, (ctx, x, y) => FX_ART.dot(pen(ctx, x, y, 1, 1)));
  atlas.add('fx:drop', 1, 4, (ctx, x, y) => FX_ART.drop(pen(ctx, x, y, 1, 4)));
  atlas.add('fx:mote', 2, 2, (ctx, x, y) => FX_ART.mote(pen(ctx, x, y, 2, 2)));
  atlas.add('fx:slash', 24, 24, (ctx, x, y) => FX_ART.slash(pen(ctx, x, y, 24, 24)));
  atlas.add('fx:burst', 24, 24, (ctx, x, y) => FX_ART.burst(pen(ctx, x, y, 24, 24)));
  atlas.add('fx:ring', 24, 24, (ctx, x, y) => FX_ART.ring(pen(ctx, x, y, 24, 24)));
  atlas.add('fx:shadow', 16, 8, (ctx, x, y) => FX_ART.shadowBlob(pen(ctx, x, y, 16, 8)));
  atlas.add('fx:cursor', 8, 8, (ctx, x, y) => FX_ART.cursorHand(pen(ctx, x, y, 8, 8)));
  atlas.add('fx:waveEdge', 16, 4, (ctx, x, y) => FX_ART.waveEdge(pen(ctx, x, y, 16, 4)));

  for (const [key, def] of Object.entries(BATTLER_ART)) {
    const size = def.size ?? 32;
    atlas.add(`battler:${key}`, size, size,
      (ctx, x, y) => drawBattler(pen(ctx, x, y, size, size), key, PAL, { noise, shade }));
  }

  const { base, pages, frames, canvases } = atlas.bake();
  const art = new Art(frames, base);
  art.pages = pages;
  // Kept so tools/atlas-dump.mjs can write the sheet out for inspection.
  art.canvases = canvases;
  return art;
}

export { noise, shade, pen };
