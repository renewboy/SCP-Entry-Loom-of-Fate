import React from 'react';
import GameLogo from '../../GameLogo';

/** The grid and the red SCP mark behind a map on the planning screens. They stay put while the map pans */
const NetworkBackdrop: React.FC = () => (
  <div className="map-backdrop" aria-hidden="true">
    <svg width="100%" height="100%">
      <defs>
        <pattern id="map-backdrop-grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255, 255, 255, 0.15)" strokeWidth="0.5"/>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#map-backdrop-grid)" />
    </svg>
    <div className="map-backdrop-mark"><GameLogo className="w-full h-full" color="#ef4444" /></div>
  </div>
);

export default NetworkBackdrop;
