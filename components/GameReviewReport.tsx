

import React from 'react';
import { GameReviewData, SCPData } from '../types';
import { useTranslation } from '../utils/i18n';
import GameLogo from './GameLogo';

interface GameReviewReportProps {
  data: GameReviewData;
  scpData: SCPData | null;
  stabilityHistory?: number[];
}

const GameReviewReport: React.FC<GameReviewReportProps> = ({ data, scpData, stabilityHistory = [] }) => {
  const { t } = useTranslation();

  const getRankColor = (rank: string) => {
    switch (rank.toUpperCase()) {
      case 'S': return 'text-yellow-400';
      case 'A': return 'text-scp-term';
      case 'B': return 'text-blue-400';
      case 'C': return 'text-gray-400';
      case 'D': return 'text-orange-500';
      case 'F': return 'text-red-600';
      default: return 'text-gray-200';
    }
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'POSITIVE': return 'text-scp-term border-scp-term';
      case 'NEGATIVE': return 'text-red-500 border-red-500';
      default: return 'text-gray-400 border-gray-500';
    }
  };

  // --- Chart Rendering Logic ---
  const renderStabilityChart = () => {
    if (!stabilityHistory || stabilityHistory.length < 2) return null;

    const width = 800;
    const height = 150;
    const maxVal = 100;
    const padding = 10;
    
    // Calculate points
    const points = stabilityHistory.map((val, i) => {
        const x = (i / (stabilityHistory.length - 1)) * width;
        const y = height - (val / maxVal) * (height - padding); 
        return `${x},${y}`;
    }).join(' ');

    // Area path (close the loop for fill)
    const areaPoints = `${points} ${width},${height} 0,${height}`;

    return (
        <div className="relative z-10 mb-8 border border-scp-gray/30 bg-black/40 p-4">
             <h3 className="text-sm text-scp-text font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
               <span className="w-1 h-4 bg-scp-term block"></span>
               {t('report.stability_chart')}
            </h3>
            <div className="w-full overflow-hidden relative">
                <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto drop-shadow-[0_0_5px_rgba(51,255,0,0.3)]">
                     {/* Gradient Defs */}
                     <defs>
                        <linearGradient id="grid-grad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="rgba(51, 255, 0, 0.2)" />
                            <stop offset="100%" stopColor="rgba(51, 255, 0, 0)" />
                        </linearGradient>
                     </defs>

                     {/* Background Grid Lines */}
                     <line x1="0" y1={height * 0.3} x2={width} y2={height * 0.3} stroke="#333" strokeDasharray="4" strokeWidth="1" />
                     <line x1="0" y1={height * 0.7} x2={width} y2={height * 0.7} stroke="#333" strokeDasharray="4" strokeWidth="1" />
                     <line x1="0" y1={height - 1} x2={width} y2={height - 1} stroke="#666" strokeWidth="1" />

                     {/* Area Fill */}
                     <polygon points={areaPoints} fill="url(#grid-grad)" />
                     
                     {/* Main Line */}
                     <polyline points={points} fill="none" stroke="#33ff00" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
                     
                     {/* Data Points */}
                     {stabilityHistory.map((val, i) => {
                         const x = (i / (stabilityHistory.length - 1)) * width;
                         const y = height - (val / maxVal) * (height - padding);
                         // Highlight critical points
                         const isCritical = val < 30;
                         return (
                            <circle 
                                key={i} 
                                cx={x} 
                                cy={y} 
                                r={isCritical ? 4 : 2} 
                                fill={isCritical ? "#c32e2e" : "#33ff00"} 
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

  return (
    <div className="game-review-report w-full max-w-4xl mx-auto border-2 border-scp-gray bg-[#0a0a0a] relative p-6 md:p-12 font-mono text-gray-300 shadow-2xl overflow-hidden mt-8 mb-12">
      {/* Background Watermark */}
      <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none z-0">
         <GameLogo className="w-96 h-96 text-gray-500" />
      </div>

      {/* Header */}
      <div className="relative z-10 border-b-4 border-scp-gray/50 pb-6 mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <GameLogo className="w-8 h-8 text-scp-text" />
            <span className="text-xs tracking-[0.3em] text-scp-gray uppercase">{t('report.dept_analytics')}</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-report text-scp-text tracking-wider text-shadow-sm uppercase">
            {data.operationName}
          </h2>
          <p className="text-sm text-scp-accent font-bold mt-1 tracking-widest">{data.clearanceLevel}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500 mb-1">{t('report.item')}: {scpData?.designation}</p>
          <div className="bg-scp-dark border border-scp-gray px-3 py-1 inline-block">
             <span className="text-xs text-scp-term">{t('report.review_title')}</span>
          </div>
        </div>
      </div>

      {/* Evaluation Grid */}
      <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Rank & Score */}
        <div className="col-span-1 bg-black/40 border border-scp-gray/30 p-4 flex flex-col items-center justify-center relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <span className="text-[10px] text-gray-500 uppercase tracking-widest mb-2">{t('report.perf_eval')}</span>
          <div className={`text-6xl font-report font-bold ${getRankColor(data.evaluation.rank)} mb-2 text-shadow-sm`}>
            {data.evaluation.rank}
          </div>
          <div className="flex items-center gap-2 text-xs">
             <span className="text-gray-400">{t('report.score')}:</span>
             <span className="text-white font-bold">{data.evaluation.score}/100</span>
          </div>
          <div className="mt-4 border-t border-gray-700 w-full pt-2 text-center">
             <span className={`text-xs font-bold uppercase tracking-wider ${getRankColor(data.evaluation.rank)}`}>
               {data.evaluation.verdict}
             </span>
          </div>
        </div>

        {/* Executive Summary */}
        <div className="col-span-1 md:col-span-2 bg-black/40 border border-scp-gray/30 p-5 relative">
          <div className="absolute top-0 right-0 p-1">
             <div className="w-2 h-2 bg-scp-accent rounded-full animate-pulse"></div>
          </div>
          <h3 className="text-sm text-scp-text font-bold uppercase tracking-wider mb-3 border-b border-gray-800 pb-2">
            {t('report.summary')}
          </h3>
          <p className="text-xs md:text-sm leading-relaxed text-gray-300 text-justify">
            {data.summary}
          </p>
        </div>
      </div>

      {/* Stability Chart */}
      {renderStabilityChart()}

      {/* Timeline Analysis */}
      <div className="relative z-10 mb-8">
        <h3 className="text-sm text-scp-text font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
           <span className="w-1 h-4 bg-scp-term block"></span>
           {t('report.key_moments')}
        </h3>
        <div className="space-y-4">
          {data.timelineAnalysis.map((item, idx) => (
            <div key={idx} className="flex gap-4 p-3 border-l-2 border-scp-gray/20 hover:border-scp-term/50 hover:bg-white/5 transition-colors">
               <div className="shrink-0 flex flex-col items-center w-12 pt-1">
                 <span className="text-[10px] text-gray-500 uppercase">{t('report.turn')}</span>
                 <span className="text-lg font-bold text-gray-300">{item.turn}</span>
               </div>
               <div className="flex-1">
                 <div className="flex justify-between items-start mb-1">
                    <p className="text-sm font-bold text-gray-200">{item.event}</p>
                    <span className={`text-[10px] px-2 py-0.5 border rounded uppercase font-bold tracking-wider ml-2 ${getImpactColor(item.impact)}`}>
                        {item.impact === 'POSITIVE' ? t('report.impact_pos') : 
                         item.impact === 'NEGATIVE' ? t('report.impact_neg') : t('report.impact_neu')}
                    </span>
                 </div>
                 <p className="text-xs text-gray-400 italic">
                   "{item.analysis}"
                 </p>
               </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Multi-Perspective Evaluations */}
      {data.perspectiveEvaluations && data.perspectiveEvaluations.length > 0 && (
         <div className="relative z-10 mb-8">
            <h3 className="text-sm text-scp-text font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
               <span className="w-1 h-4 bg-purple-500 block"></span>
               {t('report.perspectives')}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
               {data.perspectiveEvaluations.map((item, idx) => (
                  <div key={idx} className="bg-black/40 border border-scp-gray/30 p-4 flex flex-col">
                     <div className="border-b border-gray-700 pb-2 mb-2 flex justify-between items-end">
                        <span className="text-xs font-bold text-scp-text uppercase">{item.sourceName}</span>
                        <span className="text-[10px] text-gray-400 font-mono border border-gray-600 px-1">{item.stance}</span>
                     </div>
                     <p className="text-xs text-gray-300 italic flex-grow">
                        "{item.comment}"
                     </p>
                  </div>
               ))}
            </div>
         </div>
      )}

      {/* Psych Profile & Strategy */}
      <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-scp-gray/30 pt-8">
         <div>
            <h3 className="text-xs text-gray-500 uppercase tracking-widest mb-3">{t('report.psych_profile')}</h3>
            <p className="text-xs md:text-sm leading-relaxed text-gray-300 p-4 bg-black/20 border-l-2 border-blue-500/50">
               {data.psychProfile}
            </p>
         </div>
         <div>
            <h3 className="text-xs text-gray-500 uppercase tracking-widest mb-3">{t('report.strat_advice')}</h3>
            <p className="text-xs md:text-sm leading-relaxed text-gray-300 p-4 bg-black/20 border-l-2 border-yellow-500/50">
               {data.strategicAdvice}
            </p>
         </div>
      </div>

      {/* Stamp */}
      <div className="absolute bottom-8 right-8 pointer-events-none opacity-80 mix-blend-screen transform -rotate-12 border-4 border-red-800 p-2 rounded">
         <div className="border border-red-800 px-4 py-2">
            <span className="text-2xl font-report text-red-800 font-bold uppercase tracking-widest">
               CONFIDENTIAL
            </span>
         </div>
      </div>
    </div>
  );
};

export default GameReviewReport;