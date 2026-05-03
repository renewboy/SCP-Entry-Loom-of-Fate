import React from 'react';
import { createPortal } from 'react-dom';
import { useGameAudio } from '../../hooks/useGameAudio';
import VisualEffects from './VisualEffects';

interface StabilityMonitorProps {
  stability: number;
  isPlaying: boolean;
  isGlitching: boolean;
  isMemoryEchoActive: boolean;
}

/**
 * StabilityMonitor — Logic-only component (no visible UI).
 * Handles: audio effects and full-screen VisualEffects portal.
 * The waveform canvas rendering has been extracted to useWaveformRenderer hook
 * and is now rendered directly in GameHeader as a full-width background.
 */
const StabilityMonitor: React.FC<StabilityMonitorProps> = ({ stability, isPlaying, isGlitching, isMemoryEchoActive }) => {
  const instability = 100 - stability;
  
  // Audio: Critical State
  const isCritical = useGameAudio(stability, isPlaying);

  const noiseOpacity = Math.min(Math.max((instability - 20) / 140, 0), 0.5);
  const distortionScale = instability > 30 ? Math.min((instability - 30) * 0.5, 30) : 0;

  return (
    <>
      {/* Portal for Visual Effects (Full Screen Overlay) */}
      {typeof document !== 'undefined' && createPortal(
        <VisualEffects 
            isCritical={isCritical}
            isGlitching={isGlitching}
            isMemoryEcho={isMemoryEchoActive}
            noiseOpacity={noiseOpacity}
            distortionScale={distortionScale}
            showNoise={isPlaying}
        />,
        document.body
      )}

      {/* Float-up animation keyframes (used by delta display in GameHeader if needed) */}
      <style>{`
        @keyframes float-up {
            0% { opacity: 1; transform: translateY(0); }
            100% { opacity: 0; transform: translateY(-15px); }
        }
      `}</style>
    </>
  );
};

export default StabilityMonitor;
