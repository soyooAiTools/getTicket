import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    AUTO: 'AUTO',
    Scene: class {},
    Scenes: {
      Events: {
        SHUTDOWN: 'shutdown',
        DESTROY: 'destroy',
      },
    },
    Input: {
      Keyboard: {
        KeyCodes: {
          A: 65,
          S: 83,
          D: 68,
          F: 70,
          UP: 38,
          DOWN: 40,
          LEFT: 37,
          RIGHT: 39,
        },
      },
    },
  },
}));

import { createVerticalSliceFrame } from '../domain/vertical-slice-director';
import { minorityThreatVerticalSlice } from '../fixtures/minority-threat-vertical-slice';
import { createVerticalSliceController } from './vertical-slice-controller';
import {
  buildCrowdBodyLayout,
  buildVerticalSliceScene,
  resolveSliceLightPalette,
  stepSceneController,
  resolvePlayerPoseStyle,
  resolveSliceInput,
} from './vertical-slice-scene';

describe('vertical slice scene helpers', () => {
  it('resolves held controls into one action and one zone', () => {
    expect(
      resolveSliceInput(
        {
          move: false,
          shove: false,
          brace: true,
          slip: false,
          front: false,
          center: true,
          edge: false,
          side: false,
        },
        'edge',
      ),
    ).toEqual({
      action: 'brace',
      targetZone: 'center',
    });
  });

  it('builds a denser center crowd layout for the breakdown-hit peak', () => {
    const visuals = buildCrowdBodyLayout(createVerticalSliceFrame(minorityThreatVerticalSlice, 9_000));
    const centerBodies = visuals.filter((body) => body.zone === 'center');
    const edgeBodies = visuals.filter((body) => body.zone === 'edge');

    expect(visuals.length).toBeGreaterThanOrEqual(18);
    expect(centerBodies.length).toBeGreaterThan(edgeBodies.length);
  });

  it('keeps side-lane bodies out of the center corridor', () => {
    const visuals = buildCrowdBodyLayout(createVerticalSliceFrame(minorityThreatVerticalSlice, 9_000));
    const sideBodies = visuals.filter((body) => body.zone === 'side');

    expect(sideBodies.length).toBeGreaterThan(0);
    expect(sideBodies.every((body) => body.x <= 430 || body.x >= 850)).toBe(true);
  });

  it('maps the brace pose to the authored body style', () => {
    expect(
      resolvePlayerPoseStyle({
        pose: 'brace',
        status: 'upright',
      }),
    ).toMatchObject({
      fillColor: 0xf6d59c,
      scaleY: 0.82,
    });
  });

  it('maps the down state to the collapsed body style', () => {
    expect(
      resolvePlayerPoseStyle({
        pose: 'fall',
        status: 'down',
      }),
    ).toEqual({
      fillColor: 0x7f5a49,
      scaleX: 1.18,
      scaleY: 0.48,
      angle: 88,
    });
  });

  it('resolves a visible palette from the authored light cue', () => {
    expect(resolveSliceLightPalette('hit')).toMatchObject({
      venueFill: 0x24110f,
      bandFill: 0x513128,
      crowdAlpha: 0.98,
      accentText: '#ffe3b0',
    });
  });

  it('detects punch cues even when the scene advances through a large hitch', () => {
    const controller = createVerticalSliceController(minorityThreatVerticalSlice);
    controller.start();
    controller.step({ action: 'brace', targetZone: 'edge' }, 8_700);
    const expectedPunchKey = 'event:breakdown-hit:9000';

    const result = stepSceneController(
      controller,
      { action: 'brace', targetZone: 'center' },
      800,
    );

    expect(result.punchDetected).toBe(true);
    expect(result.punchWindowKey).toBe(expectedPunchKey);
    expect(result.snapshot.elapsedMs).toBe(9_500);
    expect(result.snapshot.frame.cameraCue).toBe('steady');
  });

  it('repaints the final snapshot when the controller completes outside the update loop', () => {
    const baseController = createVerticalSliceController(minorityThreatVerticalSlice);
    const initialSnapshot = baseController.getSnapshot();
    const completedSnapshot = {
      ...initialSnapshot,
      completed: true,
      summary: {
        label: 'Survived' as const,
        downCount: 0,
        hitWindows: 0,
      },
    };

    let running = false;
    let listener: ((session: typeof initialSnapshot) => void) | null = null;
    let snapshot = initialSnapshot;

    const controller = {
      subscribe(nextListener: typeof listener) {
        listener = nextListener;
        return () => {
          listener = null;
        };
      },
      getSnapshot() {
        return snapshot;
      },
      isRunning() {
        return running;
      },
      start() {
        running = true;
        listener?.(snapshot);
      },
      pause() {
        running = false;
        listener?.(snapshot);
      },
      complete() {
        running = false;
        snapshot = completedSnapshot;
        listener?.(snapshot);
      },
      step() {
        return undefined;
      },
      reset() {
        running = false;
        snapshot = initialSnapshot;
        listener?.(snapshot);
      },
    };

    const Scene = buildVerticalSliceScene(controller);
    const scene = new Scene() as any;
    const makeText = () => ({
      setText: vi.fn(),
      setColor: vi.fn(() => undefined),
    });
    const textObjects = [makeText(), makeText(), makeText(), makeText(), makeText(), makeText()];
    const rectangle = {
      setOrigin: vi.fn(() => rectangle),
      setFillStyle: vi.fn(() => rectangle),
      setPosition: vi.fn(() => rectangle),
      setScale: vi.fn(() => rectangle),
      setAngle: vi.fn(() => rectangle),
    };
    const graphics = {
      clear: vi.fn(),
      fillStyle: vi.fn(),
      fillRoundedRect: vi.fn(),
    };

    scene.add = {
      rectangle: vi.fn(() => rectangle),
      text: vi.fn(() => textObjects.shift()),
      graphics: vi.fn(() => graphics),
    };
    scene.input = {
      keyboard: {
        addKey: vi.fn(() => ({ isDown: false })),
      },
    };
    scene.events = {
      once: vi.fn(),
    };
    scene.cameras = {
      main: {
        shake: vi.fn(),
        zoomTo: vi.fn(),
        setZoom: vi.fn(),
      },
    };
    scene.crowdGraphics = graphics;
    scene.player = rectangle;
    scene.venueBackdrop = rectangle;
    scene.bandArea = rectangle;
    scene.barrierLine = rectangle;
    scene.pitFloor = rectangle;
    scene.edgeLane = rectangle;
    scene.readoutPanel = rectangle;
    scene.venueReadoutLabel = textObjects[0];
    scene.bandLabel = textObjects[1];
    scene.barrierLabel = textObjects[2];
    scene.edgeLabel = textObjects[3];
    scene.phaseText = textObjects[4];
    scene.summaryText = textObjects[5];

    scene.create();

    controller.complete();

    expect(scene.summaryText.setText).toHaveBeenCalledWith('Survived | Hit Windows 0 | Downs 0');
  });
});
