import React from 'react';
import StaticNoise from './StaticNoise';

interface VisualEffectsProps {
  isCritical: boolean;
  isGlitching: boolean;
  noiseOpacity: number;
  distortionScale: number;
  showNoise: boolean;
}

const VisualEffects: React.FC<VisualEffectsProps> = ({ 
  isCritical, isGlitching, noiseOpacity, distortionScale, showNoise 
}) => {
  return (
    <>
      <style>
        {`
        @keyframes red-alert {
          0%, 100% { box-shadow: inset 0 0 50px rgba(195, 46, 46, 0.1); }
          50% { box-shadow: inset 0 0 200px rgba(195, 46, 46, 0.5); }
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
            <feDisplacementMap xChannelSelector="R" yChannelSelector="G" scale={distortionScale} in="SourceGraphic" in2="warp" />
          </filter>
        </defs>
      </svg>

      {/* Critical State Red Flash Overlay */}
      {isCritical && (
        <div className="fixed inset-0 z-[100] pointer-events-none animate-[red-alert_2s_infinite]"></div>
      )}

      {/* Enhanced Colorful Glitch Art Overlay */}
      {isGlitching && (
        <div className="fixed inset-0 z-[120] pointer-events-none overflow-hidden flex flex-col justify-between">
           {/* Layer 1: Color Shift/Inversion */}
           <div className="absolute inset-0 animate-glitch-color mix-blend-hard-light opacity-80"></div>
           
           {/* Layer 2: RGB Split / Chromatic Aberration */}
           <div className="absolute inset-0 bg-red-600 mix-blend-screen opacity-30 translate-x-2 animate-pulse"></div>
           <div className="absolute inset-0 bg-blue-600 mix-blend-screen opacity-30 -translate-x-2 animate-pulse"></div>

           {/* Layer 3: Digital Artifacts (Blocks) */}
           <div className="w-full h-[15vh] bg-green-400 mix-blend-exclusion opacity-70 translate-y-[10vh] skew-x-12"></div>
           <div className="w-full h-[5vh] bg-purple-500 mix-blend-exclusion opacity-70 translate-y-[40vh] -skew-x-12"></div>
           <div className="w-full h-[25vh] bg-yellow-300 mix-blend-exclusion opacity-50 translate-y-[70vh] skew-x-6"></div>
           
           {/* Layer 4: Scanlines */}
           <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent,transparent_2px,#ff00ff_3px)] opacity-30 mix-blend-overlay"></div>
        </div>
      )}

      {/* TV Static Noise Overlay */}
      {showNoise && noiseOpacity > 0 && (
          <StaticNoise opacity={noiseOpacity} />
      )}
    </>
  );
};

export default VisualEffects;
