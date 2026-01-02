import { useState, useEffect } from 'react';

export const useGlitchEffect = (stability: number, isPlaying: boolean) => {
  const [isGlitching, setIsGlitching] = useState(false);

  useEffect(() => {
    // Only active when playing and unstable (stability < 70)
    if (!isPlaying || stability > 70 || stability <= 0) return;

    let timeout: ReturnType<typeof setTimeout>;
    const triggerGlitch = () => {
        setIsGlitching(true);
        // Glitch duration: 150ms
        setTimeout(() => setIsGlitching(false), 150);
        
        // --- Frequency Calculation ---
        // Stability 70: ~15 seconds delay (Low frequency)
        // Stability 0: ~2 seconds delay (High frequency)
        const maxDelay = 9000;
        const minDelay = 2000;
        
        // Normalize stability (0-70 range) to 0-1 ratio
        // ratio = 1 means stability is 70 (Max Delay)
        // ratio = 0 means stability is 0 (Min Delay)
        const ratio = Math.max(0, Math.min(1, stability / 70));
        
        // Calculate delay
        const delay = minDelay + (ratio * (maxDelay - minDelay));
        
        // Add random variance (+/- 20%)
        const variance = delay * 0.2 * (Math.random() - 0.5);
        
        timeout = setTimeout(triggerGlitch, delay + variance);
    };

    // Initial random start
    timeout = setTimeout(triggerGlitch, 2000);
    return () => clearTimeout(timeout);
  }, [isPlaying, stability]);

  return isGlitching;
};
