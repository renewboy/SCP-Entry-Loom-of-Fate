import React from 'react';

interface GameLogoProps {
  className?: string;
}

const GameLogo: React.FC<GameLogoProps> = ({ className = "" }) => {
  return (
    <svg 
      viewBox="0 0 100 100" 
      className={`fill-current ${className}`} 
      xmlns="http://www.w3.org/2000/svg"
      aria-label="SCP Foundation Logo"
    >
      <g transform="translate(50,50)">
        {/* Central Hub with Hole (Donut) using evenodd fill rule */}
        <path 
            d="M 0 0 m -14 0 a 14 14 0 1 0 28 0 a 14 14 0 1 0 -28 0 M 0 0 m -6 0 a 6 6 0 1 1 12 0 a 6 6 0 1 1 -12 0" 
            fillRule="evenodd"
        />

        {/* 3 Arrows pointing Inwards (0, 120, 240 degrees) */}
        {[0, 120, 240].map(angle => (
            <path 
                key={`arrow-${angle}`}
                transform={`rotate(${angle})`}
                d="M -9 -42 L 9 -42 L 9 -28 L 16 -28 L 0 -9 L -16 -28 L -9 -28 Z"
            />
        ))}

        {/* 3 Ring Segments (Between the arrows - rotated 60, 180, 300) */}
        {[60, 180, 300].map(angle => (
            <path
                key={`ring-${angle}`}
                transform={`rotate(${angle})`}
                // Outer Radius ~44, Inner ~36
                d="M -23 -37 A 44 44 0 0 1 23 -37 L 19 -30 A 36 36 0 0 0 -19 -30 Z"
            />
        ))}
      </g>
    </svg>
  );
};

export default GameLogo;