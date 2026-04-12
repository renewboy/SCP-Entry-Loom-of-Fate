import React from 'react';
import type { SessionStats } from '../../types';

interface PhaseDistributionSectionProps {
  stats: SessionStats;
  title: string;
  stableLabel: string;
  fluctuatingLabel: string;
  criticalLabel: string;
}

const PhaseDistributionSection: React.FC<PhaseDistributionSectionProps> = ({
  stats,
  title,
  stableLabel,
  fluctuatingLabel,
  criticalLabel,
}) => {
  const { stablePct, fluctuatingPct, criticalPct } = stats.phase;
  const formatPercent = (value: number) => `${Math.round(value * 100)}%`;

  return (
    <div className="relative z-10 mb-8 border border-scp-gray/30 bg-black/40 p-4 scp-archive">
      <h3 className="text-sm text-scp-text font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
        <span className="w-1 h-4 bg-scp-accent block"></span>
        {title}
      </h3>
      <div className="w-full h-4 border border-scp-gray/50 bg-black overflow-hidden flex">
        <div style={{ width: `${stablePct * 100}%` }} className="h-full bg-scp-term_fix" />
        <div style={{ width: `${fluctuatingPct * 100}%` }} className="h-full bg-yellow-500" />
        <div style={{ width: `${criticalPct * 100}%` }} className="h-full bg-scp-accent" />
      </div>
      <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2 text-[10px] text-gray-400 font-mono uppercase">
        <div className="flex items-center justify-between border border-scp-gray/30 bg-black/30 px-2 py-1 scp-archive">
          <span>{stableLabel}</span>
          <span className="text-scp-term_fix font-bold">{formatPercent(stablePct)}</span>
        </div>
        <div className="flex items-center justify-between border border-scp-gray/30 bg-black/30 px-2 py-1 scp-archive">
          <span>{fluctuatingLabel}</span>
          <span className="text-yellow-500 font-bold">{formatPercent(fluctuatingPct)}</span>
        </div>
        <div className="flex items-center justify-between border border-scp-gray/30 bg-black/30 px-2 py-1 scp-archive">
          <span>{criticalLabel}</span>
          <span className="text-scp-accent font-bold">{formatPercent(criticalPct)}</span>
        </div>
      </div>
    </div>
  );
};

export default PhaseDistributionSection;
