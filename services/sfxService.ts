type SfxKey = 'footstep' | 'doorUnlock' | 'objectiveComplete' | 'glitch';

const sources: Record<SfxKey, string> = {
  footstep: '/sfx/footstep.mp3',
  doorUnlock: '/sfx/door-unlock.mp3',
  objectiveComplete: '/sfx/objective-complete.mp3',
  glitch: '/sfx/glitch.mp3'
};

const volumes: Record<SfxKey, number> = {
  footstep: 0.35,
  doorUnlock: 0.65,
  objectiveComplete: 0.65,
  glitch: 0.5
};

const audioCache = new Map<SfxKey, HTMLAudioElement>();

const getAudio = (key: SfxKey) => {
  const cached = audioCache.get(key);
  if (cached) return cached;
  const audio = new Audio(sources[key]);
  audio.preload = 'auto';
  audioCache.set(key, audio);
  return audio;
};

export const playSfx = (key: SfxKey) => {
  const audio = getAudio(key);
  audio.volume = volumes[key];
  audio.currentTime = 0;
  const result = audio.play();
  if (result && typeof result.catch === 'function') {
    result.catch(() => null);
  }
};
