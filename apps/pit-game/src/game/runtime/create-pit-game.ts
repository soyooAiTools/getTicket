import Phaser from 'phaser';

import { buildPitScene } from './pit-scene';
import type { RuntimeController } from './runtime-controller';

export function createPitGame(container: HTMLElement, controller: RuntimeController) {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent: container,
    width: 1280,
    height: 720,
    backgroundColor: '#080808',
    scene: [buildPitScene(controller)],
  });
}
