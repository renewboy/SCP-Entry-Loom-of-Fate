import React, { useEffect, useRef, useState } from 'react';
import { GameState, GameStatus } from '../types';
import { useTranslation } from '../utils/i18n';
import { loadGlobalSettings, saveEditingSCPData, saveGlobalSettings } from '../services/indexedDBService';
import { setEditingStoryCache } from '../services/storyEditorCache';
import TransitionOverlay from './common/TransitionOverlay';
import TacticalBriefing from './tactical/TacticalBriefing';

interface TacticalPreviewProps {
    gameState: GameState;
    setGameState: React.Dispatch<React.SetStateAction<GameState>>;
}

const TacticalPreview: React.FC<TacticalPreviewProps> = ({ gameState, setGameState }) => {
    const { t } = useTranslation();
    const [isStarting, setIsStarting] = useState(false);
    const isStartingRef = useRef(false);

    // Check if returning from editor
    const isReturn = gameState.returnFromEditor;
    const [showIntro, setShowIntro] = useState(true);

    // Countdown State
    const [enterPrep, setEnterPrep] = useState(true);

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
            await saveEditingSCPData(gameState.scpData);
            setEditingStoryCache(gameState.scpData);
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
        if (!gameState.scpData || isStarting || isStartingRef.current) return;

        isStartingRef.current = true;
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

    return (
        <div className="w-full h-full relative overflow-hidden">
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

            <TacticalBriefing
                gameState={gameState}
                ready={!showIntro}
                isStarting={isStarting}
                onBack={handleBack}
                onEdit={handleEdit}
                onStart={handleStartWeave}
            />
        </div>
    );
};

export default TacticalPreview;
