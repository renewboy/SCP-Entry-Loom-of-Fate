import { useEffect } from 'react';
import { GameState, GameStatus } from '../types';

export const useGameAudio = (gameState: GameState) => {
  const isCritical = gameState.stability <= 30 && gameState.stability > 0 && gameState.status === GameStatus.PLAYING;

  useEffect(() => {
    let ctx: AudioContext | null = null;
    let osc: OscillatorNode | null = null;
    let gain: GainNode | null = null;
    let lfo: OscillatorNode | null = null;
    let lfoGain: GainNode | null = null;

    if (isCritical) {
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        ctx = new AudioContextClass();
        
        osc = ctx.createOscillator();
        gain = ctx.createGain();
        lfo = ctx.createOscillator();
        lfoGain = ctx.createGain();

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
      } catch (e) {
        console.error("Audio playback failed", e);
      }
    }

    return () => {
      if (osc) osc.stop();
      if (lfo) lfo.stop();
      if (ctx && ctx.state !== 'closed') ctx.close();
    };
  }, [isCritical]);

  return isCritical;
};
