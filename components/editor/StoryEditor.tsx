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
} from './editorStyles';
import { loadEditingSCPData, saveEditingSCPData } from '../../services/indexedDBService';
import { getEditingStoryCache, setEditingStoryCache } from '../../services/storyEditorCache';
import { applyLayoutToBlueprint } from '../../utils/mapLayout';
import { useHistory } from '../../hooks/useHistory';
import { generateImage } from '../../services/aiService';

interface StoryEditorProps {
    gameState: GameState;
    setGameState: React.Dispatch<React.SetStateAction<GameState>>;
}

const DEFAULT_BLUEPRINT: MapBlueprint = {
    id: 'scp_173_map',
    title: 'SCP-173 Containment Wing',
    startNodeId: 'node_control',
    nodes: [
        { id: 'node_control', name: 'Control Room', danger: 0, layout: { x: 100, y: 100 } },
        { id: 'node_airlock', name: 'Airlock', danger: 20, requires: ['access_code'], layout: { x: 220, y: 100 } },
        { id: 'node_containment', name: 'Containment Chamber', danger: 90, requires: ['key_card_4'], layout: { x: 340, y: 100 } },
        { id: 'node_hallway_a', name: 'Hallway A', danger: 10, layout: { x: 100, y: 200 } },
        { id: 'node_storage', name: 'Equipment Storage', danger: 5, layout: { x: 220, y: 200 } }
    ],
    edges: [
        { from: 'node_control', to: 'node_airlock', bidirectional: true },
        { from: 'node_airlock', to: 'node_containment', bidirectional: true },
        { from: 'node_control', to: 'node_hallway_a', bidirectional: true },
        { from: 'node_hallway_a', to: 'node_storage', bidirectional: true }
    ],
    npcs: [],
    objectives: [
        { id: 'obj_clean', title: 'Clean Containment', type: 'MAIN', nodeId: 'node_containment' }
     ]
 };

const SCP173_TEMPLATE: SCPData = {
    designation: 'SCP-173',
    name: 'The Sculpture',
    containmentClass: 'Euclid',
    role: 'Class D Personnel',
    entityDescription: 'Constructed from concrete and rebar with traces of Krylon brand spray paint. SCP-173 is animate and extremely hostile. The object cannot move while within a direct line of sight.',
    visualDescription: 'A sterile, dimly lit containment chamber with concrete walls. The floor is covered in a reddish-brown substance. Heavy steel doors seal the entrance.',
    storyDraft: {
        roleDetails: 'You are D-9341, a test subject assigned to SCP-173 for routine testing.',
        storyBackground: 'SCP-173 is a concrete sculpture that moves when not observed. It attacks by snapping the neck at the base of the skull.',
        narrativeConstraints: 'Maintain direct eye contact at all times. Alert others before blinking.',
        openingPrompt: 'The containment door slides open with a heavy grind. The air is stale and smells of blood and feces.'
    },
    mapBlueprint: DEFAULT_BLUEPRINT
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
        containmentClass: '',
        role: '',
        storyDraft: {},
        mapBlueprint: DEFAULT_BLUEPRINT
    });

    const [generatingState, setGeneratingState] = useState<{ bg: boolean; entity: boolean }>({ bg: false, entity: false });
    const [isStarting, setIsStarting] = useState(false);
    const [showValidationErrors, setShowValidationErrors] = useState(false);

    const [bgImagePrompt, setBgImagePrompt] = useState('');
    const [entityImagePrompt, setEntityImagePrompt] = useState('');
    const [lightboxImage, setLightboxImage] = useState<string | null>(null);

    const getBgPrompt = (data: SCPData) => {
        return data.visualDescription ? 
            `Atmospheric, cinematic lighting, abstract horror background representing ${data.visualDescription}, subtle, texture, scp foundation style, dark moody` : 
            `Atmospheric, cinematic lighting, abstract horror background representing SCP Foundation, subtle, texture, scp foundation style, dark moody`;
    };

    const getEntityPrompt = (data: SCPData) => {
        return data.entityDescription ? 
            `Close up full body shot of ${data.name}. ${data.entityDescription}. detailed, photorealistic, containment cell, scp foundation record photo` : 
            `Close up full body shot of entity. SCP entity, detailed, photorealistic, containment cell, scp foundation record photo`;
    };

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
                    storyBackground: '',
                    backgroundImage: gameState.backgroundImage || undefined,
                    entityImage: gameState.mainImage || undefined
                };

                setScpData({
                    ...gameState.scpData,
                    storyDraft: initialStoryDraft,
                    role: gameState.scpData.role || gameState.role || SCP173_TEMPLATE.role
                });
            } else {
                 // No data, initialize with template
                 setScpData(SCP173_TEMPLATE);
            }

            const sourceData = loadedData || gameState.scpData || SCP173_TEMPLATE;
            
            setBgImagePrompt(getBgPrompt(sourceData));
            setEntityImagePrompt(getEntityPrompt(sourceData));
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
            title: t('map_editor.import'),
            content: (
                <div className="space-y-4">
                    <p className="text-xs text-scp-text/70">{t('map_editor.msg_import')}</p>
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
                        alert(t('map_editor.validation_error')); 
                    }
                } catch (e) {
                    alert(t('map_editor.json_error'));
                }
            }
        });
    };

    const handleReset = () => {
        setModal({
            isOpen: true,
            title: t('map_editor.reset_title'),
            content: (
                <div className="space-y-4">
                    <p className="text-xs text-scp-text/70">{t('map_editor.reset_confirm_msg')}</p>
                </div>
            ),
            onConfirm: () => {
                setScpData(SCP173_TEMPLATE);
                setBlueprint(DEFAULT_BLUEPRINT);
                setBgImagePrompt(getBgPrompt(SCP173_TEMPLATE));
                setEntityImagePrompt(getEntityPrompt(SCP173_TEMPLATE));
                closeModal();
            }
        });
    };

    const showExportModal = () => {
        const exportData = {
            ...blueprint,
            storyDraft: {
                ...scpData.storyDraft,
                backgroundImage: undefined, // Exclude images to reduce size
                entityImage: undefined
            },
            designation: scpData.designation,
            name: scpData.name
        };
        const json = JSON.stringify(exportData, null, 2);
        setModal({
            isOpen: true,
            title: t('map_editor.export'),
            content: (
                <div className="space-y-4">
                    <p className="text-xs text-scp-text/70">{t('map_editor.msg_export')}</p>
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

    const validateInputs = () => {
        const isValid = !!(scpData.designation && scpData.name && scpData.role);
        if (!isValid) {
            setShowValidationErrors(true);
            if (activeTab !== 'STORY') {
                setActiveTab('STORY');
            }
        }
        return isValid;
    };

    const getInputClass = (value: string | undefined) => {
        const baseClass = "w-full bg-black/50 border p-1 text-xs text-scp-text focus:outline-none transition-colors";
        const borderClass = showValidationErrors && !value 
            ? "border-red-500 focus:border-red-500 placeholder-red-900/50" 
            : "border-gray-700 focus:border-scp-accent";
        return `${baseClass} ${borderClass}`;
    };

    const handleBack = async () => {
        if (!validateInputs()) {
            return;
        }

        const fullData: SCPData = {
            ...scpData,
            mapBlueprint: blueprint
        };
        
        await saveEditingSCPData(fullData);
        
        // Logic: If we have scpData (Tactical Preview mode), return to Tactical Preview
        // If we are in "Create New" mode (IDLE -> STORY_EDITOR), return to IDLE
        
        if (gameState.scpData && gameState.status === GameStatus.STORY_EDITOR) {
             setGameState(prev => ({
                ...prev,
                status: GameStatus.TACTICAL_PREVIEW,
                scpData: fullData,
                role: scpData.role,
                returnFromEditor: true
            }));
        } else {
            setGameState(prev => ({ ...prev, scpData: null, status: GameStatus.IDLE }));
        }
    };

    const handleSaveAndPlay = async () => {
        if (!validateInputs()) {
            return;
        }

        setIsStarting(true);
        try {
            const finalScpData: SCPData = {
                ...scpData,
                mapBlueprint: blueprint,
                designation: scpData.designation || SCP173_TEMPLATE.designation,
                name: scpData.name || SCP173_TEMPLATE.name
            };

            setEditingStoryCache(finalScpData);
            await saveEditingSCPData(finalScpData);

            setGameState(prev => ({
                ...prev,
                status: GameStatus.ANALYZING,
                scpData: finalScpData,
                role: scpData.role || prev.role || SCP173_TEMPLATE.role,
                backgroundImage: scpData.storyDraft?.backgroundImage || prev.backgroundImage,
                mainImage: scpData.storyDraft?.entityImage || prev.mainImage,
                messages: [],
                stability: 100,
                turnCount: 0,
                endingType: null,
                map: undefined,
                npcs: undefined,
                objectives: undefined,
                inventory: []
            }));

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

    const handleDeleteImage = (type: 'bg' | 'entity') => {
        setScpData(prev => ({
            ...prev,
            storyDraft: {
                ...(prev.storyDraft || {}),
                [type === 'bg' ? 'backgroundImage' : 'entityImage']: undefined
            }
        }));
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
                                {t('map_editor.btn_close')}
                            </button>
                            {modal.onConfirm && (
                                <button onClick={modal.onConfirm} className={toolbarButtonBase}>
                                    {modal.title === t('map_editor.delete_confirm_title') 
                                        ? t('common.delete') 
                                        : (modal.title === t('map_editor.import') 
                                            ? t('map_editor.btn_import') 
                                            : (modal.title === t('map_editor.reset_title') ? t('map_editor.btn_reset_confirm') : t('map_editor.btn_copy')))}
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
                title={t('map_editor.new_map_confirm_title')}
                message={t('map_editor.new_map_confirm_msg')}
                confirmText={t('common.confirm')}
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
                            <div className="flex items-center gap-1 ml-4 pl-4 border-l border-[var(--scp-border)]">
                                <button
                                    onClick={() => canvasRef.current?.zoomIn()}
                                    className={toolbarHistoryButton(true)}
                                    title="Zoom In"
                                >
                                    <span className="material-icons text-[16px] leading-none">zoom_in</span>
                                </button>
                                <button
                                    onClick={() => canvasRef.current?.zoomOut()}
                                    className={toolbarHistoryButton(true)}
                                    title="Zoom Out"
                                >
                                    <span className="material-icons text-[16px] leading-none">zoom_out</span>
                                </button>
                            </div>
                            
                            {/* Add Entity Buttons */}
                            <div className="flex items-center gap-2 ml-4">
                                <button 
                                    onClick={addNPC}
                                    className={addEntityButtonNpc}
                                    title={t('map_editor.add_npc')}
                                >
                                    + NPC
                                </button>
                                <button 
                                    onClick={addObjective}
                                    className={addEntityButtonObj}
                                    title={t('map_editor.add_objective')}
                                >
                                    + OBJ
                                </button>
                            </div>
                        </>
                    )}
                </div>
                <div className="flex gap-2 pr-32">
                    <button onClick={() => setShowNewMapConfirm(true)} className={toolbarButtonGhost}>{t('map_editor.new_map')}</button>
                    <button onClick={() => showImportModal()} className={toolbarButtonGhost}>{t('map_editor.import')}</button>
                    <button onClick={() => showExportModal()} className={toolbarButtonGhost}>{t('map_editor.export')}</button>
                    <button onClick={handleReset} className={toolbarButtonGhost} title="Reset Story Template">
                        {t('map_editor.reset_title')}
                    </button>
                    
                    {/* Mode B: Direct Entry -> Save & Play */}
                    {(!gameState.scpData || gameState.scpData.designation === SCP173_TEMPLATE.designation) && (
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
                            {t('map_editor.entity_list')}
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto min-h-0 custom-scrollbar p-3 space-y-4">
                        {/* NPCs Section */}
                        <div>
                            <div className="text-[12px] text-scp-text-dim uppercase font-bold mb-2 px-1 tracking-wider">
                                {t('map_editor.npcs')} ({blueprint.npcs.length})
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
                                {t('map_editor.objectives')} ({blueprint.objectives.length})
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
                            {activeTab === 'MAP' ? t('map_editor.properties') : t('story_editor.title')}
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
                                        <label className="text-[12px] text-scp-text-dim font-bold uppercase block">
                                            {t('story_editor.designation')} <span className="text-red-500">*</span>
                                        </label>
                                        <input 
                                            type="text"
                                            value={scpData.designation}
                                            onChange={e => setScpData({...scpData, designation: e.target.value})}
                                            className={getInputClass(scpData.designation)}
                                            placeholder="SCP-XXX"
                                            required
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
                                        <label className="text-[12px] text-scp-text-dim font-bold uppercase block">
                                            {t('story_editor.player_role')} <span className="text-red-500">*</span>
                                        </label>
                                        <input 
                                            type="text"
                                            value={scpData.role || ''}
                                            onChange={e => setScpData({...scpData, role: e.target.value})}
                                            className={getInputClass(scpData.role)}
                                            placeholder="Researcher"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[12px] text-scp-text-dim font-bold uppercase block">
                                            {t('story_editor.name')} <span className="text-red-500">*</span>
                                        </label>
                                        <input 
                                            type="text"
                                            value={scpData.name}
                                            onChange={e => setScpData({...scpData, name: e.target.value})}
                                            className={getInputClass(scpData.name)}
                                            placeholder="The ..."
                                            required
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
                                            {scpData.storyDraft?.backgroundImage && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDeleteImage('bg');
                                                    }}
                                                    className="absolute top-1 right-1 bg-black/70 hover:bg-red-900/80 text-white p-1 rounded-sm z-20 transition-colors opacity-0 group-hover:opacity-100"
                                                    title={t('common.delete')}
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                    </svg>
                                                </button>
                                            )}
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
                                            {scpData.storyDraft?.entityImage && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDeleteImage('entity');
                                                    }}
                                                    className="absolute top-1 right-1 bg-black/70 hover:bg-red-900/80 text-white p-1 rounded-sm z-20 transition-colors opacity-0 group-hover:opacity-100"
                                                    title={t('common.delete')}
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                    </svg>
                                                </button>
                                            )}
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
