import { useState, useCallback } from 'react';
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
import { enhanceScenePrompt } from '../services/ai/promptUtils';
import { getSceneAspectRatio } from '../services/ai/utils';
import { MapUpdate } from './useMapUpdate';

const IDLE_TIMEOUT_MS = 45000;
const SUMMARIZING_TIMEOUT_MS = IDLE_TIMEOUT_MS * 3;

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

    const generateIllustration = useCallback(async (messageId: string, prompt: string) => {
        const settings = await loadGlobalSettings();
        if (!settings.enableSceneImages) {
            console.log("[GameLoop] Scene image generation disabled by settings.");
            return;
        }

        const enhancedPrompt = enhanceScenePrompt(prompt);
        const base64 = await generateImage(enhancedPrompt, getSceneAspectRatio());
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
        if (!input.trim() || isProcessing) return;

        const currentStability = gameState.stability;
        const newTurnCount = gameState.turnCount + 1;
        const originalInput = input;

        console.log(`[GameLoop] processing turn ${newTurnCount}, stability ${currentStability}`);

        const userMsg: Message = {
            id: Date.now().toString(),
            sender: 'user',
            content: input,
            timestamp: Date.now()
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
                isTyping: true
            }]
        }));

        try {
            console.log("[GameLoop] Invoking sendAction stream...");
            let fullResponse = '';

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
                    setGameState(prev => ({
                        ...prev,
                        messages: prev.messages.map(m =>
                            m.id === aiMsgId ? { ...m, content: fullResponse } : m
                        )
                    }));
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
                            stabilitySnapshot: updatedStability
                        } : m
                    )
                };

                if (base.map && locResult.locId) {
                    const discovered = new Set(base.map.discoveredNodeIds);
                    discovered.add(locResult.locId);
                    base = {
                        ...base,
                        map: {
                            ...base.map,
                            currentNodeId: locResult.locId,
                            discoveredNodeIds: Array.from(discovered)
                        }
                    };
                }

                return applyMapUpdate(base, mapUpdate);
            });

            if (visualPrompt) {
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
            setIsProcessing(false);
        }
    }, [gameState, setGameState, language, t, setInput, setMemoryEchoActive, buildMapContext, applyMapUpdate, isProcessing, generateIllustration]);

    return {
        isProcessing,
        handleSend,
        generateIllustration
    };
}
