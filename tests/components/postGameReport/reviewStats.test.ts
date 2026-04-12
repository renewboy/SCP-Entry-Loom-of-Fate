import { describe, expect, it } from 'vitest';
import type { Message } from '../../../types';
import { computeSessionStats } from '../../../components/postGameReport/selectors/reviewStats';

const messages: Message[] = [
  {
    id: 'n0',
    sender: 'narrator',
    content: 'Initial briefing.',
    timestamp: 1,
    turnIndex: 0,
  },
  {
    id: 'u1',
    sender: 'user',
    content: 'Advance carefully.',
    timestamp: 2,
    turnIndex: 1,
  },
  {
    id: 'n1',
    sender: 'narrator',
    content: 'The hallway bends around itself.',
    timestamp: 3,
    turnIndex: 1,
    imageUrl: 'scene-1.png',
  },
  {
    id: 'u2',
    sender: 'user',
    content: 'Deploy anchor.',
    timestamp: 4,
    turnIndex: 2,
  },
  {
    id: 'n2',
    sender: 'narrator',
    content: 'Reality stabilizes for a moment.',
    timestamp: 5,
    turnIndex: 2,
  },
];

describe('computeSessionStats', () => {
  it('计算稳定度、delta、阶段分布和参与度统计', () => {
    const stats = computeSessionStats(messages, [100, 82, 61, 28]);

    expect(stats.stability).toEqual([100, 82, 61, 28]);
    expect(stats.deltas).toEqual([-18, -21, -33]);
    expect(stats.largestDrop).toBe(-33);
    expect(stats.largestRecovery).toBe(-18);
    expect(stats.phase.stableCount).toBe(2);
    expect(stats.phase.fluctuatingCount).toBe(1);
    expect(stats.phase.criticalCount).toBe(1);
    expect(stats.engagement.turns).toBe(2);
    expect(stats.engagement.userMessages).toBe(2);
    expect(stats.engagement.narratorMessages).toBe(3);
    expect(stats.engagement.visualsCount).toBe(1);
  });

  it('在稳定度为空时回退到默认值并 clamp 越界输入', () => {
    const stats = computeSessionStats([], [130, -20, 50]);

    expect(stats.stability).toEqual([100, 0, 50]);
    expect(stats.stabilityMin).toBe(0);
    expect(stats.stabilityMax).toBe(100);
    expect(stats.deltas).toEqual([-100, 50]);
  });
});
