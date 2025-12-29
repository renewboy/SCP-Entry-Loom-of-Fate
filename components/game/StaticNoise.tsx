import React from 'react';

// SVG Noise Data URI for reliable rendering
const NOISE_SVG_DATA_URI = `data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.6'/%3E%3C/svg%3E`;

interface StaticNoiseProps {
    opacity: number;
}

const StaticNoise: React.FC<StaticNoiseProps> = ({ opacity }) => (
  <div
    className="pointer-events-none absolute inset-0 z-[60] overflow-hidden mix-blend-color-dodge" 
    style={{ opacity }}
  >
    <div 
        className="absolute -inset-[100%] h-[300%] w-[300%] animate-noise"
        style={{ backgroundImage: `url("${NOISE_SVG_DATA_URI}")` }}
    ></div>
  </div>
);

export default StaticNoise;
