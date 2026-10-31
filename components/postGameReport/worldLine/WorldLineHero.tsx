import React, { useMemo } from 'react';
import type { GameReviewData } from '../../../types';
import { getRankColorClass } from '../selectors/reviewStats';
import { instability, threadNoise, type WorldLineTurn } from '../selectors/worldLine';
import { useElementSize } from '../shared/useElementSize';
import type { EndingDisplayConfig } from '../types';

const pad = (value: number) => String(value).padStart(2, '0');
const phaseClass = (stability: number) => (stability > 70 ? 'stable' : stability > 30 ? 'fluct' : 'crit');

/** The whole run as one wave: it shakes harder as stability falls, with a tick for each turn */
const StabilityStrip: React.FC<{ turns: WorldLineTurn[]; startLabel: string; ariaLabel: string; onJump: (turn: number) => void }> = ({ turns, startLabel, ariaLabel, onJump }) => {
  const { ref, width, height } = useElementSize<HTMLDivElement>();
  const count = turns.length;
  const xOf = (index: number) => (count > 1 ? (width - 2) * (index / (count - 1)) + 1 : width / 2);

  const path = useMemo(() => {
    if (!width || !count) return '';
    const parts: string[] = [];
    for (let x = 0; x <= width; x += 2) {
      const position = Math.max(0, Math.min(count - 1, ((x - 1) / Math.max(1, width - 2)) * (count - 1)));
      const low = Math.floor(position);
      const high = Math.min(count - 1, low + 1);
      const stability = turns[low].stability + (turns[high].stability - turns[low].stability) * (position - low);
      const y = height / 2 + instability(stability) * (height * 0.42) * threadNoise(x * 1.8);
      parts.push(`${parts.length ? 'L' : 'M'} ${x} ${y.toFixed(1)}`);
    }
    return parts.join(' ');
  }, [turns, count, width, height]);

  return (
    <div className="rp-strip" ref={ref} role="group" aria-label={ariaLabel}>
      <svg width={width} height={height} viewBox={`0 0 ${width || 1} ${height || 1}`} aria-hidden="true">
        <path className="strip-line glow" d={path} />
        <path className="strip-line" d={path} />
      </svg>
      <div className="strip-ticks">
        {turns.map((turn, index) => (
          <button
            type="button"
            key={turn.id}
            className={phaseClass(turn.stability)}
            style={{ left: xOf(index) }}
            aria-label={`T${pad(turn.turn)} · ${turn.stability}`}
            onClick={() => onJump(turn.turn)}
          >
            <span className="tip"><b>T{pad(turn.turn)} · {turn.stability}</b>{turn.choice?.title || startLabel}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

interface WorldLineHeroProps {
  outcome: EndingDisplayConfig;
  archivedLabel: string;
  kicker: string;
  backdrop?: string | null;
  role: string;
  turns: WorldLineTurn[];
  review: GameReviewData | null;
  labels: { role: string; turns: string; stability: string; rank: string; start: string; strip: string };
  onJump: (turn: number) => void;
}

const WorldLineHero: React.FC<WorldLineHeroProps> = ({ outcome, archivedLabel, kicker, backdrop, role, turns, review, labels, onJump }) => {
  const last = turns[turns.length - 1];
  return (
    <div className="rp-hero">
      {backdrop && <div className="rp-hero-bg" style={{ backgroundImage: `url("${backdrop}")` }} />}
      <div className="rp-hero-text">
        <div className="meta-line fate">{kicker}</div>
        <h1>{outcome.title}</h1>
        <p>{outcome.text} {archivedLabel}</p>
        <dl className="rp-stats">
          <div><dt>{labels.role}</dt><dd>{role}</dd></div>
          {last && <div><dt>{labels.turns}</dt><dd className="num">{last.turn}</dd></div>}
          {last && <div><dt>{labels.stability}</dt><dd className="num">{last.stability}</dd></div>}
          {review && (
            <div>
              <dt>{labels.rank}</dt>
              <dd className="rank"><b className={`font-report ${getRankColorClass(review.evaluation.rank)}`}>{review.evaluation.rank}</b><small>{review.evaluation.score}/100</small></dd>
            </div>
          )}
        </dl>
      </div>
      {turns.length > 1 && <StabilityStrip turns={turns} startLabel={labels.start} ariaLabel={labels.strip} onJump={onJump} />}
    </div>
  );
};

export default WorldLineHero;
