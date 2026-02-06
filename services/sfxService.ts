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

// Loop Audio State
interface LoopState {
  ctx: AudioContext;
  nodes: AudioNode[];
}
let loopState: LoopState | null = null;

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

/**
 * Starts a critical alarm loop (Siren) using Web Audio API
 */
export const startCriticalLoop = () => {
  if (loopState) return; // Already running

  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContextClass();
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();

    // Siren configuration
    osc.type = 'sawtooth';
    osc.frequency.value = 150; 

    // LFO to modulate pitch
    lfo.type = 'sawtooth';
    lfo.frequency.value = 1; 
    lfoGain.gain.value = 100;

    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    osc.connect(gain);
    gain.connect(ctx.destination);

    gain.gain.value = 0.05;

    osc.start();
    lfo.start();

    loopState = {
      ctx,
      nodes: [osc, gain, lfo, lfoGain]
    };
  } catch (e) {
    console.error("Audio loop playback failed", e);
  }
};

/**
 * Stops the critical alarm loop
 */
export const stopCriticalLoop = () => {
  if (!loopState) return;

  try {
    loopState.nodes.forEach(node => {
      if (node instanceof OscillatorNode) {
        node.stop();
      }
      node.disconnect();
    });
    if (loopState.ctx.state !== 'closed') {
      loopState.ctx.close();
    }
  } catch (e) {
    console.error("Error stopping audio loop", e);
  } finally {
    loopState = null;
  }
};
