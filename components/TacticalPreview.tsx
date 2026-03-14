import React, { useState, useEffect, useMemo } from 'react';
import { GameState, GameStatus } from '../types';
import { useTranslation } from '../utils/i18n';
import { useViewport } from '../hooks/useViewport';
import EditorCanvas from './editor/EditorCanvas';
import { loadGlobalSettings, saveEditingSCPData, saveGlobalSettings } from '../services/indexedDBService';
import { setEditingStoryCache } from '../services/storyEditorCache';
import { applyLayoutToBlueprint } from '../utils/mapLayout';
import TransitionOverlay from './common/TransitionOverlay';

interface TacticalPreviewProps {
    gameState: GameState;
    setGameState: React.Dispatch<React.SetStateAction<GameState>>;
}

const TacticalPreview: React.FC<TacticalPreviewProps> = ({ gameState, setGameState }) => {
    const { t, language } = useTranslation();
    const { isMobile, width } = useViewport();
    const [selection, setSelection] = useState<{ type: 'node' | 'edge' | 'npc' | 'objective', id: string } | null>(null);
    const [isStarting, setIsStarting] = useState(false);
    
    // Check if returning from editor
    const isReturn = gameState.returnFromEditor;
    const [showIntro, setShowIntro] = useState(true);
    
    // Countdown State
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
            setEnterPrep(!settings.skipTacticalPrep);
        };
        initSettings();
    }, []);

    const handleTransitionComplete = () => {
        if (enterPrep) {
            setShowIntro(false);
        } else {
            handleStartWeave();
        }
    };

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

    /* ==================== Shared render helpers ==================== */

    /** Intel stats grid — identical on mobile & desktop */
    const renderIntelStats = () => (
        <>
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
        </>
    );

    /** Map canvas with grid background — identical on mobile & desktop */
    const renderMapCanvas = () => (
        <>
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
        </>
    );

    /** Dossier header — diff: title size, spacing */
    const renderDossierHeader = (compact: boolean) => (
        <div className={`${compact ? 'mb-4 pb-3' : 'mb-8 pb-4'} border-b-2 border-scp-text-dim/20`}>
            <div className="flex justify-between items-start mb-2">
                <div className={`${compact ? 'text-2xl' : 'text-4xl'} font-report font-bold text-white tracking-tighter`}>SCP</div>
                <div className="border border-scp-alert text-scp-alert text-[12px] px-2 py-0.5 font-bold tracking-widest uppercase">
                    {t('map_editor.top_secret')}
                </div>
            </div>
            <div className={`${compact ? 'text-lg' : 'text-2xl'} font-report text-scp-text mb-1`}>{gameState.scpData?.designation}</div>
            <div className="text-xs text-scp-text-dim uppercase tracking-widest">{t('map_editor.eyes_only')}</div>
        </div>
    );

    return (
        <div className="w-full h-full flex flex-col bg-[var(--scp-bg)] text-[var(--scp-text)] relative overflow-hidden font-mono scp-ui crt">
            {/* Transition Overlay */}
            <TransitionOverlay
                isVisible={showIntro}
                onComplete={handleTransitionComplete}
                allowSkip={!isReturn}
                title={t('map_editor.clearance_check')}
                steps={[
                    { text: "IDENTITY VERIFIED", delay: 800 },
                    { text: t('map_editor.access_granted'), delay: 1500 }
                ]}
                countdownDuration={isReturn ? 2 : 5}
            >
                {!isReturn && (
                    <div className="flex items-center justify-center gap-2">
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
            </TransitionOverlay>

            {/* Main Header */}
            <div className="h-14 border-b border-[var(--scp-border)] flex items-center justify-between px-3 md:px-6 bg-[var(--scp-surface)]/95 backdrop-blur shrink-0 z-10 shadow-lg">
                <div className="flex items-center gap-4">
                     <div className={`w-2 h-2 rounded-full ${isStarting ? 'bg-scp-alert animate-ping' : 'bg-scp-alert animate-pulse'}`}></div>
                     <h1 className={`${isMobile ? 'text-sm' : 'text-lg'} font-bold tracking-widest text-scp-text-dim flex items-center gap-2`}>
                        <span className="text-scp-alert">{t('map_editor.secure_terminal')}</span>
                        {!isMobile && (
                            <>
                                <span className="text-gray-600">//</span>
                                <span className="text-scp-alert">{t('map_editor.mission_brief')}</span>
                            </>
                        )}
                     </h1>
                </div>
            </div>

            {isMobile ? (
                /* Mobile: Vertical stacked layout, scrollable */
                <div className="flex-1 flex flex-col overflow-y-auto relative">
                    {/* Background grid */}
                    <div className="absolute inset-0 bg-grid-pattern opacity-20 pointer-events-none"></div>

                    {/* Mission info area - full width */}
                    <div className="border-b border-[var(--scp-border)] bg-[var(--scp-surface-light)]/80 flex flex-col relative z-20 crt">
                        <div className="p-1 bg-stripes-gray opacity-10 h-2 w-full"></div>
                        <div className="p-4 space-y-4">
                            {renderDossierHeader(true)}
                            <div className="space-y-4">
                                {renderIntelStats()}
                            </div>
                        </div>
                    </div>

                    {/* Map canvas area - full width, proportional */}
                    <div className="flex-1 min-h-[250px] relative bg-[#050505] crt">
                        {renderMapCanvas()}
                    </div>
                </div>
            ) : (
                /* Desktop: Original side-by-side dual-panel layout */
                <div className="flex-1 flex overflow-hidden relative">
                    {/* Left Panel: Mission Dossier */}
                    <div className="w-96 border-r border-[var(--scp-border)] bg-[var(--scp-surface-light)]/80 backdrop-blur-md flex flex-col relative z-20 shadow-xl crt">
                        <div className="p-1 bg-stripes-gray opacity-10 h-2 w-full"></div>
                        
                        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
                            {renderDossierHeader(false)}

                            {/* Intel Summary */}
                            <div className="space-y-6">
                                {renderIntelStats()}

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
                            {renderMapCanvas()}
                        </div>
                    </div>
                </div>
            )}

            {/* Bottom Action Bar */}
            <div className={`border-t border-[var(--scp-border)] bg-[var(--scp-surface)]/90 backdrop-blur-sm ${isMobile ? 'p-3' : 'p-6'} flex items-center justify-between crt`}>
                <div>
                    <button 
                        onClick={handleBack}
                        disabled={isStarting}
                        className={`text-gray-300 hover:text-white hover:border-white border border-[var(--scp-border-strong)] transition-colors font-report font-bold ${isMobile ? 'text-sm tracking-wider px-3 py-2' : 'text-xl tracking-[0.2em] px-4 py-2'} flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                        ← {t('common.back')}
                    </button>
                </div>

                <div className="flex items-center gap-3 md:gap-6">
                    {/* Mobile: Edit button (since it's removed from the panel) */}
                    {isMobile && (
                        <button 
                            onClick={handleEdit}
                            className="px-5 py-3 bg-scp-accent/90 hover:bg-scp-accent text-white font-report tracking-widest border border-red-500 transition-all shadow-[0_0_15px_rgba(195,46,46,0.3)] hover:shadow-[0_0_25px_rgba(195,46,46,0.6)] flex items-center justify-center gap-2 group active:scale-[0.99] min-h-[44px]"
                        >
                            <span>{t('map_editor.btn_edit_story')}</span>
                            <span className="group-hover:translate-x-1 transition-transform">→</span>
                        </button>
                    )}
                    <div className="text-right hidden lg:block">
                        <div className="text-[10px] text-scp-alert uppercase tracking-widest mb-1 font-bold">Status: READY</div>
                        <div className="text-xs text-gray-500">{t('map_editor.awaiting_command')}</div>
                    </div>
                    
                    <button 
                        onClick={handleStartWeave}
                        disabled={isStarting}
                        className={`bg-scp-accent/90 hover:bg-scp-accent text-white font-report tracking-widest border border-red-500 transition-all shadow-[0_0_15px_rgba(195,46,46,0.3)] hover:shadow-[0_0_25px_rgba(195,46,46,0.6)] disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99] ${isMobile ? 'px-6 py-3 text-base min-h-[44px]' : 'px-10 py-4 text-xl'}`}
                    >
                        <div className="flex items-center gap-3 justify-center">
                            {isStarting ? (
                                <>
                                    <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
                                    <span className="font-bold tracking-widest">{t('start.loading_msgs')[0]}</span>
                                </>
                            ) : (
                                <>
                                    <span className={`font-report font-bold ${isMobile ? 'text-base' : 'text-xl'} tracking-[0.2em]`}>{t('map_editor.continue_game')}</span>
                                    <span className="text-xs opacity-70">&gt;&gt;&gt;</span>
                                </>
                            )}
                        </div>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TacticalPreview;
