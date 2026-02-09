import React, { useState, useEffect, useMemo } from 'react';
import { GameState, GameStatus } from '../types';
import { useTranslation } from '../utils/i18n';
import EditorCanvas from './editor/EditorCanvas';
import { loadGlobalSettings, saveEditingSCPData, saveGlobalSettings } from '../services/indexedDBService';
import { setEditingStoryCache } from '../services/storyEditorCache';
import { applyLayoutToBlueprint } from '../utils/mapLayout';

interface TacticalPreviewProps {
    gameState: GameState;
    setGameState: React.Dispatch<React.SetStateAction<GameState>>;
}

const TacticalPreview: React.FC<TacticalPreviewProps> = ({ gameState, setGameState }) => {
    const { t, language } = useTranslation();
    const [selection, setSelection] = useState<{ type: 'node' | 'edge' | 'npc' | 'objective', id: string } | null>(null);
    const [isStarting, setIsStarting] = useState(false);
    
    // Check if returning from editor
    const isReturn = gameState.returnFromEditor;
    const [showIntro, setShowIntro] = useState(true);
    const [introStep, setIntroStep] = useState(0);
    
    // Countdown State
    const originalCountdown = isReturn ? 2000 : 5000;
    const [countdown, setCountdown] = useState(originalCountdown / 1000); 
    const [enterPrep, setEnterPrep] = useState(true);

    const rawBlueprint = gameState.scpData?.mapBlueprint;

    const blueprint = useMemo(() => {
        if (!rawBlueprint) return null;
        return applyLayoutToBlueprint(rawBlueprint, { width: 720, height: 420, paddingX: 60, paddingY: 50 });
    }, [rawBlueprint]);

    // Initialize enterPrep based on global settings
    useEffect(() => {
        const initSettings = async () => {
            const settings = await loadGlobalSettings();
            // If skipTacticalPrep is true, enterPrep should be false (auto-deploy)
            // If skipTacticalPrep is false (default), enterPrep should be true (enter prep)
            setEnterPrep(!settings.skipTacticalPrep);
        };
        initSettings();
    }, []);

    // Timer Logic
    useEffect(() => {
        if (!showIntro || countdown <= 0) return;
        const timer = setInterval(() => setCountdown(c => c - 1), 1000);
        return () => clearInterval(timer);
    }, [showIntro, countdown]);

    // Visual Steps based on mount
    useEffect(() => {
        if (!showIntro) return;
        const stepTimers: NodeJS.Timeout[] = [];
        stepTimers.push(setTimeout(() => setIntroStep(1), 800)); // Verifying...
        stepTimers.push(setTimeout(() => setIntroStep(2), 1500)); // Access Granted
        return () => stepTimers.forEach(clearTimeout);
    }, [showIntro]);

    // Handle Countdown Finish
    useEffect(() => {
        if (countdown === 0 && showIntro) {
            if (enterPrep) {
                // Fade out
                setIntroStep(3);
                setTimeout(() => setShowIntro(false), 800);
            } else {
                // Start Game
                handleStartWeave();
            }
        }
    }, [countdown, showIntro, enterPrep]);

    const handleEdit = async () => {
        if (gameState.scpData) {
            const dataToCache = {
                ...gameState.scpData,
                mapBlueprint: blueprint || gameState.scpData.mapBlueprint
            };
            
            await saveEditingSCPData(dataToCache);
            setEditingStoryCache(dataToCache);
        }

        setGameState(prev => ({
            ...prev,
            status: GameStatus.STORY_EDITOR
        }));
    };

    const handleBack = () => {
        setGameState(prev => ({ ...prev, status: GameStatus.IDLE, scpData: null }));
    };

    const handleStartWeave = async () => {
        if (!gameState.scpData || isStarting) return;
        
        setIsStarting(true);
        setGameState(prev => ({
            ...prev,
            status: GameStatus.ANALYZING,
            messages: [],
            stability: 100,
            turnCount: 0,
            endingType: null,
            returnFromEditor: false
        }));
    };

    const toggleEnterPrep = async (checked: boolean) => {
        setEnterPrep(checked);
        const settings = await loadGlobalSettings();
        await saveGlobalSettings({ ...settings, skipTacticalPrep: !checked });
    };

    const nodesCount = blueprint?.nodes.length ?? 0;
    const npcsCount = blueprint?.npcs.length ?? 0;
    const objectivesCount = blueprint?.objectives.length ?? 0;
    const primaryObjective = objectivesCount > 0 ? blueprint?.objectives[0]?.title : 'None';

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
                    <div className="w-full max-w-lg space-y-4 p-8 border-l-4 border-r-4 border-scp-alert bg-black/50 backdrop-blur-sm relative">
                        <div className="absolute top-2 right-4 font-mono text-xl text-scp-alert font-bold">
                            0{countdown}
                        </div>
                        
                        <div className="text-scp-alert font-report text-3xl font-bold tracking-[0.2em] text-center animate-pulse">
                            <span className="tp-glitch" data-text={t('map_editor.clearance_check')}>
                                {t('map_editor.clearance_check')}
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
                                        data-text={`> ${t('map_editor.access_granted')}`}
                                    >
                                        &gt; {t('map_editor.access_granted')}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Skip / Enter Toggle */}
                        {!isReturn && (
                             <div className="mt-6 pt-4 border-t border-gray-800 flex items-center justify-center gap-2">
                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <div className={`w-4 h-4 border border-scp-alert transition-all flex items-center justify-center ${enterPrep ? 'bg-scp-alert/20' : 'bg-transparent'}`}>
                                        {enterPrep && <div className="w-2 h-2 bg-scp-alert"></div>}
                                    </div>
                                    <input 
                                        type="checkbox" 
                                        className="hidden" 
                                        checked={enterPrep} 
                                        onChange={e => toggleEnterPrep(e.target.checked)} 
                                    />
                                    <span className="text-xs text-gray-400 group-hover:text-white font-mono tracking-wider transition-colors">
                                        {t('map_editor.enter_prep_checkbox') || "ENTER TACTICAL PREPARATION"}
                                    </span>
                                </label>
                             </div>
                        )}
                        
                        {!enterPrep && (
                             <div className="text-center text-[10px] text-scp-alert animate-pulse mt-2 uppercase tracking-widest">
                                 {t('map_editor.auto_deploy_msg') || "AUTO-DEPLOYMENT IMMINENT"}
                             </div>
                        )}

                    </div>
                </div>
            )}

            {/* Main Header */}
            <div className="h-14 border-b border-[var(--scp-border)] flex items-center justify-between px-6 bg-[var(--scp-surface)]/95 backdrop-blur shrink-0 z-10 shadow-lg">
                <div className="flex items-center gap-4">
                     <div className={`w-2 h-2 rounded-full ${isStarting ? 'bg-scp-alert animate-ping' : 'bg-scp-alert animate-pulse'}`}></div>
                     <h1 className="text-lg font-bold tracking-widest text-scp-text-dim flex items-center gap-2">
                        <span className="text-scp-alert">{t('map_editor.secure_terminal')}</span>
                        <span className="text-gray-600">//</span>
                        <span className="text-scp-alert">{t('map_editor.mission_brief')}</span>
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
                                    {t('map_editor.top_secret')}
                                </div>
                            </div>
                            <div className="text-2xl font-report text-scp-text mb-1">{gameState.scpData?.designation}</div>
                            <div className="text-xs text-scp-text-dim uppercase tracking-widest">{t('map_editor.eyes_only')}</div>
                        </div>

                        {/* Intel Summary */}
                        <div className="space-y-6">
                            <div className="scp-card p-4 rounded-sm border-l-2 border-l-scp-alert bg-[var(--scp-surface)]">
                                <label className="text-[10px] text-scp-alert uppercase font-bold tracking-wider block mb-2">{t('map_editor.intel_summary')}</label>
                                <div className="text-xs font-mono text-scp-text/90 leading-relaxed opacity-90">
                                    {t('map_editor.preview_hint')}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="scp-card p-3 bg-[var(--scp-surface)]">
                                    <div className="text-[10px] text-gray-500 uppercase mb-1">{t('map_editor.nodes')}</div>
                                    <div className="text-xl font-mono text-white">{nodesCount}</div>
                                </div>
                                <div className="scp-card p-3 bg-[var(--scp-surface)]">
                                    <div className="text-[10px] text-gray-500 uppercase mb-1">{t('map_editor.npcs')}</div>
                                    <div className="text-xl font-mono text-white">{npcsCount}</div>
                                </div>
                                <div className="scp-card p-3 bg-[var(--scp-surface)] col-span-2">
                                    <div className="text-[10px] text-gray-500 uppercase mb-1">{t('map_editor.objectives')}</div>
                                    <div className="text-sm font-mono text-white truncate">{primaryObjective}</div>
                                    {objectivesCount > 1 && <div className="text-[10px] text-gray-600 mt-1">+{objectivesCount - 1} more</div>}
                                </div>
                            </div>

                            <div className="mt-8 pt-4 border-t border-dashed border-gray-700">
                                <button 
                                    onClick={handleEdit}
                                    className="w-full py-3 bg-scp-accent/90 hover:bg-scp-accent text-white font-report tracking-widest border border-red-500 transition-all shadow-[0_0_15px_rgba(195,46,46,0.3)] hover:shadow-[0_0_25px_rgba(195,46,46,0.6)] flex items-center justify-center gap-2 group active:scale-[0.99]"
                                >
                                    <span>{t('map_editor.btn_edit_story')}</span>
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
                        {blueprint && (
                            <EditorCanvas 
                                blueprint={blueprint}
                                selection={selection}
                                setSelection={setSelection}
                                updateNode={() => {}}
                                addEdge={() => {}}
                                onDeleteSelection={() => {}}
                            />
                        )}
                    </div>
                    
                    <div className="border-t border-[var(--scp-border)] bg-[var(--scp-surface)]/90 backdrop-blur-sm p-6 flex items-center justify-between crt">
                        <div>
                            <button 
                                onClick={handleBack}
                                disabled={isStarting}
                                className="text-gray-300 hover:text-white hover:border-white border border-[var(--scp-border-strong)] transition-colors font-report font-bold text-xl tracking-[0.2em] flex items-center gap-2 px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                ← {t('common.back')}
                            </button>
                        </div>

                        <div className="flex items-center gap-6">
                            <div className="text-right hidden lg:block">
                                <div className="text-[10px] text-scp-alert uppercase tracking-widest mb-1 font-bold">Status: READY</div>
                                <div className="text-xs text-gray-500">{t('map_editor.awaiting_command')}</div>
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
                                            <span className="font-report font-bold text-xl tracking-[0.2em]">{t('map_editor.continue_game')}</span>
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
