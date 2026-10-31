import { getAudioContext } from './audioUnlock';
import { stageAsset } from '../utils/stageAssets';

export type SfxKey =
  | 'footstep'
  | 'doorUnlock'
  | 'objectiveComplete'
  | 'glitch'
  | 'sweep'
  | 'sweepUp'
  | 'sweepDown'
  | 'sweepReverse'
  | 'bigSweep'
  | 'quickSweep';

export interface SfxOptions {
  gain?: number;
  rate?: number;
  offset?: number;
  /** Seconds of output to play; the whole sample when omitted */
  duration?: number;
  /** Seconds of linear fade before `duration` ends */
  fade?: number;
}

const sources: Record<SfxKey, string> = {
  footstep: '/sfx/footstep.mp3',
  doorUnlock: '/sfx/door-unlock.mp3',
  objectiveComplete: '/sfx/objective-complete.mp3',
  glitch: '/sfx/glitch.mp3',
  sweep: stageAsset('audio/sweep.mp3'),
  sweepUp: stageAsset('audio/sweep_up.mp3'),
  sweepDown: stageAsset('audio/sweep_dn.mp3'),
  sweepReverse: stageAsset('audio/sweep_rev.mp3'),
  bigSweep: stageAsset('audio/bigsweep.mp3'),
  quickSweep: stageAsset('audio/quicksweep.mp3')
};

const volumes: Record<SfxKey, number> = {
  footstep: 0.35,
  doorUnlock: 0.65,
  objectiveComplete: 0.65,
  glitch: 0.5,
  sweep: 0.4,
  sweepUp: 0.4,
  sweepDown: 0.4,
  sweepReverse: 0.4,
  bigSweep: 0.5,
  quickSweep: 0.35
};

const audioCache = new Map<SfxKey, HTMLAudioElement>();
const bufferCache = new Map<SfxKey, AudioBuffer>();
const bufferLoading = new Set<SfxKey>();
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
let sfxVolume = 1;

const getAudio = (key: SfxKey) => {
  const cached = audioCache.get(key);
  if (cached) return cached;
  const audio = new Audio(sources[key]);
  audio.preload = 'auto';
  audioCache.set(key, audio);
  return audio;
};

const loadBuffer = (ctx: AudioContext, key: SfxKey) => {
  if (bufferCache.has(key) || bufferLoading.has(key)) return;
  bufferLoading.add(key);
  fetch(sources[key])
    .then(response => response.arrayBuffer())
    .then(data => ctx.decodeAudioData(data))
    .then(buffer => {
      bufferCache.set(key, buffer);
    })
    .catch(() => null)
    .finally(() => {
      bufferLoading.delete(key);
    });
};

/** Decode every sample ahead of time so pitched and sliced playback is available when needed */
export const preloadSfx = () => {
  const ctx = getAudioContext();
  if (!ctx) return;
  (Object.keys(sources) as SfxKey[]).forEach(key => loadBuffer(ctx, key));
};

export const playSfx = (key: SfxKey, options: SfxOptions = {}) => {
  const { gain = 1, rate = 1, offset = 0, duration, fade } = options;
  const level = volumes[key] * sfxVolume * gain;
  const ctx = getAudioContext();
  const buffer = bufferCache.get(key);

  if (ctx && buffer) {
    if (ctx.state === 'suspended') ctx.resume().catch(() => null);
    const source = ctx.createBufferSource();
    const output = ctx.createGain();
    const now = ctx.currentTime;
    source.buffer = buffer;
    source.playbackRate.value = rate;
    output.gain.value = level;
    source.connect(output).connect(ctx.destination);
    if (duration) {
      if (fade) {
        output.gain.setValueAtTime(level, now + Math.max(0, duration - fade));
        output.gain.linearRampToValueAtTime(0.0001, now + duration);
      }
      source.start(now, offset, duration * rate);
    } else {
      source.start(now, offset);
    }
    return;
  }

  if (ctx) loadBuffer(ctx, key);
  const audio = getAudio(key);
  audio.volume = clamp01(level);
  audio.playbackRate = rate;
  audio.currentTime = offset;
  const result = audio.play();
  if (result && typeof result.catch === 'function') {
    result.catch(() => null);
  }
};

export const setSfxVolume = (volume: number) => {
  sfxVolume = clamp01(volume);
};
