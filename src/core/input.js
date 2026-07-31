/**
 * Keyboard input with edge detection and menu-style auto-repeat.
 *
 * Physical `event.code` values are used so the layout works the same on
 * QWERTY/AZERTY/Dvorak. Call `input.endFrame()` once per tick, after all
 * scene updates, to roll "just pressed / just released" edges forward.
 */

export const ACTIONS = {
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  confirm: ['KeyZ', 'Enter', 'Space', 'NumpadEnter'],
  cancel: ['KeyX', 'Escape', 'Backspace'],
  menu: ['KeyC', 'Tab'],
  journal: ['KeyQ'],
  chart: ['KeyM'],
  run: ['ShiftLeft', 'ShiftRight'],
  help: ['KeyH', 'F1'],
  mute: ['KeyN'],
};

/** Keys we swallow so the browser does not scroll / focus-jump underneath us. */
const SWALLOW = new Set([
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'Space', 'Tab', 'Enter', 'NumpadEnter', 'Backspace', 'F1',
]);

const REPEAT_DELAY = 300; // ms before auto-repeat kicks in
const REPEAT_RATE = 70;   // ms between repeats afterwards

class Input {
  constructor() {
    /** @type {Set<string>} physical codes currently held */
    this.held = new Set();
    /** @type {Set<string>} codes that went down this frame */
    this.pressed = new Set();
    /** @type {Set<string>} codes that went up this frame */
    this.released = new Set();
    /** @type {Map<string, number>} action -> ms held, for auto-repeat */
    this.holdTime = new Map();
    /** @type {Set<string>} actions that produced a repeat tick this frame */
    this.repeated = new Set();
    /** Set true whenever any key is pressed; lets scenes detect "any key". */
    this.anyPressed = false;
    this.enabled = true;
    this._bound = false;
  }

  attach(target = window) {
    if (this._bound) return;
    this._bound = true;

    target.addEventListener('keydown', (e) => {
      if (!this.enabled) return;
      if (SWALLOW.has(e.code)) e.preventDefault();
      if (e.repeat) return; // we run our own repeat timing
      if (!this.held.has(e.code)) {
        this.held.add(e.code);
        this.pressed.add(e.code);
        this.anyPressed = true;
      }
    });

    target.addEventListener('keyup', (e) => {
      if (SWALLOW.has(e.code)) e.preventDefault();
      this.held.delete(e.code);
      this.released.add(e.code);
    });

    // Losing focus mid-hold would otherwise leave a key stuck down forever.
    target.addEventListener('blur', () => this.clear());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.clear();
    });
  }

  clear() {
    this.held.clear();
    this.pressed.clear();
    this.released.clear();
    this.holdTime.clear();
    this.repeated.clear();
  }

  /** True while any key bound to `action` is held. */
  isDown(action) {
    const codes = ACTIONS[action];
    if (!codes) return false;
    for (const c of codes) if (this.held.has(c)) return true;
    return false;
  }

  /** True on the single frame `action` transitions from up to down. */
  justPressed(action) {
    const codes = ACTIONS[action];
    if (!codes) return false;
    for (const c of codes) if (this.pressed.has(c)) return true;
    return false;
  }

  justReleased(action) {
    const codes = ACTIONS[action];
    if (!codes) return false;
    for (const c of codes) if (this.released.has(c)) return true;
    return false;
  }

  /**
   * True on the initial press and then on a steady cadence while held.
   * This is what menus and grid movement should use.
   */
  repeat(action) {
    return this.justPressed(action) || this.repeated.has(action);
  }

  /** Directional helper: returns -1, 0 or 1 on each axis (no diagonal bias). */
  axis() {
    let x = 0;
    let y = 0;
    if (this.isDown('left')) x -= 1;
    if (this.isDown('right')) x += 1;
    if (this.isDown('up')) y -= 1;
    if (this.isDown('down')) y += 1;
    return { x, y };
  }

  /** Advance repeat timers. Call once per frame *before* scene updates. */
  beginFrame(deltaMS) {
    this.repeated.clear();
    for (const action of ['up', 'down', 'left', 'right']) {
      if (this.isDown(action)) {
        const prev = this.holdTime.get(action) ?? 0;
        const next = prev + deltaMS;
        this.holdTime.set(action, next);
        if (prev < REPEAT_DELAY && next >= REPEAT_DELAY) {
          this.repeated.add(action);
        } else if (prev >= REPEAT_DELAY) {
          const a = Math.floor((prev - REPEAT_DELAY) / REPEAT_RATE);
          const b = Math.floor((next - REPEAT_DELAY) / REPEAT_RATE);
          if (b > a) this.repeated.add(action);
        }
      } else {
        this.holdTime.delete(action);
      }
    }
  }

  /** Roll edge sets. Call once per frame *after* scene updates. */
  endFrame() {
    this.pressed.clear();
    this.released.clear();
    this.anyPressed = false;
  }
}

export const input = new Input();

/** Human-readable control list, shared by the title screen and the help panel. */
export const CONTROL_HELP = [
  ['Arrows / WASD', 'Move, steer, pick menu entries'],
  ['Z / Enter / Space', 'Confirm, talk, examine, advance text'],
  ['X / Esc', 'Cancel, back out, close a window'],
  ['C / Tab', 'Open the ship log (party, gear, items)'],
  ['Q', 'Legend journal'],
  ['M', 'Sea chart (while sailing)'],
  ['Shift (hold)', 'Run on foot, full sail at sea'],
  ['N', 'Mute / unmute'],
  ['H / F1', 'This help'],
  ['Mouse', 'Menu entries can also be clicked'],
];
