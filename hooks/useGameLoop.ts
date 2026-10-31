import { useState, useCallback, useRef } from 'react';
import { GameState, EndingType, Message, Language } from '../types';
import {
    sendAction,
    extractVisualPrompt,
    extractStability,
    extractEnding,
    extractLoc,
    extractMapUpdate,
    generateImage,
    setMapContextProvider,
    setProviderCallbacks
} from '../services/aiService';
import { loadGlobalSettings } from '../services/indexedDBService';
import { getSceneAspectRatio } from '../services/ai/utils';
import { MapUpdate } from './useMapUpdate';

const IDLE_TIMEOUT_MS = 45000;
const SUMMARIZING_TIMEOUT_MS = IDLE_TIMEOUT_MS * 3;

const moveToNode = (state: GameState, nodeId: string): GameState => {
    if (!state.map) return state;
    const discovered = new Set(state.map.discoveredNodeIds);
    discovered.add(nodeId);
    return {
        ...state,
        map: { ...state.map, currentNodeId: nodeId, discoveredNodeIds: Array.from(discovered) }
    };
};

interface UseGameLoopOptions {
    gameState: GameState;
    setGameState: React.Dispatch<React.SetStateAction<GameState>>;
    language: Language;
    t: (key: string) => string;
    setInput: React.Dispatch<React.SetStateAction<string>>;
    setMemoryEchoActive: React.Dispatch<React.SetStateAction<boolean>>;
    buildMapContext: () => string;
    applyMapUpdate: (prev: GameState, update: MapUpdate | null | undefined) => GameState;
}

interface UseGameLoopReturn {
    isProcessing: boolean;
    handleSend: (input: string) => Promise<void>;
    generateIllustration: (messageId: string, prompt: string) => Promise<void>;
}

export function useGameLoop(options: UseGameLoopOptions): UseGameLoopReturn {
    const { gameState, setGameState, language, t, setInput, setMemoryEchoActive, buildMapContext, applyMapUpdate } = options;
    const [isProcessing, setIsProcessing] = useState(false);
    const processingRef = useRef(false);

    const generateIllustration = useCallback(async (messageId: string, prompt: string) => {
        const settings = await loadGlobalSettings();
        if (!settings.enableSceneImages) {
            console.log("[GameLoop] Scene image generation disabled by settings.");
            return;
        }

        const base64 = await generateImage(prompt, getSceneAspectRatio(), "url", 'scene');
        if (base64) {
            setGameState(prev => ({
                ...prev,
                messages: prev.messages.map(m =>
                    m.id === messageId ? { ...m, imageUrl: base64 } : m
                )
            }));
        }
    }, [setGameState]);

    const handleSend = useCallback(async (input: string) => {
        if (!input.trim() || isProcessing || processingRef.current) return;

        processingRef.current = true;

        const currentStability = gameState.stability;
        const newTurnCount = gameState.turnCount + 1;
        const originalInput = input;

        console.log(`[GameLoop] processing turn ${newTurnCount}, stability ${currentStability}`);

        const userMsg: Message = {
            id: Date.now().toString(),
            sender: 'user',
            content: input,
            timestamp: Date.now(),
            turnIndex: newTurnCount
        };

        setGameState(prev => ({
            ...prev,
            turnCount: newTurnCount,
            messages: [...prev.messages, userMsg]
        }));
        setInput('');
        setIsProcessing(true);

        const aiMsgId = (Date.now() + 1).toString();
        setGameState(prev => ({
            ...prev,
            messages: [...prev.messages, {
                id: aiMsgId,
                sender: 'narrator',
                content: '',
                timestamp: Date.now(),
                isTyping: true,
                turnIndex: newTurnCount
            }]
        }));

        try {
            console.log("[GameLoop] Invoking sendAction stream...");
            let fullResponse = '';
            let illustrationStarted = false;
            let peekedLocId: string | null = null;

            const onTokenUpdate = (count: number) => {
                 setGameState(prev => ({ ...prev, tokenCount: count }));
            };
            
            const abortController = new AbortController();
            let iterator: AsyncIterator<string> | null = null;
            const cancelStream = () => {
                if (!abortController.signal.aborted) {
                    abortController.abort();
                }
                if (iterator?.return) {
                    iterator.return(undefined as any).catch(() => {});
                }
            };

            let timeoutReject: ((error: Error) => void) | null = null;
            const startTimeout = (ms: number) => {
                if (idleTimeoutId) clearTimeout(idleTimeoutId);
                if (!timeoutReject) return;
                idleTimeoutId = setTimeout(() => {
                    cancelStream();
                    timeoutReject?.(new Error('TIMEOUT'));
                }, ms);
            };

            const onStatusUpdate = (status: 'idle' | 'generating' | 'summarizing') => {
                 setGameState(prev => ({ ...prev, aiState: status }));
                 if (status === 'summarizing') {
                    startTimeout(SUMMARIZING_TIMEOUT_MS);
                 } else {
                    startTimeout(IDLE_TIMEOUT_MS);
                 }
            };

            setMapContextProvider(buildMapContext);
            setProviderCallbacks({ onTokenUpdate, onStatusUpdate });
            const stream = sendAction(
                userMsg.content, 
                currentStability, 
                newTurnCount, 
                language, 
                gameState.saveId,
                abortController.signal
            );
            iterator = stream[Symbol.asyncIterator]();

            let idleTimeoutId: NodeJS.Timeout;

            const createTimeoutPromise = () => new Promise<never>((_, reject) => {
                timeoutReject = reject;
                startTimeout(IDLE_TIMEOUT_MS);
            });

            try {
                while (true) {
                    const result = await Promise.race([
                        iterator.next(),
                        createTimeoutPromise()
                    ]);

                    clearTimeout(idleTimeoutId!);
                    timeoutReject = null;

                    if (result.done) break;

                    let chunk = result.value;

                    if (chunk.includes('[MEMORY_ACTIVE]')) {
                        console.log("[GameLoop] Memory Echo Detected (Fallback)!");
                        setMemoryEchoActive(true);
                        chunk = chunk.replace('[MEMORY_ACTIVE]', '');
                        setTimeout(() => setMemoryEchoActive(false), 5000);
                    }

                    fullResponse += chunk;

                    // Tags that lead the reply let the scene change before the first line is read
                    if (!illustrationStarted) {
                        const earlyVisual = extractVisualPrompt(fullResponse).visualPrompt;
                        if (earlyVisual) {
                            illustrationStarted = true;
                            generateIllustration(aiMsgId, earlyVisual);
                        }
                    }
                    const earlyLoc = peekedLocId ? null : extractLoc(fullResponse).locId;
                    if (earlyLoc) peekedLocId = earlyLoc;

                    setGameState(prev => {
                        const base: GameState = {
                            ...prev,
                            messages: prev.messages.map(m =>
                                m.id === aiMsgId ? { ...m, content: fullResponse } : m
                            )
                        };
                        return earlyLoc ? moveToNode(base, earlyLoc) : base;
                    });
                }
            } catch (e) {
                clearTimeout(idleTimeoutId!);
                throw e;
            }

            console.log("[GameLoop] Stream completed. Full response length:", fullResponse.length);

            if (!fullResponse) {
                console.warn("[GameLoop] Warning: Received empty response from model.");
            }

            const endingResult = extractEnding(fullResponse);
            const textAfterEnding = endingResult.cleanText;
            let detectedEndingType = endingResult.endingType;

            const stabilityResult = extractStability(textAfterEnding);
            const textAfterStability = stabilityResult.cleanText;
            const nextStability = stabilityResult.newStability;

            if (nextStability !== null && nextStability <= 0 && !detectedEndingType) {
                detectedEndingType = EndingType.COLLAPSE;
            }

            const locResult = extractLoc(textAfterStability);
            const textAfterLoc = locResult.cleanText;
            const mapUpdateResult = extractMapUpdate(textAfterLoc);
            const textAfterMapUpdate = mapUpdateResult.cleanText;

            const visualResult = extractVisualPrompt(textAfterMapUpdate);
            const finalText = visualResult.cleanText;

            const visualPrompt = visualResult.visualPrompt;

            const updatedStability = nextStability !== null ? nextStability : gameState.stability;

            const mapUpdate = mapUpdateResult.update;

            setGameState(prev => {
                let base: GameState = {
                    ...prev,
                    stability: updatedStability,
                    endingType: detectedEndingType,
                    messages: prev.messages.map(m =>
                        m.id === aiMsgId ? {
                            ...m,
                            content: finalText,
                            isTyping: false,
                            stabilitySnapshot: updatedStability,
                        } : m
                    )
                };

                if (locResult.locId) {
                    base = moveToNode(base, locResult.locId);
                }

                const nodeId = base.map?.currentNodeId;
                base = {
                    ...base,
                    messages: base.messages.map(m => (m.id === aiMsgId ? { ...m, nodeId } : m))
                };

                return applyMapUpdate(base, mapUpdate);
            });

            if (visualPrompt && !illustrationStarted) {
                generateIllustration(aiMsgId, visualPrompt);
            }

        } catch (error: any) {
            console.error("[GameLoop] Game Loop Error:", error);

            let errorMessage = t('game.err_offline');
            if (error.message === 'TIMEOUT') {
                errorMessage = t('game.err_timeout');
                setInput(originalInput);
            }

            setGameState(prev => ({
                ...prev,
                messages: prev.messages.map(m =>
                    m.id === aiMsgId ? { ...m, content: errorMessage, isTyping: false } : m
                )
            }));

        } finally {
            processingRef.current = false;
            setIsProcessing(false);
        }
    }, [gameState, setGameState, language, t, setInput, setMemoryEchoActive, buildMapContext, applyMapUpdate, isProcessing, generateIllustration]);

    return {
        isProcessing,
        handleSend,
        generateIllustration
    };
}
