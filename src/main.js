/**
 * Legend of the Blue Waters — entry point.
 *
 * Boots a PixiJS Application at a fixed virtual resolution and scales the
 * canvas with CSS so the pixel art always lands on whole pixels. Everything
 * else hangs off the shared `game` context created here.
 */
import { Application, Container } from 'pixi.js';
import { initFont } from './core/font.js';
import { buildArt } from './core/art.js';
import { input } from './core/input.js';
import { SceneManager } from './core/scene.js';
import { audio } from './core/audio.js';
import { loadOptions, saveOptions } from './core/save.js';
import { GameState } from './systems/gamestate.js';
import { TitleScene } from './scenes/TitleScene.js';

export const VIRTUAL_W = 384;
export const VIRTUAL_H = 216;

/**
 * @typedef {object} Game
 * @property {Application} app
 * @property {number} width
 * @property {number} height
 * @property {import('./core/art.js').Art} art
 * @property {SceneManager} scenes
 * @property {GameState} state
 */

export async function boot({ host, onProgress = () => {} } = {}) {
  onProgress(0.05, 'Waking the renderer…');

  const app = new Application();
  await app.init({
    width: VIRTUAL_W,
    height: VIRTUAL_H,
    backgroundColor: 0x06131f,
    antialias: false,
    roundPixels: true,
    autoDensity: false,
    resolution: 1,
    powerPreference: 'low-power',
  });

  (host ?? document.body).appendChild(app.canvas);
  app.canvas.setAttribute('aria-label', 'Legend of the Blue Waters game screen');
  app.canvas.tabIndex = 0;

  onProgress(0.25, 'Cutting the type…');
  initFont();

  onProgress(0.5, 'Painting the Sunder Reach…');
  const art = buildArt();

  onProgress(0.75, 'Provisioning the Salt Wren…');

  const options = loadOptions();
  audio.setMusicVolume(options.musicVolume);
  audio.setSfxVolume(options.sfxVolume);
  audio.setMuted(options.muted);

  /** @type {Game} */
  const game = {
    app,
    width: VIRTUAL_W,
    height: VIRTUAL_H,
    art,
    audio,
    input,
    options,
    saveOptions: () => saveOptions(game.options),
    state: new GameState(),
    scenes: null,
    /** Total real time spent in-session, folded into the save file. */
    sessionStart: performance.now(),
  };

  app.stage.eventMode = 'static';
  app.stage.sortableChildren = false;

  game.scenes = new SceneManager(app, game);

  // Audio can only start from a user gesture.
  const unlock = () => {
    audio.unlock();
    window.removeEventListener('keydown', unlock);
    window.removeEventListener('pointerdown', unlock);
  };
  window.addEventListener('keydown', unlock);
  window.addEventListener('pointerdown', unlock);

  input.attach(window);

  // Global mute toggle works from any scene.
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyN') {
      game.options.muted = audio.toggleMute();
      game.saveOptions();
    }
  });

  // --- responsive integer scaling -----------------------------------
  const fit = () => {
    const pad = 24;
    const availW = Math.max(160, window.innerWidth - pad);
    const availH = Math.max(120, window.innerHeight - pad);
    let scale = Math.min(availW / VIRTUAL_W, availH / VIRTUAL_H);
    // Prefer whole-number scaling; fall back to fractional on tiny windows.
    scale = scale >= 1 ? Math.floor(scale) : scale;
    app.canvas.style.width = `${Math.round(VIRTUAL_W * scale)}px`;
    app.canvas.style.height = `${Math.round(VIRTUAL_H * scale)}px`;
  };
  fit();
  window.addEventListener('resize', fit);

  // --- main loop ----------------------------------------------------
  app.ticker.add((ticker) => {
    // Cap the step so an alt-tab pause cannot teleport the player.
    const dtMS = Math.min(ticker.deltaMS, 50);
    input.beginFrame(dtMS);
    game.scenes.update(dtMS);
    input.endFrame();
  });

  onProgress(0.95, 'Making sail…');
  await game.scenes.replace(TitleScene, {}, { fade: false });
  onProgress(1, 'Ready');

  // Handy for debugging from the console; harmless in play.
  window.__lotbw = game;
  return game;
}

export { Container };
