import React, { useState } from 'react';
import { GameState, GameStatus } from '../types';
import { useTranslation } from '../utils/i18n';
import EditorCanvas from './editor/EditorCanvas';
import { initializeGameChatStream, extractStability, extractVisualPrompt, generateImage } from '../services/aiService';
import { loadGlobalSettings } from '../services/indexedDBService';
import { setEditingBlueprintCache } from '../services/blueprintCache';
import { applyLayoutToBlueprint } from '../utils/mapLayout';

interface TacticalPreviewProps {
    gameState: GameState;
    setGameState: React.Dispatch<React.SetStateAction<GameState>>;
}

const TacticalPreview: React.FC<TacticalPreviewProps> = ({ gameState, setGameState }) => {
    const { t, language } = useTranslation();
    const [selection, setSelection] = useState<{ type: 'node' | 'edge' | 'npc' | 'objective', id: string } | null>(null);
    const [isStarting, setIsStarting] = useState(false);
    const [loadingText, setLoadingText] = useState('');

    const rawBlueprint = gameState.scpData?.mapBlueprint;

    const blueprint = React.useMemo(() => {
        if (!rawBlueprint) return null;
        return applyLayoutToBlueprint(rawBlueprint, { width: 720, height: 420, paddingX: 60, paddingY: 50 });
    }, [rawBlueprint]);

    const handleEdit = () => {
        if (blueprint) {
            setEditingBlueprintCache(blueprint);
        }
        setGameState(prev => ({
            ...prev,
            status: GameStatus.MAP_EDITOR
        }));
    };

    const handleBack = () => {
        setGameState(prev => ({ ...prev, status: GameStatus.IDLE, scpData: null }));
    };

    const handleStartWeave = async () => {
        if (!gameState.scpData) return;
        
        setIsStarting(true);
        setLoadingText(t('start.loading_msgs')[0]);

        try {
            const settings = await loadGlobalSettings();
            const difficulty = settings.difficulty || 'normal';
            
            const finalBlueprint = gameState.scpData.mapBlueprint;
            
            // Update scpData with final blueprint
            const finalScpData = {
                ...gameState.scpData,
                mapBlueprint: finalBlueprint
            };

            const stream = initializeGameChatStream(finalScpData, gameState.role, language, gameState.legacy, difficulty);
            const msgId = 'intro';
            let fullText = "";
            let isFirstChunk = true;

            // Prepare initial state
            const initialMap = finalBlueprint ? {
                id: finalBlueprint.id,
                title: finalBlueprint.title,
                currentNodeId: finalBlueprint.startNodeId,
                discoveredNodeIds: [finalBlueprint.startNodeId]
            } : undefined;

            const initialNpcs = finalBlueprint ? finalBlueprint.npcs.map(npc => ({
                id: npc.id,
                name: npc.name,
                archetype: npc.archetype,
                nodeId: npc.initialNodeId,
                alive: true,
                secretTags: npc.secretTags,
                dialogueGoals: npc.dialogueGoals
            })) : undefined;

            const initialObjectives = finalBlueprint ? finalBlueprint.objectives.map(obj => ({
                id: obj.id,
                title: obj.title,
                type: obj.type,
                nodeId: obj.nodeId,
                status: 'ACTIVE' as const,
                progress: typeof obj.progress === 'number' ? obj.progress : 0,
                detail: obj.detail,
                reward: obj.reward
            })) : undefined;

            for await (const chunk of stream) {
                fullText += chunk;
                
                if (isFirstChunk) {
                    setGameState(prev => ({
                        ...prev,
                        status: GameStatus.PLAYING,
                        scpData: finalScpData,
                        stability: 100,
                        turnCount: 0,
                        map: initialMap,
                        npcs: initialNpcs,
                        objectives: initialObjectives,
                        inventory: [],
                        messages: [{
                            id: msgId,
                            sender: 'narrator',
                            content: fullText,
                            timestamp: Date.now(),
                            isTyping: true
                        }]
                    }));
                    isFirstChunk = false;
                } else {
                     setGameState(prev => ({
                        ...prev,
                        messages: prev.messages.map(m => 
                            m.id === msgId ? { ...m, content: fullText } : m
                        )
                     }));
                }
            }

            // Post-process
            const stabilityResult = extractStability(fullText);
            const introStability = stabilityResult.newStability ?? 100;
            const { cleanText, visualPrompt } = extractVisualPrompt(stabilityResult.cleanText);

            setGameState(prev => ({
                ...prev,
                messages: prev.messages.map(m => 
                    m.id === msgId ? { 
                        ...m, 
                        content: cleanText, 
                        isTyping: false,
                        stabilitySnapshot: introStability 
                    } : m
                )
            }));

            if (visualPrompt && settings.enableSceneImages) {
                generateImage(visualPrompt, "16:9").then(introImageUrl => {
                    if (introImageUrl) {
                        setGameState(prev => ({
                            ...prev,
                            messages: prev.messages.map(m => 
                                m.id === msgId ? { ...m, imageUrl: introImageUrl } : m
                            )
                        }));
                    }
                });
            }

        } catch (e) {
            console.error(e);
            alert(t('start.error_conn'));
            setIsStarting(false);
        }
    };

    if (!blueprint) return <div>No Blueprint Available</div>;

    return (
        <div className="w-full h-full flex flex-col bg-[#0a0a0a] text-scp-text relative overflow-hidden">
            {/* Header */}
            <div className="h-16 border-b border-scp-term/30 flex items-center justify-between px-6 bg-scp-dark/90 backdrop-blur shrink-0 z-10">
                <div className="flex items-center gap-4">
                     <div className="w-2 h-2 bg-scp-term animate-pulse"></div>
                     <h1 className="text-xl font-mono font-bold tracking-widest text-scp-term">{t('editor.tactical_preview')}</h1>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Info Panel */}
                <div className="w-80 border-r border-scp-term/30 bg-black/40 p-6 overflow-y-auto hidden md:block">
                    <div className="space-y-6">
                        <div>
                            <label className="text-xs text-scp-term/50 uppercase font-mono block mb-1">Target</label>
                            <div className="text-2xl font-report font-bold text-scp-text">{gameState.scpData?.designation}</div>
                        </div>
                        <div>
                            <label className="text-xs text-scp-term/50 uppercase font-mono block mb-1">Operational Area</label>
                            <div className="text-sm font-mono text-scp-text/80">{blueprint.title}</div>
                        </div>
                        
                        <div className="p-4 border border-scp-term/30 bg-scp-term/5 text-xs font-mono text-scp-text/80 leading-relaxed">
                            {t('editor.preview_hint')}
                        </div>

                        <div className="space-y-2">
                             <div className="flex justify-between text-xs border-b border-scp-gray/20 pb-1">
                                <span>Nodes</span>
                                <span className="font-bold">{blueprint.nodes.length}</span>
                             </div>
                             <div className="flex justify-between text-xs border-b border-scp-gray/20 pb-1">
                                <span>Entities</span>
                                <span className="font-bold">{blueprint.npcs.length}</span>
                             </div>
                             <div className="flex justify-between text-xs border-b border-scp-gray/20 pb-1">
                                <span>Objectives</span>
                                <span className="font-bold">{blueprint.objectives.length}</span>
                             </div>
                        </div>
                    </div>
                </div>

                {/* Preview Canvas */}
                <div className="flex-1 relative bg-grid-pattern">
                    <EditorCanvas 
                        blueprint={blueprint}
                        selection={selection}
                        setSelection={setSelection}
                        updateNode={() => {}} // Read-only
                        // addNode is deliberately undefined to hide the button
                        addEdge={() => {}}    // Read-only
                        onDeleteSelection={() => {}} // Read-only
                    />
                    
                    {/* Overlay Actions */}
                    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-4 z-20 w-full max-w-2xl px-4 justify-center">
                        <button 
                            onClick={handleBack}
                            disabled={isStarting}
                            className="px-6 py-3 bg-black/60 border border-scp-gray text-gray-400 hover:text-white hover:border-white font-mono text-sm tracking-wider transition-all backdrop-blur"
                        >
                            {t('common.cancel')}
                        </button>
                        
                        <button 
                            onClick={handleEdit}
                            disabled={isStarting}
                            className="px-6 py-3 bg-scp-term/10 border border-scp-term text-scp-term hover:bg-scp-term/20 font-mono text-sm tracking-wider transition-all backdrop-blur"
                        >
                            {t('editor.btn_edit_blueprint')}
                        </button>

                        <button 
                            onClick={handleStartWeave}
                            disabled={isStarting}
                            className="px-8 py-3 bg-scp-accent hover:bg-red-600 text-white font-bold font-report text-lg tracking-widest shadow-[0_0_15px_rgba(195,46,46,0.4)] hover:shadow-[0_0_25px_rgba(195,46,46,0.6)] transition-all border border-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isStarting ? (
                                <span className="flex items-center gap-2">
                                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                    CONNECTING...
                                </span>
                            ) : t('editor.btn_start_weave')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TacticalPreview;
