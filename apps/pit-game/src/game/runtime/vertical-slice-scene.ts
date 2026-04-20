import Phaser from 'phaser';

import {
  getVerticalSliceWindowKey,
  type SliceLightCue,
  type VerticalSliceFrame,
} from '../domain/vertical-slice-director';
import type { VerticalSliceController } from './vertical-slice-controller';
import type {
  VerticalSliceAction,
  VerticalSliceInput,
  VerticalSlicePlayerState,
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

export interface CrowdBodyVisual {
  zone: VerticalSliceZone;
  x: number;
  y: number;
  tint: number;
  scale: number;
}

export interface PlayerPoseStyle {
  fillColor: number;
  scaleX: number;
  scaleY: number;
  angle: number;
}

export interface SliceLightPalette {
  venueFill: number;
  bandFill: number;
  barrierFill: number;
  pitFill: number;
  edgeFill: number;
  panelFill: number;
  accentText: string;
  bodyAlpha: number;
  crowdAlpha: number;
}

export interface SceneStepResult {
  snapshot: VerticalSliceSession;
  punchDetected: boolean;
  punchWindowKey: string | null;
}

const ZONE_BOUNDS: Record<VerticalSliceZone, { centerX: number; centerY: number; width: number; height: number }> = {
  front: { centerX: 640, centerY: 262, width: 640, height: 88 },
  center: { centerX: 640, centerY: 438, width: 500, height: 220 },
  edge: { centerX: 640, centerY: 624, width: 760, height: 80 },
  side: { centerX: 640, centerY: 456, width: 920, height: 240 },
};

const ZONE_TINTS: Record<VerticalSliceZone, number> = {
  front: 0xcf6f48,
  center: 0xa65738,
  edge: 0x6d4634,
  side: 0x86513d,
};

const MAX_SCENE_STEP_MS = 100;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

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

function zonePopulation(zone: VerticalSliceZone, pressure: number): number {
  switch (zone) {
    case 'center':
      return 6 + Math.floor(pressure / 14);
    case 'front':
      return 3 + Math.floor(pressure / 22);
    case 'side':
      return 4 + Math.floor(pressure / 22);
    case 'edge':
      return 2 + Math.floor(pressure / 26);
  }
}

function createZoneBodyVisuals(zone: VerticalSliceZone, count: number, pressure: number): CrowdBodyVisual[] {
  const bounds = ZONE_BOUNDS[zone];
  const visuals: CrowdBodyVisual[] = [];
  const columns = Math.max(1, Math.ceil(Math.sqrt(count)));
  const rows = Math.max(1, Math.ceil(count / columns));
  const stepX = bounds.width / (columns + 1);
  const stepY = bounds.height / (rows + 1);
  const pressureScale = 0.78 + pressure / 260;

  for (let index = 0; index < count; index += 1) {
    const row = Math.floor(index / columns);
    const column = index % columns;
    const centeredX =
      zone === 'side'
        ? (column % 2 === 0 ? 274 : 1_006) + (row % 2 === 0 ? -18 : 18)
        : bounds.centerX - bounds.width / 2 + stepX * (column + 1);
    const centeredY = bounds.centerY - bounds.height / 2 + stepY * (row + 1);
    const lateralOffset =
      zone === 'side'
        ? (index % 2 === 0 ? -1 : 1) * (18 + row * 6)
        : (column - (columns - 1) / 2) * 6;
    const verticalOffset = ((index % 3) - 1) * 5;

    visuals.push({
      zone,
      x: centeredX + lateralOffset,
      y: centeredY + verticalOffset,
      tint: ZONE_TINTS[zone],
      scale: clamp(pressureScale + ((index % 4) - 1.5) * 0.03, 0.74, 1.22),
    });
  }

  return visuals;
}

export function buildCrowdBodyLayout(frame: VerticalSliceFrame): CrowdBodyVisual[] {
  const counts = {
    front: zonePopulation('front', frame.zonePressure.front),
    center: zonePopulation('center', frame.zonePressure.center),
    edge: zonePopulation('edge', frame.zonePressure.edge),
    side: zonePopulation('side', frame.zonePressure.side),
  };

  return [
    ...createZoneBodyVisuals('front', counts.front, frame.zonePressure.front),
    ...createZoneBodyVisuals('center', counts.center, frame.zonePressure.center),
    ...createZoneBodyVisuals('side', counts.side, frame.zonePressure.side),
    ...createZoneBodyVisuals('edge', counts.edge, frame.zonePressure.edge),
  ];
}

export function resolvePlayerPoseStyle(player: Pick<VerticalSlicePlayerState, 'pose' | 'status'>): PlayerPoseStyle {
  if (player.status === 'down' || player.pose === 'fall') {
    return { fillColor: 0x7f5a49, scaleX: 1.18, scaleY: 0.48, angle: 88 };
  }

  switch (player.pose) {
    case 'brace':
      return { fillColor: 0xf6d59c, scaleX: 0.96, scaleY: 0.82, angle: 0 };
    case 'slip':
      return { fillColor: 0xf6d59c, scaleX: 1.18, scaleY: 0.86, angle: -18 };
    case 'shove':
      return { fillColor: 0xf1c485, scaleX: 1.08, scaleY: 0.92, angle: 12 };
    case 'stagger':
      return { fillColor: 0xd28f72, scaleX: 1.02, scaleY: 0.88, angle: 14 };
    default:
      return { fillColor: 0xf9e4ba, scaleX: 1, scaleY: 1, angle: 0 };
  }
}

export function resolveSliceLightPalette(lightCue: SliceLightCue): SliceLightPalette {
  switch (lightCue) {
    case 'room':
      return {
        venueFill: 0x130e0d,
        bandFill: 0x25100f,
        barrierFill: 0xb18a62,
        pitFill: 0x241715,
        edgeFill: 0x1a1211,
        panelFill: 0x090808,
        accentText: '#e8c894',
        bodyAlpha: 0.92,
        crowdAlpha: 0.84,
      };
    case 'tension':
      return {
        venueFill: 0x1c110f,
        bandFill: 0x3d1f1a,
        barrierFill: 0xc79e6b,
        pitFill: 0x2d1815,
        edgeFill: 0x201212,
        panelFill: 0x110909,
        accentText: '#ffce96',
        bodyAlpha: 0.95,
        crowdAlpha: 0.9,
      };
    case 'hit':
      return {
        venueFill: 0x24110f,
        bandFill: 0x513128,
        barrierFill: 0xf0c07f,
        pitFill: 0x3a1e1a,
        edgeFill: 0x261515,
        panelFill: 0x170c0b,
        accentText: '#ffe3b0',
        bodyAlpha: 1,
        crowdAlpha: 0.98,
      };
    case 'aftershock':
      return {
        venueFill: 0x171010,
        bandFill: 0x2f1715,
        barrierFill: 0xa67e63,
        pitFill: 0x261919,
        edgeFill: 0x1d1414,
        panelFill: 0x0d0909,
        accentText: '#d8b59d',
        bodyAlpha: 0.9,
        crowdAlpha: 0.8,
      };
  }
}

function resolvePlayerPosition(zone: VerticalSliceZone): { x: number; y: number } {
  switch (zone) {
    case 'front':
      return { x: 640, y: 294 };
    case 'center':
      return { x: 640, y: 470 };
    case 'side':
      return { x: 980, y: 490 };
    case 'edge':
      return { x: 640, y: 632 };
  }
}

function formatPhaseLabel(frame: VerticalSliceFrame): string {
  switch (frame.phase.kind) {
    case 'tension-in':
      return 'Phase: Tension In';
    case 'breakdown-peak':
      return 'Phase: Breakdown Peak';
    case 'aftershock':
      return 'Phase: Aftershock';
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
  let punchDetected = snapshot.frame.cameraCue === 'punch';
  let punchWindowKey = punchDetected ? getVerticalSliceWindowKey(snapshot.frame) : null;

  while (remainingMs > 0) {
    const sliceMs = Math.min(remainingMs, maxStepMs);
    controller.step(input, sliceMs);
    snapshot = controller.getSnapshot();
    if (snapshot.frame.cameraCue === 'punch') {
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

    create() {
      controller.reset();
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
    }

    update(_time: number, delta: number) {
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
      const bodyLayout = buildCrowdBodyLayout(snapshot.frame);
      const palette = resolveSliceLightPalette(snapshot.frame.lightCue);
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

      for (const body of bodyLayout) {
        const width = 22 * body.scale;
        const height = 44 * body.scale;
        this.crowdGraphics.fillStyle(body.tint, palette.crowdAlpha);
        this.crowdGraphics.fillRoundedRect(body.x - width / 2, body.y - height / 2, width, height, 8);
      }

      const poseStyle = resolvePlayerPoseStyle(snapshot.player);
      const playerPosition = resolvePlayerPosition(snapshot.player.zone);
      this.player.setPosition(playerPosition.x, snapshot.player.status === 'down' ? playerPosition.y + 22 : playerPosition.y);
      this.player.setFillStyle(poseStyle.fillColor);
      this.player.setScale(poseStyle.scaleX, poseStyle.scaleY);
      this.player.setAngle(poseStyle.angle);

      const impactKey = punchWindowKey ?? (snapshot.frame.cameraCue === 'punch' ? getVerticalSliceWindowKey(snapshot.frame) : null);
      if (punchDetected && impactKey && impactKey !== this.lastImpactKey) {
        this.cameras.main.shake(120, 0.0045);
        this.cameras.main.zoomTo(1.025, 90);
        this.lastImpactKey = impactKey;
      } else if (!impactKey) {
        this.lastImpactKey = null;
        this.cameras.main.setZoom(1);
      }

      this.phaseText.setText(formatPhaseLabel(snapshot.frame));
      this.summaryText.setText(formatSummary(snapshot));
    }
  };
}
