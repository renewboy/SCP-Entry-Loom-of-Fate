import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { MapBlueprint, ObjectiveState, RuntimeMapState, RuntimeNPCState } from '../../../types';
import { buildLayout } from '../../../utils/mapLayout';

const COLORS = { low: '#33ff00', medium: '#f59e0b', high: '#ef4444' };
const STORAGE_KEY = 'loom-radar-pos';
const EDGE_MARGIN = 8;
const DRAG_THRESHOLD = 4;
const SCALE = 1.3;
const RETICLE: Array<[number, number, number, number]> = [
  [-8, -8, 4, 1], [4, -8, 4, 1], [-8, 7, 4, 1], [4, 7, 4, 1],
  [-8, -8, 1, 4], [7, -8, 1, 4], [-8, 4, 1, 4], [7, 4, 1, 4]
];

const NodeShape: React.FC<{ x: number; y: number; danger: number; current: boolean; discovered: boolean }> = ({ x, y, danger, current, discovered }) => {
  if (!discovered && !current) {
    return (
      <>
        <circle cx={x} cy={y} r={3.5} fill={COLORS.low} fillOpacity={0.3} stroke={COLORS.low} strokeOpacity={0.5} strokeWidth={0.5} />
        <text x={x} y={y + 0.3} fontSize={5.5} textAnchor="middle" dominantBaseline="middle" fill={COLORS.low} fillOpacity={0.9} fontFamily="JetBrains Mono, monospace" fontWeight={700}>?</text>
      </>
    );
  }
  const pulse = current ? 'rd-cur' : undefined;
  if (danger <= 30) {
    return <circle className={pulse} cx={x} cy={y} r={current ? 4 : 3} fill={COLORS.low} fillOpacity={current ? 1 : 0.7} />;
  }
  if (danger <= 70) {
    const size = current ? 5 : 4;
    const points = Array.from({ length: 6 }, (_, i) => `${(x + size * Math.cos(Math.PI / 3 * i)).toFixed(2)},${(y + size * Math.sin(Math.PI / 3 * i)).toFixed(2)}`).join(' ');
    return <polygon className={pulse} points={points} fill={COLORS.medium} fillOpacity={current ? 1 : 0.7} />;
  }
  const size = current ? 6 : 5;
  return (
    <>
      <polygon className={pulse} points={`${x},${y - size} ${(x - size * 0.866).toFixed(2)},${y + size * 0.5} ${(x + size * 0.866).toFixed(2)},${y + size * 0.5}`} fill={COLORS.high} fillOpacity={current ? 1 : 0.8} />
      <circle className="rd-ping" cx={x} cy={y} r={size * 2.5} fill="none" stroke={COLORS.high} strokeOpacity={0.4} strokeWidth={0.5} />
    </>
  );
};

interface RadarMinimapProps {
  blueprint: MapBlueprint;
  map: RuntimeMapState;
  objectives: ObjectiveState[];
  npcs: RuntimeNPCState[];
  locationName: string;
  resetKey: number;
  anchorRef: React.RefObject<HTMLElement>;
  onOpen: () => void;
  t: (key: string) => any;
}

const RadarMinimap: React.FC<RadarMinimapProps> = ({ blueprint, map, objectives, npcs, locationName, resetKey, anchorRef, onOpen, t }) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const position = useRef({ x: 0, y: 0 });
  const drag = useRef<{ px: number; py: number; x: number; y: number } | null>(null);
  const moved = useRef(false);

  const room = () => {
    const wrap = wrapRef.current;
    return {
      w: Math.max(0, window.innerWidth - (wrap?.offsetWidth ?? 0) - EDGE_MARGIN * 2),
      h: Math.max(0, window.innerHeight - (wrap?.offsetHeight ?? 0) - EDGE_MARGIN * 2)
    };
  };

  const place = useCallback((x: number, y: number) => {
    const space = room();
    const nextX = Math.max(EDGE_MARGIN, Math.min(EDGE_MARGIN + space.w, x));
    const nextY = Math.max(EDGE_MARGIN, Math.min(EDGE_MARGIN + space.h, y));
    position.current = { x: nextX, y: nextY };
    if (wrapRef.current) wrapRef.current.style.transform = `translate(${nextX}px, ${nextY}px)`;
  }, []);

  const placeDefault = useCallback(() => {
    const anchor = anchorRef.current?.getBoundingClientRect();
    const width = wrapRef.current?.offsetWidth ?? 0;
    if (anchor) place(anchor.right - width, anchor.bottom + 14);
  }, [anchorRef, place]);

  const restore = useCallback(() => {
    let saved: { fx?: number; fy?: number } | null = null;
    try {
      saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    } catch {
      saved = null;
    }
    const space = room();
    if (saved && Number.isFinite(saved.fx) && Number.isFinite(saved.fy)) {
      place(EDGE_MARGIN + (saved.fx as number) * space.w, EDGE_MARGIN + (saved.fy as number) * space.h);
    } else {
      placeDefault();
    }
  }, [place, placeDefault]);

  useLayoutEffect(() => {
    restore();
    window.addEventListener('resize', restore);
    return () => window.removeEventListener('resize', restore);
  }, [restore]);

  useEffect(() => {
    if (!resetKey) return;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Without storage the reset still applies for this session
    }
    placeDefault();
  }, [resetKey, placeDefault]);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button) return;
    drag.current = { px: event.clientX, py: event.clientY, ...position.current };
    moved.current = false;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // The pointer may already be gone
    }
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const dx = event.clientX - drag.current.px;
    const dy = event.clientY - drag.current.py;
    if (!moved.current && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    if (!moved.current) {
      moved.current = true;
      wrapRef.current?.classList.add('dragging');
    }
    place(drag.current.x + dx, drag.current.y + dy);
  };

  const endDrag = () => {
    if (!drag.current) return;
    drag.current = null;
    wrapRef.current?.classList.remove('dragging');
    if (!moved.current) return;
    const space = room();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        fx: space.w ? (position.current.x - EDGE_MARGIN) / space.w : 0,
        fy: space.h ? (position.current.y - EDGE_MARGIN) / space.h : 0
      }));
    } catch {
      // Without storage the position only lasts for this session
    }
  };

  const positions = useMemo(
    () => buildLayout(blueprint, { width: 200, height: 200, paddingX: 40, paddingY: 40, useExistingLayout: false }).positionById,
    [blueprint]
  );
  const discovered = useMemo(() => new Set(map.discoveredNodeIds), [map.discoveredNodeIds]);
  const npcNodes = useMemo(() => new Set(npcs.filter(npc => npc.alive).map(npc => npc.nodeId)), [npcs]);
  const current = positions.get(map.currentNodeId) || { x: 100, y: 100 };

  return (
    <div
      id="radar-wrap"
      ref={wrapRef}
      title={t('stage.radar.hint')}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onClick={event => {
        event.stopPropagation();
        if (moved.current) {
          moved.current = false;
          return;
        }
        onOpen();
      }}
    >
      <button id="radar" type="button" aria-label={t('stage.radar.open')}>
        <span className="sweep" />
        <svg id="radar-svg" viewBox="0 0 200 200" aria-hidden="true">
          <defs>
            <filter id="rd-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="1.5" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          <g className="rd-grid">
            <circle cx="100" cy="100" r="98" />
            <circle cx="100" cy="100" r="70" strokeDasharray="4 2" />
            <circle cx="100" cy="100" r="40" strokeDasharray="4 2" />
            <line x1="100" y1="0" x2="100" y2="200" />
            <line x1="0" y1="100" x2="200" y2="100" />
          </g>
          <g id="radar-g" style={{ transform: `translate(${100 - current.x * SCALE}px, ${100 - current.y * SCALE}px) scale(${SCALE})` }}>
            {blueprint.edges.map(edge => {
              const from = positions.get(edge.from);
              const to = positions.get(edge.to);
              if (!from || !to) return null;
              const known = discovered.has(edge.from) && discovered.has(edge.to);
              return (
                <line key={`${edge.from}-${edge.to}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={`rgba(51,255,0,${known ? 0.6 : 0.15})`} strokeWidth={known ? 1.5 : 1} />
              );
            })}
            {blueprint.nodes.map(node => {
              const point = positions.get(node.id);
              if (!point) return null;
              const { x, y } = point;
              const isCurrent = node.id === map.currentNodeId;
              const isKnown = discovered.has(node.id);
              return (
                <g key={node.id} filter={isKnown || isCurrent ? 'url(#rd-glow)' : undefined}>
                  <NodeShape x={x} y={y} danger={node.danger ?? 0} current={isCurrent} discovered={isKnown} />
                  {isCurrent && (
                    <g className="rd-reticle" style={{ transformOrigin: `${x}px ${y}px` }}>
                      {RETICLE.map(([dx, dy, w, h], index) => (
                        <rect key={index} x={x + dx} y={y + dy} width={w} height={h} style={{ fill: 'var(--accent)' }} />
                      ))}
                    </g>
                  )}
                  {node.id === blueprint.startNodeId && (
                    <text x={x - 12} y={y + 3} fontSize={9} fill="rgba(148,163,184,.9)" fontFamily="monospace">S</text>
                  )}
                  {isKnown && npcNodes.has(node.id) && <circle cx={x + 6} cy={y - 6} r={1.8} fill={COLORS.medium} />}
                  {objectives.filter(o => o.nodeId === node.id && o.status === 'ACTIVE').map(o => (
                    o.type === 'MAIN'
                      ? <circle key={o.id} cx={x} cy={y} r={6.5} fill="none" stroke="#7dd3fc" strokeWidth={0.8} strokeDasharray="2 1.4" />
                      : <rect key={o.id} x={x + 4.5} y={y + 3.5} width={3} height={3} fill="#38bdf8" />
                  ))}
                </g>
              );
            })}
          </g>
        </svg>
      </button>
      <div id="radar-loc">{locationName}</div>
    </div>
  );
};

export default RadarMinimap;
