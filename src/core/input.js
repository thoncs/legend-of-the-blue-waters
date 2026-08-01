/**
 * Touch input, expressed as named actions with edge detection and menu-style
 * auto-repeat.
 *
 * There is no keyboard. The on-screen controls in `touch.js` are the only
 * thing that drives this class in play, via `setVirtual` / `setStick` / `tap`.
 * Those same methods are the hook the headless test tools use, so the tests
 * exercise exactly the path a player's thumb does.
 *
 * Call `beginFrame(dt)` before scene updates and `endFrame()` after, to roll
 * "just pressed / just released" edges forward.
 */

/** Every action the game can ask about. */
export const ACTIONS = [
  'up', 'down', 'left', 'right',
  'confirm', 'cancel', 'menu', 'journal', 'chart', 'run', 'help',
];

const ACTION_SET = new Set(ACTIONS);
const DIRECTIONS = ['up', 'down', 'left', 'right'];

const REPEAT_DELAY = 300; // ms before auto-repeat kicks in
const REPEAT_RATE = 70;   // ms between repeats afterwards

/** Stick deflection past which a direction counts as held. */
const STICK_DEADZONE = 0.34;
/** Deflection past which the player is running / under full sail. */
const STICK_RUN = 0.72;

class Input {
  constructor() {
    /** @type {Set<string>} actions currently held */
    this.held = new Set();
    /** @type {Set<string>} actions that went down this frame */
    this.pressed = new Set();
    /** @type {Set<string>} actions that went up this frame */
    this.released = new Set();
    /** @type {Map<string, number>} action -> ms held, for auto-repeat */
    this.holdTime = new Map();
    /** @type {Set<string>} actions that produced a repeat tick this frame */
    this.repeated = new Set();
    /** @type {Set<string>} actions to release automatically after this frame */
    this._pulses = new Set();
    /** Raw stick deflection, -1..1 on each axis. */
    this.stick = { x: 0, y: 0 };
    /** True whenever any action went down this frame ("tap to continue"). */
    this.anyPressed = false;
    this.enabled = true;
    this._bound = false;
  }

  attach(target) {
    if (this._bound) return;
    this._bound = true;
    // Losing focus mid-hold would otherwise leave the stick stuck over.
    const drop = () => this.clear();
    window.addEventListener('blur', drop);
    target?.addEventListener?.('pointercancel', drop);
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
    this._pulses.clear();
    this.stick.x = 0;
    this.stick.y = 0;
  }

  /** Press or release an action. The on-screen controls call this. */
  setVirtual(action, down) {
    if (!this.enabled || !ACTION_SET.has(action)) return;
    if (down) {
      if (!this.held.has(action)) {
        this.held.add(action);
        this.pressed.add(action);
        this.anyPressed = true;
      }
    } else if (this.held.has(action)) {
      this.held.delete(action);
      this.released.add(action);
      this.holdTime.delete(action);
    }
  }

  /** Press an action for exactly one frame. Buttons and tests use this. */
  tap(action) {
    if (!ACTION_SET.has(action)) return;
    this.setVirtual(action, true);
    this._pulses.add(action);
  }

  /**
   * Feed the analog stick. Deflection past the deadzone sets the matching
   * directions; past `STICK_RUN` it also sets `run`, which is what makes
   * pushing the stick to the rim break into a run / full sail.
   */
  setStick(x, y) {
    this.stick.x = x;
    this.stick.y = y;
    const mag = Math.hypot(x, y);
    this.setVirtual('left', x < -STICK_DEADZONE);
    this.setVirtual('right', x > STICK_DEADZONE);
    this.setVirtual('up', y < -STICK_DEADZONE);
    this.setVirtual('down', y > STICK_DEADZONE);
    this.setVirtual('run', mag > STICK_RUN);
  }

  /** True while `action` is held. */
  isDown(action) {
    return this.held.has(action);
  }

  /** True on the single frame `action` transitions from up to down. */
  justPressed(action) {
    return this.pressed.has(action);
  }

  justReleased(action) {
    return this.released.has(action);
  }

  /**
   * True on the initial press and then on a steady cadence while held.
   * This is what menus and grid movement should use.
   */
  repeat(action) {
    return this.pressed.has(action) || this.repeated.has(action);
  }

  /** Directional helper: returns -1, 0 or 1 on each axis. */
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
    for (const action of DIRECTIONS) {
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
    if (this._pulses.size) {
      for (const action of this._pulses) this.setVirtual(action, false);
      this._pulses.clear();
      // A pulse's release edge belongs to the frame it happened in.
      this.released.clear();
    }
  }
}

export const input = new Input();

/** Human-readable control list, shared by the title screen and the help panel. */
export const CONTROL_HELP = [
  ['Left thumb', 'Touch and drag anywhere on the left to walk or steer'],
  ['Push to the rim', 'Break into a run on foot, full sail at sea'],
  ['◉ button', 'Talk, examine, confirm, advance text'],
  ['✕ button', 'Cancel, back out, close a window'],
  ['Log button', 'Crew, gear, items, journal, options and saving'],
  ['Chart button', 'Sea chart, while sailing'],
  ['Tap the screen', 'Advance dialogue'],
  ['Tap an enemy', 'Pick it as your target in battle'],
  ['Tap a menu row', 'Highlight it; tap again to choose it'],
];
