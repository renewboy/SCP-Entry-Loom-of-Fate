import React, { useEffect, useMemo, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { GameState } from '../../types';
import { useTranslation } from '../../utils/i18n';
import { buildLayout } from '../../utils/mapLayout';
import SidePanel from '../common/SidePanel';
import { useResizable } from '../../hooks/useResizable';

interface MapPanelProps {
  gameState: GameState;
  onQuickAction: (text: string) => void;
  fullWidth?: boolean;
}

const MapPanel: React.FC<MapPanelProps> = ({ gameState, onQuickAction, fullWidth = false }) => {
  const { t } = useTranslation();
  const blueprint = gameState.scpData?.mapBlueprint;
  const runtime = gameState.map;
  const minimapRef = useRef<HTMLDivElement | null>(null);
  
  const DEFAULT_MAP_SCALE = 1.3;

  const [viewTransform, setViewTransform] = useState({ scale: DEFAULT_MAP_SCALE, x: 0, y: 0 }); // Initial scale matches reset
  const [isPanning, setIsPanning] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { width: panelWidth, onMouseDown: onResizeMouseDown } = useResizable({
    side: 'right',
    defaultWidth: 320,
    minWidth: 200,
    maxWidth: 560,
  });
  const [panOrigin, setPanOrigin] = useState<{ x: number; y: number; originX: number; originY: number } | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredObjectiveId, setHoveredObjectiveId] = useState<string | null>(null);
  const [activeObjectiveId, setActiveObjectiveId] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const node = minimapRef.current;
    if (!node) return;
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = node.getBoundingClientRect();
      const delta = event.deltaY < 0 ? 0.1 : -0.1;
      const vx = ((event.clientX - rect.left) / rect.width) * 200;
      const vy = ((event.clientY - rect.top) / rect.height) * 200;
      setViewTransform(prev => {
        const nextScale = Math.min(3.0, Math.max(0.5, prev.scale + delta));
        const ratio = nextScale / prev.scale;
        const nextX = vx - (vx - prev.x) * ratio;
        const nextY = vy - (vy - prev.y) * ratio;
        return { scale: nextScale, x: nextX, y: nextY };
      });
    };
    node.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      node.removeEventListener('wheel', handleWheel);
    };
  }, []);

  const radarColors = {
    low: 'var(--scp-term)',
    medium: 'var(--scp-amber)',
    high: 'var(--scp-alert)'
  };
  const radarOpacity = {
    unknownFill: 0.3,
    unknownStroke: 0.5,
    unknownText: 0.9,
    lowDim: 0.7,
    mediumDim: 0.7,
    highDim: 0.8,
    pulse: 0.4
  };
  const dangerColor = (danger: number) => {
    if (danger > 70) return radarColors.high;
    if (danger > 30) return radarColors.medium;
    return radarColors.low;
  };

  const MapControls = () => (
    <div className="flex items-center justify-between gap-2">
      <div className="flex gap-2">
        <button
          onClick={zoomIn}
          className="w-6 h-6 flex items-center justify-center border border-scp-term/30 bg-black/80 text-scp-term hover:bg-scp-term/20 text-xs font-mono"
        >
          +
        </button>
        <button
          onClick={zoomOut}
          className="w-6 h-6 flex items-center justify-center border border-scp-term/30 bg-black/80 text-scp-term hover:bg-scp-term/20 text-xs font-mono"
        >
          -
        </button>
      </div>
      <button
        onClick={resetView}
        aria-label="Reset map view"
        className="w-8 h-8 flex items-center justify-center text-scp-text/60 hover:text-scp-term border border-scp-term/30 bg-black/80"
      >
        <RotateCcw className="w-3.5 h-3.5" strokeWidth={1.75} />
      </button>
    </div>
  );

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
      const req = Array.isArray(neighbor?.requires) ? neighbor?.requires : [];
      const missing = req.filter(token => !hasToken(token));
      const blocked = missing.length > 0;
      const reason = blocked ? neighbor?.blockedText : '';
      return {
        id: neighborId,
        name: neighbor?.name || neighborId,
        blocked,
        reason: reason || neighbor?.blockedText || ''
      };
    });

    const npcsHere = (gameState.npcs || []).filter(n => n.alive && n.nodeId === runtime.currentNodeId);
    const objectives = (gameState.objectives || []);
    const objectiveById = new Map(objectives.map(o => [o.id, o]));

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
    const width = 200;
    const height = 200;
    const { positionById, levels } = buildLayout(blueprint, { width, height, paddingX: 40, paddingY: 40, useExistingLayout: false });

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
        let dy = -10;
        if (y - lastY < 14) {
          dy = toggle ? 14 : -14;
          toggle = !toggle;
        }
        labelOffsetById.set(id, { dx: 10, dy });
        lastY = y;
      });
    });

    const minimapNodes = nodes.map(node => {
      const position = positionById.get(node.id) || { x: width / 2, y: height / 2 };
      const label = node.name.length > 10 ? `${node.name.slice(0, 10)}…` : node.name;
      const objectiveStatus = objectiveStatusByNode.get(node.id) || {};
      const labelOffset = labelOffsetById.get(node.id) || { dx: 10, dy: -10 };
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
        danger: node.danger ?? 0,
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

    return { currentNode, neighbors, npcsHere, objectives, objectiveById, minimapNodes, minimapEdges };
  }, [blueprint, runtime, gameState.inventory, gameState.npcs, gameState.objectives, gameState.map, gameState.scpData]);

  // Auto-follow effect: Center view when current node changes
  React.useEffect(() => {
    if (data?.currentNode) {
        // Find the current node in the processed minimap nodes to get its layout coordinates
        const currentMinimapNode = data.minimapNodes.find(n => n.id === data.currentNode?.id);
        
        if (currentMinimapNode) {
            setViewTransform(prev => ({
                ...prev,
                // Keep current scale, but recenter
                x: 100 - currentMinimapNode.x * prev.scale,
                y: 100 - currentMinimapNode.y * prev.scale
            }));
        }
    }
  }, [data?.currentNode?.id]); // Only trigger when ID changes

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
  
  const resetView = () => {
    const currentNode = data?.minimapNodes.find(n => n.isCurrent);
    if (currentNode) {
        // Center on current node
        const targetScale = DEFAULT_MAP_SCALE;
        setViewTransform({ 
            scale: targetScale, 
            x: 100 - currentNode.x * targetScale, 
            y: 100 - currentNode.y * targetScale 
        });
    } else {
        setViewTransform({ scale: 1, x: 0, y: 0 });
    }
    setIsPanning(false);
    setPanOrigin(null);
  };

  const zoomIn = () => setViewTransform(prev => ({ ...prev, scale: Math.min(3.0, prev.scale + 0.2) }));
  const zoomOut = () => setViewTransform(prev => ({ ...prev, scale: Math.max(0.5, prev.scale - 0.2) }));
  const isTouchMode = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return (navigator.maxTouchPoints || 0) > 0 || window.matchMedia('(hover: none)').matches;
  }, []);

  // Helper to render node shape based on danger level
  const renderNodeShape = (x: number, y: number, danger: number, isCurrent: boolean, discovered: boolean) => {
    if (!discovered && !isCurrent) {
        // Undiscovered nodes - unified green style, non-highlighted
        return (
          <g>
            <circle
              cx={x}
              cy={y}
              r={3.5}
              strokeWidth={0.5}
              style={{
                fill: radarColors.low,
                fillOpacity: radarOpacity.unknownFill,
                stroke: radarColors.low,
                strokeOpacity: radarOpacity.unknownStroke
              }}
            />
            <text
              x={x}
              y={y}
              fontSize="5.5"
              textAnchor="middle"
              dominantBaseline="middle"
              style={{ fill: radarColors.low, opacity: radarOpacity.unknownText }}
              className="font-mono select-none font-bold"
            >
              ?
            </text>
          </g>
        );
    }

    const baseClass = isCurrent ? "animate-pulse" : "";
    
    // Low Danger (0-30): Circle
    if (danger <= 30) {
      return (
        <circle
          cx={x}
          cy={y}
          r={isCurrent ? 4 : 3}
          className={baseClass}
          style={{ fill: radarColors.low, fillOpacity: isCurrent ? 1 : radarOpacity.lowDim }}
        />
      );
    }
    
    // Medium Danger (31-70): Hexagon
    if (danger <= 70) {
      const size = isCurrent ? 5 : 4;
      const points = [];
      for (let i = 0; i < 6; i++) {
          const angle = (Math.PI / 3) * i;
          points.push(`${x + size * Math.cos(angle)},${y + size * Math.sin(angle)}`);
      }
      return (
        <polygon
          points={points.join(' ')}
          className={baseClass}
          style={{ fill: radarColors.medium, fillOpacity: isCurrent ? 1 : radarOpacity.mediumDim }}
        />
      );
    }
    
    // High Danger (71-100): Triangle
    const size = isCurrent ? 6 : 5;
    const points = [
        `${x},${y - size}`,
        `${x - size * 0.866},${y + size * 0.5}`,
        `${x + size * 0.866},${y + size * 0.5}`
    ];
    
    return (
        <g>
            <polygon
              points={points.join(' ')}
              className={baseClass}
              style={{ fill: radarColors.high, fillOpacity: isCurrent ? 1 : radarOpacity.highDim }}
            />
            {/* Warning Pulse */}
            <circle
              cx={x}
              cy={y}
              r={size * 2.5}
              strokeWidth={0.5}
              style={{ stroke: radarColors.high, strokeOpacity: radarOpacity.pulse }}
              fill="none"
              className="animate-blip-pulse"
            />
        </g>
    );
  };

  const activeObjective = (activeObjectiveId ? data.objectiveById.get(activeObjectiveId) : null) || null;

  const mapContent = (
    <>
      <div className="p-3 border-b border-scp-gray/30 scp-window-header flex justify-between items-center">
        <div>
          <div className="text-[12px] font-mono tracking-widest text-scp-term uppercase">{t('game.map_title')}</div>
          <div className="text-xs text-scp-text font-mono mt-1 opacity-60">
            {data.currentNode?.name || runtime!.currentNodeId}
          </div>
        </div>
        <div className="flex flex-col items-end">
           <div className="text-[12px] text-scp-alert font-mono animate-pulse">{t('game.map_radar_online')}</div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        <MapControls />
        {/* Radar Container */}
        <div className="w-full flex justify-center pt-1 pb-2 relative">
            <div className={`relative ${fullWidth ? "w-full aspect-square max-w-[300px]" : "w-64 h-64"} bg-scp-dark rounded-full overflow-hidden border-4 border-scp-border-strong shadow-[0_0_30px_rgba(0,0,0,0.8)] group select-none`}>
                {/* Grid Layer */}
                <div className="absolute inset-0 pointer-events-none opacity-30">
                    <svg viewBox="0 0 200 200" className="w-full h-full">
                        <circle cx="100" cy="100" r="98" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-scp-term_fix" />
                        <circle cx="100" cy="100" r="70" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-scp-term_fix" strokeDasharray="4 2" />
                        <circle cx="100" cy="100" r="40" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-scp-term_fix" strokeDasharray="4 2" />
                        <line x1="100" y1="0" x2="100" y2="200" stroke="currentColor" strokeWidth="0.5" className="text-scp-term_fix" />
                        <line x1="0" y1="100" x2="200" y2="100" stroke="currentColor" strokeWidth="0.5" className="text-scp-term_fix" />
                    </svg>
                </div>

                {/* Radar Sweep Animation */}
                <div className="absolute inset-0 radar-sweep animate-radar-spin opacity-40 pointer-events-none z-0" />

                {/* Decorative Text Overlay */}
                <div className="absolute top-2 left-1/2 -translate-x-1/2 text-[12px] text-scp-term/60 font-mono pointer-events-none z-10">
                    {t('game.map_scanning')}
                </div>
                
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[12px] text-scp-term/60 font-mono pointer-events-none z-10 flex gap-4">
                    <span>COORD: {Math.round(viewTransform.x)},{Math.round(viewTransform.y)}</span>
                </div>

                {/* Interactive SVG Map */}
                <div
                    ref={minimapRef}
                    className="absolute inset-0 cursor-crosshair z-20"
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
                    onMouseUp={() => { setIsPanning(false); setPanOrigin(null); }}
                    onMouseLeave={() => { setIsPanning(false); setPanOrigin(null); }}
                    onTouchStart={event => {
                        const touch = event.touches[0];
                        if (!touch || !minimapRef.current) return;
                        setIsPanning(true);
                        setPanOrigin({
                            x: touch.clientX,
                            y: touch.clientY,
                            originX: viewTransform.x,
                            originY: viewTransform.y
                        });
                    }}
                    onTouchMove={event => {
                        event.preventDefault();
                        const touch = event.touches[0];
                        if (!touch || !isPanning || !panOrigin || !minimapRef.current) return;
                        const rect = minimapRef.current.getBoundingClientRect();
                        const scaleX = 200 / rect.width;
                        const scaleY = 200 / rect.height;
                        const dx = ((touch.clientX - panOrigin.x) * scaleX) / viewTransform.scale;
                        const dy = ((touch.clientY - panOrigin.y) * scaleY) / viewTransform.scale;
                        setViewTransform(prev => ({ ...prev, x: panOrigin.originX + dx, y: panOrigin.originY + dy }));
                    }}
                    onTouchEnd={() => { setIsPanning(false); setPanOrigin(null); }}
                >
                    <svg viewBox="0 0 200 200" className="w-full h-full">
                        <defs>
                            <filter id="glow-node" x="-50%" y="-50%" width="200%" height="200%">
                                <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
                                <feMerge>
                                    <feMergeNode in="coloredBlur"/>
                                    <feMergeNode in="SourceGraphic"/>
                                </feMerge>
                            </filter>
                        </defs>
                        <g transform={`translate(${viewTransform.x} ${viewTransform.y}) scale(${viewTransform.scale})`}>
                            {/* Edges */}
                            {data.minimapEdges.map((edge, idx) => {
                                // Only highlight edge if BOTH ends are discovered
                                const isFullyDiscovered = edge.from.discovered && edge.to.discovered;
                                return (
                                    <line
                                        key={`edge-${idx}`}
                                        x1={edge.from.x}
                                        y1={edge.from.y}
                                        x2={edge.to.x}
                                        y2={edge.to.y}
                                        stroke={isFullyDiscovered ? "rgba(51, 255, 0, 0.6)" : "rgba(51, 255, 0, 0.15)"}
                                        strokeWidth={isFullyDiscovered ? 1.5 : 1}
                                        strokeDasharray="" 
                                    />
                                );
                            })}
                            
                            {/* Nodes */}
                            {data.minimapNodes.map(node => {
                                return (
                                    <g
                                        key={`node-${node.id}`}
                                        className="cursor-pointer hover:brightness-125 transition-all duration-200"
                                        filter={node.discovered || node.isCurrent ? "url(#glow-node)" : undefined}
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
                                        {renderNodeShape(node.x, node.y, node.danger, node.isCurrent, node.discovered)}
                                        
                                        {/* Current Node Reticle */}
                                        {node.isCurrent && (
                                            <g className="animate-spin-slow" style={{ animationDuration: '8s' }}>
                                                <rect x={node.x - 8} y={node.y - 8} width="4" height="1" className="fill-scp-term" />
                                                <rect x={node.x + 4} y={node.y - 8} width="4" height="1" className="fill-scp-term" />
                                                <rect x={node.x - 8} y={node.y + 7} width="4" height="1" className="fill-scp-term" />
                                                <rect x={node.x + 4} y={node.y + 7} width="4" height="1" className="fill-scp-term" />
                                                
                                                <rect x={node.x - 8} y={node.y - 8} width="1" height="4" className="fill-scp-term" />
                                                <rect x={node.x + 7} y={node.y - 8} width="1" height="4" className="fill-scp-term" />
                                                <rect x={node.x - 8} y={node.y + 4} width="1" height="4" className="fill-scp-term" />
                                                <rect x={node.x + 7} y={node.y + 4} width="1" height="4" className="fill-scp-term" />
                                            </g>
                                        )}

                                        {/* Start Node Indicator */}
                                        {node.id === blueprint?.startNodeId && (
                                            <text x={node.x - 12} y={node.y + 4} fontSize="9" fill="rgba(148,163,184,0.9)" fontFamily="monospace">S</text>
                                        )}

                                        {/* NPC Indicator (for discovered nodes) */}
                                        {node.npcCount > 0 && node.discovered && (
                                            <circle cx={node.x + 8} cy={node.y - 8} r="3" fill="rgba(234,179,8,1)" />
                                        )}

                                        {/* Objective Indicators */}
                                        {node.mainStatus && (
                                            <circle cx={node.x} cy={node.y} r="8" fill="none" stroke="rgba(56,189,248,0.8)" strokeWidth="1" strokeDasharray="3 2" className="animate-spin-slow" />
                                        )}
                                        {node.sideStatus && (
                                            <rect x={node.x + 6} y={node.y + 6} width="4" height="4" fill="rgba(56,189,248,1)" />
                                        )}

                                        {/* Labels */}
                                        {(node.isCurrent || (node.discovered && viewTransform.scale >= 1.2) || hoveredNodeId === node.id) && (
                                            <text
                                                x={node.x + node.labelOffset.dx}
                                                y={node.y + node.labelOffset.dy}
                                                fontSize="8"
                                                fill={node.isCurrent ? "#33ff00" : "rgba(226,232,240,0.8)"}
                                                fontFamily="monospace"
                                                className="uppercase tracking-wider pointer-events-none"
                                            >
                                                {node.label}
                                            </text>
                                        )}
                                    </g>
                                );
                            })}
                        </g>
                    </svg>
                </div>
            </div>
            
            {/* Reset View Button - Moved to top right relative to the container */}
            
             {/* Tooltip Overlay - Moved outside radar container to avoid clipping if overflow hidden, but still positioned absolutely */}
            {hoveredNode && tooltipPosition && (
                <div
                    className="absolute z-50 bg-scp-dark/95 border border-scp-term/50 backdrop-blur-md px-3 py-2 text-[12px] font-mono text-scp-text min-w-[140px] pointer-events-none shadow-[0_0_15px_rgba(51,255,0,0.2)]"
                    style={{ left: Math.min(180, Math.max(-20, tooltipPosition.x)), top: Math.min(200, Math.max(0, tooltipPosition.y + 20)) }}
                >
                    <div className="flex items-center justify-between border-b border-scp-term/30 pb-1 mb-1">
                        <span className="font-bold uppercase" style={{ color: radarColors.low }}>{hoveredNode.name}</span>
                    </div>
                    
                    <div className="space-y-1">
                        {hoveredNode.discovered || hoveredNode.isCurrent ? (
                            <>
                                <div className="font-bold" style={{ color: dangerColor(hoveredNode.danger) }}>
                                    {t('game.map_tooltip_danger')} {hoveredNode.danger}
                                </div>
                                {hoveredNode.npcNames.length > 0 && (
                                    <div className="mt-1">
                                        <div className="text-gray-400 mb-0.5">{t('game.map_npc')}</div>
                                        {hoveredNode.npcNames.map(name => (
                                            <div key={name} className="pl-2 border-l border-scp-term/30 text-scp-text/90">{name}</div>
                                        ))}
                                    </div>
                                )}
                                {hoveredNode.objectives.length > 0 && (
                                    <div className="mt-1">
                                        <div className="text-gray-400 mb-0.5">{t('game.map_objectives')}</div>
                                        {hoveredNode.objectives.map(obj => (
                                            <div key={obj.id} className="pl-2 border-l border-scp-term/30 flex justify-between gap-2">
                                                <span className="truncate max-w-[80px]">{obj.title}</span>
                                                <span className={statusColor(obj.status)}>{statusLabel(obj.status)}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        ) : (
                            <>
                                {/* Undiscovered Node Tooltip */}
                                <div className="font-bold" style={{ color: dangerColor(hoveredNode.danger) }}>
                                    {t('game.map_tooltip_danger')} {hoveredNode.danger}
                                </div>
                                {(hoveredNode.npcCount > 0 || hoveredNode.objectives.length > 0) && (
                                     <div className="mt-1">
                                         <div className="text-gray-400 mb-0.5">{t('game.map_npc')} / {t('game.map_objectives')}</div>
                                         <div className="pl-2 border-l border-scp-term/30 text-scp-text/60 italic">???</div>
                                     </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>

        {/* Legend - Updated per user request */}
        <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-gray-400 border-t border-scp-gray/30 pt-2">
            <div className="flex items-center gap-2">
                <span className="inline-block text-[12px] text-gray-400 font-mono">S</span>
                <span>{t('game.map_start')}</span>
            </div>
            <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                <span>{t('game.map_npc')}</span>
            </div>
            <div className="flex items-center gap-2">
                 <span className="w-2 h-2 rounded-full border border-sky-400 border-dashed"></span>
                <span>{t('game.map_main_hint')}</span>
            </div>
            <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-sky-400"></span>
                <span>{t('game.map_side_hint')}</span>
            </div>
        </div>

        {/* List Views (Adjacency, etc.) */}
        <div className="space-y-3 pt-2">
             {/* Neighbors */}
             <div>
                <h3 className="font-mono text-[12px] font-bold text-scp-term/80 uppercase mb-1">{t('game.map_adjacency')}</h3>
                <div className="space-y-1">
                    {data.neighbors.map(n => (
                    <button
                        key={n.id}
                        disabled={n.blocked}
                        onClick={() => onQuickAction(`${goVerb} ${n.name}`)}
                        className={`w-full text-left px-2 py-2 border font-mono text-[12px] transition-colors group flex flex-col items-start ${
                        n.blocked
                            ? 'border-scp-gray/20 text-gray-400 cursor-not-allowed'
                            : 'border-scp-gray/30 text-scp-text hover:border-scp-term/60 hover:bg-scp-term/10'
                        }`}
                    >
                        <span className="w-full flex justify-between">
                            <span>{n.name}</span>
                            {n.blocked && <span className="text-[12px] text-scp-alert uppercase"></span>}
                        </span>
                        {n.blocked && n.reason && (
                            <span className="text-[11px] text-red-500 mt-1 text-left w-full border-t border-red-500/20 pt-1 leading-tight opacity-90 font-bold">
                                {n.reason}
                            </span>
                        )}
                    </button>
                    ))}
                </div>
            </div>
            
            {/* NPCs */}
            {data.npcsHere.length > 0 && (
                <div>
                    <h3 className="font-mono text-[12px] font-bold text-scp-term/80 uppercase mb-1">{t('game.map_npc')}</h3>
                    <div className="space-y-1">
                        {data.npcsHere.map(n => (
                            <button
                                key={n.id}
                                onClick={() => onQuickAction(`${talkVerb} ${n.name}`)}
                                className="w-full text-left px-2 py-1.5 border border-scp-gray/30 text-scp-text hover:border-scp-term/60 hover:bg-scp-term/10 font-mono text-[12px] transition-colors"
                            >
                                {n.name}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Objectives List - Restored */}
            {data.objectives.length > 0 && (
              <div>
                <h3 className="font-mono text-[12px] font-bold text-scp-term/80 uppercase mb-1">{t('game.map_objectives')}</h3>
                <div className="space-y-1">
                  {data.objectives.map(o => {
                    const isActive = hoveredObjectiveId === o.id || activeObjectiveId === o.id;
                    const hasDetails = !!o.detail;
                    return (
                      <div
                        key={o.id}
                        onMouseEnter={() => setHoveredObjectiveId(o.id)}
                        onMouseLeave={() => setHoveredObjectiveId(null)}
                      >
                        <button
                          onClick={() => {
                            if (isTouchMode && activeObjectiveId !== o.id) {
                              setActiveObjectiveId(o.id);
                              return;
                            }
                            onQuickAction(`${t('game.map_review_objective')} [${o.title}]`);
                          }}
                          className="w-full text-left px-2 py-1.5 border border-scp-gray/30 text-scp-text hover:border-scp-term/60 hover:bg-scp-term/10 font-mono text-[12px] transition-colors group"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate font-bold group-hover:text-scp-term transition-colors">{o.type === 'MAIN' ? 'MAIN' : 'SIDE'} | {o.title}</span>
                            <span className={`text-[11px] font-mono ${statusColor(o.status)}`}>{statusLabel(o.status)}</span>
                          </div>
                          <div className="mt-1 text-[11px] text-gray-500 flex justify-between items-center">
                            <div className="w-full bg-gray-800 h-1 rounded-full mr-2 overflow-hidden">
                                <div className="bg-scp-term h-full" style={{ width: `${Math.max(0, Math.min(100, Math.round(o.progress)))}%` }}></div>
                            </div>
                            <span>{Math.max(0, Math.min(100, Math.round(o.progress)))}%</span>
                          </div>
                        </button>
                        {isActive && hasDetails && (
                          <div className="mt-1 border border-scp-gray/30 bg-black/40 px-2 py-1 text-[11px] text-scp-text/80 space-y-1">
                            {o.detail && (
                              <div className="flex gap-2">
                                <span className="text-gray-400 shrink-0">{t('map_editor.obj_detail')}</span>
                                <span className="whitespace-pre-wrap break-words">{o.detail}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
        </div>
      </div>
    </>
  );

  return fullWidth ? (
    <div className="flex flex-col h-full">{mapContent}</div>
  ) : (
    <SidePanel id="map-panel" side="right" className="fixed top-1/2 -translate-y-1/2 h-[85vh] md:h-[90vh] hidden lg:flex transition-all duration-300 ease-in-out shadow-[-5px_0_20px_rgba(0,0,0,0.5)]" style={{ width: isCollapsed ? 32 : panelWidth }}>
      {/* Collapse toggle */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -left-4 top-1/2 -translate-y-1/2 w-6 h-12 bg-scp-dark border border-scp-term/60 flex items-center justify-center cursor-pointer hover:bg-scp-term/20 text-scp-term z-50 rounded-l"
      >
        {isCollapsed ? '\u2039' : '\u203a'}
      </button>
      <div className={`flex-1 flex flex-col overflow-hidden transition-opacity duration-300 ${isCollapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        {mapContent}
      </div>
      {/* Resize handle */}
      {!isCollapsed && (
        <div
          onMouseDown={onResizeMouseDown}
          className="absolute top-0 left-0 w-1 h-full cursor-col-resize hover:bg-scp-term/40 active:bg-scp-term/60 transition-colors z-50"
        />
      )}
    </SidePanel>
  );
};

export default MapPanel;
