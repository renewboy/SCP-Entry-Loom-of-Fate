import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useBeatPlayer } from '../../hooks/useBeatPlayer';
import { parseTurn } from '../../utils/beats';

const TEXT = `第一段。

第二段。

[@npc_a: 对白。]

1. 选项`;

interface PlayerProps {
  content: string;
  settled: boolean;
  hasEnding?: boolean;
  turnId?: string;
  paused?: boolean;
  autoAdvance?: boolean;
  replaying?: boolean;
  fromStart?: boolean;
}

const setup = (initial: PlayerProps) => {
  const holdUntilRef = { current: 0 };
  return renderHook(
    ({ content, settled, hasEnding = false, turnId = 't1', paused = false, autoAdvance = false, replaying = false, fromStart = false }: PlayerProps) => useBeatPlayer({
      turnId,
      turn: parseTurn(content, { id: turnId, streaming: !settled }),
      settled,
      hasEnding,
      paused,
      autoAdvance,
      holdUntilRef,
      replaying,
      fromStart
    }),
    { initialProps: initial }
  );
};

const tick = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

describe('useBeatPlayer', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('存档恢复的回合直接停在选择界面', () => {
    const { result } = setup({ content: TEXT, settled: true });
    expect(result.current.phase).toBe('choosing');
    expect(result.current.restored).toBe(true);
  });

  it('回放已写完的回合时从头播放，播完停在选择阶段而不是结局', () => {
    const { result, rerender } = setup({ content: TEXT, settled: true, hasEnding: true });
    expect(result.current.phase).toBe('ending');
    rerender({ content: TEXT, settled: true, hasEnding: false, turnId: 'replay:t1:1', replaying: true });
    expect(result.current.restored).toBe(false);
    expect(result.current.phase).toBe('title');
    tick(500);
    expect(result.current.phase).toBe('beats');
    expect(result.current.index).toBe(0);
    expect(result.current.instant).toBe(false);
    act(() => result.current.skip());
    expect(result.current.phase).toBe('choosing');
  });

  it('退出回放回到结局，不再重播结局动画', () => {
    const { result, rerender } = setup({ content: TEXT, settled: true, hasEnding: false, turnId: 'replay:t1:1', replaying: true });
    rerender({ content: TEXT, settled: true, hasEnding: true, turnId: 't1' });
    expect(result.current.phase).toBe('ending');
    expect(result.current.restored).toBe(true);
  });

  it('已结束的存档直接进入结局', () => {
    const { result } = setup({ content: TEXT, settled: true, hasEnding: true });
    expect(result.current.phase).toBe('ending');
  });

  it('流式回合逐拍推进，读得比写得快时等待下一拍', () => {
    const { result, rerender } = setup({ content: '', settled: false });
    expect(result.current.phase).toBe('waiting');

    rerender({ content: '第一段。\n\n', settled: false });
    expect(result.current.phase).toBe('title');
    tick(400);
    expect(result.current.phase).toBe('beats');
    expect(result.current.beat?.text).toBe('第一段。');

    act(() => result.current.markRevealed());
    act(() => result.current.advance());
    expect(result.current.waitingNext).toBe(true);

    rerender({ content: '第一段。\n\n第二段。\n\n', settled: false });
    expect(result.current.waitingNext).toBe(false);
    expect(result.current.beat?.text).toBe('第二段。');

    act(() => result.current.markRevealed());
    act(() => result.current.advance());
    expect(result.current.waitingNext).toBe(true);

    rerender({ content: TEXT, settled: true });
    expect(result.current.beat?.kind).toBe('npc');
    act(() => result.current.markRevealed());
    act(() => result.current.advance());
    expect(result.current.phase).toBe('choosing');
  });

  it('打字中按推进只完成当前句，不跳到下一拍', () => {
    const { result, rerender } = setup({ content: '', settled: false });
    rerender({ content: TEXT, settled: true });
    tick(400);
    const finish = vi.fn();
    result.current.finishTypingRef.current = finish;
    act(() => result.current.advance());
    expect(finish).toHaveBeenCalledTimes(1);
    expect(result.current.index).toBe(0);
  });

  it('回退到读过的拍子时直接显示全文，再次前进也不重新打字', () => {
    const { result, rerender } = setup({ content: '', settled: false });
    rerender({ content: TEXT, settled: true });
    tick(400);
    act(() => result.current.markRevealed());
    act(() => result.current.advance());
    expect(result.current.index).toBe(1);
    expect(result.current.instant).toBe(false);
    act(() => result.current.back());
    expect(result.current.index).toBe(0);
    expect(result.current.instant).toBe(true);
    act(() => result.current.markRevealed());
    act(() => result.current.advance());
    expect(result.current.index).toBe(1);
    expect(result.current.instant).toBe(true);
  });

  it('自动推进按停留时长前进，打开界面时暂停', () => {
    const { result, rerender } = setup({ content: '', settled: false });
    rerender({ content: TEXT, settled: true, autoAdvance: true });
    tick(400);
    act(() => result.current.markRevealed());
    expect(result.current.dwellMs).toBe(1600);

    rerender({ content: TEXT, settled: true, autoAdvance: true, paused: true });
    expect(result.current.dwellMs).toBeNull();
    tick(5000);
    expect(result.current.index).toBe(0);

    rerender({ content: TEXT, settled: true, autoAdvance: true, paused: false });
    tick(1600);
    expect(result.current.index).toBe(1);
  });

  it('结局回合读完最后一拍后自动进入结局', () => {
    const { result, rerender } = setup({ content: '', settled: false });
    rerender({ content: '最后一句。', settled: true, hasEnding: true });
    tick(400);
    act(() => result.current.markRevealed());
    expect(result.current.phase).toBe('beats');
    tick(1600);
    expect(result.current.phase).toBe('ending');
  });

  it('新回合开始时回到等待状态', () => {
    const { result, rerender } = setup({ content: TEXT, settled: true });
    rerender({ content: '', settled: false, turnId: 't2' });
    expect(result.current.phase).toBe('waiting');
    expect(result.current.restored).toBe(false);
    expect(result.current.index).toBe(-1);
  });

  it('没有正文的回合结束后直接给选择界面', () => {
    const { result, rerender } = setup({ content: '', settled: false });
    rerender({ content: '1. 选项', settled: true });
    expect(result.current.phase).toBe('choosing');
  });

  it('跳过：已写完就进选择，还在写就跳到已到达的最后一拍', () => {
    const { result, rerender } = setup({ content: '', settled: false });
    rerender({ content: '第一段。\n\n第二段。\n\n', settled: false });
    tick(400);
    act(() => result.current.skip());
    expect(result.current.index).toBe(1);
    rerender({ content: TEXT, settled: true });
    act(() => result.current.skip());
    expect(result.current.phase).toBe('choosing');
  });

  it('新开一局的开场即使已经流完，也从第一段播放', () => {
    const { result } = setup({ content: TEXT, settled: true, fromStart: true });
    expect(result.current.phase).toBe('title');
    expect(result.current.restored).toBe(false);
    act(() => { vi.advanceTimersByTime(600); });
    expect(result.current.phase).toBe('beats');
    expect(result.current.index).toBe(0);
  });

  it('读档时已完成的回合仍然直接到选项', () => {
    const { result } = setup({ content: TEXT, settled: true });
    expect(result.current.phase).toBe('choosing');
    expect(result.current.restored).toBe(true);
  });
});
