import React from 'react';

interface StabilityChartSectionProps {
  stabilityHistory: number[];
  title: string;
}

const StabilityChartSection: React.FC<StabilityChartSectionProps> = ({ stabilityHistory, title }) => {
  if (stabilityHistory.length < 2) {
    return null;
  }

  const width = 800;
  const height = 150;
  const maxValue = 100;
  const padding = 10;

  const points = stabilityHistory
    .map((value, index) => {
      const x = (index / (stabilityHistory.length - 1)) * width;
      const y = height - (value / maxValue) * (height - padding);
      return `${x},${y}`;
    })
    .join(' ');

  const areaPoints = `${points} ${width},${height} 0,${height}`;

  return (
    <div className="relative z-10 mb-8 border border-scp-gray/30 bg-black/40 p-4 scp-archive">
      <h3 className="text-sm text-scp-text font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
        <span className="w-1 h-4 bg-scp-term_fix block"></span>
        {title}
      </h3>
      <div className="w-full overflow-hidden relative">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto drop-shadow-[0_0_5px_rgba(51,255,0,0.3)]">
          <defs>
            <linearGradient id="grid-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(51, 255, 0, 0.2)" />
              <stop offset="100%" stopColor="rgba(51, 255, 0, 0)" />
            </linearGradient>
          </defs>
          <line x1="0" y1={height * 0.3} x2={width} y2={height * 0.3} stroke="#333" strokeDasharray="4" strokeWidth="1" />
          <line x1="0" y1={height * 0.7} x2={width} y2={height * 0.7} stroke="#333" strokeDasharray="4" strokeWidth="1" />
          <line x1="0" y1={height - 1} x2={width} y2={height - 1} stroke="#666" strokeWidth="1" />
          <polygon points={areaPoints} fill="url(#grid-grad)" />
          <polyline
            points={points}
            fill="none"
            stroke="#33ff00"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {stabilityHistory.map((value, index) => {
            const x = (index / (stabilityHistory.length - 1)) * width;
            const y = height - (value / maxValue) * (height - padding);
            const isCritical = value < 30;
            return (
              <circle
                key={index}
                cx={x}
                cy={y}
                r={isCritical ? 4 : 2}
                fill={isCritical ? '#c32e2e' : '#33ff00'}
                stroke="#000"
                strokeWidth="1"
              />
            );
          })}
        </svg>
      </div>
      <div className="flex justify-between text-[10px] text-scp-gray font-mono mt-2 uppercase">
        <span>START (100%)</span>
        <span>TIME</span>
        <span>END ({stabilityHistory[stabilityHistory.length - 1]}%)</span>
      </div>
    </div>
  );
};

export default StabilityChartSection;
