import React, { useRef, useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { MapBlueprint, MapBlueprintNode } from '../../types';
import { useTranslation } from '../../utils/i18n';
import GameLogo from '../GameLogo';
import {
    canvasAddButton,
    canvasOverlay,
    canvasOverlayAccent,
    canvasOverlayConnecting,
    canvasOverlayDot,
    canvasOverlayHeader,
    canvasOverlayList,
    canvasOverlayStat,
    canvasWatermark,
    canvasWatermarkLogo,
    canvasRoot,
    canvasSvg
} from './editorStyles';

export interface EditorCanvasRef {
    zoomIn: () => void;
    zoomOut: () => void;
}

interface EditorCanvasProps {
    blueprint: MapBlueprint;
    selection: { type: 'node' | 'edge' | 'npc' | 'objective', id: string } | null;
    setSelection: (sel: { type: 'node' | 'edge' | 'npc' | 'objective', id: string } | null) => void;
    updateNode: (id: string, updates: Partial<MapBlueprintNode>) => void;
    addNode?: () => void;
    addEdge: (from: string, to: string) => void;
    onDeleteSelection: () => void;
}

const EditorCanvas = forwardRef<EditorCanvasRef, EditorCanvasProps>(({ blueprint, selection, setSelection, updateNode, addNode, addEdge, onDeleteSelection }, ref) => {
    const { t } = useTranslation();
    const svgRef = useRef<SVGSVGElement>(null);
    const [viewTransform, setViewTransform] = useState({ scale: 2.0, x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const [panStart, setPanStart] = useState<{ x: number, y: number } | null>(null);
    const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
    const [dragPosition, setDragPosition] = useState<{ x: number, y: number } | null>(null);

    // Expose zoom methods via ref
    useImperativeHandle(ref, () => ({
        zoomIn: () => {
            setViewTransform(prev => ({ ...prev, scale: Math.min(prev.scale + 0.2, 5) }));
        },
        zoomOut: () => {
            setViewTransform(prev => ({ ...prev, scale: Math.max(prev.scale - 0.2, 0.1) }));
        }
    }));

    // Connection Drag State
    const [isConnecting, setIsConnecting] = useState(false);
    const [connectionStartId, setConnectionStartId] = useState<string | null>(null);
    const [connectionEndPos, setConnectionEndPos] = useState<{ x: number, y: number } | null>(null);
    const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

    // Zoom handlers
    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        
        // Check for pinch-zoom (ctrlKey) or standard wheel zoom (often ctrl+wheel)
        // Mac trackpad pinch usually triggers wheel with ctrlKey
        if (e.ctrlKey || e.metaKey) {
            const scaleChange = e.deltaY * -0.001;
            const newScale = Math.min(Math.max(0.1, viewTransform.scale + scaleChange), 5);
            setViewTransform(prev => ({ ...prev, scale: newScale }));
        } else {
            // Pan
            const dx = -e.deltaX;
            const dy = -e.deltaY;
            setViewTransform(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
        }
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
        // Left click on background for panning
        if (e.button === 0) {
            setIsPanning(true);
            setPanStart({ x: e.clientX, y: e.clientY });
            
            // Also clear selection
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
        low: '#33ff00', // Emerald 500 (Safe/Green)
        medium: '#f59e0b', // Amber 500
        high: '#ef4444' // Red 500
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
        <div className={canvasRoot}
             onContextMenu={(e) => e.preventDefault()}>
            <svg 
                ref={svgRef}
                className={canvasSvg}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onWheel={handleWheel}
            >
                <defs>
                    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255, 255, 255, 0.15)" strokeWidth="0.5"/>
                    </pattern>
                    <marker id="arrowhead" markerWidth="10" markerHeight="7" 
                        refX="9" refY="3.5" orient="auto">
                        <polygon points="0 0, 10 3.5, 0 7" fill="rgba(148, 163, 184, 0.5)" />
                    </marker>
                    <marker id="arrowhead-selected" markerWidth="10" markerHeight="7" 
                        refX="9" refY="3.5" orient="auto">
                        <polygon points="0 0, 10 3.5, 0 7" fill="#f59e0b" />
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
                                stroke={isSelected ? '#f59e0b' : 'rgba(148, 163, 184, 0.4)'}
                                strokeWidth={isSelected ? 2 : 1}
                                markerEnd={edge.bidirectional ? undefined : (isSelected ? "url(#arrowhead-selected)" : "url(#arrowhead)")}
                                className="cursor-pointer hover:stroke-scp-amber transition-colors"
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
                            stroke="#f59e0b"
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
                                className="cursor-move group"
                            >
                                {/* Highlight on hover during connection */}
                                {isConnecting && isHovered && connectionStartId !== node.id && (
                                    <circle r={8} fill="none" stroke="#f59e0b" strokeWidth="1" strokeDasharray="2" className="animate-pulse" />
                                )}

                                {/* Outer Glow (Selection) */}
                                {isSelected && (
                                    <circle r={8} fill="none" stroke="#f59e0b" strokeWidth="1" strokeOpacity="0.5" />
                                )}

                                {/* Main Node Body */}
                                <circle 
                                    r={isSelected ? 6 : 5} 
                                    fill="#0f172a"
                                    stroke={isSelected ? '#f59e0b' : color}
                                    strokeWidth={isSelected ? 2 : 1.5}
                                    fillOpacity={1}
                                />

                                {/* Inner Dot */}
                                <circle r={1.5} fill={color} />

                                <text 
                                    y={-10} 
                                    textAnchor="middle" 
                                    fill={isSelected ? '#f59e0b' : '#94a3b8'} 
                                    fontSize="6" 
                                    fontFamily="monospace"
                                    className="select-none pointer-events-none"
                                >
                                    {node.name}
                                </text>
                                {node.id === blueprint.startNodeId && (
                                    <text y={2} textAnchor="middle" fontSize="4" fill="#fff" fontWeight="bold" pointerEvents="none">S</text>
                                )}

                                {/* Connection Handle (Only visible when selected and not dragging node) */}
                                {isSelected && !draggingNodeId && (
                                    <g 
                                        transform="translate(10, 0)" 
                                        onMouseDown={(e) => onConnectionHandleMouseDown(e, node.id)}
                                        className="cursor-crosshair group"
                                    >
                                        {/* Invisible hit area to prevent jitter */}
                                        <circle r="6" fill="transparent" />
                                        {/* Visible handle with hover effect via CSS group */}
                                        <g className="transition-transform group-hover:scale-125">
                                            <circle r="2.5" fill="#f59e0b" stroke="#000" strokeWidth="0.5" />
                                            <path d="M -1 0 L 1 0 M 0 -1 L 0 1" stroke="#000" strokeWidth="0.5" />
                                        </g>
                                    </g>
                                )}

                                {/* Associated NPCs */}
                                {nodeNpcs.map((npc, idx) => {
                                    const isNpcSelected = selection?.type === 'npc' && selection.id === npc.id;
                                    return (
                                        <g key={npc.id} transform={`translate(8, ${-10 + (idx * 10)})`}
                                           onMouseDown={(e) => {
                                               e.stopPropagation();
                                               setSelection({ type: 'npc', id: npc.id });
                                           }}
                                        >
                                            <rect width="8" height="8" fill={isNpcSelected ? '#fff' : '#f59e0b'} rx="1" stroke="black" strokeWidth="0.5"/>
                                            <text x="4" y="5.5" fontSize="5" textAnchor="middle" fill="black" pointerEvents="none">N</text>
                                        </g>
                                    );
                                })}

                                {/* Associated Objectives */}
                                {nodeObjs.map((obj, idx) => {
                                    const isObjSelected = selection?.type === 'objective' && selection.id === obj.id;
                                    // Stack objectives below NPCs
                                    const yOffset = -10 + (nodeNpcs.length * 10) + (idx * 10); 
                                    return (
                                        <g key={obj.id} transform={`translate(8, ${yOffset})`}
                                           onMouseDown={(e) => {
                                               e.stopPropagation();
                                               setSelection({ type: 'objective', id: obj.id });
                                           }}
                                        >
                                            <rect width="8" height="8" fill={isObjSelected ? '#fff' : '#ef4444'} rx="1" stroke="black" strokeWidth="0.5"/>
                                            <text x="4" y="5.5" fontSize="5" textAnchor="middle" fill="black" pointerEvents="none">!</text>
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
                        className={canvasAddButton}
                    >
                        + {t('editor.add_node')}
                    </button>
                </div>
            )}
            
            <div className={canvasOverlay}>
                <div className={canvasOverlayHeader}>
                    <span className={canvasOverlayDot}>●</span> {t('editor.controls')}
                </div>
                <ul className={canvasOverlayList}>
                    <li><span className={canvasOverlayAccent}>Left Click + Drag</span>: {t('editor.pan')}</li>
                    <li><span className={canvasOverlayAccent}>Node Drag</span>: {t('editor.select_drag')}</li>
                    <li><span className={canvasOverlayAccent}>Drag Handle</span>: {t('editor.connect_nodes')}</li>
                    <li><span className={canvasOverlayAccent}>Shift + Click</span>: {t('editor.connect_nodes')}</li>
                    <li><span className={canvasOverlayAccent}>Scroll</span>: {t('editor.zoom')}</li>
                </ul>
                <div className={canvasOverlayStat}>
                    <span>{t('editor.nodes')}: {blueprint.nodes.length}</span>
                    <span>{t('editor.edges')}: {blueprint.edges.length}</span>
                </div>
                {isConnecting && <div className={canvasOverlayConnecting}>[{t('editor.connecting')}...]</div>}
            </div>
            <div className={canvasWatermark}>
                <GameLogo className={canvasWatermarkLogo} color="#ef4444" />
            </div>
        </div>
    );
});

export default EditorCanvas;
