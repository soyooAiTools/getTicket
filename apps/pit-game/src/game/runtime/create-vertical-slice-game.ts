import Phaser from 'phaser';

import { buildVerticalSliceScene } from './vertical-slice-scene';
import type { VerticalSliceController } from './vertical-slice-controller';

export function createVerticalSliceGame(container: HTMLElement, controller: VerticalSliceController) {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent: container,
    width: 1280,
    height: 720,
    backgroundColor: '#050403',
    scene: [buildVerticalSliceScene(controller)],
  });
}
