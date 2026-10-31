import React, { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { CharSpans, useReveal } from '../../components/game/stage/BeatText';
import { playKeystroke } from '../../services/sfxService';

vi.mock('../../services/sfxService', () => ({ playKeystroke: vi.fn() }));

const Line: React.FC<{ text?: string; speed?: 0 | 1 | 2 | 3; instant?: boolean; fast?: boolean; onDone?: () => void; finishRef?: React.MutableRefObject<(() => void) | null> }> = ({ text = '一二三四五六七八九十一二三四五六七八九十', speed = 2, instant = false, fast = false, onDone = () => {}, finishRef }) => {
  const ref = useRef<HTMLDivElement>(null);
  const localFinish = useRef<(() => void) | null>(null);
  useReveal(ref, { revealKey: text, speed, instant, fast, onDone, finishRef: finishRef ?? localFinish });
  return <div ref={ref}><CharSpans text={text} /></div>;
};

describe('打字机音效', () => {
  let frames: FrameRequestCallback[] = [];
  let clock = 0;

  const advance = (ms: number, stepMs = 16) => {
    for (let elapsed = 0; elapsed < ms; elapsed += stepMs) {
      clock += stepMs;
      const due = frames;
      frames = [];
      act(() => due.forEach(frame => frame(clock)));
    }
  };

  beforeEach(() => {
    vi.mocked(playKeystroke).mockClear();
    frames = [];
    clock = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => clock);
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => frames.push(callback));
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => { frames = []; });
    vi.spyOn(window, 'matchMedia').mockImplementation(query => ({ matches: false, media: query } as MediaQueryList));
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  afterEach(() => vi.restoreAllMocks());

  it('逐字显示时按 50 到 90 毫秒的间隔响，不是每个字都响', () => {
    render(<Line speed={3} text={'字'.repeat(60)} />);
    advance(700);
    const count = vi.mocked(playKeystroke).mock.calls.length;
    expect(count).toBeGreaterThanOrEqual(7);
    expect(count).toBeLessThanOrEqual(14);
  });

  it('显示完就停', () => {
    const onDone = vi.fn();
    render(<Line text="短句" onDone={onDone} />);
    advance(400);
    const count = vi.mocked(playKeystroke).mock.calls.length;
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(count).toBeGreaterThan(0);
    advance(400);
    expect(vi.mocked(playKeystroke).mock.calls.length).toBe(count);
  });

  it('跳过、瞬显和回读已读内容不响', () => {
    render(<Line instant />);
    advance(300);
    render(<Line speed={0} />);
    advance(300);
    expect(playKeystroke).not.toHaveBeenCalled();
  });

  it('按住快进不响', () => {
    render(<Line fast />);
    advance(300);
    expect(playKeystroke).not.toHaveBeenCalled();
  });

  it('中途点击补完后不再响', () => {
    const finishRef: React.MutableRefObject<(() => void) | null> = { current: null };
    render(<Line speed={1} text={'字'.repeat(40)} finishRef={finishRef} />);
    advance(200);
    const count = vi.mocked(playKeystroke).mock.calls.length;
    act(() => finishRef.current?.());
    advance(300);
    expect(vi.mocked(playKeystroke).mock.calls.length).toBe(count);
  });

  it('减少动态效果时不响', () => {
    vi.mocked(window.matchMedia).mockImplementation(query => ({ matches: query.includes('reduced-motion'), media: query } as MediaQueryList));
    render(<Line />);
    advance(300);
    expect(playKeystroke).not.toHaveBeenCalled();
  });
});
