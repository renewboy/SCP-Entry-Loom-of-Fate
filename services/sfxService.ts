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
  | 'quickSweep'
  | 'gateOpen'
  | 'gateClose'
  | 'stamp'
  | 'tubeOn';

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
  quickSweep: stageAsset('audio/quicksweep.mp3'),
  gateOpen: stageAsset('audio/gate_open.mp3'),
  gateClose: stageAsset('audio/gate_close.mp3'),
  stamp: stageAsset('audio/stamp.mp3'),
  tubeOn: stageAsset('audio/tube_on.mp3')
};

const volumes: Record<SfxKey, number> = {
  footstep: 0.35,
  doorUnlock: 0.65,
  objectiveComplete: 0.65,
  glitch: 0.5,
  sweep: 1,
  sweepUp: 1,
  sweepDown: 1,
  sweepReverse: 1,
  bigSweep: 1,
  quickSweep: 0.35,
  gateOpen: 1,
  gateClose: 1,
  stamp: 1,
  tubeOn: 1
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

const KEYSTROKE_NOISE_SECONDS = 0.05;
const KEYSTROKE_MIN_GAP = 0.02;
let keystrokeNoise: { ctx: AudioContext; buffer: AudioBuffer } | null = null;
let lastKeystrokeAt = 0;

const keystrokeBuffer = (ctx: AudioContext) => {
  if (keystrokeNoise?.ctx === ctx) return keystrokeNoise.buffer;
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * KEYSTROKE_NOISE_SECONDS), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  keystrokeNoise = { ctx, buffer };
  return buffer;
};

const playKeystrokeLayer = (ctx: AudioContext, now: number, type: BiquadFilterType, frequency: number, peak: number, attack: number, length: number, q?: number) => {
  const source = ctx.createBufferSource();
  source.buffer = keystrokeBuffer(ctx);
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = frequency;
  if (q !== undefined) filter.Q.value = q;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(peak, now + attack);
  gain.gain.exponentialRampToValueAtTime(0.001, now + length);
  source.connect(filter).connect(gain).connect(ctx.destination);
  source.start(now);
  source.stop(now + length);
};

/** The typewriter key: a short click over a low thud, as the old chat view played it */
export const playKeystroke = () => {
  if (sfxVolume <= 0) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => null);
  const now = ctx.currentTime;
  if (now - lastKeystrokeAt < KEYSTROKE_MIN_GAP) return;
  lastKeystrokeAt = now;
  playKeystrokeLayer(ctx, now, 'bandpass', 2500 + Math.random() * 500, 0.15 * sfxVolume, 0.005, 0.03, 2);
  playKeystrokeLayer(ctx, now, 'lowpass', 300 + Math.random() * 100, 0.3 * sfxVolume, 0.01, 0.05);
};

/** The press on the buttons that move the run forward (weave, upload, continue): the sound of pressing Weave Fate in the promo */
export const playButtonPress = () => playSfx('doorUnlock');

/** The same sample's second, shorter click, quieter, for every other button on those screens */
export const playLightPress = () => playSfx('doorUnlock', { offset: 0.33, duration: 0.17, fade: 0.08, gain: 0.4 });

export const setSfxVolume = (volume: number) => {
  sfxVolume = clamp01(volume);
};
