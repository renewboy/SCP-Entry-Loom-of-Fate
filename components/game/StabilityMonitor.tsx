import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useGameAudio } from '../../hooks/useGameAudio';
import { useGlitchEffect } from '../../hooks/useGlitchEffect';
import VisualEffects from './VisualEffects';
import { useTranslation } from '../../utils/i18n';

interface StabilityMonitorProps {
  stability: number;
  isPlaying: boolean;
  isMemoryEchoActive: boolean;
}

const StabilityMonitor: React.FC<StabilityMonitorProps> = ({ stability, isPlaying, isMemoryEchoActive }) => {
  const { t } = useTranslation();
  const prevStabilityRef = useRef(stability);
  const [delta, setDelta] = useState<{ val: number; id: number } | null>(null);

  // --- Visual & Audio Logic Calculation ---
  const instability = 100 - stability;
  
  // Audio: Critical State
  const isCritical = useGameAudio(stability, isPlaying);

  // Visual: Glitch & Noise
  const isGlitching = useGlitchEffect(stability, isPlaying);

  const noiseOpacity = Math.min(Math.max((instability - 20) / 140, 0), 0.5);
  const distortionScale = instability > 30 ? Math.min((instability - 30) * 0.5, 30) : 0;

  // --- Delta UI Logic ---
  useEffect(() => {
    const diff = stability - prevStabilityRef.current;
    if (diff !== 0) {
      setDelta({ val: diff, id: Date.now() });
      // Reset delta display after animation
      const timer = setTimeout(() => setDelta(null), 2000);
      return () => clearTimeout(timer);
    }
    prevStabilityRef.current = stability;
  }, [stability]);

  const getStabilityColor = () => {
    if (stability > 70) return 'text-scp-term';
    if (stability > 30) return 'text-yellow-500';
    return 'text-scp-accent'; // Red
  };

  const getKantCounterLabel = () => {
     if (stability > 70) return t('game.stable');
     if (stability > 30) return t('game.fluctuating');
     return t('game.critical');
  };

  return (
    <>
      {/* 1. Portal for Visual Effects (Full Screen Overlay) */}
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

      {/* 2. UI Component (Rendered where this component is placed) */}
      <div className="flex flex-col select-none" id="stability-monitor-ui">
          <div className="flex items-center gap-3 relative">
            {/* Main Value */}
            <div className="relative">
                <span className={`font-bold font-mono transition-colors duration-500 ${getStabilityColor()} ${isCritical ? 'animate-pulse' : ''}`}>
                   {t('game.stability')}: {stability.toFixed(0)}%
                </span>
                
                {/* Floating Delta */}
                {delta && (
                    <div 
                        key={delta.id}
                        className={`absolute -right-8 top-0 text-xs font-bold font-mono animate-[float-up_1s_ease-out_forwards] ${delta.val > 0 ? 'text-emerald-400' : 'text-rose-500'}`}
                    >
                        {delta.val > 0 ? '+' : ''}{delta.val}
                    </div>
                )}
            </div>

            {/* Status Label & Bar */}
            <div className="hidden sm:flex flex-col gap-1">
                 <span className={`text-[10px] font-mono leading-none ${getStabilityColor()}`}>
                    {getKantCounterLabel()}
                 </span>
                 {/* Mini Bar */}
                 <div className="w-16 h-1 bg-black/50 border border-scp-gray/30 rounded-sm overflow-hidden">
                    <div 
                        className={`h-full transition-all duration-700 ${stability > 70 ? 'bg-scp-term' : stability > 30 ? 'bg-yellow-500' : 'bg-scp-accent'}`}
                        style={{ width: `${stability}%` }}
                    ></div>
                 </div>
            </div>
          </div>
          
          <style>{`
            @keyframes float-up {
                0% { opacity: 1; transform: translateY(0); }
                100% { opacity: 0; transform: translateY(-15px); }
            }
          `}</style>
      </div>
    </>
  );
};

export default StabilityMonitor;
