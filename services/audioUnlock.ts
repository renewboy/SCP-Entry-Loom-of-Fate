let audioUnlocked = false;
let audioContext: AudioContext | null = null;

export function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioContext) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return null;
    audioContext = new AudioContextClass();
  }
  return audioContext;
}

export function unlockAudio(): Promise<void> {
  if (audioUnlocked) return Promise.resolve();
  const ctx = getAudioContext();
  if (!ctx) return Promise.resolve();

  if (ctx.state === 'running') {
    audioUnlocked = true;
    return Promise.resolve();
  }

  return ctx.resume().then(() => {
    audioUnlocked = true;
  });
}

export function isAudioUnlocked(): boolean {
  return audioUnlocked;
}
