import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { MapBlueprint } from '../../types';
import { useNetworkView } from '../../hooks/useNetworkView';
import { useTranslation } from '../../utils/i18n';
import { buildNetworkLayout, fitNetworkView, NETWORK_GEOMETRY, NetworkPoint, networkCurve } from '../../utils/siteNetwork';
import GameButton from '../common/GameButton';
import NetworkBackdrop from '../game/stage/NetworkBackdrop';
import NetworkLegend from '../game/stage/NetworkLegend';
import NetworkNode from '../game/stage/NetworkNode';
import { EDGE_ID_SEPARATOR, EditorSelection } from './PropertyInspector';

const GEOMETRY = NETWORK_GEOMETRY.wide;
const HANDLE_OFFSET = 46;
const DRAG_THRESHOLD = 3;
const LONG_PRESS_MS = 500;

export interface EditorCanvasRef {
    /** The world position at the middle of the view, where a new node appears */
    centerPoint: () => NetworkPoint | null;
}

interface EditorCanvasProps {
    blueprint: MapBlueprint;
    selection: EditorSelection;
    setSelection: (sel: EditorSelection) => void;
    moveNode: (id: string, point: NetworkPoint) => void;
    addNode: () => void;
    addEdge: (from: string, to: string) => void;
    restoreAutoLayout: () => void;
    onDeleteSelection: () => void;
    npcImages?: Record<string, string>;
}

type Gesture =
    | { type: 'pan'; px: number; py: number; x: number; y: number; moved: boolean }
    | { type: 'node'; id: string; dx: number; dy: number; px: number; py: number; moved: boolean; timer?: ReturnType<typeof setTimeout> }
    | { type: 'connect' }
    | { type: 'pinch'; distance: number; k: number; cx: number; cy: number; x: number; y: number };

const EditorCanvas = forwardRef<EditorCanvasRef, EditorCanvasProps>(({ blueprint, selection, setSelection, moveNode, addNode, addEdge, restoreAutoLayout, onDeleteSelection, npcImages }, ref) => {
    const { t } = useTranslation();
    const [dragged, setDragged] = useState<{ id: string; point: NetworkPoint } | null>(null);
    const [connect, setConnect] = useState<{ from: string; point: NetworkPoint; over: string | null } | null>(null);
    const [helpOpen, setHelpOpen] = useState(false);
    const gesture = useRef<Gesture | null>(null);
    const pointers = useRef(new Map<number, { x: number; y: number }>());
    const userMoved = useRef(false);
    const seenNodes = useRef(new Set(blueprint.nodes.map(node => node.id)));

    const laidOut = useMemo(() => buildNetworkLayout(blueprint, false), [blueprint]);
    const positions = useMemo(() => (dragged ? { ...laidOut, [dragged.id]: dragged.point } : laidOut), [dragged, laidOut]);
    const network = useNetworkView({ positions, currentId: '', minZoom: 0.25, maxZoom: 2.6, wheel: 'pan' });

    const fit = useCallback(() => {
        const box = network.svgRef.current?.getBoundingClientRect();
        if (!box?.width || !box.height) return;
        const view = fitNetworkView(laidOut, box.width, box.height, { top: 130, bottom: 130 });
        if (view) network.setView(view);
    }, [laidOut, network.setView, network.svgRef]);

    useLayoutEffect(() => {
        if (!userMoved.current) fit();
    }, [fit]);

    useEffect(() => {
        const svg = network.svgRef.current;
        if (!svg || typeof ResizeObserver === 'undefined') return;
        const observer = new ResizeObserver(() => {
            if (!userMoved.current) fit();
        });
        observer.observe(svg);
        return () => observer.disconnect();
    }, [fit, network.svgRef]);

    useEffect(() => {
        seenNodes.current = new Set(blueprint.nodes.map(node => node.id));
    }, [blueprint.nodes]);

    const toWorld = useCallback((clientX: number, clientY: number): NetworkPoint => {
        const box = network.svgRef.current?.getBoundingClientRect();
        const { x, y, k } = network.viewRef.current;
        return { x: (clientX - (box?.left ?? 0) - x) / k, y: (clientY - (box?.top ?? 0) - y) / k };
    }, [network.svgRef, network.viewRef]);

    useImperativeHandle(ref, () => ({
        centerPoint: () => {
            const box = network.svgRef.current?.getBoundingClientRect();
            return box?.width ? toWorld(box.left + box.width / 2, box.top + box.height / 2) : null;
        }
    }), [network.svgRef, toWorld]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!selection) return;
            const active = document.activeElement?.tagName;
            if (active === 'INPUT' || active === 'TEXTAREA') return;
            if (e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault();
                onDeleteSelection();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selection, onDeleteSelection]);

    const nodeNear = (point: NetworkPoint, except: string) => Object.entries(positions).find(([id, at]) => id !== except && Math.hypot(at.x - point.x, at.y - point.y) < GEOMETRY.hit)?.[0] ?? null;
    const cancelLongPress = () => {
        if (gesture.current?.type === 'node') clearTimeout(gesture.current.timer);
    };

    const handlePointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
        if (event.button) return;
        const svg = event.currentTarget;
        const box = svg.getBoundingClientRect();
        pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

        if (pointers.current.size === 2) {
            cancelLongPress();
            setDragged(null);
            setConnect(null);
            const [a, b] = Array.from(pointers.current.values());
            const { x, y, k } = network.viewRef.current;
            gesture.current = { type: 'pinch', distance: Math.hypot(b.x - a.x, b.y - a.y) || 1, k, cx: (a.x + b.x) / 2 - box.left, cy: (a.y + b.y) / 2 - box.top, x, y };
            userMoved.current = true;
            return;
        }
        if (pointers.current.size > 2) return;

        const target = event.target as Element;
        svg.setPointerCapture(event.pointerId);

        const handle = target.closest('[data-handle]')?.getAttribute('data-handle');
        if (handle) {
            setConnect({ from: handle, point: toWorld(event.clientX, event.clientY), over: null });
            gesture.current = { type: 'connect' };
            return;
        }
        const npc = target.closest('[data-npc]')?.getAttribute('data-npc');
        if (npc) {
            setSelection({ type: 'npc', id: npc });
            return;
        }
        const objective = target.closest('[data-objective]')?.getAttribute('data-objective');
        if (objective) {
            setSelection({ type: 'objective', id: objective });
            return;
        }
        const nodeId = target.closest('[data-id]')?.getAttribute('data-id');
        if (nodeId) {
            if (event.shiftKey && selection?.type === 'node' && selection.id !== nodeId) {
                addEdge(selection.id, nodeId);
                setSelection({ type: 'node', id: nodeId });
                return;
            }
            setSelection({ type: 'node', id: nodeId });
            const at = positions[nodeId];
            const point = toWorld(event.clientX, event.clientY);
            gesture.current = {
                type: 'node',
                id: nodeId,
                dx: at.x - point.x,
                dy: at.y - point.y,
                px: event.clientX,
                py: event.clientY,
                moved: false,
                // A finger has no room for the handle while it covers the node, so a long press starts a connection too
                timer: event.pointerType === 'touch' ? setTimeout(() => {
                    setDragged(null);
                    setConnect({ from: nodeId, point: at, over: null });
                    gesture.current = { type: 'connect' };
                }, LONG_PRESS_MS) : undefined,
            };
            return;
        }
        const edge = target.closest('[data-edge]')?.getAttribute('data-edge');
        if (edge) {
            setSelection({ type: 'edge', id: edge });
            return;
        }
        const { x, y } = network.viewRef.current;
        gesture.current = { type: 'pan', px: event.clientX, py: event.clientY, x, y, moved: false };
    };

    const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
        if (pointers.current.has(event.pointerId)) pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
        const current = gesture.current;
        if (!current) return;
        if (current.type === 'pinch') {
            const [a, b] = Array.from(pointers.current.values());
            if (!a || !b) return;
            const box = event.currentTarget.getBoundingClientRect();
            const scale = Math.max(0.25 / current.k, Math.min(2.6 / current.k, Math.hypot(b.x - a.x, b.y - a.y) / current.distance));
            const k = current.k * scale;
            const cx = (a.x + b.x) / 2 - box.left;
            const cy = (a.y + b.y) / 2 - box.top;
            network.setView({ k, x: cx - (current.cx - current.x) * scale, y: cy - (current.cy - current.y) * scale });
        } else if (current.type === 'pan') {
            const dx = event.clientX - current.px;
            const dy = event.clientY - current.py;
            if (!current.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
            current.moved = true;
            userMoved.current = true;
            event.currentTarget.classList.add('grabbing');
            network.setView({ ...network.viewRef.current, x: current.x + dx, y: current.y + dy });
        } else if (current.type === 'node') {
            if (!current.moved && Math.hypot(event.clientX - current.px, event.clientY - current.py) < DRAG_THRESHOLD) return;
            clearTimeout(current.timer);
            current.moved = true;
            const point = toWorld(event.clientX, event.clientY);
            setDragged({ id: current.id, point: { x: point.x + current.dx, y: point.y + current.dy } });
        } else {
            const point = toWorld(event.clientX, event.clientY);
            setConnect(prev => (prev ? { ...prev, point, over: nodeNear(point, prev.from) } : prev));
        }
    };

    const handlePointerEnd = (event: React.PointerEvent<SVGSVGElement>) => {
        pointers.current.delete(event.pointerId);
        const current = gesture.current;
        if (pointers.current.size) {
            if (current?.type === 'pinch') {
                const [rest] = Array.from(pointers.current.values());
                const { x, y } = network.viewRef.current;
                gesture.current = { type: 'pan', px: rest.x, py: rest.y, x, y, moved: true };
            }
            return;
        }
        gesture.current = null;
        event.currentTarget.classList.remove('grabbing');
        if (!current) return;
        if (current.type === 'pan' && !current.moved) setSelection(null);
        if (current.type === 'node') {
            clearTimeout(current.timer);
            if (current.moved && dragged) {
                userMoved.current = true;
                moveNode(dragged.id, dragged.point);
            }
            setDragged(null);
        }
        if (current.type === 'connect') {
            if (connect?.over) addEdge(connect.from, connect.over);
            setConnect(null);
        }
    };

    const pickedEdge = selection?.type === 'edge' ? selection.id : null;

    return (
        <>
            <NetworkBackdrop />
            <svg
                ref={network.svgRef}
                className="net-svg"
                role="img"
                aria-label={blueprint.title}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerEnd}
                onPointerCancel={handlePointerEnd}
                onWheel={() => { userMoved.current = true; }}
            >
                <defs>
                    <marker id="ed-arrow" markerWidth="11" markerHeight="8" refX="10" refY="4" orient="auto"><polygon points="0 0, 11 4, 0 8" fill="rgba(51,255,0,.8)" /></marker>
                    <marker id="ed-arrow-pick" markerWidth="11" markerHeight="8" refX="10" refY="4" orient="auto"><polygon points="0 0, 11 4, 0 8" fill="#f59e0b" /></marker>
                </defs>
                <g ref={network.worldRef}>
                    {blueprint.edges.map(edge => {
                        const a = positions[edge.from];
                        const b = positions[edge.to];
                        if (!a || !b) return null;
                        const id = `${edge.from}${EDGE_ID_SEPARATOR}${edge.to}`;
                        const picked = pickedEdge === id;
                        const full = `M ${a.x} ${a.y} ${networkCurve(a, b)}`;
                        let line = full;
                        if (!edge.bidirectional) {
                            // Stop the arrow at the node's ring instead of its centre
                            const distance = Math.hypot(b.x - a.x, b.y - a.y) || 1;
                            const tip = { x: b.x - ((b.x - a.x) / distance) * (GEOMETRY.ring + 3), y: b.y - ((b.y - a.y) / distance) * (GEOMETRY.ring + 3) };
                            line = `M ${a.x} ${a.y} ${networkCurve(a, tip)}`;
                        }
                        return (
                            <React.Fragment key={id}>
                                <path className="e-hit" data-edge={id} d={full} />
                                <path className={`net-edge ${picked ? 'pick' : ''}`} d={line} markerEnd={edge.bidirectional ? undefined : `url(#${picked ? 'ed-arrow-pick' : 'ed-arrow'})`} />
                            </React.Fragment>
                        );
                    })}
                    {connect && positions[connect.from] && <path className="c-line" d={`M ${positions[connect.from].x} ${positions[connect.from].y} L ${connect.point.x} ${connect.point.y}`} />}
                    {blueprint.nodes.map(node => {
                        const point = positions[node.id];
                        if (!point) return null;
                        const isSelected = selection?.type === 'node' && selection.id === node.id;
                        return (
                            <NetworkNode
                                key={node.id}
                                node={node}
                                point={point}
                                compact={false}
                                known
                                selected={isSelected}
                                reticleOnSelected
                                isStart={node.id === blueprint.startNodeId}
                                marks={blueprint.objectives.filter(objective => objective.nodeId === node.id).map(objective => ({ id: objective.id, type: objective.type, picked: selection?.type === 'objective' && selection.id === objective.id }))}
                                faces={blueprint.npcs.filter(npc => npc.initialNodeId === node.id).map(npc => ({ id: npc.id, image: npcImages?.[npc.id], picked: selection?.type === 'npc' && selection.id === npc.id }))}
                                gate={(node.requires ?? []).length ? 'locked' : null}
                                gateLabels={{ locked: t('stage.network.legend_gate'), authorized: '' }}
                                dangerLabel={t('stage.network.danger')}
                                idPrefix="ed"
                                focusable
                                className={`${connect?.over === node.id ? 'c-target' : ''} ${seenNodes.current.has(node.id) ? '' : 'fresh'}`}
                            >
                                {isSelected && (
                                    <g className="n-handle" data-handle={node.id}>
                                        <circle cx={point.x + HANDLE_OFFSET} cy={point.y + 2} r={15} />
                                        <circle cx={point.x + HANDLE_OFFSET} cy={point.y + 2} r={7} />
                                        <path d={`M ${point.x + HANDLE_OFFSET - 3.5} ${point.y + 2} H ${point.x + HANDLE_OFFSET + 3.5} M ${point.x + HANDLE_OFFSET} ${point.y - 1.5} V ${point.y + 5.5}`} />
                                    </g>
                                )}
                            </NetworkNode>
                        );
                    })}
                </g>
            </svg>
            <div className="ed-tl">
                <GameButton size="sm" onClick={addNode}>+ {t('map_editor.add_node')}</GameButton>
                {blueprint.manualLayout && (
                    <span className="ed-layout">
                        {t('map_editor.manual_layout')}
                        <GameButton
                            variant="quiet"
                            size="sm"
                            onClick={() => {
                                userMoved.current = false;
                                restoreAutoLayout();
                            }}
                        >
                            {t('map_editor.restore_auto_layout')}
                        </GameButton>
                    </span>
                )}
            </div>
            <div className="ed-bl">
                <div className="ed-zoom">
                    <GameButton variant="icon" aria-label={t('stage.network.zoom_in')} onClick={() => { userMoved.current = true; network.zoomCenter(1.2); }}>+</GameButton>
                    <GameButton variant="icon" aria-label={t('stage.network.zoom_out')} onClick={() => { userMoved.current = true; network.zoomCenter(1 / 1.2); }}>−</GameButton>
                    <GameButton variant="icon" aria-label={t('stage.network.reset')} onClick={() => { userMoved.current = false; fit(); }}>⟲</GameButton>
                </div>
                <NetworkLegend className="legend" inGame={false} t={t} />
                <div className="ed-count">
                    {blueprint.nodes.length} {t('map_editor.nodes')} · {blueprint.edges.length} {t('map_editor.edges')}
                    {connect && <span className="conn">[{t('map_editor.connecting')}...]</span>}
                </div>
                <div className="ed-help">
                    <GameButton variant="quiet" size="sm" aria-expanded={helpOpen} onClick={() => setHelpOpen(open => !open)}>{t('map_editor.controls')}</GameButton>
                    {helpOpen && (
                        <div className="ed-help-pop">
                            <div><b>{t('map_editor.help_key_blank')}</b>{t('map_editor.help_pan')}</div>
                            <div><b>{t('map_editor.help_key_node')}</b>{t('map_editor.select_drag')}</div>
                            <div><b>{t('map_editor.help_key_handle')}</b>{t('map_editor.connect_nodes')}</div>
                            <div><b>{t('map_editor.help_key_shift')}</b>{t('map_editor.connect_nodes')}</div>
                            <div><b>{t('map_editor.help_key_wheel')}</b>{t('map_editor.help_pan')}</div>
                            <div><b>{t('map_editor.help_key_ctrl_wheel')}</b>{t('map_editor.help_zoom')}</div>
                            <div><b>{t('map_editor.help_key_delete')}</b>{t('map_editor.help_delete')}</div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
});

EditorCanvas.displayName = 'EditorCanvas';

export default EditorCanvas;
