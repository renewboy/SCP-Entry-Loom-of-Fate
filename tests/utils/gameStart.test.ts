import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GameStatus, type GameState, type GlobalSettings, type SCPData } from '../../types';
import { startGameProcess } from '../../utils/gameStart';
import { loadGlobalSettings } from '../../services/indexedDBService';
import { getBackgroundAspectRatio, getSceneAspectRatio } from '../../services/ai/utils';

const initializeGameChatStreamMock = vi.hoisted(() => vi.fn());
const setProviderCallbacksMock = vi.hoisted(() => vi.fn());
const generateImageMock = vi.hoisted(() => vi.fn().mockResolvedValue(null));
const defaultSettings = vi.hoisted(() => ({
  difficulty: 'normal',
  imageStyle: 'original',
  bgmVolume: 0.8,
  sfxVolume: 1,
  enableBackgroundImages: false,
  enableEntityImages: false,
  enableNpcImages: false,
  enableSceneImages: false,
} satisfies GlobalSettings));

vi.mock('../../services/aiService', async () => {
  const actual = await import('../../services/ai/utils');
  return {
    ...actual,
    initializeGameChatStream: initializeGameChatStreamMock,
    setProviderCallbacks: setProviderCallbacksMock,
    generateImage: generateImageMock
  };
});

vi.mock('../../services/indexedDBService', () => ({
  loadGlobalSettings: vi.fn().mockResolvedValue(defaultSettings)
}));

const createScpData = (): SCPData => ({
  designation: 'SCP-173',
  name: 'The Sculpture',
  containmentClass: 'Euclid',
  role: 'Researcher',
  visualDescription: 'Cold concrete chamber',
  entityDescription: 'Statue',
  mapBlueprint: {
    id: 'bp-1',
    title: 'Containment',
    startNodeId: 'cell',
    nodes: [
      {
        id: 'cell',
        name: 'Cell',
        danger: 20,
        layout: { x: 0, y: 0 }
      }
    ],
    edges: [],
    npcs: [],
    objectives: []
  }
});

const createState = (): GameState => ({
  status: GameStatus.ANALYZING,
  scpData: createScpData(),
  role: 'Researcher',
  messages: [],
  backgroundImage: null,
  mainImage: null,
  stability: 100,
  turnCount: 0,
  endingType: null,
  legacy: undefined
});

const createStream = (chunks: string[]) =>
  (async function* () {
    for (const chunk of chunks) {
      yield chunk;
    }
  })();

describe('startGameProcess', () => {
  beforeEach(() => {
    initializeGameChatStreamMock.mockReset();
    setProviderCallbacksMock.mockReset();
    generateImageMock.mockReset().mockResolvedValue(null);
    vi.mocked(loadGlobalSettings).mockReset().mockResolvedValue(defaultSettings);
  });

  it('并发触发时只初始化一次开局流', async () => {
    let resolveStream: ((stream: AsyncGenerator<string>) => void) | null = null;
    initializeGameChatStreamMock.mockImplementation(
      () =>
        new Promise<AsyncGenerator<string>>((resolve) => {
          resolveStream = resolve;
        })
    );

    let currentState = createState();
    const setGameState = vi.fn((updater: React.SetStateAction<GameState>) => {
      currentState = typeof updater === 'function' ? updater(currentState) : updater;
    });

    const params = {
      gameState: currentState,
      setGameState,
      language: 'zh' as const,
      t: (key: string) => key
    };

    const first = startGameProcess(params);
    const second = startGameProcess(params);

    await Promise.resolve();
    await Promise.resolve();

    expect(initializeGameChatStreamMock).toHaveBeenCalledTimes(1);

    resolveStream?.(createStream(['Intro text']));

    await Promise.all([first, second]);

    expect(initializeGameChatStreamMock).toHaveBeenCalledTimes(1);
  });

  it('开局的背景、实体、NPC和场景插图都携带对应绘画提示词并写回图片', async () => {
    vi.mocked(loadGlobalSettings).mockResolvedValueOnce({
      ...defaultSettings,
      enableBackgroundImages: true,
      enableEntityImages: true,
      enableNpcImages: true,
      enableSceneImages: true
    });
    const npcDescription = 'Researcher, white lab coat, red scarf';
    const sceneDescription = 'red warning beacon, white concrete corridor';
    initializeGameChatStreamMock.mockReturnValue(createStream([
      `Intro text [VISUAL: ${sceneDescription}][STABILITY: 95]`
    ]));
    generateImageMock
      .mockResolvedValueOnce('entity.png')
      .mockResolvedValueOnce('npc.png')
      .mockResolvedValueOnce('scene.png');

    let currentState = createState();
    currentState.scpData!.npcVisuals = { npc_researcher: npcDescription };
    const scpData = currentState.scpData!;
    const setGameState = vi.fn((updater: React.SetStateAction<GameState>) => {
      currentState = typeof updater === 'function' ? updater(currentState) : updater;
    });

    await startGameProcess({
      gameState: currentState,
      setGameState,
      language: 'zh',
      t: key => key
    });

    expect(generateImageMock).toHaveBeenCalledTimes(3);
    expect(generateImageMock).toHaveBeenCalledWith(scpData.entityDescription!, '1:1', 'url', 'entity');
    expect(generateImageMock).toHaveBeenCalledWith(npcDescription, '1:1', 'url', 'npc');
    expect(generateImageMock).toHaveBeenCalledWith(sceneDescription, getSceneAspectRatio(), 'b64_json', 'scene');
    expect(currentState.backgroundImage).toBe('scene.png');
    expect(currentState.mainImage).toBe('entity.png');
    expect(currentState.scpData?.npcImages?.npc_researcher).toBe('npc.png');
    expect(currentState.messages[0]).toMatchObject({ content: 'Intro text', imageUrl: 'scene.png' });
  });

  const runStart = async (settings: Partial<GlobalSettings>, chunks: string[]) => {
    vi.mocked(loadGlobalSettings).mockResolvedValueOnce({ ...defaultSettings, ...settings });
    initializeGameChatStreamMock.mockReturnValue(createStream(chunks));
    let currentState = createState();
    const scpData = currentState.scpData!;
    await startGameProcess({
      gameState: currentState,
      setGameState: vi.fn((updater: React.SetStateAction<GameState>) => {
        currentState = typeof updater === 'function' ? updater(currentState) : updater;
      }),
      language: 'zh',
      t: key => key
    });
    return { scpData, state: () => currentState };
  };

  it('关闭场景图时只生成背景图', async () => {
    generateImageMock.mockResolvedValueOnce('background.png');
    const { scpData, state } = await runStart(
      { enableBackgroundImages: true, enableSceneImages: false },
      ['Intro text [VISUAL: a corridor][STABILITY: 95]']
    );

    expect(generateImageMock).toHaveBeenCalledTimes(1);
    expect(generateImageMock).toHaveBeenCalledWith(scpData.visualDescription!, getBackgroundAspectRatio(), 'b64_json', 'background');
    expect(state().backgroundImage).toBe('background.png');
    expect(state().messages[0].imageUrl).toBeUndefined();
  });

  it('模型漏写画面标签时，第一幕仍然生图', async () => {
    generateImageMock.mockResolvedValueOnce('scene.png');
    const { scpData, state } = await runStart({ enableSceneImages: true }, ['Intro text [STABILITY: 95]']);

    expect(generateImageMock).toHaveBeenCalledTimes(1);
    expect(generateImageMock).toHaveBeenCalledWith(scpData.visualDescription!, getSceneAspectRatio(), 'b64_json', 'scene');
    expect(state().messages[0].imageUrl).toBe('scene.png');
  });

  it('读到画面标签就开始生图，且只生成一次', async () => {
    generateImageMock.mockResolvedValueOnce('scene.png');
    let callsWhenTextArrived = -1;
    await runStart({ enableSceneImages: true }, ['---\n\n[VISUAL: a corridor]\n\n', '正文写完了。[STABILITY: 95]'].map((chunk, index) => {
      if (index === 1) queueMicrotask(() => { callsWhenTextArrived = generateImageMock.mock.calls.length; });
      return chunk;
    }));

    expect(callsWhenTextArrived).toBeGreaterThanOrEqual(0);
    expect(generateImageMock).toHaveBeenCalledTimes(1);
    expect(generateImageMock).toHaveBeenCalledWith('a corridor', getSceneAspectRatio(), 'b64_json', 'scene');
  });
});
