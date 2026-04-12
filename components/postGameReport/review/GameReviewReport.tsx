import React from 'react';
import type { GameReviewData, Message, NarrativeQuality, SCPData } from '../../../types';
import GameLogo from '../../GameLogo';
import {
  clamp,
  computeSessionStats,
  getRankColorClass,
} from '../selectors/reviewStats';
import type { TranslateFn } from '../types';
import DeltaChartSection from './sections/DeltaChartSection';
import EngagementChartSection from './sections/EngagementChartSection';
import NarrativeQualitySection from './sections/NarrativeQualitySection';
import PhaseDistributionSection from './sections/PhaseDistributionSection';
import RiskAssessmentSection from './sections/RiskAssessmentSection';
import StabilityChartSection from './sections/StabilityChartSection';
import TimelineAnalysisSection from './sections/TimelineAnalysisSection';

interface GameReviewReportProps {
  data: GameReviewData;
  scpData: SCPData | null;
  stabilityHistory?: number[];
  messages?: Message[];
  t: TranslateFn;
}

const GameReviewReport: React.FC<GameReviewReportProps> = ({
  data,
  scpData,
  stabilityHistory = [],
  messages = [],
  t,
}) => {
  const stats = computeSessionStats(messages, stabilityHistory);

  const narrativeDimensions: Array<{ key: keyof Omit<NarrativeQuality, 'comment'>; label: string }> = [
    { key: 'worldConsistency', label: t('report.nq_world_consistency') },
    { key: 'imagery', label: t('report.nq_imagery') },
    { key: 'npcDepth', label: t('report.nq_npc_depth') },
    { key: 'pacing', label: t('report.nq_pacing') },
    { key: 'interactivity', label: t('report.nq_interactivity') },
    { key: 'equivalentExchange', label: t('report.nq_equivalent_exchange') },
  ];

  return (
    <div className="game-review-report w-full max-w-4xl mx-auto border-2 border-scp-gray bg-[#0a0a0a] relative p-6 md:p-12 font-mono text-gray-300 shadow-2xl overflow-hidden mt-8 mb-12 scp-archive scp-ui">
      <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none z-0">
        <GameLogo className="w-96 h-96 text-gray-500" />
      </div>

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
          <p className="text-xs text-gray-500 mb-1">
            {t('report.item')}: {scpData?.designation}
          </p>
          <div className="bg-scp-dark border border-scp-gray px-3 py-1 inline-block">
            <span className="text-xs text-scp-term_fix">{t('report.review_title')}</span>
          </div>
        </div>
      </div>

      <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="col-span-1 bg-black/40 border border-scp-gray/30 p-4 flex flex-col items-center justify-center relative overflow-hidden group scp-archive">
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

        <div className="col-span-1 md:col-span-2 bg-black/40 border border-scp-gray/30 p-5 relative scp-archive">
          <div className="absolute top-0 right-0 p-1">
            <div className="w-2 h-2 bg-scp-accent rounded-full animate-pulse"></div>
          </div>
          <h3 className="text-sm text-scp-text font-bold uppercase tracking-wider mb-3 border-b border-gray-800 pb-2">
            {t('report.summary')}
          </h3>
          <p className="text-xs md:text-sm leading-relaxed text-gray-300 text-justify">{data.summary}</p>
        </div>
      </div>

      <StabilityChartSection stabilityHistory={stabilityHistory} title={t('report.stability_chart')} />
      <PhaseDistributionSection
        stats={stats}
        title={t('report.phase_dist')}
        stableLabel={t('report.phase_stable')}
        fluctuatingLabel={t('report.phase_fluct')}
        criticalLabel={t('report.phase_critical')}
      />
      <DeltaChartSection
        stats={stats}
        title={t('report.delta_chart')}
        largestDropLabel={t('report.largest_drop')}
        largestRecoveryLabel={t('report.largest_recovery')}
        volatilityLabel={t('report.volatility')}
        criticalTurnsLabel={t('report.critical_turns')}
      />
      <EngagementChartSection
        stats={stats}
        title={t('report.engagement_chart')}
        turnsLabel={t('report.turns')}
        avgUserLabel={t('report.avg_user_len')}
        avgNarratorLabel={t('report.avg_narr_len')}
        visualsLabel={t('report.visuals')}
      />

      {data.objectiveBreakdown && data.objectiveBreakdown.length > 0 && (
        <div className="relative z-10 mb-8 border border-scp-gray/30 bg-black/40 p-4 scp-archive">
          <h3 className="text-sm text-scp-text font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
            <span className="w-1 h-4 bg-scp-term_fix block"></span>
            {t('report.objectives')}
          </h3>
          <div className="space-y-3">
            {data.objectiveBreakdown.map((objective, index) => (
              <div key={index} className="border border-scp-gray/30 bg-black/30 p-3 scp-archive">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="text-xs text-gray-200 font-bold">{objective.objective}</div>
                  <div className="text-[10px] text-gray-400 font-mono">{clamp(objective.completion, 0, 100)}%</div>
                </div>
                <div className="w-full h-2 border border-scp-gray/50 bg-black overflow-hidden">
                  <div style={{ width: `${clamp(objective.completion, 0, 100)}%` }} className="h-full bg-scp-term_fix" />
                </div>
                <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px] text-gray-400">
                  <div className="border border-scp-gray/20 bg-black/20 p-2">
                    <span className="text-gray-500 uppercase tracking-widest">{t('report.evidence')}</span>
                    <div className="mt-1 text-gray-300">{objective.evidence}</div>
                  </div>
                  <div className="border border-scp-gray/20 bg-black/20 p-2">
                    <span className="text-gray-500 uppercase tracking-widest">{t('report.missed')}</span>
                    <div className="mt-1 text-gray-300">{objective.missedOpportunity}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.riskAssessment && (
        <RiskAssessmentSection
          riskAssessment={data.riskAssessment}
          title={t('report.risk')}
          overallLabel={t('report.risk_overall')}
          turnsLabel={t('report.risk_turns')}
          turnLabel={t('report.turn')}
          riskLevelLabel={t('report.risk_level')}
          betterMoveLabel={t('report.better_move')}
        />
      )}

      {data.tacticsMatrix && data.tacticsMatrix.length > 0 && (
        <div className="relative z-10 mb-8 border border-scp-gray/30 bg-black/40 p-4 scp-archive">
          <h3 className="text-sm text-scp-text font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
            <span className="w-1 h-4 bg-purple-500 block"></span>
            {t('report.tactics')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {data.tacticsMatrix.map((item, index) => (
              <div key={index} className="border border-scp-gray/30 bg-black/30 p-3 scp-archive">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-bold text-gray-200">{item.tactic}</div>
                  <div className="text-[10px] text-gray-400 font-mono">
                    x{item.count} / {item.effectiveness}
                  </div>
                </div>
                <div className="mt-2 text-[10px] text-gray-400">{item.note}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.counterfactuals && data.counterfactuals.length > 0 && (
        <div className="relative z-10 mb-8 border border-scp-gray/30 bg-black/40 p-4 scp-archive">
          <h3 className="text-sm text-scp-text font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
            <span className="w-1 h-4 bg-yellow-500 block"></span>
            {t('report.counterfactuals')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.counterfactuals.slice(0, 4).map((item, index) => (
              <div key={index} className="border border-scp-gray/30 bg-black/30 p-4 scp-archive">
                <div className="text-xs font-bold text-gray-200 mb-2">{item.title}</div>
                <div className="text-[10px] text-gray-400 mb-2">
                  {t('report.change')}: {item.change}
                </div>
                <div className="text-[10px] text-gray-300 mb-2">
                  {t('report.expected')}: {item.expectedOutcome}
                </div>
                <div className="text-[10px] text-gray-400">
                  {t('report.tradeoff')}: {item.tradeoff}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.narrativeQuality && (
        <NarrativeQualitySection
          narrativeQuality={data.narrativeQuality}
          title={t('report.narrative_quality')}
          overallLabel={t('report.nq_overall')}
          commentLabel={t('report.nq_comment')}
          dimensionLabels={narrativeDimensions}
        />
      )}

      {data.achievements && data.achievements.length > 0 && (
        <div className="relative z-10 mb-8">
          <h3 className="text-sm text-scp-text font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
            <span className="w-1 h-4 bg-yellow-500 block"></span>
            {t('report.achievements')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {data.achievements.map((achievement, index) => (
              <div key={index} className="bg-black/60 border border-yellow-900/50 p-4 rounded-sm flex items-start gap-3 hover:border-yellow-500 transition-colors group scp-archive">
                <div>
                  <p className="text-xs font-bold text-yellow-500 uppercase mb-1">{achievement.title}</p>
                  <p className="text-[10px] text-gray-400 leading-tight">{achievement.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <TimelineAnalysisSection
        timelineAnalysis={data.timelineAnalysis}
        title={t('report.key_moments')}
        turnLabel={t('report.turn')}
        impactPositiveLabel={t('report.impact_pos')}
        impactNegativeLabel={t('report.impact_neg')}
        impactNeutralLabel={t('report.impact_neu')}
      />

      {data.perspectiveEvaluations && data.perspectiveEvaluations.length > 0 && (
        <div className="relative z-10 mb-8">
          <h3 className="text-sm text-scp-text font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
            <span className="w-1 h-4 bg-purple-500 block"></span>
            {t('report.perspectives')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.perspectiveEvaluations.map((item, index) => (
              <div key={index} className="bg-black/40 border border-scp-gray/30 p-4 flex flex-col scp-archive">
                <div className="border-b border-gray-700 pb-2 mb-2 flex justify-between items-end">
                  <span className="text-xs font-bold text-scp-text uppercase">{item.sourceName}</span>
                  <span className="text-[10px] text-gray-400 font-mono border border-gray-600 px-1">{item.stance}</span>
                </div>
                <p className="text-xs text-gray-300 italic flex-grow">"{item.comment}"</p>
              </div>
            ))}
          </div>
        </div>
      )}

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

      <div className="absolute bottom-8 right-8 pointer-events-none opacity-80 mix-blend-screen transform -rotate-12 border-4 border-red-800 p-2 rounded">
        <div className="border border-red-800 px-4 py-2">
          <span className="text-2xl font-report text-red-800 font-bold uppercase tracking-widest">CONFIDENTIAL</span>
        </div>
      </div>
    </div>
  );
};

export default GameReviewReport;
