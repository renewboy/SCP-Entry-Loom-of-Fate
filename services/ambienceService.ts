import { stageAsset } from '../utils/stageAssets';

export type AmbienceKey = 'chamber' | 'weaving';

const sources: Record<AmbienceKey, string> = {
  chamber: stageAsset('audio/loom_ambient.mp3'),
  weaving: stageAsset('audio/loom_weave.mp3'),
};
const FADE_MS = 900;
const FADE_STEP_MS = 50;

let volume = 0.6;
let currentKey: AmbienceKey | null = null;
let current: HTMLAudioElement | null = null;
let retry: (() => void) | null = null;

const fadeOut = (audio: HTMLAudioElement) => {
  const step = audio.volume / (FADE_MS / FADE_STEP_MS);
  const timer = window.setInterval(() => {
    audio.volume = Math.max(0, audio.volume - step);
    if (audio.volume > 0) return;
    window.clearInterval(timer);
    audio.pause();
  }, FADE_STEP_MS);
};

const fadeIn = (audio: HTMLAudioElement) => {
  const timer = window.setInterval(() => {
    if (audio !== current) return window.clearInterval(timer);
    audio.volume = Math.min(volume, audio.volume + volume / (FADE_MS / FADE_STEP_MS));
    if (audio.volume >= volume) window.clearInterval(timer);
  }, FADE_STEP_MS);
};

const clearRetry = () => {
  if (!retry) return;
  window.removeEventListener('pointerdown', retry);
  window.removeEventListener('keydown', retry);
  retry = null;
};

const start = (audio: HTMLAudioElement) => {
  audio.play().then(() => fadeIn(audio)).catch(() => {
    // The browser blocks sound until the first click or key press
    clearRetry();
    retry = () => {
      clearRetry();
      if (audio === current) start(audio);
    };
    window.addEventListener('pointerdown', retry);
    window.addEventListener('keydown', retry);
  });
};

/** The loop behind the screens before the stage. Follows the music volume setting */
export const playAmbience = (key: AmbienceKey) => {
  if (key === currentKey) return;
  if (current) fadeOut(current);
  clearRetry();
  const audio = new Audio(sources[key]);
  audio.loop = true;
  audio.volume = 0;
  currentKey = key;
  current = audio;
  start(audio);
};

export const stopAmbience = () => {
  clearRetry();
  if (current) fadeOut(current);
  current = null;
  currentKey = null;
};

export const setAmbienceVolume = (next: number) => {
  volume = Math.min(1, Math.max(0, next));
  if (current) current.volume = volume;
};
