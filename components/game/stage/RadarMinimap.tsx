import React, { useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import { RotateCcw } from 'lucide-react';
import { ItemState, MapBlueprint, ObjectiveState, RuntimeMapState } from '../../../types';
import { useNetworkView, NetworkView } from '../../../hooks/useNetworkView';
import { NpcDossier } from '../../../utils/npcDossier';
import { buildNetworkLayout } from '../../../utils/siteNetwork';
import GameButton from '../../common/GameButton';
import NetworkGraph from './NetworkGraph';

/** The default zoom follows the window, so a small one on a phone still shows the neighbouring zones */
const HOME_ZOOM_WIDTH = 270;
const HOME_ZOOM_RANGE = [0.3, 0.7];
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2.4;
/** Below this the labels would be too small to read */
const LABEL_ZOOM = 0.85;

interface RadarMinimapProps {
  blueprint: MapBlueprint;
  map: RuntimeMapState;
  objectives: ObjectiveState[];
  inventory: ItemState[];
  dossiers: NpcDossier[];
  route: string[];
  npcImages?: Record<string, string>;
  locationName: string;
  /** Opens the map, on the node that was clicked if there was one */
  onOpen: (nodeId?: string) => void;
  t: (key: string, params?: Record<string, string | number>) => any;
}

/** The same map as the drawer, seen through a round window: drag to look around, wheel or buttons to zoom */
const RadarMinimap: React.FC<RadarMinimapProps> = ({ blueprint, map, objectives, inventory, dossiers, route, npcImages, locationName, onOpen, t }) => {
  const positions = useMemo(() => buildNetworkLayout(blueprint, true), [blueprint]);
  const currentId = map.currentNodeId;
  const showLabels = useRef<boolean | null>(null);

  const syncLabels = useCallback((view: NetworkView) => {
    const next = view.k >= LABEL_ZOOM;
    if (next === showLabels.current) return;
    showLabels.current = next;
    network.svgRef.current?.classList.toggle('labels', next);
  }, []);

  const network = useNetworkView({ positions, currentId, minZoom: MIN_ZOOM, maxZoom: MAX_ZOOM, onPaint: syncLabels });

  const homeView = useCallback((): NetworkView | null => {
    const box = network.svgRef.current?.getBoundingClientRect();
    const here = positions[currentId];
    if (!box || !box.width || !here) return null;
    const k = Math.max(HOME_ZOOM_RANGE[0], Math.min(HOME_ZOOM_RANGE[1], box.width / HOME_ZOOM_WIDTH));
    return { k, x: box.width / 2 - here.x * k, y: box.height / 2 - here.y * k };
  }, [network.svgRef, positions, currentId]);

  const placed = useRef(false);
  useLayoutEffect(() => {
    const home = homeView();
    if (!home) return;
    if (placed.current) network.glideTo(home);
    else network.setView(home);
    placed.current = true;
  }, [currentId, homeView]);

  const reset = () => {
    const home = homeView();
    if (home) network.glideTo(home, 420);
  };

  return (
    <div id="radar-wrap" title={t('stage.radar.hint')}>
      <div
        id="radar"
        role="button"
        tabIndex={0}
        aria-label={t('stage.radar.open')}
        onKeyDown={event => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            event.stopPropagation();
            onOpen();
          }
        }}
      >
        <div className="net-sweep" ref={network.sweepRef} aria-hidden="true"><i /></div>
        <svg
          ref={network.svgRef}
          className="net-svg compact"
          aria-hidden="true"
          onPointerDown={network.onPointerDown}
          onClick={event => {
            if (network.draggedRef.current) return;
            const nodeId = (event.target as Element).closest?.('.net-node')?.getAttribute('data-id');
            onOpen(nodeId ?? undefined);
          }}
        >
          <g ref={network.worldRef}>
            <NetworkGraph
              blueprint={blueprint}
              map={map}
              positions={positions}
              compact
              objectives={objectives}
              inventory={inventory}
              dossiers={dossiers}
              route={route}
              npcImages={npcImages}
              idPrefix="radar"
              t={t}
            />
          </g>
        </svg>
      </div>
      <div id="radar-loc">{locationName}</div>
      <div className="rd-tools">
        <GameButton variant="icon" aria-label={t('stage.network.zoom_in')} onClick={() => network.zoomCenter(1.25)}>+</GameButton>
        <GameButton variant="icon" aria-label={t('stage.network.zoom_out')} onClick={() => network.zoomCenter(0.8)}>−</GameButton>
        <GameButton variant="icon" aria-label={t('stage.network.reset')} onClick={reset}><RotateCcw size={13} strokeWidth={1.75} /></GameButton>
      </div>
    </div>
  );
};

export default RadarMinimap;
