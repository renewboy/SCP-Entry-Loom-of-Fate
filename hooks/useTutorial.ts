import { useState, useEffect, useCallback } from 'react';
import { loadSetting, saveSetting } from '../services/indexedDBService';

export function useTutorial(turnCount: number): {
    isTutorialOpen: boolean;
    closeTutorial: () => void;
} {
    const [isTutorialOpen, setIsTutorialOpen] = useState(false);

    useEffect(() => {
        const checkTutorial = async () => {
            if (turnCount <= 1) {
                const hasSeenTutorial = await loadSetting('hasSeenTutorial');
                if (!hasSeenTutorial) {
                    setIsTutorialOpen(true);
                    await saveSetting('hasSeenTutorial', true);
                }
            }
        };
        checkTutorial();
    }, [turnCount]);

    const closeTutorial = useCallback(() => {
        setIsTutorialOpen(false);
    }, []);

    return {
        isTutorialOpen,
        closeTutorial
    };
}
