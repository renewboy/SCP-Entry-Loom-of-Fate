import React from 'react';

interface GameLogoProps {
  className?: string;
}

const GameLogo: React.FC<GameLogoProps> = ({ className = "" }) => {
  const center = "67.7 71.5";
  const arrowPath = "m64.7 30.6v24h-5.08l8.08 14 8.08-14h-5.08l-.000265-24h-5.99";
  const shieldPath = "m51.9 11.9h31.7l3.07 11.4.944.391c19.4 8.03 32 26.9 32 47.9 0 2.26-.149 4.53-.445 6.77l-.133 1.01 8.37 8.37-15.8 27.4-11.4-3.06-.809.623c-9.06 6.95-20.2 10.7-31.6 10.7-11.4 6e-5-22.5-3.77-31.6-10.7l-.81-.623-11.4 3.06-15.8-27.4 8.37-8.37-.133-1.01c-.296-2.25-.445-4.51-.445-6.77.000141-21 12.6-39.9 32-47.9l.944-.391z";

  return (
    <svg 
      viewBox="0 0 135 135" 
      className={className} 
      xmlns="http://www.w3.org/2000/svg"
      aria-label="SCP Foundation Logo"
    >
        {/* Inner Ring - Stroked */}
        <circle cx="67.7" cy="71.5" r="33" fill="none" stroke="currentColor" strokeWidth="6" />
        
        {/* Outer Shield/Sawtooth - Stroked */}
        <path d={shieldPath} fill="none" stroke="currentColor" strokeWidth="4" />

        {/* 3 Arrows - Filled */}
        <g fill="currentColor" stroke="none">
            <path d={arrowPath} />
            <path d={arrowPath} transform={`rotate(120 ${center})`} />
            <path d={arrowPath} transform={`rotate(240 ${center})`} />
        </g>
    </svg>
  );
};

export default GameLogo;