import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { GameState, GameStatus, SCPData } from '../../types';
import { Redo2, Sparkles, Undo2 } from 'lucide-react';
import { useTranslation } from '../../utils/i18n';
import { useCompactScreen } from '../../hooks/useCompactScreen';
import { clearManualLayout, NetworkPoint, pinNetworkLayout } from '../../utils/siteNetwork';
import GameButton from '../common/GameButton';
import { StageFilters } from '../game/stage/StageOverlays';
import EditorCanvas, { EditorCanvasRef } from './EditorCanvas';
import EditorRail from './EditorRail';
import PropertyInspector, { EDGE_ID_SEPARATOR, EditorSelection } from './PropertyInspector';
import StoryFormPanel from './StoryFormPanel';
import { loadEditingSCPData, saveEditingSCPData } from '../../services/indexedDBService';
import { getEditingStoryCache, setEditingStoryCache } from '../../services/storyEditorCache';
import { useStoryEditorModals } from '../../hooks/storyEditor/useStoryEditorModals';
import { useStoryImageManager } from '../../hooks/storyEditor/useStoryImageManager';
import { DEFAULT_BLUEPRINT, SCP173_TEMPLATE } from '../../constants/storyTemplates';
import { useHistory } from '../../hooks/storyEditor/useHistory';
import EditorAssistantPanel from './EditorAssistantPanel';
import '../../styles/stage.css';
import '../../styles/stagePanels.css';
import '../../styles/tactical.css';
import '../../styles/storyEditor.css';

interface StoryEditorProps {
    gameState: GameState;
    setGameState: React.Dispatch<React.SetStateAction<GameState>>;
}

type MobileEditorTab = 'story' | 'canvas' | 'properties' | 'assistant' | 'entities';
const MOBILE_TABS: [MobileEditorTab, string][] = [
    ['story', 'story_editor.tab_story'],
    ['canvas', 'story_editor.tab_map'],
    ['properties', 'map_editor.properties'],
    ['assistant', 'editor_assistant.title'],
    ['entities', 'map_editor.entity_list'],
];

interface ConfirmDialogProps {
    title: string;
    message: string;
    confirmLabel: string;
    cancelLabel: string;
    onConfirm: () => void;
    onCancel: () => void;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({ title, message, confirmLabel, cancelLabel, onConfirm, onCancel }) => (
    <div className="modal-back">
        <div className="modal" role="dialog" aria-label={title}>
            <h3>{title}</h3>
            <div className="modal-body">{message}</div>
            <div className="modal-foot">
                <GameButton size="sm" onClick={onCancel}>{cancelLabel}</GameButton>
                <GameButton size="sm" variant="danger" onClick={onConfirm}>{confirmLabel}</GameButton>
            </div>
        </div>
    </div>
);

const StoryEditor: React.FC<StoryEditorProps> = ({ gameState, setGameState }) => {
    const { t } = useTranslation();
    const isMobile = useCompactScreen();
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
        if (sel.type === 'edge') return blueprint.edges.some(e => `${e.from}${EDGE_ID_SEPARATOR}${e.to}` === sel.id);
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
        setScpData(prev => {
            const current = prev.mapBlueprint || DEFAULT_BLUEPRINT;
            const renamed = updates.id && updates.id !== id;
            if (renamed && selectionState?.type === 'npc' && selectionState.id === id) {
                setSelection(s => s ? { ...s, id: updates.id } : null);
            }
            const npcImages = renamed && prev.npcImages?.[id] ? { ...prev.npcImages, [updates.id]: prev.npcImages[id] } : prev.npcImages;
            if (renamed && npcImages) delete npcImages[id];
            return {
                ...prev,
                npcImages,
                mapBlueprint: {
                    ...current,
                    npcs: current.npcs.map((n: any) => n.id === id ? { ...n, ...updates } : n)
                }
            };
        }, 'deferred');
    }, [selectionState, setScpData, setSelection]);

    const moveNode = useCallback((id: string, point: NetworkPoint) => {
        setBlueprint((prev: any) => pinNetworkLayout(prev, { [id]: point }), 'immediate');
    }, [setBlueprint]);

    const restoreAutoLayout = useCallback(() => {
        setBlueprint((prev: any) => clearManualLayout(prev), 'immediate');
    }, [setBlueprint]);

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
            layout: canvasRef.current?.centerPoint() ?? { x: 100, y: 100 }
        };
        selectionRef.current = { type: 'node', id };
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
        selectionRef.current = { type: 'npc', id };
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
        selectionRef.current = { type: 'objective', id };
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
            const [from, to] = selectionState.id.split(EDGE_ID_SEPARATOR);
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

    const handleSelect = (next: EditorSelection) => {
        setSelection(next);
        if (isMobile && next) setMobileTab('properties');
    };

    const showSaveAndPlay = !gameState.scpData || gameState.scpData.designation === SCP173_TEMPLATE.designation;

    const mapMode = activeTab === 'MAP';
    const assistantOpen = isMobile ? mobileTab === 'assistant' : showAssistant;
    const panelOn = (tab: MobileEditorTab) => (isMobile && mobileTab === tab ? 'm-on' : '');
    const background = scpData.storyDraft?.backgroundImage || gameState.backgroundImage;

    return (
        <div className="stage-root">
            <StageFilters />
            <section className="p3-view ed">
                {background && <div className="ed-bg" style={{ backgroundImage: `url(${background})` }} />}
                <header className="ed-top">
                    <GameButton variant="quiet" size="sm" onClick={handleBack}>← {t('common.back')}</GameButton>
                    <span className="ed-sep" />
                    <span className="ed-title">{t('story_editor.title')}</span>
                    <div className="ed-tabs" role="tablist">
                        <button type="button" role="tab" aria-selected={activeTab === 'STORY'} onClick={() => setActiveTab('STORY')}>{t('story_editor.tab_story')}</button>
                        <button type="button" role="tab" aria-selected={activeTab === 'MAP'} onClick={() => setActiveTab('MAP')}>{t('story_editor.tab_map')}</button>
                    </div>
                    <span className="ed-sep" />
                    <div className="ed-hist">
                        <GameButton variant="icon" disabled={!canUndo} title="Undo (Ctrl+Z)" aria-label={t('common.undo')} onClick={handleUndo}><Undo2 size={16} strokeWidth={1.75} /></GameButton>
                        <GameButton variant="icon" disabled={!canRedo} title="Redo (Ctrl+Shift+Z)" aria-label={t('common.redo')} onClick={handleRedo}><Redo2 size={16} strokeWidth={1.75} /></GameButton>
                    </div>
                    <GameButton size="sm" className={`ed-assist ${showAssistant ? 'on' : ''}`} aria-pressed={showAssistant} onClick={() => setShowAssistant(open => !open)}>
                        <Sparkles size={16} strokeWidth={2} />{t('editor_assistant.title')} (Beta)
                    </GameButton>
                    <span className="ed-spacer" />
                    {isMobile && selectionState && <GameButton variant="icon" aria-label={t('common.delete')} title={t('common.delete')} onClick={handleDeleteSelection}>✕</GameButton>}
                    {isMobile && mobileTab === 'canvas' && <GameButton variant="icon" aria-label={t('map_editor.reset_title')} title={t('map_editor.reset_title')} onClick={handleReset}>⟲</GameButton>}
                    <div className="ed-file">
                        <GameButton variant="quiet" size="sm" onClick={() => setShowNewMapConfirm(true)}>{t('map_editor.new_map')}</GameButton>
                        <GameButton variant="quiet" size="sm" onClick={() => showImportModal()}>{t('map_editor.import')}</GameButton>
                        <GameButton variant="quiet" size="sm" onClick={() => showExportModal()}>{t('map_editor.export')}</GameButton>
                        <GameButton variant="quiet" size="sm" title="Reset Story Template" onClick={handleReset}>{t('map_editor.reset_title')}</GameButton>
                    </div>
                    {showSaveAndPlay && (
                        <GameButton variant="primary" size="sm" loading={isStarting} onClick={handleSaveAndPlay}>{t('story_editor.btn_save_and_play')}</GameButton>
                    )}
                </header>

                <div className="ed-main">
                    <aside className={`ed-rail ${panelOn('entities')}`} hidden={!isMobile && !mapMode}>
                        <EditorRail
                            blueprint={blueprint}
                            selection={selectionState}
                            npcImages={scpData.npcImages}
                            onSelect={handleSelect}
                            onAddNode={addNode}
                            onAddNPC={addNPC}
                            onAddObjective={addObjective}
                        />
                    </aside>
                    <div className={`ed-canvas ${panelOn('canvas')}`} hidden={!isMobile && !mapMode}>
                        <EditorCanvas
                            ref={canvasRef}
                            blueprint={blueprint}
                            selection={selectionState}
                            setSelection={handleMapSelection}
                            moveNode={moveNode}
                            addNode={addNode}
                            addEdge={addEdge}
                            restoreAutoLayout={restoreAutoLayout}
                            onDeleteSelection={handleDeleteSelection}
                            npcImages={scpData.npcImages}
                        />
                    </div>
                    <div className={`story ${panelOn('story')}`} hidden={!isMobile && mapMode}>
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
                    </div>
                    <aside className={`ai ${assistantOpen ? 'open' : ''} ${panelOn('assistant')}`}>
                        <EditorAssistantPanel
                            blueprint={blueprint}
                            setBlueprint={setBlueprint}
                            scpData={scpData}
                            setScpData={setScpData}
                            legacyData={gameState.legacy}
                            onClose={() => {
                                setShowAssistant(false);
                                if (isMobile) setMobileTab('story');
                            }}
                            isOpen={assistantOpen}
                            isMobile={isMobile}
                        />
                    </aside>
                    <aside className={`ed-side ${panelOn('properties')}`} hidden={!isMobile && !mapMode}>
                        <PropertyInspector
                            blueprint={blueprint}
                            selection={selectionState}
                            setSelection={handleMapSelection}
                            updateNode={updateNode}
                            updateEdge={updateEdge}
                            updateNPC={updateNPC}
                            updateObjective={updateObjective}
                            setBlueprint={setBlueprint}
                            onDeleteSelection={handleDeleteSelection}
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
                    </aside>
                </div>

                <nav className="ed-mtabs">
                    {MOBILE_TABS.map(([tab, labelKey]) => (
                        <button key={tab} type="button" className={`${mobileTab === tab ? 'on' : ''} ${tab === 'properties' && selectionState ? 'dot' : ''}`} onClick={() => setMobileTab(tab)}>
                            {t(labelKey)}
                        </button>
                    ))}
                </nav>

                {modal && modal.isOpen && (
                    <div className="modal-back">
                        <div className="modal" role="dialog" aria-label={modal.title}>
                            <h3>{modal.title}</h3>
                            <div className="modal-body">{modal.content}</div>
                            <div className="modal-foot">
                                <GameButton size="sm" onClick={closeModal}>{t('map_editor.btn_close')}</GameButton>
                                {modal.extraAction && <GameButton size="sm" onClick={modal.extraAction.onClick}>{t(modal.extraAction.labelKey)}</GameButton>}
                                {modal.onConfirm && (
                                    <GameButton size="sm" variant="primary" onClick={modal.onConfirm}>
                                        {t(modal.title === t('map_editor.import') ? 'map_editor.btn_import' : 'map_editor.btn_copy')}
                                    </GameButton>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {showNewMapConfirm && (
                    <ConfirmDialog
                        title={t('map_editor.new_map_confirm_title')}
                        message={t('map_editor.new_map_confirm_msg')}
                        confirmLabel={t('common.confirm')}
                        cancelLabel={t('common.cancel')}
                        onCancel={() => setShowNewMapConfirm(false)}
                        onConfirm={confirmNewMap}
                    />
                )}
                {showResetConfirm && (
                    <ConfirmDialog
                        title={t('map_editor.reset_title')}
                        message={t('map_editor.reset_confirm_msg')}
                        confirmLabel={t('map_editor.btn_reset_confirm')}
                        cancelLabel={t('common.cancel')}
                        onCancel={() => setShowResetConfirm(false)}
                        onConfirm={confirmReset}
                    />
                )}

                {lightboxImage && (
                    <div className="ed-lightbox" onClick={() => setLightboxImage(null)}>
                        <img src={lightboxImage} alt="" />
                    </div>
                )}
            </section>
        </div>
    );
};

export default StoryEditor;
