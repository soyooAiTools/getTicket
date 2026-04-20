import Phaser from 'phaser';

import type { PlayerAction, PlayerInput, PlayerZone } from '../domain/player-state';
import type { RuntimeController } from './runtime-controller';

export interface PitControlState {
  slip: boolean;
  twoStep: boolean;
  shove: boolean;
  brace: boolean;
  lift: boolean;
  edge: boolean;
  center: boolean;
  front: boolean;
  side: boolean;
}

export function resolvePitInput(state: PitControlState, currentZone: PlayerZone): PlayerInput {
  const targetZone = state.edge
    ? 'edge'
    : state.front
      ? 'front'
      : state.side
        ? 'side'
        : state.center
          ? 'center'
          : currentZone;

  const action: PlayerAction = state.lift
    ? 'lift'
    : state.brace
      ? 'brace'
      : state.shove
        ? 'shove'
        : state.twoStep
          ? 'two-step'
          : state.slip
            ? 'slip'
            : 'idle';

  return { action, targetZone };
}

export function buildPitScene(controller: RuntimeController) {
  return class PitScene extends Phaser.Scene {
    private player!: Phaser.GameObjects.Arc;
    private selectedZone: PlayerZone = 'center';
    private controls!: Record<keyof PitControlState, Phaser.Input.Keyboard.Key>;

    create() {
      this.add.rectangle(640, 360, 1_020, 560, 0x1b1411, 0.9);
      this.add.rectangle(640, 360, 580, 320, 0x3d1411, 0.45);
      this.add.rectangle(640, 180, 1_020, 90, 0x080808, 1);
      this.player = this.add.circle(420, 460, 18, 0xf2d39a);
      this.controls = {
        slip: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        twoStep: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
        shove: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
        brace: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.F),
        lift: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E),
        edge: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
        center: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
        front: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
        side: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
      };
    }

    update(_time: number, delta: number) {
      const input = resolvePitInput(
        {
          slip: this.controls.slip.isDown,
          twoStep: this.controls.twoStep.isDown,
          shove: this.controls.shove.isDown,
          brace: this.controls.brace.isDown,
          lift: this.controls.lift.isDown,
          edge: this.controls.edge.isDown,
          center: this.controls.center.isDown,
          front: this.controls.front.isDown,
          side: this.controls.side.isDown,
        },
        this.selectedZone,
      );
      this.selectedZone = input.targetZone;
      controller.step(input, delta);

      const snapshot = controller.getSnapshot();
      this.player.x = snapshot.player.zone === 'edge' ? 320 : snapshot.player.zone === 'side' ? 900 : 640;
      this.player.y = snapshot.player.status === 'down' ? 510 : 460;
    }
  };
}
