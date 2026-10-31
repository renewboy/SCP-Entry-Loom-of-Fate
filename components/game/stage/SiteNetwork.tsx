import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Maximize2, Minimize2, RotateCcw } from 'lucide-react';
import { ItemState, MapBlueprint, MapBlueprintNode, ObjectiveState, RuntimeMapState } from '../../../types';
import { NetworkView, useNetworkView } from '../../../hooks/useNetworkView';
import { NpcDossier } from '../../../utils/npcDossier';
import {
  buildNetworkLayout,
  dangerColor,
  missingRequirements,
  NETWORK_GEOMETRY,
  neighborsOf,
} from '../../../utils/siteNetwork';
import GameButton from '../../common/GameButton';
import { canHover } from './BeatText';
import NetworkGraph, { MAIN_RING, SIDE_MARK } from './NetworkGraph';

const SWITCH_MS = 560;
const HOVER_SELECT_MS = 140;
const FULL_MIN_WIDTH = 760;

const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));

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
  /** The zone to show first when the map opens; the current location if not given */
  focusNodeId?: string | null;
  onAction: (command: string) => void;
  t: (key: string, params?: Record<string, string | number>) => any;
}

/** The site map: a drawer beside the stage by default, with a full-screen mode for looking around */
const SiteNetwork: React.FC<SiteNetworkProps> = ({ open, fullscreen, onToggleFullscreen, onClose, blueprint, map, objectives, inventory, dossiers, route, npcImages, backgroundImage, focusNodeId, onAction, t }) => {
  const rootRef = useRef<HTMLElement>(null);
  const coordRef = useRef<HTMLSpanElement>(null);
  const headRef = useRef<HTMLElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const legendRef = useRef<HTMLDivElement>(null);
  const hoverRef = useRef<{ id: string | null; timer?: ReturnType<typeof setTimeout> }>({ id: null });

  const [compact, setCompact] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [selectedId, setSelectedId] = useState(map.currentNodeId);
  const [openCount, setOpenCount] = useState(0);

  const currentId = map.currentNodeId;
  const geometry = compact ? NETWORK_GEOMETRY.compact : NETWORK_GEOMETRY.wide;
  const positions = useMemo(() => buildNetworkLayout(blueprint, compact), [blueprint, compact]);
  const known = useMemo(() => new Set(map.discoveredNodeIds), [map.discoveredNodeIds]);
  const nodeById = useMemo(() => new Map(blueprint.nodes.map(node => [node.id, node])), [blueprint]);
  const dossierAt = useCallback((nodeId: string) => dossiers.filter(entry => entry.npc.alive && entry.npc.nodeId === nodeId), [dossiers]);
  const objectivesAt = useCallback((nodeId: string) => objectives.filter(objective => objective.nodeId === nodeId), [objectives]);

  const writeCoord = useCallback(({ x, y, k }: NetworkView) => {
    if (coordRef.current) coordRef.current.textContent = `COORD ${Math.round(x)},${Math.round(y)} · ${Math.round(k * 100)}%`;
  }, []);
  const network = useNetworkView({ positions, currentId, onPaint: writeCoord });

  const fit = useCallback(() => {
    const svg = network.svgRef.current;
    const panel = panelRef.current;
    const here = positions[currentId];
    if (!svg || !panel || !here) return;
    const area = svg.getBoundingClientRect();
    if (!area.width || !area.height) return;
    const panelBox = panel.getBoundingClientRect();
    const areaW = compact ? area.width : area.width - panelBox.width;
    const areaH = compact ? area.height - panelBox.height : area.height;
    const points = Object.values(positions);
    const xs = points.map(point => point.x);
    const ys = points.map(point => point.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const { padLeft, padRight, padTop, padBottom } = geometry;
    const width = maxX - minX + padLeft + padRight;
    const height = maxY - minY + padTop + padBottom;
    const top = compact ? (headRef.current?.getBoundingClientRect().bottom ?? area.top) - area.top + 4 : 0;
    const room = compact ? areaH - top - (legendRef.current?.getBoundingClientRect().height ?? 0) - 10 : areaH;
    const k = compact ? clamp(Math.min(areaW / width, room / height), 0.72, 1) : clamp(Math.min(areaW / width, room / height), 0.5, 1.28);
    const x = width * k <= areaW ? areaW / 2 - ((minX + maxX) / 2) * k : areaW / 2 - here.x * k;
    const y = height * k <= room ? top + (room - height * k) / 2 + (padTop - minY) * k : top + room / 2 - here.y * k;
    network.setView({ x, y, k });
  }, [positions, currentId, compact, geometry, network.setView, network.svgRef]);

  const measure = useCallback(() => {
    const box = rootRef.current?.getBoundingClientRect();
    if (!box || !box.width) return;
    setCompact(box.width < FULL_MIN_WIDTH || box.height > box.width);
  }, []);

  // The two modes lay out differently, so it fades through the resize instead of morphing
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
    setSelectedId(focusNodeId || currentId);
    setOpenCount(count => count + 1);
  }, [open, focusNodeId]);

  useEffect(() => () => {
    clearTimeout(hoverRef.current.timer);
  }, []);

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
          <GameButton variant="primary" block className="nx-go" onClick={() => go(selected)}>{t('game.map_go')} {selected.name}<span aria-hidden="true">→</span></GameButton>
        )}
        {!isCurrent && adjacent && missing.length > 0 && <GameButton variant="secondary" block className="nx-go" disabled>⊘ {t('stage.network.blocked')}</GameButton>}
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
                      : <GameButton size="sm" className="nx-mini" onClick={event => { event.stopPropagation(); go(next); }}>{t('game.map_go')}</GameButton>}
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
                {isCurrent && <GameButton size="sm" className="nx-mini" onClick={() => onAction(`${t('game.map_talk')} ${npc.name}`)}>{t('game.map_talk')}</GameButton>}
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
      className={`drawer right net ${open ? 'open' : ''} ${fullscreen ? 'full' : ''} ${compact ? 'compact' : ''} ${switching ? 'switching' : ''}`}
      aria-label={t('stage.drawer.map')}
    >
      {backgroundImage && <div className="net-bg" style={{ backgroundImage: `url("${backgroundImage}")` }} />}
      <div className="net-sweep" ref={network.sweepRef} aria-hidden="true">{open && <i />}</div>
      <svg
        ref={network.svgRef}
        className={`net-svg ${compact ? 'compact' : ''}`}
        aria-label={t('stage.network.title')}
        onPointerDown={network.onPointerDown}
        onPointerOver={onPointerOver}
        onClick={event => {
          if (network.draggedRef.current) return;
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
        <g ref={network.worldRef}>
          <NetworkGraph
            blueprint={blueprint}
            map={map}
            positions={positions}
            compact={compact}
            objectives={objectives}
            inventory={inventory}
            dossiers={dossiers}
            route={route}
            npcImages={npcImages}
            selectedId={selectedId}
            idPrefix="net"
            routeKey={`${compact}-${openCount}`}
            focusable
            t={t}
          />
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
        <GameButton variant="icon" aria-label={t('stage.network.zoom_in')} onClick={() => network.zoomCenter(1.2)}>+</GameButton>
        <GameButton variant="icon" aria-label={t('stage.network.zoom_out')} onClick={() => network.zoomCenter(0.83)}>−</GameButton>
        <GameButton variant="icon" aria-label={t('stage.network.reset')} onClick={fit}><RotateCcw size={13} strokeWidth={1.75} /></GameButton>
        <span ref={coordRef} />
      </div>
      <NetworkLegend legendRef={legendRef} t={t} />
      <div className="net-actions">
        <GameButton variant="quiet" size="sm" className="net-mode" aria-pressed={fullscreen} onClick={onToggleFullscreen}>
          {fullscreen ? <Minimize2 size={13} strokeWidth={1.8} /> : <Maximize2 size={13} strokeWidth={1.8} />}
          {t(fullscreen ? 'stage.network.collapse' : 'stage.network.fullscreen')} <kbd>F</kbd>
        </GameButton>
        <GameButton variant="quiet" size="sm" aria-label={t('stage.log.close')} onClick={onClose}>✕ <kbd>M</kbd></GameButton>
      </div>
    </aside>
  );
};

export default SiteNetwork;
