import React, { useState, useEffect, useRef } from 'react';
import { MapBlueprint, MapBlueprintNode, MapBlueprintEdge, MapBlueprintNPC, MapBlueprintObjective, GameState, GameStatus } from '../../types';
import { useTranslation } from '../../utils/i18n';
import EditorCanvas from './EditorCanvas';
import PropertyInspector from './PropertyInspector';
import ConfirmationModal from '../ConfirmationModal';
import { loadEditingBlueprint, saveEditingBlueprint } from '../../services/indexedDBService';
import { getEditingBlueprintCache, setEditingBlueprintCache, clearEditingBlueprintCache } from '../../services/blueprintCache';
import { applyLayoutToBlueprint } from '../../utils/mapLayout';

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

import { useHistory } from '../../hooks/useHistory';

const MapEditor: React.FC<MapEditorProps> = ({ gameState, setGameState }) => {
    const { t } = useTranslation();
    const { state: blueprintState, setState: setBlueprint, undo, redo, canUndo, canRedo } = useHistory<MapBlueprint>(DEFAULT_BLUEPRINT);
    
    // Safety check: ensure blueprint is never undefined
    const blueprint = blueprintState || DEFAULT_BLUEPRINT;

    const [selection, setSelection] = useState<{ type: 'node' | 'edge' | 'npc' | 'objective', id: string } | null>(null);
    const [modal, setModal] = useState<{ isOpen: boolean; title: string; content: React.ReactNode; onConfirm?: () => void } | null>(null);
    const [showNewMapConfirm, setShowNewMapConfirm] = useState(false);
    const hasLoadedRef = useRef(false);

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

    // Keyboard Shortcuts for Undo/Redo
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if focus is in an input or textarea
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
                        className="w-full h-40 bg-black/50 border border-scp-term/50 text-xs font-mono p-2 text-scp-text focus:outline-none focus:border-scp-term"
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
                        alert(t('editor.validation_error')); // Fallback or better error handling
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
                        className="w-full h-40 bg-black/50 border border-scp-term/50 text-xs font-mono p-2 text-scp-text focus:outline-none focus:border-scp-term select-all"
                    />
                </div>
            ),
            onConfirm: () => {
                navigator.clipboard.writeText(json);
                // Optional: show toast
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

    const handleImport = () => {
        showImportModal();
    };

    const handleExport = () => {
        showExportModal();
    };

    const handleTestRun = () => {
        // Inject the blueprint into a mock game state
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
            // Check if ID is being updated
            if (updates.id && updates.id !== id) {
                const newId = updates.id;
                // Update selection if necessary
                if (selection?.type === 'node' && selection.id === id) {
                    setSelection(s => s ? { ...s, id: newId } : null);
                }
                return {
                    ...prev,
                    nodes: prev.nodes.map(n => n.id === id ? { ...n, ...updates } : n),
                    // Update all references to this node
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
        // Check if edge already exists
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
        // Determine target node: selected node or start node
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
        // Determine target node: selected node or start node
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
                edges: prev.edges.filter(e => e.from !== selection.id && e.to !== selection.id)
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
        <div className="w-full h-full flex flex-col bg-[#0a0a0a] text-scp-text overflow-hidden relative">
            {/* Custom Modal Overlay */}
            {modal && modal.isOpen && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
                    <div className="bg-scp-dark border border-scp-term p-4 w-3/4 max-w-2xl shadow-[0_0_30px_rgba(51,255,0,0.2)]">
                        <div className="flex justify-between items-center mb-4 border-b border-scp-term/30 pb-2">
                            <h3 className="text-scp-term font-bold font-mono text-lg">{modal.title}</h3>
                            <button onClick={closeModal} className="text-scp-text hover:text-scp-term">×</button>
                        </div>
                        <div className="mb-6">
                            {modal.content}
                        </div>
                        <div className="flex justify-end gap-4">
                            <button onClick={closeModal} className="px-4 py-2 border border-scp-gray text-gray-400 hover:text-white font-mono text-sm">
                                {t('editor.btn_close')}
                            </button>
                            {modal.onConfirm && (
                                <button onClick={modal.onConfirm} className="px-4 py-2 bg-scp-term/20 border border-scp-term text-scp-term hover:bg-scp-term/40 font-mono text-sm font-bold">
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
            <div className="h-12 border-b border-scp-term/30 flex items-center justify-between px-4 bg-scp-dark/90 backdrop-blur shrink-0 z-10">
                <div className="flex items-center gap-4">
                    <button onClick={handleBack} className="text-scp-text hover:text-scp-term font-mono text-sm flex items-center gap-1">
                        <span>&lt;</span> {t('common.back')}
                    </button>
                    <span className="text-scp-term font-bold font-mono hidden sm:inline">{t('editor.title')}</span>
                    
                    {/* Undo/Redo Controls */}
                    <div className="flex items-center gap-1 ml-4 border-l border-scp-term/30 pl-4">
                        <button 
                            onClick={undo} 
                            disabled={!canUndo}
                            className={`px-2 py-1 text-xs font-mono border border-scp-gray/50 ${canUndo ? 'hover:border-scp-term hover:text-scp-term cursor-pointer' : 'opacity-30 cursor-not-allowed'}`}
                            title="Undo (Ctrl+Z)"
                        >
                            ← {t('common.undo') || 'Undo'}
                        </button>
                        <button 
                            onClick={redo} 
                            disabled={!canRedo}
                            className={`px-2 py-1 text-xs font-mono border border-scp-gray/50 ${canRedo ? 'hover:border-scp-term hover:text-scp-term cursor-pointer' : 'opacity-30 cursor-not-allowed'}`}
                            title="Redo (Ctrl+Shift+Z)"
                        >
                            {t('common.redo') || 'Redo'} →
                        </button>
                    </div>
                    
                    {/* Add Entity Buttons (Moved from floating list) */}
                    <div className="flex items-center gap-2 ml-4 border-l border-scp-term/30 pl-4">
                        <button 
                            onClick={addNPC}
                            className="px-2 py-1 text-xs font-mono border border-scp-amber/50 text-scp-amber hover:bg-scp-amber/10 hover:border-scp-amber"
                            title={t('editor.add_npc')}
                        >
                            + NPC
                        </button>
                         <button 
                            onClick={addObjective}
                            className="px-2 py-1 text-xs font-mono border border-scp-alert/50 text-scp-alert hover:bg-scp-alert/10 hover:border-scp-alert"
                            title={t('editor.add_objective')}
                        >
                            + OBJ
                        </button>
                    </div>
                </div>
                <div className="flex gap-2 mr-32">
                    <button onClick={() => setShowNewMapConfirm(true)} className="px-3 py-1 border border-scp-gray/50 hover:border-scp-term text-xs font-mono">{t('editor.new_map')}</button>
                    <button onClick={handleImport} className="px-3 py-1 border border-scp-gray/50 hover:border-scp-term text-xs font-mono">{t('editor.import')}</button>
                    <button onClick={handleExport} className="px-3 py-1 border border-scp-gray/50 hover:border-scp-term text-xs font-mono">{t('editor.export')}</button>
                    <button onClick={handleTestRun} className="px-3 py-1 bg-scp-term/20 border border-scp-term hover:bg-scp-term/40 text-xs font-mono font-bold text-scp-term">{t('editor.test_run')}</button>
                </div>
            </div>

            {/* Main Area */}
            <div className="flex-1 flex overflow-hidden">
                {/* Canvas */}
                <div className="flex-1 relative bg-black/50">
                    <EditorCanvas 
                        blueprint={blueprint} 
                        selection={selection} 
                        setSelection={setSelection} 
                        updateNode={updateNode}
                        addNode={addNode}
                        addEdge={addEdge}
                        onDeleteSelection={handleDeleteSelection}
                    />
                </div>

                {/* Entity List Panel */}
                <div className="w-48 border-l border-scp-term/30 bg-black/80 overflow-y-auto flex flex-col">
                    <div className="p-2 border-b border-scp-term/30 bg-scp-term/10 font-bold text-xs text-scp-term uppercase sticky top-0">
                        {t('editor.npcs')} ({blueprint.npcs.length})
                    </div>
                    <div className="flex-1 overflow-y-auto min-h-0">
                        {blueprint.npcs.map(npc => (
                            <div 
                                key={npc.id}
                                onClick={() => setSelection({ type: 'npc', id: npc.id })}
                                className={`p-2 text-xs border-b border-scp-gray/20 cursor-pointer hover:bg-scp-term/10 ${selection?.type === 'npc' && selection.id === npc.id ? 'bg-scp-term/20 border-l-2 border-l-scp-term' : ''}`}
                            >
                                <div className="font-mono text-scp-amber truncate">{npc.name}</div>
                                <div className="text-[10px] text-gray-500 truncate">{npc.id}</div>
                            </div>
                        ))}
                        {blueprint.npcs.length === 0 && <div className="p-4 text-xs text-gray-600 text-center italic">No NPCs</div>}
                    </div>

                    <div className="p-2 border-b border-scp-term/30 border-t border-t-scp-term/30 bg-scp-term/10 font-bold text-xs text-scp-term uppercase sticky top-0">
                        {t('editor.objectives')} ({blueprint.objectives.length})
                    </div>
                    <div className="flex-1 overflow-y-auto min-h-0">
                        {blueprint.objectives.map(obj => (
                            <div 
                                key={obj.id}
                                onClick={() => setSelection({ type: 'objective', id: obj.id })}
                                className={`p-2 text-xs border-b border-scp-gray/20 cursor-pointer hover:bg-scp-term/10 ${selection?.type === 'objective' && selection.id === obj.id ? 'bg-scp-term/20 border-l-2 border-l-scp-term' : ''}`}
                            >
                                <div className="font-mono text-scp-alert truncate">{obj.title}</div>
                                <div className="text-[10px] text-gray-500 truncate">{obj.type}</div>
                            </div>
                        ))}
                        {blueprint.objectives.length === 0 && <div className="p-4 text-xs text-gray-600 text-center italic">No Objectives</div>}
                    </div>
                </div>

                {/* Inspector */}
                <div className="w-80 border-l border-scp-term/30 bg-scp-dark/90 overflow-y-auto">
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
            </div>
        </div>
    );
};

export default MapEditor;
