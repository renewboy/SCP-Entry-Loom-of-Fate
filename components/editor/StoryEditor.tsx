import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { GameState, GameStatus, SCPData } from '../../types';
import { useTranslation } from '../../utils/i18n';
import { useViewport } from '../../hooks/useViewport';
import EditorCanvas, { EditorCanvasRef } from './EditorCanvas';
import PropertyInspector from './PropertyInspector';
import StoryFormPanel from './StoryFormPanel';
import ConfirmationModal from '../ConfirmationModal';
import SidePanel from '../common/SidePanel';
import MobileEditorTabs, { MobileEditorTab } from './MobileEditorTabs';
import EntityListMobile from './EntityListMobile';
import { Sparkles, ZoomIn, ZoomOut, Undo, Redo, Play, ArrowLeft, Save, Trash, RotateCcw } from "lucide-react";

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
import { useStoryEditorModals } from '../../hooks/storyEditor/useStoryEditorModals';
import { useStoryImageManager } from '../../hooks/storyEditor/useStoryImageManager';
import { DEFAULT_BLUEPRINT, SCP173_TEMPLATE } from '../../constants/storyTemplates';
import { useHistory } from '../../hooks/storyEditor/useHistory';

import EditorAssistantPanel from './EditorAssistantPanel';

interface StoryEditorProps {
    gameState: GameState;
    setGameState: React.Dispatch<React.SetStateAction<GameState>>;
}

type EditorSelection = { type: 'node' | 'edge' | 'npc' | 'objective', id: string } | null;

const StoryEditor: React.FC<StoryEditorProps> = ({ gameState, setGameState }) => {
    const { t } = useTranslation();
    const { isMobile } = useViewport();
    const [showAssistant, setShowAssistant] = useState(false);
    const isHydratingRef = useRef(true);
    const [selectionState, setSelectionState] = useState<EditorSelection>(null);
    const selectionRef = useRef<EditorSelection>(null);
    const selectionHistoryRef = useRef<EditorSelection[]>([null]);

    const hasLoadedRef = useRef(false);
    const canvasRef = useRef<EditorCanvasRef>(null);

    const [activeTab, setActiveTab] = useState<'MAP' | 'STORY'>('STORY');
    
    const [mobileTab, setMobileTab] = useState<MobileEditorTab>('story');

    const {
        state: scpData,
        setState: setScpData,
        undo,
        redo,
        canUndo,
        canRedo,
        commit: commitScpData,
        reset: resetScpData,
        index: historyIndex
    } = useHistory<SCPData>({
        designation: '',
        name: '',
        containmentClass: '',
        role: '',
        storyDraft: {},
        mapBlueprint: DEFAULT_BLUEPRINT
    }, {
        mergeDelayMs: 600,
        onCommit: () => {
            if (isHydratingRef.current) return;
            selectionHistoryRef.current = selectionHistoryRef.current.slice(0, historyIndex + 1);
            selectionHistoryRef.current.push(selectionRef.current ?? null);
        }
    });

    const blueprint = useMemo(() => scpData.mapBlueprint || DEFAULT_BLUEPRINT, [scpData.mapBlueprint]);
    const commitBlueprint = commitScpData;

    const setSelection = useCallback((next: EditorSelection | ((prev: EditorSelection) => EditorSelection)) => {
        setSelectionState(prev => {
            const resolved = typeof next === 'function' ? next(prev) : next;
            selectionRef.current = resolved;
            selectionHistoryRef.current[historyIndex] = resolved;
            return resolved;
        });
    }, [historyIndex]);

    const isSelectionValid = useCallback((sel: EditorSelection) => {
        if (!sel) return true;
        if (sel.type === 'node') return blueprint.nodes.some(n => n.id === sel.id);
        if (sel.type === 'npc') return blueprint.npcs.some(n => n.id === sel.id);
        if (sel.type === 'objective') return blueprint.objectives.some(o => o.id === sel.id);
        if (sel.type === 'edge') return blueprint.edges.some(e => `${e.from}-${e.to}` === sel.id);
        return false;
    }, [blueprint]);

    const setBlueprint = useCallback((next: any, commitMode?: 'immediate' | 'deferred') => {
        setScpData(prev => {
            const current = prev.mapBlueprint || DEFAULT_BLUEPRINT;
            const resolved = typeof next === 'function' ? next(current) : next;
            return {
                ...prev,
                mapBlueprint: resolved
            };
        }, commitMode);
    }, [setScpData]);

    const updateNode = useCallback((id: string, updates: any) => {
        setBlueprint((prev: any) => {
            if (updates.id && updates.id !== id) {
                const newId = updates.id;
                if (selectionState?.type === 'node' && selectionState.id === id) {
                    setSelection(s => s ? { ...s, id: newId } : null);
                }
                return {
                    ...prev,
                    nodes: prev.nodes.map((n: any) => n.id === id ? { ...n, ...updates } : n),
                    edges: prev.edges.map((e: any) => ({
                        ...e,
                        from: e.from === id ? newId : e.from,
                        to: e.to === id ? newId : e.to
                    })),
                    npcs: prev.npcs.map((n: any) => ({
                        ...n,
                        initialNodeId: n.initialNodeId === id ? newId : n.initialNodeId
                    })),
                    objectives: prev.objectives.map((o: any) => ({
                        ...o,
                        nodeId: o.nodeId === id ? newId : o.nodeId
                    })),
                    startNodeId: prev.startNodeId === id ? newId : prev.startNodeId
                };
            }
            return {
                ...prev,
                nodes: prev.nodes.map((n: any) => n.id === id ? { ...n, ...updates } : n)
            };
        }, 'deferred');
    }, [selectionState, setBlueprint, setSelection]);

    const updateEdge = useCallback((from: string, to: string, updates: any) => {
        setBlueprint((prev: any) => ({
            ...prev,
            edges: prev.edges.map((e: any) => (e.from === from && e.to === to) ? { ...e, ...updates } : e)
        }), 'immediate');
    }, [setBlueprint]);

    const updateNPC = useCallback((id: string, updates: any) => {
        setBlueprint((prev: any) => {
            if (updates.id && updates.id !== id) {
                if (selectionState?.type === 'npc' && selectionState.id === id) {
                    setSelection(s => s ? { ...s, id: updates.id } : null);
                }
            }
            return {
                ...prev,
                npcs: prev.npcs.map((n: any) => n.id === id ? { ...n, ...updates } : n)
            };
        }, 'deferred');
    }, [selectionState, setBlueprint, setSelection]);

    const updateObjective = useCallback((id: string, updates: any) => {
        setBlueprint((prev: any) => {
            if (updates.id && updates.id !== id) {
                if (selectionState?.type === 'objective' && selectionState.id === id) {
                    setSelection(s => s ? { ...s, id: updates.id } : null);
                }
            }
            return {
                ...prev,
                objectives: prev.objectives.map((o: any) => o.id === id ? { ...o, ...updates } : o)
            };
        }, 'deferred');
    }, [selectionState, setBlueprint, setSelection]);

    const addNode = useCallback(() => {
        const id = `node_${Math.floor(Math.random() * 900) + 100}`;
        const newNode = {
            id,
            name: 'New Node',
            danger: 0,
            layout: { x: 100, y: 100 }
        };
        setBlueprint((prev: any) => ({ ...prev, nodes: [...prev.nodes, newNode] }), 'immediate');
        setSelection({ type: 'node', id });
        if (isMobile) {
            setMobileTab('properties');
        }
    }, [setBlueprint, setSelection, isMobile]);

    const addEdge = useCallback((from: string, to: string) => {
        const exists = blueprint.edges.some((e: any) =>
            (e.from === from && e.to === to) || (e.bidirectional && e.from === to && e.to === from)
        );
        if (exists) return;
        setBlueprint((prev: any) => ({
            ...prev,
            edges: [...prev.edges, { from, to, bidirectional: true }]
        }), 'immediate');
    }, [blueprint.edges, setBlueprint]);

    const addNPC = useCallback(() => {
        const id = `npc_${Math.floor(Math.random() * 900) + 100}`;
        const targetNodeId = (selectionState?.type === 'node' && selectionState.id) ? selectionState.id : blueprint.startNodeId;
        const newNPC = {
            id,
            name: 'New NPC',
            archetype: 'Researcher',
            initialNodeId: targetNodeId
        };
        setBlueprint((prev: any) => ({ ...prev, npcs: [...prev.npcs, newNPC] }), 'immediate');
        setSelection({ type: 'npc', id });
        if (isMobile) {
            setMobileTab('properties');
        }
    }, [blueprint.startNodeId, selectionState, setBlueprint, setSelection, isMobile]);

    const addObjective = useCallback(() => {
        const id = `obj_${Math.floor(Math.random() * 900) + 100}`;
        const targetNodeId = (selectionState?.type === 'node' && selectionState.id) ? selectionState.id : blueprint.startNodeId;
        const newObj = {
            id,
            title: 'New Objective',
            type: 'MAIN',
            nodeId: targetNodeId
        };
        setBlueprint((prev: any) => ({ ...prev, objectives: [...prev.objectives, newObj] }), 'immediate');
        setSelection({ type: 'objective', id });
        if (isMobile) {
            setMobileTab('properties');
        }
    }, [blueprint.startNodeId, selectionState, setBlueprint, setSelection, isMobile]);

    const handleDeleteSelection = useCallback(() => {
        if (!selectionState) return;
        if (selectionState.type === 'node') {
            setBlueprint((prev: any) => ({
                ...prev,
                nodes: prev.nodes.filter((n: any) => n.id !== selectionState.id),
                edges: prev.edges.filter((e: any) => e.from !== selectionState.id && e.to !== selectionState.id),
                npcs: prev.npcs.filter((n: any) => n.initialNodeId !== selectionState.id),
                objectives: prev.objectives.filter((o: any) => o.nodeId !== selectionState.id)
            }), 'immediate');
        } else if (selectionState.type === 'edge') {
            const [from, to] = selectionState.id.split('-');
            setBlueprint((prev: any) => ({
                ...prev,
                edges: prev.edges.filter((e: any) => !(e.from === from && e.to === to))
            }), 'immediate');
        } else if (selectionState.type === 'npc') {
            setBlueprint((prev: any) => ({ ...prev, npcs: prev.npcs.filter((n: any) => n.id !== selectionState.id) }), 'immediate');
        } else if (selectionState.type === 'objective') {
            setBlueprint((prev: any) => ({ ...prev, objectives: prev.objectives.filter((o: any) => o.id !== selectionState.id) }), 'immediate');
        }
        setSelection(null);
    }, [selectionState, setBlueprint, setSelection]);

    const [isStarting, setIsStarting] = useState(false);
    const isStartingRef = useRef(false);
    const [showValidationErrors, setShowValidationErrors] = useState(false);

    const {
        generatingState,
        bgImagePrompt,
        setBgImagePrompt,
        entityImagePrompt,
        setEntityImagePrompt,
        npcImagePrompts,
        handleNpcPromptChange,
        handleGenerateNPCImage,
        handleUploadNPCImage,
        handleDeleteNPCImage,
        lightboxImage,
        setLightboxImage,
        handleImageUpload,
        handleGenerateImage,
        handleDeleteImage,
        setPromptsFromData
    } = useStoryImageManager({ scpData, setScpData });

    const {
        modal,
        showNewMapConfirm,
        showResetConfirm,
        setShowNewMapConfirm,
        setShowResetConfirm,
        closeModal,
        showImportModal,
        showExportModal,
        handleReset,
        confirmNewMap,
        confirmReset
    } = useStoryEditorModals({
        t,
        blueprint,
        scpData,
        setScpData,
        setBlueprint,
        setPromptsFromData,
        defaultBlueprint: DEFAULT_BLUEPRINT,
        templateData: SCP173_TEMPLATE
    });

    const handleMapSelection = (next: { type: 'node' | 'edge' | 'npc' | 'objective', id: string } | null) => {
        if (activeTab !== 'MAP' && !isMobile) {
            setActiveTab('MAP');
        }
        setSelection(next);
    };

    const handleMobileSelection = (next: EditorSelection) => {
        setSelection(next);
        if (next && (next.type === 'npc' || next.type === 'objective')) {
            setMobileTab('properties');
        }
    };

    useEffect(() => {
        if (isHydratingRef.current) return;
        const snapshot = selectionHistoryRef.current[historyIndex] ?? null;
        if (snapshot && !isSelectionValid(snapshot)) {
            setSelection(null);
            return;
        }
        setSelection(snapshot);
    }, [historyIndex, isSelectionValid, setSelection]);

    useEffect(() => {
        if (hasLoadedRef.current) return;
        hasLoadedRef.current = true;
        const loadInitial = async () => {
            isHydratingRef.current = true;
            let loadedData: SCPData | null = null;

            const memoryCached = getEditingStoryCache();
            if (memoryCached) {
                loadedData = memoryCached;
            } else {
                loadedData = await loadEditingSCPData();
            }

            if (loadedData) {
                resetScpData({
                    ...loadedData,
                    mapBlueprint: loadedData.mapBlueprint || DEFAULT_BLUEPRINT
                });
                selectionRef.current = null;
                selectionHistoryRef.current = [null];
                setSelectionState(null);
            } else if (gameState.scpData) {
                const initialStoryDraft = gameState.scpData.storyDraft || {
                    roleDetails: gameState.role !== 'CUSTOM' ? gameState.role : '',
                    storyBackground: '',
                    backgroundImage: gameState.backgroundImage || undefined,
                    entityImage: gameState.mainImage || undefined
                };

                resetScpData({
                    ...gameState.scpData,
                    mapBlueprint: gameState.scpData.mapBlueprint || DEFAULT_BLUEPRINT,
                    storyDraft: initialStoryDraft,
                    role: gameState.scpData.role || gameState.role || SCP173_TEMPLATE.role
                });
                selectionRef.current = null;
                selectionHistoryRef.current = [null];
                setSelectionState(null);
            } else {
                 resetScpData({
                    ...SCP173_TEMPLATE,
                    mapBlueprint: SCP173_TEMPLATE.mapBlueprint || DEFAULT_BLUEPRINT
                 });
                selectionRef.current = null;
                selectionHistoryRef.current = [null];
                setSelectionState(null);
            }

            const sourceData = loadedData || gameState.scpData || SCP173_TEMPLATE;
            setPromptsFromData(sourceData);
            isHydratingRef.current = false;
        };
        loadInitial();
    }, [gameState.scpData, setBlueprint, gameState.role, gameState.backgroundImage, gameState.mainImage, setPromptsFromData]);

    useEffect(() => {
        const currentData: SCPData = {
            ...scpData,
            mapBlueprint: blueprint
        };
        setEditingStoryCache(currentData);
    }, [blueprint, scpData]);

    const handleUndo = useCallback(() => {
        if (!canUndo) return;
        undo();
    }, [canUndo, undo]);

    const handleRedo = useCallback(() => {
        if (!canRedo) return;
        redo();
    }, [canRedo, redo]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
                if (e.shiftKey) {
                    e.preventDefault();
                    handleRedo();
                } else {
                    e.preventDefault();
                    handleUndo();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleUndo, handleRedo]);

    const validateInputs = () => {
        const isValid = !!(scpData.designation && scpData.name && scpData.role);
        if (!isValid) {
            setShowValidationErrors(true);
            if (!isMobile && activeTab !== 'STORY') {
                setActiveTab('STORY');
            }
            if (isMobile) {
                setMobileTab('story');
            }
        }
        return isValid;
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
        if (isStartingRef.current) {
            return;
        }

        if (!validateInputs()) {
            return;
        }

        isStartingRef.current = true;
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
            isStartingRef.current = false;
            setIsStarting(false);
        }
    };

    const handleMobileTabChange = (tab: MobileEditorTab) => {
        setMobileTab(tab);
        if (tab === 'assistant') {
            setShowAssistant(true);
        } else {
            setShowAssistant(false);
        }
    };

    const showSaveAndPlay = !gameState.scpData || gameState.scpData.designation === SCP173_TEMPLATE.designation;

    return (
        <div className="w-full h-full flex flex-col bg-[var(--scp-bg)] text-[var(--scp-text)] overflow-hidden relative font-mono">
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
                            {modal.extraAction && (
                                <button onClick={modal.extraAction.onClick} className={toolbarButtonBase}>
                                    {t(modal.extraAction.labelKey)}
                                </button>
                            )}
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
                onConfirm={confirmNewMap}
                title={t('map_editor.new_map_confirm_title')}
                message={t('map_editor.new_map_confirm_msg')}
                confirmText={t('common.confirm')}
            />

            <ConfirmationModal 
                isOpen={showResetConfirm}
                onCancel={() => setShowResetConfirm(false)}
                onConfirm={confirmReset}
                title={t('map_editor.reset_title')}
                message={t('map_editor.reset_confirm_msg')}
                confirmText={t('map_editor.btn_reset_confirm')}
            />

            {isMobile ? (
                <div className="h-12 border-b border-[var(--scp-border)] flex items-center justify-between px-2 bg-[var(--scp-surface)] shrink-0 z-10 shadow-md scp-ui crt">
                    <div className="flex items-center gap-1">
                        <button 
                            onClick={handleBack} 
                            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-scp-text hover:text-scp-accent transition-colors"
                        >
                            <ArrowLeft size={20} strokeWidth={1.5} />
                        </button>
                    </div>
                    <div className="flex-1 flex items-center justify-center gap-2">
                        <span className="text-xs font-mono uppercase tracking-wider text-scp-text-dim font-bold">
                            {t('story_editor.title')}
                        </span>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={handleUndo}
                                disabled={!canUndo}
                                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-scp-text hover:text-scp-accent transition-colors disabled:opacity-40"
                            >
                                <Undo size={18} strokeWidth={1.5} />
                            </button>
                            <button
                                onClick={handleRedo}
                                disabled={!canRedo}
                                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-scp-text hover:text-scp-accent transition-colors disabled:opacity-40"
                            >
                                <Redo size={18} strokeWidth={1.5} />
                            </button>
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        {selectionState && (
                            <button
                                onClick={handleDeleteSelection}
                                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-scp-text hover:text-scp-accent transition-colors"
                            >
                                <Trash size={18} strokeWidth={1.5} />
                            </button>
                        )}
                        {mobileTab === 'canvas' && (
                            <button
                                onClick={handleReset}
                                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-scp-text hover:text-scp-accent transition-colors"
                            >
                                <RotateCcw size={18} strokeWidth={1.5} />
                            </button>
                        )}
                        {showSaveAndPlay ? (
                            <button 
                                onClick={handleSaveAndPlay}
                                disabled={isStarting}
                                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-scp-text hover:text-scp-accent transition-colors disabled:opacity-50"
                            >
                                {isStarting ? (
                                    <div className="w-5 h-5 border-2 border-scp-accent/30 border-t-scp-accent rounded-full animate-spin"></div>
                                ) : (
                                    <Play size={20} strokeWidth={1.5} />
                                )}
                            </button>
                        ) : (
                            <button 
                                onClick={handleBack}
                                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-scp-term hover:text-scp-accent transition-colors"
                            >
                                <Save size={20} strokeWidth={1.5} />
                            </button>
                        )}
                    </div>
                </div>
            ) : (
                <div className="h-12 border-b border-[var(--scp-border)] flex items-center justify-between px-4 bg-[var(--scp-surface)] shrink-0 z-10 shadow-md scp-ui crt">
                    <div className="flex items-center gap-4">
                        <button onClick={handleBack} className={toolbarButtonBase}>
                            <span>←</span> {t('common.back')}
                        </button>
                        <div className={toolbarGroupDivider}></div>
                        <span className="text-scp-text-dim font-bold font-mono text-xs tracking-wider">{t('story_editor.title')}</span>
                        
                        <button
                            onClick={() => setShowAssistant(!showAssistant)}
                            className={`ml-4 px-3 py-1 text-xs font-bold transition-colors ${showAssistant ? 'bg-scp-accent text-white' : 'text-gray-400 hover:text-white'}`}
                        >
                            <div className="flex items-center gap-2">
                                <Sparkles size={16} strokeWidth={2} />
                                <span>{t('editor_assistant.title')} (Beta)</span>
                            </div>
                        </button>

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

                        <>
                            <div className="flex items-center gap-1 ml-4 pl-4 border-l border-[var(--scp-border)]">
                                <button 
                                    onClick={handleUndo} 
                                    disabled={!canUndo}
                                    className={toolbarHistoryButton(canUndo)}
                                    title="Undo (Ctrl+Z)"
                                >
                                    <Undo size={16} strokeWidth={1} /> {t('common.undo')}
                                </button>
                                <button 
                                    onClick={handleRedo} 
                                    disabled={!canRedo}
                                    className={toolbarHistoryButton(canRedo)}
                                    title="Redo (Ctrl+Shift+Z)"
                                >
                                    <Redo size={16} strokeWidth={1} /> {t('common.redo')}
                                </button>
                            </div>
                            {activeTab === 'MAP' && (
                                <>
                                    <div className="flex items-center gap-1 ml-4 pl-4 border-l border-[var(--scp-border)]">
                                        <button
                                            onClick={() => canvasRef.current?.zoomIn()}
                                            className={toolbarHistoryButton(true)}
                                            title="Zoom In"
                                        >
                                            <ZoomIn size={16} strokeWidth={1} />
                                        </button>
                                        <button
                                            onClick={() => canvasRef.current?.zoomOut()}
                                            className={toolbarHistoryButton(true)}
                                            title="Zoom Out"
                                        >
                                            <ZoomOut size={16} strokeWidth={1} />
                                        </button>
                                    </div>
                                    
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
                        </>
                    </div>
                    <div className="flex gap-2 pr-32">
                        <button onClick={() => setShowNewMapConfirm(true)} className={toolbarButtonGhost}>{t('map_editor.new_map')}</button>
                        <button onClick={() => showImportModal()} className={toolbarButtonGhost}>{t('map_editor.import')}</button>
                        <button onClick={() => showExportModal()} className={toolbarButtonGhost}>{t('map_editor.export')}</button>
                        <button onClick={handleReset} className={toolbarButtonGhost} title="Reset Story Template">
                            {t('map_editor.reset_title')}
                        </button>
                        
                        {showSaveAndPlay && (
                            <button 
                                onClick={handleSaveAndPlay}
                                disabled={isStarting}
                                className="scp-btn-action px-4 py-1 text-xs font-bold text-scp-white hover:text-scp-accent border-scp-gray/30 hover:border-scp-accent/60 flex items-center gap-2 min-w-[140px] justify-center"
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
            )}

            <div className="flex-1 relative overflow-hidden">
                {isMobile ? (
                    <div className="w-full h-full flex flex-col">
                        <div className="flex-1 overflow-hidden">
                            {mobileTab === 'story' && (
                                <StoryFormPanel
                                    t={t}
                                    scpData={scpData}
                                    setScpData={setScpData}
                                    commitScpData={commitScpData}
                                    showValidationErrors={showValidationErrors}
                                    bgImagePrompt={bgImagePrompt}
                                    setBgImagePrompt={setBgImagePrompt}
                                    entityImagePrompt={entityImagePrompt}
                                    setEntityImagePrompt={setEntityImagePrompt}
                                    generatingState={generatingState}
                                    handleGenerateImage={handleGenerateImage}
                                    handleImageUpload={handleImageUpload}
                                    handleDeleteImage={handleDeleteImage}
                                    setLightboxImage={setLightboxImage}
                                    isMobile={true}
                                />
                            )}
                            {mobileTab === 'canvas' && (
                                <EditorCanvas 
                                    ref={canvasRef}
                                    blueprint={blueprint} 
                                    selection={selectionState} 
                                    setSelection={handleMapSelection} 
                                    updateNode={updateNode}
                                    addNode={addNode}
                                    addEdge={addEdge}
                                    commitBlueprint={commitBlueprint}
                                    onDeleteSelection={handleDeleteSelection}
                                    isMobile={true}
                                    onAddNPC={addNPC}
                                    onAddObjective={addObjective}
                                />
                            )}
                            {mobileTab === 'properties' && (
                                <PropertyInspector 
                                    blueprint={blueprint}
                                    selection={selectionState}
                                    setSelection={handleMapSelection}
                                    updateNode={updateNode}
                                    updateEdge={updateEdge}
                                    updateNPC={updateNPC}
                                    updateObjective={updateObjective}
                                    setBlueprint={setBlueprint}
                                    npcImagePrompts={npcImagePrompts}
                                    onNpcPromptChange={handleNpcPromptChange}
                                    onGenerateNpcImage={handleGenerateNPCImage}
                                    onUploadNpcImage={handleUploadNPCImage}
                                    onDeleteNpcImage={handleDeleteNPCImage}
                                    npcImages={scpData.npcImages}
                                    generatingState={generatingState}
                                    setLightboxImage={setLightboxImage}
                                    commitBlueprint={commitBlueprint}
                                    commitScpData={commitScpData}
                                    isMobile={true}
                                />
                            )}
                            {mobileTab === 'assistant' && (
                                <EditorAssistantPanel
                                    blueprint={blueprint}
                                    setBlueprint={setBlueprint}
                                    scpData={scpData}
                                    setScpData={setScpData}
                                    legacyData={gameState.legacy}
                                    onClose={() => setMobileTab('story')}
                                    isOpen={true}
                                    isMobile={true}
                                />
                            )}
                            {mobileTab === 'entities' && (
                                <EntityListMobile
                                    blueprint={blueprint}
                                    selection={selectionState}
                                    onSelectionChange={handleMobileSelection}
                                    onAddNPC={addNPC}
                                    onAddObjective={addObjective}
                                />
                            )}
                        </div>
                        
                        <MobileEditorTabs 
                            activeTab={mobileTab}
                            onTabChange={handleMobileTabChange}
                            hasSelection={!!selectionState}
                        />
                    </div>
                ) : (
                    <>
                        <div className="absolute inset-0 bg-[#050505] scp-ui crt pl-56 pr-80 box-border">
                            <div className="absolute inset-0 bg-grid-pattern opacity-10 pointer-events-none"></div>
                            <div className="relative w-full h-full">
                                <EditorCanvas 
                                    ref={canvasRef}
                                    blueprint={blueprint} 
                                    selection={selectionState} 
                                    setSelection={handleMapSelection} 
                                    updateNode={updateNode}
                                    addNode={addNode}
                                    addEdge={addEdge}
                                    commitBlueprint={commitBlueprint}
                                    onDeleteSelection={handleDeleteSelection}
                                />
                            </div>
                        </div>

                        {showAssistant && (
                            <EditorAssistantPanel
                                blueprint={blueprint}
                                setBlueprint={setBlueprint}
                                scpData={scpData}
                                setScpData={setScpData}
                                legacyData={gameState.legacy}
                                onClose={() => setShowAssistant(false)}
                                isOpen={showAssistant}
                            />
                        )}

                        <SidePanel side="left" className={`absolute top-0 bottom-0 w-56 ${panelContainerBase}`}>
                            <div className={editorPanelHeader}>
                                <div className={editorPanelTitle}>
                                    {t('map_editor.entity_list')}
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto min-h-0 custom-scrollbar p-3 space-y-4">
                                <div>
                                    <div className="text-[12px] text-scp-text-dim uppercase font-bold mb-2 px-1 tracking-wider">
                                        {t('map_editor.npcs')} ({(blueprint.npcs || []).length})
                                    </div>
                                    <div className="space-y-1">
                                        {(blueprint.npcs || []).map(npc => (
                                            <div 
                                                key={npc.id}
                                                onClick={() => {
                                                    handleMapSelection({ type: 'npc', id: npc.id });
                                                }}
                                                className={`${listItemBase} ${selectionState?.type === 'npc' && selectionState.id === npc.id ? listItemNpcActive : listItemInactive}`}
                                            >
                                                <div className="font-bold truncate">{npc.name}</div>
                                                <div className="text-[12px] opacity-60 truncate">{npc.archetype}</div>
                                            </div>
                                        ))}
                                        {(blueprint.npcs || []).length === 0 && <div className="p-2 text-[12px] text-gray-600 italic text-center border border-dashed border-gray-800 rounded">No Entities</div>}
                                    </div>
                                </div>

                                <div>
                                    <div className="text-[12px] text-scp-text-dim uppercase font-bold mb-2 px-1 tracking-wider border-t border-[var(--scp-border)] pt-4">
                                        {t('map_editor.objectives')} ({(blueprint.objectives || []).length})
                                    </div>
                                    <div className="space-y-1">
                                        {(blueprint.objectives || []).map(obj => (
                                            <div 
                                                key={obj.id}
                                                onClick={() => {
                                                    handleMapSelection({ type: 'objective', id: obj.id });
                                                }}
                                                className={`${listItemBase} ${selectionState?.type === 'objective' && selectionState.id === obj.id ? listItemObjectiveActive : listItemInactive}`}
                                            >
                                                <div className="font-bold truncate">{obj.title}</div>
                                                <div className="text-[12px] opacity-60 truncate">{obj.type}</div>
                                            </div>
                                        ))}
                                        {(blueprint.objectives || []).length === 0 && <div className="p-2 text-[12px] text-gray-600 italic text-center border border-dashed border-gray-800 rounded">No Objectives</div>}
                                    </div>
                                </div>
                            </div>
                        </SidePanel>

                        <SidePanel side="right" className={`absolute top-0 bottom-0 w-80 ${panelContainerBase}`}>
                            <div className={editorPanelHeader}>
                                <div className={editorPanelTitle}>
                                    {activeTab === 'MAP' ? t('map_editor.properties') : t('story_editor.title')}
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto custom-scrollbar">
                                {activeTab === 'MAP' ? (
                                    <PropertyInspector 
                                        blueprint={blueprint}
                                        selection={selectionState}
                                        setSelection={handleMapSelection}
                                        updateNode={updateNode}
                                        updateEdge={updateEdge}
                                        updateNPC={updateNPC}
                                        updateObjective={updateObjective}
                                        setBlueprint={setBlueprint}
                                        npcImagePrompts={npcImagePrompts}
                                        onNpcPromptChange={handleNpcPromptChange}
                                        onGenerateNpcImage={handleGenerateNPCImage}
                                        onUploadNpcImage={handleUploadNPCImage}
                                        onDeleteNpcImage={handleDeleteNPCImage}
                                        npcImages={scpData.npcImages}
                                        generatingState={generatingState}
                                        setLightboxImage={setLightboxImage}
                                        commitBlueprint={commitBlueprint}
                                        commitScpData={commitScpData}
                                    />
                                ) : (
                                    <StoryFormPanel
                                        t={t}
                                        scpData={scpData}
                                        setScpData={setScpData}
                                        commitScpData={commitScpData}
                                        showValidationErrors={showValidationErrors}
                                        bgImagePrompt={bgImagePrompt}
                                        setBgImagePrompt={setBgImagePrompt}
                                        entityImagePrompt={entityImagePrompt}
                                        setEntityImagePrompt={setEntityImagePrompt}
                                        generatingState={generatingState}
                                        handleGenerateImage={handleGenerateImage}
                                        handleImageUpload={handleImageUpload}
                                        handleDeleteImage={handleDeleteImage}
                                        setLightboxImage={setLightboxImage}
                                    />
                                )}
                            </div>
                        </SidePanel>
                    </>
                )}
            </div>
        </div>
    );
};

export default StoryEditor;
