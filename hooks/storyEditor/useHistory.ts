import { useState, useCallback, useEffect, useRef } from 'react';

interface HistoryOptions {
    onCommit?: () => void;
    mergeDelayMs?: number;
}

export function useHistory<T>(initialState: T, options?: HistoryOptions) {
    const [historyState, setHistoryState] = useState<{
        history: T[];
        index: number;
        present: T;
    }>({
        history: [initialState],
        index: 0,
        present: initialState
    });

    const { history, index, present } = historyState;
    const onCommit = options?.onCommit;
    const mergeDelayMs = options?.mergeDelayMs ?? 0;
    const pendingTimerRef = useRef<number | null>(null);
    const transactionDepthRef = useRef(0);

    const clearPendingTimer = useCallback(() => {
        if (pendingTimerRef.current !== null) {
            window.clearTimeout(pendingTimerRef.current);
            pendingTimerRef.current = null;
        }
    }, []);

    useEffect(() => {
        return () => {
            clearPendingTimer();
        };
    }, [clearPendingTimer]);

    const isSame = useCallback((a: T, b: T) => {
        try {
            return JSON.stringify(a) === JSON.stringify(b);
        } catch (e) {
            return a === b;
        }
    }, []);

    const commitNow = useCallback(() => {
        clearPendingTimer();
        setHistoryState(prevState => {
            const current = prevState.history[prevState.index];
            if (current === undefined) {
                return prevState;
            }
            if (isSame(current, prevState.present)) {
                return prevState;
            }
            const newHistory = prevState.history.slice(0, prevState.index + 1);
            onCommit?.();
            return {
                history: [...newHistory, prevState.present],
                index: prevState.index + 1,
                present: prevState.present
            };
        });
    }, [clearPendingTimer, isSame, onCommit]);

    const beginTransaction = useCallback(() => {
        clearPendingTimer();
        transactionDepthRef.current += 1;
    }, [clearPendingTimer]);

    const commitTransaction = useCallback(() => {
        if (transactionDepthRef.current === 0) return;
        transactionDepthRef.current -= 1;
        if (transactionDepthRef.current === 0) {
            commitNow();
        }
    }, [commitNow]);

    const setState = useCallback((newState: T | ((prev: T) => T), commitMode?: 'immediate' | 'deferred') => {
        setHistoryState(prevState => {
            const current = prevState.present;

            if (current === undefined) {
                return prevState;
            }

            const next = typeof newState === 'function' 
                ? (newState as (prev: T) => T)(current) 
                : newState;
            
            if (isSame(current, next)) return prevState;

            const nextState = {
                ...prevState,
                present: next
            };

            if (transactionDepthRef.current > 0) {
                return nextState;
            }

            const mode = commitMode ?? (mergeDelayMs > 0 ? 'deferred' : 'immediate');
            if (mode === 'deferred' && mergeDelayMs > 0) {
                clearPendingTimer();
                pendingTimerRef.current = window.setTimeout(() => {
                    commitNow();
                }, mergeDelayMs);
                return nextState;
            }

            const newHistory = prevState.history.slice(0, prevState.index + 1);
            onCommit?.();
            return {
                history: [...newHistory, next],
                index: prevState.index + 1,
                present: next
            };
        });
    }, [commitNow, clearPendingTimer, isSame, mergeDelayMs, onCommit]);

    const undo = useCallback(() => {
        clearPendingTimer();
        setHistoryState(prev => {
            let historyNext = prev.history;
            let indexNext = prev.index;
            if (!isSame(prev.present, prev.history[prev.index])) {
                historyNext = [...prev.history.slice(0, prev.index + 1), prev.present];
                indexNext = prev.index + 1;
                onCommit?.();
            }
            const nextIndex = Math.max(0, indexNext - 1);
            return {
                history: historyNext,
                index: nextIndex,
                present: historyNext[nextIndex] ?? prev.present
            };
        });
    }, [clearPendingTimer, isSame, onCommit]);

    const redo = useCallback(() => {
        clearPendingTimer();
        setHistoryState(prev => {
            let historyNext = prev.history;
            let indexNext = prev.index;
            if (!isSame(prev.present, prev.history[prev.index])) {
                historyNext = [...prev.history.slice(0, prev.index + 1), prev.present];
                indexNext = prev.index + 1;
                onCommit?.();
            }
            const nextIndex = Math.min(historyNext.length - 1, indexNext + 1);
            return {
                history: historyNext,
                index: nextIndex,
                present: historyNext[nextIndex] ?? prev.present
            };
        });
    }, [clearPendingTimer, isSame, onCommit]);

    const hasPending = !isSame(present, history[index]);

    return {
        state: present,
        setState,
        undo,
        redo,
        commit: commitNow,
        beginTransaction,
        commitTransaction,
        canUndo: index > 0,
        canRedo: index < history.length - 1,
        hasPending
    };
}
