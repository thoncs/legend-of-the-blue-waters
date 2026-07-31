/**
 * Defeat. Offers the most recent log, or the title.
 */
import { Graphics } from 'pixi.js';
import { Scene } from '../core/scene.js';
import { PixelText, measure } from '../core/font.js';
import { MenuList, Panel, UI } from '../core/ui.js';
import { input } from '../core/input.js';
import { audio } from '../core/audio.js';
import { slotSummaries, loadGame, formatPlayTime } from '../core/save.js';

export class GameOverScene extends Scene {
  onEnter() {
    const { width, height } = this.game;

    const bg = new Graphics();
    bg.rect(0, 0, width, height).fill(0x070c14);
    bg.rect(0, height - 46, width, 46).fill(0x0d1a26);
    this.addChild(bg);

    const title = new PixelText({ text: 'THE REACH KEEPS WHAT IT TAKES', color: 0x9a6a6a });
    title.scale.set(2);
    title.x = Math.round((width - measure('THE REACH KEEPS WHAT IT TAKES') * 2) / 2);
    title.y = 44;
    this.addChild(title);

    const sub = new PixelText({
      text: 'The Salt Wren is found the next week — empty, dry, and pointing the wrong way.',
      color: UI.dim,
      maxWidth: width - 60,
      align: 'center',
    });
    sub.x = 30;
    sub.y = 70;
    this.addChild(sub);

    const saves = slotSummaries();
    const items = saves
      .map((s, i) => (s ? {
        label: `Open Log ${i + 1}  ${s.leader} Lv${s.level}`,
        right: `${s.legends}/6 · ${formatPlayTime(s.playTimeMs ?? 0)}`,
        value: i,
      } : null))
      .filter(Boolean);
    items.push({ label: 'Return to the title', value: 'title' });

    const panelW = 250;
    const panelH = items.length * 12 + 16;
    const panel = new Panel(panelW, panelH);
    panel.x = Math.round((width - panelW) / 2);
    panel.y = 108;
    this.addChild(panel);

    this.menu = new MenuList({
      items, width: panelW - 14, rows: items.length, rowHeight: 12,
      onSelect: (item) => this.choose(item.value),
    });
    this.menu.x = panel.x + 7;
    this.menu.y = panel.y + 8;
    this.addChild(this.menu);

    audio.stopTheme();
  }

  async choose(value) {
    const { state } = this.game;
    if (value === 'title') {
      const { TitleScene } = await import('./TitleScene.js');
      await this.game.scenes.replace(TitleScene, {}, { fade: true });
      return;
    }
    const rec = loadGame(value);
    if (!rec) return;
    state.loadJSON(rec.data);
    this.game.sessionStart = performance.now();
    if (state.position.map === 'SEA') {
      const { SeaChartScene } = await import('./SeaChartScene.js');
      await this.game.scenes.replace(SeaChartScene, {}, { fade: true });
    } else {
      const { FieldScene } = await import('./FieldScene.js');
      await this.game.scenes.replace(FieldScene, { mapId: state.position.map, resume: true }, { fade: true });
    }
  }

  update(dtMS) {
    this.menu.update(dtMS);
    this.menu.handleInput(input);
  }
}
