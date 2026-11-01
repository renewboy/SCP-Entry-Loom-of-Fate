import React from 'react';
import '../../styles/fateThread.css';

/** Keeps the glow from being cut off: a straight line's bounding box has no height */
const FILTER_REACH = 6000;

export const FateThreadDefs: React.FC<{ id?: string }> = ({ id = 'thread-glow' }) => (
  <defs>
    <filter id={id} filterUnits="userSpaceOnUse" x={-FILTER_REACH} y={-FILTER_REACH} width={FILTER_REACH * 2} height={FILTER_REACH * 2}>
      <feGaussianBlur stdDeviation="3.4" result="b" />
      <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
    </filter>
  </defs>
);

interface FateThreadProps {
  d: string;
  /** Plays the thread drawing itself in, for one that was just tied */
  draw?: boolean;
  /** Seconds, usually negative, so threads laid side by side do not pulse in step */
  delay?: number;
}

/** The red thread with a point of light travelling along it */
const FateThread: React.FC<FateThreadProps> = ({ d, draw = false, delay = 0 }) => (
  <g className={`th ${draw ? 'draw' : ''}`}>
    <path className="th-glow" pathLength={1} d={d} />
    <path className="th-core" pathLength={1} d={d} />
    <path className="th-pulse" pathLength={1} d={d} style={{ animationDelay: `${delay}s` }} />
  </g>
);

export default FateThread;
