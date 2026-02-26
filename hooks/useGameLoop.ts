import { useState, useCallback } from 'react';
import { GameState, EndingType, Message, Language } from '../types';
import {
    extractVisualPrompt,
    extractStability,
    extractEnding,
    extractLoc,
    extractMapUpdate,
    generateImage
} from '../services/aiService';
import { agentOrchestrator } from '../services/agentOrchestrator';
import { loadGlobalSettings } from '../services/indexedDBService';
import { MapUpdate } from './useMapUpdate';

const IDLE_TIMEOUT_MS = 30000;

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

        const base64 = await generateImage(prompt + ", dark aesthetic, scp foundation style, cinematic lighting", "16:9");
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
            console.log("[GameLoop] Starting Agent Orchestration...");
            
            // Phase 1: Router
            const lastNarratorOutput = gameState.messages
                .filter(m => m.sender === 'narrator')
                .slice(-1)[0]?.content || "";
            
            const routerResult = await agentOrchestrator.runRouterPhase(
                gameState,
                originalInput,
                lastNarratorOutput,
                language
            );
            console.log(`[GameLoop] Router Relevant NPCs: ${routerResult.relevantNpcIds.join(', ')}`);

            // Phase 2: NPC
            const narratorOpening = gameState.messages.find(m => m.sender === 'narrator')?.content || "";
            const npcProposals = await agentOrchestrator.runNPCPhase(
                routerResult.relevantNpcIds,
                gameState,
                routerResult.npcSummaries || {},
                narratorOpening,
                language
            );
            console.log(`[GameLoop] NPC Proposals:`, npcProposals);
            const npcActionSummaries = npcProposals.map(p => ({
                npcId: p.npcId,
                actions: p.actions
            }));
            const encounteredSet = new Set(gameState.encounteredNpcIds || []);
            (routerResult.encounteredNpcIds || []).forEach(id => encounteredSet.add(id));
            const currentNodeId = gameState.map?.currentNodeId;
            (gameState.npcs || []).forEach(npc => {
                if (npc.alive && npc.nodeId === currentNodeId) {
                    encounteredSet.add(npc.id);
                }
            });
            const npcSayMessages = npcProposals.flatMap(p => {
                const npcInfo = gameState.npcs?.find(n => n.id === p.npcId);
                const npcName = npcInfo?.name || p.npcId;
                const isEncountered = encounteredSet.has(p.npcId);
                return p.actions
                    .filter(a => a.type === 'TALK' && a.target === 'player')
                    .map(a => ({
                        id: `${Date.now()}-${p.npcId}-${Math.random().toString(36).slice(2, 6)}`,
                        sender: 'npc' as const,
                        content: isEncountered ? (a.content || '') : t('npc_panel.masked'),
                        timestamp: Date.now(),
                        npcId: p.npcId,
                        npcName: isEncountered ? npcName : t('npc_panel.masked')
                    }));
            });
            const npcSummaries = routerResult.npcSummaries || {};
            const npcLastSummaries = { ...(gameState.npcLastSummaries || {}) };
            Object.entries(npcSummaries).forEach(([npcId, summary]) => {
                if (typeof summary === 'string') {
                    npcLastSummaries[npcId] = summary;
                }
            });
            if (npcSayMessages.length > 0) {
                setGameState(prev => ({
                    ...prev,
                    messages: prev.messages.flatMap(m => m.id === aiMsgId ? [...npcSayMessages, m] : [m])
                }));
            }

            // Phase 3: Narrator (Streaming)
            console.log("[GameLoop] Invoking Narrator Phase...");
            let fullResponse = '';
            const mapContext = buildMapContext();
            
            const stream = agentOrchestrator.runNarratorPhase(
                userMsg.content,
                currentStability,
                newTurnCount,
                language,
                gameState.saveId,
                mapContext,
                npcProposals
            );
            const iterator = stream[Symbol.asyncIterator]();

            let idleTimeoutId: NodeJS.Timeout;

            const createTimeoutPromise = () => new Promise<never>((_, reject) => {
                idleTimeoutId = setTimeout(() => reject(new Error('TIMEOUT')), IDLE_TIMEOUT_MS);
            });

            try {
                while (true) {
                    const result = await Promise.race([
                        iterator.next(),
                        createTimeoutPromise()
                    ]);

                    clearTimeout(idleTimeoutId!);

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

                const withMapUpdate = applyMapUpdate(base, mapUpdate);

                const npcLastActions = { ...(withMapUpdate.npcLastActions || {}) };
                npcActionSummaries.forEach(summary => {
                    npcLastActions[summary.npcId] = summary;
                });

                const settlementLogs = [
                    ...(withMapUpdate.settlementLogs || []),
                    {
                        turn: newTurnCount,
                        timestamp: Date.now(),
                        mapUpdate,
                        npcActions: npcActionSummaries,
                        npcSummaries
                    }
                ];

                return {
                    ...withMapUpdate,
                    encounteredNpcIds: Array.from(encounteredSet),
                    npcLastActions,
                    npcLastSummaries,
                    settlementLogs
                };
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
