import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GameStatus, type GameState, type SCPData } from '../../types';
import { startGameProcess } from '../../utils/gameStart';
import { loadGlobalSettings } from '../../services/indexedDBService';
import { getBackgroundAspectRatio, getSceneAspectRatio } from '../../services/ai/utils';

const initializeGameChatStreamMock = vi.hoisted(() => vi.fn());
const setProviderCallbacksMock = vi.hoisted(() => vi.fn());
const generateImageMock = vi.hoisted(() => vi.fn().mockResolvedValue(null));

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
  loadGlobalSettings: vi.fn().mockResolvedValue({
    difficulty: 'normal',
    enableBackgroundImages: false,
    enableEntityImages: false,
    enableNpcImages: false,
    enableSceneImages: false
  })
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
      difficulty: 'normal',
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
      .mockResolvedValueOnce('background.png')
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

    expect(generateImageMock).toHaveBeenCalledTimes(4);
    expect(generateImageMock).toHaveBeenCalledWith(scpData.visualDescription!, getBackgroundAspectRatio(), 'b64_json', 'background');
    expect(generateImageMock).toHaveBeenCalledWith(scpData.entityDescription!, '1:1', 'url', 'entity');
    expect(generateImageMock).toHaveBeenCalledWith(npcDescription, '1:1', 'url', 'npc');
    expect(generateImageMock).toHaveBeenCalledWith(sceneDescription, getSceneAspectRatio(), 'url', 'scene');
    expect(currentState.backgroundImage).toBe('background.png');
    expect(currentState.mainImage).toBe('entity.png');
    expect(currentState.scpData?.npcImages?.npc_researcher).toBe('npc.png');
    expect(currentState.messages[0]).toMatchObject({ content: 'Intro text', imageUrl: 'scene.png' });
  });
});
