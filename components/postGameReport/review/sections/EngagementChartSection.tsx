import React from 'react';
import type { SessionStats } from '../../types';

interface EngagementChartSectionProps {
  stats: SessionStats;
  title: string;
  turnsLabel: string;
  avgUserLabel: string;
  avgNarratorLabel: string;
  visualsLabel: string;
}

const EngagementChartSection: React.FC<EngagementChartSectionProps> = ({
  stats,
  title,
  turnsLabel,
  avgUserLabel,
  avgNarratorLabel,
  visualsLabel,
}) => {
  const values = stats.engagement.userCharsPerTurn;
  if (!values.length) {
    return null;
  }

  const width = 800;
  const height = 140;
  const maxValue = Math.max(1, ...values);
  const barWidth = width / values.length;

  return (
    <div className="relative z-10 mb-8 border border-scp-gray/30 bg-black/40 p-4 scp-archive">
      <h3 className="text-sm text-scp-text font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
        <span className="w-1 h-4 bg-blue-500 block"></span>
        {title}
      </h3>
      <div className="w-full overflow-hidden relative">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
          {values.map((value, index) => {
            const x = index * barWidth + 1;
            const barHeight = (value / maxValue) * (height - 10);
            const y = height - barHeight;
            return (
              <rect
                key={index}
                x={x}
                y={y}
                width={Math.max(1, barWidth - 2)}
                height={Math.max(1, barHeight)}
                fill="#60a5fa"
                opacity={0.75}
              />
            );
          })}
        </svg>
      </div>
      <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px] text-gray-400 font-mono uppercase">
        <div className="flex items-center justify-between border border-scp-gray/30 bg-black/30 px-2 py-1 scp-archive">
          <span>{turnsLabel}</span>
          <span className="text-white font-bold">{stats.engagement.turns}</span>
        </div>
        <div className="flex items-center justify-between border border-scp-gray/30 bg-black/30 px-2 py-1 scp-archive">
          <span>{avgUserLabel}</span>
          <span className="text-white font-bold">{Math.round(stats.engagement.avgUserCharsPerTurn)}</span>
        </div>
        <div className="flex items-center justify-between border border-scp-gray/30 bg-black/30 px-2 py-1 scp-archive">
          <span>{avgNarratorLabel}</span>
          <span className="text-white font-bold">{Math.round(stats.engagement.avgNarratorCharsPerTurn)}</span>
        </div>
        <div className="flex items-center justify-between border border-scp-gray/30 bg-black/30 px-2 py-1 scp-archive">
          <span>{visualsLabel}</span>
          <span className="text-white font-bold">{stats.engagement.visualsCount}</span>
        </div>
      </div>
    </div>
  );
};

export default EngagementChartSection;
