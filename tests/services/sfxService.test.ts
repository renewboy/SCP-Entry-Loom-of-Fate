import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const start = vi.fn();
const context = {
  state: 'suspended' as AudioContextState,
  currentTime: 0,
  destination: {},
  resume: vi.fn(() => Promise.resolve()),
  decodeAudioData: vi.fn(() => Promise.resolve({ duration: 12 })),
  createBufferSource: vi.fn(() => ({ connect: (node: unknown) => node, start, playbackRate: { value: 1 }, buffer: null })),
  createGain: vi.fn(() => ({ connect: (node: unknown) => node, gain: { value: 1, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() } })),
};

vi.mock('../../services/audioUnlock', () => ({ getAudioContext: () => context }));

const loadService = async () => {
  vi.resetModules();
  const service = await import('../../services/sfxService');
  service.preloadSfx();
  await vi.waitFor(() => expect(context.decodeAudioData).toHaveBeenCalled());
  await new Promise(resolve => setTimeout(resolve));
  return service;
};

const setActivated = (hasBeenActive: boolean) => {
  Object.defineProperty(navigator, 'userActivation', { configurable: true, value: { hasBeenActive } });
};

describe('sfxService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    context.state = 'suspended';
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, 'userActivation');
  });

  it('用户操作之前不把声音积压到挂起的音频上下文里', async () => {
    const { playSfx } = await loadService();
    setActivated(false);
    playSfx('bootLink');
    expect(start).not.toHaveBeenCalled();
    expect(context.resume).not.toHaveBeenCalled();
  });

  it('用户操作过之后恢复上下文并播放', async () => {
    const { playSfx } = await loadService();
    setActivated(true);
    playSfx('bootReady');
    expect(context.resume).toHaveBeenCalled();
    expect(start).toHaveBeenCalledTimes(1);
  });

  it('上下文已经运行时不需要用户操作', async () => {
    const { playSfx } = await loadService();
    setActivated(false);
    context.state = 'running';
    playSfx('bootPower');
    expect(start).toHaveBeenCalledTimes(1);
  });

  it('解密声不叠加，并且一直响到最后一行解密完', async () => {
    const { playBootDecode } = await loadService();
    context.state = 'running';
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
    playBootDecode(0.5);
    vi.advanceTimersByTime(200);
    playBootDecode(0.6);
    expect(start).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(300);
    expect(start).toHaveBeenCalledTimes(2);
    expect(start.mock.calls[1][2]).toBeCloseTo(0.3);
    vi.advanceTimersByTime(300);
    expect(start).toHaveBeenCalledTimes(2);
    playBootDecode(0.4);
    expect(start).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });
});
