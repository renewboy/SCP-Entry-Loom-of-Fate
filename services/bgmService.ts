import { getAudioContext } from './audioUnlock';

let audio: HTMLAudioElement | null = null;
let shouldPlay = false;
let resumeTimer: number | null = null;
let listenersAttached = false;
let fadeRaf: number | null = null;
let targetVolume = 0.6;
/** When true, pausing/resuming is controlled externally (App.tsx visibility handler). */
let externalPauseActive = false;
const resumeDelayMs = 300;
const retryDelayMs = 1000;
const fadeInDurationMs = 800;
const fadeOutDurationMs = 800;
const resumeFadeDurationMs = 600;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const getAudio = () => {
  if (audio) return audio;
  audio = new Audio('/bgm/main-theme.mp3');
  audio.loop = true;
  audio.preload = 'auto';
  audio.volume = clamp01(targetVolume);
  return audio;
};

const clearFade = () => {
  if (fadeRaf) {
    window.cancelAnimationFrame(fadeRaf);
    fadeRaf = null;
  }
};

const fadeTo = (target: number, duration: number, onDone?: () => void) => {
  const player = getAudio();
  const start = clamp01(player.volume);
  const end = clamp01(target);
  const delta = end - start;
  const startTime = performance.now();
  clearFade();
  if (!Number.isFinite(duration) || duration <= 0) {
    player.volume = end;
    if (onDone) onDone();
    return;
  }
  const step = (now: number) => {
    const progress = clamp01((now - startTime) / duration);
    player.volume = clamp01(start + delta * progress);
    if (progress < 1) {
      fadeRaf = window.requestAnimationFrame(step);
      return;
    }
    fadeRaf = null;
    if (onDone) onDone();
  };
  fadeRaf = window.requestAnimationFrame(step);
};

const safePlay = () => {
  if (!shouldPlay) return;
  const player = getAudio();
  const result = player.play();
  if (result && typeof result.catch === 'function') {
    result.catch(() => {
      if (resumeTimer) window.clearTimeout(resumeTimer);
      resumeTimer = window.setTimeout(() => safePlay(), retryDelayMs);
    });
  }
};

const handleResumeAttempt = () => {
  if (!shouldPlay) return;
  // Skip internal auto-resume while externally paused (App.tsx controls lifecycle)
  if (externalPauseActive) return;
  if (document.visibilityState === 'hidden') return;
  if (resumeTimer) window.clearTimeout(resumeTimer);
  resumeTimer = window.setTimeout(() => {
    safePlay();
    fadeTo(targetVolume, resumeFadeDurationMs);
  }, resumeDelayMs);
};

const attachListeners = () => {
  if (listenersAttached) return;
  listenersAttached = true;
  const player = getAudio();
  player.addEventListener('pause', handleResumeAttempt);
  player.addEventListener('ended', handleResumeAttempt);
  window.addEventListener('focus', handleResumeAttempt);
  // Note: visibilitychange is handled by App.tsx via pauseBgm/resumeBgm.
  // Removed from here to avoid dual-control conflicts.
};

interface BgmFxChain {
  ctx: AudioContext;
  gain: GainNode;
  filter: BiquadFilterNode;
}
let fxChain: BgmFxChain | null = null;
const OPEN_FILTER_HZ = 20000;

const getFxChain = (): BgmFxChain | null => {
  if (fxChain) return fxChain;
  const ctx = getAudioContext();
  if (!ctx) return null;
  try {
    const source = ctx.createMediaElementSource(getAudio());
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    filter.type = 'lowpass';
    filter.frequency.value = OPEN_FILTER_HZ;
    source.connect(filter).connect(gain).connect(ctx.destination);
    fxChain = { ctx, gain, filter };
    if (ctx.state === 'suspended') ctx.resume().catch(() => null);
    return fxChain;
  } catch {
    return null;
  }
};

/** Scale the music to `level` of its normal volume without touching the user's volume setting */
export const duckBgm = (level: number, seconds = 1) => {
  const chain = getFxChain();
  if (!chain) {
    fadeTo(targetVolume * level, seconds * 1000);
    return;
  }
  const param = chain.gain.gain;
  const now = chain.ctx.currentTime;
  param.cancelScheduledValues(now);
  param.setValueAtTime(param.value, now);
  param.linearRampToValueAtTime(clamp01(level), now + Math.max(0.01, seconds));
};

/** Sweep a low-pass filter over the music, as if heard through a wall */
export const muffleBgm = (hz: number, seconds = 1) => {
  const chain = getFxChain();
  if (!chain) return;
  const param = chain.filter.frequency;
  const now = chain.ctx.currentTime;
  param.cancelScheduledValues(now);
  param.setValueAtTime(param.value, now);
  param.exponentialRampToValueAtTime(hz, now + Math.max(0.01, seconds));
};

export const resetBgmFx = (seconds = 0.6) => {
  if (!fxChain) return;
  duckBgm(1, seconds);
  muffleBgm(OPEN_FILTER_HZ, seconds);
};

export const playBgm = () => {
  resetBgmFx(0);
  shouldPlay = true;
  externalPauseActive = false;
  attachListeners();
  const player = getAudio();
  if (player.paused) player.volume = 0;
  safePlay();
  fadeTo(targetVolume, fadeInDurationMs);
};

export const setBgmVolume = (volume: number) => {
  targetVolume = clamp01(volume);
  if (!audio) return;
  if (!shouldPlay) {
    audio.volume = clamp01(targetVolume);
    return;
  }
  fadeTo(targetVolume, 200);
};

export const stopBgm = () => {
  if (!audio) return;
  shouldPlay = false;
  externalPauseActive = false;
  if (resumeTimer) window.clearTimeout(resumeTimer);
  clearFade();
  fadeTo(0, fadeOutDurationMs, () => {
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    audio.volume = clamp01(targetVolume);
  });
};

/**
 * Externally-driven pause (e.g. App.tsx visibilitychange handler).
 * Sets `externalPauseActive` so internal listeners don't fight back.
 */
export const pauseBgm = () => {
  if (!audio) return;
  externalPauseActive = true;
  if (resumeTimer) window.clearTimeout(resumeTimer);
  clearFade();
  fadeTo(0, fadeOutDurationMs, () => {
    if (!audio) return;
    audio.pause();
  });
};

/**
 * Externally-driven resume (counterpart to pauseBgm).
 * Clears the externalPauseActive guard and restores playback.
 */
export const resumeBgm = () => {
  if (!shouldPlay) return;  // Don't resume if playback was stopped, not just paused
  externalPauseActive = false;
  attachListeners();
  const player = getAudio();
  if (player.paused) player.volume = 0;
  safePlay();
  fadeTo(targetVolume, resumeFadeDurationMs);
};
