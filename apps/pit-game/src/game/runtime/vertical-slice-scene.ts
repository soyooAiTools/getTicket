import Phaser from 'phaser';

import {
  getVerticalSliceWindowKey,
  type VerticalSliceFrame,
} from '../domain/vertical-slice-director';
import type { VerticalSliceController } from './vertical-slice-controller';
import { createSliceRenderState } from './vertical-slice-presentation';
import type {
  VerticalSliceAction,
  VerticalSliceInput,
  VerticalSliceSession,
  VerticalSliceZone,
} from './vertical-slice-session';

export interface SliceControlState {
  move: boolean;
  shove: boolean;
  brace: boolean;
  slip: boolean;
  front: boolean;
  center: boolean;
  edge: boolean;
  side: boolean;
}

export interface SceneStepResult {
  snapshot: VerticalSliceSession;
  punchDetected: boolean;
  punchWindowKey: string | null;
}

const MAX_SCENE_STEP_MS = 100;

function resolveTargetZone(state: SliceControlState, currentZone: VerticalSliceZone): VerticalSliceZone {
  if (state.front) {
    return 'front';
  }

  if (state.center) {
    return 'center';
  }

  if (state.edge) {
    return 'edge';
  }

  if (state.side) {
    return 'side';
  }

  return currentZone;
}

export function resolveSliceInput(
  state: SliceControlState,
  currentZone: VerticalSliceZone,
): { action: VerticalSliceAction; targetZone: VerticalSliceZone } {
  const action: VerticalSliceAction = state.brace
    ? 'brace'
    : state.slip
      ? 'slip'
      : state.shove
        ? 'shove'
        : state.move
          ? 'move'
          : 'idle';

  return {
    action,
    targetZone: resolveTargetZone(state, currentZone),
  };
}

function formatPhaseLabel(frame: VerticalSliceFrame): string {
  switch (frame.phase.kind) {
    case 'walk-in-pressure':
      return 'Phase: Walk-In Pressure';
    case 'build':
      return 'Phase: Build';
    case 'breakdown-peak':
      return 'Phase: Breakdown Peak';
    case 'aftershock':
      return 'Phase: Aftershock';
    default:
      return `Phase: ${frame.phase.kind}`;
  }
}

function formatSummary(snapshot: ReturnType<VerticalSliceController['getSnapshot']>): string {
  if (snapshot.summary) {
    return `${snapshot.summary.label} | Hit Windows ${snapshot.summary.hitWindows} | Downs ${snapshot.summary.downCount}`;
  }

  const eventLabel = snapshot.frame.event ? snapshot.frame.event.kind.replace('-', ' ') : 'room swell';
  return `${eventLabel} | Balance ${Math.round(snapshot.player.balance)} | Stamina ${Math.round(snapshot.player.stamina)}`;
}

export function stepSceneController(
  controller: Pick<VerticalSliceController, 'step' | 'getSnapshot'>,
  input: VerticalSliceInput,
  delta: number,
  maxStepMs = MAX_SCENE_STEP_MS,
): SceneStepResult {
  const safeDelta = Math.max(0, delta);
  let remainingMs = safeDelta;
  let snapshot = controller.getSnapshot();
  let punchDetected = snapshot.frame.cameraCue === 'impact';
  let punchWindowKey = punchDetected ? getVerticalSliceWindowKey(snapshot.frame) : null;

  while (remainingMs > 0) {
    const sliceMs = Math.min(remainingMs, maxStepMs);
    controller.step(input, sliceMs);
    snapshot = controller.getSnapshot();
    if (snapshot.frame.cameraCue === 'impact') {
      punchDetected = true;
      punchWindowKey = getVerticalSliceWindowKey(snapshot.frame);
    }
    remainingMs -= sliceMs;
  }

  return { snapshot, punchDetected, punchWindowKey };
}

export function buildVerticalSliceScene(controller: VerticalSliceController) {
  return class VerticalSliceScene extends Phaser.Scene {
    private controls!: Record<keyof SliceControlState, Phaser.Input.Keyboard.Key>;
    private crowdGraphics!: Phaser.GameObjects.Graphics;
    private player!: Phaser.GameObjects.Rectangle;
    private venueBackdrop!: Phaser.GameObjects.Rectangle;
    private bandArea!: Phaser.GameObjects.Rectangle;
    private barrierLine!: Phaser.GameObjects.Rectangle;
    private pitFloor!: Phaser.GameObjects.Rectangle;
    private edgeLane!: Phaser.GameObjects.Rectangle;
    private readoutPanel!: Phaser.GameObjects.Rectangle;
    private venueReadoutLabel!: Phaser.GameObjects.Text;
    private bandLabel!: Phaser.GameObjects.Text;
    private barrierLabel!: Phaser.GameObjects.Text;
    private edgeLabel!: Phaser.GameObjects.Text;
    private phaseText!: Phaser.GameObjects.Text;
    private summaryText!: Phaser.GameObjects.Text;
    private selectedZone: VerticalSliceZone = 'edge';
    private lastImpactKey: string | null = null;
    private controllerUnsubscribe: (() => void) | null = null;

    create() {
      const initialSnapshot = controller.getSnapshot();
      this.selectedZone = initialSnapshot.player.zone;

      this.venueBackdrop = this.add.rectangle(640, 360, 1_120, 640, 0x130e0d, 0.98);
      this.add.rectangle(640, 134, 1_040, 150, 0x080607, 0.96);
      this.bandArea = this.add.rectangle(640, 168, 360, 70, 0x25100f, 0.8);
      this.barrierLine = this.add.rectangle(640, 314, 920, 6, 0xc7a06b, 0.45);
      this.pitFloor = this.add.rectangle(640, 452, 980, 330, 0x241715, 0.86);
      this.edgeLane = this.add.rectangle(640, 632, 980, 110, 0x1a1211, 0.9);
      this.readoutPanel = this.add.rectangle(232, 112, 334, 132, 0x090808, 0.88).setOrigin(0, 0);

      this.venueReadoutLabel = this.add.text(254, 134, 'Venue Readout', {
        fontFamily: 'Segoe UI, sans-serif',
        fontSize: '18px',
        color: '#f3d6a1',
      });
      this.phaseText = this.add.text(254, 168, '', {
        fontFamily: 'Segoe UI, sans-serif',
        fontSize: '28px',
        color: '#f7efe1',
      });
      this.summaryText = this.add.text(254, 208, '', {
        fontFamily: 'Segoe UI, sans-serif',
        fontSize: '15px',
        color: '#dcb998',
        wordWrap: { width: 290 },
      });

      this.bandLabel = this.add.text(520, 136, 'Band', {
        fontFamily: 'Segoe UI, sans-serif',
        fontSize: '24px',
        color: '#f7efe1',
      });
      this.barrierLabel = this.add.text(580, 332, 'Barrier', {
        fontFamily: 'Segoe UI, sans-serif',
        fontSize: '14px',
        color: '#c8a77a',
      });
      this.edgeLabel = this.add.text(566, 602, 'Edge Lane', {
        fontFamily: 'Segoe UI, sans-serif',
        fontSize: '14px',
        color: '#b89572',
      });

      this.crowdGraphics = this.add.graphics();
      this.player = this.add.rectangle(640, 632, 34, 54, 0xf9e4ba);

      this.controls = {
        move: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
        shove: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
        brace: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.F),
        slip: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        front: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
        center: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
        edge: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
        side: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
      };

      this.renderSnapshot(initialSnapshot, false, null);
      this.controllerUnsubscribe = controller.subscribe((snapshot) => {
        if (!controller.isRunning()) {
          this.selectedZone = snapshot.player.zone;
          this.renderSnapshot(snapshot, false, null);
        }
      });

      this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);
      this.events.once(Phaser.Scenes.Events.DESTROY, this.handleShutdown, this);
    }

    update(_time: number, delta: number) {
      if (!controller.isRunning()) {
        return;
      }

      const input = resolveSliceInput(
        {
          move: this.controls.move.isDown,
          shove: this.controls.shove.isDown,
          brace: this.controls.brace.isDown,
          slip: this.controls.slip.isDown,
          front: this.controls.front.isDown,
          center: this.controls.center.isDown,
          edge: this.controls.edge.isDown,
          side: this.controls.side.isDown,
        },
        this.selectedZone,
      );

      this.selectedZone = input.targetZone;
      const result = stepSceneController(controller, input, delta);
      this.renderSnapshot(result.snapshot, result.punchDetected, result.punchWindowKey);
    }

    private renderSnapshot(snapshot: VerticalSliceSession, punchDetected: boolean, punchWindowKey: string | null) {
      const renderState = createSliceRenderState(snapshot);
      const bodyLayout = [
        ...renderState.crowd.front,
        ...renderState.crowd.center,
        ...renderState.crowd.side,
        ...renderState.crowd.edge,
      ];
      const { palette } = renderState.venue;
      this.crowdGraphics.clear();

      this.venueBackdrop.setFillStyle(palette.venueFill, palette.bodyAlpha);
      this.bandArea.setFillStyle(palette.bandFill, palette.bodyAlpha);
      this.barrierLine.setFillStyle(palette.barrierFill, 0.58);
      this.pitFloor.setFillStyle(palette.pitFill, 0.9);
      this.edgeLane.setFillStyle(palette.edgeFill, 0.94);
      this.readoutPanel.setFillStyle(palette.panelFill, 0.9);
      this.venueReadoutLabel.setColor(palette.accentText);
      this.phaseText.setColor(palette.accentText);
      this.summaryText.setColor(palette.accentText);
      this.bandLabel.setColor(palette.accentText);
      this.barrierLabel.setColor(palette.accentText);
      this.edgeLabel.setColor(palette.accentText);
      this.bandArea.setPosition(renderState.venue.stage.x, renderState.venue.stage.y + 22);
      this.barrierLine.setPosition(renderState.venue.front.x, renderState.venue.front.y + 28);
      this.pitFloor.setPosition(renderState.venue.center.x, renderState.venue.center.y);
      this.edgeLane.setPosition(renderState.venue.edge.x, renderState.venue.edge.y);

      for (const body of bodyLayout) {
        const width = 22 * body.scale;
        const height = 44 * body.scale;
        this.crowdGraphics.fillStyle(body.tint, palette.crowdAlpha);
        this.crowdGraphics.fillRoundedRect(body.x - width / 2, body.y - height / 2, width, height, 8);
      }

      const poseStyle = renderState.player.poseStyle;
      this.player.setPosition(renderState.player.x, renderState.player.y);
      this.player.setFillStyle(poseStyle.fillColor);
      this.player.setScale(poseStyle.scaleX, poseStyle.scaleY);
      this.player.setAngle(poseStyle.angle);
      this.cameras.main.setZoom(renderState.camera.zoom);

      const impactKey =
        punchWindowKey ?? (snapshot.frame.cameraCue === 'impact' ? getVerticalSliceWindowKey(snapshot.frame) : null);
      if (punchDetected && impactKey && impactKey !== this.lastImpactKey) {
        this.cameras.main.shake(110, 0.0045);
        this.cameras.main.zoomTo(1.025, 90);
        this.lastImpactKey = impactKey;
      } else if (!impactKey) {
        this.lastImpactKey = null;
      }

      this.phaseText.setText(formatPhaseLabel(snapshot.frame));
      this.summaryText.setText(formatSummary(snapshot));
    }

    private handleShutdown() {
      this.controllerUnsubscribe?.();
      this.controllerUnsubscribe = null;
    }
  };
}
