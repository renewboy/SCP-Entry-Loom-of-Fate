import React, { useMemo, useRef, useState } from 'react';
import { GameState } from '../../types';
import { useTranslation } from '../../utils/i18n';

interface MapPanelProps {
  gameState: GameState;
  onQuickAction: (text: string) => void;
}

const MapPanel: React.FC<MapPanelProps> = ({ gameState, onQuickAction }) => {
  const { t } = useTranslation();
  const blueprint = gameState.scpData?.mapBlueprint;
  const runtime = gameState.map;
  const minimapRef = useRef<HTMLDivElement | null>(null);
  const [viewTransform, setViewTransform] = useState({ scale: 1, x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panOrigin, setPanOrigin] = useState<{ x: number; y: number; originX: number; originY: number } | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);

  const data = useMemo(() => {
    if (!blueprint || !runtime) return null;

    const nodeById = new Map(blueprint.nodes.map(n => [n.id, n]));
    const currentNode = nodeById.get(runtime.currentNodeId) || null;
    const discoveredSet = new Set(runtime.discoveredNodeIds);

    const inventoryIds = new Set((gameState.inventory || []).map(i => i.id));
    const inventoryTags = new Set((gameState.inventory || []).flatMap(i => i.tags || []));
    const hasToken = (token: string) =>
      inventoryIds.has(token) || inventoryTags.has(token);

    const edges = blueprint.edges.filter(e =>
      e.from === runtime.currentNodeId || (e.bidirectional && e.to === runtime.currentNodeId)
    );

    const neighbors = edges.map(e => {
      const neighborId = e.from === runtime.currentNodeId ? e.to : e.from;
      const neighbor = nodeById.get(neighborId) || null;
      const req = Array.isArray(e.requires) ? e.requires : [];
      const missing = req.filter(token => !hasToken(token));
      const blocked = missing.length > 0;
      const reason = blocked ? e.blockedText : '';
      return {
        id: neighborId,
        name: neighbor?.name || neighborId,
        blocked,
        reason: reason || e.blockedText || ''
      };
    });

    const npcsHere = (gameState.npcs || []).filter(n => n.alive && n.nodeId === runtime.currentNodeId);
    const objectives = (gameState.objectives || []);

    const npcCountByNode = new Map<string, number>();
    const npcNamesByNode = new Map<string, string[]>();
    (gameState.npcs || []).forEach(npc => {
      if (!npc.alive) return;
      npcCountByNode.set(npc.nodeId, (npcCountByNode.get(npc.nodeId) || 0) + 1);
      const list = npcNamesByNode.get(npc.nodeId) || [];
      list.push(npc.name);
      npcNamesByNode.set(npc.nodeId, list);
    });

    const statusRank: Record<string, number> = { FAILED: 3, ACTIVE: 2, COMPLETED: 1 };
    const pickStatus = (statuses: string[]) => {
      const sorted = statuses.slice().sort((a, b) => (statusRank[b] || 0) - (statusRank[a] || 0));
      return sorted[0] || null;
    };

    const objectiveStatusByNode = new Map<string, { main?: string | null; side?: string | null }>();
    const objectivesByNode = new Map<string, typeof objectives>();
    objectives.forEach(obj => {
      const entry = objectiveStatusByNode.get(obj.nodeId) || {};
      const listKey = obj.type === 'MAIN' ? 'main' : 'side';
      const existing = entry[listKey] ? [entry[listKey] as string] : [];
      const nextStatus = pickStatus([...existing, obj.status]);
      entry[listKey] = nextStatus;
      objectiveStatusByNode.set(obj.nodeId, entry);
      const list = objectivesByNode.get(obj.nodeId) || [];
      list.push(obj);
      objectivesByNode.set(obj.nodeId, list);
    });

    const nodes = blueprint.nodes;
    const adjacency = new Map<string, Set<string>>();
    nodes.forEach(node => adjacency.set(node.id, new Set()));
    blueprint.edges.forEach(edge => {
      adjacency.get(edge.from)?.add(edge.to);
      if (edge.bidirectional) adjacency.get(edge.to)?.add(edge.from);
    });

    const startId = blueprint.startNodeId;
    const levelById = new Map<string, number>();
    const queue: string[] = [];
    if (startId) {
      levelById.set(startId, 0);
      queue.push(startId);
    }
    while (queue.length) {
      const current = queue.shift() as string;
      const level = levelById.get(current) ?? 0;
      const neighbors = Array.from(adjacency.get(current) || []);
      neighbors.forEach(next => {
        if (!levelById.has(next)) {
          levelById.set(next, level + 1);
          queue.push(next);
        }
      });
    }
    let maxLevel = 0;
    levelById.forEach(value => {
      if (value > maxLevel) maxLevel = value;
    });
    const fallbackLevel = maxLevel + 1;

    const levels = new Map<number, string[]>();
    nodes.forEach(node => {
      const level = levelById.get(node.id) ?? fallbackLevel;
      if (!levels.has(level)) levels.set(level, []);
      levels.get(level)?.push(node.id);
    });

    const width = 200;
    const height = 200;
    const paddingX = 18;
    const paddingY = 18;
    const levelCount = Math.max(1, levels.size);
    const levelGap = levelCount > 1 ? (width - paddingX * 2) / (levelCount - 1) : 0;

    const positionById = new Map<string, { x: number; y: number }>();
    Array.from(levels.entries()).sort((a, b) => a[0] - b[0]).forEach(([level, ids]) => {
      const count = ids.length;
      const gap = count > 1 ? (height - paddingY * 2) / (count - 1) : 0;
      ids.forEach((id, index) => {
        const x = paddingX + levelGap * level;
        const y = paddingY + (count > 1 ? gap * index : (height - paddingY * 2) / 2);
        positionById.set(id, { x, y });
      });
    });

    const labelOffsetById = new Map<string, { dx: number; dy: number }>();
    Array.from(levels.entries()).sort((a, b) => a[0] - b[0]).forEach(([, ids]) => {
      const sorted = ids.slice().sort((a, b) => {
        const ay = positionById.get(a)?.y ?? 0;
        const by = positionById.get(b)?.y ?? 0;
        return ay - by;
      });
      let lastY = -Infinity;
      let toggle = false;
      sorted.forEach(id => {
        const y = positionById.get(id)?.y ?? 0;
        let dy = -8;
        if (y - lastY < 12) {
          dy = toggle ? 12 : -12;
          toggle = !toggle;
        }
        labelOffsetById.set(id, { dx: 8, dy });
        lastY = y;
      });
    });

    const minimapNodes = nodes.map(node => {
      const position = positionById.get(node.id) || { x: width / 2, y: height / 2 };
      const label = node.name.length > 10 ? `${node.name.slice(0, 10)}…` : node.name;
      const objectiveStatus = objectiveStatusByNode.get(node.id) || {};
      const labelOffset = labelOffsetById.get(node.id) || { dx: 8, dy: -8 };
      return {
        id: node.id,
        name: node.name,
        label,
        x: position.x,
        y: position.y,
        discovered: discoveredSet.has(node.id),
        isCurrent: node.id === runtime.currentNodeId,
        npcCount: npcCountByNode.get(node.id) || 0,
        npcNames: npcNamesByNode.get(node.id) || [],
        objectives: objectivesByNode.get(node.id) || [],
        danger: node.danger,
        mainStatus: objectiveStatus.main || null,
        sideStatus: objectiveStatus.side || null,
        labelOffset
      };
    });
    const minimapPositionById = new Map(minimapNodes.map(n => [n.id, n]));
    const minimapEdges = blueprint.edges.map(edge => ({
      from: minimapPositionById.get(edge.from) || null,
      to: minimapPositionById.get(edge.to) || null
    })).filter(e => e.from && e.to) as { from: typeof minimapNodes[number]; to: typeof minimapNodes[number] }[];

    return { currentNode, neighbors, npcsHere, objectives, minimapNodes, minimapEdges };
  }, [blueprint, runtime, gameState.inventory, gameState.npcs, gameState.objectives, gameState.map, gameState.scpData]);

  if (!data) return null;

  const goVerb = t('game.map_go');
  const talkVerb = t('game.map_talk');
  const hoveredNode = data.minimapNodes.find(node => node.id === hoveredNodeId) || null;
  const statusLabel = (status: string) => {
    if (status === 'COMPLETED') return t('game.map_status_completed');
    if (status === 'FAILED') return t('game.map_status_failed');
    return t('game.map_status_active');
  };
  const statusColor = (status: string) => {
    if (status === 'COMPLETED') return 'text-emerald-400';
    if (status === 'FAILED') return 'text-red-400';
    return 'text-sky-300';
  };
  const minimapStatusColor = (status: string | null) => {
    if (status === 'COMPLETED') return 'rgba(52,211,153,1)';
    if (status === 'FAILED') return 'rgba(248,113,113,1)';
    return 'rgba(56,189,248,1)';
  };
  const zoomThreshold = 1.15;
  const resetView = () => {
    setViewTransform({ scale: 1, x: 0, y: 0 });
    setIsPanning(false);
    setPanOrigin(null);
  };

  return (
    <aside className="hidden lg:flex fixed top-16 right-0 bottom-4 w-80 flex-col border-l border-scp-gray/30 bg-black/40 backdrop-blur-sm z-40">
      <div className="p-3 border-b border-scp-gray/30">
        <div className="text-[12px] font-mono tracking-widest text-scp-term uppercase">{t('game.map_title')}</div>
        <div className="text-xs text-scp-text font-mono mt-1">
          {data.currentNode?.name || runtime!.currentNodeId}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        <div>
          <div className="text-[12px] text-gray-400 font-mono uppercase tracking-wider mb-2">{t('game.map_adjacency')}</div>
          <div className="space-y-2">
            {data.neighbors.map(n => (
              <button
                key={n.id}
                disabled={n.blocked}
                onClick={() => onQuickAction(`${goVerb} ${n.name}`)}
                className={`w-full text-left px-2 py-2 border font-mono text-xs transition-colors ${
                  n.blocked
                    ? 'border-scp-gray/20 text-gray-500 cursor-not-allowed bg-black/20'
                    : 'border-scp-gray/40 text-scp-text hover:border-scp-term/60 hover:bg-black/30'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate">{n.name}</span>
                </div>
                {n.blocked && (
                  <div className="mt-1 text-[12px] text-scp-accent/80">{n.reason || t('game.map_locked')}</div>
                )}
              </button>
            ))}
          </div>
        </div>

        {data.npcsHere.length > 0 && (
          <div>
            <div className="text-[12px] text-gray-400 font-mono uppercase tracking-wider mb-2">{t('game.map_npc')}</div>
            <div className="space-y-2">
              {data.npcsHere.map(n => (
                <button
                  key={n.id}
                  onClick={() => onQuickAction(`${talkVerb} ${n.name}`)}
                  className="w-full text-left px-2 py-2 border border-scp-gray/40 text-scp-text hover:border-scp-term/60 hover:bg-black/30 font-mono text-xs transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate">{n.name}</span>
                  </div>
                  <div className="mt-1 text-[12px] text-gray-500">{n.archetype}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {data.objectives.length > 0 && (
          <div>
            <div className="text-[12px] text-gray-400 font-mono uppercase tracking-wider mb-2">{t('game.map_objectives')}</div>
            <div className="space-y-2">
              {data.objectives.map(o => (
                <button
                  key={o.id}
                  onClick={() => onQuickAction(`${t('game.map_review_objective')} [${o.title}]`)}
                  className="w-full text-left px-2 py-2 border border-scp-gray/40 text-scp-text hover:border-scp-term/60 hover:bg-black/30 font-mono text-xs transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate">{o.type === 'MAIN' ? 'MAIN' : 'SIDE'} | {o.title}</span>
                    <span className={`text-[12px] font-mono ${statusColor(o.status)}`}>{statusLabel(o.status)}</span>
                  </div>
                  <div className="mt-1 text-[12px] text-gray-500">
                    {Math.max(0, Math.min(100, Math.round(o.progress)))}%
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="text-[12px] text-gray-400 font-mono uppercase tracking-wider">{t('game.map_minimap')}</div>
            <button
              onClick={resetView}
              className="text-[10px] font-mono text-scp-text border border-scp-gray/40 px-2 py-1 hover:border-scp-term/60 hover:bg-black/30 transition-colors"
            >
              {t('game.map_reset')}
            </button>
          </div>
          <div
            ref={minimapRef}
            className="border border-scp-gray/30 bg-black/30 p-2 relative select-none"
            onMouseDown={event => {
              if (event.button !== 0) return;
              if (!minimapRef.current) return;
              const rect = minimapRef.current.getBoundingClientRect();
              setIsPanning(true);
              setPanOrigin({
                x: event.clientX,
                y: event.clientY,
                originX: viewTransform.x,
                originY: viewTransform.y
              });
              setTooltipPosition({
                x: event.clientX - rect.left,
                y: event.clientY - rect.top
              });
            }}
            onMouseMove={event => {
              if (!minimapRef.current) return;
              const rect = minimapRef.current.getBoundingClientRect();
              if (isPanning && panOrigin) {
                const scaleX = 200 / rect.width;
                const scaleY = 200 / rect.height;
                const dx = ((event.clientX - panOrigin.x) * scaleX) / viewTransform.scale;
                const dy = ((event.clientY - panOrigin.y) * scaleY) / viewTransform.scale;
                setViewTransform(prev => ({ ...prev, x: panOrigin.originX + dx, y: panOrigin.originY + dy }));
              }
              if (hoveredNodeId) {
                setTooltipPosition({
                  x: event.clientX - rect.left,
                  y: event.clientY - rect.top
                });
              }
            }}
            onMouseUp={() => {
              setIsPanning(false);
              setPanOrigin(null);
            }}
            onMouseLeave={() => {
              setIsPanning(false);
              setPanOrigin(null);
            }}
            onWheel={event => {
              event.preventDefault();
              if (!minimapRef.current) return;
              const rect = minimapRef.current.getBoundingClientRect();
              const delta = event.deltaY < 0 ? 0.1 : -0.1;
              const vx = ((event.clientX - rect.left) / rect.width) * 200;
              const vy = ((event.clientY - rect.top) / rect.height) * 200;
              setViewTransform(prev => {
                const nextScale = Math.min(2.4, Math.max(0.6, prev.scale + delta));
                const ratio = nextScale / prev.scale;
                const nextX = vx - (vx - prev.x) * ratio;
                const nextY = vy - (vy - prev.y) * ratio;
                return { scale: nextScale, x: nextX, y: nextY };
              });
            }}
          >
            <svg viewBox="0 0 200 200" className="w-full h-56 block">
              <g transform={`translate(${viewTransform.x} ${viewTransform.y}) scale(${viewTransform.scale})`}>
                {data.minimapEdges.map((edge, idx) => {
                  const opacity = edge.from.discovered || edge.to.discovered ? 0.6 : 0.25;
                  return (
                    <line
                      key={`edge-${idx}`}
                      x1={edge.from.x}
                      y1={edge.from.y}
                      x2={edge.to.x}
                      y2={edge.to.y}
                      stroke="rgba(148,163,184,1)"
                      strokeOpacity={opacity}
                      strokeWidth="1"
                    />
                  );
                })}
                {data.minimapNodes.map(node => {
                  const fill = node.isCurrent ? 'rgba(34,197,94,1)' : node.discovered ? 'rgba(148,163,184,1)' : 'rgba(75,85,99,1)';
                  const stroke = node.isCurrent ? 'rgba(134,239,172,1)' : 'rgba(51,65,85,1)';
                  const shouldShowLabel = node.isCurrent || ((node.discovered && viewTransform.scale >= zoomThreshold) && node.id !== hoveredNodeId);
                  return (
                    <g
                      key={`node-${node.id}`}
                      onMouseEnter={event => {
                        if (!minimapRef.current) return;
                        const rect = minimapRef.current.getBoundingClientRect();
                        setHoveredNodeId(node.id);
                        setTooltipPosition({
                          x: event.clientX - rect.left,
                          y: event.clientY - rect.top
                        });
                      }}
                      onMouseLeave={() => {
                        setHoveredNodeId(null);
                        setTooltipPosition(null);
                      }}
                    >
                      <circle cx={node.x} cy={node.y} r="5" fill={fill} stroke={stroke} strokeWidth="1" />
                      {node.id === blueprint?.startNodeId && (
                        <text x={node.x - 12} y={node.y + 4} fontSize="9" fill="rgba(148,163,184,0.9)" fontFamily="monospace">S</text>
                      )}
                      {node.mainStatus && (
                        <polygon
                          points={`${node.x - 6},${node.y - 10} ${node.x},${node.y - 16} ${node.x + 6},${node.y - 10}`}
                          fill={minimapStatusColor(node.mainStatus)}
                        />
                      )}
                      {node.sideStatus && (
                        <rect
                          x={node.x - 4}
                          y={node.y + 8}
                          width="8"
                          height="8"
                          fill={minimapStatusColor(node.sideStatus)}
                        />
                      )}
                      {node.npcCount > 0 && (
                        <>
                          <circle cx={node.x + 10} cy={node.y + 10} r="6" fill="rgba(234,179,8,1)" />
                          <text x={node.x + 10} y={node.y + 13} textAnchor="middle" fontSize="8" fill="rgba(17,24,39,1)" fontFamily="monospace">
                            {node.npcCount}
                          </text>
                        </>
                      )}
                      {shouldShowLabel && (
                        <text x={node.x + node.labelOffset.dx} y={node.y + node.labelOffset.dy} fontSize="9" fill="rgba(226,232,240,0.9)" fontFamily="monospace">
                          {node.label}
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
            </svg>
            {hoveredNode && tooltipPosition && (
              <div
                className="absolute z-10 bg-black/80 border border-scp-gray/40 px-3 py-2 text-[11px] font-mono text-scp-text max-w-[220px]"
                style={{ left: tooltipPosition.x + 12, top: tooltipPosition.y + 12 }}
              >
                <div className="text-xs text-scp-term">{hoveredNode.name}</div>
                {hoveredNode.discovered || hoveredNode.isCurrent ? (
                  <>
                    <div className="mt-2 text-[10px] text-gray-400">{t('game.map_tooltip_danger')} {hoveredNode.danger}</div>
                    {hoveredNode.npcNames.length > 0 && (
                      <>
                        <div className="mt-2 text-[10px] text-gray-400">{t('game.map_npc')}</div>
                        <div className="text-[11px] text-scp-text">
                          {hoveredNode.npcNames.map(name => (
                            <div key={name}>{name}</div>
                          ))}
                        </div>
                      </>
                    )}
                    {hoveredNode.objectives.length > 0 && (
                      <>
                        <div className="mt-2 text-[10px] text-gray-400">{t('game.map_objectives')}</div>
                        <div className="space-y-1">
                          {hoveredNode.objectives.map(obj => (
                            <div key={obj.id} className="flex items-center justify-between gap-2">
                              <span className="truncate">{obj.type === 'MAIN' ? 'MAIN' : 'SIDE'} | {obj.title}</span>
                              <span className={`text-[10px] ${statusColor(obj.status)}`}>{statusLabel(obj.status)}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    {hoveredNode.npcNames.length > 0 && (
                      <>
                        <div className="mt-2 text-[10px] text-gray-400">{t('game.map_npc')}</div>
                        <div className="text-[11px] text-scp-text">??</div>
                      </>
                    )}
                    {hoveredNode.objectives.length > 0 && (
                      <>
                        <div className="mt-2 text-[10px] text-gray-400">{t('game.map_objectives')}</div>
                        <div className="text-[11px] text-scp-text">??</div>
                      </>
                    )}
                  </>
                )}
              </div>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] font-mono text-gray-400">
              <div className="flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: 'rgba(34,197,94,1)' }} />
                <span>{t('game.map_current')}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: 'rgba(148,163,184,1)' }} />
                <span>{t('game.map_discovered')}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="inline-block text-[10px] text-gray-400 font-mono">S</span>
                <span>{t('game.map_start')}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: 'rgba(234,179,8,1)' }} />
                <span>{t('game.map_npc_hint')}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="inline-block w-0 h-0 border-x-[5px] border-x-transparent border-b-[8px]" style={{ borderBottomColor: 'rgba(56,189,248,1)' }} />
                <span>{t('game.map_main_hint')}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="inline-block w-2 h-2" style={{ backgroundColor: 'rgba(56,189,248,1)' }} />
                <span>{t('game.map_side_hint')}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="inline-block w-2 h-2" style={{ backgroundColor: 'rgba(52,211,153,1)' }} />
                <span>{t('game.map_status_completed')}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="inline-block w-2 h-2" style={{ backgroundColor: 'rgba(56,189,248,1)' }} />
                <span>{t('game.map_status_active')}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="inline-block w-2 h-2" style={{ backgroundColor: 'rgba(248,113,113,1)' }} />
                <span>{t('game.map_status_failed')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default MapPanel;
