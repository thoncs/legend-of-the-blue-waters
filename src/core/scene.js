/**
 * Scene stack + transitions.
 *
 * A Scene is just a Container with a lifecycle. The manager keeps a stack so
 * that transient screens (menu, shop, journal) can sit on top of the field
 * without it being torn down and rebuilt.
 */
import { Container, Graphics } from 'pixi.js';

export class Scene extends Container {
  /**
   * @param {import('../main.js').Game} game shared game context
   */
  constructor(game) {
    super();
    this.game = game;
    /** When true, scenes below this one keep rendering. */
    this.overlay = false;
    /** Set by the manager while this scene is not the top of the stack. */
    this.paused = false;
  }

  /** Build the scene. May be async (e.g. to await a fade). */
  onEnter(_params) {}
  /** Tear down anything the garbage collector will not get on its own. */
  onExit() {}
  /** Called when another scene is pushed on top of this one. */
  onPause() {}
  /** Called when the scene above this one is popped. */
  onResume(_result) {}
  /** @param {number} dtMS milliseconds since the previous frame */
  update(_dtMS) {}
  /** Virtual-resolution size never changes, but scenes may want the hook. */
  resize(_w, _h) {}
}

export class SceneManager {
  constructor(app, game) {
    this.app = app;
    this.game = game;
    this.root = new Container();
    this.fxRoot = new Container();
    app.stage.addChild(this.root, this.fxRoot);

    /** @type {Scene[]} */
    this.stack = [];
    this.transitioning = false;

    this.fade = new Graphics();
    this.fade.rect(0, 0, game.width, game.height).fill(0x000000);
    this.fade.alpha = 0;
    this.fade.visible = false;
    this.fxRoot.addChild(this.fade);

    /** @type {Array<{t:number,dur:number,from:number,to:number,resolve:Function}>} */
    this._tweens = [];
  }

  get current() {
    return this.stack[this.stack.length - 1] ?? null;
  }

  /** Fade the screen to `to` (0..1) over `dur` ms. */
  fadeTo(to, dur = 260, color = 0x000000) {
    if (color !== this._fadeColor) {
      this._fadeColor = color;
      this.fade.clear();
      this.fade.rect(0, 0, this.game.width, this.game.height).fill(color);
    }
    this.fade.visible = true;
    const from = this.fade.alpha;
    if (dur <= 0) {
      this.fade.alpha = to;
      this.fade.visible = to > 0;
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this._tweens.push({ t: 0, dur, from, to, resolve });
    });
  }

  _updateFade(dtMS) {
    for (let i = this._tweens.length - 1; i >= 0; i--) {
      const tw = this._tweens[i];
      tw.t += dtMS;
      const k = Math.min(1, tw.t / tw.dur);
      this.fade.alpha = tw.from + (tw.to - tw.from) * k;
      if (k >= 1) {
        this._tweens.splice(i, 1);
        this.fade.visible = this.fade.alpha > 0.001;
        tw.resolve();
      }
    }
  }

  _refreshVisibility() {
    // Everything below the topmost non-overlay scene can stop rendering.
    let firstVisible = 0;
    for (let i = this.stack.length - 1; i >= 0; i--) {
      if (!this.stack[i].overlay) { firstVisible = i; break; }
    }
    for (let i = 0; i < this.stack.length; i++) {
      const s = this.stack[i];
      s.visible = i >= firstVisible;
      s.paused = i !== this.stack.length - 1;
    }
  }

  /** Push a scene on top of the current one. */
  async push(SceneClass, params = {}, { fade = false } = {}) {
    if (this.transitioning) return null;
    this.transitioning = true;
    try {
      if (fade) await this.fadeTo(1, 200);
      const prev = this.current;
      if (prev) prev.onPause();
      const scene = new SceneClass(this.game);
      this.stack.push(scene);
      this.root.addChild(scene);
      await scene.onEnter(params);
      this._refreshVisibility();
      if (fade) await this.fadeTo(0, 240);
      return scene;
    } finally {
      this.transitioning = false;
    }
  }

  /** Pop the top scene, handing `result` back to the one beneath it. */
  async pop(result = null, { fade = false } = {}) {
    if (this.transitioning || this.stack.length <= 1) return;
    this.transitioning = true;
    try {
      if (fade) await this.fadeTo(1, 200);
      const scene = this.stack.pop();
      scene.onExit();
      this.root.removeChild(scene);
      scene.destroy({ children: true });
      this._refreshVisibility();
      this.current?.onResume(result);
      if (fade) await this.fadeTo(0, 240);
    } finally {
      this.transitioning = false;
    }
  }

  /** Clear the whole stack and enter a fresh scene. */
  async replace(SceneClass, params = {}, { fade = true, fadeColor = 0x000000, outMS = 280, inMS = 320 } = {}) {
    if (this.transitioning) return null;
    this.transitioning = true;
    try {
      if (fade) await this.fadeTo(1, outMS, fadeColor);
      while (this.stack.length) {
        const s = this.stack.pop();
        s.onExit();
        this.root.removeChild(s);
        s.destroy({ children: true });
      }
      const scene = new SceneClass(this.game);
      this.stack.push(scene);
      this.root.addChild(scene);
      await scene.onEnter(params);
      this._refreshVisibility();
      if (fade) await this.fadeTo(0, inMS, fadeColor);
      return scene;
    } finally {
      this.transitioning = false;
    }
  }

  update(dtMS) {
    this._updateFade(dtMS);
    if (this.transitioning) return;
    const top = this.current;
    if (top) top.update(dtMS);
  }
}
