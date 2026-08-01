/**
 * Opening hook: four beats of narration on the Marrowport pier, straight into
 * a first fight, straight into the town. No menus between the player and a
 * reason to sail.
 */
import { Container, Graphics, Sprite } from 'pixi.js';
import { Scene } from '../core/scene.js';
import { PixelText, measure, LINE_H } from '../core/font.js';
import { Panel, UI, Blinker } from '../core/ui.js';
import { input } from '../core/input.js';
import { audio } from '../core/audio.js';
import { rng } from '../core/rng.js';
import { TILE } from '../core/art.js';

const PAGES = [
  {
    speaker: '',
    text:
      'They buried an empty coffin for Captain Verrin Corvel, because the sea had already ' +
      'taken the argument and would not give it back.',
  },
  {
    speaker: '',
    text:
      'She left you the Salt Wren, a berth you cannot afford, and a chart torn clean through ' +
      'the Wailing Pass.',
  },
  {
    speaker: 'Nia',
    text:
      'Six marks. Six legends the Reach still tells and nobody has finished. ' +
      'She meant to do all of them.',
  },
  {
    speaker: '',
    text:
      'Something comes up the pier behind you — sideways, patient, wearing a piece of ' +
      'somebody’s hull.',
  },
];

export class IntroScene extends Scene {
  onEnter() {
    this.controlScheme = 'tap';
    const { width, height, art } = this.game;

    // The pier tableau is composed against the original 216-tall design and
    // scaled onto the real stage; the text below it stays at native size.
    const K = height / 216;
    const dw = width / K;
    const scene = new Container();
    scene.scale.set(K);
    this.addChild(scene);

    const sky = new Graphics();
    sky.rect(0, 0, dw, 60).fill(0x101f33);
    sky.rect(0, 60, dw, 24).fill(0x1b3352);
    sky.rect(0, 84, dw, 20).fill(0x2f4a68);
    scene.addChild(sky);

    for (let i = 0; i < 60; i++) {
      const s = new Sprite(art.tex('fx:dot'));
      s.x = Math.floor(rng() * dw);
      s.y = Math.floor(rng() * 58);
      s.alpha = 0.2 + rng() * 0.6;
      s.tint = 0xd8e8ff;
      scene.addChild(s);
    }

    // Water below the pier.
    this.water = new Container();
    this.water.y = 104;
    this.water.scale.set(1 / 3);
    scene.addChild(this.water);
    this.waterSprites = [];
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < (dw * 3) / TILE + 1; col++) {
        const s = new Sprite(art.tex('tile:moonsea0'));
        s.x = col * TILE;
        s.y = row * TILE;
        this.water.addChild(s);
        this.waterSprites.push(s);
      }
    }

    // The pier itself.
    const pier = new Container();
    pier.y = 120;
    pier.scale.set(1 / 3);
    for (let col = 0; col < Math.ceil((dw * 3) / TILE) + 1; col++) {
      const s = new Sprite(art.tex('tile:dock'));
      s.x = col * TILE;
      s.y = 0;
      pier.addChild(s);
      const s2 = new Sprite(art.tex('tile:dock'));
      s2.x = col * TILE;
      s2.y = TILE;
      s2.tint = 0xb0b8c0;
      pier.addChild(s2);
    }
    scene.addChild(pier);

    // Nia, looking out.
    this.nia = new Sprite(art.actor('nia', 'right', 0));
    this.nia.scale.set(2 / 3);
    this.nia.x = dw * 0.3;
    this.nia.y = 74;
    scene.addChild(this.nia);

    // The crab, creeping in from the right.
    this.crab = new Sprite(art.battler('wreckCrab'));
    this.crab.scale.set(1 / 3);
    this.crab.x = dw + 20;
    this.crab.y = 72;
    scene.addChild(this.crab);

    // The Salt Wren at her berth.
    const ship = new Sprite(art.ship(0, 'left'));
    ship.scale.set(2 / 3);
    ship.x = dw * 0.62;
    ship.y = 60;
    this.ship = ship;
    scene.addChild(ship);
    this.crabHome = dw * 0.42;

    const vignette = new Graphics();
    vignette.eventMode = 'none';
    vignette.rect(0, 0, width, height).fill({ color: 0x0a1420, alpha: 0.25 });
    this.addChild(vignette);

    this.box = new Panel(width - 72, LINE_H * 3 + 48);
    this.box.x = 36;
    this.box.y = height - (LINE_H * 3 + 48) - 24;
    this.addChild(this.box);

    this.speaker = new PixelText({ text: '', color: UI.accent });
    this.speaker.x = 60;
    this.speaker.y = this.box.y + 18;
    this.addChild(this.speaker);

    this.body = new PixelText({ text: '', color: UI.ink, maxWidth: width - 132 });
    this.body.x = 60;
    this.body.y = this.box.y + 18 + LINE_H;
    this.addChild(this.body);

    this.prompt = new Blinker('tap to go on', 0x8fa8bc);
    this.prompt.x = width - 72 - measure('tap to go on');
    this.prompt.y = this.box.y + this.box.panelHeight - LINE_H - 12;
    this.addChild(this.prompt);

    this.page = -1;
    this.t = 0;
    this.reveal = 0;
    this.pageDone = false;
    audio.playTheme('title');
    this.nextPage();
  }

  nextPage() {
    this.page++;
    if (this.page >= PAGES.length) { this.toBattle(); return; }
    const p = PAGES[this.page];
    this.speaker.text = p.speaker;
    this.body.text = p.text;
    this.body.reveal(0);
    this.reveal = 0;
    this.pageDone = false;
  }

  async toBattle() {
    if (this._leaving) return;
    this._leaving = true;
    const { FieldScene } = await import('./FieldScene.js');
    const { startBattle } = await import('./BattleScene.js');
    const game = this.game;
    audio.play('encounter');
    await startBattle(game, {
      enemies: ['wreckCrab', 'wreckCrab'],
      canFlee: false,
      backdrop: 'shore',
      music: 'battle',
      introText: 'Wreck crabs come up the pier.',
      tutorial: true,
      onFinish: async () => {
        game.state.restAll();
        await game.scenes.replace(FieldScene, {
          mapId: 'marrowport',
          resume: true,
          banner: 'Marrowport',
          openingNotice:
            'Rook Ondari is waiting on the dock. The harbourmaster wants a word about ' +
            'the lanterns out at Moonwrack.',
        }, { fade: true });
      },
    });
  }

  update(dtMS) {
    this.t += dtMS;
    this.prompt.update(dtMS);

    const frame = Math.floor(this.t / 300) % 4;
    if (frame !== this._wf) {
      this._wf = frame;
      const tex = this.game.art.tex(`tile:moonsea${frame}`);
      for (const s of this.waterSprites) s.texture = tex;
    }
    this.ship.y = 60 + Math.round(Math.sin(this.t / 700) * 2);

    // The crab only starts crawling on the last beat.
    if (this.page >= PAGES.length - 1) {
      this.crab.x = Math.max(this.crabHome, this.crab.x - dtMS * 0.05);
      this.crab.y = 72 + Math.round(Math.sin(this.t / 160) * 1);
      this.nia.texture = this.game.art.actor('nia', 'right', 1);
    }

    if (!this.pageDone) {
      this.reveal += dtMS * 0.055;
      this.body.reveal(Math.floor(this.reveal));
      if (this.reveal >= this.body.charCount) this.pageDone = true;
      this.prompt.visible = false;
    } else {
      this.prompt.visible = true;
    }

    if (input.justPressed('confirm') || input.justPressed('cancel')) {
      if (!this.pageDone) {
        this.reveal = this.body.charCount;
        this.body.reveal(this.reveal);
        this.pageDone = true;
      } else {
        audio.play('cursor');
        this.nextPage();
      }
    }
  }
}
