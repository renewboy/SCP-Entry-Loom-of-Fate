import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { GameState, MapBlueprint, ObjectiveState, RuntimeMapState, RuntimeNPCState } from '../../types';
import { useTranslation } from '../../utils/i18n';
import { useNetworkView } from '../../hooks/useNetworkView';
import { pressOnButtonClick } from '../common/buttonPress';
import { playSfx, preloadSfx } from '../../services/sfxService';
import { buildNetworkLayout, dangerColor, fitNetworkView } from '../../utils/siteNetwork';
import { NpcDossier } from '../../utils/npcDossier';
import GameButton from '../common/GameButton';
import EntityPortrait from '../game/stage/EntityPortrait';
import NetworkBackdrop from '../game/stage/NetworkBackdrop';
import NetworkGraph from '../game/stage/NetworkGraph';
import NetworkLegend from '../game/stage/NetworkLegend';
import { ObjectiveIcon } from '../game/stage/NetworkNode';
import { StageFilters } from '../game/stage/StageOverlays';
import '../../styles/stage.css';
import '../../styles/stagePanels.css';
import '../../styles/tactical.css';

const STAMP_SOUND_MS = 1000;
/** Leaves room for the zoom buttons and the legend under the map */
const FIT_BOTTOM = 150;

interface TacticalBriefingProps {
  gameState: GameState;
  ready: boolean;
  isStarting: boolean;
  onBack: () => void;
  onEdit: () => void;
  onStart: () => void;
}

/** Everything the player knows before going in. Nothing here is secret: NPC secrets stay out */
const TacticalBriefing: React.FC<TacticalBriefingProps> = ({ gameState, ready, isStarting, onBack, onEdit, onStart }) => {
  const { t } = useTranslation();
  const scpData = gameState.scpData;
  const blueprint = scpData?.mapBlueprint as MapBlueprint | undefined;
  const npcImages = scpData?.npcImages;
  const background = scpData?.storyDraft?.backgroundImage || gameState.backgroundImage;
  const entityImage = scpData?.storyDraft?.entityImage || gameState.mainImage || undefined;

  const [selectedId, setSelectedId] = useState(blueprint?.startNodeId ?? '');
  const [zoomed, setZoomed] = useState<{ url: string; portrait: boolean } | null>(null);

  const positions = useMemo(() => (blueprint ? buildNetworkLayout(blueprint, false) : {}), [blueprint]);
  const network = useNetworkView({ positions, currentId: selectedId, minZoom: 0.25, maxZoom: 2.6, wheel: 'pan' });

  const map = useMemo<RuntimeMapState | null>(() => (blueprint ? {
    id: blueprint.id,
    title: blueprint.title,
    currentNodeId: selectedId,
    discoveredNodeIds: blueprint.nodes.map(node => node.id),
  } : null), [blueprint, selectedId]);
  const objectives = useMemo(() => (blueprint?.objectives ?? []).map(objective => ({ ...objective, status: 'ACTIVE' }) as ObjectiveState), [blueprint]);
  const dossiers = useMemo<NpcDossier[]>(() => (blueprint?.npcs ?? []).map(npc => ({
    npc: { ...npc, nodeId: npc.initialNodeId, alive: true } as unknown as RuntimeNPCState,
    met: true,
    quotes: [],
  })), [blueprint]);
  const sortedObjectives = useMemo(() => [...(blueprint?.objectives ?? [])].sort((a, b) => Number(a.type !== 'MAIN') - Number(b.type !== 'MAIN')), [blueprint]);

  const fit = useCallback(() => {
    const box = network.svgRef.current?.getBoundingClientRect();
    if (!box?.width || !box.height) return;
    const view = fitNetworkView(positions, box.width, box.height, { bottom: FIT_BOTTOM });
    if (view) network.setView(view);
  }, [network.setView, network.svgRef, positions]);

  useLayoutEffect(fit, [fit]);
  useEffect(() => {
    const svg = network.svgRef.current;
    if (!svg || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(fit);
    observer.observe(svg);
    return () => observer.disconnect();
  }, [fit, network.svgRef]);

  useEffect(() => {
    if (!ready) return;
    preloadSfx();
    const timer = setTimeout(() => playSfx('stamp'), STAMP_SOUND_MS);
    return () => clearTimeout(timer);
  }, [ready]);

  useEffect(() => {
    if (!zoomed) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setZoomed(null);
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [zoomed]);

  const nodeFromEvent = (target: EventTarget) => (target as Element).closest?.('[data-id]')?.getAttribute('data-id');
  const rowProps = (nodeId: string) => ({
    className: `tb-row ${nodeId === selectedId ? 'on' : ''}`,
    onPointerEnter: () => setSelectedId(nodeId),
    onFocus: () => setSelectedId(nodeId),
    onClick: () => setSelectedId(nodeId),
  });

  if (!scpData || !blueprint || !map) return null;

  const selected = blueprint.nodes.find(node => node.id === selectedId);
  const selectedNpcs = blueprint.npcs.filter(npc => npc.initialNodeId === selectedId);
  const selectedObjectives = blueprint.objectives.filter(objective => objective.nodeId === selectedId);
  const nodeName = (id: string) => blueprint.nodes.find(node => node.id === id)?.name ?? '';
  const objectiveType = (type: string) => t(type === 'MAIN' ? 'map_editor.obj_main' : 'map_editor.obj_side');

  return (
    <div className="stage-root">
      <StageFilters />
      <section className={`p3-view tac ${ready ? 'ready' : ''}`}>
        {background && <div className="tac-bg" style={{ backgroundImage: `url(${background})` }} />}
        <aside className="tac-brief" aria-label={t('map_editor.mission_brief')}>
          <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
            <filter id="tac-ink-edge" x="-10%" y="-10%" width="120%" height="120%">
              <feTurbulence type="fractalNoise" baseFrequency=".07" numOctaves={2} seed={4} />
              <feDisplacementMap in="SourceGraphic" scale="1.8" />
            </filter>
          </svg>
          <div className="tb-top">
            <div className="meta-line fate">{t('map_editor.mission_brief')}</div>
          </div>
          <div className="tb-id">
            {entityImage && <EntityPortrait src={entityImage} appendix={t('app.appendix')} designation={scpData.designation} onClick={() => setZoomed({ url: entityImage, portrait: true })} />}
            <div className="tb-name">
              <h2>{scpData.designation}</h2>
              <p>{scpData.name}</p>
              <span>{scpData.containmentClass?.toUpperCase()}</span>
            </div>
            <div className="tb-stamp"><b>{t('map_editor.top_secret')}</b><span>{t('map_editor.eyes_only')}</span></div>
          </div>
          <dl className="tb-facts">
            <div><dt>{t('map_editor.brief_operative')}</dt><dd>{scpData.role || gameState.role}</dd></div>
            <div><dt>{t('map_editor.brief_location')}</dt><dd>{blueprint.title}</dd></div>
          </dl>
          {sortedObjectives.length > 0 && (
            <section className="tb-sec">
              <div className="nx-title">{t('map_editor.objectives')}</div>
              {sortedObjectives.map(objective => (
                <button key={objective.id} type="button" {...rowProps(objective.nodeId)}>
                  <ObjectiveIcon type={objective.type} />
                  <span><b>{objective.title}</b><small>{objectiveType(objective.type)} · {nodeName(objective.nodeId)}</small></span>
                </button>
              ))}
            </section>
          )}
          {blueprint.npcs.length > 0 && (
            <section className="tb-sec">
              <div className="nx-title">{t('map_editor.brief_personnel')}</div>
              {blueprint.npcs.map(npc => (
                <button key={npc.id} type="button" {...rowProps(npc.initialNodeId)}>
                  {npcImages?.[npc.id] ? <img className="ri-face" src={npcImages[npc.id]} alt="" /> : <i className="ri-q">?</i>}
                  <span><b>{npc.name}</b><small>{npc.archetype}</small></span>
                </button>
              ))}
            </section>
          )}
          <div className="tb-note">
            <div className="meta-line">{t('map_editor.intel_summary')}</div>
            <p>{t('map_editor.preview_hint')}</p>
          </div>
        </aside>

        <div className="tac-right">
          <header className="tac-head">
            <div className="meta-line fate">{t('map_editor.secure_terminal')}</div>
            <h1>{blueprint.title}</h1>
            <div className="net-stats">{t('map_editor.brief_stats', { nodes: blueprint.nodes.length, edges: blueprint.edges.length, npcs: blueprint.npcs.length, objectives: blueprint.objectives.length })}</div>
          </header>
          <div className="tac-map">
            <NetworkBackdrop />
            <svg
              ref={network.svgRef}
              className="net-svg"
              role="img"
              aria-label={blueprint.title}
              onPointerDown={network.onPointerDown}
              onPointerOver={event => {
                const id = nodeFromEvent(event.target);
                if (id && event.pointerType === 'mouse' && !event.buttons) setSelectedId(id);
              }}
              onClick={event => {
                const id = nodeFromEvent(event.target);
                if (id && !network.draggedRef.current) setSelectedId(id);
              }}
            >
              <g ref={network.worldRef}>
                <NetworkGraph
                  blueprint={blueprint}
                  map={map}
                  positions={positions}
                  compact={false}
                  objectives={objectives}
                  inventory={[]}
                  dossiers={dossiers}
                  route={[]}
                  npcImages={npcImages}
                  selectedId={selectedId}
                  idPrefix="tac"
                  focusable
                  rings={false}
                  t={t}
                />
              </g>
            </svg>
            <div className="tac-tools">
              <GameButton variant="icon" aria-label={t('stage.network.zoom_in')} onClick={() => network.zoomCenter(1.2)}>+</GameButton>
              <GameButton variant="icon" aria-label={t('stage.network.zoom_out')} onClick={() => network.zoomCenter(1 / 1.2)}>−</GameButton>
              <GameButton variant="icon" aria-label={t('stage.network.reset')} onClick={fit}>⟲</GameButton>
              <NetworkLegend className="legend" inGame={false} t={t} />
            </div>
          </div>
          <div className="tac-intel">
            {selected && (
              <>
                <div>
                  <div className="ti-name">{selected.name}</div>
                  <div className="ti-danger">
                    {t('stage.network.danger')} <b style={{ color: dangerColor(selected.danger ?? 0) }}>{selected.danger ?? 0}</b>
                    {selected.id === blueprint.startNodeId && <span>{t('game.map_start')}</span>}
                  </div>
                  {(selected.requires ?? []).length > 0 && <p className="ti-gate"><em>⊘ {t('stage.network.locked')}</em>{selected.blockedText}</p>}
                </div>
                <div className="ti-list">
                  {selectedNpcs.length > 0 && (
                    <>
                      <i>{t('map_editor.brief_people')}</i>
                      {selectedNpcs.map(npc => <div key={npc.id}><b>{npc.name}</b> {npc.archetype}</div>)}
                    </>
                  )}
                  {selectedObjectives.length > 0 && (
                    <>
                      <i>{t('map_editor.objectives')}</i>
                      {selectedObjectives.map(objective => <div key={objective.id}>{objectiveType(objective.type)} · {objective.title}</div>)}
                    </>
                  )}
                  {selectedNpcs.length === 0 && selectedObjectives.length === 0 && <i>{t('map_editor.brief_nothing_here')}</i>}
                </div>
              </>
            )}
          </div>
          <div className="tac-actions" onClickCapture={pressOnButtonClick}>
            <GameButton variant="quiet" disabled={isStarting} onClick={onBack}>← {t('common.back')}</GameButton>
            <div className="grp">
              <span className="tac-status">{t('map_editor.status_ready')}<br />{t('map_editor.awaiting_command')}</span>
              <div className="tac-btns">
                <GameButton disabled={isStarting} onClick={onEdit}>{t('map_editor.btn_edit_story')}</GameButton>
                <button type="button" className="weave-btn" disabled={isStarting} onClick={onStart}>
                  {t('map_editor.continue_game')}<i>&gt;&gt;&gt;</i>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
      {zoomed && (
        <div id="lightbox" role="dialog" onClick={() => setZoomed(null)}>
          <EntityPortrait className="zoomed" src={zoomed.url} appendix={t('app.appendix')} designation={scpData.designation} />
        </div>
      )}
    </div>
  );
};

export default TacticalBriefing;
