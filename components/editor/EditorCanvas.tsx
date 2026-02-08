import React, { useRef, useState, useEffect } from 'react';
import { MapBlueprint, MapBlueprintNode } from '../../types';
import { useTranslation } from '../../utils/i18n';

interface EditorCanvasProps {
    blueprint: MapBlueprint;
    selection: { type: 'node' | 'edge' | 'npc' | 'objective', id: string } | null;
    setSelection: (sel: { type: 'node' | 'edge' | 'npc' | 'objective', id: string } | null) => void;
    updateNode: (id: string, updates: Partial<MapBlueprintNode>) => void;
    addNode?: () => void;
    addEdge: (from: string, to: string) => void;
    onDeleteSelection: () => void;
}

const EditorCanvas: React.FC<EditorCanvasProps> = ({ blueprint, selection, setSelection, updateNode, addNode, addEdge, onDeleteSelection }) => {
    const { t } = useTranslation();
    const svgRef = useRef<SVGSVGElement>(null);
    const [viewTransform, setViewTransform] = useState({ scale: 2.0, x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const [panStart, setPanStart] = useState<{ x: number, y: number } | null>(null);
    const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
    const [dragPosition, setDragPosition] = useState<{ x: number, y: number } | null>(null);

    // Connection Drag State
    const [isConnecting, setIsConnecting] = useState(false);
    const [connectionStartId, setConnectionStartId] = useState<string | null>(null);
    const [connectionEndPos, setConnectionEndPos] = useState<{ x: number, y: number } | null>(null);
    const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

    // Zoom handlers
    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        const scaleChange = e.deltaY * -0.001;
        const newScale = Math.min(Math.max(0.1, viewTransform.scale + scaleChange), 5);
        setViewTransform(prev => ({ ...prev, scale: newScale }));
    };

    // Coordinate conversion
    const getSVGPoint = (clientX: number, clientY: number) => {
        if (!svgRef.current) return { x: 0, y: 0 };
        const pt = svgRef.current.createSVGPoint();
        pt.x = clientX;
        pt.y = clientY;
        const ctm = svgRef.current.getScreenCTM();
        if (!ctm) return { x: 0, y: 0 };
        return pt.matrixTransform(ctm.inverse());
    };

    const getWorldPoint = (clientX: number, clientY: number) => {
        const pt = getSVGPoint(clientX, clientY);
        return {
            x: (pt.x - viewTransform.x) / viewTransform.scale,
            y: (pt.y - viewTransform.y) / viewTransform.scale
        };
    };

    // Mouse Event Handlers for Canvas (Background)
    const handleMouseDown = (e: React.MouseEvent) => {
        // Middle click or Space+Click for panning
        if (e.button === 1 || (e.button === 0 && e.altKey)) {
            setIsPanning(true);
            setPanStart({ x: e.clientX, y: e.clientY });
            return;
        }

        // Left click on background (nodes stop propagation, so this is definitely background)
        if (e.button === 0) {
            setSelection(null);
            setIsConnecting(false);
            setConnectionStartId(null);
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isPanning && panStart) {
            const dx = e.clientX - panStart.x;
            const dy = e.clientY - panStart.y;
            setViewTransform(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
            setPanStart({ x: e.clientX, y: e.clientY });
        }

        if (draggingNodeId) {
            const worldPos = getWorldPoint(e.clientX, e.clientY);
            setDragPosition(worldPos);
        }

        if (isConnecting) {
            const worldPos = getWorldPoint(e.clientX, e.clientY);
            setConnectionEndPos(worldPos);
        }
    };

    const handleMouseUp = () => {
        if (draggingNodeId && dragPosition) {
            updateNode(draggingNodeId, { layout: dragPosition });
        }
        
        if (isConnecting && connectionStartId && hoveredNodeId && connectionStartId !== hoveredNodeId) {
            addEdge(connectionStartId, hoveredNodeId);
        }

        setIsPanning(false);
        setDraggingNodeId(null);
        setDragPosition(null);
        setPanStart(null);
        setIsConnecting(false);
        setConnectionStartId(null);
        setConnectionEndPos(null);
    };

    // Keyboard Event Handlers for Deletion
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!selection) return;
            
            // Ignore if focus is in an input or textarea
            if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;

            if (e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault();
                onDeleteSelection();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selection, onDeleteSelection]);

    // Node interactions
    const onNodeMouseDown = (e: React.MouseEvent, nodeId: string, currentLayout: { x: number, y: number }) => {
        e.stopPropagation();
        
        // Handle Shift + Click for quick connection (Legacy/Alternative method)
        if (e.shiftKey) {
            if (selection?.type === 'node' && selection.id !== nodeId) {
                addEdge(selection.id, nodeId);
                setSelection({ type: 'node', id: nodeId }); // Select the new node
            } else {
                setSelection({ type: 'node', id: nodeId });
            }
            return;
        }

        if (e.button === 0) {
            setSelection({ type: 'node', id: nodeId });
            setDraggingNodeId(nodeId);
            setDragPosition(currentLayout); 
        }
    };

    const onConnectionHandleMouseDown = (e: React.MouseEvent, nodeId: string) => {
        e.stopPropagation();
        e.preventDefault();
        setIsConnecting(true);
        setConnectionStartId(nodeId);
        // Initial position is the node's position
        const node = blueprint.nodes.find(n => n.id === nodeId);
        if (node && node.layout) {
            setConnectionEndPos(node.layout);
        }
    };

    const radarColors = {
        low: 'var(--scp-term)',
        medium: 'var(--scp-amber)',
        high: 'var(--scp-alert)'
    };

    const dangerColor = (danger: number) => {
        if (danger > 70) return radarColors.high;
        if (danger > 30) return radarColors.medium;
        return radarColors.low;
    };

    // Helper to calculate shortened line end for arrow visibility
    const getEdgeLine = (x1: number, y1: number, x2: number, y2: number, gap: number = 6) => {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist === 0) return { x1, y1, x2, y2 };

        const t = (dist - gap) / dist;
        return {
            x1, 
            y1,
            x2: x1 + dx * t,
            y2: y1 + dy * t
        };
    };

    if (!blueprint) return null;

    return (
        <div className="w-full h-full relative overflow-hidden select-none"
             onContextMenu={(e) => e.preventDefault()}>
            <svg 
                ref={svgRef}
                className="w-full h-full bg-grid-pattern"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onWheel={handleWheel}
            >
                <defs>
                    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(0, 255, 0, 0.3)" strokeWidth="0.5"/>
                    </pattern>
                    <marker id="arrowhead" markerWidth="10" markerHeight="7" 
                        refX="9" refY="3.5" orient="auto">
                        <polygon points="0 0, 10 3.5, 0 7" fill="rgba(51, 255, 0, 0.8)" />
                    </marker>
                    <marker id="arrowhead-selected" markerWidth="10" markerHeight="7" 
                        refX="9" refY="3.5" orient="auto">
                        <polygon points="0 0, 10 3.5, 0 7" fill="#fff" />
                    </marker>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" />

                <g transform={`translate(${viewTransform.x} ${viewTransform.y}) scale(${viewTransform.scale})`}>
                    {/* Edges */}
                    {blueprint.edges.map((edge, idx) => {
                        const fromNode = blueprint.nodes.find(n => n.id === edge.from);
                        const toNode = blueprint.nodes.find(n => n.id === edge.to);
                        if (!fromNode || !toNode) return null;

                        // Use drag position if node is being dragged
                        const fromX = (draggingNodeId === fromNode.id && dragPosition) ? dragPosition.x : (fromNode.layout?.x ?? 0);
                        const fromY = (draggingNodeId === fromNode.id && dragPosition) ? dragPosition.y : (fromNode.layout?.y ?? 0);
                        const toX = (draggingNodeId === toNode.id && dragPosition) ? dragPosition.x : (toNode.layout?.x ?? 0);
                        const toY = (draggingNodeId === toNode.id && dragPosition) ? dragPosition.y : (toNode.layout?.y ?? 0);

                        const isSelected = selection?.type === 'edge' && selection.id === `${edge.from}-${edge.to}`;

                        // Calculate line with gap for arrow if unidirectional
                        const lineCoords = edge.bidirectional 
                            ? { x1: fromX, y1: fromY, x2: toX, y2: toY }
                            : getEdgeLine(fromX, fromY, toX, toY, 6);

                        return (
                            <line
                                key={`${edge.from}-${edge.to}`}
                                x1={lineCoords.x1} y1={lineCoords.y1} x2={lineCoords.x2} y2={lineCoords.y2}
                                stroke={isSelected ? '#fff' : 'rgba(51, 255, 0, 0.5)'}
                                strokeWidth={isSelected ? 2 : 1}
                                markerEnd={edge.bidirectional ? undefined : (isSelected ? "url(#arrowhead-selected)" : "url(#arrowhead)")}
                                className="cursor-pointer hover:stroke-white"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setSelection({ type: 'edge', id: `${edge.from}-${edge.to}` });
                                }}
                            />
                        );
                    })}

                    {/* Temporary Connection Line */}
                    {isConnecting && connectionStartId && connectionEndPos && (
                        <line 
                            x1={blueprint.nodes.find(n => n.id === connectionStartId)?.layout?.x || 0}
                            y1={blueprint.nodes.find(n => n.id === connectionStartId)?.layout?.y || 0}
                            x2={connectionEndPos.x}
                            y2={connectionEndPos.y}
                            stroke="#fff"
                            strokeWidth="2"
                            strokeDasharray="4"
                            markerEnd="url(#arrowhead-selected)"
                            pointerEvents="none"
                        />
                    )}

                    {/* Nodes */}
                    {blueprint.nodes.map(node => {
                        // Use drag position if node is being dragged
                        const x = (draggingNodeId === node.id && dragPosition) ? dragPosition.x : (node.layout?.x ?? 0);
                        const y = (draggingNodeId === node.id && dragPosition) ? dragPosition.y : (node.layout?.y ?? 0);
                        
                        const isSelected = selection?.type === 'node' && selection.id === node.id;
                        const color = dangerColor(node.danger);
                        const isHovered = hoveredNodeId === node.id;

                        const nodeNpcs = blueprint.npcs.filter(n => n.initialNodeId === node.id);
                        const nodeObjs = blueprint.objectives.filter(o => o.nodeId === node.id);

                        return (
                            <g 
                                key={node.id} 
                                transform={`translate(${x}, ${y})`}
                                onMouseDown={(e) => onNodeMouseDown(e, node.id, { x, y })}
                                onMouseEnter={() => setHoveredNodeId(node.id)}
                                onMouseLeave={() => setHoveredNodeId(null)}
                                className="cursor-move"
                            >
                                {/* Highlight on hover during connection */}
                                {isConnecting && isHovered && connectionStartId !== node.id && (
                                    <circle r={8} fill="none" stroke="#fff" strokeWidth="1" strokeDasharray="2" className="animate-pulse" />
                                )}

                                <circle 
                                    r={isSelected ? 6 : 4} 
                                    fill={isSelected ? '#fff' : color}
                                    stroke={color}
                                    strokeWidth={1}
                                    fillOpacity={0.6}
                                />
                                <text 
                                    y={-10} 
                                    textAnchor="middle" 
                                    fill={color} 
                                    fontSize="6" 
                                    fontFamily="monospace"
                                >
                                    {node.name}
                                </text>
                                {node.id === blueprint.startNodeId && (
                                    <text y={2} textAnchor="middle" fontSize="4" fill="black" fontWeight="bold">S</text>
                                )}

                                {/* Connection Handle (Only visible when selected and not dragging node) */}
                                {isSelected && !draggingNodeId && (
                                    <g 
                                        transform="translate(8, 0)" 
                                        onMouseDown={(e) => onConnectionHandleMouseDown(e, node.id)}
                                        className="cursor-crosshair group"
                                    >
                                        {/* Invisible hit area to prevent jitter */}
                                        <circle r="6" fill="transparent" />
                                        {/* Visible handle with hover effect via CSS group */}
                                        <g className="transition-transform group-hover:scale-125">
                                            <circle r="2.5" fill="var(--scp-term)" stroke="#000" strokeWidth="0.5" />
                                            <path d="M -1 0 L 1 0 M 0 -1 L 0 1" stroke="#000" strokeWidth="0.5" />
                                        </g>
                                    </g>
                                )}

                                {/* Associated NPCs */}
                                {nodeNpcs.map((npc, idx) => {
                                    const isNpcSelected = selection?.type === 'npc' && selection.id === npc.id;
                                    return (
                                        <g key={npc.id} transform={`translate(8, ${-10 + (idx * 8)})`}
                                           onMouseDown={(e) => {
                                               e.stopPropagation();
                                               setSelection({ type: 'npc', id: npc.id });
                                           }}
                                        >
                                            <rect width="6" height="6" fill={isNpcSelected ? '#fff' : 'var(--scp-amber)'} rx="1" />
                                            <text x="3" y="4" fontSize="4" textAnchor="middle" fill="black" pointerEvents="none">N</text>
                                        </g>
                                    );
                                })}

                                {/* Associated Objectives */}
                                {nodeObjs.map((obj, idx) => {
                                    const isObjSelected = selection?.type === 'objective' && selection.id === obj.id;
                                    // Stack objectives below NPCs
                                    const yOffset = -10 + (nodeNpcs.length * 8) + (idx * 8); 
                                    return (
                                        <g key={obj.id} transform={`translate(8, ${yOffset})`}
                                           onMouseDown={(e) => {
                                               e.stopPropagation();
                                               setSelection({ type: 'objective', id: obj.id });
                                           }}
                                        >
                                            <rect width="6" height="6" fill={isObjSelected ? '#fff' : 'var(--scp-alert)'} rx="1" />
                                            <text x="3" y="4" fontSize="4" textAnchor="middle" fill="black" pointerEvents="none">!</text>
                                        </g>
                                    );
                                })}
                            </g>
                        );
                    })}
                </g>
            </svg>

            {/* Overlay Controls */}
            {addNode && (
                <div className="absolute top-4 left-4 flex flex-col gap-2">
                    <button 
                        type="button"
                        onClick={addNode}
                        className="px-3 py-2 bg-black/80 border border-scp-term text-scp-term hover:bg-scp-term/20 text-xs font-mono"
                    >
                        + {t('editor.add_node')}
                    </button>
                </div>
            )}
            
            <div className="absolute bottom-4 left-4 text-xs text-scp-text font-mono pointer-events-none bg-black/70 p-2 border border-scp-term/30 rounded backdrop-blur-sm max-w-md">
                <div className="flex items-center gap-2 mb-1 text-scp-term font-bold">
                    <span className="text-lg">⌨️</span> {t('editor.controls')}
                </div>
                <ul className="space-y-1 opacity-90">
                    <li><span className="text-scp-accent">Left Click</span>: {t('editor.select_drag')}</li>
                    <li><span className="text-scp-accent">Drag Handle</span>: {t('editor.connect_nodes')}</li>
                    <li><span className="text-scp-accent">Shift + Click</span>: {t('editor.connect_nodes')}</li>
                    <li><span className="text-scp-accent">Alt + Drag</span>: {t('editor.pan')}</li>
                    <li><span className="text-scp-accent">Scroll</span>: {t('editor.zoom')}</li>
                </ul>
                <div className="mt-2 pt-2 border-t border-scp-gray/30 text-xs text-gray-400">
                    {t('editor.nodes')}: {blueprint.nodes.length} | {t('editor.edges')}: {blueprint.edges.length}
                    {isConnecting && <span className="text-scp-alert ml-2 animate-pulse">[{t('editor.connecting')}...]</span>}
                </div>
            </div>
        </div>
    );
};

export default EditorCanvas;
