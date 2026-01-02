
import React, { useState } from 'react';
import { GameReviewData, Message, SCPData } from '../types';
import { useTranslation } from '../utils/i18n';
import GameLogo from './GameLogo';

import { generateAudioDramaScript } from '../services/geminiService';
import { AudioDramaScript } from '../types';

interface GameReviewReportProps {
  data: GameReviewData;
  scpData: SCPData | null;
  stabilityHistory?: number[];
  messages?: Message[];
  role?: string;
  backgroundImage?: string | null;
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

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const computeSessionStats = (messages: Message[] = [], stabilityHistory: number[] = []) => {
  const stability = (stabilityHistory.length > 0 ? stabilityHistory : [100]).map(v => clamp(v, 0, 100));
  const deltas = stability.length >= 2 ? stability.slice(1).map((v, i) => v - stability[i]) : [];
  const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
  const avg = (arr: number[]) => (arr.length ? sum(arr) / arr.length : 0);
  const variance = (arr: number[]) => {
    if (arr.length < 2) return 0;
    const m = avg(arr);
    return avg(arr.map(v => (v - m) ** 2));
  };

  const stabilityMin = stability.reduce((m, v) => Math.min(m, v), stability[0] ?? 100);
  const stabilityMax = stability.reduce((m, v) => Math.max(m, v), stability[0] ?? 100);
  const stabilityAvg = avg(stability);
  const largestDrop = deltas.length ? Math.min(...deltas) : 0;
  const largestRecovery = deltas.length ? Math.max(...deltas) : 0;
  const volatility = Math.sqrt(variance(deltas));

  let stableCount = 0;
  let fluctuatingCount = 0;
  let criticalCount = 0;
  stability.forEach(v => {
    if (v > 70) stableCount += 1;
    else if (v > 30) fluctuatingCount += 1;
    else criticalCount += 1;
  });
  const totalPhase = stableCount + fluctuatingCount + criticalCount;
  const stablePct = totalPhase ? stableCount / totalPhase : 0;
  const fluctuatingPct = totalPhase ? fluctuatingCount / totalPhase : 0;
  const criticalPct = totalPhase ? criticalCount / totalPhase : 0;

  const narratorTurns: {
    turnIndex: number;
    userText: string;
    narratorText: string;
    userChars: number;
    narratorChars: number;
    hasVisual: boolean;
  }[] = [];

  for (let i = 0; i < messages.length; i += 1) {
    const msg = messages[i];
    if (msg.sender !== 'narrator') continue;
    const prev = messages[i - 1];
    const userText = prev?.sender === 'user' ? prev.content : '';
    const narratorText = msg.content;
    narratorTurns.push({
      turnIndex: narratorTurns.length,
      userText,
      narratorText,
      userChars: userText.length,
      narratorChars: narratorText.length,
      hasVisual: Boolean(msg.imageUrl)
    });
  }

  const userMessages = messages.filter(m => m.sender === 'user');
  const narratorMessages = messages.filter(m => m.sender === 'narrator');

  const userTotalChars = sum(userMessages.map(m => m.content.length));
  const narratorTotalChars = sum(narratorMessages.map(m => m.content.length));
  const visualsCount = narratorMessages.filter(m => Boolean(m.imageUrl)).length;

  const userCharsPerTurn = narratorTurns.map(t => t.userChars).filter((_, idx) => idx !== 0);
  const narratorCharsPerTurn = narratorTurns.map(t => t.narratorChars).filter((_, idx) => idx !== 0);

  return {
    stability,
    deltas,
    stabilityMin,
    stabilityMax,
    stabilityAvg,
    largestDrop,
    largestRecovery,
    volatility,
    phase: {
      stablePct,
      fluctuatingPct,
      criticalPct,
      stableCount,
      fluctuatingCount,
      criticalCount
    },
    engagement: {
      turns: Math.max(0, narratorTurns.length - 1),
      userMessages: userMessages.length,
      narratorMessages: narratorMessages.length,
      userTotalChars,
      narratorTotalChars,
      visualsCount,
      avgUserCharsPerTurn: avg(userCharsPerTurn),
      avgNarratorCharsPerTurn: avg(narratorCharsPerTurn),
      userCharsPerTurn,
      narratorCharsPerTurn
    }
  };
};

import AudioDramaPlayer from './game/AudioDramaPlayer';
import DebugAudioPlayer from './game/DebugAudioPlayer';

const GameReviewReport: React.FC<GameReviewReportProps> = ({ data, scpData, stabilityHistory = [], messages = [], role = "Unknown", backgroundImage }) => {
  const { t, language } = useTranslation();

  const [script, setScript] = useState<AudioDramaScript | null>(null);
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [scriptCopied, setScriptCopied] = useState(false);
  const [isPlayingDrama, setIsPlayingDrama] = useState(false);
  const [isDebugOpen, setIsDebugOpen] = useState(true); // Default open for debug

  const stats = computeSessionStats(messages, stabilityHistory);

  const handleGenerateScript = async () => {
    if (isGeneratingScript) return;
    setIsGeneratingScript(true);
    try {
        const result = await generateAudioDramaScript(
            messages, 
            role, 
            scpData?.designation || "Unknown SCP",
            language
        );
        console.log("Generated Script JSON:", result);
        setScript(result);
    } catch (e) {
        console.error(e);
    } finally {
        setIsGeneratingScript(false);
    }
  };

  const handleCopyScript = () => {
      if (script) {
          // Serialize JSON for clipboard
          navigator.clipboard.writeText(JSON.stringify(script, null, 2));
          setScriptCopied(true);
          setTimeout(() => setScriptCopied(false), 2000);
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

  const renderPhaseDistribution = () => {
    const { stablePct, fluctuatingPct, criticalPct } = stats.phase;
    const fmt = (v: number) => `${Math.round(v * 100)}%`;
    return (
      <div className="relative z-10 mb-8 border border-scp-gray/30 bg-black/40 p-4">
        <h3 className="text-sm text-scp-text font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
          <span className="w-1 h-4 bg-scp-accent block"></span>
          {t('report.phase_dist')}
        </h3>
        <div className="w-full h-4 border border-scp-gray/50 bg-black overflow-hidden flex">
          <div style={{ width: `${stablePct * 100}%` }} className="h-full bg-scp-term" />
          <div style={{ width: `${fluctuatingPct * 100}%` }} className="h-full bg-yellow-500" />
          <div style={{ width: `${criticalPct * 100}%` }} className="h-full bg-scp-accent" />
        </div>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2 text-[10px] text-gray-400 font-mono uppercase">
          <div className="flex items-center justify-between border border-scp-gray/30 bg-black/30 px-2 py-1">
            <span>{t('report.phase_stable')}</span>
            <span className="text-scp-term font-bold">{fmt(stablePct)}</span>
          </div>
          <div className="flex items-center justify-between border border-scp-gray/30 bg-black/30 px-2 py-1">
            <span>{t('report.phase_fluct')}</span>
            <span className="text-yellow-500 font-bold">{fmt(fluctuatingPct)}</span>
          </div>
          <div className="flex items-center justify-between border border-scp-gray/30 bg-black/30 px-2 py-1">
            <span>{t('report.phase_critical')}</span>
            <span className="text-scp-accent font-bold">{fmt(criticalPct)}</span>
          </div>
        </div>
      </div>
    );
  };

  const renderDeltaChart = () => {
    if (!stats.deltas.length) return null;
    const deltas = stats.deltas;
    const width = 800;
    const height = 170;
    const padding = 10;
    const baseline = height / 2;
    const maxAbs = Math.max(5, ...deltas.map(d => Math.abs(d)));
    const barWidth = width / deltas.length;

    return (
      <div className="relative z-10 mb-8 border border-scp-gray/30 bg-black/40 p-4">
        <h3 className="text-sm text-scp-text font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
          <span className="w-1 h-4 bg-scp-term block"></span>
          {t('report.delta_chart')}
        </h3>
        <div className="w-full overflow-hidden relative">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
            <line x1="0" y1={baseline} x2={width} y2={baseline} stroke="#444" strokeWidth="1" />
            {deltas.map((d, i) => {
              const x = i * barWidth + 1;
              const h = (Math.abs(d) / maxAbs) * (baseline - padding);
              const y = d >= 0 ? baseline - h : baseline;
              const fill = d >= 0 ? '#33ff00' : '#c32e2e';
              return (
                <rect
                  key={i}
                  x={x}
                  y={y}
                  width={Math.max(1, barWidth - 2)}
                  height={Math.max(1, h)}
                  fill={fill}
                  opacity={0.8}
                />
              );
            })}
          </svg>
        </div>
        <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px] text-gray-400 font-mono uppercase">
          <div className="flex items-center justify-between border border-scp-gray/30 bg-black/30 px-2 py-1">
            <span>{t('report.largest_drop')}</span>
            <span className="text-scp-accent font-bold">{stats.largestDrop}</span>
          </div>
          <div className="flex items-center justify-between border border-scp-gray/30 bg-black/30 px-2 py-1">
            <span>{t('report.largest_recovery')}</span>
            <span className="text-scp-term font-bold">+{stats.largestRecovery}</span>
          </div>
          <div className="flex items-center justify-between border border-scp-gray/30 bg-black/30 px-2 py-1">
            <span>{t('report.volatility')}</span>
            <span className="text-white font-bold">{stats.volatility.toFixed(1)}</span>
          </div>
          <div className="flex items-center justify-between border border-scp-gray/30 bg-black/30 px-2 py-1">
            <span>{t('report.critical_turns')}</span>
            <span className="text-white font-bold">{stats.phase.criticalCount}</span>
          </div>
        </div>
      </div>
    );
  };

  const renderEngagementChart = () => {
    const values = stats.engagement.userCharsPerTurn;
    if (!values.length) return null;
    const width = 800;
    const height = 140;
    const maxVal = Math.max(1, ...values);
    const barWidth = width / values.length;

    return (
      <div className="relative z-10 mb-8 border border-scp-gray/30 bg-black/40 p-4">
        <h3 className="text-sm text-scp-text font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
          <span className="w-1 h-4 bg-blue-500 block"></span>
          {t('report.engagement_chart')}
        </h3>
        <div className="w-full overflow-hidden relative">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
            {values.map((v, i) => {
              const x = i * barWidth + 1;
              const h = (v / maxVal) * (height - 10);
              const y = height - h;
              return (
                <rect
                  key={i}
                  x={x}
                  y={y}
                  width={Math.max(1, barWidth - 2)}
                  height={Math.max(1, h)}
                  fill="#60a5fa"
                  opacity={0.75}
                />
              );
            })}
          </svg>
        </div>
        <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px] text-gray-400 font-mono uppercase">
          <div className="flex items-center justify-between border border-scp-gray/30 bg-black/30 px-2 py-1">
            <span>{t('report.turns')}</span>
            <span className="text-white font-bold">{stats.engagement.turns}</span>
          </div>
          <div className="flex items-center justify-between border border-scp-gray/30 bg-black/30 px-2 py-1">
            <span>{t('report.avg_user_len')}</span>
            <span className="text-white font-bold">{Math.round(stats.engagement.avgUserCharsPerTurn)}</span>
          </div>
          <div className="flex items-center justify-between border border-scp-gray/30 bg-black/30 px-2 py-1">
            <span>{t('report.avg_narr_len')}</span>
            <span className="text-white font-bold">{Math.round(stats.engagement.avgNarratorCharsPerTurn)}</span>
          </div>
          <div className="flex items-center justify-between border border-scp-gray/30 bg-black/30 px-2 py-1">
            <span>{t('report.visuals')}</span>
            <span className="text-white font-bold">{stats.engagement.visualsCount}</span>
          </div>
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

      {renderPhaseDistribution()}

      {renderDeltaChart()}

      {renderEngagementChart()}

      {/* Objective Breakdown */}
      {data.objectiveBreakdown && data.objectiveBreakdown.length > 0 && (
        <div className="relative z-10 mb-8 border border-scp-gray/30 bg-black/40 p-4">
          <h3 className="text-sm text-scp-text font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
            <span className="w-1 h-4 bg-scp-term block"></span>
            {t('report.objectives')}
          </h3>
          <div className="space-y-3">
            {data.objectiveBreakdown.map((o, idx) => (
              <div key={idx} className="border border-scp-gray/30 bg-black/30 p-3">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="text-xs text-gray-200 font-bold">{o.objective}</div>
                  <div className="text-[10px] text-gray-400 font-mono">{clamp(o.completion, 0, 100)}%</div>
                </div>
                <div className="w-full h-2 border border-scp-gray/50 bg-black overflow-hidden">
                  <div style={{ width: `${clamp(o.completion, 0, 100)}%` }} className="h-full bg-scp-term" />
                </div>
                <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px] text-gray-400">
                  <div className="border border-scp-gray/20 bg-black/20 p-2">
                    <span className="text-gray-500 uppercase tracking-widest">{t('report.evidence')}</span>
                    <div className="mt-1 text-gray-300">{o.evidence}</div>
                  </div>
                  <div className="border border-scp-gray/20 bg-black/20 p-2">
                    <span className="text-gray-500 uppercase tracking-widest">{t('report.missed')}</span>
                    <div className="mt-1 text-gray-300">{o.missedOpportunity}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Risk Assessment */}
      {data.riskAssessment && (
        <div className="relative z-10 mb-8 border border-scp-gray/30 bg-black/40 p-4">
          <h3 className="text-sm text-scp-text font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
            <span className="w-1 h-4 bg-scp-accent block"></span>
            {t('report.risk')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border border-scp-gray/30 bg-black/30 p-3">
              <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">{t('report.risk_overall')}</div>
              <div className="text-2xl font-bold text-white font-mono">{clamp(data.riskAssessment.overall, 0, 100)}/100</div>
              <div className="text-[10px] text-gray-400 mt-2">{data.riskAssessment.volatilityComment}</div>
            </div>
            <div className="md:col-span-2 border border-scp-gray/30 bg-black/30 p-3">
              <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-2">{t('report.risk_turns')}</div>
              <div className="space-y-2">
                {(data.riskAssessment.riskByTurn || []).slice(0, 5).map((r, idx) => (
                  <div key={idx} className="border border-scp-gray/20 bg-black/20 p-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[10px] text-gray-400 font-mono">{t('report.turn')} {r.turn}</div>
                      <div className="text-[10px] text-scp-accent font-mono">{t('report.risk_level')} {clamp(r.risk, 0, 5)}/5</div>
                    </div>
                    <div className="mt-1 text-[10px] text-gray-300">{r.reason}</div>
                    <div className="mt-1 text-[10px] text-gray-400">{t('report.better_move')}: {r.betterMove}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tactics Matrix */}
      {data.tacticsMatrix && data.tacticsMatrix.length > 0 && (
        <div className="relative z-10 mb-8 border border-scp-gray/30 bg-black/40 p-4">
          <h3 className="text-sm text-scp-text font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
            <span className="w-1 h-4 bg-purple-500 block"></span>
            {t('report.tactics')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {data.tacticsMatrix.map((item, idx) => (
              <div key={idx} className="border border-scp-gray/30 bg-black/30 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-bold text-gray-200">{item.tactic}</div>
                  <div className="text-[10px] text-gray-400 font-mono">x{item.count} / {item.effectiveness}</div>
                </div>
                <div className="mt-2 text-[10px] text-gray-400">{item.note}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Counterfactuals */}
      {data.counterfactuals && data.counterfactuals.length > 0 && (
        <div className="relative z-10 mb-8 border border-scp-gray/30 bg-black/40 p-4">
          <h3 className="text-sm text-scp-text font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
            <span className="w-1 h-4 bg-yellow-500 block"></span>
            {t('report.counterfactuals')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.counterfactuals.slice(0, 4).map((c, idx) => (
              <div key={idx} className="border border-scp-gray/30 bg-black/30 p-4">
                <div className="text-xs font-bold text-gray-200 mb-2">{c.title}</div>
                <div className="text-[10px] text-gray-400 mb-2">{t('report.change')}: {c.change}</div>
                <div className="text-[10px] text-gray-300 mb-2">{t('report.expected')}: {c.expectedOutcome}</div>
                <div className="text-[10px] text-gray-400">{t('report.tradeoff')}: {c.tradeoff}</div>
              </div>
            ))}
          </div>
        </div>
      )}


      {/* Achievements/Titles */}
      {data.achievements && data.achievements.length > 0 && (
         <div className="relative z-10 mb-8">
            <h3 className="text-sm text-scp-text font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
               <span className="w-1 h-4 bg-yellow-500 block"></span>
               {t('report.achievements')}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
               {data.achievements.map((item, idx) => (
                  <div key={idx} className="bg-black/60 border border-yellow-900/50 p-4 rounded-sm flex items-start gap-3 hover:border-yellow-500 transition-colors group">
                     <div>
                        <p className="text-xs font-bold text-yellow-500 uppercase mb-1">{item.title}</p>
                        <p className="text-[10px] text-gray-400 leading-tight">{item.description}</p>
                     </div>
                  </div>
               ))}
            </div>
         </div>
      )}

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
      <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-scp-gray/30 pt-8 mb-12">
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

      {isDebugOpen && (
          <DebugAudioPlayer 
            onClose={() => setIsDebugOpen(false)}
            messages={messages}
            fallbackImage={backgroundImage}
          />
      )}

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
