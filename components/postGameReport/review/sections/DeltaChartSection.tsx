import React from 'react';
import type { SessionStats } from '../../types';

interface DeltaChartSectionProps {
  stats: SessionStats;
  title: string;
  largestDropLabel: string;
  largestRecoveryLabel: string;
  volatilityLabel: string;
  criticalTurnsLabel: string;
}

const DeltaChartSection: React.FC<DeltaChartSectionProps> = ({
  stats,
  title,
  largestDropLabel,
  largestRecoveryLabel,
  volatilityLabel,
  criticalTurnsLabel,
}) => {
  if (!stats.deltas.length) {
    return null;
  }

  const width = 800;
  const height = 170;
  const padding = 10;
  const baseline = height / 2;
  const maxAbs = Math.max(5, ...stats.deltas.map((delta) => Math.abs(delta)));
  const barWidth = width / stats.deltas.length;

  return (
    <div className="relative z-10 mb-8 border border-scp-gray/30 bg-black/40 p-4 scp-archive">
      <h3 className="text-sm text-scp-text font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
        <span className="w-1 h-4 bg-scp-term_fix block"></span>
        {title}
      </h3>
      <div className="w-full overflow-hidden relative">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
          <line x1="0" y1={baseline} x2={width} y2={baseline} stroke="#444" strokeWidth="1" />
          {stats.deltas.map((delta, index) => {
            const x = index * barWidth + 1;
            const barHeight = (Math.abs(delta) / maxAbs) * (baseline - padding);
            const y = delta >= 0 ? baseline - barHeight : baseline;
            const fill = delta >= 0 ? '#33ff00' : '#c32e2e';

            return (
              <rect
                key={index}
                x={x}
                y={y}
                width={Math.max(1, barWidth - 2)}
                height={Math.max(1, barHeight)}
                fill={fill}
                opacity={0.8}
              />
            );
          })}
        </svg>
      </div>
      <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px] text-gray-400 font-mono uppercase">
        <div className="flex items-center justify-between border border-scp-gray/30 bg-black/30 px-2 py-1 scp-archive">
          <span>{largestDropLabel}</span>
          <span className="text-scp-accent font-bold">{stats.largestDrop}</span>
        </div>
        <div className="flex items-center justify-between border border-scp-gray/30 bg-black/30 px-2 py-1">
          <span>{largestRecoveryLabel}</span>
          <span className="text-scp-term_fix font-bold">+{stats.largestRecovery}</span>
        </div>
        <div className="flex items-center justify-between border border-scp-gray/30 bg-black/30 px-2 py-1">
          <span>{volatilityLabel}</span>
          <span className="text-white font-bold">{stats.volatility.toFixed(1)}</span>
        </div>
        <div className="flex items-center justify-between border border-scp-gray/30 bg-black/30 px-2 py-1">
          <span>{criticalTurnsLabel}</span>
          <span className="text-white font-bold">{stats.phase.criticalCount}</span>
        </div>
      </div>
    </div>
  );
};

export default DeltaChartSection;
