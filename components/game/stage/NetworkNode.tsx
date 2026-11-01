import React from 'react';
import { dangerColor, NETWORK_GEOMETRY, NetworkPoint, wrapNodeName } from '../../../utils/siteNetwork';

export const MAIN_RING = '#7dd3fc';
export const SIDE_MARK = '#38bdf8';
const NPC_RING = '#f59e0b';

interface NodeMarkProps {
  x: number;
  y: number;
  danger: number;
  known?: boolean;
  current?: boolean;
  scale?: number;
}

/** The danger shape: circle, hexagon or triangle. Unknown zones show a question mark */
export const NodeMark: React.FC<NodeMarkProps> = ({ x, y, danger, known = true, current = false, scale = 1 }) => {
  if (!known && !current) return <text className="n-q" x={x} y={y + 1} textAnchor="middle" dominantBaseline="middle">?</text>;
  const fill = dangerColor(danger);
  const size = (current ? 1.3 : 1.12) * scale;
  if (danger <= 30) return <circle cx={x} cy={y} r={6.5 * size} fill={fill} />;
  if (danger <= 70) {
    const radius = 9.5 * size;
    const points = Array.from({ length: 6 }, (_, i) => `${(x + radius * Math.cos(Math.PI / 3 * i)).toFixed(1)},${(y + radius * Math.sin(Math.PI / 3 * i)).toFixed(1)}`).join(' ');
    return <polygon points={points} fill={fill} />;
  }
  const radius = 11 * size;
  return <polygon points={`${x},${y - radius} ${(x - radius * 0.866).toFixed(1)},${y + radius * 0.5} ${(x + radius * 0.866).toFixed(1)},${y + radius * 0.5}`} fill={fill} />;
};

/** The small objective icon used in lists next to the map */
export const ObjectiveIcon: React.FC<{ type: string }> = ({ type }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
    {type === 'MAIN'
      ? <circle cx="8" cy="8" r="6" fill="none" stroke={MAIN_RING} strokeDasharray="2.6 2" />
      : <rect x="4" y="4" width="8" height="8" fill={SIDE_MARK} />}
  </svg>
);

export interface NetworkNodeFace {
  id: string;
  image?: string;
  picked?: boolean;
}

export interface NetworkNodeObjective {
  id: string;
  type: string;
  picked?: boolean;
}

interface NetworkNodeProps {
  node: { id: string; name: string; danger?: number };
  point: NetworkPoint;
  compact: boolean;
  known: boolean;
  current?: boolean;
  selected?: boolean;
  isStart: boolean;
  marks: NetworkNodeObjective[];
  faces: NetworkNodeFace[];
  gate: 'locked' | 'authorized' | null;
  gateLabels: { locked: string; authorized: string };
  /** Keeps clip paths apart when more than one map is on the page */
  idPrefix: string;
  focusable?: boolean;
  /** Draws the corner reticle on a selected node, not only on the current zone */
  reticleOnSelected?: boolean;
  className?: string;
  children?: React.ReactNode;
}

/** One zone on a site map. The in-game maps, the tactical briefing and the story editor all draw this */
const NetworkNode: React.FC<NetworkNodeProps> = ({ node, point, compact, known, current = false, selected = false, isStart, marks, faces, gate, gateLabels, idPrefix, focusable = false, reticleOnSelected = false, className = '', children }) => {
  const geometry = compact ? NETWORK_GEOMETRY.compact : NETWORK_GEOMETRY.wide;
  const { x, y } = point;
  const danger = node.danger ?? 0;
  const nameLines = compact ? wrapNodeName(node.name) : [node.name];
  const nameBottom = y - geometry.ring - geometry.nameGap;
  const dangerY = y + geometry.ring + geometry.dangerGap;
  const reticle = current || (reticleOnSelected && selected);
  return (
    <g data-id={node.id} tabIndex={focusable ? 0 : undefined} role={focusable ? 'button' : undefined} aria-label={focusable ? node.name : undefined} className={`net-node ${known ? 'known' : 'unknown'} ${current ? 'current' : ''} ${selected ? 'selected' : ''} ${className}`}>
      <circle className="n-hit" cx={x} cy={y} r={geometry.hit} />
      {danger > 70 && <circle className="n-ping" cx={x} cy={y} r={geometry.ring} stroke="#ef4444" style={{ transformOrigin: `${x}px ${y}px` }} />}
      <circle className="n-ring" cx={x} cy={y} r={geometry.ring} style={known ? { stroke: dangerColor(danger) } : undefined} />
      <NodeMark x={x} y={y} danger={danger} known={known} current={current} scale={geometry.mark} />
      {marks.map(mark => (
        mark.type === 'MAIN'
          ? <circle key={mark.id} data-objective={mark.id} className={`n-main n-obj ${mark.picked ? 'pick' : ''}`} cx={x} cy={y} r={geometry.main} stroke={MAIN_RING} style={{ transformOrigin: `${x}px ${y}px` }} />
          : <rect key={mark.id} data-objective={mark.id} className={`n-obj ${mark.picked ? 'pick' : ''}`} x={x + geometry.side[0]} y={y + geometry.side[1]} width={geometry.side[2]} height={geometry.side[2]} fill={SIDE_MARK} />
      ))}
      {reticle && (
        <g className="n-reticle">
          {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sy]) => (
            <path key={`${sx}${sy}`} d={`M ${x + sx * geometry.reticle[0]} ${y + sy * geometry.reticle[1]} V ${y + sy * geometry.reticle[0]} H ${x + sx * geometry.reticle[1]}`} />
          ))}
        </g>
      )}
      {faces.map((face, index) => {
        const cx = x + geometry.faceAt[0] + index * geometry.faceGap;
        const cy = y + geometry.faceAt[1];
        const radius = geometry.face;
        const clipId = `${idPrefix}-face-${face.id}`;
        return (
          <g key={face.id} data-npc={face.id} className={`n-face ${face.picked ? 'pick' : ''}`}>
            <circle cx={cx} cy={cy} r={radius} fill="#0b0b0c" />
            {face.image && (
              <>
                <clipPath id={clipId}><circle cx={cx} cy={cy} r={radius} /></clipPath>
                <image href={face.image} x={cx - radius} y={cy - radius} width={radius * 2} height={radius * 2} clipPath={`url(#${clipId})`} preserveAspectRatio="xMidYMin slice" />
              </>
            )}
            {!face.image && <text x={cx} y={cy + 1} className="n-face-q" textAnchor="middle" dominantBaseline="middle">?</text>}
            <circle cx={cx} cy={cy} r={radius} fill="none" stroke={NPC_RING} strokeWidth={1.2} />
          </g>
        );
      })}
      {isStart && <text className="n-start" x={x - geometry.start} y={y + 4}>S</text>}
      <text className="n-name" textAnchor="middle">
        {nameLines.map((line, index) => (
          <tspan key={index} x={x} y={nameBottom - (nameLines.length - 1 - index) * geometry.lineHeight}>{line}</tspan>
        ))}
      </text>
      <text className="n-danger" x={x} y={dangerY} textAnchor="middle" style={danger > 70 ? { fill: '#ef4444' } : undefined}>
        DANGER {danger}
        {compact && gate && <tspan className={gate === 'locked' ? 'n-lock' : 'n-pass'} dx={5}>{gate === 'locked' ? '⊘' : '✓'}</tspan>}
      </text>
      {!compact && gate && (gate === 'locked'
        ? <text className="n-lock" x={x} y={dangerY + 18} textAnchor="middle">⊘ {gateLabels.locked}</text>
        : <text className="n-pass" x={x} y={dangerY + 18} textAnchor="middle">✓ {gateLabels.authorized}</text>)}
      {children}
    </g>
  );
};

export default NetworkNode;
