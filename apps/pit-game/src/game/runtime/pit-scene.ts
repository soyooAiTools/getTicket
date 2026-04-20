import Phaser from 'phaser';

import type { PlayerAction, PlayerInput, PlayerZone } from '../domain/player-state';
import type { SessionFeedback } from '../domain/session-feedback';
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

export interface PitZoneVisual {
  id: 'front' | 'center' | 'edge' | 'side-left' | 'side-right';
  zone: PlayerZone;
  label: string;
  caption: string;
  tag: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fillColor: number;
  strokeColor: number;
  pressure: number;
  pressureLabel: string;
  isCurrentZone: boolean;
  isRecommendedZone: boolean;
}

function getPressureLabel(pressure: number): 'Open' | 'Active' | 'Hot' | 'Crushing' {
  if (pressure >= 82) {
    return 'Crushing';
  }

  if (pressure >= 60) {
    return 'Hot';
  }

  if (pressure >= 35) {
    return 'Active';
  }

  return 'Open';
}

function getZoneFillColor(state: PitZoneVisual['pressureLabel']): number {
  switch (state) {
    case 'Crushing':
      return 0xb33624;
    case 'Hot':
      return 0x8d341f;
    case 'Active':
      return 0x5a2618;
    case 'Open':
      return 0x281712;
  }

  throw new Error(`Unsupported pressure label: ${state}`);
}

function getZoneStrokeColor(visual: Pick<PitZoneVisual, 'isCurrentZone' | 'isRecommendedZone' | 'pressureLabel'>): number {
  if (visual.isCurrentZone && visual.isRecommendedZone) {
    return 0xffe0a8;
  }

  if (visual.isRecommendedZone) {
    return 0xf3c383;
  }

  if (visual.isCurrentZone) {
    return 0xf5f1e8;
  }

  switch (visual.pressureLabel) {
    case 'Crushing':
      return 0xff8f72;
    case 'Hot':
      return 0xe06f55;
    case 'Active':
      return 0x9f4f3c;
    case 'Open':
      return 0x725349;
  }

  throw new Error(`Unsupported pressure label: ${visual.pressureLabel}`);
}

export function buildPitZoneVisuals(feedback: SessionFeedback): PitZoneVisual[] {
  const { zones } = feedback;

  return [
    {
      id: 'front',
      zone: 'front',
      label: 'FRONT',
      caption: 'Closest to the stage',
      tag: 'STAGE',
      x: 640,
      y: 238,
      width: 920,
      height: 84,
      fillColor: getZoneFillColor(getPressureLabel(zones.front.pressure)),
      strokeColor: getZoneStrokeColor(zones.front),
      pressure: zones.front.pressure,
      pressureLabel: getPressureLabel(zones.front.pressure),
      isCurrentZone: zones.front.isCurrentZone,
      isRecommendedZone: zones.front.isRecommendedZone,
    },
    {
      id: 'side-left',
      zone: 'side',
      label: 'SIDE',
      caption: 'Left lane',
      tag: 'L',
      x: 218,
      y: 430,
      width: 164,
      height: 252,
      fillColor: getZoneFillColor(getPressureLabel(zones.side.pressure)),
      strokeColor: getZoneStrokeColor(zones.side),
      pressure: zones.side.pressure,
      pressureLabel: getPressureLabel(zones.side.pressure),
      isCurrentZone: zones.side.isCurrentZone,
      isRecommendedZone: zones.side.isRecommendedZone,
    },
    {
      id: 'center',
      zone: 'center',
      label: 'CENTER',
      caption: 'Main pit',
      tag: 'PIT',
      x: 640,
      y: 426,
      width: 548,
      height: 204,
      fillColor: getZoneFillColor(getPressureLabel(zones.center.pressure)),
      strokeColor: getZoneStrokeColor(zones.center),
      pressure: zones.center.pressure,
      pressureLabel: getPressureLabel(zones.center.pressure),
      isCurrentZone: zones.center.isCurrentZone,
      isRecommendedZone: zones.center.isRecommendedZone,
    },
    {
      id: 'side-right',
      zone: 'side',
      label: 'SIDE',
      caption: 'Right lane',
      tag: 'R',
      x: 1062,
      y: 430,
      width: 164,
      height: 252,
      fillColor: getZoneFillColor(getPressureLabel(zones.side.pressure)),
      strokeColor: getZoneStrokeColor(zones.side),
      pressure: zones.side.pressure,
      pressureLabel: getPressureLabel(zones.side.pressure),
      isCurrentZone: zones.side.isCurrentZone,
      isRecommendedZone: zones.side.isRecommendedZone,
    },
    {
      id: 'edge',
      zone: 'edge',
      label: 'EDGE',
      caption: 'Safer perimeter',
      tag: 'OUTER',
      x: 640,
      y: 660,
      width: 960,
      height: 70,
      fillColor: getZoneFillColor(getPressureLabel(zones.edge.pressure)),
      strokeColor: getZoneStrokeColor(zones.edge),
      pressure: zones.edge.pressure,
      pressureLabel: getPressureLabel(zones.edge.pressure),
      isCurrentZone: zones.edge.isCurrentZone,
      isRecommendedZone: zones.edge.isRecommendedZone,
    },
  ];
}

export function buildPitScene(controller: RuntimeController) {
  return class PitScene extends Phaser.Scene {
    private player!: Phaser.GameObjects.Arc;
    private selectedZone: PlayerZone = 'center';
    private controls!: Record<keyof PitControlState, Phaser.Input.Keyboard.Key>;
    private zoneGraphics!: Phaser.GameObjects.Graphics;
    private zoneTexts: Phaser.GameObjects.Text[] = [];
    private sectionText!: Phaser.GameObjects.Text;
    private dangerText!: Phaser.GameObjects.Text;
    private missionText!: Phaser.GameObjects.Text;
    private actionText!: Phaser.GameObjects.Text;
    private conditionText!: Phaser.GameObjects.Text;

    create() {
      this.add.rectangle(640, 360, 1_060, 600, 0x120d0b, 0.94);
      this.add.rectangle(640, 360, 990, 540, 0x33130f, 0.18);
      this.add.rectangle(640, 164, 1_060, 116, 0x090707, 0.95);
      this.add.rectangle(640, 340, 960, 4, 0xf2d39a, 0.4);

      this.zoneGraphics = this.add.graphics();
      this.add.rectangle(170, 118, 360, 210, 0x090707, 0.9).setOrigin(0, 0);
      this.add.text(188, 132, 'Venue readout', {
        fontFamily: 'Segoe UI, sans-serif',
        fontSize: '18px',
        color: '#f2d39a',
      });
      this.sectionText = this.add.text(188, 164, '', {
        fontFamily: 'Segoe UI, sans-serif',
        fontSize: '28px',
        color: '#f5f1e8',
      });
      this.dangerText = this.add.text(188, 204, '', {
        fontFamily: 'Segoe UI, sans-serif',
        fontSize: '18px',
        color: '#ffb18f',
      });
      this.missionText = this.add.text(188, 232, '', {
        fontFamily: 'Segoe UI, sans-serif',
        fontSize: '16px',
        color: '#f5f1e8',
      });
      this.actionText = this.add.text(188, 258, '', {
        fontFamily: 'Segoe UI, sans-serif',
        fontSize: '15px',
        color: '#d7cab7',
        wordWrap: { width: 320 },
      });
      this.conditionText = this.add.text(188, 294, '', {
        fontFamily: 'Segoe UI, sans-serif',
        fontSize: '14px',
        color: '#caa78d',
      });

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
      const feedback = snapshot.feedback;
      const visuals = buildPitZoneVisuals(feedback);

      this.zoneGraphics.clear();
      visuals.forEach((visual) => {
        const outline = visual.isCurrentZone && visual.isRecommendedZone ? 5 : visual.isRecommendedZone ? 4 : 3;
        const alpha = visual.isCurrentZone ? 0.95 : visual.isRecommendedZone ? 0.9 : 0.78;

        this.zoneGraphics.fillStyle(visual.fillColor, alpha);
        this.zoneGraphics.lineStyle(outline, visual.strokeColor, 1);
        this.zoneGraphics.fillRoundedRect(
          visual.x - visual.width / 2,
          visual.y - visual.height / 2,
          visual.width,
          visual.height,
          16,
        );
        this.zoneGraphics.strokeRoundedRect(
          visual.x - visual.width / 2,
          visual.y - visual.height / 2,
          visual.width,
          visual.height,
          16,
        );
      });

      if (this.zoneTexts.length !== visuals.length) {
        this.zoneTexts.forEach((text) => text.destroy());
        this.zoneTexts = visuals.map(() =>
          this.add.text(0, 0, '', {
            fontFamily: 'Segoe UI, sans-serif',
            fontSize: '14px',
            color: '#f5f1e8',
            align: 'center',
          }),
        );
      }

      visuals.forEach((visual, index) => {
        const lines = [
          visual.label,
          `${visual.caption} - ${visual.pressureLabel}`,
          `${visual.pressure}% pressure`,
          visual.isCurrentZone ? 'TARGET' : visual.isRecommendedZone ? 'RECOMMENDED' : visual.tag,
        ];
        const text = this.zoneTexts[index];
        text.setText(lines.join('\n'));
        text.setPosition(visual.x - visual.width / 2 + 14, visual.y - visual.height / 2 + 12);
        text.setColor(visual.isCurrentZone ? '#fff1d0' : visual.isRecommendedZone ? '#ffd59a' : '#f5f1e8');
        text.setFontSize(visual.id === 'center' ? '16px' : '14px');
      });

      this.sectionText.setText(feedback.section.label);
      this.dangerText.setText(`${feedback.danger.label} danger`);
      this.missionText.setText(feedback.mission.label);
      this.actionText.setText(feedback.action.label);
      this.conditionText.setText(
        `${feedback.player.condition} - Stamina ${Math.round(feedback.player.stamina)} - Balance ${Math.round(feedback.player.balance)} - Respect ${Math.round(feedback.player.respect)}`,
      );

      const zoneX =
        snapshot.player.zone === 'side'
          ? 250
          : snapshot.player.zone === 'front'
            ? 640
            : 640;
      const zoneY =
        snapshot.player.status === 'down'
          ? 704
          : snapshot.player.zone === 'front'
            ? 294
            : snapshot.player.zone === 'center'
              ? 478
              : snapshot.player.zone === 'edge'
                ? 662
                : 534;

      this.player.x = zoneX;
      this.player.y = zoneY;
      this.player.setFillStyle(snapshot.failed ? 0x7b5b4a : 0xf2d39a);
    }
  };
}
