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

vi.mock('./vertical-slice-presentation', async () => {
  const actual =
    await vi.importActual<typeof import('./vertical-slice-presentation')>('./vertical-slice-presentation');

  return {
    ...actual,
    createSliceRenderState: vi.fn(actual.createSliceRenderState),
  };
});

import { minorityThreatVerticalSlice } from '../fixtures/minority-threat-vertical-slice';
import { createVerticalSliceController } from './vertical-slice-controller';
import {
  buildVerticalSliceScene,
  stepSceneController,
  resolveSliceInput,
} from './vertical-slice-scene';
import * as presentationModule from './vertical-slice-presentation';
import {
  createSliceRenderState,
  resolvePlayerPoseStyle,
  resolveSliceLightPalette,
} from './vertical-slice-presentation';

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

  it('keeps presentation helpers in the derived render-state layer', () => {
    const session = createVerticalSliceController(minorityThreatVerticalSlice).getSnapshot();
    session.elapsedMs = 9_000;
    const renderState = createSliceRenderState(session);

    expect(renderState.crowd.center.length).toBeGreaterThan(renderState.crowd.edge.length);
    expect(resolveSliceLightPalette('hit')).toMatchObject({
      venueFill: 0x24110f,
      crowdAlpha: 0.98,
    });
    expect(resolvePlayerPoseStyle('brace')).toMatchObject({
      fillColor: 0xf6d59c,
      scaleY: 0.82,
    });
  });

  it('keeps side-lane bodies out of the center corridor', () => {
    const session = createVerticalSliceController(minorityThreatVerticalSlice).getSnapshot();
    session.elapsedMs = 9_000;
    const sideBodies = createSliceRenderState(session).crowd.side;

    expect(sideBodies.length).toBeGreaterThan(0);
    expect(sideBodies.every((body) => body.x <= 430 || body.x >= 850)).toBe(true);
  });

  it('detects punch cues even when the scene advances through a large hitch', () => {
    const controller = createVerticalSliceController(minorityThreatVerticalSlice);
    controller.start();
    controller.step({ action: 'brace', targetZone: 'edge' }, 8_700);
    const expectedPunchKey = 'event:breakdown-hit:10250';

    const result = stepSceneController(
      controller,
      { action: 'brace', targetZone: 'center' },
      1_800,
    );

    expect(result.punchDetected).toBe(true);
    expect(result.punchWindowKey).toBe(expectedPunchKey);
    expect(result.snapshot.elapsedMs).toBe(10_500);
    expect(result.snapshot.frame.cameraCue).toBe('impact');
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

  it('anchors the player in the shoulder frame and applies pressure zoom while rendering', () => {
    const controller = createVerticalSliceController(minorityThreatVerticalSlice);
    const Scene = buildVerticalSliceScene(controller);
    const scene = new Scene() as any;
    const makeText = () => ({
      setText: vi.fn(),
      setColor: vi.fn(() => undefined),
    });
    const textObjects = Array.from({ length: 6 }, () => makeText());
    const makeRectangle = () => {
      const rectangle = {
        setOrigin: vi.fn(() => rectangle),
        setFillStyle: vi.fn(() => rectangle),
        setPosition: vi.fn(() => rectangle),
        setScale: vi.fn(() => rectangle),
        setAngle: vi.fn(() => rectangle),
      };

      return rectangle;
    };
    const backdropRectangle = makeRectangle();
    const marqueeRectangle = makeRectangle();
    const bandRectangle = makeRectangle();
    const barrierRectangle = makeRectangle();
    const pitRectangle = makeRectangle();
    const edgeRectangle = makeRectangle();
    const panelRectangle = makeRectangle();
    const playerRectangle = makeRectangle();
    const graphics = {
      clear: vi.fn(),
      fillStyle: vi.fn(),
      fillRoundedRect: vi.fn(),
    };

    scene.add = {
      rectangle: vi
        .fn()
        .mockReturnValueOnce(backdropRectangle)
        .mockReturnValueOnce(marqueeRectangle)
        .mockReturnValueOnce(bandRectangle)
        .mockReturnValueOnce(barrierRectangle)
        .mockReturnValueOnce(pitRectangle)
        .mockReturnValueOnce(edgeRectangle)
        .mockReturnValueOnce(panelRectangle)
        .mockReturnValueOnce(playerRectangle),
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

    controller.start();
    controller.step({ action: 'move', targetZone: 'center' }, 9_000);
    scene.create();

    expect(playerRectangle.setPosition).toHaveBeenCalledWith(620, 520);
    expect(playerRectangle.setScale).toHaveBeenCalledWith(1.02, 0.88);
    expect(playerRectangle.setAngle).toHaveBeenCalledWith(14);
    expect(scene.cameras.main.setZoom).toHaveBeenCalledWith(1.02);
  });

  it('uses the presentation camera mode as the impact authority', () => {
    const controller = createVerticalSliceController(minorityThreatVerticalSlice);
    const Scene = buildVerticalSliceScene(controller);
    const scene = new Scene() as any;
    const createSliceRenderStateMock = vi.mocked(presentationModule.createSliceRenderState);
    const makeText = () => ({
      setText: vi.fn(),
      setColor: vi.fn(() => undefined),
    });
    const textObjects = Array.from({ length: 6 }, () => makeText());
    const makeRectangle = () => {
      const rectangle = {
        setOrigin: vi.fn(() => rectangle),
        setFillStyle: vi.fn(() => rectangle),
        setPosition: vi.fn(() => rectangle),
        setScale: vi.fn(() => rectangle),
        setAngle: vi.fn(() => rectangle),
      };

      return rectangle;
    };
    const graphics = {
      clear: vi.fn(),
      fillStyle: vi.fn(),
      fillRoundedRect: vi.fn(),
    };

    scene.add = {
      rectangle: vi
        .fn()
        .mockReturnValueOnce(makeRectangle())
        .mockReturnValueOnce(makeRectangle())
        .mockReturnValueOnce(makeRectangle())
        .mockReturnValueOnce(makeRectangle())
        .mockReturnValueOnce(makeRectangle())
        .mockReturnValueOnce(makeRectangle())
        .mockReturnValueOnce(makeRectangle())
        .mockReturnValueOnce(makeRectangle()),
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

    createSliceRenderStateMock.mockImplementation(() => ({
      camera: {
        mode: 'impact',
        zoom: 1.08,
        playerScreenX: 620,
        playerScreenY: 470,
      },
      venue: {
        stage: { x: 640, y: 146 },
        front: { x: 640, y: 286 },
        center: { x: 640, y: 452 },
        edge: { x: 640, y: 628 },
        lightCue: 'room',
        palette: resolveSliceLightPalette('room'),
      },
      player: {
        animation: 'move',
        poseStyle: resolvePlayerPoseStyle('move'),
        x: 620,
        y: 470,
      },
      crowd: {
        front: [],
        center: [],
        side: [],
        edge: [],
      },
    }));

    scene.create();
    scene.renderSnapshot(controller.getSnapshot(), true, null);

    expect(scene.cameras.main.shake).toHaveBeenCalledWith(110, 0.0045);
    createSliceRenderStateMock.mockReset();
    createSliceRenderStateMock.mockImplementation(createSliceRenderState);
  });
});
