import React, { useMemo } from 'react';
import type { GameReviewData, Message, NarrativeQuality, SCPData } from '../../../types';
import GameLogo from '../../GameLogo';
import { renderLogText } from '../../game/stage/BeatText';
import { clamp, computeSessionStats, getImpactColorClass, getRankColorClass } from '../selectors/reviewStats';
import type { WorldLineTurn } from '../selectors/worldLine';
import NarrativeQualitySection from './sections/NarrativeQualitySection';
import { StabilityLineChart, ValueBarChart } from './ReviewCharts';

const pad = (value: number) => String(value).padStart(2, '0');
const percent = (value: number) => `${Math.round(value * 100)}%`;

interface ReviewBoardProps {
  data: GameReviewData;
  scpData: SCPData | null;
  stabilityHistory: number[];
  messages: Message[];
  turns: WorldLineTurn[];
  onJump: (turn: number) => void;
  t: (key: string, params?: Record<string, string | number>) => any;
}

/** The after-action review on screen. The PDF keeps its paper layout through GameReviewReport */
const ReviewBoard: React.FC<ReviewBoardProps> = ({ data, scpData, stabilityHistory, messages, turns, onJump, t }) => {
  const stats = useMemo(() => computeSessionStats(messages, stabilityHistory), [messages, stabilityHistory]);
  const knownTurns = useMemo(() => new Set(turns.map(turn => turn.turn)), [turns]);
  const { phase, engagement } = stats;
  const rankColor = getRankColorClass(data.evaluation.rank);
  const startLabel = t('report.start');
  const risk = data.riskAssessment;

  const narrativeDimensions: Array<{ key: keyof Omit<NarrativeQuality, 'comment'>; label: string }> = [
    { key: 'worldConsistency', label: t('report.nq_world_consistency') },
    { key: 'imagery', label: t('report.nq_imagery') },
    { key: 'npcDepth', label: t('report.nq_npc_depth') },
    { key: 'pacing', label: t('report.nq_pacing') },
    { key: 'interactivity', label: t('report.nq_interactivity') },
    { key: 'equivalentExchange', label: t('report.nq_equivalent_exchange') },
  ];

  const impactLabel = (impact: string) => t(impact === 'POSITIVE' ? 'report.impact_pos' : impact === 'NEGATIVE' ? 'report.impact_neg' : 'report.impact_neu');

  return (
    <section className="rv" id="rv">
      <GameLogo className="rv-watermark" />

      <header className="rv-head">
        <div>
          <div className="meta-line dim">{t('report.dept_analytics')}</div>
          <h2 className="font-report">{data.operationName}</h2>
          <div className="rv-tags">
            <span>{t('report.item')}: {scpData?.designation}</span>
            <span>{t('report.review_title')}</span>
            <span>{data.clearanceLevel}</span>
          </div>
          <h3 className="rv-summary-title">{t('report.summary')}</h3>
          <p className="rv-summary">{data.summary}</p>
        </div>
        <div className="rv-rank">
          <span className="meta-line dim">{t('report.perf_eval')}</span>
          <b className={`font-report text-shadow-sm ${rankColor}`}>{data.evaluation.rank}</b>
          <span className="rv-score">{t('report.score')}: <em>{data.evaluation.score}/100</em></span>
          <p className={rankColor}>{data.evaluation.verdict}</p>
        </div>
      </header>

      {!!data.achievements?.length && (
        <section className="rv-sec first">
          <h3>{t('report.achievements')}</h3>
          <div className="rv-awards">
            {data.achievements.map((item, index) => (
              <article key={index}><b>{item.title}</b><p>{item.description}</p></article>
            ))}
          </div>
        </section>
      )}

      {stats.deltas.length > 0 && (
        <div className="rv-charts">
          <article className="chart-card">
            <h3>{t('report.stability_chart')}</h3>
            <StabilityLineChart
              ariaLabel={t('report.stability_chart')}
              points={turns.map(turn => ({ value: turn.stability, label: `T${pad(turn.turn)}`, note: turn.choice?.title || startLabel }))}
            />
          </article>
          <article className="chart-card">
            <h3>{t('report.phase_dist')}</h3>
            <div className="phase-bar">
              {phase.stableCount > 0 && <i className="stable" style={{ flex: phase.stableCount }} />}
              {phase.fluctuatingCount > 0 && <i className="fluct" style={{ flex: phase.fluctuatingCount }} />}
              {phase.criticalCount > 0 && <i className="crit" style={{ flex: phase.criticalCount }} />}
            </div>
            <div className="phase-legend">
              <div><i className="stable" />{t('report.phase_stable')}<b>{percent(phase.stablePct)}</b></div>
              <div><i className="fluct" />{t('report.phase_fluct')}<b>{percent(phase.fluctuatingPct)}</b></div>
              <div><i className="crit" />{t('report.phase_critical')}<b>{percent(phase.criticalPct)}</b></div>
            </div>
            <h3 className="sub">{t('report.engagement_chart')}</h3>
            <ValueBarChart
              ariaLabel={t('report.engagement_chart')}
              points={turns.slice(1).map(turn => ({ value: turn.inputLength, label: `T${pad(turn.turn)}` }))}
            />
            <div className="stat-row">
              <div><b>{engagement.turns}</b>{t('report.turns')}</div>
              <div><b>{Math.round(engagement.avgUserCharsPerTurn)}</b>{t('report.avg_user_len')}</div>
              <div><b>{Math.round(engagement.avgNarratorCharsPerTurn)}</b>{t('report.avg_narr_len')}</div>
              <div><b>{engagement.visualsCount}</b>{t('report.visuals')}</div>
            </div>
          </article>
          <article className="chart-card wide">
            <h3>{t('report.delta_chart')}</h3>
            <ValueBarChart
              diverging
              ariaLabel={t('report.delta_chart')}
              points={turns.slice(1).map(turn => ({ value: turn.delta, label: `T${pad(turn.turn)}` }))}
            />
            <div className="stat-row">
              <div><b>{stats.largestDrop}</b>{t('report.largest_drop')}</div>
              <div><b>+{stats.largestRecovery}</b>{t('report.largest_recovery')}</div>
              <div><b>{stats.volatility.toFixed(1)}</b>{t('report.volatility')}</div>
              <div><b>{phase.criticalCount}</b>{t('report.critical_turns')}</div>
            </div>
          </article>
        </div>
      )}

      {!!data.objectiveBreakdown?.length && (
        <section className="rv-sec">
          <h3>{t('report.objectives')}</h3>
          {data.objectiveBreakdown.map((objective, index) => {
            const completion = clamp(objective.completion, 0, 100);
            return (
              <article key={index} className="rv-obj">
                <div className="rv-obj-head"><b>{objective.objective}</b><span>{completion}%</span></div>
                <div className="rv-bar"><i style={{ width: `${completion}%` }} /></div>
                <div className="rv-two">
                  <p><em>{t('report.evidence')}</em>{objective.evidence}</p>
                  <p><em>{t('report.missed')}</em>{objective.missedOpportunity}</p>
                </div>
              </article>
            );
          })}
        </section>
      )}

      <section className="rv-sec">
        <h3>{t('report.key_moments')}</h3>
        {data.timelineAnalysis.map((item, index) => {
          const content = (
            <>
              <span className="t">T{pad(Number(item.turn))}</span>
              <span className={`wl-flag ${getImpactColorClass(item.impact)}`}>{impactLabel(item.impact)}</span>
              <span className="rv-key-text"><b>{item.event}</b><span>{item.analysis}</span></span>
            </>
          );
          return knownTurns.has(Number(item.turn))
            ? <button type="button" key={index} className="rv-key" onClick={() => onJump(Number(item.turn))}>{content}</button>
            : <div key={index} className="rv-key">{content}</div>;
        })}
      </section>

      {risk && (
        <section className="rv-sec">
          <h3>{t('report.risk')} <small>{t('report.risk_overall')} {clamp(risk.overall, 0, 100)}/100</small></h3>
          <p className="rv-p">{risk.volatilityComment}</p>
          {(risk.riskByTurn || []).slice(0, 5).map((item, index) => {
            // Older reviews scored risk out of 5, newer ones out of 100
            const scale = item.risk > 5 ? 100 : 5;
            return (
              <article key={index} className="rv-risk">
                <span className="t">T{pad(Number(item.turn))}</span>
                <div className="rv-risk-meter" aria-label={`${t('report.risk_level')} ${item.risk}/${scale}`}><i style={{ width: `${clamp(item.risk / scale, 0, 1) * 100}%` }} /><b>{item.risk}/{scale}</b></div>
                <p>{item.reason}</p>
                <p className="alt"><em>{t('report.better_move')}</em>{item.betterMove}</p>
              </article>
            );
          })}
        </section>
      )}

      {!!data.tacticsMatrix?.length && (
        <section className="rv-sec">
          <h3>{t('report.tactics')}</h3>
          <div className="rv-table">
            {data.tacticsMatrix.map((item, index) => (
              <div key={index}>
                <b>{item.tactic}</b>
                <span className="n">×{item.count}</span>
                <span className={`eff ${item.effectiveness}`}>{item.effectiveness}</span>
                <p>{item.note}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {!!data.counterfactuals?.length && (
        <section className="rv-sec">
          <h3>{t('report.counterfactuals')}</h3>
          <div className="rv-cols">
            {data.counterfactuals.slice(0, 4).map((item, index) => (
              <article key={index}>
                <b>{item.title}</b>
                <p><em>{t('report.change')}</em>{item.change}</p>
                <p><em>{t('report.expected')}</em>{item.expectedOutcome}</p>
                <p><em>{t('report.tradeoff')}</em>{item.tradeoff}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      {data.narrativeQuality && (
        <section className="rv-sec rv-narrative">
          <NarrativeQualitySection
            narrativeQuality={data.narrativeQuality}
            title={t('report.narrative_quality')}
            overallLabel={t('report.nq_overall')}
            commentLabel={t('report.nq_comment')}
            dimensionLabels={narrativeDimensions}
          />
        </section>
      )}

      {!!data.perspectiveEvaluations?.length && (
        <section className="rv-sec">
          <h3>{t('report.perspectives')}</h3>
          <div className="rv-cols">
            {data.perspectiveEvaluations.map((item, index) => (
              <article key={index} className="persp"><b>{item.sourceName}</b><span>{item.stance}</span><p>{item.comment}</p></article>
            ))}
          </div>
        </section>
      )}

      <section className="rv-sec rv-pair">
        <div><h3>{t('report.psych_profile')}</h3><p className="rv-p">{data.psychProfile}</p></div>
        <div>
          <h3>{t('report.strat_advice')}</h3>
          <div className="rv-p">{data.strategicAdvice.split(/\n+/).map((line, index) => <p key={index}>{renderLogText(line)}</p>)}</div>
        </div>
      </section>

      <div className="rv-stamp font-report" aria-hidden="true"><span>CONFIDENTIAL</span></div>
    </section>
  );
};

export default ReviewBoard;
