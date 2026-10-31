import React, { useMemo } from 'react';
import { ItemState, MapBlueprint, ObjectiveState, RuntimeMapState } from '../../../types';
import { NpcDossier } from '../../../utils/npcDossier';
import {
  buildRoutePath,
  dangerColor,
  missingRequirements,
  NETWORK_GEOMETRY,
  NetworkPoint,
  networkCurve,
  wrapNodeName,
} from '../../../utils/siteNetwork';

export const MAIN_RING = '#7dd3fc';
export const SIDE_MARK = '#38bdf8';
const NPC_RING = '#f59e0b';

const NodeMark: React.FC<{ x: number; y: number; danger: number; known: boolean; current: boolean; scale: number }> = ({ x, y, danger, known, current, scale }) => {
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

interface NetworkGraphProps {
  blueprint: MapBlueprint;
  map: RuntimeMapState;
  positions: Record<string, NetworkPoint>;
  compact: boolean;
  objectives: ObjectiveState[];
  inventory: ItemState[];
  dossiers: NpcDossier[];
  route: string[];
  npcImages?: Record<string, string>;
  selectedId?: string;
  /** Keeps clip paths apart when more than one map is on the page */
  idPrefix: string;
  /** Changing this redraws the route from its start */
  routeKey?: string | number;
  focusable?: boolean;
  t: (key: string, params?: Record<string, string | number>) => any;
}

/** Everything inside a site map. The drawer, the full screen view and the minimap all draw this */
const NetworkGraph: React.FC<NetworkGraphProps> = ({ blueprint, map, positions, compact, objectives, inventory, dossiers, route, npcImages, selectedId, idPrefix, routeKey, focusable = false, t }) => {
  const geometry = compact ? NETWORK_GEOMETRY.compact : NETWORK_GEOMETRY.wide;
  const currentId = map.currentNodeId;
  const known = useMemo(() => new Set(map.discoveredNodeIds), [map.discoveredNodeIds]);
  const routePath = useMemo(() => buildRoutePath(route, positions, compact), [route, positions, compact]);
  const here = positions[currentId];

  return (
    <>
      <g className="net-rings">
        {here && geometry.rings.map(radius => <circle key={radius} cx={here.x} cy={here.y} r={radius} />)}
      </g>
      {blueprint.edges.map(edge => {
        const a = positions[edge.from];
        const b = positions[edge.to];
        if (!a || !b) return null;
        const seen = known.has(edge.from) && known.has(edge.to);
        const lit = !!selectedId && (edge.from === selectedId || edge.to === selectedId);
        return <path key={`${edge.from}-${edge.to}`} className={`net-edge ${seen ? 'seen' : ''} ${lit ? 'lit' : ''}`} d={`M ${a.x} ${a.y} ${networkCurve(a, b)}`} />;
      })}
      {routePath && <path key={routeKey} className="net-thread" pathLength={1} d={routePath} />}
      {blueprint.nodes.map(node => {
        const point = positions[node.id];
        if (!point) return null;
        const { x, y } = point;
        const danger = node.danger ?? 0;
        const isKnown = known.has(node.id);
        const isCurrent = node.id === currentId;
        const missing = missingRequirements(node, inventory);
        const gated = (node.requires || []).length > 0;
        const nameLines = compact ? wrapNodeName(node.name) : [node.name];
        const nameBottom = y - geometry.ring - geometry.nameGap;
        const dangerY = y + geometry.ring + geometry.dangerGap;
        const people = isKnown || isCurrent ? dossiers.filter(entry => entry.npc.alive && entry.npc.nodeId === node.id) : [];
        return (
          <g key={node.id} data-id={node.id} tabIndex={focusable ? 0 : undefined} role={focusable ? 'button' : undefined} aria-label={focusable ? node.name : undefined} className={`net-node ${isKnown ? 'known' : 'unknown'} ${isCurrent ? 'current' : ''} ${node.id === selectedId ? 'selected' : ''}`}>
            <circle className="n-hit" cx={x} cy={y} r={geometry.hit} />
            {danger > 70 && <circle className="n-ping" cx={x} cy={y} r={geometry.ring} stroke="#ef4444" style={{ transformOrigin: `${x}px ${y}px` }} />}
            <circle className="n-ring" cx={x} cy={y} r={geometry.ring} style={isKnown ? { stroke: dangerColor(danger) } : undefined} />
            <NodeMark x={x} y={y} danger={danger} known={isKnown} current={isCurrent} scale={geometry.mark} />
            {objectives.filter(objective => objective.nodeId === node.id && objective.status === 'ACTIVE').map(objective => (
              objective.type === 'MAIN'
                ? <circle key={objective.id} className="n-main" cx={x} cy={y} r={geometry.main} stroke={MAIN_RING} style={{ transformOrigin: `${x}px ${y}px` }} />
                : <rect key={objective.id} x={x + geometry.side[0]} y={y + geometry.side[1]} width={geometry.side[2]} height={geometry.side[2]} fill={SIDE_MARK} />
            ))}
            {isCurrent && (
              <g className="n-reticle">
                {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sy]) => (
                  <path key={`${sx}${sy}`} d={`M ${x + sx * geometry.reticle[0]} ${y + sy * geometry.reticle[1]} V ${y + sy * geometry.reticle[0]} H ${x + sx * geometry.reticle[1]}`} />
                ))}
              </g>
            )}
            {people.map(({ npc, met }, index) => {
              const cx = x + geometry.faceAt[0] + index * geometry.faceGap;
              const cy = y + geometry.faceAt[1];
              const radius = geometry.face;
              const image = met ? npcImages?.[npc.id] : undefined;
              const clipId = `${idPrefix}-face-${npc.id}`;
              return (
                <g key={npc.id} className="n-face">
                  <circle cx={cx} cy={cy} r={radius} fill="#0b0b0c" />
                  {image && (
                    <>
                      <clipPath id={clipId}><circle cx={cx} cy={cy} r={radius} /></clipPath>
                      <image href={image} x={cx - radius} y={cy - radius} width={radius * 2} height={radius * 2} clipPath={`url(#${clipId})`} preserveAspectRatio="xMidYMin slice" />
                    </>
                  )}
                  {!image && <text x={cx} y={cy + 1} className="n-face-q" textAnchor="middle" dominantBaseline="middle">?</text>}
                  <circle cx={cx} cy={cy} r={radius} fill="none" stroke={NPC_RING} strokeWidth={1.2} />
                </g>
              );
            })}
            {node.id === blueprint.startNodeId && <text className="n-start" x={x - geometry.start} y={y + 4}>S</text>}
            <text className="n-name" textAnchor="middle">
              {nameLines.map((line, index) => (
                <tspan key={index} x={x} y={nameBottom - (nameLines.length - 1 - index) * geometry.lineHeight}>{line}</tspan>
              ))}
            </text>
            <text className="n-danger" x={x} y={dangerY} textAnchor="middle" style={danger > 70 ? { fill: '#ef4444' } : undefined}>
              DANGER {danger}
              {compact && gated && <tspan className={missing.length ? 'n-lock' : 'n-pass'} dx={5}>{missing.length ? '⊘' : '✓'}</tspan>}
            </text>
            {!compact && gated && (missing.length
              ? <text className="n-lock" x={x} y={dangerY + 18} textAnchor="middle">⊘ {t('stage.network.locked')}</text>
              : <text className="n-pass" x={x} y={dangerY + 18} textAnchor="middle">✓ {t('stage.network.authorized_short')}</text>)}
          </g>
        );
      })}
    </>
  );
};

export default NetworkGraph;
