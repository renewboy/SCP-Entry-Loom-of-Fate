import React from 'react';
import type { GameReviewData } from '../../../../types';
import { clamp } from '../../selectors/reviewStats';

interface RiskAssessmentSectionProps {
  riskAssessment: NonNullable<GameReviewData['riskAssessment']>;
  title: string;
  overallLabel: string;
  turnsLabel: string;
  turnLabel: string;
  riskLevelLabel: string;
  betterMoveLabel: string;
}

const RiskAssessmentSection: React.FC<RiskAssessmentSectionProps> = ({
  riskAssessment,
  title,
  overallLabel,
  turnsLabel,
  turnLabel,
  riskLevelLabel,
  betterMoveLabel,
}) => {
  return (
    <div className="relative z-10 mb-8 border border-scp-gray/30 bg-black/40 p-4 scp-archive">
      <h3 className="text-sm text-scp-text font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
        <span className="w-1 h-4 bg-scp-accent block"></span>
        {title}
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border border-scp-gray/30 bg-black/30 p-3 scp-archive">
          <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">{overallLabel}</div>
          <div className="text-2xl font-bold text-white font-mono">{clamp(riskAssessment.overall, 0, 100)}/100</div>
          <div className="text-[10px] text-gray-400 mt-2">{riskAssessment.volatilityComment}</div>
        </div>
        <div className="md:col-span-2 border border-scp-gray/30 bg-black/30 p-3 scp-archive">
          <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-2">{turnsLabel}</div>
          <div className="space-y-2">
            {(riskAssessment.riskByTurn || []).slice(0, 5).map((risk, index) => (
              <div key={index} className="border border-scp-gray/20 bg-black/20 p-2 scp-archive">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[10px] text-gray-400 font-mono">
                    {turnLabel} {risk.turn}
                  </div>
                  <div className="text-[10px] text-scp-accent font-mono">
                    {riskLevelLabel} {clamp(risk.risk, 0, 5)}/5
                  </div>
                </div>
                <div className="mt-1 text-[10px] text-gray-300">{risk.reason}</div>
                <div className="mt-1 text-[10px] text-gray-400">
                  {betterMoveLabel}: {risk.betterMove}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RiskAssessmentSection;
