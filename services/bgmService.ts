let audio: HTMLAudioElement | null = null;
let shouldPlay = false;
let resumeTimer: number | null = null;
let listenersAttached = false;
let fadeRaf: number | null = null;
let targetVolume = 0.6;
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
  window.addEventListener('visibilitychange', handleResumeAttempt);
  window.addEventListener('focus', handleResumeAttempt);
};

export const playBgm = () => {
  shouldPlay = true;
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
  if (resumeTimer) window.clearTimeout(resumeTimer);
  clearFade();
  fadeTo(0, fadeOutDurationMs, () => {
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    audio.volume = clamp01(targetVolume);
  });
};

export const pauseBgm = () => {
  if (!audio) return;
  shouldPlay = false;
  if (resumeTimer) window.clearTimeout(resumeTimer);
  clearFade();
  fadeTo(0, fadeOutDurationMs, () => {
    if (!audio) return;
    audio.pause();
  });
};

export const resumeBgm = () => {
  shouldPlay = true;
  attachListeners();
  const player = getAudio();
  if (player.paused) player.volume = 0;
  safePlay();
  fadeTo(targetVolume, resumeFadeDurationMs);
};
