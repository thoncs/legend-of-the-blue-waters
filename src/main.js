/**
 * Legend of the Blue Waters — entry point.
 *
 * Boots a PixiJS Application into a landscape-locked, touch-driven viewport.
 * The virtual stage is a fixed 648px tall and takes its width from the device
 * aspect ratio, so a phone fills edge to edge instead of letterboxing a 16:9
 * box into a ~2.16:1 screen. The renderer draws at the device's real pixel
 * density, so the art is upscaled once on the GPU rather than being squeezed
 * through a fractional CSS downscale.
 */
import { Application, Container } from 'pixi.js';
import { initFont } from './core/font.js';
import { buildArt } from './core/art.js';
import { input } from './core/input.js';
import { TouchControls } from './core/touch.js';
import { SceneManager } from './core/scene.js';
import { audio } from './core/audio.js';
import { loadOptions, saveOptions } from './core/save.js';
import { quality } from './core/quality.js';
import { GameState } from './systems/gamestate.js';
import { TitleScene } from './scenes/TitleScene.js';

/** The stage is always this tall; width flexes with the device. */
export const VIRTUAL_H = 648;
export const MIN_VIRTUAL_W = 1152; // 16:9
export const MAX_VIRTUAL_W = 1728; // ~2.67:1, wider than any phone
/** Nominal 16:9 width, for code that wants a "design" reference. */
export const VIRTUAL_W = MIN_VIRTUAL_W;

/** Apple's and Android's minimum comfortable touch target, in CSS pixels. */
const TOUCH_TARGET_CSS = 44;

/**
 * @typedef {object} Game
 * @property {Application} app
 * @property {number} width   current virtual stage width
 * @property {number} height  current virtual stage height (always VIRTUAL_H)
 * @property {number} touchUnit virtual px equal to a 44 CSS px touch target
 * @property {import('./core/art.js').Art} art
 * @property {SceneManager} scenes
 * @property {GameState} state
 */

/**
 * Work out the virtual stage size, the CSS footprint and the render
 * resolution for the current window.
 */
function measureViewport(maxRenderScale) {
  const dpr = window.devicePixelRatio || 1;
  const cssW = Math.max(1, window.innerWidth);
  const cssH = Math.max(1, window.innerHeight);
  const portrait = cssH > cssW;

  // Lay out for landscape even while the device is held portrait; a DOM
  // overlay asks the player to rotate rather than us reflowing twice.
  const availW = portrait ? cssH : cssW;
  const availH = portrait ? cssW : cssH;

  const vh = VIRTUAL_H;
  const vw = Math.round(
    Math.min(MAX_VIRTUAL_W, Math.max(MIN_VIRTUAL_W, vh * (availW / availH))),
  );

  // Fit the stage into the available box; equals availH/vh in the common case.
  const displayScale = Math.min(availW / vw, availH / vh);

  return {
    vw,
    vh,
    portrait,
    displayScale,
    resolution: Math.max(1, Math.min(displayScale * dpr, maxRenderScale)),
    cssWidth: Math.round(vw * displayScale),
    cssHeight: Math.round(vh * displayScale),
    touchUnit: Math.max(24, Math.ceil(TOUCH_TARGET_CSS / displayScale)),
  };
}

export async function boot({ host, onProgress = () => {} } = {}) {
  onProgress(0.05, 'Waking the renderer…');

  const options = loadOptions();
  quality.applySaved(options.quality);

  const first = measureViewport(quality.maxRenderScale);

  const app = new Application();
  await app.init({
    width: first.vw,
    height: first.vh,
    resolution: first.resolution,
    backgroundColor: 0x06131f,
    antialias: false,
    roundPixels: false,
    autoDensity: false,
    // Custom post-processing filters are written in GLSL, so pin the backend.
    preference: 'webgl',
    powerPreference: 'high-performance',
  });

  (host ?? document.body).appendChild(app.canvas);
  app.canvas.setAttribute('aria-label', 'Legend of the Blue Waters game screen');

  onProgress(0.25, 'Cutting the type…');
  initFont();

  onProgress(0.5, 'Painting the Sunder Reach…');
  const art = buildArt();

  onProgress(0.75, 'Provisioning the Salt Wren…');

  audio.setMusicVolume(options.musicVolume);
  audio.setSfxVolume(options.sfxVolume);
  audio.setMuted(options.muted);

  /** @type {Game} */
  const game = {
    app,
    width: first.vw,
    height: first.vh,
    touchUnit: first.touchUnit,
    viewport: first,
    art,
    audio,
    input,
    quality,
    options,
    saveOptions: () => saveOptions(game.options),
    state: new GameState(),
    scenes: null,
    touch: null,
    /** Total real time spent in-session, folded into the save file. */
    sessionStart: performance.now(),
  };

  app.stage.eventMode = 'static';
  app.stage.sortableChildren = false;

  game.scenes = new SceneManager(app, game);
  game.touch = new TouchControls(game);
  game.scenes.fxRoot.addChild(game.touch);

  // Audio can only start from a user gesture — on a phone that is the first tap.
  const unlock = () => {
    audio.unlock();
    window.removeEventListener('pointerdown', unlock);
  };
  window.addEventListener('pointerdown', unlock);

  input.attach(app.canvas);

  // --- viewport ------------------------------------------------------
  const rotateEl = document.getElementById('rotate-prompt');

  const fit = () => {
    const vp = measureViewport(quality.maxRenderScale);

    if (rotateEl) rotateEl.classList.toggle('shown', vp.portrait);
    // While held portrait the stage is covered anyway; skip the relayout so
    // rotating does not trigger two full reflows back to back.
    if (vp.portrait && game.viewport && !game.viewport.portrait) return;

    game.viewport = vp;
    game.width = vp.vw;
    game.height = vp.vh;
    game.touchUnit = vp.touchUnit;

    app.renderer.resize(vp.vw, vp.vh, vp.resolution);
    app.canvas.style.width = `${vp.cssWidth}px`;
    app.canvas.style.height = `${vp.cssHeight}px`;

    game.scenes.resize(vp.vw, vp.vh);
    game.touch.resize(vp.vw, vp.vh);
  };

  fit();
  window.addEventListener('resize', fit);
  window.addEventListener('orientationchange', fit);
  window.visualViewport?.addEventListener('resize', fit);

  // Re-fit when the renderer's own resolution budget changes.
  quality.onRenderScaleChange(fit);

  // --- main loop ----------------------------------------------------
  app.ticker.add((ticker) => {
    // Cap the step so a backgrounded tab cannot teleport the player.
    const dtMS = Math.min(ticker.deltaMS, 50);
    quality.sample(ticker.deltaMS);
    input.beginFrame(dtMS);
    game.touch.update(dtMS);
    game.scenes.update(dtMS);
    input.endFrame();
  });

  onProgress(0.95, 'Making sail…');
  await game.scenes.replace(TitleScene, {}, { fade: false });
  onProgress(1, 'Ready');

  // Handy for debugging from the console, and the hook the test tools drive.
  window.__lotbw = game;
  return game;
}

export { Container };
