import Phaser from 'phaser';

import type { PlayerAction } from '../domain/player-state';
import type { RuntimeController } from './runtime-controller';

export function buildPitScene(controller: RuntimeController) {
  return class PitScene extends Phaser.Scene {
    private player!: Phaser.GameObjects.Arc;
    private lastInput: PlayerAction = 'idle';

    create() {
      this.add.rectangle(640, 360, 1_020, 560, 0x1b1411, 0.9);
      this.add.rectangle(640, 360, 580, 320, 0x3d1411, 0.45);
      this.add.rectangle(640, 180, 1_020, 90, 0x080808, 1);
      this.player = this.add.circle(420, 460, 18, 0xf2d39a);

      this.input.keyboard?.on('keydown-A', () => {
        this.lastInput = 'slip';
      });
      this.input.keyboard?.on('keydown-S', () => {
        this.lastInput = 'two-step';
      });
      this.input.keyboard?.on('keydown-D', () => {
        this.lastInput = 'shove';
      });
      this.input.keyboard?.on('keydown-F', () => {
        this.lastInput = 'brace';
      });
      this.input.keyboard?.on('keydown-E', () => {
        this.lastInput = 'lift';
      });
    }

    update(_time: number, delta: number) {
      controller.step({ action: this.lastInput, targetZone: 'center' }, delta);
      this.lastInput = 'idle';

      const snapshot = controller.getSnapshot();
      this.player.x = snapshot.player.zone === 'edge' ? 320 : snapshot.player.zone === 'side' ? 900 : 640;
      this.player.y = snapshot.player.status === 'down' ? 510 : 460;
    }
  };
}
