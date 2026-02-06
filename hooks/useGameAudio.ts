import { useEffect } from 'react';
import { startCriticalLoop, stopCriticalLoop } from '../services/sfxService';

export const useGameAudio = (stability: number, isPlaying: boolean) => {
  const isCritical = stability <= 30 && stability > 0 && isPlaying;

  useEffect(() => {
    if (isCritical) {
      startCriticalLoop();
    } else {
      stopCriticalLoop();
    }
    return () => {
      stopCriticalLoop();
    };
  }, [isCritical]);

  return isCritical;
};
