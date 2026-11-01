import React from 'react';
import { act, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import BootSequenceOverlay from '../../components/BootSequenceOverlay';
import { playBootDecode, playBootTick, playSfx } from '../../services/sfxService';

vi.mock('../../services/sfxService', () => ({
  playBootDecode: vi.fn(),
  playBootTick: vi.fn(),
  playSfx: vi.fn(),
  preloadSfx: vi.fn(),
}));
vi.mock('../../utils/i18n', () => {
  const t = (key: string) => (key === 'i18n.boot_keywords' ? ['Keter'] : key);
  return { useTranslation: () => ({ t, language: 'zh' }) };
});

const played = () => vi.mocked(playSfx).mock.calls.map(([key]) => key);
const advance = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

describe('开机序列音效', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('通电只响一次，每行日志响一声，进入握手响线路声', () => {
    render(<React.StrictMode><BootSequenceOverlay onComplete={() => {}} /></React.StrictMode>);
    advance(0);
    expect(played()).toEqual(['bootPower']);
    for (let line = 0; line < 12; line += 1) advance(200);
    expect(playBootTick).toHaveBeenCalledTimes(12);
    expect(played()).toEqual(['bootPower']);
    advance(800);
    expect(played()).toEqual(['bootPower', 'bootLink']);
  });

  it('设置里跳过开机序列时，标题页不响', () => {
    render(<React.StrictMode><BootSequenceOverlay skipToReady onComplete={() => {}} /></React.StrictMode>);
    advance(3000);
    expect(played()).toEqual([]);
  });

  it('走完开机序列到标题页时响重击和故障声', () => {
    const { container } = render(<BootSequenceOverlay onComplete={() => {}} />);
    fireEvent.click(container.firstChild as Element);
    fireEvent.click(container.firstChild as Element);
    advance(0);
    fireEvent.click(container.firstChild as Element);
    advance(0);
    expect(played()).toEqual(expect.arrayContaining(['bootReady', 'glitch']));
  });

  it('档案逐行解密时响，有文字的行才响，盖章和屏幕抖动同时响', () => {
    const { container } = render(<BootSequenceOverlay onComplete={() => {}} />);
    fireEvent.click(container.firstChild as Element);
    advance(100);
    expect(playBootDecode).not.toHaveBeenCalled();
    advance(120);
    expect(playBootDecode).toHaveBeenCalledTimes(1);
    expect(vi.mocked(playBootDecode).mock.calls[0][0]).toBeGreaterThan(0);

    fireEvent.click(container.firstChild as Element);
    advance(1000);
    expect(played()).not.toContain('stamp');
    advance(200);
    expect(played()).toContain('stamp');
    expect(container.firstChild).toHaveClass('animate-shake');
  });
});
