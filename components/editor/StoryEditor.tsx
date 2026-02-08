import React, { useState, useEffect, useRef } from 'react';
import { MapBlueprint, MapBlueprintNode, MapBlueprintEdge, MapBlueprintNPC, MapBlueprintObjective, GameState, GameStatus, StoryDraft, SCPData } from '../../types';
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
import { loadEditingSCPData, saveEditingSCPData, loadGlobalSettings } from '../../services/indexedDBService';
import { getEditingStoryCache, setEditingStoryCache } from '../../services/storyEditorCache';
import { applyLayoutToBlueprint } from '../../utils/mapLayout';
import { useHistory } from '../../hooks/useHistory';
import { generateImage, initializeGameChatStream, extractStability, extractVisualPrompt } from '../../services/aiService';
import SaveLoadModal from '../SaveLoadModal';

interface StoryEditorProps {
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

const StoryEditor: React.FC<StoryEditorProps> = ({ gameState, setGameState }) => {
    const { t, language } = useTranslation();
    const { state: blueprintState, setState: setBlueprint, undo, redo, canUndo, canRedo } = useHistory<MapBlueprint>(DEFAULT_BLUEPRINT);
    
    const blueprint = blueprintState || DEFAULT_BLUEPRINT;

    const [selection, setSelection] = useState<{ type: 'node' | 'edge' | 'npc' | 'objective', id: string } | null>(null);
    const [modal, setModal] = useState<{ isOpen: boolean; title: string; content: React.ReactNode; onConfirm?: () => void } | null>(null);
    const [showNewMapConfirm, setShowNewMapConfirm] = useState(false);
    const hasLoadedRef = useRef(false);
    const canvasRef = useRef<EditorCanvasRef>(null);

    // Story Editor Specific State
    const [activeTab, setActiveTab] = useState<'MAP' | 'STORY'>('STORY');
    const [scpData, setScpData] = useState<SCPData>({
        designation: '',
        name: '',
        containmentClass: 'Unknown',
        description: null,
        storyDraft: {},
        mapBlueprint: DEFAULT_BLUEPRINT
    });

    const [generatingState, setGeneratingState] = useState<{ bg: boolean; entity: boolean }>({ bg: false, entity: false });
    const [isStarting, setIsStarting] = useState(false);
    const [saveLoadModalOpen, setSaveLoadModalOpen] = useState(false);
    const [pendingGameState, setPendingGameState] = useState<GameState | null>(null);

    const [bgImagePrompt, setBgImagePrompt] = useState('');
    const [entityImagePrompt, setEntityImagePrompt] = useState('');
    const [lightboxImage, setLightboxImage] = useState<string | null>(null);

    useEffect(() => {
        if (hasLoadedRef.current) return;
        hasLoadedRef.current = true;
        const loadInitial = async () => {
            let loadedData: SCPData | null = null;

            // 1. Try Memory Cache
            const memoryCached = getEditingStoryCache();
            if (memoryCached) {
                loadedData = memoryCached;
            } else {
                // 2. Try IndexedDB
                loadedData = await loadEditingSCPData();
            }

            if (loadedData) {
                setBlueprint(loadedData.mapBlueprint || DEFAULT_BLUEPRINT);
                setScpData(loadedData);
            } else if (gameState.scpData) {
                // 3. Fallback to GameState (Tactical Preview)
                setBlueprint(gameState.scpData.mapBlueprint || DEFAULT_BLUEPRINT);
                
                const initialStoryDraft = gameState.scpData.storyDraft || {
                    roleDetails: gameState.role !== 'CUSTOM' ? gameState.role : '',
                    storyBackground: gameState.scpData.description || '',
                    backgroundImage: gameState.backgroundImage || undefined,
                    entityImage: gameState.mainImage || undefined
                };

                setScpData({
                    ...gameState.scpData,
                    storyDraft: initialStoryDraft,
                    role: gameState.scpData.role || gameState.role || 'CUSTOM'
                });
            }

            const sourceData = loadedData || gameState.scpData;
            
            setBgImagePrompt(sourceData?.visualDescription ? 
                `Atmospheric, cinematic lighting, abstract horror background representing ${sourceData.visualDescription}, subtle, texture, scp foundation style, dark moody` : 
                `Atmospheric, cinematic lighting, abstract horror background representing SCP Foundation, subtle, texture, scp foundation style, dark moody`);
            
            setEntityImagePrompt(sourceData?.entityDescription ? 
                `Close up full body shot of ${sourceData.name}. ${sourceData.entityDescription}. detailed, photorealistic, containment cell, scp foundation record photo` : 
                `Close up full body shot of entity. SCP entity, detailed, photorealistic, containment cell, scp foundation record photo`);
        };
        loadInitial();
    }, [gameState.scpData, setBlueprint, gameState.role, gameState.backgroundImage, gameState.mainImage]);

    useEffect(() => {
        const currentData: SCPData = {
            ...scpData,
            mapBlueprint: blueprint
        };
        setEditingStoryCache(currentData);
    }, [blueprint, scpData]);

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
                        setScpData(prev => ({
                            ...prev,
                            storyDraft: json.storyDraft || prev.storyDraft,
                            designation: json.designation || prev.designation,
                            name: json.name || prev.name
                        }));
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
        const exportData = {
            ...blueprint,
            storyDraft: scpData.storyDraft,
            designation: scpData.designation,
            name: scpData.name
        };
        const json = JSON.stringify(exportData, null, 2);
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
        const fullData: SCPData = {
            ...scpData,
            mapBlueprint: blueprint
        };
        
        await saveEditingSCPData(fullData);
        
        // Logic: If we have scpData (Tactical Preview mode), return to Tactical Preview
        // If we are in "Create New" mode (IDLE -> MAP_EDITOR), return to IDLE
        
        if (gameState.scpData && gameState.status === GameStatus.MAP_EDITOR) {
             setGameState(prev => ({
                ...prev,
                status: GameStatus.TACTICAL_PREVIEW,
                scpData: fullData,
                role: scpData.role
            }));
        } else {
            setGameState(prev => ({ ...prev, status: GameStatus.IDLE }));
        }
    };

    const handleSaveAndPlay = async () => {
        setIsStarting(true);
        try {
            const fullData: SCPData = {
                ...scpData,
                mapBlueprint: blueprint
            };
            setEditingStoryCache(fullData);
            await saveEditingSCPData(fullData);

            const settings = await loadGlobalSettings();
            const difficulty = settings.difficulty || 'normal';
            
            const finalScpData: SCPData = {
                ...scpData,
                mapBlueprint: blueprint,
                designation: scpData.designation || 'CUSTOM-SCENARIO',
                name: scpData.name || 'Custom Story',
                description: scpData.description || scpData.storyDraft?.storyBackground || 'Custom Scenario'
            };

            const stream = initializeGameChatStream(finalScpData, scpData.role || gameState.role || 'CUSTOM', language, gameState.legacy, difficulty);
            
            let fullText = "";
            for await (const chunk of stream) {
                fullText += chunk;
            }
            
            const stabilityResult = extractStability(fullText);
            const introStability = stabilityResult.newStability ?? 100;
            const { cleanText } = extractVisualPrompt(stabilityResult.cleanText);
            
            const newGameState: GameState = {
                ...gameState,
                status: GameStatus.PLAYING,
                scpData: finalScpData,
                role: scpData.role || gameState.role,
                stability: introStability,
                turnCount: 1,
                map: {
                    id: blueprint.id,
                    title: blueprint.title,
                    currentNodeId: blueprint.startNodeId,
                    discoveredNodeIds: [blueprint.startNodeId]
                },
                npcs: blueprint.npcs.map(n => ({
                    id: n.id,
                    name: n.name,
                    archetype: n.archetype,
                    nodeId: n.initialNodeId,
                    alive: true,
                    secretTags: n.secretTags,
                    dialogueGoals: n.dialogueGoals
                })),
                objectives: blueprint.objectives.map(o => ({
                    id: o.id,
                    title: o.title,
                    type: o.type,
                    nodeId: o.nodeId,
                    status: 'ACTIVE',
                    progress: 0,
                    detail: o.detail,
                    reward: o.reward
                })),
                inventory: [],
                messages: [{
                    id: 'msg_intro',
                    sender: 'narrator',
                    content: cleanText,
                    timestamp: Date.now(),
                    stabilitySnapshot: introStability,
                    imageUrl: scpData.storyDraft?.backgroundImage
                }],
                backgroundImage: scpData.storyDraft?.backgroundImage || gameState.backgroundImage,
                mainImage: scpData.storyDraft?.entityImage || gameState.mainImage
            };
            
            setPendingGameState(newGameState);
            setSaveLoadModalOpen(true);

        } catch (e) {
            console.error(e);
            alert(t('start.error_conn'));
        } finally {
            setIsStarting(false);
        }
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

    const handleImageUpload = (type: 'bg' | 'entity', e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setScpData(prev => ({
                    ...prev,
                    storyDraft: {
                        ...(prev.storyDraft || {}),
                        [type === 'bg' ? 'backgroundImage' : 'entityImage']: reader.result as string
                    }
                }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleGenerateImage = async (type: 'bg' | 'entity') => {
        setGeneratingState(prev => ({ ...prev, [type]: true }));
        try {
            const prompt = type === 'bg' ? bgImagePrompt : entityImagePrompt;
            
            const url = await generateImage(prompt, type === 'bg' ? "16:9" : "1:1");
            if (url) {
                setScpData(prev => ({
                    ...prev,
                    storyDraft: {
                        ...(prev.storyDraft || {}),
                        [type === 'bg' ? 'backgroundImage' : 'entityImage']: url
                    }
                }));
            }
        } catch (e) {
            alert("Image generation failed");
        } finally {
            setGeneratingState(prev => ({ ...prev, [type]: false }));
        }
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

            {/* Lightbox Modal */}
            {lightboxImage && (
                <div 
                    className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/95 backdrop-blur-sm cursor-zoom-out p-4"
                    onClick={() => setLightboxImage(null)}
                >
                    <img 
                        src={lightboxImage} 
                        alt="Zoomed" 
                        className="max-w-full max-h-full object-contain shadow-2xl border border-scp-border"
                    />
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

            <SaveLoadModal
                isOpen={saveLoadModalOpen}
                onClose={() => setSaveLoadModalOpen(false)}
                mode="save"
                currentGameState={pendingGameState!}
                onSaveComplete={() => {
                    setGameState(pendingGameState!);
                    setSaveLoadModalOpen(false);
                }}
                onLoadGame={() => {}}
            />

            {/* Toolbar */}
            <div className="h-12 border-b border-[var(--scp-border)] flex items-center justify-between px-4 bg-[var(--scp-surface)] shrink-0 z-10 shadow-md scp-ui crt">
                <div className="flex items-center gap-4">
                    <button onClick={handleBack} className={toolbarButtonBase}>
                        <span>←</span> {t('common.back')}
                    </button>
                    <div className={toolbarGroupDivider}></div>
                    <span className="text-scp-text-dim font-bold font-mono text-xs tracking-wider">{t('story_editor.title')}</span>
                    
                    {/* Tab Switcher */}
                    <div className="flex items-center gap-2 ml-4 bg-black/30 p-1 rounded">
                        <button 
                            onClick={() => setActiveTab('STORY')}
                            className={`px-3 py-1 text-xs font-bold transition-colors ${activeTab === 'STORY' ? 'bg-scp-accent text-white' : 'text-gray-400 hover:text-white'}`}
                        >
                            {t('story_editor.tab_story')}
                        </button>
                        <button 
                            onClick={() => setActiveTab('MAP')}
                            className={`px-3 py-1 text-xs font-bold transition-colors ${activeTab === 'MAP' ? 'bg-scp-accent text-white' : 'text-gray-400 hover:text-white'}`}
                        >
                            {t('story_editor.tab_map')}
                        </button>
                    </div>

                    {activeTab === 'MAP' && (
                        <>
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
                        </>
                    )}
                </div>
                <div className="flex gap-2 pr-32">
                    <button onClick={() => setShowNewMapConfirm(true)} className={toolbarButtonGhost}>{t('editor.new_map')}</button>
                    <button onClick={() => showImportModal()} className={toolbarButtonGhost}>{t('editor.import')}</button>
                    <button onClick={() => showExportModal()} className={toolbarButtonGhost}>{t('editor.export')}</button>
                    
                    {/* Mode B: Direct Entry -> Save & Play */}
                    {(!gameState.scpData || gameState.scpData.designation === 'CUSTOM-SCENARIO') && (
                        <button 
                            onClick={handleSaveAndPlay}
                            disabled={isStarting}
                            className="scp-btn-action px-4 py-1 text-xs font-bold text-scp-white hover:text-scp-alert border-scp-gray/30 hover:border-scp-alert/60 flex items-center gap-2 min-w-[140px] justify-center"
                        >
                            {isStarting ? (
                                <div className="w-4 h-4 border-2 border-white/20 border-t-scp-accent rounded-full animate-spin"></div>
                            ) : (
                                <span>▶ {t('story_editor.btn_save_and_play')}</span>
                            )}
                        </button>
                    )}
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
                            <div className="text-[12px] text-scp-text-dim uppercase font-bold mb-2 px-1 tracking-wider">
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
                                        <div className="text-[12px] opacity-60 truncate">{npc.archetype}</div>
                                    </div>
                                ))}
                                {blueprint.npcs.length === 0 && <div className="p-2 text-[12px] text-gray-600 italic text-center border border-dashed border-gray-800 rounded">No Entities</div>}
                            </div>
                        </div>

                        {/* Objectives Section */}
                        <div>
                            <div className="text-[12px] text-scp-text-dim uppercase font-bold mb-2 px-1 tracking-wider border-t border-[var(--scp-border)] pt-4">
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
                                        <div className="text-[12px] opacity-60 truncate">{obj.type}</div>
                                    </div>
                                ))}
                                {blueprint.objectives.length === 0 && <div className="p-2 text-[12px] text-gray-600 italic text-center border border-dashed border-gray-800 rounded">No Objectives</div>}
                            </div>
                        </div>
                    </div>
                </SidePanel>

                <SidePanel side="right" className={`top-12 bottom-0 w-80 ${panelContainerBase}`}>
                    <div className={editorPanelHeader}>
                        <div className={editorPanelTitle}>
                            {activeTab === 'MAP' ? t('editor.properties') : t('story_editor.title')}
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {activeTab === 'MAP' ? (
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
                        ) : (
                            <div className="p-4 space-y-6">
                                {/* Designation, Class, Role, Name */}
                                <div className="grid grid-cols-1 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[12px] text-scp-text-dim font-bold uppercase block">{t('story_editor.designation')}</label>
                                        <input 
                                            type="text"
                                            value={scpData.designation}
                                            onChange={e => setScpData({...scpData, designation: e.target.value})}
                                            className="w-full bg-black/50 border border-gray-700 p-1 text-xs text-scp-text focus:border-scp-accent focus:outline-none"
                                            placeholder="SCP-XXX"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[12px] text-scp-text-dim font-bold uppercase block">{t('story_editor.containment_class')}</label>
                                        <input 
                                            type="text"
                                            value={scpData.containmentClass || ''}
                                            onChange={e => setScpData({...scpData, containmentClass: e.target.value})}
                                            className="w-full bg-black/50 border border-gray-700 p-1 text-xs text-scp-text focus:border-scp-accent focus:outline-none"
                                            placeholder="Euclid"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[12px] text-scp-text-dim font-bold uppercase block">{t('story_editor.player_role')}</label>
                                        <input 
                                            type="text"
                                            value={scpData.role || ''}
                                            onChange={e => setScpData({...scpData, role: e.target.value})}
                                            className="w-full bg-black/50 border border-gray-700 p-1 text-xs text-scp-text focus:border-scp-accent focus:outline-none"
                                            placeholder="Researcher"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[12px] text-scp-text-dim font-bold uppercase block">{t('story_editor.name')}</label>
                                        <input 
                                            type="text"
                                            value={scpData.name}
                                            onChange={e => setScpData({...scpData, name: e.target.value})}
                                            className="w-full bg-black/50 border border-gray-700 p-1 text-xs text-scp-text focus:border-scp-accent focus:outline-none"
                                            placeholder="The ..."
                                        />
                                    </div>
                                </div>

                                {/* Story Draft Form */}
                                <div className="space-y-3">
                                    <label className="text-xs text-scp-text-dim font-bold uppercase block">{t('story_editor.role_details')}</label>
                                    <textarea 
                                        value={scpData.storyDraft?.roleDetails || ''}
                                        onChange={e => setScpData({...scpData, storyDraft: {...scpData.storyDraft, roleDetails: e.target.value}})}
                                        className="w-full h-20 bg-black/50 border border-gray-700 p-2 text-xs text-scp-text focus:border-scp-accent focus:outline-none"
                                        placeholder={t('story_editor.placeholder_role')}
                                    />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-xs text-scp-text-dim font-bold uppercase block">{t('story_editor.story_background')}</label>
                                    <textarea 
                                        value={scpData.storyDraft?.storyBackground || ''}
                                        onChange={e => setScpData({...scpData, storyDraft: {...scpData.storyDraft, storyBackground: e.target.value}})}
                                        className="w-full h-24 bg-black/50 border border-gray-700 p-2 text-xs text-scp-text focus:border-scp-accent focus:outline-none"
                                        placeholder={t('story_editor.placeholder_background')}
                                    />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-xs text-scp-text-dim font-bold uppercase block">{t('story_editor.narrative_constraints')}</label>
                                    <textarea 
                                        value={scpData.storyDraft?.narrativeConstraints || ''}
                                        onChange={e => setScpData({...scpData, storyDraft: {...scpData.storyDraft, narrativeConstraints: e.target.value}})}
                                        className="w-full h-16 bg-black/50 border border-gray-700 p-2 text-xs text-scp-text focus:border-scp-accent focus:outline-none"
                                        placeholder={t('story_editor.placeholder_constraints')}
                                    />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-xs text-scp-text-dim font-bold uppercase block">{t('story_editor.opening_prompt')}</label>
                                    <textarea 
                                        value={scpData.storyDraft?.openingPrompt || ''}
                                        onChange={e => setScpData({...scpData, storyDraft: {...scpData.storyDraft, openingPrompt: e.target.value}})}
                                        className="w-full h-20 bg-black/50 border border-gray-700 p-2 text-xs text-scp-text focus:border-scp-accent focus:outline-none"
                                        placeholder={t('story_editor.placeholder_opening')}
                                    />
                                </div>
                                
                                <div className="border-t border-gray-800 pt-4 space-y-4">
                                    <label className="text-xs text-scp-text-dim font-bold uppercase block">{t('story_editor.images')}</label>
                                    
                                    {/* Background Image */}
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center">
                                            <span className="text-[12px] text-gray-500">{t('story_editor.bg_image')}</span>
                                        </div>
                                        <textarea 
                                            value={bgImagePrompt}
                                            onChange={e => setBgImagePrompt(e.target.value)}
                                            className="w-full h-16 bg-black/50 border border-gray-700 p-2 text-[12px] text-scp-text focus:border-scp-accent focus:outline-none mb-1"
                                            placeholder="Prompt..."
                                        />
                                        <div className="flex gap-1 justify-end">
                                            <button 
                                                onClick={() => handleGenerateImage('bg')} 
                                                disabled={generatingState.bg || generatingState.entity}
                                                className="text-[12px] px-2 py-1 bg-scp-accent/20 border border-scp-accent/50 text-scp-accent hover:bg-scp-accent/40 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {t('story_editor.btn_generate')}
                                            </button>
                                            <label className="text-[12px] px-2 py-1 bg-gray-800 border border-gray-600 text-gray-300 hover:bg-gray-700 cursor-pointer">
                                                {t('story_editor.btn_upload')}
                                                <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload('bg', e)} />
                                            </label>
                                        </div>
                                        <div 
                                            className="w-full aspect-video bg-black/50 border border-gray-800 relative flex items-center justify-center overflow-hidden group cursor-pointer"
                                            onClick={() => scpData.storyDraft?.backgroundImage && setLightboxImage(scpData.storyDraft.backgroundImage)}
                                        >
                                            {generatingState.bg && (
                                                <div className="absolute inset-0 bg-black/80 flex flex-col gap-2 items-center justify-center z-10 cursor-default" onClick={(e) => e.stopPropagation()}>
                                                    <div className="w-8 h-8 border-2 border-scp-accent border-t-transparent rounded-full animate-spin"></div>
                                                    <span className="text-[12px] text-scp-accent animate-pulse">GENERATING...</span>
                                                </div>
                                            )}
                                            {scpData.storyDraft?.backgroundImage ? (
                                                <img src={scpData.storyDraft.backgroundImage} alt="Background" className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" />
                                            ) : (
                                                <span className="text-gray-700 text-xs">No Image</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Entity Image */}
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center">
                                            <span className="text-[12px] text-gray-500">{t('story_editor.entity_image')}</span>
                                        </div>
                                        <textarea 
                                            value={entityImagePrompt}
                                            onChange={e => setEntityImagePrompt(e.target.value)}
                                            className="w-full h-16 bg-black/50 border border-gray-700 p-2 text-[12px] text-scp-text focus:border-scp-accent focus:outline-none mb-1"
                                            placeholder="Prompt..."
                                        />
                                        <div className="flex gap-1 justify-end">
                                            <button 
                                                onClick={() => handleGenerateImage('entity')}
                                                disabled={generatingState.bg || generatingState.entity}
                                                className="text-[12px] px-2 py-1 bg-scp-accent/20 border border-scp-accent/50 text-scp-accent hover:bg-scp-accent/40 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {t('story_editor.btn_generate')}
                                            </button>
                                            <label className="text-[12px] px-2 py-1 bg-gray-800 border border-gray-600 text-gray-300 hover:bg-gray-700 cursor-pointer">
                                                {t('story_editor.btn_upload')}
                                                <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload('entity', e)} />
                                            </label>
                                        </div>
                                        <div 
                                            className="w-full aspect-square bg-black/50 border border-gray-800 relative flex items-center justify-center overflow-hidden group cursor-pointer"
                                            onClick={() => scpData.storyDraft?.entityImage && setLightboxImage(scpData.storyDraft.entityImage)}
                                        >
                                            {generatingState.entity && (
                                                <div className="absolute inset-0 bg-black/80 flex flex-col gap-2 items-center justify-center z-10 cursor-default" onClick={(e) => e.stopPropagation()}>
                                                    <div className="w-8 h-8 border-2 border-scp-accent border-t-transparent rounded-full animate-spin"></div>
                                                    <span className="text-[12px] text-scp-accent animate-pulse">GENERATING...</span>
                                                </div>
                                            )}
                                            {scpData.storyDraft?.entityImage ? (
                                                <img src={scpData.storyDraft.entityImage} alt="Entity" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                                            ) : (
                                                <span className="text-gray-700 text-xs">No Image</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </SidePanel>
            </div>
        </div>
    );
};

export default StoryEditor;
