import React from 'react';
import type { GameReviewData } from '../../../../types';
import { getImpactColorClass } from '../../selectors/reviewStats';

interface TimelineAnalysisSectionProps {
  timelineAnalysis: GameReviewData['timelineAnalysis'];
  title: string;
  turnLabel: string;
  impactPositiveLabel: string;
  impactNegativeLabel: string;
  impactNeutralLabel: string;
}

const TimelineAnalysisSection: React.FC<TimelineAnalysisSectionProps> = ({
  timelineAnalysis,
  title,
  turnLabel,
  impactPositiveLabel,
  impactNegativeLabel,
  impactNeutralLabel,
}) => {
  return (
    <div className="relative z-10 mb-8">
      <h3 className="text-sm text-scp-text font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
        <span className="w-1 h-4 bg-scp-term_fix block"></span>
        {title}
      </h3>
      <div className="space-y-4">
        {timelineAnalysis.map((item, index) => (
          <div key={index} className="flex gap-4 p-3 border-l-2 border-scp-gray/20 hover:border-scp-term_fix/50 hover:bg-white/5 transition-colors">
            <div className="shrink-0 flex flex-col items-center w-12 pt-1">
              <span className="text-[10px] text-gray-500 uppercase">{turnLabel}</span>
              <span className="text-lg font-bold text-gray-300">{item.turn}</span>
            </div>
            <div className="flex-1">
              <div className="flex justify-between items-start mb-1">
                <p className="text-sm font-bold text-gray-200">{item.event}</p>
                <span className={`text-[10px] px-2 py-0.5 border rounded uppercase font-bold tracking-wider ml-2 ${getImpactColorClass(item.impact)}`}>
                  {item.impact === 'POSITIVE'
                    ? impactPositiveLabel
                    : item.impact === 'NEGATIVE'
                      ? impactNegativeLabel
                      : impactNeutralLabel}
                </span>
              </div>
              <p className="text-xs text-gray-400 italic">"{item.analysis}"</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TimelineAnalysisSection;
