import React, { useEffect, useState } from 'react';
import StaticNoise from './StaticNoise';
import { useTranslation } from '../../utils/i18n';

interface VisualEffectsProps {
  isCritical: boolean;
  isGlitching: boolean;
  isMemoryEcho: boolean; // New prop for RAG echo
  noiseOpacity: number;
  distortionScale: number;
  showNoise: boolean;
}

const VisualEffects: React.FC<VisualEffectsProps> = ({ 
  isCritical, isGlitching, isMemoryEcho, noiseOpacity, distortionScale, showNoise 
}) => {
  const { t } = useTranslation();
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduceMotion(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  const effectiveGlitching = isGlitching && !reduceMotion;
  const effectiveNoiseOpacity = reduceMotion ? Math.min(noiseOpacity, 0.12) : noiseOpacity;
  const effectiveDistortionScale = reduceMotion ? Math.min(distortionScale, 6) : distortionScale;

  return (
    <>
      <style>
        {`
        @keyframes red-alert {
          0%, 100% { box-shadow: inset 0 0 50px rgba(195, 46, 46, 0.1); }
          50% { box-shadow: inset 0 0 200px rgba(195, 46, 46, 0.5); }
        }
        @keyframes memory-echo {
          0% { filter: sepia(0) blur(0); opacity: 0; }
          10% { filter: sepia(0.8) blur(2px) contrast(1.2); opacity: 0.6; box-shadow: inset 0 0 100px rgba(212, 175, 55, 0.5); }
          80% { filter: sepia(0.8) blur(1px) contrast(1.2); opacity: 0.4; box-shadow: inset 0 0 100px rgba(212, 175, 55, 0.5); }
          100% { filter: sepia(0) blur(0); opacity: 0; }
        }
        @keyframes double-vision {
           0% { transform: translate(0,0); opacity: 0; }
           50% { transform: translate(4px, 0); opacity: 0.5; color: rgba(255,255,255,0.8); text-shadow: -2px 0 red; }
           100% { transform: translate(0,0); opacity: 0; }
        }
        @keyframes noise {
            0% { transform: translate(0, 0); }
            10% { transform: translate(-5%, -5%); }
            20% { transform: translate(-10%, 5%); }
            30% { transform: translate(5%, -10%); }
            40% { transform: translate(-5%, 15%); }
            50% { transform: translate(-10%, 5%); }
            60% { transform: translate(15%, 0); }
            70% { transform: translate(0, 10%); }
            80% { transform: translate(-15%, 0); }
            90% { transform: translate(10%, 5%); }
            100% { transform: translate(5%, 0); }
        }
        .animate-noise {
            animation: noise 0.2s steps(2) infinite;
        }
        @keyframes shake {
            0% { transform: translate(1px, 1px) rotate(0deg); }
            10% { transform: translate(-1px, -2px) rotate(-1deg); }
            20% { transform: translate(-3px, 0px) rotate(1deg); }
            30% { transform: translate(3px, 2px) rotate(0deg); }
            40% { transform: translate(1px, -1px) rotate(1deg); }
            50% { transform: translate(-1px, 2px) rotate(-1deg); }
            60% { transform: translate(-3px, 1px) rotate(0deg); }
            70% { transform: translate(3px, 1px) rotate(-1deg); }
            80% { transform: translate(-1px, -1px) rotate(1deg); }
            90% { transform: translate(1px, 2px) rotate(0deg); }
            100% { transform: translate(1px, -2px) rotate(-1deg); }
        }
        .animate-shake {
            animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both;
        }
        
        /* Colorful Glitch Art Animation */
        @keyframes glitch-color-anim {
           0% { backdrop-filter: hue-rotate(0deg) invert(0); }
           20% { backdrop-filter: hue-rotate(90deg) invert(0.8) contrast(200%); }
           40% { backdrop-filter: hue-rotate(180deg) invert(0) contrast(150%); }
           60% { backdrop-filter: hue-rotate(270deg) invert(0.8) contrast(200%); }
           80% { backdrop-filter: hue-rotate(45deg) invert(0) contrast(150%); }
           100% { backdrop-filter: hue-rotate(0deg) invert(0); }
        }
        .animate-glitch-color { animation: glitch-color-anim 0.2s steps(4) infinite; }
      `}
      </style>

      {/* SVG Filters for Signal Distortion */}
      <svg className="hidden">
        <defs>
          <filter id="signal-interference">
            <feTurbulence type="fractalNoise" baseFrequency="0.005 0.01" numOctaves="2" result="warp">
              <animate attributeName="baseFrequency" values="0.005 0.01; 0.01 0.02; 0.005 0.01" dur="4s" repeatCount="indefinite"/>
            </feTurbulence>
            <feDisplacementMap xChannelSelector="R" yChannelSelector="G" scale={effectiveDistortionScale} in="SourceGraphic" in2="warp" />
          </filter>
        </defs>
      </svg>

      {/* Critical State Red Flash Overlay */}
      {isCritical && (
        <div className="fixed inset-0 z-[100] pointer-events-none animate-[red-alert_2s_infinite]"></div>
      )}

      {/* Memory Echo / Deja Vu Effect */}
      {isMemoryEcho && (
         <div className="fixed inset-0 z-[110] pointer-events-none overflow-hidden">
            {/* Golden/Sepia Vignette Flash */}
            <div className="absolute inset-0" style={{ animation: 'memory-echo 3s ease-in-out forwards' }}></div>
            {/* Subtle Ghosting/Double Vision Overlay */}
            <div className="absolute inset-0 bg-white mix-blend-overlay opacity-10 animate-[double-vision_2s_ease-in-out_infinite]"></div>
            {/* Film Grain Texture (Optional) */}
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/noise-lines.png')] opacity-20 mix-blend-multiply"></div>
            
            {/* Text Notification for Memory Echo */}
            <div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none">
                <span className="inline-block px-8 py-3 bg-amber-500/20 border-y-2 border-amber-500/50 text-amber-300 font-mono text-xl tracking-[0.3em] uppercase animate-pulse shadow-[0_0_25px_rgba(245,158,11,0.5)] backdrop-blur-md">
                    {t('game.memory_echo_detected')}
                </span>
            </div>
         </div>
      )}

      {/* Enhanced Colorful Glitch Art Overlay */}
      {effectiveGlitching && (
        <div className="fixed inset-0 z-[120] pointer-events-none overflow-hidden flex flex-col justify-between">
           {/* Layer 1: Color Shift/Inversion */}
           <div className="absolute inset-0 animate-glitch-color mix-blend-hard-light opacity-80"></div>
           
           {/* Layer 2: RGB Split / Chromatic Aberration */}
           <div className={"absolute inset-0 bg-red-600 mix-blend-screen opacity-30 translate-x-2 animate-pulse"}></div>
           <div className={"absolute inset-0 bg-blue-600 mix-blend-screen opacity-30 -translate-x-2 animate-pulse"}></div>

           {/* Layer 3: Digital Artifacts */}
           <div className="w-full h-[15vh] bg-green-400 mix-blend-exclusion opacity-70 translate-y-[10vh] skew-x-12"></div>
           <div className="w-full h-[5vh] bg-purple-500 mix-blend-exclusion opacity-70 translate-y-[40vh] -skew-x-12"></div>
           <div className="w-full h-[25vh] bg-yellow-300 mix-blend-exclusion opacity-50 translate-y-[70vh] skew-x-6"></div>
           
           {/* Layer 4: Scanlines */}
           <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent,transparent_2px,#ff00ff_3px)] opacity-30 mix-blend-overlay"></div>
        </div>
      )}

      {/* TV Static Noise Overlay */}
      {showNoise && effectiveNoiseOpacity > 0 && (
          <StaticNoise opacity={effectiveNoiseOpacity} />
      )}
    </>
  );
};

export default VisualEffects;
