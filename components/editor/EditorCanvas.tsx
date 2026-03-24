import React, { useRef, useState, useEffect, forwardRef, useImperativeHandle, useCallback } from 'react';
import { MapBlueprint, MapBlueprintNode } from '../../types';
import { useTranslation } from '../../utils/i18n';
import { ZoomIn, ZoomOut, Plus, Users, Target } from 'lucide-react';
import GameLogo from '../GameLogo';
import {
    canvasAddButton,
    canvasOverlay,
    canvasOverlayHeader,
    canvasOverlayList,
    canvasOverlayAccent,
    canvasOverlayDot,
    canvasOverlayStat,
    canvasOverlayConnecting,
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
    commitBlueprint?: () => void;
    onDeleteSelection: () => void;
    isMobile?: boolean;
    onAddNPC?: () => void;
    onAddObjective?: () => void;
    showMobileControls?: boolean;
}

type GestureType = 'none' | 'drag-node' | 'pan-canvas' | 'pinch-zoom';

interface GestureState {
    type: GestureType;
    pointerId?: number;
    startNodeLayout?: { x: number; y: number };
    initialDistance?: number;
    initialScale?: number;
    initialCenter?: { x: number; y: number };
    longPressTimer?: ReturnType<typeof setTimeout>;
    longPressTriggered?: boolean;
}

const EditorCanvas = forwardRef<EditorCanvasRef, EditorCanvasProps>(({
    blueprint,
    selection,
    setSelection,
    updateNode,
    addNode,
    addEdge,
    commitBlueprint,
    onDeleteSelection,
    isMobile = false,
    onAddNPC,
    onAddObjective,
    showMobileControls = true
}, ref) => {
    const { t } = useTranslation();
    const svgRef = useRef<SVGSVGElement>(null);
    const initialScale = isMobile ? 1.4 : 2.0;
    const [viewTransform, setViewTransform] = useState({ scale: initialScale, x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const [panStart, setPanStart] = useState<{ x: number, y: number } | null>(null);
    const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
    const [dragPosition, setDragPosition] = useState<{ x: number, y: number } | null>(null);
    const viewTransformRef = useRef(viewTransform);
    
    const gestureRef = useRef<GestureState>({ type: 'none' });
    const activePointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());

    useImperativeHandle(ref, () => ({
        zoomIn: () => {
            setViewTransform(prev => ({ ...prev, scale: Math.min(prev.scale + 0.2, 5) }));
        },
        zoomOut: () => {
            setViewTransform(prev => ({ ...prev, scale: Math.max(prev.scale - 0.2, 0.1) }));
        }
    }));

    const [isConnecting, setIsConnecting] = useState(false);
    const [connectionStartId, setConnectionStartId] = useState<string | null>(null);
    const [connectionEndPos, setConnectionEndPos] = useState<{ x: number, y: number } | null>(null);
    const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

    useEffect(() => {
        viewTransformRef.current = viewTransform;
    }, [viewTransform]);

    useEffect(() => {
        const node = svgRef.current;
        if (!node) return;
        const handleWheel = (e: WheelEvent) => {
            e.preventDefault();
            if (e.ctrlKey || e.metaKey) {
                const scaleChange = e.deltaY * -0.001;
                const nextScale = Math.min(Math.max(0.1, viewTransformRef.current.scale + scaleChange), 5);
                setViewTransform(prev => ({ ...prev, scale: nextScale }));
            } else {
                const dx = -e.deltaX;
                const dy = -e.deltaY;
                setViewTransform(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
            }
        };
        node.addEventListener('wheel', handleWheel, { passive: false });
        return () => {
            node.removeEventListener('wheel', handleWheel);
        };
    }, []);

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

    const findNodeAtPosition = useCallback((worldX: number, worldY: number): MapBlueprintNode | null => {
        const hitRadius = isMobile ? 24 : 10;
        for (const node of blueprint.nodes) {
            const nx = node.layout?.x ?? 0;
            const ny = node.layout?.y ?? 0;
            const dist = Math.hypot(worldX - nx, worldY - ny);
            if (dist <= hitRadius) {
                return node;
            }
        }
        return null;
    }, [blueprint.nodes, isMobile]);

    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.button === 0) {
            setIsPanning(true);
            setPanStart({ x: e.clientX, y: e.clientY });
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
            commitBlueprint?.();
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

    const handlePointerDown = (e: React.PointerEvent) => {
        if (!isMobile) return;
        
        activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        
        const pointerCount = activePointersRef.current.size;
        
        if (pointerCount === 1) {
            const worldPos = getWorldPoint(e.clientX, e.clientY);
            const hitNode = findNodeAtPosition(worldPos.x, worldPos.y);
            
            if (hitNode) {
                gestureRef.current = {
                    type: 'drag-node',
                    pointerId: e.pointerId,
                    startNodeLayout: hitNode.layout,
                    longPressTimer: setTimeout(() => {
                        if (gestureRef.current.type === 'drag-node') {
                            gestureRef.current.longPressTriggered = true;
                        }
                    }, 500)
                };
                setDraggingNodeId(hitNode.id);
                setDragPosition(hitNode.layout);
                setSelection({ type: 'node', id: hitNode.id });
            } else {
                gestureRef.current = {
                    type: 'pan-canvas',
                    pointerId: e.pointerId,
                    longPressTimer: setTimeout(() => {
                        if (gestureRef.current.type === 'pan-canvas') {
                            gestureRef.current.longPressTriggered = true;
                        }
                    }, 600)
                };
                setIsPanning(true);
                setPanStart({ x: e.clientX, y: e.clientY });
                setSelection(null);
            }
        } else if (pointerCount === 2) {
            clearTimeout(gestureRef.current.longPressTimer);
            
            const pointers = Array.from(activePointersRef.current.values());
            const p1 = pointers[0];
            const p2 = pointers[1];
            const distance = Math.hypot(p2.x - p1.x, p2.y - p1.y);
            const center = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
            
            gestureRef.current = {
                type: 'pinch-zoom',
                initialDistance: distance,
                initialScale: viewTransform.scale,
                initialCenter: center
            };
            
            setIsPanning(false);
            setDraggingNodeId(null);
        }
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isMobile) return;
        
        activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        
        const gesture = gestureRef.current;
        
        if (gesture.type === 'drag-node' && gesture.pointerId === e.pointerId) {
            clearTimeout(gesture.longPressTimer);
            
            const worldPos = getWorldPoint(e.clientX, e.clientY);
            setDragPosition(worldPos);
        } 
        else if (gesture.type === 'pan-canvas' && gesture.pointerId === e.pointerId) {
            const start = activePointersRef.current.get(e.pointerId);
            if (start) {
                const dx = e.clientX - start.x;
                const dy = e.clientY - start.y;
                if (Math.hypot(dx, dy) > 10) {
                    clearTimeout(gesture.longPressTimer);
                }
            }
            
            if (panStart) {
                const dx = e.clientX - panStart.x;
                const dy = e.clientY - panStart.y;
                setViewTransform(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
                setPanStart({ x: e.clientX, y: e.clientY });
            }
        }
        else if (gesture.type === 'pinch-zoom') {
            const pointers = Array.from(activePointersRef.current.values());
            if (pointers.length >= 2) {
                const p1 = pointers[0];
                const p2 = pointers[1];
                const currentDistance = Math.hypot(p2.x - p1.x, p2.y - p1.y);
                
                const scaleDelta = currentDistance / (gesture.initialDistance || 1);
                const newScale = Math.min(Math.max(gesture.initialScale! * scaleDelta, 0.1), 5);
                
                const currentCenter = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
                
                setViewTransform(prev => {
                    const dx = currentCenter.x - (gesture.initialCenter?.x || 0);
                    const dy = currentCenter.y - (gesture.initialCenter?.y || 0);
                    
                    return {
                        scale: newScale,
                        x: prev.x + dx,
                        y: prev.y + dy
                    };
                });
            }
        }
        else if (isConnecting) {
            const worldPos = getWorldPoint(e.clientX, e.clientY);
            setConnectionEndPos(worldPos);
        }
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        if (!isMobile) return;
        
        const gesture = gestureRef.current;
        
        clearTimeout(gesture.longPressTimer);
        
        if (gesture.type === 'drag-node' && draggingNodeId && dragPosition) {
            updateNode(draggingNodeId, { layout: dragPosition });
            commitBlueprint?.();
        }
        
        if (isConnecting && connectionStartId && hoveredNodeId) {
            addEdge(connectionStartId, hoveredNodeId);
        }
        
        activePointersRef.current.delete(e.pointerId);
        
        if (activePointersRef.current.size === 0) {
            gestureRef.current = { type: 'none' };
            setIsPanning(false);
            setDraggingNodeId(null);
            setDragPosition(null);
            setPanStart(null);
            setIsConnecting(false);
            setConnectionStartId(null);
            setConnectionEndPos(null);
        } else if (activePointersRef.current.size === 1) {
            gestureRef.current = { type: 'pan-canvas' };
        }
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!selection) return;
            
            if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;

            if (e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault();
                onDeleteSelection();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selection, onDeleteSelection]);

    const onNodeMouseDown = (e: React.MouseEvent, nodeId: string, currentLayout: { x: number, y: number }) => {
        e.stopPropagation();
        
        if (e.shiftKey) {
            if (selection?.type === 'node' && selection.id !== nodeId) {
                addEdge(selection.id, nodeId);
                setSelection({ type: 'node', id: nodeId });
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
        const node = blueprint.nodes.find(n => n.id === nodeId);
        if (node && node.layout) {
            setConnectionEndPos(node.layout);
        }
    };

    const radarColors = {
        low: '#33ff00',
        medium: '#f59e0b',
        high: '#ef4444'
    };

    const dangerColor = (danger: number) => {
        if (danger > 70) return radarColors.high;
        if (danger > 30) return radarColors.medium;
        return radarColors.low;
    };

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

    const nodeRadius = isMobile ? 10 : 6;
    const nodeHitRadius = isMobile ? 24 : 8;

    if (!blueprint) return null;

    return (
        <div className={canvasRoot}
             onContextMenu={(e) => e.preventDefault()}>
            <svg 
                ref={svgRef}
                className={canvasSvg}
                style={isMobile ? { touchAction: 'none' } : undefined}
                onMouseDown={!isMobile ? handleMouseDown : undefined}
                onMouseMove={!isMobile ? handleMouseMove : undefined}
                onMouseUp={!isMobile ? handleMouseUp : undefined}
                onMouseLeave={!isMobile ? handleMouseUp : undefined}
                onPointerDown={isMobile ? handlePointerDown : undefined}
                onPointerMove={isMobile ? handlePointerMove : undefined}
                onPointerUp={isMobile ? handlePointerUp : undefined}
                onPointerCancel={isMobile ? handlePointerUp : undefined}
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
                    {blueprint.edges.map((edge, idx) => {
                        const fromNode = blueprint.nodes.find(n => n.id === edge.from);
                        const toNode = blueprint.nodes.find(n => n.id === edge.to);
                        if (!fromNode || !toNode) return null;

                        const fromX = (draggingNodeId === fromNode.id && dragPosition) ? dragPosition.x : (fromNode.layout?.x ?? 0);
                        const fromY = (draggingNodeId === fromNode.id && dragPosition) ? dragPosition.y : (fromNode.layout?.y ?? 0);
                        const toX = (draggingNodeId === toNode.id && dragPosition) ? dragPosition.x : (toNode.layout?.x ?? 0);
                        const toY = (draggingNodeId === toNode.id && dragPosition) ? dragPosition.y : (toNode.layout?.y ?? 0);

                        const isSelected = selection?.type === 'edge' && selection.id === `${edge.from}-${edge.to}`;

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

                    {blueprint.nodes.map(node => {
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
                                onMouseDown={!isMobile ? (e) => onNodeMouseDown(e, node.id, { x, y }) : undefined}
                                onMouseEnter={!isMobile ? () => setHoveredNodeId(node.id) : undefined}
                                onMouseLeave={!isMobile ? () => setHoveredNodeId(null) : undefined}
                                className={!isMobile ? "cursor-move group" : undefined}
                            >
                                {isConnecting && isHovered && connectionStartId !== node.id && (
                                    <circle r={nodeRadius + 2} fill="none" stroke="#f59e0b" strokeWidth="1" strokeDasharray="2" className="animate-pulse" />
                                )}

                                {isSelected && (
                                    <circle r={nodeRadius + 2} fill="none" stroke="#f59e0b" strokeWidth="1" strokeOpacity="0.5" />
                                )}

                                <circle 
                                    r={isSelected ? nodeRadius + 2 : nodeRadius} 
                                    fill="#0f172a"
                                    stroke={isSelected ? '#f59e0b' : color}
                                    strokeWidth={isSelected ? 2 : 1.5}
                                    fillOpacity={1}
                                />

                                <circle r={isMobile ? 3 : 1.5} fill={color} />

                                {isMobile && (
                                    <circle r={nodeHitRadius} fill="transparent" />
                                )}

                                <text 
                                    y={isMobile ? -14 : -10} 
                                    textAnchor="middle" 
                                    fill={isSelected ? '#f59e0b' : '#94a3b8'} 
                                    fontSize={isMobile ? "8" : "6"} 
                                    fontFamily="monospace"
                                    className="select-none pointer-events-none"
                                >
                                    {node.name}
                                </text>
                                {node.id === blueprint.startNodeId && (
                                    <text y={isMobile ? 3 : 2} textAnchor="middle" fontSize={isMobile ? "5" : "4"} fill="#fff" fontWeight="bold" pointerEvents="none">S</text>
                                )}

                                {isSelected && !draggingNodeId && !isMobile && (
                                    <g 
                                        transform="translate(10, 0)" 
                                        onMouseDown={(e) => onConnectionHandleMouseDown(e, node.id)}
                                        className="cursor-crosshair group"
                                    >
                                        <circle r="6" fill="transparent" />
                                        <g className="transition-transform group-hover:scale-125">
                                            <circle r="2.5" fill="#f59e0b" stroke="#000" strokeWidth="0.5" />
                                            <path d="M -1 0 L 1 0 M 0 -1 L 0 1" stroke="#000" strokeWidth="0.5" />
                                        </g>
                                    </g>
                                )}

                                {nodeNpcs.map((npc, idx) => {
                                    const isNpcSelected = selection?.type === 'npc' && selection.id === npc.id;
                                    const iconSize = isMobile ? 12 : 8;
                                    const yOffset = isMobile ? -14 + (idx * 12) : -10 + (idx * 10);
                                    return (
                                        <g key={npc.id} transform={`translate(${isMobile ? 12 : 8}, ${yOffset})`}
                                           onMouseDown={(e) => {
                                               e.stopPropagation();
                                               setSelection({ type: 'npc', id: npc.id });
                                           }}
                                        >
                                            <rect width={iconSize} height={iconSize} fill={isNpcSelected ? '#fff' : '#f59e0b'} rx="1" stroke="black" strokeWidth="0.5"/>
                                            <text x={iconSize/2} y={iconSize/2 + 1} fontSize={isMobile ? "7" : "5"} textAnchor="middle" fill="black" pointerEvents="none">N</text>
                                        </g>
                                    );
                                })}

                                {nodeObjs.map((obj, idx) => {
                                    const isObjSelected = selection?.type === 'objective' && selection.id === obj.id;
                                    const iconSize = isMobile ? 12 : 8;
                                    const yOffset = isMobile ? -14 + (nodeNpcs.length * 12) + (idx * 12) : -10 + (nodeNpcs.length * 10) + (idx * 10);
                                    return (
                                        <g key={obj.id} transform={`translate(${isMobile ? 12 : 8}, ${yOffset})`}
                                           onMouseDown={(e) => {
                                               e.stopPropagation();
                                               setSelection({ type: 'objective', id: obj.id });
                                           }}
                                        >
                                            <rect width={iconSize} height={iconSize} fill={isObjSelected ? '#fff' : '#ef4444'} rx="1" stroke="black" strokeWidth="0.5"/>
                                            <text x={iconSize/2} y={iconSize/2 + 1} fontSize={isMobile ? "7" : "5"} textAnchor="middle" fill="black" pointerEvents="none">!</text>
                                        </g>
                                    );
                                })}
                            </g>
                        );
                    })}
                </g>
            </svg>

            {addNode && !isMobile && (
                <div className="absolute top-4 left-4 flex flex-col gap-2">
                    <button 
                        type="button"
                        onClick={addNode}
                        className={canvasAddButton}
                    >
                        + {t('map_editor.add_node')}
                    </button>
                </div>
            )}
            
            {isMobile && showMobileControls && (
                <div className="absolute top-3 left-3 flex flex-col gap-2 z-10">
                    <button
                        onClick={() => {
                            if (typeof ref === 'object' && ref?.current) {
                                ref.current.zoomIn();
                            }
                        }}
                        className="w-11 h-11 flex items-center justify-center bg-black/80 border border-[var(--scp-border)] rounded-sm text-scp-text hover:text-scp-amber transition-colors"
                    >
                        <ZoomIn size={20} strokeWidth={1.5} />
                    </button>
                    <button
                        onClick={() => {
                            if (typeof ref === 'object' && ref?.current) {
                                ref.current.zoomOut();
                            }
                        }}
                        className="w-11 h-11 flex items-center justify-center bg-black/80 border border-[var(--scp-border)] rounded-sm text-scp-text hover:text-scp-amber transition-colors"
                    >
                        <ZoomOut size={20} strokeWidth={1.5} />
                    </button>
                    {addNode && (
                        <button
                            onClick={addNode}
                            className="w-11 h-11 flex items-center justify-center bg-black/80 border border-[var(--scp-border)] rounded-sm text-scp-text hover:text-scp-amber transition-colors"
                        >
                            <Plus size={20} strokeWidth={1.5} />
                        </button>
                    )}
                </div>
            )}

            {isMobile && showMobileControls && onAddNPC && onAddObjective && (
                <div className="absolute top-3 right-3 flex flex-col gap-2 z-10">
                    <button
                        onClick={onAddNPC}
                        className="h-11 px-3 flex items-center justify-center gap-2 bg-black/80 border border-scp-amber/30 rounded-sm text-scp-amber hover:bg-scp-amber/10 transition-colors text-xs font-mono"
                    >
                        <Users size={16} strokeWidth={1.5} /> NPC
                    </button>
                    <button
                        onClick={onAddObjective}
                        className="h-11 px-3 flex items-center justify-center gap-2 bg-black/80 border border-scp-accent/30 rounded-sm text-scp-accent hover:bg-scp-accent/10 transition-colors text-xs font-mono"
                    >
                        <Target size={16} strokeWidth={1.5} /> OBJ
                    </button>
                </div>
            )}
            
            {!isMobile && (
                <div className={canvasOverlay}>
                    <div className={canvasOverlayHeader}>
                        <span className={canvasOverlayDot}>●</span> {t('map_editor.controls')}
                    </div>
                    <ul className={canvasOverlayList}>
                        <li><span className={canvasOverlayAccent}>Left Click + Drag</span>: {t('map_editor.pan')}</li>
                        <li><span className={canvasOverlayAccent}>Node Drag</span>: {t('map_editor.select_drag')}</li>
                        <li><span className={canvasOverlayAccent}>Drag Handle</span>: {t('map_editor.connect_nodes')}</li>
                        <li><span className={canvasOverlayAccent}>Shift + Click</span>: {t('map_editor.connect_nodes')}</li>
                        <li><span className={canvasOverlayAccent}>Scroll</span>: {t('map_editor.zoom')}</li>
                    </ul>
                    <div className={canvasOverlayStat}>
                        <span>{t('map_editor.nodes')}: {blueprint.nodes.length}</span>
                        <span>{t('map_editor.edges')}: {blueprint.edges.length}</span>
                    </div>
                    {isConnecting && <div className={canvasOverlayConnecting}>[{t('map_editor.connecting')}...]</div>}
                </div>
            )}
            
            {isMobile && (
                <div className="absolute bottom-3 left-3 text-xs text-scp-text-dim font-mono pointer-events-none bg-black/80 px-2 py-1 rounded border border-[var(--scp-border)]">
                    <span>{t('map_editor.nodes')}: {blueprint.nodes.length}</span>
                    <span className="ml-2">{t('map_editor.edges')}: {blueprint.edges.length}</span>
                </div>
            )}
            
            <div className={canvasWatermark}>
                <GameLogo className={canvasWatermarkLogo} color="#ef4444" />
            </div>
        </div>
    );
});

export default EditorCanvas;
