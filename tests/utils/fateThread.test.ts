import { describe, expect, it } from 'vitest';
import { threadNoise, threadStubPath, threadThroughRow, threadTrailPath } from '../../utils/fateThread';

describe('fateThread', () => {
  it('抖动幅度不超过 1', () => {
    for (let position = 0; position < 800; position += 7) {
      expect(Math.abs(threadNoise(position))).toBeLessThanOrEqual(1);
    }
  });

  it('竖线从第一个点出发，在最后一个点结束', () => {
    const d = threadTrailPath([{ x: 10, y: 0 }, { x: 10, y: 100 }]);
    expect(d.startsWith('M 10.0 0.0')).toBe(true);
    expect(d.endsWith('L 10.0 100.0')).toBe(true);
  });

  it('往上流的线也能走完', () => {
    const d = threadTrailPath([{ x: 0, y: 100 }, { x: 0, y: 0 }]);
    expect(d.startsWith('M 0.0 100.0')).toBe(true);
    expect(d.endsWith('L 0.0 0.0')).toBe(true);
  });

  it('少于两个点时没有线', () => {
    expect(threadTrailPath([])).toBe('');
    expect(threadTrailPath([{ x: 0, y: 0 }])).toBe('');
  });

  it('红线穿过一行：从来源到左针，直线到右针，再到芯柱', () => {
    const d = threadThroughRow({ x: 0, y: 0 }, { x: 100, y: 50 }, { x: 300, y: 50 }, { x: 500, y: 10 });
    expect(d).toContain('L 300.0 50.0');
    expect(d.endsWith('500.0 10.0')).toBe(true);
  });

  it('线头朝来源那一侧弯', () => {
    expect(threadStubPath({ x: 100, y: 50 }, 200).endsWith('58.0 62.0')).toBe(true);
    expect(threadStubPath({ x: 100, y: 50 }, 0).endsWith('58.0 38.0')).toBe(true);
  });
});
