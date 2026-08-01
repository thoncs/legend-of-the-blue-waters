/**
 * On-screen controls: a floating analog stick under the left thumb and a
 * cluster of round buttons under the right.
 *
 * The stick is *floating* rather than fixed — it materialises wherever the
 * thumb lands in its zone, which is what stops a player having to look down
 * to find it. Everything here funnels into `input.setStick` / `setVirtual`,
 * so scenes never talk to the controls directly; they just ask `input` the
 * same questions they always did.
 *
 * Which widgets are live is decided per scene by `Scene.controlScheme`:
 *
 *   field    stick + confirm/cancel/log
 *   sea      stick + confirm/cancel/log/chart
 *   battle   confirm/cancel only — enemies and command rows are tapped directly
 *   menu     cancel only — rows and tabs are tapped directly
 *   tap      the whole screen is one big "advance" button
 *   none     nothing
 */
import { Container, Graphics } from 'pixi.js';
import { input } from './input.js';

const SCHEMES = {
  field:   { stick: true,  buttons: ['confirm', 'cancel', 'menu'], tapAnywhere: false },
  sea:     { stick: true,  buttons: ['confirm', 'cancel', 'menu', 'chart'], tapAnywhere: false },
  battle:  { stick: false, buttons: ['confirm', 'cancel'], tapAnywhere: false },
  menu:    { stick: false, buttons: ['cancel'], tapAnywhere: false },
  tap:     { stick: false, buttons: [], tapAnywhere: true },
  none:    { stick: false, buttons: [], tapAnywhere: false },
};

const BUTTON_STYLE = {
  confirm: { ring: 0x6fd3c7, fill: 0x123b46, glyph: 'dot' },
  cancel:  { ring: 0xd98a7a, fill: 0x3d1f21, glyph: 'cross' },
  menu:    { ring: 0xffd45e, fill: 0x3a3018, glyph: 'log' },
  chart:   { ring: 0x9fd8ff, fill: 0x1b2a4a, glyph: 'rose' },
};

class TouchButton extends Container {
  constructor(action, radius) {
    super();
    this.action = action;
    this.radius = radius;
    this.style = BUTTON_STYLE[action];
    this.g = new Graphics();
    this.addChild(this.g);
    this.eventMode = 'static';
    this.cursor = 'pointer';
    this._down = false;
    this._pointerId = null;

    this.on('pointerdown', (e) => {
      if (this._pointerId !== null) return;
      this._pointerId = e.pointerId;
      this._down = true;
      this.redraw();
      input.setVirtual(this.action, true);
      e.stopPropagation();
    });
    const release = (e) => {
      if (this._pointerId !== null && e?.pointerId !== undefined && e.pointerId !== this._pointerId) return;
      this._pointerId = null;
      if (!this._down) return;
      this._down = false;
      this.redraw();
      input.setVirtual(this.action, false);
    };
    this.on('pointerup', release);
    this.on('pointerupoutside', release);
    this.on('pointercancel', release);
    this.redraw();
  }

  setRadius(r) {
    this.radius = r;
    this.redraw();
  }

  redraw() {
    const r = this.radius;
    const s = this.style;
    const g = this.g;
    const press = this._down ? 0.86 : 1;
    g.clear();
    // Body, with a soft outer glow so it reads over bright water.
    g.circle(0, 2, r * press).fill({ color: 0x000000, alpha: 0.28 });
    g.circle(0, 0, r * press).fill({ color: s.fill, alpha: this._down ? 0.92 : 0.66 });
    g.circle(0, 0, r * press).stroke({ color: s.ring, width: Math.max(2, r * 0.09), alpha: this._down ? 1 : 0.8 });

    const k = r * 0.42 * press;
    const ink = s.ring;
    switch (s.glyph) {
      case 'dot':
        g.circle(0, 0, k * 0.72).fill({ color: ink, alpha: 0.95 });
        break;
      case 'cross':
        g.moveTo(-k, -k).lineTo(k, k).stroke({ color: ink, width: Math.max(2, r * 0.13), alpha: 0.95 });
        g.moveTo(k, -k).lineTo(-k, k).stroke({ color: ink, width: Math.max(2, r * 0.13), alpha: 0.95 });
        break;
      case 'log': {
        const bar = Math.max(2, r * 0.11);
        for (let i = -1; i <= 1; i++) {
          g.rect(-k, i * k * 0.72 - bar / 2, k * 2, bar).fill({ color: ink, alpha: 0.95 });
        }
        break;
      }
      case 'rose':
        g.moveTo(0, -k).lineTo(k * 0.42, 0).lineTo(0, k).lineTo(-k * 0.42, 0).closePath()
          .fill({ color: ink, alpha: 0.95 });
        g.moveTo(-k, 0).lineTo(0, -k * 0.42).lineTo(k, 0).lineTo(0, k * 0.42).closePath()
          .fill({ color: ink, alpha: 0.55 });
        break;
    }
    this.hitArea = { contains: (x, y) => x * x + y * y <= (r * 1.25) * (r * 1.25) };
  }
}

export class TouchControls extends Container {
  constructor(game) {
    super();
    this.game = game;
    this.scheme = 'none';

    /** Zone that grows the floating stick. */
    this.stickZone = new Graphics();
    this.stickZone.eventMode = 'static';
    this.addChild(this.stickZone);

    this.stickG = new Graphics();
    this.stickG.visible = false;
    this.addChild(this.stickG);

    this.buttonLayer = new Container();
    this.addChild(this.buttonLayer);

    /** @type {Map<string, TouchButton>} */
    this.buttons = new Map();
    for (const action of ['confirm', 'cancel', 'menu', 'chart']) {
      const b = new TouchButton(action, 40);
      b.visible = false;
      this.buttons.set(action, b);
      this.buttonLayer.addChild(b);
    }

    this._stickId = null;
    this._origin = { x: 0, y: 0 };
    this._vec = { x: 0, y: 0 };
    this._fade = 0;

    this.stickZone.on('pointerdown', (e) => this._stickDown(e));
    this.stickZone.on('globalpointermove', (e) => this._stickMove(e));
    const up = (e) => this._stickUp(e);
    this.stickZone.on('pointerup', up);
    this.stickZone.on('pointerupoutside', up);
    this.stickZone.on('pointercancel', up);

    this.resize(game.width, game.height);
  }

  /** Called by SceneManager whenever the active scene changes. */
  setScheme(name) {
    const scheme = SCHEMES[name] ? name : 'none';
    if (scheme === this.scheme) return;
    this.scheme = scheme;
    this._releaseStick();
    for (const b of this.buttons.values()) {
      if (b._down) {
        b._down = false;
        b._pointerId = null;
        b.redraw();
        input.setVirtual(b.action, false);
      }
    }
    this.layout();
  }

  get config() {
    return SCHEMES[this.scheme];
  }

  resize(w, h) {
    this.width_ = w;
    this.height_ = h;
    this.layout();
  }

  layout() {
    const w = this.width_ ?? this.game.width;
    const h = this.height_ ?? this.game.height;
    const unit = this.game.touchUnit;
    const cfg = this.config;

    // --- stick zone -------------------------------------------------
    // Only the lower-left quadrant, so it never swallows a tap meant for
    // something on screen. In `tap` mode the zone becomes the whole screen.
    this.stickZone.clear();
    if (cfg.tapAnywhere) {
      this.stickZone.rect(0, 0, w, h).fill({ color: 0xffffff, alpha: 0.0001 });
      this.stickZone.eventMode = 'static';
    } else if (cfg.stick) {
      this.stickZone.rect(0, h * 0.28, w * 0.46, h * 0.72).fill({ color: 0xffffff, alpha: 0.0001 });
      this.stickZone.eventMode = 'static';
    } else {
      this.stickZone.eventMode = 'none';
    }

    // --- buttons ----------------------------------------------------
    const r = unit * 0.78;
    const inset = unit * 1.15;
    const gap = r * 2.35;

    // Confirm sits closest to the thumb's rest position; cancel up-left of it.
    const baseX = w - inset - r;
    const baseY = h - inset - r;
    const place = {
      confirm: { x: baseX, y: baseY },
      cancel: { x: baseX - gap * 0.92, y: baseY - gap * 0.46 },
      menu: { x: baseX, y: baseY - gap },
      chart: { x: baseX - gap * 0.92, y: baseY - gap * 1.46 },
    };

    for (const [action, b] of this.buttons) {
      const on = cfg.buttons.includes(action);
      b.visible = on;
      b.eventMode = on ? 'static' : 'none';
      if (!on) continue;
      b.setRadius(r);
      b.position.set(place[action].x, place[action].y);
    }
  }

  // --- floating stick ------------------------------------------------

  _stickDown(e) {
    const cfg = this.config;
    if (cfg.tapAnywhere) {
      input.tap('confirm');
      return;
    }
    if (!cfg.stick || this._stickId !== null) return;
    this._stickId = e.pointerId;
    const p = e.getLocalPosition(this);
    this._origin.x = p.x;
    this._origin.y = p.y;
    this._vec.x = 0;
    this._vec.y = 0;
    this.stickG.visible = true;
    this._fade = 1;
    this._drawStick();
  }

  _stickMove(e) {
    if (this._stickId === null || e.pointerId !== this._stickId) return;
    const p = e.getLocalPosition(this);
    const radius = this.game.touchUnit * 1.45;
    let dx = p.x - this._origin.x;
    let dy = p.y - this._origin.y;
    const mag = Math.hypot(dx, dy);
    if (mag > radius) {
      // Drag the origin along so the stick never runs out of travel.
      this._origin.x = p.x - (dx / mag) * radius;
      this._origin.y = p.y - (dy / mag) * radius;
      dx = (dx / mag) * radius;
      dy = (dy / mag) * radius;
    }
    this._vec.x = dx / radius;
    this._vec.y = dy / radius;
    input.setStick(this._vec.x, this._vec.y);
    this._drawStick();
  }

  _stickUp(e) {
    if (this._stickId !== null && e?.pointerId !== undefined && e.pointerId !== this._stickId) return;
    this._releaseStick();
  }

  _releaseStick() {
    if (this._stickId === null) return;
    this._stickId = null;
    this._vec.x = 0;
    this._vec.y = 0;
    input.setStick(0, 0);
    this.stickG.visible = false;
  }

  _drawStick() {
    const g = this.stickG;
    const radius = this.game.touchUnit * 1.45;
    const ox = this._origin.x;
    const oy = this._origin.y;
    const kx = ox + this._vec.x * radius;
    const ky = oy + this._vec.y * radius;
    const mag = Math.hypot(this._vec.x, this._vec.y);

    g.clear();
    g.circle(ox, oy, radius).fill({ color: 0x06131f, alpha: 0.3 });
    g.circle(ox, oy, radius).stroke({ color: 0x6fd3c7, width: Math.max(2, radius * 0.05), alpha: 0.45 });
    // A brighter rim once the player is far enough over to be running.
    if (mag > 0.72) {
      g.circle(ox, oy, radius).stroke({ color: 0x93e6dc, width: Math.max(2, radius * 0.08), alpha: 0.8 });
    }
    g.circle(kx, ky + 2, radius * 0.42).fill({ color: 0x000000, alpha: 0.3 });
    g.circle(kx, ky, radius * 0.42).fill({ color: 0x1b5675, alpha: 0.85 });
    g.circle(kx, ky, radius * 0.42).stroke({ color: 0x93e6dc, width: Math.max(2, radius * 0.06), alpha: 0.9 });
  }

  update(_dtMS) {
    // Controls are event-driven; nothing to advance per frame yet.
  }
}
