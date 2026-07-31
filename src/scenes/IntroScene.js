/**
 * Opening hook: four beats of narration on the Marrowport pier, straight into
 * a first fight, straight into the town. No menus between the player and a
 * reason to sail.
 */
import { Container, Graphics, Sprite } from 'pixi.js';
import { Scene } from '../core/scene.js';
import { PixelText, measure } from '../core/font.js';
import { Panel, UI, Blinker } from '../core/ui.js';
import { input } from '../core/input.js';
import { audio } from '../core/audio.js';
import { rng } from '../core/rng.js';

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
    const { width, height, art } = this.game;

    const sky = new Graphics();
    sky.rect(0, 0, width, 60).fill(0x101f33);
    sky.rect(0, 60, width, 24).fill(0x1b3352);
    sky.rect(0, 84, width, 20).fill(0x2f4a68);
    this.addChild(sky);

    for (let i = 0; i < 40; i++) {
      const s = new Sprite(art.tex('fx:dot'));
      s.x = Math.floor(rng() * width);
      s.y = Math.floor(rng() * 58);
      s.alpha = 0.2 + rng() * 0.6;
      s.tint = 0xd8e8ff;
      this.addChild(s);
    }

    // Water below the pier.
    this.water = new Container();
    this.water.y = 104;
    this.addChild(this.water);
    this.waterSprites = [];
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < width / 16 + 1; col++) {
        const s = new Sprite(art.tex('tile:moonsea0'));
        s.x = col * 16;
        s.y = row * 16;
        this.water.addChild(s);
        this.waterSprites.push(s);
      }
    }

    // The pier itself.
    const pier = new Container();
    pier.y = 120;
    for (let col = 0; col < 14; col++) {
      const s = new Sprite(art.tex('tile:dock'));
      s.x = col * 16;
      s.y = 0;
      pier.addChild(s);
      const s2 = new Sprite(art.tex('tile:dock'));
      s2.x = col * 16;
      s2.y = 16;
      s2.tint = 0xb0b8c0;
      pier.addChild(s2);
    }
    this.addChild(pier);

    // Nia, looking out.
    this.nia = new Sprite(art.actor('nia', 'right', 0));
    this.nia.scale.set(2);
    this.nia.x = 120;
    this.nia.y = 92;
    this.addChild(this.nia);

    // The crab, creeping in from the right.
    this.crab = new Sprite(art.battler('wreckCrab'));
    this.crab.x = width + 20;
    this.crab.y = 96;
    this.addChild(this.crab);

    // The Salt Wren at her berth.
    const ship = new Sprite(art.ship(0, 'left'));
    ship.scale.set(2);
    ship.x = 250;
    ship.y = 96;
    this.ship = ship;
    this.addChild(ship);

    const vignette = new Graphics();
    vignette.rect(0, 0, width, height).fill({ color: 0x0a1420, alpha: 0.25 });
    this.addChild(vignette);

    this.box = new Panel(width - 24, 46);
    this.box.x = 12;
    this.box.y = height - 58;
    this.addChild(this.box);

    this.speaker = new PixelText({ text: '', color: UI.accent });
    this.speaker.x = 20;
    this.speaker.y = height - 54;
    this.addChild(this.speaker);

    this.body = new PixelText({ text: '', color: UI.ink, maxWidth: width - 44 });
    this.body.x = 20;
    this.body.y = height - 42;
    this.addChild(this.body);

    this.prompt = new Blinker('press Z', 0x8fa8bc);
    this.prompt.x = width - 24 - measure('press Z');
    this.prompt.y = height - 20;
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

    const frame = Math.floor(this.t / 340) % 3;
    if (frame !== this._wf) {
      this._wf = frame;
      const tex = this.game.art.tex(`tile:moonsea${frame}`);
      for (const s of this.waterSprites) s.texture = tex;
    }
    this.ship.y = 96 + Math.round(Math.sin(this.t / 700) * 2);

    // The crab only starts crawling on the last beat.
    if (this.page >= PAGES.length - 1) {
      this.crab.x = Math.max(210, this.crab.x - dtMS * 0.045);
      this.crab.y = 96 + Math.round(Math.sin(this.t / 160) * 1);
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
