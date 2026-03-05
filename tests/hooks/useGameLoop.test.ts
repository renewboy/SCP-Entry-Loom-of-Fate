import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { useGameLoop } from '../../hooks/useGameLoop';
import { GameStatus, type GameState } from '../../types';
import type { MapUpdate } from '../../hooks/useMapUpdate';

const sendActionMock = vi.hoisted(() => vi.fn());
const setMapContextProviderMock = vi.hoisted(() => vi.fn());
const setProviderCallbacksMock = vi.hoisted(() => vi.fn());

vi.mock('../../services/aiService', async () => {
  const utils = await import('../../services/ai/utils');
  return {
    ...utils,
    sendAction: sendActionMock,
    setMapContextProvider: setMapContextProviderMock,
    setProviderCallbacks: setProviderCallbacksMock,
    generateImage: vi.fn()
  };
});

vi.mock('../../services/indexedDBService', () => ({
  loadGlobalSettings: vi.fn().mockResolvedValue({ enableSceneImages: false })
}));

const createState = (): GameState => ({
  status: GameStatus.PLAYING,
  scpData: null,
  role: 'Researcher',
  messages: [],
  backgroundImage: null,
  mainImage: null,
  stability: 70,
  turnCount: 0,
  endingType: null,
  map: {
    id: 'map1',
    title: 'Map',
    currentNodeId: 'node_a',
    discoveredNodeIds: ['node_a']
  },
  inventory: [],
  objectives: [],
  npcs: []
});

const createStream = (chunks: string[]) => {
  return (async function* () {
    for (const chunk of chunks) {
      yield chunk;
    }
  })();
};

describe('useGameLoop', () => {
  beforeEach(() => {
    sendActionMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('处理标签解析并更新地图与消息', async () => {
    const response = 'Story [STABILITY: 88][LOC: node_b][MAP_UPDATE: {"addAccessTokens":["k1"],"moveNPCs":[{"id":"npc1","nodeId":"node_b","alive":false}],"objectives":[{"id":"obj1","status":"COMPLETED","progress":100}]}]';
    sendActionMock.mockReturnValue(createStream([response]));

    const applyMapUpdate = vi.fn((prev: GameState, update: MapUpdate | null | undefined) => prev);
    const t = (key: string) => key;

    const { result } = renderHook(() => {
      const [gameState, setGameState] = useState<GameState>({
        ...createState(),
        npcs: [{ id: 'npc1', name: 'NPC', archetype: 'test', nodeId: 'node_a', alive: true }],
        objectives: [{
          id: 'obj1',
          title: 'Goal',
          type: 'MAIN',
          nodeId: 'node_b',
          status: 'ACTIVE',
          progress: 0
        }]
      });
      const [input, setInput] = useState('');
      const [memoryEchoActive, setMemoryEchoActive] = useState(false);
      const api = useGameLoop({
        gameState,
        setGameState,
        language: 'en',
        t,
        setInput,
        setMemoryEchoActive,
        buildMapContext: () => 'map',
        applyMapUpdate
      });
      return { api, state: { gameState, input, memoryEchoActive } };
    });

    await act(async () => {
      await result.current.api.handleSend('go');
    });

    await waitFor(() => {
      const { gameState } = result.current.state;
      expect(gameState.stability).toBe(88);
      expect(gameState.map?.currentNodeId).toBe('node_b');
      expect(gameState.map?.discoveredNodeIds).toContain('node_b');
      const lastMessage = gameState.messages.at(-1);
      expect(lastMessage?.content).toBe('Story');
      expect(lastMessage?.isTyping).toBe(false);
    });

    expect(applyMapUpdate).toHaveBeenCalled();
    const updateArg = applyMapUpdate.mock.calls[0]?.[1];
    expect(updateArg).toEqual({
      addAccessTokens: ['k1'],
      moveNPCs: [{ id: 'npc1', nodeId: 'node_b', alive: false }],
      objectives: [{ id: 'obj1', status: 'COMPLETED', progress: 100 }]
    });
  });

  it('超时后回填输入并设置错误消息', async () => {
    sendActionMock.mockReturnValue((async function* () {
      await new Promise(() => {});
    })());
    vi.useFakeTimers();

    const t = (key: string) => {
      if (key === 'game.err_timeout') return 'TIMEOUT_TEXT';
      if (key === 'game.err_offline') return 'OFFLINE_TEXT';
      return key;
    };

    const { result } = renderHook(() => {
      const [gameState, setGameState] = useState(createState());
      const [input, setInput] = useState('');
      const [memoryEchoActive, setMemoryEchoActive] = useState(false);
      const api = useGameLoop({
        gameState,
        setGameState,
        language: 'en',
        t,
        setInput,
        setMemoryEchoActive,
        buildMapContext: () => 'map',
        applyMapUpdate: (prev) => prev
      });
      return { api, state: { gameState, input, memoryEchoActive } };
    });

    await act(async () => {
      const promise = result.current.api.handleSend('wait');
      await vi.advanceTimersByTimeAsync(30000);
      await promise;
    });

    const { gameState, input } = result.current.state;
    const lastMessage = gameState.messages.at(-1);
    expect(lastMessage?.content).toBe('TIMEOUT_TEXT');
    expect(input).toBe('wait');
    expect(result.current.api.isProcessing).toBe(false);
  });
});
