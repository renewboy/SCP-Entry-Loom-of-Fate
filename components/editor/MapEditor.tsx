import React, { useState, useEffect, useRef } from 'react';
import { MapBlueprint, MapBlueprintNode, MapBlueprintEdge, MapBlueprintNPC, MapBlueprintObjective, GameState, GameStatus } from '../../types';
import { useTranslation } from '../../utils/i18n';
import EditorCanvas, { EditorCanvasRef } from './EditorCanvas';
import PropertyInspector from './PropertyInspector';
import ConfirmationModal from '../ConfirmationModal';
import SidePanel from '../common/SidePanel';
import {
    addEntityButtonNpc,
    addEntityButtonObj,
    editorPanelHeader,
    editorPanelTitle,
    listItemBase,
    listItemInactive,
    listItemNpcActive,
    listItemObjectiveActive,
    panelContainerBase,
    modalOverlay,
    modalPanel,
    modalHeader,
    modalBody,
    modalFooter,
    toolbarHistoryButton,
    toolbarButtonBase,
    toolbarButtonGhost,
    toolbarGroupDivider,
    toolbarIconButton
} from './editorStyles';
import { loadEditingBlueprint, saveEditingBlueprint } from '../../services/indexedDBService';
import { getEditingBlueprintCache, setEditingBlueprintCache, clearEditingBlueprintCache } from '../../services/blueprintCache';
import { applyLayoutToBlueprint } from '../../utils/mapLayout';
import { useHistory } from '../../hooks/useHistory';

interface MapEditorProps {
    gameState: GameState;
    setGameState: React.Dispatch<React.SetStateAction<GameState>>;
}

const DEFAULT_BLUEPRINT: MapBlueprint = {
    id: 'new_map',
    title: 'New SCP Facility',
    startNodeId: 'node_start',
    nodes: [
        { id: 'node_start', name: 'Entrance', danger: 0, layout: { x: 100, y: 100 } },
        { id: 'node_hallway', name: 'Hallway', danger: 20, layout: { x: 180, y: 100 } },
        { id: 'node_containment', name: 'Containment', danger: 80, requires: ['key_card_3'], layout: { x: 260, y: 100 } }
    ],
    edges: [
        { from: 'node_start', to: 'node_hallway', bidirectional: true },
        { from: 'node_hallway', to: 'node_containment', bidirectional: true }
    ],
    npcs: [],
    objectives: []
};

const MapEditor: React.FC<MapEditorProps> = ({ gameState, setGameState }) => {
    const { t } = useTranslation();
    const { state: blueprintState, setState: setBlueprint, undo, redo, canUndo, canRedo } = useHistory<MapBlueprint>(DEFAULT_BLUEPRINT);
    
    const blueprint = blueprintState || DEFAULT_BLUEPRINT;

    const [selection, setSelection] = useState<{ type: 'node' | 'edge' | 'npc' | 'objective', id: string } | null>(null);
    const [modal, setModal] = useState<{ isOpen: boolean; title: string; content: React.ReactNode; onConfirm?: () => void } | null>(null);
    const [showNewMapConfirm, setShowNewMapConfirm] = useState(false);
    const hasLoadedRef = useRef(false);
    const canvasRef = useRef<EditorCanvasRef>(null);

    useEffect(() => {
        if (hasLoadedRef.current) return;
        hasLoadedRef.current = true;
        const loadInitial = async () => {
            const memoryCached = getEditingBlueprintCache();
            if (memoryCached) {
                setBlueprint(memoryCached);
                return;
            }
            const cached = await loadEditingBlueprint();
            if (cached) {
                setBlueprint(cached);
                return;
            }
            if (gameState.scpData?.mapBlueprint) {
                setBlueprint(gameState.scpData.mapBlueprint);
            }
        };
        loadInitial();
    }, [gameState.scpData, setBlueprint]);

    useEffect(() => {
        setEditingBlueprintCache(blueprint);
    }, [blueprint]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;

            if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
                if (e.shiftKey) {
                    e.preventDefault();
                    if (canRedo) redo();
                } else {
                    e.preventDefault();
                    if (canUndo) undo();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [undo, redo, canUndo, canRedo]);

    const closeModal = () => setModal(null);

    const showImportModal = () => {
        let importText = '';
        setModal({
            isOpen: true,
            title: t('editor.import'),
            content: (
                <div className="space-y-4">
                    <p className="text-xs text-scp-text/70">{t('editor.msg_import')}</p>
                    <textarea 
                        className="w-full h-40 bg-black/50 border border-[var(--scp-border)] text-xs font-mono p-2 text-scp-text focus:outline-none focus:border-scp-alert"
                        onChange={e => importText = e.target.value}
                        placeholder="{ ... }"
                    />
                </div>
            ),
            onConfirm: () => {
                try {
                    const json = JSON.parse(importText);
                    if (json.nodes && json.edges) {
                        setBlueprint(applyLayoutToBlueprint(json, { width: 720, height: 420, paddingX: 60, paddingY: 50 }));
                        closeModal();
                    } else {
                        alert(t('editor.validation_error')); 
                    }
                } catch (e) {
                    alert(t('editor.json_error'));
                }
            }
        });
    };

    const showExportModal = () => {
        const json = JSON.stringify(blueprint, null, 2);
        setModal({
            isOpen: true,
            title: t('editor.export'),
            content: (
                <div className="space-y-4">
                    <p className="text-xs text-scp-text/70">{t('editor.msg_export')}</p>
                    <textarea 
                        readOnly
                        value={json}
                        className="w-full h-40 bg-black/50 border border-[var(--scp-border)] text-xs font-mono p-2 text-scp-text focus:outline-none focus:border-scp-alert select-all"
                    />
                </div>
            ),
            onConfirm: () => {
                navigator.clipboard.writeText(json);
                closeModal();
            }
        });
    };

    const handleBack = async () => {
        await saveEditingBlueprint(blueprint);
        clearEditingBlueprintCache();
        if (gameState.scpData && gameState.scpData.designation !== 'TEST-RUN') {
            setGameState(prev => ({
                ...prev,
                status: GameStatus.TACTICAL_PREVIEW,
                scpData: { ...prev.scpData!, mapBlueprint: blueprint }
            }));
        } else {
            setGameState(prev => ({ ...prev, status: GameStatus.IDLE }));
        }
    };

    const handleTestRun = () => {
        setGameState(prev => ({
            ...prev,
            status: GameStatus.PLAYING,
            scpData: {
                designation: 'TEST-RUN',
                name: blueprint.title,
                containmentClass: 'Euclid',
                description: 'Custom Scenario Test Run',
                mapBlueprint: blueprint
            },
            role: 'TESTER',
            messages: [{
                id: 'msg_start',
                sender: 'system',
                content: `[TEST RUN INITIATED] Loading custom map: ${blueprint.title}...`,
                timestamp: Date.now()
            }],
            map: {
                id: blueprint.id,
                title: blueprint.title,
                currentNodeId: blueprint.startNodeId,
                discoveredNodeIds: [blueprint.startNodeId]
            },
            stability: 100,
            turnCount: 0
        }));
    };

    const updateNode = (id: string, updates: Partial<MapBlueprintNode>) => {
        setBlueprint(prev => {
            if (updates.id && updates.id !== id) {
                const newId = updates.id;
                if (selection?.type === 'node' && selection.id === id) {
                    setSelection(s => s ? { ...s, id: newId } : null);
                }
                return {
                    ...prev,
                    nodes: prev.nodes.map(n => n.id === id ? { ...n, ...updates } : n),
                    edges: prev.edges.map(e => ({
                        ...e,
                        from: e.from === id ? newId : e.from,
                        to: e.to === id ? newId : e.to
                    })),
                    npcs: prev.npcs.map(n => ({
                        ...n,
                        initialNodeId: n.initialNodeId === id ? newId : n.initialNodeId
                    })),
                    objectives: prev.objectives.map(o => ({
                        ...o,
                        nodeId: o.nodeId === id ? newId : o.nodeId
                    })),
                    startNodeId: prev.startNodeId === id ? newId : prev.startNodeId
                };
            }
            return {
                ...prev,
                nodes: prev.nodes.map(n => n.id === id ? { ...n, ...updates } : n)
            };
        });
    };

    const updateEdge = (from: string, to: string, updates: Partial<MapBlueprintEdge>) => {
        setBlueprint(prev => ({
            ...prev,
            edges: prev.edges.map(e => (e.from === from && e.to === to) ? { ...e, ...updates } : e)
        }));
    };

    const updateNPC = (id: string, updates: Partial<MapBlueprintNPC>) => {
        setBlueprint(prev => {
            if (updates.id && updates.id !== id) {
                if (selection?.type === 'npc' && selection.id === id) {
                    setSelection(s => s ? { ...s, id: updates.id! } : null);
                }
            }
            return {
                ...prev,
                npcs: prev.npcs.map(n => n.id === id ? { ...n, ...updates } : n)
            };
        });
    };

    const updateObjective = (id: string, updates: Partial<MapBlueprintObjective>) => {
        setBlueprint(prev => {
            if (updates.id && updates.id !== id) {
                if (selection?.type === 'objective' && selection.id === id) {
                    setSelection(s => s ? { ...s, id: updates.id! } : null);
                }
            }
            return {
                ...prev,
                objectives: prev.objectives.map(o => o.id === id ? { ...o, ...updates } : o)
            };
        });
    };

    const addNode = () => {
        const id = `node_${Math.floor(Math.random() * 900) + 100}`;
        const newNode: MapBlueprintNode = {
            id,
            name: 'New Node',
            danger: 0,
            layout: { x: 100, y: 100 }
        };
        setBlueprint(prev => ({ ...prev, nodes: [...prev.nodes, newNode] }));
        setSelection({ type: 'node', id });
    };

    const addEdge = (from: string, to: string) => {
        const exists = blueprint.edges.some(e => 
            (e.from === from && e.to === to) || (e.bidirectional && e.from === to && e.to === from)
        );
        if (exists) return;

        setBlueprint(prev => ({
            ...prev,
            edges: [...prev.edges, { from, to, bidirectional: true }]
        }));
    };

    const addNPC = () => {
        const id = `npc_${Math.floor(Math.random() * 900) + 100}`;
        const targetNodeId = (selection?.type === 'node' && selection.id) ? selection.id : blueprint.startNodeId;
        const newNPC: MapBlueprintNPC = {
            id,
            name: 'New NPC',
            archetype: 'Researcher',
            initialNodeId: targetNodeId
        };
        setBlueprint(prev => ({ ...prev, npcs: [...prev.npcs, newNPC] }));
        setSelection({ type: 'npc', id });
    };

    const addObjective = () => {
        const id = `obj_${Math.floor(Math.random() * 900) + 100}`;
        const targetNodeId = (selection?.type === 'node' && selection.id) ? selection.id : blueprint.startNodeId;
        const newObj: MapBlueprintObjective = {
            id,
            title: 'New Objective',
            type: 'MAIN',
            nodeId: targetNodeId
        };
        setBlueprint(prev => ({ ...prev, objectives: [...prev.objectives, newObj] }));
        setSelection({ type: 'objective', id });
    };

    const handleDeleteSelection = () => {
        if (!selection) return;

        if (selection.type === 'node') {
            setBlueprint(prev => ({
                ...prev,
                nodes: prev.nodes.filter(n => n.id !== selection.id),
                edges: prev.edges.filter(e => e.from !== selection.id && e.to !== selection.id),
                npcs: prev.npcs.filter(n => n.initialNodeId !== selection.id),
                objectives: prev.objectives.filter(o => o.nodeId !== selection.id)
            }));
        } else if (selection.type === 'edge') {
            const [from, to] = selection.id.split('-');
            setBlueprint(prev => ({
                ...prev,
                edges: prev.edges.filter(e => !(e.from === from && e.to === to))
            }));
        } else if (selection.type === 'npc') {
            setBlueprint(prev => ({ ...prev, npcs: prev.npcs.filter(n => n.id !== selection.id) }));
        } else if (selection.type === 'objective') {
            setBlueprint(prev => ({ ...prev, objectives: prev.objectives.filter(o => o.id !== selection.id) }));
        }
        setSelection(null);
    };

    return (
        <div className="w-full h-full flex flex-col bg-[var(--scp-bg)] text-[var(--scp-text)] overflow-hidden relative font-mono">
            {/* Custom Modal Overlay */}
            {modal && modal.isOpen && (
                <div className={modalOverlay}>
                    <div className={modalPanel}>
                        <div className={modalHeader}>
                            <span>{modal.title}</span>
                            <button onClick={closeModal} className="hover:text-white">×</button>
                        </div>
                        <div className={modalBody}>
                            {modal.content}
                        </div>
                        <div className={modalFooter}>
                            <button onClick={closeModal} className={toolbarButtonGhost}>
                                {t('editor.btn_close')}
                            </button>
                            {modal.onConfirm && (
                                <button onClick={modal.onConfirm} className={toolbarButtonBase}>
                                    {modal.title === t('editor.delete_confirm_title') ? t('common.delete') : (modal.title === t('editor.import') ? t('editor.btn_import') : t('editor.btn_copy'))}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <ConfirmationModal 
                isOpen={showNewMapConfirm}
                onCancel={() => setShowNewMapConfirm(false)}
                onConfirm={() => {
                    setBlueprint(DEFAULT_BLUEPRINT);
                    setShowNewMapConfirm(false);
                }}
                title={t('editor.new_map_confirm_title')}
                message={t('editor.new_map_confirm_msg')}
                confirmText={t('common.confirm')}
            />

            {/* Toolbar */}
            <div className="h-12 border-b border-[var(--scp-border)] flex items-center justify-between px-4 bg-[var(--scp-surface)] shrink-0 z-10 shadow-md scp-ui crt">
                <div className="flex items-center gap-4">
                    <button onClick={handleBack} className={toolbarButtonBase}>
                        <span>←</span> {t('common.back')}
                    </button>
                    <div className={toolbarGroupDivider}></div>
                    <span className="text-scp-text-dim font-bold font-mono text-xs tracking-wider">{t('editor.title')}</span>
                    
                    {/* Undo/Redo Controls */}
                    <div className="flex items-center gap-1 ml-4 pl-4 border-l border-[var(--scp-border)]">
                        <button 
                            onClick={undo} 
                            disabled={!canUndo}
                            className={toolbarHistoryButton(canUndo)}
                            title="Undo (Ctrl+Z)"
                        >
                            <span className="text-lg leading-none">↺</span> {t('common.undo')}
                        </button>
                        <button 
                            onClick={redo} 
                            disabled={!canRedo}
                            className={toolbarHistoryButton(canRedo)}
                            title="Redo (Ctrl+Shift+Z)"
                        >
                            <span className="text-lg leading-none">↻</span> {t('common.redo')}
                        </button>
                    </div>
                    
                    {/* Add Entity Buttons */}
                    <div className="flex items-center gap-2 ml-4">
                        <button 
                            onClick={addNPC}
                            className={addEntityButtonNpc}
                            title={t('editor.add_npc')}
                        >
                            + NPC
                        </button>
                         <button 
                            onClick={addObjective}
                            className={addEntityButtonObj}
                            title={t('editor.add_objective')}
                        >
                            + OBJ
                        </button>
                    </div>
                    
                    {/* Zoom Controls */}
                    <div className="flex items-center gap-1 ml-4 pl-4 border-l border-[var(--scp-border)]">
                        <button 
                            onClick={() => canvasRef.current?.zoomOut()}
                            className={toolbarIconButton}
                            title={t('editor.zoom')}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="11" cy="11" r="8"></circle>
                                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                <line x1="8" y1="11" x2="14" y2="11"></line>
                            </svg>
                        </button>
                        <button 
                            onClick={() => canvasRef.current?.zoomIn()}
                            className={toolbarIconButton}
                            title={t('editor.zoom')}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="11" cy="11" r="8"></circle>
                                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                <line x1="11" y1="8" x2="11" y2="14"></line>
                                <line x1="8" y1="11" x2="14" y2="11"></line>
                            </svg>
                        </button>
                    </div>
                </div>
                <div className="flex gap-2 pr-32">
                    <button onClick={() => setShowNewMapConfirm(true)} className={toolbarButtonGhost}>{t('editor.new_map')}</button>
                    <button onClick={() => showImportModal()} className={toolbarButtonGhost}>{t('editor.import')}</button>
                    <button onClick={() => showExportModal()} className={toolbarButtonGhost}>{t('editor.export')}</button>
                    <button onClick={handleTestRun} className="scp-btn-action px-4 py-1 text-xs font-bold text-scp-white hover:text-scp-alert border-scp-gray/30 hover:border-scp-alert/60">
                        ▶ {t('editor.test_run')}
                    </button>
                </div>
            </div>

            {/* Main Area */}
            <div className="flex-1 relative overflow-hidden">
                <div className="absolute inset-0 bg-[#050505] scp-ui crt pl-56 pr-80 box-border">
                    <div className="absolute inset-0 bg-grid-pattern opacity-10 pointer-events-none"></div>
                    <div className="relative w-full h-full">
                        <EditorCanvas 
                            ref={canvasRef}
                            blueprint={blueprint} 
                            selection={selection} 
                            setSelection={setSelection} 
                            updateNode={updateNode}
                            addNode={addNode}
                            addEdge={addEdge}
                            onDeleteSelection={handleDeleteSelection}
                        />
                    </div>
                </div>

                <SidePanel side="left" className={`top-12 bottom-0 w-56 ${panelContainerBase}`}>
                    <div className={editorPanelHeader}>
                        <div className={editorPanelTitle}>
                            {t('editor.entity_list')}
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto min-h-0 custom-scrollbar p-3 space-y-4">
                        {/* NPCs Section */}
                        <div>
                            <div className="text-[10px] text-scp-text-dim uppercase font-bold mb-2 px-1 tracking-wider">
                                {t('editor.npcs')} ({blueprint.npcs.length})
                            </div>
                            <div className="space-y-1">
                                {blueprint.npcs.map(npc => (
                                    <div 
                                        key={npc.id}
                                        onClick={() => setSelection({ type: 'npc', id: npc.id })}
                                        className={`${listItemBase} ${selection?.type === 'npc' && selection.id === npc.id ? listItemNpcActive : listItemInactive}`}
                                    >
                                        <div className="font-bold truncate">{npc.name}</div>
                                        <div className="text-[10px] opacity-60 truncate">{npc.archetype}</div>
                                    </div>
                                ))}
                                {blueprint.npcs.length === 0 && <div className="p-2 text-[10px] text-gray-600 italic text-center border border-dashed border-gray-800 rounded">No Entities</div>}
                            </div>
                        </div>

                        {/* Objectives Section */}
                        <div>
                            <div className="text-[10px] text-scp-text-dim uppercase font-bold mb-2 px-1 tracking-wider border-t border-[var(--scp-border)] pt-4">
                                {t('editor.objectives')} ({blueprint.objectives.length})
                            </div>
                            <div className="space-y-1">
                                {blueprint.objectives.map(obj => (
                                    <div 
                                        key={obj.id}
                                        onClick={() => setSelection({ type: 'objective', id: obj.id })}
                                        className={`${listItemBase} ${selection?.type === 'objective' && selection.id === obj.id ? listItemObjectiveActive : listItemInactive}`}
                                    >
                                        <div className="font-bold truncate">{obj.title}</div>
                                        <div className="text-[10px] opacity-60 truncate">{obj.type}</div>
                                    </div>
                                ))}
                                {blueprint.objectives.length === 0 && <div className="p-2 text-[10px] text-gray-600 italic text-center border border-dashed border-gray-800 rounded">No Objectives</div>}
                            </div>
                        </div>
                    </div>
                </SidePanel>

                <SidePanel side="right" className={`top-12 bottom-0 w-80 ${panelContainerBase}`}>
                    <div className={editorPanelHeader}>
                        <div className={editorPanelTitle}>
                            {t('editor.properties')}
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        <PropertyInspector 
                            blueprint={blueprint}
                            selection={selection}
                            setSelection={setSelection}
                            updateNode={updateNode}
                            updateEdge={updateEdge}
                            updateNPC={updateNPC}
                            updateObjective={updateObjective}
                            setBlueprint={setBlueprint}
                        />
                    </div>
                </SidePanel>
            </div>
        </div>
    );
};

export default MapEditor;
