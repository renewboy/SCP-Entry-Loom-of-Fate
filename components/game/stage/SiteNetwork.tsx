import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Maximize2, Minimize2, RotateCcw } from 'lucide-react';
import { ItemState, MapBlueprint, MapBlueprintNode, ObjectiveState, RuntimeMapState } from '../../../types';
import { NpcDossier } from '../../../utils/npcDossier';
import { canHover } from './BeatText';
import {
  buildNetworkLayout,
  buildRoutePath,
  dangerColor,
  missingRequirements,
  NETWORK_GEOMETRY,
  neighborsOf,
  networkCurve,
} from '../../../utils/siteNetwork';

const SWITCH_MS = 560;
const HOVER_SELECT_MS = 140;
const DRAG_THRESHOLD = 4;
const FULL_MIN_WIDTH = 760;
const MAIN_RING = '#7dd3fc';
const SIDE_MARK = '#38bdf8';
const NPC_RING = '#f59e0b';

const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));

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

const NetworkLegend: React.FC<{ legendRef: React.Ref<HTMLDivElement>; t: SiteNetworkProps['t'] }> = ({ legendRef, t }) => (
  <div className="net-legend" ref={legendRef}>
    <span><svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="4.5" fill="#33ff00" /></svg>{t('stage.network.legend_low')}</span>
    <span><svg width="14" height="14" viewBox="0 0 14 14"><polygon points="13,7 10,12.2 4,12.2 1,7 4,1.8 10,1.8" fill="#f59e0b" /></svg>{t('stage.network.legend_medium')}</span>
    <span><svg width="14" height="14" viewBox="0 0 14 14"><polygon points="7,1 13,12 1,12" fill="#ef4444" /></svg>{t('stage.network.legend_high')}</span>
    <span><b className="lg-q">?</b>{t('stage.network.unknown')}</span>
    <span><i className="lg-thread" />{t('stage.network.legend_route')}</span>
    <span><svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="5.5" fill="none" stroke={MAIN_RING} strokeDasharray="2.4 1.8" /></svg>{t('game.map_main_hint')}</span>
    <span><svg width="14" height="14" viewBox="0 0 14 14"><rect x="3.5" y="3.5" width="7" height="7" fill={SIDE_MARK} /></svg>{t('game.map_side_hint')}</span>
    <span><b className="lg-q">S</b>{t('game.map_start')}</span>
    <span><b className="lg-lock">⊘</b>{t('stage.network.legend_gate')}</span>
  </div>
);

interface SiteNetworkProps {
  open: boolean;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
  onClose: () => void;
  blueprint: MapBlueprint;
  map: RuntimeMapState;
  objectives: ObjectiveState[];
  inventory: ItemState[];
  dossiers: NpcDossier[];
  route: string[];
  npcImages?: Record<string, string>;
  backgroundImage?: string | null;
  onAction: (command: string) => void;
  t: (key: string, params?: Record<string, string | number>) => any;
}

/** The site map: a drawer beside the stage by default, with a full-screen mode for looking around */
const SiteNetwork: React.FC<SiteNetworkProps> = ({ open, fullscreen, onToggleFullscreen, onClose, blueprint, map, objectives, inventory, dossiers, route, npcImages, backgroundImage, onAction, t }) => {
  const rootRef = useRef<HTMLElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const worldRef = useRef<SVGGElement>(null);
  const sweepRef = useRef<HTMLDivElement>(null);
  const coordRef = useRef<HTMLSpanElement>(null);
  const headRef = useRef<HTMLElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const legendRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef({ x: 0, y: 0, k: 1 });
  const hoverRef = useRef<{ id: string | null; timer?: ReturnType<typeof setTimeout> }>({ id: null });
  const draggedRef = useRef(false);

  const [tall, setTall] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [selectedId, setSelectedId] = useState(map.currentNodeId);
  const [openCount, setOpenCount] = useState(0);

  const currentId = map.currentNodeId;
  const geometry = tall ? NETWORK_GEOMETRY.tall : NETWORK_GEOMETRY.wide;
  const positions = useMemo(() => buildNetworkLayout(blueprint, tall), [blueprint, tall]);
  const known = useMemo(() => new Set(map.discoveredNodeIds), [map.discoveredNodeIds]);
  const nodeById = useMemo(() => new Map(blueprint.nodes.map(node => [node.id, node])), [blueprint]);
  const dossierAt = useCallback((nodeId: string) => dossiers.filter(entry => entry.npc.alive && entry.npc.nodeId === nodeId), [dossiers]);
  const objectivesAt = useCallback((nodeId: string) => objectives.filter(objective => objective.nodeId === nodeId), [objectives]);
  const routePath = useMemo(() => buildRoutePath(route, positions, tall), [route, positions, tall]);

  const paint = useCallback(() => {
    const { x, y, k } = viewRef.current;
    worldRef.current?.setAttribute('transform', `translate(${x} ${y}) scale(${k})`);
    const here = positions[currentId];
    if (here && sweepRef.current) sweepRef.current.style.transform = `translate(${x + here.x * k}px, ${y + here.y * k}px) scale(${k})`;
    if (coordRef.current) coordRef.current.textContent = `COORD ${Math.round(x)},${Math.round(y)} · ${Math.round(k * 100)}%`;
  }, [positions, currentId]);

  const fit = useCallback(() => {
    const svg = svgRef.current;
    const panel = panelRef.current;
    const here = positions[currentId];
    if (!svg || !panel || !here) return;
    const area = svg.getBoundingClientRect();
    if (!area.width || !area.height) return;
    const panelBox = panel.getBoundingClientRect();
    const areaW = tall ? area.width : area.width - panelBox.width;
    const areaH = tall ? area.height - panelBox.height : area.height;
    const points = Object.values(positions);
    const xs = points.map(point => point.x);
    const ys = points.map(point => point.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const { padLeft, padRight, padY } = geometry;
    const width = maxX - minX + padLeft + padRight;
    const height = maxY - minY + padY * 2;
    const middleX = (minX - padLeft + maxX + padRight) / 2;
    const view = viewRef.current;
    if (tall) {
      const top = (headRef.current?.getBoundingClientRect().bottom ?? area.top) - area.top + 4;
      const room = areaH - top - (legendRef.current?.getBoundingClientRect().height ?? 0) - 10;
      view.k = clamp(Math.min(areaW / width, room / height), 0.85, 1);
      const graphH = height * view.k;
      view.x = width * view.k <= areaW ? areaW / 2 - middleX * view.k : areaW / 2 - here.x * view.k;
      view.y = graphH <= room ? top + (room - graphH) / 2 + (padY - minY) * view.k : top + room / 2 - here.y * view.k;
    } else {
      view.k = clamp(Math.min(areaW / width, areaH / height), 0.5, 1.28);
      view.x = areaW / 2 - ((minX + maxX) / 2) * view.k;
      view.y = areaH / 2 - ((minY + maxY) / 2) * view.k + 12;
    }
    paint();
  }, [positions, currentId, tall, geometry, paint]);

  const measure = useCallback(() => {
    const box = rootRef.current?.getBoundingClientRect();
    if (!box || !box.width) return;
    setTall(box.width < FULL_MIN_WIDTH || box.height > box.width);
  }, []);

  // The layout swaps axes between the two modes, so it fades through the resize instead of morphing
  const previousFullscreen = useRef(fullscreen);
  useEffect(() => {
    if (previousFullscreen.current === fullscreen) return;
    previousFullscreen.current = fullscreen;
    setSwitching(true);
    const timer = setTimeout(() => {
      setSwitching(false);
      measure();
    }, SWITCH_MS);
    return () => clearTimeout(timer);
  }, [fullscreen, measure]);

  useLayoutEffect(() => {
    if (!switching) fit();
  }, [fit, switching, open]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      if (root.classList.contains('switching')) return;
      measure();
      fit();
    });
    observer.observe(root);
    return () => observer.disconnect();
  }, [measure, fit]);

  useEffect(() => {
    setSelectedId(currentId);
  }, [currentId]);

  useEffect(() => {
    if (!open) return;
    setSelectedId(currentId);
    setOpenCount(count => count + 1);
  }, [open]);

  useEffect(() => () => {
    clearTimeout(hoverRef.current.timer);
  }, []);

  const onPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (event.button) return;
    const start = { px: event.clientX, py: event.clientY, x: viewRef.current.x, y: viewRef.current.y };
    const svg = svgRef.current;
    draggedRef.current = false;
    const onMove = (move: PointerEvent) => {
      const dx = move.clientX - start.px;
      const dy = move.clientY - start.py;
      if (!draggedRef.current && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      draggedRef.current = true;
      svg?.classList.add('grabbing');
      viewRef.current.x = start.x + dx;
      viewRef.current.y = start.y + dy;
      paint();
    };
    const onUp = () => {
      svg?.classList.remove('grabbing');
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  const zoomAt = useCallback((factor: number, cx: number, cy: number) => {
    const view = viewRef.current;
    const k = clamp(view.k * factor, 0.45, 2.4);
    view.x = cx - (cx - view.x) * (k / view.k);
    view.y = cy - (cy - view.y) * (k / view.k);
    view.k = k;
    paint();
  }, [paint]);

  // React attaches wheel listeners as passive, and zooming has to stop the page scrolling
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const box = svg.getBoundingClientRect();
      zoomAt(event.deltaY < 0 ? 1.1 : 0.9, event.clientX - box.left, event.clientY - box.top);
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  const zoomCenter = (factor: number) => {
    const box = svgRef.current?.getBoundingClientRect();
    if (box) zoomAt(factor, box.width / 2, box.height / 2);
  };

  const nodeIdFrom = (target: EventTarget) => (target as Element).closest?.('.net-node')?.getAttribute('data-id') ?? null;

  // Resting on a node is enough to read it; passing over one on the way to the panel is not
  const onPointerOver = (event: React.PointerEvent<SVGSVGElement>) => {
    if (event.pointerType === 'touch' || !canHover()) return;
    const id = nodeIdFrom(event.target);
    const hover = hoverRef.current;
    if (id === hover.id) return;
    hover.id = id;
    clearTimeout(hover.timer);
    if (id) hover.timer = setTimeout(() => setSelectedId(id), HOVER_SELECT_MS);
  };

  const selected = nodeById.get(selectedId) || nodeById.get(currentId);
  const go = (node: MapBlueprintNode) => onAction(`${t('game.map_go')} ${node.name}`);

  const renderPanel = () => {
    if (!selected) return null;
    const isKnown = known.has(selected.id);
    const isCurrent = selected.id === currentId;
    const missing = missingRequirements(selected, inventory);
    const gated = (selected.requires || []).length > 0;
    const adjacent = neighborsOf(blueprint, currentId).includes(selected.id);
    const danger = selected.danger ?? 0;
    const color = dangerColor(danger);
    const here = objectivesAt(selected.id);
    const people = dossierAt(selected.id);
    return (
      <div className="nx-scroll">
        <div className={`meta-line ${isCurrent ? 'sys' : 'dim'}`}>{t(isCurrent ? 'stage.network.here' : isKnown ? 'stage.network.known' : 'stage.network.unknown')}</div>
        <h2>{selected.name}</h2>
        <div className="nx-danger">
          <span>DANGER</span>
          <b style={{ color }}>{danger}</b>
          <div className="nx-ticks">{Array.from({ length: 20 }, (_, i) => <i key={i} style={i < Math.round(danger / 5) ? { background: color } : undefined} />)}</div>
        </div>
        {missing.length > 0 && (
          <div className="nx-lock">
            <div className="meta-line">⊘ {t('stage.network.locked')}</div>
            {selected.blockedText && <p>{selected.blockedText}</p>}
          </div>
        )}
        {missing.length === 0 && gated && <div className="nx-pass">✓ {t('stage.network.authorized')}</div>}
        {!isCurrent && adjacent && missing.length === 0 && (
          <button type="button" className="nx-go" onClick={() => go(selected)}>{t('game.map_go')} {selected.name}<span>→</span></button>
        )}
        {!isCurrent && adjacent && missing.length > 0 && <button type="button" className="nx-go off" disabled>⊘ {t('stage.network.blocked')}</button>}
        {!isCurrent && !adjacent && <div className="nx-note">{t('stage.network.not_adjacent')}</div>}

        {isCurrent && (
          <section>
            <div className="nx-title">{t('game.map_adjacency')}</div>
            {neighborsOf(blueprint, currentId).map(id => {
              const next = nodeById.get(id);
              if (!next) return null;
              const blocked = missingRequirements(next, inventory).length > 0;
              return (
                <div key={id} className={`nx-adj ${blocked ? 'blocked' : ''}`} onClick={() => setSelectedId(id)}>
                  <div className="nx-adj-row">
                    <span>{next.name}</span>
                    {blocked
                      ? <em>⊘ {t('stage.network.legend_gate')}</em>
                      : <button type="button" className="nx-mini" onClick={event => { event.stopPropagation(); go(next); }}>{t('game.map_go')}</button>}
                  </div>
                  {blocked && next.blockedText && <p>{next.blockedText}</p>}
                </div>
              );
            })}
          </section>
        )}

        <section>
          <div className="nx-title">{t('game.map_npc')}</div>
          {!isKnown && !isCurrent && <div className="nx-empty">???</div>}
          {(isKnown || isCurrent) && people.length === 0 && <div className="nx-empty">{t('stage.network.nobody')}</div>}
          {(isKnown || isCurrent) && people.map(({ npc, met }) => (
            met ? (
              <div key={npc.id} className="nx-person">
                <span className="nx-face" style={npcImages?.[npc.id] ? { backgroundImage: `url("${npcImages[npc.id]}")` } : undefined} />
                <div><b>{npc.name}</b><span>{npc.archetype}</span></div>
                {isCurrent && <button type="button" className="nx-mini" onClick={() => onAction(`${t('game.map_talk')} ${npc.name}`)}>{t('game.map_talk')}</button>}
              </div>
            ) : (
              <div key={npc.id} className="nx-person unknown">
                <span className="nx-face q">?</span>
                <div><b>{t('stage.dossier.unknown_name')}</b><span>{t('stage.dossier.unmet')}</span></div>
              </div>
            )
          ))}
        </section>

        <section>
          <div className="nx-title">{t('game.map_objectives')}</div>
          {here.length === 0 && <div className="nx-empty">{t('stage.network.none')}</div>}
          {here.length > 0 && !isKnown && !isCurrent && !here.some(objective => objective.type === 'MAIN') && <div className="nx-empty">???</div>}
          {(isKnown || isCurrent || here.some(objective => objective.type === 'MAIN')) && here.map(objective => {
            const progress = clamp(Math.round(objective.progress), 0, 100);
            const status = objective.status === 'COMPLETED' ? 'completed' : objective.status === 'FAILED' ? 'failed' : 'active';
            return (
              <button type="button" key={objective.id} className="nx-obj" onClick={() => onAction(`${t('game.map_review_objective')} [${objective.title}]`)}>
                <span className="nx-obj-head"><span className={objective.type === 'MAIN' ? 'main' : 'side'}>{objective.type}</span><b>{objective.title}</b></span>
                <span className="nx-bar"><i style={{ width: `${progress}%` }} /></span>
                <span className={`nx-obj-meta ${status}`}>{progress}% · {t(`game.map_status_${status}`)}</span>
                {objective.detail && <span className="nx-obj-detail">{objective.detail}</span>}
              </button>
            );
          })}
        </section>
      </div>
    );
  };

  return (
    <aside
      ref={rootRef}
      className={`drawer right net ${open ? 'open' : ''} ${fullscreen ? 'full' : ''} ${tall ? 'tall' : ''} ${switching ? 'switching' : ''}`}
      aria-label={t('stage.drawer.map')}
    >
      {backgroundImage && <div className="net-bg" style={{ backgroundImage: `url("${backgroundImage}")` }} />}
      <div className="net-sweep" ref={sweepRef} aria-hidden="true">{open && <i />}</div>
      <svg
        ref={svgRef}
        className="net-svg"
        aria-label={t('stage.network.title')}
        onPointerDown={onPointerDown}
        onPointerOver={onPointerOver}
        onClick={event => {
          if (draggedRef.current) return;
          const id = nodeIdFrom(event.target);
          if (id) setSelectedId(id);
        }}
        onKeyDown={event => {
          const id = nodeIdFrom(event.target);
          if (id && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            event.stopPropagation();
            setSelectedId(id);
          }
        }}
      >
        <defs>
          <filter id="net-edge-glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.6" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          <filter id="net-thread-glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3.4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>
        <g ref={worldRef}>
          <g className="net-rings">
            {positions[currentId] && geometry.rings.map(radius => <circle key={radius} cx={positions[currentId].x} cy={positions[currentId].y} r={radius} />)}
          </g>
          {blueprint.edges.map(edge => {
            const a = positions[edge.from];
            const b = positions[edge.to];
            if (!a || !b) return null;
            const seen = known.has(edge.from) && known.has(edge.to);
            const lit = edge.from === selectedId || edge.to === selectedId;
            return <path key={`${edge.from}-${edge.to}`} className={`net-edge ${seen ? 'seen' : ''} ${lit ? 'lit' : ''}`} d={`M ${a.x} ${a.y} ${networkCurve(a, b, tall)}`} />;
          })}
          {routePath && <path key={`${tall}-${openCount}`} className="net-thread" pathLength={1} d={routePath} />}
          {blueprint.nodes.map(node => {
            const point = positions[node.id];
            if (!point) return null;
            const { x, y } = point;
            const danger = node.danger ?? 0;
            const isKnown = known.has(node.id);
            const isCurrent = node.id === currentId;
            const missing = missingRequirements(node, inventory);
            const gated = (node.requires || []).length > 0;
            const labelX = tall ? x + 28 : x;
            const anchor = tall ? 'start' : 'middle';
            const people = isKnown || isCurrent ? dossierAt(node.id) : [];
            return (
              <g key={node.id} data-id={node.id} tabIndex={0} role="button" aria-label={node.name} className={`net-node ${isKnown ? 'known' : 'unknown'} ${isCurrent ? 'current' : ''} ${node.id === selectedId ? 'selected' : ''}`}>
                <circle className="n-hit" cx={x} cy={y} r={geometry.hit} />
                {danger > 70 && <circle className="n-ping" cx={x} cy={y} r={geometry.ring} stroke="#ef4444" style={{ transformOrigin: `${x}px ${y}px` }} />}
                <circle className="n-ring" cx={x} cy={y} r={geometry.ring} style={isKnown ? { stroke: dangerColor(danger) } : undefined} />
                <NodeMark x={x} y={y} danger={danger} known={isKnown} current={isCurrent} scale={geometry.mark} />
                {objectivesAt(node.id).filter(objective => objective.status === 'ACTIVE').map(objective => (
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
                  const cx = tall ? x + 16 - index * 14 : x + 46 + index * 20;
                  const cy = tall ? y - 15 : y - 28;
                  const radius = geometry.face;
                  const image = met ? npcImages?.[npc.id] : undefined;
                  return (
                    <g key={npc.id} className="n-face">
                      <circle cx={cx} cy={cy} r={radius} fill="#0b0b0c" />
                      {image && (
                        <>
                          <clipPath id={`net-face-${npc.id}`}><circle cx={cx} cy={cy} r={radius} /></clipPath>
                          <image href={image} x={cx - radius} y={cy - radius} width={radius * 2} height={radius * 2} clipPath={`url(#net-face-${npc.id})`} preserveAspectRatio="xMidYMin slice" />
                        </>
                      )}
                      {!image && <text x={cx} y={cy + 1} className="n-face-q" textAnchor="middle" dominantBaseline="middle">?</text>}
                      <circle cx={cx} cy={cy} r={radius} fill="none" stroke={NPC_RING} strokeWidth={1.2} />
                    </g>
                  );
                })}
                {node.id === blueprint.startNodeId && <text className="n-start" x={x - geometry.start} y={y + 4}>S</text>}
                <text className="n-name" x={labelX} y={tall ? y - 1 : y - 50} textAnchor={anchor}>{node.name}</text>
                <text className="n-danger" x={labelX} y={tall ? y + 13 : y + 54} textAnchor={anchor} style={danger > 70 ? { fill: '#ef4444' } : undefined}>
                  DANGER {danger}
                  {tall && gated && (missing.length
                    ? <tspan className="n-lock" dx={7}>⊘ {t('stage.network.legend_gate')}</tspan>
                    : <tspan className="n-pass" dx={7}>✓</tspan>)}
                </text>
                {!tall && gated && (missing.length
                  ? <text className="n-lock" x={labelX} y={y + 72} textAnchor={anchor}>⊘ {t('stage.network.locked')}</text>
                  : <text className="n-pass" x={labelX} y={y + 72} textAnchor={anchor}>✓ {t('stage.network.authorized_short')}</text>)}
              </g>
            );
          })}
        </g>
      </svg>
      <div className="grain" aria-hidden="true" />
      <div className="vignette" aria-hidden="true" />
      <header className="net-head" ref={headRef}>
        <div className="meta-line fate">{t('stage.network.title')}</div>
        <h1>{map.title || blueprint.title}</h1>
        <div className="net-sub">{t('stage.network.summary', { total: blueprint.nodes.length, known: known.size, locked: blueprint.nodes.filter(node => missingRequirements(node, inventory).length > 0).length })}</div>
      </header>
      <section className="net-panel" ref={panelRef}>{renderPanel()}</section>
      <div className="net-tools">
        <button type="button" aria-label={t('stage.network.zoom_in')} onClick={() => zoomCenter(1.2)}>+</button>
        <button type="button" aria-label={t('stage.network.zoom_out')} onClick={() => zoomCenter(0.83)}>−</button>
        <button type="button" aria-label={t('stage.network.reset')} onClick={fit}><RotateCcw size={13} strokeWidth={1.75} /></button>
        <span ref={coordRef} />
      </div>
      <NetworkLegend legendRef={legendRef} t={t} />
      <div className="net-actions">
        <button type="button" className="net-mode" aria-pressed={fullscreen} onClick={onToggleFullscreen}>
          {fullscreen ? <Minimize2 size={13} strokeWidth={1.8} /> : <Maximize2 size={13} strokeWidth={1.8} />}
          {t(fullscreen ? 'stage.network.collapse' : 'stage.network.fullscreen')} <kbd>F</kbd>
        </button>
        <button type="button" aria-label={t('stage.log.close')} onClick={onClose}>✕ <kbd>M</kbd></button>
      </div>
    </aside>
  );
};

export default SiteNetwork;
