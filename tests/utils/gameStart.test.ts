import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GameStatus, type GameState, type SCPData } from '../../types';
import { startGameProcess } from '../../utils/gameStart';

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
    generateImageMock.mockClear();
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
});
