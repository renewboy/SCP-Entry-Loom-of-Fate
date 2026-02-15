import { useState, useCallback } from 'react';

export function useHistory<T>(initialState: T) {
    // Combine history and index into a single state object to ensure atomicity
    const [historyState, setHistoryState] = useState<{
        history: T[];
        index: number;
    }>({
        history: [initialState],
        index: 0
    });

    const { history, index } = historyState;
    
    // Ensure state is never undefined, fallback to initialState or the first item if index is wonky
    const state = history[index] !== undefined ? history[index] : initialState;

    const setState = useCallback((newState: T | ((prev: T) => T)) => {
        setHistoryState(prevState => {
            const { history: prevHistory, index: prevIndex } = prevState;
            const current = prevHistory[prevIndex];

            // Defensive check: if current is somehow undefined, abort update to prevent crash
            if (current === undefined) {
                console.error("[useHistory] Current state is undefined, aborting update.", { prevHistory, prevIndex });
                return prevState;
            }

            const next = typeof newState === 'function' 
                ? (newState as (prev: T) => T)(current) 
                : newState;
            
            // If state hasn't changed (deep comparison via JSON), don't add to history
            try {
                if (JSON.stringify(current) === JSON.stringify(next)) return prevState;
            } catch (e) {
                // Fallback for circular structures or other JSON errors
                if (current === next) return prevState;
            }

            const newHistory = prevHistory.slice(0, prevIndex + 1);
            return {
                history: [...newHistory, next],
                index: prevIndex + 1
            };
        });
    }, []);

    const undo = useCallback(() => {
        setHistoryState(prev => ({
            ...prev,
            index: Math.max(0, prev.index - 1)
        }));
    }, []);

    const redo = useCallback(() => {
        setHistoryState(prev => ({
            ...prev,
            index: Math.min(prev.history.length - 1, prev.index + 1)
        }));
    }, []);

    return {
        state,
        setState,
        undo,
        redo,
        canUndo: index > 0,
        canRedo: index < history.length - 1
    };
}
