import { useState, useEffect, useCallback } from 'react';
import { GameState, GameStatus } from '../types';

interface UseGameOverCountdownReturn {
    countdown: number | null;
    isActive: boolean;
    cancel: () => void;
    isCollapsed: boolean;
    setIsCollapsed: (collapsed: boolean) => void;
}

export function useGameOverCountdown(
    gameState: GameState,
    setGameState: React.Dispatch<React.SetStateAction<GameState>>
): UseGameOverCountdownReturn {
    const [countdown, setCountdown] = useState<number | null>(null);
    const [isActive, setIsActive] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);

    useEffect(() => {
        if (gameState.endingType && gameState.status === GameStatus.PLAYING && countdown === null) {
            setCountdown(10);
            setIsActive(true);
            setIsCollapsed(false);
        }
    }, [gameState.endingType, gameState.status, countdown]);

    useEffect(() => {
        if (isActive && countdown !== null) {
            if (countdown > 0) {
                const timer = setTimeout(() => setCountdown(prev => prev! - 1), 1000);
                return () => clearTimeout(timer);
            } else {
                setGameState(prev => ({ ...prev, status: GameStatus.GAME_OVER }));
            }
        }
    }, [isActive, countdown, setGameState]);

    const cancel = useCallback(() => {
        setIsActive(false);
    }, []);

    return {
        countdown,
        isActive,
        cancel,
        isCollapsed,
        setIsCollapsed
    };
}
