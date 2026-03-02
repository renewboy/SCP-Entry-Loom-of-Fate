import React, { useState, useEffect, useRef } from 'react';
import { GameState, GameStatus, SCPData } from '../../types';
import { useTranslation } from '../../utils/i18n';
import EditorCanvas, { EditorCanvasRef } from './EditorCanvas';
import PropertyInspector from './PropertyInspector';
import StoryFormPanel from './StoryFormPanel';
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
import { useBlueprintEditor } from '../../hooks/storyEditor/useBlueprintEditor';
import { useStoryEditorModals } from '../../hooks/storyEditor/useStoryEditorModals';
import { useStoryImageManager } from '../../hooks/storyEditor/useStoryImageManager';
import { DEFAULT_BLUEPRINT, SCP173_TEMPLATE } from '../../constants/storyTemplates';

interface StoryEditorProps {
    gameState: GameState;
    setGameState: React.Dispatch<React.SetStateAction<GameState>>;
}

const StoryEditor: React.FC<StoryEditorProps> = ({ gameState, setGameState }) => {
    const { t } = useTranslation();
    const {
        blueprint,
        setBlueprint,
        undo,
        redo,
        canUndo,
        canRedo,
        selection,
        setSelection,
        updateNode,
        updateEdge,
        updateNPC,
        updateObjective,
        addNode,
        addEdge,
        addNPC,
        addObjective,
        handleDeleteSelection
    } = useBlueprintEditor(DEFAULT_BLUEPRINT);

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

    const [isStarting, setIsStarting] = useState(false);
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
        if (activeTab !== 'MAP') {
            setActiveTab('MAP');
        }
        setSelection(next);
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
            setPromptsFromData(sourceData);
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

            {/* Main Area */}
            <div className="flex-1 relative overflow-hidden">
                <div className="absolute inset-0 bg-[#050505] scp-ui crt pl-56 pr-80 box-border">
                    <div className="absolute inset-0 bg-grid-pattern opacity-10 pointer-events-none"></div>
                    <div className="relative w-full h-full">
                        <EditorCanvas 
                            ref={canvasRef}
                            blueprint={blueprint} 
                            selection={selection} 
                            setSelection={handleMapSelection} 
                            updateNode={updateNode}
                            addNode={addNode}
                            addEdge={addEdge}
                            onDeleteSelection={handleDeleteSelection}
                        />
                    </div>
                </div>

                <SidePanel side="left" className={`absolute top-0 bottom-0 w-56 ${panelContainerBase}`}>
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
                                        onClick={() => {
                                            handleMapSelection({ type: 'npc', id: npc.id });
                                        }}
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
                                        onClick={() => {
                                            handleMapSelection({ type: 'objective', id: obj.id });
                                        }}
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
                                selection={selection}
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
                            />
                        ) : (
                            <StoryFormPanel
                                t={t}
                                scpData={scpData}
                                setScpData={setScpData}
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
            </div>
        </div>
    );
};

export default StoryEditor;
