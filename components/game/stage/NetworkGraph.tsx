import React, { useMemo } from 'react';
import { ItemState, MapBlueprint, ObjectiveState, RuntimeMapState } from '../../../types';
import { NpcDossier } from '../../../utils/npcDossier';
import {
  buildRoutePath,
  missingRequirements,
  NETWORK_GEOMETRY,
  NetworkPoint,
  networkCurve,
} from '../../../utils/siteNetwork';
import NetworkNode from './NetworkNode';

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
  /** Range rings around the current zone */
  rings?: boolean;
  t: (key: string, params?: Record<string, string | number>) => any;
}

/** Everything inside a site map. The drawer, the full screen view and the minimap all draw this */
const NetworkGraph: React.FC<NetworkGraphProps> = ({ blueprint, map, positions, compact, objectives, inventory, dossiers, route, npcImages, selectedId, idPrefix, routeKey, focusable = false, rings = true, t }) => {
  const geometry = compact ? NETWORK_GEOMETRY.compact : NETWORK_GEOMETRY.wide;
  const currentId = map.currentNodeId;
  const known = useMemo(() => new Set(map.discoveredNodeIds), [map.discoveredNodeIds]);
  const routePath = useMemo(() => buildRoutePath(route, positions, compact), [route, positions, compact]);
  const here = positions[currentId];

  return (
    <>
      <g className="net-rings">
        {rings && here && geometry.rings.map(radius => <circle key={radius} cx={here.x} cy={here.y} r={radius} />)}
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
        const isKnown = known.has(node.id);
        const isCurrent = node.id === currentId;
        const gated = (node.requires || []).length > 0;
        const people = isKnown || isCurrent ? dossiers.filter(entry => entry.npc.alive && entry.npc.nodeId === node.id) : [];
        return (
          <NetworkNode
            key={node.id}
            node={node}
            point={point}
            compact={compact}
            known={isKnown}
            current={isCurrent}
            selected={node.id === selectedId}
            isStart={node.id === blueprint.startNodeId}
            marks={objectives.filter(objective => objective.nodeId === node.id && objective.status === 'ACTIVE')}
            faces={people.map(({ npc, met }) => ({ id: npc.id, image: met ? npcImages?.[npc.id] : undefined }))}
            gate={!gated ? null : missingRequirements(node, inventory).length ? 'locked' : 'authorized'}
            gateLabels={{ locked: t('stage.network.locked'), authorized: t('stage.network.authorized_short') }}
            idPrefix={idPrefix}
            focusable={focusable}
          />
        );
      })}
    </>
  );
};

export default NetworkGraph;
