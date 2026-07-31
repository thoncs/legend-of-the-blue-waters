/**
 * Epilogue. Reads back the choices the player actually made, then credits,
 * then the offer to sail it all again harder.
 */
import { Container, Graphics, Sprite } from 'pixi.js';
import { Scene } from '../core/scene.js';
import { PixelText, measure } from '../core/font.js';
import { Panel, MenuList, UI, Blinker } from '../core/ui.js';
import { input } from '../core/input.js';
import { audio } from '../core/audio.js';
import { rng } from '../core/rng.js';
import { endingSummary } from '../systems/worldstate.js';
import { saveGame } from '../core/save.js';

export class EndingScene extends Scene {
  onEnter() {
    const { width, height, art, state } = this.game;

    const sky = new Graphics();
    sky.rect(0, 0, width, 30).fill(0x1a2c4a);
    sky.rect(0, 30, width, 22).fill(0x395a7a);
    sky.rect(0, 52, width, 18).fill(0x7a8fa0);
    sky.rect(0, 70, width, 14).fill(0xd8a878);
    sky.rect(0, 84, width, 12).fill(0xe8c890);
    this.addChild(sky);

    const sun = new Graphics();
    sun.circle(300, 92, 18).fill({ color: 0xffd08a, alpha: 0.25 });
    sun.circle(300, 92, 12).fill(0xffe0a0);
    this.addChild(sun);

    this.sea = new Container();
    this.sea.y = 96;
    this.addChild(this.sea);
    this.waterSprites = [];
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < width / 16 + 1; col++) {
        const s = new Sprite(art.tex('tile:water0'));
        s.x = col * 16;
        s.y = row * 16;
        s.tint = row < 2 ? 0xc8b090 : 0xffffff;
        this.sea.addChild(s);
        this.waterSprites.push(s);
      }
    }

    this.ship = new Sprite(art.ship(2, 'right'));
    this.ship.scale.set(2);
    this.ship.x = 60;
    this.ship.y = 76;
    this.addChild(this.ship);

    this.birds = [];
    for (let i = 0; i < 6; i++) {
      const b = new Sprite(art.tex('fx:dot'));
      b.tint = 0x33404f;
      b.x = rng() * width;
      b.y = 20 + rng() * 40;
      this.addChild(b);
      this.birds.push({ b, phase: rng() * 6.28, vx: 6 + rng() * 8 });
    }

    this.shade = new Graphics();
    this.shade.rect(0, 0, width, height).fill({ color: 0x080e16, alpha: 0.45 });
    this.addChild(this.shade);

    this.panel = new Panel(width - 28, 84);
    this.panel.x = 14;
    this.panel.y = 116;
    this.addChild(this.panel);

    this.head = new PixelText({ text: '', color: UI.accent });
    this.head.x = 22;
    this.head.y = 122;
    this.addChild(this.head);

    this.body = new PixelText({ text: '', color: UI.ink, maxWidth: width - 44 });
    this.body.x = 22;
    this.body.y = 136;
    this.addChild(this.body);

    this.prompt = new Blinker('press Z', UI.dim);
    this.prompt.x = width - 22 - measure('press Z');
    this.prompt.y = height - 14;
    this.addChild(this.prompt);

    this.pages = this.buildPages();
    this.page = -1;
    this.t = 0;
    this.reveal = 0;
    this.done = false;
    this.menu = null;

    audio.playTheme('ending');
    this.next();
    void state;
  }

  buildPages() {
    const { state } = this.game;
    const pages = [];

    pages.push({
      head: 'THE QUIET SEASON',
      text:
        'The wind over the Wailing Pass stops on a Tuesday, at about four in the afternoon, ' +
        'and the whole Sunder Reach hears it stop.',
    });
    pages.push({
      head: 'THE QUIET SEASON',
      text:
        'Marrowport keeps the night lane open. Mireborne says nothing about anything, loudly. ' +
        'Ashfall Rest sweeps its ash and does not look at the mountain.',
    });

    for (const entry of endingSummary(state)) {
      pages.push({
        head: entry.legend.toUpperCase(),
        text: `${entry.region}. ${entry.outcome}\n\n${entry.text}`,
      });
    }

    const rep = state.reputation;
    const liked = Object.entries(rep).sort((a, b) => b[1] - a[1])[0];
    pages.push({
      head: 'WHAT THEY SAY OF YOU',
      text:
        (liked && liked[1] > 0
          ? `In ${{ marrowport: 'Marrowport', mireborne: 'Mireborne', ashfall: 'Ashfall Rest' }[liked[0]]} they use your name as a promise. `
          : 'They use your name carefully, the way you use a sharp thing. ') +
        `Six legends told in ${state.day} days, and a chart with no tear in it.`,
    });

    pages.push({
      head: 'NIA CORVEL',
      text:
        '"She left me a list. I finished the list."\n\n' +
        '"So I am going to have to make my own, and that frightens me more than the Pass did."',
    });

    pages.push({
      head: 'LEGEND OF THE BLUE WATERS',
      text:
        'Design, code, art, and music generated at runtime — no external assets.\n' +
        'Original setting, characters and legends. Built with PixiJS.\n\n' +
        'Thank you for sailing the Reach.',
    });

    return pages;
  }

  next() {
    this.page++;
    if (this.page >= this.pages.length) { this.showMenu(); return; }
    const p = this.pages[this.page];
    this.head.text = p.head;
    this.body.text = p.text;
    this.body.reveal(0);
    this.reveal = 0;
    this.done = false;
  }

  showMenu() {
    if (this.menu) return;
    const { width, height, state } = this.game;
    // Preserve the cleared run so New Game+ can carry it.
    state.playTimeMs += performance.now() - this.game.sessionStart;
    this.game.sessionStart = performance.now();
    saveGame(0, state.toJSON(), state.saveMeta());

    this.head.text = 'THE VOYAGE ENDS';
    this.body.text = 'Your cleared log is saved to Log 1.';
    this.body.reveal(Infinity);
    this.prompt.visible = false;

    const items = [
      { label: 'New Game + (keep the crew, harder seas)', value: 'ngplus' },
      { label: 'Return to the title', value: 'title' },
    ];
    this.menu = new MenuList({
      items, width: width - 60, rows: 2, rowHeight: 12,
      onSelect: (item) => this.choose(item.value),
    });
    this.menu.x = 30;
    this.menu.y = height - 44;
    this.addChild(this.menu);
    void height;
  }

  async choose(value) {
    const { TitleScene } = await import('./TitleScene.js');
    if (value === 'ngplus') {
      const carry = this.game.state;
      const { IntroScene } = await import('./IntroScene.js');
      const snapshot = new (this.game.state.constructor)();
      snapshot.loadJSON(carry.toJSON());
      this.game.state.newGame({ carryOver: snapshot });
      this.game.sessionStart = performance.now();
      await this.game.scenes.replace(IntroScene, {}, { fade: true });
      return;
    }
    await this.game.scenes.replace(TitleScene, {}, { fade: true });
  }

  update(dtMS) {
    this.t += dtMS;
    this.prompt.update(dtMS);

    const frame = Math.floor(this.t / 380) % 3;
    if (frame !== this._wf) {
      this._wf = frame;
      const tex = this.game.art.tex(`tile:water${frame}`);
      for (const s of this.waterSprites) s.texture = tex;
    }
    this.ship.x += dtMS * 0.008;
    if (this.ship.x > this.game.width + 20) this.ship.x = -30;
    this.ship.y = 76 + Math.round(Math.sin(this.t / 700) * 2);

    for (const bird of this.birds) {
      bird.b.x += bird.vx * dtMS / 1000;
      bird.b.y += Math.sin(this.t / 500 + bird.phase) * 0.06;
      if (bird.b.x > this.game.width + 4) bird.b.x = -4;
    }

    if (this.menu) {
      this.menu.update(dtMS);
      this.menu.handleInput(input);
      return;
    }

    if (!this.done) {
      this.reveal += dtMS * 0.05;
      this.body.reveal(Math.floor(this.reveal));
      if (this.reveal >= this.body.charCount) this.done = true;
    }

    if (input.justPressed('confirm') || input.justPressed('cancel')) {
      if (!this.done) {
        this.reveal = this.body.charCount;
        this.body.reveal(this.reveal);
        this.done = true;
      } else {
        audio.play('cursor');
        this.next();
      }
    }
  }
}
