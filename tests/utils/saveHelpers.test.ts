import { describe, it, expect } from 'vitest';
import { compressGameState, decompressGameState } from '../../utils/saveHelpers';
import { EndingType, GameStatus, type GameState } from '../../types';

const createState = (): GameState => ({
  status: GameStatus.PLAYING,
  scpData: null,
  role: 'Researcher',
  messages: [],
  backgroundImage: null,
  mainImage: null,
  stability: 80,
  turnCount: 3,
  endingType: EndingType.UNKNOWN,
  inventory: [{ id: 'token_1', name: 'token_1' }],
  objectives: [],
  npcs: []
});

describe('saveHelpers', () => {
  it('压缩后可完整解压还原', () => {
    const state = createState();
    const compressed = compressGameState(state);
    const restored = decompressGameState(compressed);
    expect(restored).toEqual(state);
  });

  it('兼容未压缩存档', () => {
    const state = createState();
    const restored = decompressGameState(state);
    expect(restored).toEqual(state);
  });

  it('损坏数据会抛出异常', () => {
    const corrupted = { compressed: true, data: 'not-valid-base64' };
    expect(() => decompressGameState(corrupted)).toThrowError('Corrupted save data');
  });
});
