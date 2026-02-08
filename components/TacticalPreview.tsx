import React, { useState, useEffect } from 'react';
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
    const [showIntro, setShowIntro] = useState(true);
    const [introStep, setIntroStep] = useState(0);

    const rawBlueprint = gameState.scpData?.mapBlueprint;

    const blueprint = React.useMemo(() => {
        if (!rawBlueprint) return null;
        return applyLayoutToBlueprint(rawBlueprint, { width: 720, height: 420, paddingX: 60, paddingY: 50 });
    }, [rawBlueprint]);

    // Intro Animation Sequence
    useEffect(() => {
        if (!showIntro) return;

        const timers: NodeJS.Timeout[] = [];
        
        timers.push(setTimeout(() => setIntroStep(1), 800)); // Verifying...
        timers.push(setTimeout(() => setIntroStep(2), 2000)); // Access Granted
        timers.push(setTimeout(() => setIntroStep(3), 3000)); // Fade out
        timers.push(setTimeout(() => setShowIntro(false), 3800)); // Remove

        return () => timers.forEach(clearTimeout);
    }, [showIntro]);

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
        <div className="w-full h-full flex flex-col bg-[var(--scp-bg)] text-[var(--scp-text)] relative overflow-hidden font-mono scp-ui crt">
            <style>
                {`
                @keyframes tp-glitch-shift {
                    0% { transform: translate(0, 0); opacity: 0.4; }
                    20% { transform: translate(-1px, -1px); opacity: 0.6; }
                    40% { transform: translate(1px, 1px); opacity: 0.35; }
                    60% { transform: translate(-2px, 0); opacity: 0.55; }
                    80% { transform: translate(2px, -1px); opacity: 0.3; }
                    100% { transform: translate(0, 0); opacity: 0.4; }
                }
                @keyframes tp-glitch-slice {
                    0% { clip-path: inset(0 0 0 0); }
                    25% { clip-path: inset(10% 0 60% 0); }
                    50% { clip-path: inset(40% 0 30% 0); }
                    75% { clip-path: inset(65% 0 10% 0); }
                    100% { clip-path: inset(0 0 0 0); }
                }
                @keyframes tp-wave {
                    0% { transform: translateY(0); }
                    50% { transform: translateY(-2px); }
                    100% { transform: translateY(0); }
                }
                .tp-glitch-shell {
                    position: relative;
                    animation: tp-glitch-shift 1.4s steps(2, end) infinite;
                    box-shadow: 0 0 24px rgba(255, 64, 64, 0.2);
                }
                .tp-glitch {
                    position: relative;
                    display: inline-block;
                    animation: tp-wave 1.6s ease-in-out infinite;
                    text-shadow: 0 0 6px rgba(255, 64, 64, 0.25);
                }
                .tp-glitch::before,
                .tp-glitch::after {
                    content: attr(data-text);
                    position: absolute;
                    inset: 0;
                    pointer-events: none;
                }
                .tp-glitch::before {
                    color: rgba(255, 64, 64, 0.7);
                    animation: tp-glitch-shift 1.1s steps(2, end) infinite, tp-glitch-slice 2.2s steps(3, end) infinite;
                }
                .tp-glitch::after {
                    color: rgba(64, 255, 255, 0.7);
                    animation: tp-glitch-shift 0.9s steps(2, end) infinite reverse, tp-glitch-slice 1.8s steps(3, end) infinite reverse;
                }
                @media (prefers-reduced-motion: reduce) {
                    .tp-glitch,
                    .tp-glitch-shell,
                    .tp-glitch::before,
                    .tp-glitch::after {
                        animation: none;
                    }
                }
            `}
            </style>
            {/* Transition Overlay */}
            {showIntro && (
                <div className={`absolute inset-0 z-50 flex flex-col items-center justify-center bg-black transition-opacity duration-700 ${introStep >= 3 ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                    <div className="w-full max-w-lg space-y-4 p-8 border-l-4 border-r-4 border-scp-alert bg-black/50 backdrop-blur-sm">
                        <div className="text-scp-alert font-report text-3xl font-bold tracking-[0.2em] text-center animate-pulse">
                            <span className="tp-glitch" data-text={t('editor.clearance_check')}>
                                {t('editor.clearance_check')}
                            </span>
                        </div>
                        
                        <div className="h-2 w-full bg-gray-900 overflow-hidden relative border border-gray-800">
                            <div className={`h-full bg-scp-alert transition-all duration-1000 ease-out ${introStep >= 1 ? 'w-full' : 'w-0'}`}></div>
                        </div>

                        <div className="space-y-1 text-xs text-scp-alert/70 font-mono text-center h-8">
                            {introStep >= 1 && (
                                <div>
                                    <span className="tp-glitch" data-text="> IDENTITY VERIFIED">&gt; IDENTITY VERIFIED</span>
                                </div>
                            )}
                            {introStep >= 2 && (
                                <div className="text-white font-bold">
                                    <span
                                        className="tp-glitch"
                                        data-text={`> ${t('editor.access_granted')}`}
                                    >
                                        &gt; {t('editor.access_granted')}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Main Header */}
            <div className="h-14 border-b border-[var(--scp-border)] flex items-center justify-between px-6 bg-[var(--scp-surface)]/95 backdrop-blur shrink-0 z-10 shadow-lg">
                <div className="flex items-center gap-4">
                     <div className={`w-2 h-2 rounded-full ${isStarting ? 'bg-scp-alert animate-ping' : 'bg-scp-alert animate-pulse'}`}></div>
                     <h1 className="text-lg font-bold tracking-widest text-scp-text-dim flex items-center gap-2">
                        <span className="text-scp-alert">{t('editor.secure_terminal')}</span>
                        <span className="text-gray-600">//</span>
                        <span className="text-scp-alert">{t('editor.mission_brief')}</span>
                     </h1>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden relative">
                {/* Left Panel: Mission Dossier */}
                <div className="w-96 border-r border-[var(--scp-border)] bg-[var(--scp-surface-light)]/80 backdrop-blur-md flex flex-col relative z-20 shadow-xl crt">
                    <div className="p-1 bg-stripes-gray opacity-10 h-2 w-full"></div>
                    
                    <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
                        {/* Dossier Header */}
                        <div className="mb-8 border-b-2 border-scp-text-dim/20 pb-4">
                            <div className="flex justify-between items-start mb-2">
                                <div className="text-4xl font-report font-bold text-white tracking-tighter">SCP</div>
                                <div className="border border-scp-alert text-scp-alert text-[12px] px-2 py-0.5 font-bold tracking-widest uppercase">
                                    {t('editor.top_secret')}
                                </div>
                            </div>
                            <div className="text-2xl font-report text-scp-text mb-1">{gameState.scpData?.designation}</div>
                            <div className="text-xs text-scp-text-dim uppercase tracking-widest">{t('editor.eyes_only')}</div>
                        </div>

                        {/* Intel Summary */}
                        <div className="space-y-6">
                            <div className="scp-card p-4 rounded-sm border-l-2 border-l-scp-alert bg-[var(--scp-surface)]">
                                <label className="text-[10px] text-scp-alert uppercase font-bold tracking-wider block mb-2">{t('editor.intel_summary')}</label>
                                <div className="text-xs font-mono text-scp-text/90 leading-relaxed opacity-90">
                                    {t('editor.preview_hint')}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="scp-card p-3 bg-[var(--scp-surface)]">
                                    <div className="text-[10px] text-gray-500 uppercase mb-1">{t('editor.nodes')}</div>
                                    <div className="text-xl font-mono text-white">{blueprint.nodes.length}</div>
                                </div>
                                <div className="scp-card p-3 bg-[var(--scp-surface)]">
                                    <div className="text-[10px] text-gray-500 uppercase mb-1">{t('editor.npcs')}</div>
                                    <div className="text-xl font-mono text-white">{blueprint.npcs.length}</div>
                                </div>
                                <div className="scp-card p-3 bg-[var(--scp-surface)] col-span-2">
                                    <div className="text-[10px] text-gray-500 uppercase mb-1">{t('editor.objectives')}</div>
                                    <div className="text-sm font-mono text-white truncate">{blueprint.objectives.length > 0 ? blueprint.objectives[0].title : 'None'}</div>
                                    {blueprint.objectives.length > 1 && <div className="text-[10px] text-gray-600 mt-1">+{blueprint.objectives.length - 1} more</div>}
                                </div>
                            </div>

                            <div className="mt-8 pt-4 border-t border-dashed border-gray-700">
                                <button 
                                    onClick={handleEdit}
                                    className="w-full py-3 border border-dashed border-gray-600 text-gray-400 hover:text-white hover:border-white hover:bg-white/5 transition-all text-xs font-mono tracking-wider flex items-center justify-center gap-2 group"
                                >
                                    <span>{t('editor.btn_edit_blueprint')}</span>
                                    <span className="group-hover:translate-x-1 transition-transform">→</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Footer Stamps */}
                    <div className="p-4 border-t border-[var(--scp-border)] opacity-70 pointer-events-none absolute bottom-0 w-full">
                        <div className="text-[10px] text-center font-report text-scp-alert rotate-[-5deg] border-2 border-scp-alert bg-red-500/10 inline-block px-2 py-1 absolute bottom-8 right-8">
                            VERIFIED
                        </div>
                    </div>
                </div>

                {/* Preview Canvas */}
                <div className="flex-1 flex flex-col bg-[#050505]">
                    <div className="flex-1 relative crt">
                        <div className="absolute inset-0 bg-grid-pattern opacity-20 pointer-events-none"></div>
                        <EditorCanvas 
                            blueprint={blueprint}
                            selection={selection}
                            setSelection={setSelection}
                            updateNode={() => {}} // Read-only
                            addEdge={() => {}}    // Read-only
                            onDeleteSelection={() => {}} // Read-only
                        />
                    </div>
                    
                    <div className="border-t border-[var(--scp-border)] bg-[var(--scp-surface)]/90 backdrop-blur-sm p-6 flex items-center justify-between crt">
                        <div>
                            <button 
                                onClick={handleBack}
                                className="text-gray-300 hover:text-white hover:border-white border border-[var(--scp-border-strong)] transition-colors font-report font-bold text-xl tracking-[0.2em] flex items-center gap-2 px-4 py-2"
                            >
                                ← {t('common.back')}
                            </button>
                        </div>

                        <div className="flex items-center gap-6">
                            <div className="text-right hidden lg:block">
                                <div className="text-[10px] text-scp-alert uppercase tracking-widest mb-1 font-bold">Status: READY</div>
                                <div className="text-xs text-gray-500">{t('editor.awaiting_command')}</div>
                            </div>
                            
                            <button 
                                onClick={handleStartWeave}
                                disabled={isStarting}
                                className="px-10 py-4 bg-scp-accent/90 hover:bg-scp-accent text-white font-report text-xl tracking-widest border border-red-500 transition-all shadow-[0_0_15px_rgba(195,46,46,0.3)] hover:shadow-[0_0_25px_rgba(195,46,46,0.6)] disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99]"
                            >
                                <div className="flex items-center gap-3 justify-center">
                                    {isStarting ? (
                                        <>
                                            <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
                                            <span className="font-bold tracking-widest">{t('start.loading_msgs')[0]}</span>
                                        </>
                                    ) : (
                                        <>
                                            <span className="font-report font-bold text-xl tracking-[0.2em]">{t('editor.continue_game')}</span>
                                            <span className="text-xs opacity-70">&gt;&gt;&gt;</span>
                                        </>
                                    )}
                                </div>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TacticalPreview;
