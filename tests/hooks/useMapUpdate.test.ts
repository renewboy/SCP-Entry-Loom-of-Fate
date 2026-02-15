import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useMapUpdate } from '../../hooks/useMapUpdate';
import { EndingType, GameStatus, type GameState, type ObjectiveState, type RuntimeNPCState } from '../../types';

const createState = (): GameState => ({
  status: GameStatus.PLAYING,
  scpData: null,
  role: 'Researcher',
  messages: [],
  backgroundImage: null,
  mainImage: null,
  stability: 60,
  turnCount: 1,
  endingType: null,
  inventory: [],
  npcs: [],
  objectives: []
});

describe('useMapUpdate', () => {
  it('去重添加accessTokens', () => {
    const { result } = renderHook(() => useMapUpdate());
    const base = createState();
    base.inventory = [{ id: 'key1', name: 'key1' }];

    const next = result.current(base, { addAccessTokens: ['key1', 'key1'] });
    expect(next.inventory?.length).toBe(1);
    expect(next.inventory?.[0].id).toBe('key1');
  });

  it('更新NPC位置与存活状态，忽略未知NPC', () => {
    const { result } = renderHook(() => useMapUpdate());
    const base = createState();
    const npcs: RuntimeNPCState[] = [{ id: 'npc1', name: 'A', archetype: 'x', nodeId: 'n1', alive: true }];
    base.npcs = npcs;

    const next = result.current(base, {
      moveNPCs: [
        { id: 'npc1', nodeId: 'n2', alive: false },
        { id: 'npc2', nodeId: 'n3' }
      ]
    });

    expect(next.npcs?.length).toBe(1);
    expect(next.npcs?.[0].nodeId).toBe('n2');
    expect(next.npcs?.[0].alive).toBe(false);
  });

  it('目标完成时只触发一次奖励并限制稳定性上限', () => {
    const { result } = renderHook(() => useMapUpdate());
    const base = createState();
    const objectives: ObjectiveState[] = [{
      id: 'obj1',
      title: 'Main',
      type: 'MAIN',
      nodeId: 'n1',
      status: 'ACTIVE',
      progress: 0,
      reward: { accessTokens: ['reward1'], stabilityDelta: 50 }
    }];
    base.objectives = objectives;

    const first = result.current(base, { objectives: [{ id: 'obj1', status: 'COMPLETED' }] });
    expect(first.stability).toBe(100);
    expect(first.inventory?.some(i => i.id === 'reward1')).toBe(true);

    const second = result.current(first, { objectives: [{ id: 'obj1', status: 'COMPLETED' }] });
    const rewardCount = second.inventory?.filter(i => i.id === 'reward1').length ?? 0;
    expect(rewardCount).toBe(1);
    expect(second.stability).toBe(100);
  });

  it('非法更新保持状态不变', () => {
    const { result } = renderHook(() => useMapUpdate());
    const base = createState();
    const next = result.current(base, null);
    expect(next).toBe(base);
  });

  it('进度更新保留现有状态与数值', () => {
    const { result } = renderHook(() => useMapUpdate());
    const base = createState();
    base.objectives = [{
      id: 'obj2',
      title: 'Side',
      type: 'SIDE',
      nodeId: 'n1',
      status: 'ACTIVE',
      progress: 10
    }];

    const next = result.current(base, { objectives: [{ id: 'obj2', progress: 40 }] });
    expect(next.objectives?.[0].status).toBe('ACTIVE');
    expect(next.objectives?.[0].progress).toBe(40);
  });

  it('稳定性下限为0并忽略非法字段类型', () => {
    const { result } = renderHook(() => useMapUpdate());
    const base = createState();
    base.stability = 10;
    base.objectives = [{
      id: 'obj3',
      title: 'Main',
      type: 'MAIN',
      nodeId: 'n1',
      status: 'ACTIVE',
      progress: 0,
      reward: { stabilityDelta: -50 }
    }];
    base.npcs = [{ id: 'npc1', name: 'A', archetype: 'x', nodeId: 'n1', alive: true }];

    const next = result.current(base, {
      objectives: [{ id: 'obj3', status: 'COMPLETED' }],
      moveNPCs: [{ id: 'npc1', nodeId: 123 as unknown as string, alive: 'no' as unknown as boolean }],
      addAccessTokens: 'bad' as unknown as string[]
    });

    expect(next.stability).toBe(0);
    expect(next.npcs?.[0].nodeId).toBe('n1');
    expect(next.npcs?.[0].alive).toBe(true);
    expect(next.inventory?.length).toBe(0);
  });
});
