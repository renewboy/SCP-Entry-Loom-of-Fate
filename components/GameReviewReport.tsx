import React from 'react';
import { GameReviewData, SCPData } from '../types';
import { useTranslation } from '../utils/i18n';
import GameLogo from './GameLogo';

interface GameReviewReportProps {
  data: GameReviewData;
  scpData: SCPData | null;
  stabilityHistory?: number[];
}

// Shared Helper for Rank Colors
const getRankColorClass = (rank: string) => {
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

// Shared Helper for Impact Colors
const getImpactColorClass = (impact: string) => {
  switch (impact) {
    case 'POSITIVE': return 'text-scp-term border-scp-term';
    case 'NEGATIVE': return 'text-red-500 border-red-500';
    default: return 'text-gray-400 border-gray-500';
  }
};

const GameReviewReport: React.FC<GameReviewReportProps> = ({ data, scpData, stabilityHistory = [] }) => {
  const { t } = useTranslation();

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
          <div className={`text-6xl font-report font-bold ${getRankColorClass(data.evaluation.rank)} mb-2 text-shadow-sm`}>
            {data.evaluation.rank}
          </div>
          <div className="flex items-center gap-2 text-xs">
             <span className="text-gray-400">{t('report.score')}:</span>
             <span className="text-white font-bold">{data.evaluation.score}/100</span>
          </div>
          <div className="mt-4 border-t border-gray-700 w-full pt-2 text-center">
             <span className={`text-xs font-bold uppercase tracking-wider ${getRankColorClass(data.evaluation.rank)}`}>
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
                    <span className={`text-[10px] px-2 py-0.5 border rounded uppercase font-bold tracking-wider ml-2 ${getImpactColorClass(item.impact)}`}>
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

// ==========================================
// EXPORT: HTML GENERATOR FOR PDF
// ==========================================
export const generateGameReviewHtml = (
  data: GameReviewData, 
  scpData: SCPData | null, 
  stabilityHistory: number[], 
  t: (key: string, params?: any) => string
) => {
    // Logo Paths (Duplicated from GameLogo.tsx for static generation)
    const center = "67.7 71.5";
    const arrowPath = "m64.7 30.6v24h-5.08l8.08 14 8.08-14h-5.08l-.000265-24h-5.99";
    const shieldPath = "m51.9 11.9h31.7l3.07 11.4.944.391c19.4 8.03 32 26.9 32 47.9 0 2.26-.149 4.53-.445 6.77l-.133 1.01 8.37 8.37-15.8 27.4-11.4-3.06-.809.623c-9.06 6.95-20.2 10.7-31.6 10.7-11.4 6e-5-22.5-3.77-31.6-10.7l-.81-.623-11.4 3.06-15.8-27.4 8.37-8.37-.133-1.01c-.296-2.25-.445-4.51-.445-6.77.000141-21 12.6-39.9 32-47.9l.944-.391z";

    // Chart HTML Generation
    let chartHtml = '';
    if (stabilityHistory && stabilityHistory.length >= 2) {
        const width = 800;
        const height = 150;
        const maxVal = 100;
        const padding = 10;
        
        const points = stabilityHistory.map((val, i) => {
            const x = (i / (stabilityHistory.length - 1)) * width;
            const y = height - (val / maxVal) * (height - padding); 
            return `${x},${y}`;
        }).join(' ');

        const areaPoints = `${points} ${width},${height} 0,${height}`;
        
        const circlesHtml = stabilityHistory.map((val, i) => {
             const x = (i / (stabilityHistory.length - 1)) * width;
             const y = height - (val / maxVal) * (height - padding);
             const isCritical = val < 30;
             const fill = isCritical ? "#c32e2e" : "#33ff00";
             const r = isCritical ? 4 : 2;
             return `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="#000" stroke-width="1" />`;
        }).join('');

        chartHtml = `
            <div class="relative z-10 mb-8 border border-scp-gray/30 bg-black/40 p-4">
                 <h3 class="text-sm text-scp-text font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
                   <span class="w-1 h-4 bg-scp-term block"></span>
                   ${t('report.stability_chart')}
                </h3>
                <div class="w-full overflow-hidden relative">
                    <svg viewBox="0 0 ${width} ${height}" class="w-full h-auto drop-shadow-[0_0_5px_rgba(51,255,0,0.3)]">
                         <defs>
                            <linearGradient id="grid-grad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stop-color="rgba(51, 255, 0, 0.2)" />
                                <stop offset="100%" stop-color="rgba(51, 255, 0, 0)" />
                            </linearGradient>
                         </defs>
                         <line x1="0" y1="${height * 0.3}" x2="${width}" y2="${height * 0.3}" stroke="#333" stroke-dasharray="4" stroke-width="1" />
                         <line x1="0" y1="${height * 0.7}" x2="${width}" y2="${height * 0.7}" stroke="#333" stroke-dasharray="4" stroke-width="1" />
                         <line x1="0" y1="${height - 1}" x2="${width}" y2="${height - 1}" stroke="#666" stroke-width="1" />
                         <polygon points="${areaPoints}" fill="url(#grid-grad)" />
                         <polyline points="${points}" fill="none" stroke="#33ff00" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round" />
                         ${circlesHtml}
                    </svg>
                </div>
                 <div class="flex justify-between text-[10px] text-scp-gray font-mono mt-2 uppercase">
                    <span>START (100%)</span>
                    <span>TIME</span>
                    <span>END ({stabilityHistory[stabilityHistory.length - 1]}%)</span>
                </div>
            </div>
        `;
    }

    // Timeline Rows Generation
    const timelineHtml = data.timelineAnalysis.map(item => `
        <div class="flex gap-4 p-3 border-l-2 border-scp-gray/20">
           <div class="shrink-0 flex flex-col items-center w-12 pt-1">
             <span class="text-[10px] text-gray-500 uppercase">${t('report.turn')}</span>
             <span class="text-lg font-bold text-gray-300">${item.turn}</span>
           </div>
           <div class="flex-1">
             <div class="flex justify-between items-start mb-1">
                <p class="text-sm font-bold text-gray-200">${item.event}</p>
                <span class="text-[10px] px-2 py-0.5 border rounded uppercase font-bold tracking-wider ml-2 ${getImpactColorClass(item.impact)}">
                    ${item.impact === 'POSITIVE' ? t('report.impact_pos') : 
                     item.impact === 'NEGATIVE' ? t('report.impact_neg') : t('report.impact_neu')}
                </span>
             </div>
             <p class="text-xs text-gray-400 italic">"${item.analysis}"</p>
           </div>
        </div>
    `).join('');

    // Perspectives Generation
    let perspectivesHtml = '';
    if (data.perspectiveEvaluations && data.perspectiveEvaluations.length > 0) {
        const itemsHtml = data.perspectiveEvaluations.map(item => `
            <div class="bg-black/40 border border-scp-gray/30 p-4 flex flex-col">
                 <div class="border-b border-gray-700 pb-2 mb-2 flex justify-between items-end">
                    <span class="text-xs font-bold text-scp-text uppercase">${item.sourceName}</span>
                    <span class="text-[10px] text-gray-400 font-mono border border-gray-600 px-1">${item.stance}</span>
                 </div>
                 <p class="text-xs text-gray-300 italic flex-grow">"${item.comment}"</p>
            </div>
        `).join('');
        
        perspectivesHtml = `
            <div class="relative z-10 mb-8 break-inside-avoid">
                <h3 class="text-sm text-scp-text font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
                   <span class="w-1 h-4 bg-purple-500 block"></span>
                   ${t('report.perspectives')}
                </h3>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    ${itemsHtml}
                </div>
            </div>
        `;
    }

    // Full Report HTML Construction
    return `
    <div class="game-review-report w-full border-2 border-scp-gray bg-[#0a0a0a] relative p-8 font-mono text-gray-300 overflow-hidden mt-10 break-before-page">
      <!-- Background Watermark -->
      <div class="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none z-0">
         <svg viewBox="0 0 135 135" class="w-96 h-96 text-gray-500" xmlns="http://www.w3.org/2000/svg">
            <circle cx="67.7" cy="71.5" r="33" fill="none" stroke="currentColor" stroke-width="6" />
            <path d="${shieldPath}" fill="none" stroke="currentColor" stroke-width="4" />
            <g fill="currentColor" stroke="none">
                <path d="${arrowPath}" />
                <path d="${arrowPath}" transform="rotate(120 ${center})" />
                <path d="${arrowPath}" transform="rotate(240 ${center})" />
            </g>
         </svg>
      </div>

      <!-- Header -->
      <div class="relative z-10 border-b-4 border-scp-gray/50 pb-6 mb-8 flex justify-between items-end gap-4">
        <div>
          <div class="flex items-center gap-3 mb-2">
            <!-- Mini Logo -->
            <svg viewBox="0 0 135 135" class="w-8 h-8 text-scp-text" xmlns="http://www.w3.org/2000/svg">
                <circle cx="67.7" cy="71.5" r="33" fill="none" stroke="currentColor" stroke-width="6" />
                <path d="${shieldPath}" fill="none" stroke="currentColor" stroke-width="4" />
                <g fill="currentColor" stroke="none">
                    <path d="${arrowPath}" />
                    <path d="${arrowPath}" transform="rotate(120 ${center})" />
                    <path d="${arrowPath}" transform="rotate(240 ${center})" />
                </g>
            </svg>
            <span class="text-xs tracking-[0.3em] text-scp-gray uppercase">${t('report.dept_analytics')}</span>
          </div>
          <h2 class="text-4xl font-report text-scp-text tracking-wider text-shadow-sm uppercase">
            ${data.operationName}
          </h2>
          <p class="text-sm text-scp-accent font-bold mt-1 tracking-widest">${data.clearanceLevel}</p>
        </div>
        <div class="text-right">
          <p class="text-xs text-gray-500 mb-1">${t('report.item')}: ${scpData?.designation}</p>
          <div class="bg-scp-dark border border-scp-gray px-3 py-1 inline-block">
             <span class="text-xs text-scp-term">${t('report.review_title')}</span>
          </div>
        </div>
      </div>

      <!-- Evaluation Grid -->
      <div class="relative z-10 grid grid-cols-3 gap-6 mb-8">
        <!-- Rank & Score -->
        <div class="col-span-1 bg-black/40 border border-scp-gray/30 p-4 flex flex-col items-center justify-center relative overflow-hidden">
          <span class="text-[10px] text-gray-500 uppercase tracking-widest mb-2">${t('report.perf_eval')}</span>
          <div class="text-6xl font-report font-bold ${getRankColorClass(data.evaluation.rank)} mb-2 text-shadow-sm">
            ${data.evaluation.rank}
          </div>
          <div class="flex items-center gap-2 text-xs">
             <span class="text-gray-400">${t('report.score')}:</span>
             <span class="text-white font-bold">${data.evaluation.score}/100</span>
          </div>
          <div class="mt-4 border-t border-gray-700 w-full pt-2 text-center">
             <span class="text-xs font-bold uppercase tracking-wider ${getRankColorClass(data.evaluation.rank)}">
               ${data.evaluation.verdict}
             </span>
          </div>
        </div>

        <!-- Executive Summary -->
        <div class="col-span-2 bg-black/40 border border-scp-gray/30 p-5 relative">
          <h3 class="text-sm text-scp-text font-bold uppercase tracking-wider mb-3 border-b border-gray-800 pb-2">
            ${t('report.summary')}
          </h3>
          <p class="text-sm leading-relaxed text-gray-300 text-justify">
            ${data.summary}
          </p>
        </div>
      </div>

      ${chartHtml}

      <!-- Timeline Analysis -->
      <div class="relative z-10 mb-8 break-inside-avoid">
        <h3 class="text-sm text-scp-text font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
           <span class="w-1 h-4 bg-scp-term block"></span>
           ${t('report.key_moments')}
        </h3>
        <div class="space-y-4">
          ${timelineHtml}
        </div>
      </div>
      
      ${perspectivesHtml}

      <!-- Psych Profile & Strategy -->
      <div class="relative z-10 grid grid-cols-2 gap-8 border-t border-scp-gray/30 pt-8 break-inside-avoid">
         <div>
            <h3 class="text-xs text-gray-500 uppercase tracking-widest mb-3">${t('report.psych_profile')}</h3>
            <p class="text-sm leading-relaxed text-gray-300 p-4 bg-black/20 border-l-2 border-blue-500/50">
               ${data.psychProfile}
            </p>
         </div>
         <div>
            <h3 class="text-xs text-gray-500 uppercase tracking-widest mb-3">${t('report.strat_advice')}</h3>
            <p class="text-sm leading-relaxed text-gray-300 p-4 bg-black/20 border-l-2 border-yellow-500/50">
               ${data.strategicAdvice}
            </p>
         </div>
      </div>

      <!-- Footer Stamp -->
      <div class="absolute bottom-8 right-8 pointer-events-none opacity-80 mix-blend-screen transform -rotate-12 border-4 border-red-800 p-2 rounded">
         <div class="border border-red-800 px-4 py-2">
            <span class="text-2xl font-report text-red-800 font-bold uppercase tracking-widest">
               CONFIDENTIAL
            </span>
         </div>
      </div>
    </div>
    `;
};

export default GameReviewReport;